/**
 * POST /api/patient/mfa/verify-sms-setup
 * Verify the SMS code sent during MFA setup and enable MFA on the patient's
 * account. Unlike /api/auth/mfa/verify-sms (login flow), this uses the
 * patient's existing access token cookie rather than a short-lived mfaToken.
 *
 * Body: { token: string } — 6-digit SMS code
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/require-auth';
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
import { Role } from '@prisma/client';

const verifySetupSchema = z.object({
  token: z
    .string()
    .length(6, { message: 'Code must be 6 digits' })
    .regex(/^\d{6}$/, { message: 'Code must be numeric' }),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) return auth;

  const { userId, role } = auth.user;
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const userAgent = request.headers.get('user-agent') ?? 'unknown';

  try {
    const body = await request.json();
    const validation = verifySetupSchema.safeParse(body);

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

    const { token } = validation.data;

    let redis;
    try {
      redis = getRedisClient();
    } catch {
      console.error('[SMS MFA setup verify] Redis unavailable');
      return NextResponse.json(
        {
          error: 'Verification service temporarily unavailable. Please try again.',
          code: 'SERVICE_UNAVAILABLE',
        },
        { status: 503 },
      );
    }

    const locked = await isSMSVerificationLocked(redis, userId);
    if (locked) {
      return NextResponse.json(
        {
          error: 'Too many failed attempts. Try again in 15 minutes.',
          code: 'MFA_RATE_LIMITED',
        },
        { status: 429 },
      );
    }

    const verified = await verifySMSCode(redis, userId, token);

    if (!verified) {
      const attempts = await recordSMSFailedAttempt(redis, userId);

      await auditLogger
        .log({
          eventType: AuditEventType.MFA_FAILED,
          userId,
          userRole: role,
          resourceType: 'MFA',
          action: 'SMS MFA setup verification failed',
          ipAddress,
          userAgent,
          success: false,
          errorMessage: 'Invalid SMS code during setup',
          metadata: { method: 'sms', attempts, step: 'verify-setup' },
        })
        .catch((err) =>
          console.error(
            '[patient:mfa:verify-sms-setup] audit failed:',
            err instanceof Error ? err.message : 'Unknown error',
          ),
        );

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

    await clearSMSFailedAttempts(redis, userId);

    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    await auditLogger
      .log({
        eventType: AuditEventType.MFA_SETUP,
        userId,
        userRole: role,
        resourceType: 'MFA',
        action: 'SMS MFA setup completed',
        ipAddress,
        userAgent,
        success: true,
        metadata: { method: 'sms', step: 'complete' },
      })
      .catch((err) =>
        console.error(
          '[patient:mfa:verify-sms-setup] audit failed:',
          err instanceof Error ? err.message : 'Unknown error',
        ),
      );

    return NextResponse.json({
      success: true,
      message: 'SMS verification enabled.',
    });
  } catch (error) {
    console.error(
      'SMS MFA setup verify error:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return NextResponse.json(
      { error: 'Failed to complete MFA setup', code: 'MFA_SETUP_ERROR' },
      { status: 500 },
    );
  }
}
