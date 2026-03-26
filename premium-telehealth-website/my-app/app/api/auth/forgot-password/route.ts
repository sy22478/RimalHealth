/**
 * POST /api/auth/forgot-password
 * Password reset request endpoint
 * 
 * HIPAA Compliance:
 * - Don't reveal if email exists (always return success)
 * - Generates cryptographically secure random token
 * - Token expires after 1 hour
 * - Audit logging for password reset requests
 * - In production, email would be queued via notification service
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'crypto';

// Database
import { prisma } from '@/lib/db/prisma';

// Audit
import { auditPasswordEvent } from '@/lib/audit/logger';
import { AuditContext, AuditEventType } from '@/lib/audit/types';

// Rate limiting
import { rateLimit, rateLimitPresets } from '@/lib/middleware/rate-limit';

// ============================================
// Validation Schema
// ============================================

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ============================================
// Helper Functions
// ============================================

/**
 * Extract audit context from request
 */
function getAuditContext(request: NextRequest): AuditContext {
  const forwarded = request.headers.get('x-forwarded-for');
  return {
    ipAddress: forwarded?.split(',')[0]?.trim() ?? 'unknown',
    userAgent: request.headers.get('user-agent') ?? 'unknown',
    requestId: crypto.randomUUID(),
  };
}

/**
 * Generate a secure random token
 */
function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Send password reset email
 */
async function queuePasswordResetEmail(
  email: string,
  token: string
): Promise<void> {
  const { sendEmail } = await import('@/lib/integrations/sendgrid');
  const { EmailTemplate } = await import('@/lib/notifications/templates');

  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/set-password?token=${token}`;

  await sendEmail({
    to: email,
    template: EmailTemplate.PASSWORD_RESET,
    data: {
      resetUrl,
      expiresIn: '1 hour',
    },
  });
}

// ============================================
// Route Handler
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limiting: 3 requests per hour per IP (strict - sensitive operation)
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateLimitResult = await rateLimit(clientIp, rateLimitPresets.strict);
  if (!rateLimitResult.success) {
    // Still return generic success to prevent enumeration via timing
    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  }

  const auditContext = getAuditContext(request);

  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = forgotPasswordSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email }: ForgotPasswordInput = validationResult.data;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true },
    });

    // IMPORTANT: Always return success, even if email doesn't exist
    // This prevents user enumeration attacks
    if (!user) {
      // Do not log the email — prevents PHI leakage
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }

    // Generate secure random token
    const token = generateSecureToken();

    // Set expiry to 1 hour from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Delete any existing unused password reset tokens for this user
    await prisma.passwordReset.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
    });

    // Create password reset record
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Queue password reset email
    await queuePasswordResetEmail(user.email, token);

    // Log audit event
    await auditPasswordEvent(
      AuditEventType.PASSWORD_RESET_REQUESTED,
      user.id,
      auditContext
    );

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error instanceof Error ? error.message : 'Unknown error');

    // Even on error, return generic success to prevent information leakage
    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  }
}
