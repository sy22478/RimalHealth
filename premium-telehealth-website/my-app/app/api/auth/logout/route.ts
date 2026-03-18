/**
 * POST /api/auth/logout
 * User logout endpoint
 * 
 * Invalidates the current session and clears authentication cookies.
 * 
 * HIPAA Compliance:
 * - Clears all session tokens
 * - Audit logging for logout events
 * - Supports "logout all devices" functionality
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { invalidateUserSessions } from '@/lib/auth/session';
import { verifyAccessToken, decodeTokenUnsafe } from '@/lib/auth/jwt';
import { rateLimit } from '@/lib/middleware/rate-limit';
import { auditLogger } from '@/lib/audit/logger';
import { AuditEventType } from '@/lib/audit/types';
import { prisma } from '@/lib/db/prisma';

/**
 * Extract token from request
 */
function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  const tokenCookie = request.cookies.get('accessToken');
  if (tokenCookie?.value) {
    return tokenCookie.value;
  }
  
  return null;
}

/**
 * POST /api/auth/logout
 * Logout current session
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limiting: 30 requests per minute per IP
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateLimitResult = await rateLimit(clientIp, { requests: 30, windowMs: 60 * 1000, keyPrefix: 'ratelimit:auth:logout' });
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter ?? 60) } }
    );
  }

  try {
    const token = extractToken(request);
    let userId: string | undefined;
    
    // Try to get userId from token for audit logging
    if (token) {
      try {
        const payload = await verifyAccessToken(token);
        userId = payload.userId;
      } catch {
        // Token invalid, try to decode without verification
        const decoded = decodeTokenUnsafe(token);
        if (decoded?.userId) {
          userId = decoded.userId as string;
        }
      }
    }
    
    // Clear cookies
    const cookieStore = await cookies();
    cookieStore.delete('accessToken');
    cookieStore.delete('refreshToken');
    
    // Invalidate session in database
    if (token) {
      try {
        await prisma.session.deleteMany({ where: { token } });
      } catch {
        // Best-effort — don't block logout if DB cleanup fails
      }
    }

    // Audit log the logout event
    if (userId) {
      auditLogger.logAuth(AuditEventType.USER_LOGOUT, userId, true, {
        ipAddress: clientIp,
        userAgent: request.headers.get('user-agent') ?? 'unknown',
        requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
      });
    }

    // Redirect to login after successful logout
    return NextResponse.redirect(new URL('/login', request.url));
  } catch (error) {
    console.error('Logout error:', error);

    // Still clear cookies even if something went wrong
    const cookieStore = await cookies();
    cookieStore.delete('accessToken');
    cookieStore.delete('refreshToken');

    return NextResponse.redirect(new URL('/login', request.url));
  }
}

/**
 * POST /api/auth/logout-all
 * Logout from all devices
 * 
 * Increments token version to invalidate all refresh tokens
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const token = extractToken(request);
    
    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    const payload = await verifyAccessToken(token);
    const userId = payload.userId;
    
    // Increment token version to invalidate all refresh tokens
    await invalidateUserSessions(userId);
    
    // Clear cookies
    const cookieStore = await cookies();
    cookieStore.delete('accessToken');
    cookieStore.delete('refreshToken');
    
    return NextResponse.json({
      success: true,
      message: 'Logged out from all devices',
    });
  } catch (error) {
    console.error('Logout all error:', error);
    
    return NextResponse.json(
      {
        error: 'Logout failed',
        code: 'LOGOUT_FAILED',
      },
      { status: 500 }
    );
  }
}
