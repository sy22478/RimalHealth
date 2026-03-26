/**
 * POST /api/auth/mfa/setup
 * Initiate MFA setup for any authenticated user (patient, physician, or admin).
 *
 * Generates a TOTP secret, encrypts it, and stores it on the user record
 * (with mfaEnabled still false). Only the otpauth URI is returned to the
 * client — the plaintext secret never leaves the server.
 *
 * 2026 HIPAA Security Rule mandates MFA for all ePHI access, including patients.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { generateMFASecret, encryptMFASecret } from '@/lib/auth/mfa';
import { prisma } from '@/lib/db/prisma';
import { auditLogger } from '@/lib/audit/logger';
import { AuditEventType } from '@/lib/audit/types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Require any authenticated role (PATIENT, PHYSICIAN, or ADMIN)
  const auth = await requireRole(request, ['PATIENT', 'PHYSICIAN', 'ADMIN']);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { user } = auth;

  try {
    const { secret, otpauthUri } = generateMFASecret(user.email);

    // Encrypt the secret and persist it server-side (mfaEnabled stays false)
    const encryptedSecret = encryptMFASecret(secret);
    await prisma.user.update({
      where: { id: user.userId },
      data: { mfaSecret: encryptedSecret },
    });

    // Audit the setup initiation
    await auditLogger.log({
      eventType: AuditEventType.MFA_SETUP,
      userId: user.userId,
      userRole: user.role,
      resourceType: 'MFA',
      action: 'MFA setup initiated',
      ipAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        'unknown',
      userAgent: request.headers.get('user-agent') ?? 'unknown',
      success: true,
      metadata: { step: 'initiate' },
    }).catch(() => {});

    // Only return the otpauth URI — never expose the secret to the client
    return NextResponse.json({
      otpauthUri,
    });
  } catch (error) {
    console.error('MFA setup error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to initiate MFA setup', code: 'MFA_SETUP_ERROR' },
      { status: 500 }
    );
  }
}
