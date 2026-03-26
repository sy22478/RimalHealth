/**
 * POST /api/auth/mfa/verify
 * Verify MFA code during login.
 *
 * Body: { mfaToken: string, code: string }
 *
 * The mfaToken is a short-lived JWT (5 min, type: 'mfa') issued
 * by the login endpoint when the user has MFA enabled.
 *
 * The code can be either a 6-digit TOTP code or an 8-char backup code.
 * On success, real access + refresh tokens are issued and cookies set.
 *
 * Rate limited: 5 attempts per 15 minutes per user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { jwtVerify } from 'jose';
import {
  generateTokenPair,
  ACCESS_TOKEN_EXPIRY_SECONDS,
} from '@/lib/auth/jwt';
import {
  verifyMFATOTP,
  decryptMFASecret,
  decryptBackupCodes,
  encryptBackupCodes,
  verifyBackupCode,
} from '@/lib/auth/mfa';
import { prisma } from '@/lib/db/prisma';
import { auditLogger } from '@/lib/audit/logger';
import { AuditEventType } from '@/lib/audit/types';
import {
  checkAuthenticationAllowed,
  recordFailedAttempt,
  clearFailedAttempts,
} from '@/lib/auth/account-lockout';

const verifySchema = z.object({
  mfaToken: z.string().min(1, 'MFA token is required'),
  code: z.string().min(1, 'Verification code is required'),
});

/**
 * Get JWT secret
 */
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
    const validation = verifySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { mfaToken, code } = validation.data;

    // Verify the MFA token (short-lived, type: 'mfa')
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
          { status: 401 }
        );
      }

      mfaPayload = {
        userId: payload.userId as string,
        email: payload.email as string,
        role: payload.role as string,
      };
    } catch {
      return NextResponse.json(
        {
          error: 'MFA token expired or invalid. Please log in again.',
          code: 'MFA_TOKEN_EXPIRED',
        },
        { status: 401 }
      );
    }

    // Rate limit: check account lockout (reuse existing lockout with mfa: prefix)
    const lockoutKey = `mfa:${mfaPayload.email}`;
    try {
      const lockoutCheck = await checkAuthenticationAllowed(lockoutKey);
      if (!lockoutCheck.allowed) {
        return NextResponse.json(
          {
            error: 'Too many failed MFA attempts. Please try again later.',
            code: 'MFA_RATE_LIMITED',
            remainingSeconds: lockoutCheck.status.remainingSeconds,
          },
          { status: 429 }
        );
      }
    } catch {
      // Redis unavailable, skip rate limiting
    }

    // Fetch user with MFA data
    const user = await prisma.user.findUnique({
      where: { id: mfaPayload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        tokenVersion: true,
        mfaEnabled: true,
        mfaSecret: true,
        mfaBackupCodes: true,
      },
    });

    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return NextResponse.json(
        { error: 'MFA is not configured for this account', code: 'MFA_NOT_CONFIGURED' },
        { status: 400 }
      );
    }

    // Decrypt MFA secret
    const secret = decryptMFASecret(user.mfaSecret);

    // Determine if code is a TOTP (6 digits) or backup code (8 alphanumeric)
    const isTOTP = /^\d{6}$/.test(code.trim());
    let verified = false;

    if (isTOTP) {
      verified = verifyMFATOTP(secret, code.trim());
    } else {
      // Try as backup code
      if (user.mfaBackupCodes) {
        const storedCodes = decryptBackupCodes(user.mfaBackupCodes);
        const result = verifyBackupCode(storedCodes, code);
        verified = result.valid;

        if (verified) {
          // Update remaining backup codes
          const encryptedRemaining = encryptBackupCodes(result.remainingCodes);
          await prisma.user.update({
            where: { id: user.id },
            data: { mfaBackupCodes: encryptedRemaining },
          });
        }
      }
    }

    if (!verified) {
      // Record failed attempt
      await recordFailedAttempt(lockoutKey).catch(() => {});

      await auditLogger.log({
        eventType: AuditEventType.MFA_FAILED,
        userId: user.id,
        userRole: user.role,
        resourceType: 'MFA',
        action: 'MFA verification failed during login',
        ipAddress,
        userAgent,
        success: false,
        errorMessage: isTOTP ? 'Invalid TOTP code' : 'Invalid backup code',
      }).catch(() => {});

      return NextResponse.json(
        { error: 'Invalid verification code', code: 'INVALID_MFA_CODE' },
        { status: 401 }
      );
    }

    // Clear failed attempts
    await clearFailedAttempts(lockoutKey).catch(() => {});

    // Generate real token pair
    const { accessToken, refreshToken } = await generateTokenPair(
      user.id,
      user.email,
      user.role as 'PATIENT' | 'PHYSICIAN' | 'ADMIN',
      user.tokenVersion
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
    }).catch((err) => console.error('Session creation failed (non-fatal):', err instanceof Error ? err.message : 'Unknown error'));

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => {});

    // Audit successful MFA verification
    await auditLogger.log({
      eventType: AuditEventType.MFA_VERIFIED,
      userId: user.id,
      userRole: user.role,
      resourceType: 'MFA',
      action: 'MFA verification successful',
      ipAddress,
      userAgent,
      success: true,
      metadata: { method: isTOTP ? 'totp' : 'backup_code' },
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

    // Determine redirect
    const redirectUrl =
      user.role === 'PHYSICIAN'
        ? '/physician/queue'
        : user.role === 'ADMIN'
          ? '/admin/dashboard'
          : '/patient/dashboard';

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
    console.error('MFA verify error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'MFA verification failed', code: 'MFA_VERIFY_ERROR' },
      { status: 500 }
    );
  }
}
