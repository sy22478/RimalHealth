/**
 * POST /api/auth/mfa/verify-sms
 * Verify SMS verification code during patient login.
 *
 * Body: { mfaToken: string, code: string }
 *
 * On success, issues real access + refresh tokens and sets cookies.
 * Rate limited: 5 failed attempts per 15 minutes per user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { jwtVerify } from 'jose';
import {
  generateTokenPair,
  ACCESS_TOKEN_EXPIRY_SECONDS,
} from '@/lib/auth/jwt';
import { prisma } from '@/lib/db/prisma';
import { getRedisClient } from '@/lib/redis/client';
import {
  verifySMSCode,
  isSMSVerificationLocked,
  recordSMSFailedAttempt,
  clearSMSFailedAttempts,
} from '@/lib/auth/sms-mfa';
import { auditLogger } from '@/lib/audit/logger';
import { AuditEventType } from '@/lib/audit/types';

const verifySmsSchema = z.object({
  mfaToken: z.string().min(1, { message: 'MFA token is required' }),
  code: z.string().length(6, { message: 'Code must be 6 digits' }).regex(/^\d{6}$/, { message: 'Code must be numeric' }),
});

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return new TextEncoder().encode(secret);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const userAgent = request.headers.get('user-agent') ?? 'unknown';

  try {
    const body = await request.json();
    const validation = verifySmsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { mfaToken, code } = validation.data;

    // Verify the MFA token
    let mfaPayload: { userId: string; email: string; role: string };
    try {
      const { payload } = await jwtVerify(mfaToken, getSecret(), {
        algorithms: ['HS256'],
        audience: 'telehealth-api',
        issuer: 'telehealth-platform',
      });

      if (payload.type !== 'mfa') {
        return NextResponse.json(
          { error: 'Invalid MFA token', code: 'INVALID_MFA_TOKEN' },
          { status: 401 },
        );
      }

      mfaPayload = {
        userId: payload.userId as string,
        email: payload.email as string,
        role: payload.role as string,
      };
    } catch {
      return NextResponse.json(
        { error: 'MFA token expired or invalid. Please log in again.', code: 'MFA_TOKEN_EXPIRED' },
        { status: 401 },
      );
    }

    // Get Redis
    let redis;
    try {
      redis = getRedisClient();
    } catch {
      console.error('[SMS MFA] Redis unavailable, cannot verify code');
      return NextResponse.json(
        { error: 'Verification service temporarily unavailable. Please try again.', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 },
      );
    }

    // Check lockout
    const locked = await isSMSVerificationLocked(redis, mfaPayload.userId);
    if (locked) {
      return NextResponse.json(
        {
          error: 'Too many failed attempts. Try again in 15 minutes.',
          code: 'MFA_RATE_LIMITED',
        },
        { status: 429 },
      );
    }

    // Verify code
    const verified = await verifySMSCode(redis, mfaPayload.userId, code);

    if (!verified) {
      const attempts = await recordSMSFailedAttempt(redis, mfaPayload.userId);

      await auditLogger.log({
        eventType: AuditEventType.MFA_FAILED,
        userId: mfaPayload.userId,
        userRole: mfaPayload.role,
        resourceType: 'MFA',
        action: 'SMS MFA verification failed',
        ipAddress,
        userAgent,
        success: false,
        errorMessage: 'Invalid SMS code',
        metadata: { method: 'sms', attempts },
      }).catch(() => {});

      const remaining = Math.max(0, 5 - attempts);
      return NextResponse.json(
        {
          error: 'Invalid verification code',
          code: 'INVALID_MFA_CODE',
          attemptsRemaining: remaining,
        },
        { status: 401 },
      );
    }

    // Success — clear failed attempts
    await clearSMSFailedAttempts(redis, mfaPayload.userId);

    // Fetch user for token generation
    const user = await prisma.user.findUnique({
      where: { id: mfaPayload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        tokenVersion: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 },
      );
    }

    // Generate real token pair
    const { accessToken, refreshToken } = await generateTokenPair(
      user.id,
      user.email,
      user.role as 'PATIENT' | 'PHYSICIAN' | 'ADMIN',
      user.tokenVersion,
    );

    // Create session (best-effort)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await prisma.session.create({
      data: {
        userId: user.id,
        token: accessToken,
        refreshToken,
        expiresAt,
        ipAddress,
        userAgent,
      },
    }).catch((err) =>
      console.error('Session creation failed (non-fatal):', err instanceof Error ? err.message : 'Unknown error'),
    );

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => {});

    // Audit successful verification
    await auditLogger.log({
      eventType: AuditEventType.MFA_VERIFIED,
      userId: user.id,
      userRole: user.role,
      resourceType: 'MFA',
      action: 'SMS MFA verification successful',
      ipAddress,
      userAgent,
      success: true,
      metadata: { method: 'sms' },
    }).catch(() => {});

    // Set cookies
    const cookieStore = await cookies();

    cookieStore.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: ACCESS_TOKEN_EXPIRY_SECONDS,
      path: '/',
    });

    cookieStore.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    const redirectUrl = '/patient/dashboard';

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      redirectUrl,
    });
  } catch (error) {
    console.error('SMS MFA verify error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'MFA verification failed', code: 'MFA_VERIFY_ERROR' },
      { status: 500 },
    );
  }
}
