/**
 * POST /api/auth/mfa/disable
 * Disable MFA for the authenticated user.
 *
 * Body: { token: string } — current TOTP code to confirm identity
 *
 * Requires auth. Verifies the TOTP code, then clears MFA fields.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { verifyMFATOTP, decryptMFASecret } from '@/lib/auth/mfa';
import { prisma } from '@/lib/db/prisma';
import { auditLogger } from '@/lib/audit/logger';
import { AuditEventType } from '@/lib/audit/types';

const disableSchema = z.object({
  token: z.string().length(6, 'Token must be 6 digits').regex(/^\d{6}$/, 'Token must be numeric'),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { user } = auth;
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const userAgent = request.headers.get('user-agent') ?? 'unknown';

  try {
    const body = await request.json();
    const validation = disableSchema.safeParse(body);

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

    const { token } = validation.data;

    // Fetch MFA secret
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { mfaEnabled: true, mfaSecret: true },
    });

    if (!dbUser?.mfaEnabled || !dbUser.mfaSecret) {
      return NextResponse.json(
        { error: 'MFA is not enabled', code: 'MFA_NOT_ENABLED' },
        { status: 400 }
      );
    }

    const secret = decryptMFASecret(dbUser.mfaSecret);
    const isValid = verifyMFATOTP(secret, token);

    if (!isValid) {
      await auditLogger.log({
        eventType: AuditEventType.MFA_FAILED,
        userId: user.userId,
        userRole: user.role,
        resourceType: 'MFA',
        action: 'MFA disable verification failed',
        ipAddress,
        userAgent,
        success: false,
        errorMessage: 'Invalid TOTP code when disabling MFA',
      }).catch(() => {});

      return NextResponse.json(
        { error: 'Invalid verification code', code: 'INVALID_MFA_CODE' },
        { status: 401 }
      );
    }

    // Disable MFA
    await prisma.user.update({
      where: { id: user.userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodes: null,
      },
    });

    await auditLogger.log({
      eventType: AuditEventType.MFA_DISABLED,
      userId: user.userId,
      userRole: user.role,
      resourceType: 'MFA',
      action: 'MFA disabled',
      ipAddress,
      userAgent,
      success: true,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'MFA has been disabled.',
    });
  } catch (error) {
    console.error('MFA disable error:', error);
    return NextResponse.json(
      { error: 'Failed to disable MFA', code: 'MFA_DISABLE_ERROR' },
      { status: 500 }
    );
  }
}
