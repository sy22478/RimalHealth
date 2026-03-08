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
import { Role, IntakeStatus } from '@prisma/client';
import { DataModificationAction } from '@/lib/audit';
import { encryptPHI } from '@/lib/encryption/phi';

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
    // In development, skip this check; in production, require payment
    if (process.env.NODE_ENV === 'production' && intake.paymentStatus !== 'COMPLETED') {
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
    const updatedIntake = await prisma.intake.update({
      where: { id: intakeId },
      data: {
        status: IntakeStatus.SUBMITTED,
        formData: encryptPHI(JSON.stringify(formData)),
        submittedAt: new Date(),
        riskScore: scores.riskScore,
        complexityScore: scores.complexityScore,
      },
    });

    // Update patient profile with form data
    await prisma.patientProfile.update({
      where: { userId },
      data: {
        firstName: encryptPHI(formData.firstName),
        lastName: encryptPHI(formData.lastName),
        phone: encryptPHI(formData.phone),
        dateOfBirth: encryptPHI(formData.dateOfBirth),
        addressStreet: encryptPHI(formData.addressStreet),
        addressCity: encryptPHI(formData.addressCity),
        addressState: 'CA',
        addressZip: encryptPHI(formData.addressZip),
        primaryConcern: formData.primaryConcern,
        treatmentGoal: formData.treatmentGoal,
        medicalHistory: encryptPHI(JSON.stringify({
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
        })),
        currentMedications: encryptPHI(JSON.stringify({
          takingMedications: formData.takingMedications,
          medicationList: formData.medicationList,
          medicationAllergies: formData.medicationAllergies,
        })),
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
