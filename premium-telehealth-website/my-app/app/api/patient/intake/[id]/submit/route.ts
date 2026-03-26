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
import { submitIntakeSchema, dsm5IntakeFormDataSchema } from '@/lib/validation/schemas';
import { calculateIntakeScores, generateProviderDecisionSummary } from '@/lib/intake/scoring';
import { Role, IntakeStatus, Prisma } from '@prisma/client';
import { DataModificationAction } from '@/lib/audit/index';
import { requireCSRF } from '@/lib/security/csrf';

// ============================================================================
// POST - Submit Intake
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // CSRF validation (double-submit cookie pattern)
  const csrfError = requireCSRF(request);
  if (csrfError) return csrfError;

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

    // Enforce a maximum payload size to prevent arbitrarily large form data
    const formDataStr = JSON.stringify(formData);
    if (formDataStr.length > 50000) {
      return NextResponse.json(
        { error: 'Form data exceeds maximum allowed size', code: 'PAYLOAD_TOO_LARGE' },
        { status: 400 }
      );
    }

    // Server-side validation of DSM-5 intake form data structure.
    // If the form has dsm5Q1, it's the DSM-5 format — validate its structure.
    const fd_raw = formData as Record<string, unknown>;
    if (fd_raw.dsm5Q1 !== undefined) {
      const dsm5Validation = dsm5IntakeFormDataSchema.safeParse(fd_raw);
      if (!dsm5Validation.success) {
        return NextResponse.json(
          {
            error: 'Invalid intake form data',
            code: 'FORM_DATA_VALIDATION_ERROR',
            details: dsm5Validation.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }
    }

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

    // Check payment status — payment-first flow means the user already paid via Stripe
    // before reaching the intake form. Verify via subscription or intake paymentStatus.
    const requirePayment = process.env.NODE_ENV === 'production' || process.env.REQUIRE_PAYMENT === 'true';
    if (requirePayment && intake.paymentStatus !== 'COMPLETED') {
      // Check if user has an active subscription (payment-first flow)
      const subscription = await prisma.subscription.findFirst({
        where: { userId, status: 'ACTIVE' },
        select: { id: true },
      });

      if (subscription) {
        // Payment confirmed via subscription — update intake paymentStatus
        await prisma.intake.update({
          where: { id: intakeId },
          data: { paymentStatus: 'COMPLETED' },
        });
      } else {
        return NextResponse.json(
          {
            error: 'Payment required before submission',
            code: 'PAYMENT_REQUIRED',
          },
          { status: 402 }
        );
      }
    }

    // Calculate scores (handles both DSM-5 and AUDIT-C format)
    const fd = formData as Record<string, unknown>;
    const scores = calculateIntakeScores(fd);

    // Generate provider decision summary (DSM-5 scoring + contraindications + withdrawal risk)
    const providerSummary = generateProviderDecisionSummary(fd);

    // Store formData with provider decision summary appended
    const enrichedFormData = {
      ...fd,
      _providerDecisionSummary: {
        dsm5Score: providerSummary.dsm5.score,
        dsm5Severity: providerSummary.dsm5.severity,
        dsm5MeetsCriteria: providerSummary.dsm5.meetsCriteria,
        dsm5Interpretation: providerSummary.dsm5.interpretation,
        absoluteContraindications: providerSummary.contraindications.absolute,
        relativeContraindications: providerSummary.contraindications.relative,
        hasAbsoluteContraindication: providerSummary.contraindications.hasAbsoluteContraindication,
        withdrawalRiskElevated: providerSummary.withdrawalRisk.isElevated,
        withdrawalRiskFactors: providerSummary.withdrawalRisk.riskFactors,
        withdrawalRecommendation: providerSummary.withdrawalRisk.recommendation,
        eligibleForNaltrexone: providerSummary.eligibleForNaltrexone,
        priority: providerSummary.priority,
        summary: providerSummary.summary,
      },
    };

    // Update intake
    // Note: formData is auto-encrypted by the Prisma encryption extension
    const updatedIntake = await prisma.intake.update({
      where: { id: intakeId },
      data: {
        status: IntakeStatus.SUBMITTED,
        formData: enrichedFormData as Prisma.InputJsonValue,
        submittedAt: new Date(),
        riskScore: scores.riskScore,
        complexityScore: scores.complexityScore,
      },
    });

    // Extract personal info from formData (works for both DSM-5 and AUDIT-C format)
    const firstName = fd.firstName as string | undefined;
    const lastName = fd.lastName as string | undefined;
    const phone = fd.phone as string | undefined;
    const dateOfBirth = fd.dateOfBirth as string | undefined;

    // Address fields (present in AUDIT-C format, absent in DSM-5)
    const addressStreet = fd.addressStreet as string | undefined;
    const addressCity = fd.addressCity as string | undefined;
    const addressZip = fd.addressZip as string | undefined;

    // Treatment info
    const primaryConcern = (fd.primaryConcern as string | undefined) || 'ALCOHOL';
    const treatmentGoal = fd.treatmentGoal as string | undefined;

    // Map DSM-5 safety screening fields to medical history booleans
    // DSM-5 format uses: liverCondition, pregnancyStatus, medicalHistory (array), etc.
    // AUDIT-C format uses: isPregnant, hasSeizureHistory, hasLiverDisease, etc.
    const liverCondition = fd.liverCondition as string | undefined;
    const pregnancyStatus = fd.pregnancyStatus as string | undefined;
    const medicalHistoryArray = fd.medicalHistory as string[] | undefined;
    const withdrawalSeizure = fd.withdrawalSeizure as boolean | undefined;

    const isPregnant = fd.isPregnant === true
      || (pregnancyStatus !== undefined && pregnancyStatus !== 'none');
    const hasSeizureHistory = fd.hasSeizureHistory === true
      || withdrawalSeizure === true
      || (Array.isArray(medicalHistoryArray) && medicalHistoryArray.includes('seizures'));
    const hasPsychiatricHistory = fd.hasPsychiatricHistory === true
      || (Array.isArray(medicalHistoryArray) && (
        medicalHistoryArray.includes('depression')
        || medicalHistoryArray.includes('anxiety')
        || medicalHistoryArray.includes('bipolar')
        || medicalHistoryArray.includes('schizophrenia')
        || medicalHistoryArray.includes('ptsd')
      ));
    const hasLiverDisease = fd.hasLiverDisease === true
      || (liverCondition !== undefined && liverCondition !== 'none');
    const hasKidneyDisease = fd.hasKidneyDisease === true
      || (Array.isArray(medicalHistoryArray) && medicalHistoryArray.includes('kidney'));
    const hasHeartCondition = fd.hasHeartCondition === true
      || (Array.isArray(medicalHistoryArray) && (
        medicalHistoryArray.includes('heart')
        || medicalHistoryArray.includes('hypertension')
      ));

    const takingMedications = fd.takingMedications === true
      || fd.currentMedications === true;
    const medicationList = fd.medicationList as string | undefined;

    // Build profile update data — only set fields that have values
    const profileUpdate: Record<string, unknown> = {
      medicalHistory: {
        isPregnant,
        isPregnantDetails: fd.isPregnantDetails || (isPregnant ? (pregnancyStatus || '') : ''),
        hasSeizureHistory,
        seizureDetails: fd.seizureDetails || '',
        hasPsychiatricHistory,
        psychiatricDetails: fd.psychiatricDetails || '',
        hasLiverDisease,
        liverDiseaseDetails: fd.liverDiseaseDetails || (hasLiverDisease ? (liverCondition || '') : ''),
        hasKidneyDisease,
        kidneyDiseaseDetails: fd.kidneyDiseaseDetails || '',
        hasHeartCondition,
        heartConditionDetails: fd.heartConditionDetails || '',
        otherConditions: fd.otherConditions || '',
        // Preserve DSM-5 specific data
        ...(medicalHistoryArray ? { medicalHistoryItems: medicalHistoryArray } : {}),
        ...(fd.withdrawalSeizure !== undefined ? { withdrawalSeizure: fd.withdrawalSeizure } : {}),
        ...(fd.withdrawalDTs !== undefined ? { withdrawalDTs: fd.withdrawalDTs } : {}),
        ...(fd.withdrawalHospitalized !== undefined ? { withdrawalHospitalized: fd.withdrawalHospitalized } : {}),
        ...(fd.morningDrinking !== undefined ? { morningDrinking: fd.morningDrinking } : {}),
        ...(fd.opioidUse !== undefined ? { opioidUse: fd.opioidUse } : {}),
        ...(fd.opioidMaintenance !== undefined ? { opioidMaintenance: fd.opioidMaintenance } : {}),
        ...(liverCondition ? { liverCondition } : {}),
        ...(fd.liverTests ? { liverTests: fd.liverTests } : {}),
        ...(pregnancyStatus ? { pregnancyStatus } : {}),
        ...(fd.drugAllergies ? { drugAllergies: fd.drugAllergies } : {}),
      } as Prisma.InputJsonValue,
      currentMedications: {
        takingMedications,
        medicationList: medicationList || '',
        medicationAllergies: (fd.medicationAllergies as string) || '',
      } as Prisma.InputJsonValue,
      privacyConsentGiven: true,
      privacyConsentDate: new Date(),
      privacyConsentVersion: '1.0',
      termsAccepted: true,
      termsAcceptedDate: new Date(),
    };

    // Only set personal info fields that are present
    if (firstName) profileUpdate.firstName = firstName;
    if (lastName) profileUpdate.lastName = lastName;
    if (phone) profileUpdate.phone = phone;
    if (dateOfBirth) profileUpdate.dateOfBirth = dateOfBirth;
    if (addressStreet) profileUpdate.addressStreet = addressStreet;
    if (addressCity) profileUpdate.addressCity = addressCity;
    if (addressStreet || addressCity || addressZip) profileUpdate.addressState = 'CA';
    if (addressZip) profileUpdate.addressZip = addressZip;
    if (primaryConcern) profileUpdate.primaryConcern = primaryConcern;
    if (treatmentGoal) profileUpdate.treatmentGoal = treatmentGoal;

    // Update patient profile with form data
    // Note: PHI fields (firstName, lastName, phone, etc.) are auto-encrypted
    // by the Prisma encryption extension -- do NOT manually encrypt them here.
    await prisma.patientProfile.update({
      where: { userId },
      data: profileUpdate,
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
      primaryConcern
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
    console.error('Submit intake error:', error instanceof Error ? error.message : 'Unknown error');

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
