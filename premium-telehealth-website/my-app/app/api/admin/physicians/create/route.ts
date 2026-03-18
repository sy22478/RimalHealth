/**
 * POST /api/admin/physicians/create
 * Create a new physician account (User + Physician) in a single transaction
 *
 * HIPAA Compliance:
 * - Requires ADMIN role
 * - Logs all creation actions via audit service
 * - No PHI is stored in this endpoint (physician credentials only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { AuditService } from '@/lib/services/audit-service';
import { Role, PhysicianStatus, AuthorizationAction, AdminAction } from '@prisma/client';
import { DataModificationAction } from '@/lib/audit/index';

// ============================================================================
// Validation Schema
// ============================================================================

const createPhysicianSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .refine((val) => val.endsWith('@rimalhealth.com'), {
      message: 'Email must end with @rimalhealth.com',
    }),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  npiNumber: z.string().min(1, 'NPI number is required'),
  licenseNumber: z.string().min(1, 'License number is required'),
  specialty: z.string().optional(),
  deaNumber: z.string().optional(),
});

// ============================================================================
// POST - Create Physician
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Require ADMIN role
  const auth = await requireRole(request, [Role.ADMIN]);

  if (auth instanceof NextResponse) {
    return auth;
  }

  const { user } = auth;
  const auditContext = AuditService.createAuditContext(
    request,
    user.userId,
    user.role
  );

  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = createPhysicianSchema.safeParse(body);

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

    const {
      email,
      password,
      firstName,
      lastName,
      npiNumber,
      licenseNumber,
      specialty,
      deaNumber,
    } = validation.data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: 'A user with this email already exists',
          code: 'EMAIL_EXISTS',
        },
        { status: 409 }
      );
    }

    // Hash the password
    const passwordHash = await hashPassword(password);

    // Create User + Physician + logs in a single interactive transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create User with nested Physician
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: Role.PHYSICIAN,
          emailVerified: true,
          physician: {
            create: {
              firstName,
              lastName,
              npiNumber,
              licenseNumber,
              licenseState: 'CA',
              deaNumber: deaNumber ?? null,
              specialty: specialty ?? null,
              status: PhysicianStatus.ACTIVE,
              isActive: true,
              authorizedBy: user.userId,
              authorizedAt: new Date(),
              maxDailyReviews: 20,
            },
          },
        },
        include: {
          physician: true,
        },
      });

      const physicianId = newUser.physician!.id;

      // 2. Log in PhysicianAuthorizationLog
      await tx.physicianAuthorizationLog.create({
        data: {
          physicianId,
          adminId: user.userId,
          action: AuthorizationAction.AUTHORIZED,
          reason: 'Admin-created physician account',
          ipAddress: auditContext.ipAddress,
          userAgent: auditContext.userAgent,
        },
      });

      // 3. Log in AdminActivityLog
      await tx.adminActivityLog.create({
        data: {
          adminId: user.userId,
          action: AdminAction.PHYSICIAN_AUTHORIZE,
          entityType: 'PHYSICIAN',
          entityId: physicianId,
          description: `Created and authorized physician account for ${firstName} ${lastName} (${email})`,
          newValue: {
            email,
            firstName,
            lastName,
            npiNumber,
            licenseNumber,
            specialty: specialty ?? null,
            status: PhysicianStatus.ACTIVE,
          },
          ipAddress: auditContext.ipAddress,
          userAgent: auditContext.userAgent,
        },
      });

      return newUser;
    });

    // Log via audit service
    await AuditService.logDataModification(
      DataModificationAction.CREATE,
      user.userId,
      'PHYSICIAN',
      result.physician!.id,
      auditContext,
      ['email', 'firstName', 'lastName', 'npiNumber', 'licenseNumber', 'specialty', 'deaNumber', 'status'],
      'Admin created new physician account'
    );

    return NextResponse.json(
      {
        success: true,
        physician: {
          id: result.physician!.id,
          email: result.email,
        },
        message: 'Physician account created successfully.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create physician error:', error);

    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/admin/physicians/create',
      auditContext,
      user.userId
    );

    return NextResponse.json(
      {
        error: 'Failed to create physician account',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
