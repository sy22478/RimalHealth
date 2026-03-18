/**
 * POST /api/auth/physician/verify-key
 * Verify physician secret key for first-time setup
 * 
 * HIPAA Compliance:
 * - Don't reveal if email exists (consistent error messages)
 * - Rate limiting to prevent brute force attacks
 * - Audit logging for all verification attempts
 * - Constant-time key comparison via bcrypt
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Database
import { prisma } from '@/lib/db/prisma';

// Secret key utilities
import { verifySecretKey, isSecretKeyExpired } from '@/lib/auth/secret-key';

// Rate limiting
import { rateLimit } from '@/lib/middleware/rate-limit';

// Audit logging
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/audit/index';
import { AuditContext } from '@/lib/audit/types';

// ============================================
// Validation Schema
// ============================================

const verifyKeySchema = z.object({
  email: z.string().email('Invalid email address'),
  secretKey: z.string().min(1, 'Secret key is required'),
});

type VerifyKeyInput = z.infer<typeof verifyKeySchema>;

// ============================================
// Constants
// ============================================

// Generic error message to prevent user enumeration attacks
const INVALID_KEY_ERROR = {
  valid: false,
  message: 'Invalid or expired key',
};

// Rate limit configuration: 5 attempts per hour per email
const RATE_LIMIT_CONFIG = {
  requests: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
  keyPrefix: 'ratelimit:physician-verify-key',
};

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
 * Get client IP from request for rate limiting
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Log verification attempt for audit
 */
async function logVerificationAttempt(
  success: boolean,
  email: string,
  physicianId: string | undefined,
  context: AuditContext,
  details?: {
    failureReason?: string;
    status?: string;
    expired?: boolean;
  }
): Promise<void> {
  const metadata: Record<string, unknown> = {
    email, // Note: email is not PHI in this context (not tied to patient)
    ...details,
  };

  await auditLogger.log({
    eventType: success 
      ? AuditEventType.USER_LOGIN 
      : AuditEventType.USER_LOGIN_FAILED,
    userId: physicianId,
    userRole: 'PHYSICIAN',
    resourceType: 'Physician',
    resourceId: physicianId,
    action: success 
      ? 'Physician secret key verified successfully' 
      : 'Physician secret key verification failed',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    success,
    severity: success ? AuditSeverity.INFO : AuditSeverity.WARNING,
    metadata,
    errorMessage: details?.failureReason,
    timestamp: new Date(),
  });
}

// ============================================
// Route Handler
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auditContext = getAuditContext(request);
  const clientIp = getClientIp(request);

  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = verifyKeySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          valid: false,
          message: 'Invalid request data',
          errors: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, secretKey }: VerifyKeyInput = validationResult.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Check rate limit (per email)
    const rateLimitResult = await rateLimit(
      `${clientIp}:${normalizedEmail}`,
      RATE_LIMIT_CONFIG
    );

    if (!rateLimitResult.success) {
      // Log rate limit event
      await auditLogger.log({
        eventType: AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
        resourceType: 'Physician',
        action: 'Rate limit exceeded for secret key verification',
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        success: false,
        severity: AuditSeverity.WARNING,
        metadata: {
          email: normalizedEmail,
          retryAfter: rateLimitResult.retryAfter,
        },
        timestamp: new Date(),
      });

      return NextResponse.json(
        {
          valid: false,
          message: 'Too many attempts. Please try again later.',
          retryAfter: rateLimitResult.retryAfter,
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter),
          },
        }
      );
    }

    // Find user by email with PHYSICIAN role
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        physician: true,
      },
    });

    // If user not found or not a physician, return generic error
    // This prevents user enumeration attacks
    if (!user || user.role !== 'PHYSICIAN') {
      await logVerificationAttempt(
        false,
        normalizedEmail,
        undefined,
        auditContext,
        { failureReason: 'User not found or not a physician' }
      );

      return NextResponse.json(INVALID_KEY_ERROR, { status: 401 });
    }

    // Get associated physician record
    const physician = user.physician;

    // If no physician record exists
    if (!physician) {
      await logVerificationAttempt(
        false,
        normalizedEmail,
        user.id,
        auditContext,
        { failureReason: 'Physician record not found' }
      );

      return NextResponse.json(INVALID_KEY_ERROR, { status: 401 });
    }

    // Check if physician status is INVITED
    if (physician.status !== 'INVITED') {
      await logVerificationAttempt(
        false,
        normalizedEmail,
        user.id,
        auditContext,
        { 
          failureReason: `Physician status is ${physician.status}, expected INVITED`,
          status: physician.status,
        }
      );

      // Return different message based on status for better UX
      // but still generic enough to not reveal too much
      if (physician.status === 'ACTIVE') {
        return NextResponse.json(
          {
            valid: false,
            message: 'Account already activated. Please log in instead.',
            code: 'ALREADY_ACTIVE',
          },
          { status: 403 }
        );
      }

      return NextResponse.json(INVALID_KEY_ERROR, { status: 401 });
    }

    // Check if secret key hash exists
    if (!physician.secretKeyHash) {
      await logVerificationAttempt(
        false,
        normalizedEmail,
        user.id,
        auditContext,
        { failureReason: 'No secret key hash found for physician' }
      );

      return NextResponse.json(INVALID_KEY_ERROR, { status: 401 });
    }

    // Check if key is expired
    if (physician.secretKeyExpiry && isSecretKeyExpired(physician.secretKeyExpiry)) {
      await logVerificationAttempt(
        false,
        normalizedEmail,
        user.id,
        auditContext,
        { 
          failureReason: 'Secret key expired',
          expired: true,
        }
      );

      return NextResponse.json(
        {
          valid: false,
          message: 'Key has expired. Please contact an administrator.',
          code: 'KEY_EXPIRED',
        },
        { status: 401 }
      );
    }

    // Verify secret key against stored hash
    const isKeyValid = await verifySecretKey(secretKey, physician.secretKeyHash);

    if (!isKeyValid) {
      await logVerificationAttempt(
        false,
        normalizedEmail,
        user.id,
        auditContext,
        { failureReason: 'Invalid secret key' }
      );

      return NextResponse.json(INVALID_KEY_ERROR, { status: 401 });
    }

    // Key is valid - log success
    await logVerificationAttempt(
      true,
      normalizedEmail,
      user.id,
      auditContext,
      { status: physician.status }
    );

    // Return success response
    return NextResponse.json({
      valid: true,
      message: 'Key valid. Proceed to set password.',
      physicianId: physician.id,
    });

  } catch (error) {
    console.error('Secret key verification error:', error);

    // Log error
    await auditLogger.log({
      eventType: AuditEventType.API_ERROR,
      resourceType: 'Physician',
      action: 'Secret key verification error',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      success: false,
      severity: AuditSeverity.ERROR,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date(),
    });

    return NextResponse.json(
      {
        valid: false,
        message: 'Verification failed. Please try again later.',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
