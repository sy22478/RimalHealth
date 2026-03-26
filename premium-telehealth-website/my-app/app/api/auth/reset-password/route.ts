/**
 * POST /api/auth/reset-password
 * Password reset completion endpoint
 * 
 * HIPAA Compliance:
 * - Validates password strength before accepting
 * - Marks reset token as used to prevent replay attacks
 * - Increments token version to invalidate all existing sessions
 * - Audit logging for password reset completion
 * - Secure token validation with expiry check
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Password utilities
import {
  hashPassword,
  validatePasswordStrength,
  MIN_PASSWORD_LENGTH,
} from '@/lib/auth/password';

// Session management
import { invalidateUserSessions } from '@/lib/auth/session';

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

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(
    MIN_PASSWORD_LENGTH,
    `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

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
 * Find valid password reset record by token
 */
async function findValidPasswordReset(token: string) {
  const resetRecord = await prisma.passwordReset.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  if (!resetRecord) {
    return null;
  }

  // Check if token is expired
  if (new Date() > resetRecord.expiresAt) {
    return null;
  }

  // Check if token has already been used
  if (resetRecord.usedAt !== null) {
    return null;
  }

  return resetRecord;
}

// ============================================
// Route Handler
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limiting: 3 requests per hour per IP (strict - sensitive operation)
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateLimitResult = await rateLimit(clientIp, rateLimitPresets.strict);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter ?? 60) } }
    );
  }

  const auditContext = getAuditContext(request);

  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = resetPasswordSchema.safeParse(body);

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

    const { token, password }: ResetPasswordInput = validationResult.data;

    // Check password strength
    const strengthCheck = validatePasswordStrength(password);
    if (!strengthCheck.isValid) {
      return NextResponse.json(
        {
          error: 'Password does not meet strength requirements',
          code: 'WEAK_PASSWORD',
          requirements: strengthCheck.requirements,
        },
        { status: 400 }
      );
    }

    // Find valid password reset record
    const resetRecord = await findValidPasswordReset(token);

    if (!resetRecord) {
      return NextResponse.json(
        {
          error: 'Invalid or expired reset token',
          code: 'INVALID_TOKEN',
        },
        { status: 400 }
      );
    }

    const userId = resetRecord.userId;

    // Hash the new password
    const passwordHash = await hashPassword(password);

    // Perform all updates in a transaction
    await prisma.$transaction(async (tx) => {
      // Update user password
      // Note: emailVerified is NOT set here — email verification is a separate step
      // handled by the /api/auth/verify-email endpoint
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          // Increment token version to invalidate all existing sessions
          tokenVersion: {
            increment: 1,
          },
        },
      });

      // Mark password reset token as used
      await tx.passwordReset.update({
        where: { id: resetRecord.id },
        data: {
          usedAt: new Date(),
        },
      });

      // Delete all existing sessions for this user (force re-login)
      await tx.session.deleteMany({
        where: { userId },
      });
    });

    // Log audit event
    await auditPasswordEvent(
      AuditEventType.PASSWORD_RESET_COMPLETED,
      userId,
      auditContext
    );

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error instanceof Error ? error.message : 'Unknown error');

    return NextResponse.json(
      {
        error: 'Password reset failed. Please try again later.',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
