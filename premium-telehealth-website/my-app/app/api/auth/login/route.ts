/**
 * POST /api/auth/login
 * User login endpoint
 * 
 * HIPAA Compliance:
 * - Constant-time password comparison to prevent timing attacks
 * - Don't reveal if email exists (same error for invalid email/password)
 * - Audit logging for both successful and failed attempts
 * - Updates lastLoginAt timestamp
 * - Account lockout after 5 failed attempts
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { SignJWT } from 'jose';

// JWT utilities
import {
  generateTokenPair,
  ACCESS_TOKEN_EXPIRY_SECONDS,
} from '@/lib/auth/jwt';

// SMS MFA for patients
import { generateSMSCode, storeSMSCode, checkSMSRateLimit, maskPhoneNumber } from '@/lib/auth/sms-mfa';
import { getRedisClient } from '@/lib/redis/client';
// TEMPORARY: Using Twilio until AWS SNS toll-free number is provisioned
// and SES production access is approved. Switch back to sns.ts/ses.ts when ready.
// Tracking: AWS_MIGRATION_STATUS.md
import { sendSMS } from '@/lib/integrations/twilio';

// Password utilities
import { verifyPassword } from '@/lib/auth/password';

// Secret key utilities
import { verifySecretKey } from '@/lib/auth/secret-key';

// Account lockout
import {
  checkAuthenticationAllowed,
  recordFailedAttempt,
  clearFailedAttempts,
  checkIpRateLimit,
  recordIpAttempt,
} from '@/lib/auth/account-lockout';

// Database
import { prisma } from '@/lib/db/prisma';

// Audit
import { auditLogin } from '@/lib/audit/logger';
import { AuditContext, AuthenticationMetadata } from '@/lib/audit/types';

// ============================================
// Validation Schema
// ============================================

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  secretKey: z.string().optional(), // For physician first login
});

type LoginInput = z.infer<typeof loginSchema>;

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
 * Create a new session in the database
 */
async function createSession(
  userId: string,
  accessToken: string,
  refreshToken: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

  await prisma.session.create({
    data: {
      userId,
      token: accessToken,
      refreshToken,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });
}

// Generic error message to prevent user enumeration attacks
const INVALID_CREDENTIALS_ERROR = {
  error: 'Invalid email or password',
  code: 'INVALID_CREDENTIALS',
};

/**
 * Get client IP from request
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') ?? 'unknown';
}

// ============================================
// Route Handler
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auditContext = getAuditContext(request);
  const clientIp = getClientIp(request);

  // Check IP-based rate limiting (additional protection)
  // Fail-closed: if Redis is unavailable, deny the request
  try {
    const ipLimit = await checkIpRateLimit(clientIp, 30, 60);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          code: 'RATE_LIMITED',
          retryAfter: Math.ceil((ipLimit.resetTime.getTime() - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }
  } catch {
    // Redis unavailable — deny request to prevent brute-force bypass
    return NextResponse.json(
      { error: 'Service temporarily unavailable. Please try again.', code: 'SERVICE_UNAVAILABLE' },
      { status: 503 }
    );
  }

  try {
    // Parse and validate request body
    const body = await request.json();
    const validationResult = loginSchema.safeParse(body);

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

    const { email, password }: LoginInput = validationResult.data;

    // Check account lockout status (fail-closed: deny if Redis unavailable)
    try {
      const lockoutCheck = await checkAuthenticationAllowed(email.toLowerCase());
      if (!lockoutCheck.allowed) {
        const authMetadata: AuthenticationMetadata = {
          authMethod: 'password',
          failureReason: 'Account locked',
        };

        await auditLogin(undefined, false, auditContext, authMetadata);

        return NextResponse.json(
          {
            error: lockoutCheck.error,
            code: lockoutCheck.code,
            locked: true,
            remainingSeconds: lockoutCheck.status.remainingSeconds,
          },
          { status: 403 }
        );
      }
    } catch {
      // Redis unavailable — deny request to prevent brute-force bypass
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.', code: 'SERVICE_UNAVAILABLE' },
        { status: 503 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // If user not found, record failed attempt and return generic error
    if (!user) {
      // Fail-safe: Redis may be unavailable
      await recordFailedAttempt(email.toLowerCase()).catch((err) => console.error('[auth:login] audit/rate-limit failed:', err instanceof Error ? err.message : 'Unknown error'));
      await recordIpAttempt(clientIp).catch((err) => console.error('[auth:login] audit/rate-limit failed:', err instanceof Error ? err.message : 'Unknown error'));

      const authMetadata: AuthenticationMetadata = {
        authMethod: 'password',
        failureReason: 'User not found',
      };

      await auditLogin(undefined, false, auditContext, authMetadata).catch((err) => console.error('[auth:login] audit/rate-limit failed:', err instanceof Error ? err.message : 'Unknown error'));

      return NextResponse.json(INVALID_CREDENTIALS_ERROR, { status: 401 });
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      // Record failed attempt (fail-safe)
      let lockoutStatus = { attempts: 0 };
      try {
        lockoutStatus = await recordFailedAttempt(email.toLowerCase());
        await recordIpAttempt(clientIp);
      } catch {
        // Redis unavailable — proceed with generic error
      }

      const authMetadata: AuthenticationMetadata = {
        authMethod: 'password',
        failureReason: 'Invalid password',
        metadata: {
          attemptsRemaining: Math.max(0, 5 - lockoutStatus.attempts),
        },
      };

      await auditLogin(user.id, false, auditContext, authMetadata).catch((err) => console.error('[auth:login] audit/rate-limit failed:', err instanceof Error ? err.message : 'Unknown error'));

      // Return error with lockout warning if approaching limit
      if (lockoutStatus.attempts >= 3) {
        return NextResponse.json(
          {
            error: 'Invalid email or password',
            code: 'INVALID_CREDENTIALS',
            warning: `You have ${5 - lockoutStatus.attempts} attempts remaining before your account is locked for 15 minutes.`,
            attemptsRemaining: 5 - lockoutStatus.attempts,
          },
          { status: 401 }
        );
      }

      return NextResponse.json(INVALID_CREDENTIALS_ERROR, { status: 401 });
    }

    // Clear failed attempts on successful login (fail-safe)
    await clearFailedAttempts(email.toLowerCase()).catch((err) => console.error('[auth:login] audit/rate-limit failed:', err instanceof Error ? err.message : 'Unknown error'));

    // Handle physician-specific authorization checks
    if (user.role === 'PHYSICIAN') {
      const physician = await prisma.physician.findUnique({
        where: { userId: user.id },
        select: {
          id: true,
          status: true,
          secretKeyHash: true,
          secretKeyExpiry: true,
        },
      });

      if (!physician) {
        const authMetadata: AuthenticationMetadata = {
          authMethod: 'password',
          failureReason: 'Physician profile not found',
        };
        await auditLogin(user.id, false, auditContext, authMetadata);
        return NextResponse.json(
          {
            error: 'Account configuration error. Please contact support.',
            code: 'PHYSICIAN_PROFILE_MISSING',
          },
          { status: 403 }
        );
      }

      // Check physician status
      if (physician.status === 'PENDING') {
        const authMetadata: AuthenticationMetadata = {
          authMethod: 'password',
          failureReason: 'Account pending admin authorization',
        };
        await auditLogin(user.id, false, auditContext, authMetadata);
        return NextResponse.json(
          {
            error: 'Account pending admin authorization',
            code: 'PHYSICIAN_PENDING',
          },
          { status: 403 }
        );
      }

      if (physician.status === 'INACTIVE') {
        const authMetadata: AuthenticationMetadata = {
          authMethod: 'password',
          failureReason: 'Account suspended',
        };
        await auditLogin(user.id, false, auditContext, authMetadata);
        return NextResponse.json(
          {
            error: 'Account suspended. Contact admin.',
            code: 'PHYSICIAN_INACTIVE',
          },
          { status: 403 }
        );
      }

      // Handle INVITED status - requires secret key
      if (physician.status === 'INVITED') {
        const { secretKey } = validationResult.data;

        if (!secretKey) {
          const authMetadata: AuthenticationMetadata = {
            authMethod: 'password',
            failureReason: 'Secret key required for first login',
          };
          await auditLogin(user.id, false, auditContext, authMetadata);
          return NextResponse.json(
            {
              error: 'Secret key required for first login',
              code: 'SECRET_KEY_REQUIRED',
              requiresSecretKey: true,
            },
            { status: 401 }
          );
        }

        // Verify secret key
        const isValidSecretKey = await verifySecretKey(
          secretKey,
          physician.secretKeyHash ?? ''
        );

        if (!isValidSecretKey) {
          const authMetadata: AuthenticationMetadata = {
            authMethod: 'password',
            failureReason: 'Invalid secret key',
          };
          await auditLogin(user.id, false, auditContext, authMetadata);
          return NextResponse.json(
            {
              error: 'Invalid secret key',
              code: 'INVALID_SECRET_KEY',
            },
            { status: 401 }
          );
        }

        // Secret key is valid - activate physician account
        await prisma.physician.update({
          where: { id: physician.id },
          data: {
            status: 'ACTIVE',
            secretKeyUsedAt: new Date(),
            secretKeyHash: null,
            secretKeyExpiry: null,
            authorizedAt: new Date(),
          },
        });

        // Log the authorization event
        await prisma.physicianAuthorizationLog.create({
          data: {
            physicianId: physician.id,
            adminId: user.id, // Self-authorized via secret key
            action: 'AUTHORIZED',
            reason: 'First login with secret key',
            ipAddress: auditContext.ipAddress,
            userAgent: auditContext.userAgent,
          },
        });
      }
    }

    // Check if email is verified — always enforced for PATIENT role.
    // Physicians/Admins skip this check (they are created by admin, not via payment flow).
    if (!user.emailVerified && user.role === 'PATIENT') {
      const authMetadata: AuthenticationMetadata = {
        authMethod: 'password',
        failureReason: 'Email not verified',
      };

      await auditLogin(user.id, false, auditContext, authMetadata);

      // Auto-send verification email so the user doesn't have to manually request it.
      // Best-effort — don't block the response if this fails.
      try {
        const { sendEmail } = await import('@/lib/integrations/sendgrid');
        const { EmailTemplate } = await import('@/lib/notifications/templates');

        // Generate a verification token
        const verifyToken = `verify-${crypto.randomUUID()}`;
        await prisma.passwordReset.create({
          data: {
            userId: user.id,
            token: verifyToken,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          },
        });

        const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify-email?token=${verifyToken}`;

        await sendEmail({
          to: user.email,
          template: EmailTemplate.EMAIL_VERIFICATION,
          data: {
            firstName: 'there',
            verificationUrl,
          },
        });
      } catch (emailError) {
        // Non-fatal: don't block login response if verification email fails
        console.error('Failed to auto-send verification email:', emailError instanceof Error ? emailError.message : 'Unknown error');
      }

      return NextResponse.json(
        {
          error: 'Email not verified. A verification email has been sent — please check your inbox.',
          code: 'EMAIL_NOT_VERIFIED',
        },
        { status: 403 }
      );
    }

    // Check if MFA is enabled — if so, return a short-lived MFA token
    // instead of real access/refresh tokens.
    // PATIENT role: SMS-based MFA (send code to phone)
    // PHYSICIAN/ADMIN role: TOTP-based MFA (authenticator app)
    if (user.mfaEnabled) {
      const mfaSecret = process.env.JWT_SECRET;
      if (!mfaSecret) {
        throw new Error('JWT_SECRET environment variable is required');
      }

      const mfaToken = await new SignJWT({
        userId: user.id,
        email: user.email,
        role: user.role,
        type: 'mfa',
      })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime('5m')
        .setSubject(user.id)
        .setAudience('telehealth-api')
        .setIssuer('telehealth-platform')
        .sign(new TextEncoder().encode(mfaSecret));

      const authMetadataMfa: AuthenticationMetadata = {
        authMethod: 'password',
        mfaVerified: false,
      };

      await auditLogin(user.id, true, auditContext, authMetadataMfa).catch((err) => console.error('[auth:login] audit/rate-limit failed:', err instanceof Error ? err.message : 'Unknown error'));

      // For patients, automatically send SMS code
      if (user.role === 'PATIENT') {
        let phoneHint = '';
        try {
          const profile = await prisma.patientProfile.findUnique({
            where: { userId: user.id },
            select: { phone: true },
          });
          const phone = typeof profile?.phone === 'string' ? profile.phone : '';

          if (phone) {
            const redis = getRedisClient();
            const allowed = await checkSMSRateLimit(redis, phone);
            if (allowed) {
              const code = generateSMSCode();
              await storeSMSCode(redis, user.id, code);
              await sendSMS({
                to: phone,
                body: `Your Rimal Health verification code is: ${code}. It expires in 5 minutes. Do not share this code.`,
              });
            }
            phoneHint = maskPhoneNumber(phone);
          }
        } catch (smsError) {
          // Log but don't fail login — user can request resend
          console.error('[SMS MFA] Failed to send code during login:', smsError instanceof Error ? smsError.message : 'Unknown error');
        }

        return NextResponse.json({
          requiresMFA: true,
          mfaType: 'sms',
          mfaToken,
          phoneHint,
        });
      }

      // Physicians/admins: TOTP
      return NextResponse.json({
        requiresMFA: true,
        mfaType: 'totp',
        mfaToken,
      });
    }

    // MFA is only triggered when user.mfaEnabled === true (checked above).
    // Patients who have a phone number but haven't enabled MFA skip 2FA.

    // Generate token pair
    const { accessToken, refreshToken } = await generateTokenPair(
      user.id,
      user.email,
      user.role,
      user.tokenVersion
    );

    // Create session (best-effort — don't fail login if session record fails)
    await createSession(
      user.id,
      accessToken,
      refreshToken,
      auditContext.ipAddress,
      auditContext.userAgent
    ).catch((err) => console.error('Session creation failed (non-fatal):', err instanceof Error ? err.message : 'Unknown error'));

    // Update lastLoginAt timestamp (best-effort)
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch((err) => console.error('lastLoginAt update failed:', err instanceof Error ? err.message : 'Unknown error'));

    // Log successful login audit event (best-effort)
    const authMetadata: AuthenticationMetadata = {
      authMethod: 'password',
    };

    await auditLogin(user.id, true, auditContext, authMetadata).catch((err) => console.error('[auth:login] audit/rate-limit failed:', err instanceof Error ? err.message : 'Unknown error'));

    // Determine redirect URL based on user role
    const redirectUrl = user.role === 'PHYSICIAN' ? '/physician/queue' : 
                        user.role === 'ADMIN' ? '/admin/dashboard' : 
                        '/patient/dashboard';

    // Set HTTP-only cookies for server-side auth
    const cookieStore = await cookies();
    
    // Set access token cookie (HTTP-only, secure)
    cookieStore.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: ACCESS_TOKEN_EXPIRY_SECONDS,
      path: '/',
    });

    // Set refresh token cookie (HTTP-only, secure)
    cookieStore.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Return success response (never include passwordHash)
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      redirectUrl,
    });
  } catch (error) {
    console.error('Login error:', error instanceof Error ? error.message : 'Unknown error');

    return NextResponse.json(
      {
        error: 'Login failed. Please try again later.',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
