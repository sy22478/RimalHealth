/**
 * POST /api/auth/mfa/verify-setup
 * Complete MFA setup by verifying the first TOTP code.
 *
 * Body: { token: string }
 *
 * The pending MFA secret is read from the database (stored during setup),
 * decrypted, and used to verify the TOTP code. If valid, mfaEnabled is
 * set to true and backup codes are generated and returned (one-time display).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/require-auth';
import {
  verifyMFATOTP,
  generateBackupCodes,
  decryptMFASecret,
  encryptBackupCodes,
} from '@/lib/auth/mfa';
import { prisma } from '@/lib/db/prisma';
import { auditLogger } from '@/lib/audit/logger';
import { AuditEventType } from '@/lib/audit/types';

const verifySetupSchema = z.object({
  token: z.string().length(6, 'Token must be 6 digits').regex(/^\d{6}$/, 'Token must be numeric'),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, ['PHYSICIAN', 'ADMIN']);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { user } = auth;
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
        { status: 400 }
      );
    }

    const { token } = validation.data;

    // Read the pending MFA secret from the database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { mfaSecret: true, mfaEnabled: true },
    });

    if (!dbUser?.mfaSecret) {
      return NextResponse.json(
        { error: 'MFA setup not initiated. Please start setup first.', code: 'MFA_NOT_INITIATED' },
        { status: 400 }
      );
    }

    if (dbUser.mfaEnabled) {
      return NextResponse.json(
        { error: 'MFA is already enabled.', code: 'MFA_ALREADY_ENABLED' },
        { status: 400 }
      );
    }

    const secret = decryptMFASecret(dbUser.mfaSecret);

    // Verify the TOTP code against the stored secret
    const isValid = verifyMFATOTP(secret, token);

    if (!isValid) {
      await auditLogger.log({
        eventType: AuditEventType.MFA_FAILED,
        userId: user.userId,
        userRole: user.role,
        resourceType: 'MFA',
        action: 'MFA setup verification failed',
        ipAddress,
        userAgent,
        success: false,
        errorMessage: 'Invalid TOTP code during setup',
      }).catch(() => {});

      return NextResponse.json(
        { error: 'Invalid verification code', code: 'INVALID_MFA_CODE' },
        { status: 400 }
      );
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();

    // Encrypt backup codes before storage
    const encryptedBackupCodes = encryptBackupCodes(backupCodes);

    // Enable MFA and store backup codes (secret is already persisted from setup)
    await prisma.user.update({
      where: { id: user.userId },
      data: {
        mfaEnabled: true,
        mfaBackupCodes: encryptedBackupCodes,
      },
    });

    // Audit successful setup
    await auditLogger.log({
      eventType: AuditEventType.MFA_SETUP,
      userId: user.userId,
      userRole: user.role,
      resourceType: 'MFA',
      action: 'MFA setup completed',
      ipAddress,
      userAgent,
      success: true,
      metadata: { step: 'complete', backupCodesGenerated: backupCodes.length },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      backupCodes,
      message:
        'MFA enabled successfully. Save your backup codes in a secure location.',
    });
  } catch (error) {
    console.error('MFA verify-setup error:', error);
    return NextResponse.json(
      { error: 'Failed to complete MFA setup', code: 'MFA_SETUP_ERROR' },
      { status: 500 }
    );
  }
}
