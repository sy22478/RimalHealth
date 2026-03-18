/**
 * POST /api/patient/intake/[id]/submit
 * Submit intake for physician review
 *
 * HIPAA Compliance:
 * - Verifies patient owns the intake
 * - Validates all required fields
 * - Logs submission
 * - Notifies physicians
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { NotificationService } from '@/lib/services/notification-service';
import { submitIntakeSchema } from '@/lib/validation/schemas';
import { calculateIntakeScores } from '@/lib/intake/scoring';
import { Role, IntakeStatus, Prisma } from '@prisma/client';
import { DataModificationAction } from '@/lib/audit/index';

// ============================================================================
// POST - Submit Intake
// ============================================================================

export async function POST(
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
      submitIntakeSchema
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

    const { formData } = validation.data!;

    // Get intake
    const intake = await prisma.intake.findUnique({
      where: { id: intakeId },
      include: {
        patient: {
          include: {
            patientProfile: true,
          },
        },
      },
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
        `/api/patient/intake/${intakeId}/submit`,
        auditContext,
        'Patient does not own this intake'
      );
      return NextResponse.json(
        { error: 'Access denied', code: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

    // Only allow submission of DRAFT intakes
    if (intake.status !== IntakeStatus.DRAFT) {
      return NextResponse.json(
        {
          error: 'Intake already submitted',
          code: 'INTAKE_ALREADY_SUBMITTED',
        },
        { status: 409 }
      );
    }

    // Check payment status
    // In production, always require payment. In dev/test, require if REQUIRE_PAYMENT=true.
    const requirePayment = process.env.NODE_ENV === 'production' || process.env.REQUIRE_PAYMENT === 'true';
    if (requirePayment && intake.paymentStatus !== 'COMPLETED') {
      return NextResponse.json(
        {
          error: 'Payment required before submission',
          code: 'PAYMENT_REQUIRED',
        },
        { status: 402 }
      );
    }

    // Calculate scores
    const scores = calculateIntakeScores(formData as Record<string, unknown>);

    // Update intake
    // Note: formData is auto-encrypted by the Prisma encryption extension
    const updatedIntake = await prisma.intake.update({
      where: { id: intakeId },
      data: {
        status: IntakeStatus.SUBMITTED,
        formData: formData as Prisma.InputJsonValue,
        submittedAt: new Date(),
        riskScore: scores.riskScore,
        complexityScore: scores.complexityScore,
      },
    });

    // Update patient profile with form data
    // Note: PHI fields (firstName, lastName, phone, etc.) are auto-encrypted
    // by the Prisma encryption extension -- do NOT manually encrypt them here.
    await prisma.patientProfile.update({
      where: { userId },
      data: {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth,
        addressStreet: formData.addressStreet,
        addressCity: formData.addressCity,
        addressState: 'CA',
        addressZip: formData.addressZip,
        primaryConcern: formData.primaryConcern,
        treatmentGoal: formData.treatmentGoal,
        medicalHistory: {
          isPregnant: formData.isPregnant,
          isPregnantDetails: formData.isPregnantDetails,
          hasSeizureHistory: formData.hasSeizureHistory,
          seizureDetails: formData.seizureDetails,
          hasPsychiatricHistory: formData.hasPsychiatricHistory,
          psychiatricDetails: formData.psychiatricDetails,
          hasLiverDisease: formData.hasLiverDisease,
          liverDiseaseDetails: formData.liverDiseaseDetails,
          hasKidneyDisease: formData.hasKidneyDisease,
          kidneyDiseaseDetails: formData.kidneyDiseaseDetails,
          hasHeartCondition: formData.hasHeartCondition,
          heartConditionDetails: formData.heartConditionDetails,
          otherConditions: formData.otherConditions,
        } as Prisma.InputJsonValue,
        currentMedications: {
          takingMedications: formData.takingMedications,
          medicationList: formData.medicationList,
          medicationAllergies: formData.medicationAllergies,
        } as Prisma.InputJsonValue,
        privacyConsentGiven: true,
        privacyConsentDate: new Date(),
        privacyConsentVersion: '1.0',
        termsAccepted: true,
        termsAcceptedDate: new Date(),
      },
    });

    // Log submission
    await AuditService.logDataModification(
      DataModificationAction.UPDATE,
      userId,
      'Intake',
      intakeId,
      auditContext,
      ['status', 'submittedAt', 'riskScore', 'complexityScore'],
      'Intake submitted for review'
    );

    // Notify physicians
    await NotificationService.notifyPhysicianNewIntake(
      intakeId,
      formData.primaryConcern
    );

    return NextResponse.json({
      success: true,
      intake: {
        id: updatedIntake.id,
        status: updatedIntake.status,
        submittedAt: updatedIntake.submittedAt?.toISOString(),
        riskScore: scores.riskScore,
        complexityScore: scores.complexityScore,
      },
    });
  } catch (error) {
    console.error('Submit intake error:', error);

    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      `/api/patient/intake/${intakeId}/submit`,
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to submit intake', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
