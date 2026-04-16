/**
 * GET /api/auth/verify-email
 * Verifies a user's email address via a one-time token.
 *
 * Per Team H Amendment 2: reuses the PasswordReset model for verification tokens,
 * identified by the "verify-" prefix on the token value.
 *
 * Flow:
 * 1. User clicks verification link: /verify-email?token=verify-xxx
 * 2. Client page calls this API
 * 3. API validates token, sets user.emailVerified = true, marks token used
 * 4. Returns success — client redirects to /login
 *
 * HIPAA Compliance:
 * - No PHI in logs or responses
 * - Token is single-use (usedAt checked)
 * - Token has expiry (24 hours)
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
  const auditContext = getAuditContext(request);
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { error: 'Verification token is required', code: 'MISSING_TOKEN' },
      { status: 400 }
    );
  }

  // Verify the token starts with "verify-" prefix (distinguishes from password reset tokens)
  if (!token.startsWith('verify-')) {
    return NextResponse.json(
      { error: 'Invalid verification token', code: 'INVALID_TOKEN' },
      { status: 400 }
    );
  }

  // Rate limiting — outside try/catch so 429 is never swallowed as 500
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateLimitResult = await rateLimit(clientIp, rateLimitPresets.strict);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter ?? 60) } }
    );
  }

  try {
    // Find the token in PasswordReset table
    const verificationRecord = await prisma.passwordReset.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            emailVerified: true,
          },
        },
      },
    });

    if (!verificationRecord) {
      await auditPasswordEvent(
        AuditEventType.EMAIL_VERIFIED,
        'unknown',
        auditContext,
        false,
        'Invalid verification token'
      ).catch((err) => console.error('[auth:verify-email] audit/rate-limit failed:', err instanceof Error ? err.message : 'Unknown error'));

      return NextResponse.json(
        { error: 'Invalid or expired verification link', code: 'INVALID_TOKEN' },
        { status: 400 }
      );
    }

    // If the user's email is already verified, return success immediately
    // (handles re-clicks on the verification link without rate limiting)
    if (verificationRecord.user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Email already verified. You can log in.',
        alreadyVerified: true,
      });
    }

    // Check expiry
    if (new Date() > verificationRecord.expiresAt) {
      await auditPasswordEvent(
        AuditEventType.EMAIL_VERIFIED,
        verificationRecord.userId,
        auditContext,
        false,
        'Verification token expired'
      ).catch((err) => console.error('[auth:verify-email] audit/rate-limit failed:', err instanceof Error ? err.message : 'Unknown error'));

      return NextResponse.json(
        { error: 'This verification link has expired. Please request a new one.', code: 'TOKEN_EXPIRED' },
        { status: 400 }
      );
    }

    // Check if already used (but email not yet verified — edge case)
    if (verificationRecord.usedAt !== null) {
      await auditPasswordEvent(
        AuditEventType.EMAIL_VERIFIED,
        verificationRecord.userId,
        auditContext,
        false,
        'Verification token already used'
      ).catch((err) => console.error('[auth:verify-email] audit/rate-limit failed:', err instanceof Error ? err.message : 'Unknown error'));

      return NextResponse.json(
        { error: 'This verification link has already been used.', code: 'TOKEN_USED' },
        { status: 400 }
      );
    }

    // Verify the email and mark token as used in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: verificationRecord.userId },
        data: { emailVerified: true },
      });

      await tx.passwordReset.update({
        where: { id: verificationRecord.id },
        data: { usedAt: new Date() },
      });
    });

    // Audit log — success
    await auditPasswordEvent(
      AuditEventType.EMAIL_VERIFIED,
      verificationRecord.userId,
      auditContext
    ).catch(() => {
      // Non-fatal: audit logging failure should not block verification
    });

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully! You can now log in.',
    });
  } catch (error) {
    console.error('[verify-email] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Email verification failed. Please try again.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
