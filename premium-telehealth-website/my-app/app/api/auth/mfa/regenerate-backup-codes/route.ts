/**
 * POST /api/auth/mfa/regenerate-backup-codes
 * Regenerate MFA backup codes for the authenticated user.
 *
 * Body: { token: string } — current TOTP code to confirm identity
 *
 * Returns a fresh set of backup codes. Old backup codes are invalidated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import {
  verifyMFATOTP,
  decryptMFASecret,
  generateBackupCodes,
  encryptBackupCodes,
} from '@/lib/auth/mfa';
import { prisma } from '@/lib/db/prisma';
import { auditLogger } from '@/lib/audit/logger';
import { AuditEventType } from '@/lib/audit/types';

const regenerateSchema = z.object({
  token: z
    .string()
    .length(6, 'Token must be 6 digits')
    .regex(/^\d{6}$/, 'Token must be numeric'),
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
    const validation = regenerateSchema.safeParse(body);

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
      await auditLogger
        .log({
          eventType: AuditEventType.MFA_FAILED,
          userId: user.userId,
          userRole: user.role,
          resourceType: 'MFA',
          action: 'Backup code regeneration verification failed',
          ipAddress,
          userAgent,
          success: false,
          errorMessage: 'Invalid TOTP code when regenerating backup codes',
        })
        .catch((err) =>
          console.error(
            '[auth:mfa:regenerate] audit/rate-limit failed:',
            err instanceof Error ? err.message : 'Unknown error'
          )
        );

      return NextResponse.json(
        { error: 'Invalid verification code', code: 'INVALID_MFA_CODE' },
        { status: 401 }
      );
    }

    const backupCodes = generateBackupCodes();
    const encryptedBackupCodes = encryptBackupCodes(backupCodes);

    await prisma.user.update({
      where: { id: user.userId },
      data: { mfaBackupCodes: encryptedBackupCodes },
    });

    await auditLogger
      .log({
        eventType: AuditEventType.MFA_SETUP,
        userId: user.userId,
        userRole: user.role,
        resourceType: 'MFA',
        action: 'Backup codes regenerated',
        ipAddress,
        userAgent,
        success: true,
        metadata: { step: 'regenerate-backup-codes', backupCodesGenerated: backupCodes.length },
      })
      .catch((err) =>
        console.error(
          '[auth:mfa:regenerate] audit/rate-limit failed:',
          err instanceof Error ? err.message : 'Unknown error'
        )
      );

    return NextResponse.json({
      success: true,
      backupCodes,
      message: 'Backup codes regenerated. Save them in a secure location.',
    });
  } catch (error) {
    console.error(
      'MFA regenerate backup codes error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return NextResponse.json(
      { error: 'Failed to regenerate backup codes', code: 'MFA_REGENERATE_ERROR' },
      { status: 500 }
    );
  }
}
