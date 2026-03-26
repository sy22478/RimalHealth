/**
 * POST /api/auth/register
 * User registration endpoint
 * 
 * HIPAA Compliance:
 * - Passwords are hashed with bcrypt (12 rounds)
 * - No PHI is returned in the response
 * - Audit logging for registration events
 * - Email verification required before full access
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { Role } from '@prisma/client';

// JWT utilities
import {
  generateTokenPair,
  ACCESS_TOKEN_EXPIRY_SECONDS,
} from '@/lib/auth/jwt';

// Password utilities
import {
  hashPassword,
  validatePasswordStrength,
  MIN_PASSWORD_LENGTH,
} from '@/lib/auth/password';

// Database
import { prisma } from '@/lib/db/prisma';

// Audit
import { auditUserRegistration } from '@/lib/audit/logger';
import { AuditContext } from '@/lib/audit/types';

// Rate limiting
import { rateLimit, rateLimitPresets } from '@/lib/middleware/rate-limit';

// ============================================
// Validation Schema
// ============================================

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(
    MIN_PASSWORD_LENGTH,
    `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  ),
  confirmPassword: z.string(),
  termsAccepted: z.boolean().refine((v) => v === true, 'You must accept the terms'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterInput = z.infer<typeof registerSchema>;

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

// ============================================
// Route Handler
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limiting: 5 requests per 15 minutes per IP
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateLimitResult = await rateLimit(clientIp, rateLimitPresets.auth);
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
    const validationResult = registerSchema.safeParse(body);

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

    const { email, password }: RegisterInput = validationResult.data;

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

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });

    if (existingUser) {
      // Don't reveal that email exists - return generic error with 400 (not 409)
      return NextResponse.json(
        {
          error: 'Registration failed. Please try again.',
          code: 'REGISTRATION_ERROR',
        },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user with PatientProfile in a transaction
    const user = await prisma.$transaction(async (tx) => {
      // Create the user
      const newUser = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          role: Role.PATIENT,
          emailVerified: false,
          tokenVersion: 0,
        },
      });

      // Create empty PatientProfile (to be filled later)
      await tx.patientProfile.create({
        data: {
          userId: newUser.id,
          // Initialize required encrypted fields with empty strings
          // These will be properly filled during intake
          firstName: '',
          lastName: '',
          dateOfBirth: '',
          phone: '',
          addressStreet: '',
          addressCity: '',
          addressState: 'CA',
          addressZip: '',
          termsAccepted: true,
          termsAcceptedDate: new Date(),
        },
      });

      return newUser;
    });

    // Generate token pair
    const { accessToken, refreshToken } = await generateTokenPair(
      user.id,
      user.email,
      user.role,
      user.tokenVersion
    );

    // Create session
    await createSession(
      user.id,
      accessToken,
      refreshToken,
      auditContext.ipAddress,
      auditContext.userAgent
    );

    // Log audit event
    await auditUserRegistration(user.id, user.role, auditContext);

    // Set HTTP-only cookies for server-side auth
    const cookieStore = await cookies();
    
    cookieStore.set('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: ACCESS_TOKEN_EXPIRY_SECONDS,
      path: '/',
    });

    cookieStore.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Return success response (never include passwordHash)
    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error instanceof Error ? error.message : 'Unknown error');

    // Don't leak internal error details
    return NextResponse.json(
      {
        error: 'Registration failed. Please try again later.',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
