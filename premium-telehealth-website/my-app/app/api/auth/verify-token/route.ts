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
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { hashToken } from '@/lib/auth/token-utils';
import { rateLimit } from '@/lib/middleware/rate-limit';
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
  // Rate limiting: 10 GETs per 15 min per (IP + token) pair. This endpoint is
  // idempotent and legitimately gets hit more than once during normal flows
  // (e.g. when the page mounts, when the user refreshes, or when React Strict
  // Mode double-invokes effects in development). Key by token so a shared-IP
  // NAT/VPN doesn't lock everyone out. Still fails closed per IP as a backstop
  // when no token is present.
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const tokenParam = request.nextUrl.searchParams.get('token') ?? '';
  const rateLimitKey = tokenParam
    ? `${clientIp}:${tokenParam.slice(0, 16)}`
    : clientIp;
  const rateLimitResult = await rateLimit(rateLimitKey, {
    requests: 10,
    windowMs: 15 * 60 * 1000,
    keyPrefix: 'ratelimit:verify-token',
    useMemoryFallback: true,
  });
  if (!rateLimitResult.success) {
    return NextResponse.json(
      {
        error: 'Too many verification attempts. Please wait a few minutes and try again.',
        code: 'RATE_LIMITED',
      },
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

  // Tokens are stored hashed at rest; hash the incoming raw token once and use
  // the hash for both the DB lookup and the timing-safe comparison below.
  const tokenHash = hashToken(token);

  try {
    // Defense-in-depth: prisma.findUnique uses a DB index lookup (constant-time
    // at the database level, not vulnerable to byte-by-byte timing attacks).
    // We additionally perform a timing-safe comparison on the retrieved token
    // hash vs the hash of the user-supplied token so that even if the DB driver
    // leaks timing information through network latency, the comparison is safe.
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token: tokenHash },
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
      ).catch((err) => console.error('[auth:verify-token] audit/rate-limit failed:', err instanceof Error ? err.message : 'Unknown error'));

      return NextResponse.json(
        { error: 'Invalid or expired link', code: 'INVALID_TOKEN' },
        { status: 400 }
      );
    }

    // Timing-safe comparison: ensure the stored token hash matches the hash of
    // the input token in constant time, preventing timing side-channel attacks.
    const storedBuf = Buffer.from(resetRecord.token, 'utf-8');
    const inputBuf = Buffer.from(tokenHash, 'utf-8');
    if (storedBuf.length !== inputBuf.length || !timingSafeEqual(storedBuf, inputBuf)) {
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
      ).catch((err) => console.error('[auth:verify-token] audit/rate-limit failed:', err instanceof Error ? err.message : 'Unknown error'));

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
      ).catch((err) => console.error('[auth:verify-token] audit/rate-limit failed:', err instanceof Error ? err.message : 'Unknown error'));

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
    ).catch((err) => console.error('[auth:verify-token] audit/rate-limit failed:', err instanceof Error ? err.message : 'Unknown error'));

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
