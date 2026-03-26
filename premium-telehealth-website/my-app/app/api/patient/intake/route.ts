/**
 * POST /api/patient/intake
 * Create a new intake draft
 *
 * HIPAA Compliance:
 * - Validates patient authentication
 * - Logs intake creation
 * - Creates encrypted draft record
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { NotificationService } from '@/lib/services/notification-service';
import { createIntakeSchema } from '@/lib/validation/schemas';
import { Role, IntakeStatus, PaymentStatus, Prisma } from '@prisma/client';

// ============================================================================
// POST - Create Intake Draft
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Require patient role
  const auth = await requireRole(request, [Role.PATIENT]);

  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const auditContext = AuditService.createAuditContext(request, userId, 'PATIENT');

  try {
    // Validate request body
    const validation = await ValidationService.validateRequestBody(
      request,
      createIntakeSchema
    );

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const { primaryConcern, formData } = validation.data!;

    // Check if patient already has an active intake
    const existingIntake = await prisma.intake.findFirst({
      where: {
        patientId: userId,
        status: {
          in: [IntakeStatus.DRAFT, IntakeStatus.SUBMITTED, IntakeStatus.UNDER_REVIEW],
        },
      },
    });

    if (existingIntake) {
      if (existingIntake.status === IntakeStatus.DRAFT) {
        // Update existing draft with new form data and return it
        const updated = await prisma.intake.update({
          where: { id: existingIntake.id },
          data: { formData: (formData ?? {}) as Prisma.InputJsonValue },
        });

        await prisma.patientProfile.update({
          where: { userId },
          data: { primaryConcern },
        });

        return NextResponse.json({
          success: true,
          intake: {
            id: updated.id,
            status: updated.status,
            createdAt: updated.createdAt.toISOString(),
          },
        });
      }

      // SUBMITTED or UNDER_REVIEW — can't create a new one
      return NextResponse.json(
        {
          error: 'Active intake already exists',
          code: 'ACTIVE_INTAKE_EXISTS',
          intakeId: existingIntake.id,
        },
        { status: 409 }
      );
    }

    // Create intake draft and update patient profile atomically
    // Note: formData is auto-encrypted by the Prisma encryption extension
    const intake = await prisma.$transaction(async (tx) => {
      const newIntake = await tx.intake.create({
        data: {
          patientId: userId,
          status: IntakeStatus.DRAFT,
          formData: (formData ?? {}) as Prisma.InputJsonValue,
          paymentStatus: PaymentStatus.PENDING,
        },
      });

      // Update patient profile with primary concern
      await tx.patientProfile.update({
        where: { userId },
        data: { primaryConcern },
      });

      return newIntake;
    });

    // Log intake creation
    await AuditService.logIntakeAccess(userId, 'PATIENT', intake.id, 'CREATE', auditContext);

    // Notify physicians of new intake waiting for review
    try {
      await NotificationService.notifyPhysicianNewIntake(intake.id, primaryConcern || 'ALCOHOL');
    } catch {
      // Notification failures should not block intake creation
      console.error('[Intake] Failed to notify physicians, continuing...');
    }

    return NextResponse.json(
      {
        success: true,
        intake: {
          id: intake.id,
          status: intake.status,
          createdAt: intake.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create intake error:', error instanceof Error ? error.message : 'Unknown error');

    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/patient/intake',
      auditContext,
      userId
    );

    return NextResponse.json(
      {
        error: 'Failed to create intake',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
