/**
 * POST /api/auth/mfa/send-sms
 * Send SMS verification code to patient's phone number.
 *
 * Called after password verification during login (using mfaToken),
 * or authenticated patients requesting a resend.
 *
 * Body: { mfaToken: string }
 *
 * The mfaToken is a short-lived JWT (5 min, type: 'mfa') issued
 * by the login endpoint when the patient has SMS MFA.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { jwtVerify } from 'jose';
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

const sendSmsSchema = z.object({
  mfaToken: z.string().min(1, { message: 'MFA token is required' }),
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
    const validation = sendSmsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    const { mfaToken } = validation.data;

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

    // Look up patient's phone number
    const profile = await prisma.patientProfile.findUnique({
      where: { userId: mfaPayload.userId },
      select: { phone: true },
    });

    const phone = typeof profile?.phone === 'string' ? profile.phone : '';
    if (!phone) {
      // No phone on file — cannot send SMS MFA
      return NextResponse.json(
        { error: 'No phone number on file. Please add one in your profile settings.', code: 'NO_PHONE_NUMBER' },
        { status: 400 },
      );
    }

    // Check rate limit
    let redis;
    try {
      redis = getRedisClient();
    } catch {
      // Redis unavailable — fail open for availability, log security event
      console.error('[SMS MFA] Redis unavailable, cannot send SMS code');
      await auditLogger.log({
        eventType: AuditEventType.MFA_FAILED,
        userId: mfaPayload.userId,
        userRole: mfaPayload.role,
        resourceType: 'MFA',
        action: 'SMS MFA send failed — Redis unavailable',
        ipAddress,
        userAgent,
        success: false,
        errorMessage: 'Redis unavailable',
      }).catch((err) => console.error('[auth:mfa:send-sms] audit/rate-limit failed:', err instanceof Error ? err.message : 'Unknown error'));

      return NextResponse.json(
        { error: 'Verification service temporarily unavailable. Please try again.', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 },
      );
    }

    const allowed = await checkSMSRateLimit(redis, phone);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many verification codes requested. Please wait before trying again.', code: 'SMS_RATE_LIMITED' },
        { status: 429 },
      );
    }

    // Generate and store code
    const code = generateSMSCode();
    await storeSMSCode(redis, mfaPayload.userId, code);

    // Send SMS via Twilio
    await sendSMS({
      to: phone,
      body: `Your Rimal Health verification code is: ${code}. It expires in 5 minutes. Do not share this code.`,
    });

    // Audit
    await auditLogger.log({
      eventType: AuditEventType.MFA_SETUP,
      userId: mfaPayload.userId,
      userRole: mfaPayload.role,
      resourceType: 'MFA',
      action: 'SMS verification code sent',
      ipAddress,
      userAgent,
      success: true,
      metadata: { method: 'sms' },
    }).catch((err) => console.error('[auth:mfa:send-sms] audit/rate-limit failed:', err instanceof Error ? err.message : 'Unknown error'));

    return NextResponse.json({
      success: true,
      phoneHint: maskPhoneNumber(phone),
    });
  } catch (error) {
    console.error('SMS MFA send error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to send verification code', code: 'SMS_SEND_ERROR' },
      { status: 500 },
    );
  }
}
