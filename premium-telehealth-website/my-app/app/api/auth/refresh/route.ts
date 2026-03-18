/**
 * POST /api/auth/refresh
 * Token refresh endpoint
 * 
 * HIPAA Compliance:
 * - Validates token version to ensure session hasn't been invalidated
 * - Issues new token pair (token rotation)
 * - Audit logging for token refresh events
 * - Old refresh tokens are invalidated via token versioning
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';

// JWT utilities
import {
  verifyRefreshToken,
  generateTokenPair,
  ACCESS_TOKEN_EXPIRY_SECONDS,
} from '@/lib/auth/jwt';

// Session management
import { validateTokenVersion, createSession } from '@/lib/auth/session';

// Database
import { prisma } from '@/lib/db/prisma';

// Audit
import { auditLog } from '@/lib/audit/logger';
import { AuditContext, AuditEventType, AuditSeverity } from '@/lib/audit/types';

// Rate limiting
import { rateLimit } from '@/lib/middleware/rate-limit';

// ============================================
// Validation Schema
// ============================================

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});


// ============================================
// Helper Functions
// ============================================

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

/**
 * Rotate session: delete old session, create new one
 * Ensures the old refresh token cannot be reused.
 */
async function rotateSession(
  oldRefreshToken: string,
  userId: string,
  newAccessToken: string,
  newRefreshToken: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  // 1. Invalidate the old session by deleting it
  await prisma.session.deleteMany({
    where: { refreshToken: oldRefreshToken },
  });

  // 2. Create a new session with the new tokens
  await createSession(userId, newAccessToken, newRefreshToken, ipAddress, userAgent);
}

// ============================================
// Route Handler
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limiting: 30 requests per minute per IP
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateLimitResult = await rateLimit(clientIp, { requests: 30, windowMs: 60 * 1000, keyPrefix: 'ratelimit:auth:refresh' });
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter ?? 60) } }
    );
  }

  const auditContext = getAuditContext(request);

  try {
    // Parse request body (may be empty when using cookie-only auth)
    let refreshToken: string | undefined;

    try {
      const body = await request.json();
      const validationResult = refreshSchema.safeParse(body);
      if (validationResult.success) {
        refreshToken = validationResult.data.refreshToken;
      }
    } catch {
      // Body may be empty or non-JSON when relying on cookies -- that's fine
    }

    // Fallback: read refresh token from httpOnly cookie
    if (!refreshToken) {
      const cookieToken = request.cookies.get('refreshToken')?.value;
      if (cookieToken) {
        refreshToken = cookieToken;
      }
    }

    if (!refreshToken) {
      return NextResponse.json(
        {
          error: 'Refresh token is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Verify the refresh token
    let payload;
    try {
      payload = await verifyRefreshToken(refreshToken);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid token';

      await auditLog(
        AuditEventType.USER_LOGIN_FAILED,
        {
          action: 'Token refresh failed - invalid token',
          success: false,
          severity: AuditSeverity.WARNING,
          metadata: { reason: errorMessage },
          ipAddress: auditContext.ipAddress,
        },
        auditContext
      );

      return NextResponse.json(
        {
          error: 'Invalid or expired refresh token',
          code: 'INVALID_TOKEN',
        },
        { status: 401 }
      );
    }

    const { userId, tokenVersion } = payload;

    // Check if token version matches the user's current version
    const isValidVersion = await validateTokenVersion(userId, tokenVersion);

    if (!isValidVersion) {
      await auditLog(
        AuditEventType.USER_LOGIN_FAILED,
        {
          userId,
          action: 'Token refresh failed - session invalidated',
          success: false,
          severity: AuditSeverity.WARNING,
          metadata: { reason: 'Token version mismatch' },
          ipAddress: auditContext.ipAddress,
        },
        auditContext
      );

      return NextResponse.json(
        {
          error: 'Session has been invalidated. Please log in again.',
          code: 'SESSION_INVALIDATED',
        },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        tokenVersion: true,
      },
    });

    if (!user) {
      await auditLog(
        AuditEventType.USER_LOGIN_FAILED,
        {
          userId,
          action: 'Token refresh failed - user not found',
          success: false,
          severity: AuditSeverity.ERROR,
          ipAddress: auditContext.ipAddress,
        },
        auditContext
      );

      return NextResponse.json(
        {
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        },
        { status: 401 }
      );
    }

    // Generate new token pair (token rotation)
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await generateTokenPair(user.id, user.email, user.role, user.tokenVersion);

    // Rotate session: delete old session record, create new one
    // This ensures the old refresh token is invalidated and cannot be reused
    try {
      await rotateSession(
        refreshToken,
        user.id,
        newAccessToken,
        newRefreshToken,
        auditContext.ipAddress,
        auditContext.userAgent
      );
    } catch {
      // If rotation fails (e.g., old session didn't exist), still create new session
      await createSession(
        user.id,
        newAccessToken,
        newRefreshToken,
        auditContext.ipAddress,
        auditContext.userAgent
      );
    }

    // Log token refresh audit event
    await auditLog(
      AuditEventType.USER_LOGIN, // Using USER_LOGIN as base type for token refresh
      {
        userId: user.id,
        action: 'Token refreshed successfully',
        success: true,
        severity: AuditSeverity.INFO,
        metadata: { eventSubtype: 'TOKEN_REFRESHED' },
        ipAddress: auditContext.ipAddress,
      },
      auditContext
    );

    // Update HTTP-only cookies
    const cookieStore = await cookies();
    
    cookieStore.set('accessToken', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: ACCESS_TOKEN_EXPIRY_SECONDS,
      path: '/',
    });

    cookieStore.set('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Return new token pair
    return NextResponse.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
    });
  } catch (error) {
    console.error('Token refresh error:', error);

    return NextResponse.json(
      {
        error: 'Token refresh failed. Please try again later.',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
