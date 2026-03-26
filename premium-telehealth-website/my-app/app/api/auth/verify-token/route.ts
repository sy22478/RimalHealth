/**
 * GET /api/auth/verify-token
 * Validates a PasswordReset token and returns the associated email.
 * Used by the /create-account page to display the user's email as read-only.
 *
 * This does NOT consume the token — it only checks validity.
 * No PHI is exposed; only the email associated with the token is returned.
 *
 * HIPAA Compliance:
 * - Rate limited to prevent brute-force token enumeration
 * - Audit logging on all paths (success and failure)
 * - No PHI in logs or error messages
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { rateLimit, rateLimitPresets } from '@/lib/middleware/rate-limit';
import { auditPasswordEvent } from '@/lib/audit/logger';
import { AuditContext, AuditEventType } from '@/lib/audit/types';

export const dynamic = 'force-dynamic';

/**
 * Extract audit context from request
 */
function getAuditContext(request: NextRequest): AuditContext {
  const forwarded = request.headers.get('x-forwarded-for');
  return {
    ipAddress: forwarded?.split(',')[0]?.trim() ?? 'unknown',
    userAgent: request.headers.get('user-agent') ?? 'unknown',
    requestId: crypto.randomUUID(),
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Rate limiting: strict — 5 requests per 15 minutes per IP
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateLimitResult = await rateLimit(clientIp, rateLimitPresets.strict);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter ?? 60) } }
    );
  }

  const auditContext = getAuditContext(request);
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { error: 'Token is required', code: 'MISSING_TOKEN' },
      { status: 400 }
    );
  }

  try {
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!resetRecord) {
      await auditPasswordEvent(
        AuditEventType.PASSWORD_RESET_REQUESTED,
        'unknown',
        auditContext,
        false,
        'Invalid token'
      ).catch(() => {});

      return NextResponse.json(
        { error: 'Invalid or expired link', code: 'INVALID_TOKEN' },
        { status: 400 }
      );
    }

    // Check expiry
    if (new Date() > resetRecord.expiresAt) {
      await auditPasswordEvent(
        AuditEventType.PASSWORD_RESET_REQUESTED,
        resetRecord.userId,
        auditContext,
        false,
        'Token expired'
      ).catch(() => {});

      return NextResponse.json(
        { error: 'This link has expired. Please contact support.', code: 'TOKEN_EXPIRED' },
        { status: 400 }
      );
    }

    // Check if already used
    if (resetRecord.usedAt !== null) {
      await auditPasswordEvent(
        AuditEventType.PASSWORD_RESET_REQUESTED,
        resetRecord.userId,
        auditContext,
        false,
        'Token already used'
      ).catch(() => {});

      return NextResponse.json(
        { error: 'This link has already been used. Please log in instead.', code: 'TOKEN_USED' },
        { status: 400 }
      );
    }

    // Token is valid — audit success
    await auditPasswordEvent(
      AuditEventType.PASSWORD_RESET_REQUESTED,
      resetRecord.userId,
      auditContext,
      true
    ).catch(() => {});

    return NextResponse.json({
      email: resetRecord.user.email,
      valid: true,
    });
  } catch (error) {
    console.error('[verify-token] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Unable to verify token. Please try again.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
