/**
 * POST /api/patient/mfa/setup-sms
 * Send an SMS verification code to an authenticated patient's phone on file
 * as part of enabling SMS-based MFA for the first time.
 *
 * Unlike /api/auth/mfa/send-sms (which requires a short-lived mfaToken issued
 * during login), this endpoint uses the patient's existing access token cookie
 * so the setup flow works for users who are already logged in.
 *
 * 2026 HIPAA Security Rule mandates MFA for all ePHI access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { getRedisClient } from '@/lib/redis/client';
import { sendSMS } from '@/lib/integrations/sns';
import {
  generateSMSCode,
  storeSMSCode,
  checkSMSRateLimit,
  maskPhoneNumber,
} from '@/lib/auth/sms-mfa';
import { auditLogger } from '@/lib/audit/logger';
import { AuditEventType } from '@/lib/audit/types';
import { Role } from '@prisma/client';

/**
 * GET /api/patient/mfa/setup-sms
 * Returns the masked phone-on-file so the setup page can display
 * "We'll send a code to (•••) •••-1234" before the user clicks Send.
 * Does NOT send an SMS.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) return auth;

  const { userId } = auth.user;

  try {
    const profile = await prisma.patientProfile.findUnique({
      where: { userId },
      select: { phone: true },
    });

    const phone = typeof profile?.phone === 'string' ? profile.phone : '';
    if (!phone) {
      return NextResponse.json(
        { hasPhone: false, code: 'NO_PHONE_NUMBER' },
        { status: 200 },
      );
    }

    return NextResponse.json({
      hasPhone: true,
      phoneHint: maskPhoneNumber(phone),
    });
  } catch (error) {
    console.error(
      'SMS MFA phone hint error:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return NextResponse.json(
      { error: 'Failed to load phone information' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) return auth;

  const { userId, role } = auth.user;
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const userAgent = request.headers.get('user-agent') ?? 'unknown';

  try {
    const profile = await prisma.patientProfile.findUnique({
      where: { userId },
      select: { phone: true },
    });

    const phone = typeof profile?.phone === 'string' ? profile.phone : '';
    if (!phone) {
      return NextResponse.json(
        {
          error: 'No phone number on file. Please add one in your profile settings.',
          code: 'NO_PHONE_NUMBER',
        },
        { status: 400 },
      );
    }

    let redis;
    try {
      redis = getRedisClient();
    } catch {
      console.error('[SMS MFA setup] Redis unavailable, cannot send SMS code');
      return NextResponse.json(
        {
          error: 'Verification service temporarily unavailable. Please try again.',
          code: 'SERVICE_UNAVAILABLE',
        },
        { status: 503 },
      );
    }

    const allowed = await checkSMSRateLimit(redis, phone);
    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Too many verification codes requested. Please wait before trying again.',
          code: 'SMS_RATE_LIMITED',
        },
        { status: 429 },
      );
    }

    const code = generateSMSCode();
    await storeSMSCode(redis, userId, code);

    await sendSMS({
      to: phone,
      body: `Your Rimal Health verification code is: ${code}. It expires in 5 minutes. Do not share this code.`,
    });

    await auditLogger
      .log({
        eventType: AuditEventType.MFA_SETUP,
        userId,
        userRole: role,
        resourceType: 'MFA',
        action: 'SMS MFA setup code sent',
        ipAddress,
        userAgent,
        success: true,
        metadata: { method: 'sms', step: 'send' },
      })
      .catch((err) =>
        console.error(
          '[patient:mfa:setup-sms] audit failed:',
          err instanceof Error ? err.message : 'Unknown error',
        ),
      );

    return NextResponse.json({
      success: true,
      phoneHint: maskPhoneNumber(phone),
    });
  } catch (error) {
    console.error(
      'SMS MFA setup send error:',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return NextResponse.json(
      { error: 'Failed to send verification code', code: 'SMS_SEND_ERROR' },
      { status: 500 },
    );
  }
}
