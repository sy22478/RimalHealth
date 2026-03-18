/**
 * GET /api/patient/intake/[id]
 * PATCH /api/patient/intake/[id]
 * Retrieve or update an intake draft
 *
 * HIPAA Compliance:
 * - Verifies patient owns the intake
 * - Decrypts PHI for authorized access only
 * - Logs all access
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { updateIntakeSchema } from '@/lib/validation/schemas';
import { Role, IntakeStatus, Prisma } from '@prisma/client';
import { DataModificationAction } from '@/lib/audit';

// ============================================================================
// GET - Retrieve Intake
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // Require patient role
  const auth = await requireRole(request, [Role.PATIENT]);

  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const { id: intakeId } = await params;
  const auditContext = AuditService.createAuditContext(request, userId, 'PATIENT');

  try {
    // Validate UUID
    const uuidValidation = ValidationService.validateUUID(intakeId);
    if (!uuidValidation.success) {
      return NextResponse.json(
        { error: 'Invalid intake ID', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Get intake
    const intake = await prisma.intake.findUnique({
      where: { id: intakeId },
    });

    if (!intake) {
      return NextResponse.json(
        { error: 'Intake not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (intake.patientId !== userId) {
      await AuditService.logUnauthorizedAccess(
        userId,
        `/api/patient/intake/${intakeId}`,
        auditContext,
        'Patient does not own this intake'
      );
      return NextResponse.json(
        { error: 'Access denied', code: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

    // Log access
    await AuditService.logIntakeAccess(userId, 'PATIENT', intakeId, 'VIEW', auditContext);

    // formData is auto-decrypted by the Prisma encryption extension
    return NextResponse.json({
      intake: {
        id: intake.id,
        status: intake.status,
        formData: intake.formData ?? {},
        paymentStatus: intake.paymentStatus,
        riskScore: intake.riskScore,
        complexityScore: intake.complexityScore,
        createdAt: intake.createdAt.toISOString(),
        updatedAt: intake.updatedAt.toISOString(),
        submittedAt: intake.submittedAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get intake error:', error);

    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      `/api/patient/intake/${intakeId}`,
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to retrieve intake', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update Intake
// ============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // Require patient role
  const auth = await requireRole(request, [Role.PATIENT]);

  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const { id: intakeId } = await params;
  const auditContext = AuditService.createAuditContext(request, userId, 'PATIENT');

  try {
    // Validate UUID
    const uuidValidation = ValidationService.validateUUID(intakeId);
    if (!uuidValidation.success) {
      return NextResponse.json(
        { error: 'Invalid intake ID', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Validate request body
    const validation = await ValidationService.validateRequestBody(
      request,
      updateIntakeSchema
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

    const { formData, isDraft } = validation.data!;

    // Get intake
    const intake = await prisma.intake.findUnique({
      where: { id: intakeId },
    });

    if (!intake) {
      return NextResponse.json(
        { error: 'Intake not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (intake.patientId !== userId) {
      await AuditService.logUnauthorizedAccess(
        userId,
        `/api/patient/intake/${intakeId}`,
        auditContext,
        'Patient does not own this intake'
      );
      return NextResponse.json(
        { error: 'Access denied', code: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

    // Only allow updates to DRAFT intakes
    if (intake.status !== IntakeStatus.DRAFT) {
      return NextResponse.json(
        {
          error: 'Cannot update submitted intake',
          code: 'INTAKE_ALREADY_SUBMITTED',
        },
        { status: 409 }
      );
    }

    // Update intake
    // Note: formData is auto-encrypted by the Prisma encryption extension
    const updatedIntake = await prisma.intake.update({
      where: { id: intakeId },
      data: {
        formData: formData as Prisma.InputJsonValue,
      },
    });

    // Log update
    await AuditService.logDataModification(
      DataModificationAction.UPDATE,
      userId,
      'Intake',
      intakeId,
      auditContext,
      Object.keys(formData),
      isDraft ? 'Draft update' : 'Final update'
    );

    return NextResponse.json({
      success: true,
      intake: {
        id: updatedIntake.id,
        status: updatedIntake.status,
        updatedAt: updatedIntake.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Update intake error:', error);

    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      `/api/patient/intake/${intakeId}`,
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to update intake', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
