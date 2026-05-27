/**
 * POST /api/auth/send-verification
 * Generates an email verification token and sends a verification email.
 *
 * Per Team H Amendment 2: reuses the PasswordReset model for verification tokens,
 * using a "verify-" prefix convention to distinguish from password reset tokens.
 *
 * HIPAA Compliance:
 * - No PHI in logs or error messages
 * - Rate limited to prevent abuse
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { hashToken } from '@/lib/auth/token-utils';
import { sendEmail } from '@/lib/integrations/sendgrid';
import { EmailTemplate } from '@/lib/notifications/templates';
import { rateLimit, rateLimitPresets } from '@/lib/middleware/rate-limit';
import { auditPasswordEvent } from '@/lib/audit/logger';
import { AuditContext, AuditEventType } from '@/lib/audit/types';

export const dynamic = 'force-dynamic';

const sendVerificationSchema = z.object({
  email: z.string().email('Valid email is required'),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limiting: auth preset — 5 requests per 15 minutes per IP
  // (strict was too aggressive at 3/hour — users hit it during normal create-account flow)
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateLimitResult = await rateLimit(clientIp, rateLimitPresets.auth);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter ?? 60) } }
    );
  }

  const auditContext: AuditContext = {
    ipAddress: clientIp,
    userAgent: request.headers.get('user-agent') ?? 'unknown',
    requestId: crypto.randomUUID(),
  };

  try {
    const body = await request.json();
    const validationResult = sendVerificationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Valid email is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { email } = validationResult.data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, emailVerified: true },
    });

    // Don't reveal whether the email exists — always return success
    if (!user) {
      return NextResponse.json({ success: true, message: 'If an account exists, a verification email has been sent.' });
    }

    // If already verified, no need to send again
    if (user.emailVerified) {
      return NextResponse.json({ success: true, message: 'If an account exists, a verification email has been sent.' });
    }

    // Generate verification token using PasswordReset model
    // Use "verify-" prefix to distinguish from password reset tokens (Team H Amendment 2)
    const token = `verify-${crypto.randomUUID()}`;

    // Store the hash, not the raw token, so a DB read cannot yield a usable
    // verification token. The raw token is sent in the email link below.
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: hashToken(token),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`;

    await sendEmail({
      to: email.toLowerCase(),
      template: EmailTemplate.EMAIL_VERIFICATION,
      data: {
        firstName: 'there',
        verificationUrl,
      },
    });

    // Audit log — verification email sent
    await auditPasswordEvent(
      AuditEventType.PASSWORD_RESET_REQUESTED,
      user.id,
      auditContext,
      true
    ).catch((err) => console.error('[auth:send-verification] audit/rate-limit failed:', err instanceof Error ? err.message : 'Unknown error'));

    return NextResponse.json({
      success: true,
      message: 'If an account exists, a verification email has been sent.',
    });
  } catch (error) {
    console.error('[send-verification] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to send verification email. Please try again.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
