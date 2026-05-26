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

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { NotificationService } from '@/lib/services/notification-service';
import { submitIntakeSchema, dsm5IntakeFormDataSchema } from '@/lib/validation/schemas';
import { generateProviderDecisionSummary } from '@/lib/intake/scoring';
import { Role, IntakeStatus, DocumentType, DocumentStatus, TreatmentGoal, Prisma } from '@prisma/client';
import { DataModificationAction } from '@/lib/audit/index';
import { validateAddress } from '@/lib/integrations/location';
import { humanizeValue } from '@/lib/utils/labels';

// Map intake form's primaryGoal values to the DB's TreatmentGoal enum.
// Intake uses 'abstinence' | 'harm-reduction' | 'unsure'; DB enum is QUIT | REDUCE | EXPLORE.
const PRIMARY_GOAL_TO_TREATMENT_GOAL: Record<string, TreatmentGoal> = {
  abstinence: TreatmentGoal.QUIT,
  'harm-reduction': TreatmentGoal.REDUCE,
  unsure: TreatmentGoal.EXPLORE,
};

// ============================================================================
// POST - Submit Intake
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // CSRF not required: this route is auth-protected (requireRole PATIENT) and
  // the intake form client does not use CSRF infrastructure. Auth token + same-origin
  // fetch provide sufficient protection against cross-site attacks.

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

    // Server-side age validation: patient must be 18+
    if (fd_raw.dateOfBirth && typeof fd_raw.dateOfBirth === 'string') {
      const dobStr = fd_raw.dateOfBirth;
      let dob: Date;
      if (/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) {
        const [y, m, d] = dobStr.split('-').map(Number);
        dob = new Date(y, m - 1, d);
      } else {
        // Strip time component to prevent UTC→local timezone shift
        // (e.g. "1999-04-03T00:00:00.000Z" parsed in PST rolls back one day).
        const dateOnly = dobStr.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
          const [y, m, d] = dateOnly.split('-').map(Number);
          dob = new Date(y, m - 1, d);
        } else {
          dob = new Date(dobStr);
        }
      }
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      if (age < 18) {
        return NextResponse.json(
          { error: 'You must be at least 18 years old to use this service', code: 'AGE_REQUIREMENT' },
          { status: 400 }
        );
      }
    }

    // Server-side California address validation (state + ZIP)
    const addressState = fd_raw.addressState as string | undefined;
    if (addressState && addressState.toUpperCase() !== 'CA') {
      return NextResponse.json(
        { error: 'Service is only available to California residents', code: 'CA_ONLY' },
        { status: 400 }
      );
    }
    if (fd_raw.addressZip && typeof fd_raw.addressZip === 'string') {
      const zip = parseInt(fd_raw.addressZip.substring(0, 5), 10);
      if (isNaN(zip) || zip < 90001 || zip > 96162) {
        return NextResponse.json(
          { error: 'Patient address must be in California (ZIP 90001-96162)', code: 'CA_ONLY' },
          { status: 400 }
        );
      }
    }

    // Server-side California pharmacy validation (state + ZIP)
    const pharmacyState = fd_raw.pharmacyState as string | undefined;
    if (pharmacyState && pharmacyState.toUpperCase() !== 'CA') {
      return NextResponse.json(
        { error: 'Pharmacy must be in California', code: 'CA_ONLY' },
        { status: 400 }
      );
    }
    if (fd_raw.pharmacyZip && typeof fd_raw.pharmacyZip === 'string') {
      const zip = parseInt(fd_raw.pharmacyZip.substring(0, 5), 10);
      if (isNaN(zip) || zip < 90001 || zip > 96162) {
        return NextResponse.json(
          { error: 'Pharmacy ZIP code must be a valid California ZIP code (90001-96162)', code: 'CA_ONLY' },
          { status: 400 }
        );
      }
    }

    // Amazon Location Service address validation (graceful degradation)
    const intakeStreet = fd_raw.addressStreet as string | undefined;
    const intakeCity = fd_raw.addressCity as string | undefined;
    const intakeZip = fd_raw.addressZip as string | undefined;
    if (intakeStreet && intakeCity && intakeZip) {
      try {
        const addrResult = await validateAddress({
          street: intakeStreet,
          city: intakeCity,
          state: 'CA',
          zip: intakeZip,
        });

        // Reject when the address is not in CA (valid=false) OR when the
        // top CA match's city/ZIP disagrees with the user's input
        // (verified=false). The latter catches cases like street in one
        // municipality typed with another city/ZIP — Amazon Location would
        // otherwise return a nearby CA result that passes the CA-only check
        // but describes a different address than what the user entered.
        if (!addrResult.error && (!addrResult.valid || !addrResult.verified)) {
          return NextResponse.json(
            {
              error:
                addrResult.warnings?.[0] ||
                'Address could not be verified. Please check the street, city, and ZIP code.',
              code: 'ADDRESS_INVALID',
              warnings: addrResult.warnings ?? [],
              suggestions: addrResult.suggestions,
              correctedAddress: addrResult.correctedAddress,
            },
            { status: 400 }
          );
        }
        // If addrResult.error (Location Service failure), proceed — graceful degradation
      } catch (addrError) {
        // Location Service is down — log and proceed, don't block intake submission
        console.error('Address validation service unavailable:', addrError instanceof Error ? addrError.message : 'Unknown error');
      }
    }

    // Pharmacy address validation (warn-only — pharmacy may be new/unlisted)
    const warnings: string[] = [];
    const pharmacyStreet = fd_raw.pharmacyAddress as string | undefined;
    const pharmacyCity = fd_raw.pharmacyCity as string | undefined;
    const pharmacyZipRaw = fd_raw.pharmacyZip as string | undefined;
    if (pharmacyStreet && pharmacyCity && pharmacyZipRaw) {
      try {
        const pharmacyAddrResult = await validateAddress({
          street: pharmacyStreet,
          city: pharmacyCity,
          state: 'CA',
          zip: pharmacyZipRaw,
        });
        if (!pharmacyAddrResult.error && !pharmacyAddrResult.valid) {
          console.warn('Pharmacy address could not be verified — proceeding with submission');
          warnings.push('Pharmacy address could not be verified. If the pharmacy is new or unlisted, this is normal; otherwise please double-check the address.');
        }
      } catch (pharmacyAddrError) {
        console.error('Pharmacy address validation service unavailable:', pharmacyAddrError instanceof Error ? pharmacyAddrError.message : 'Unknown error');
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
    // TRIALING subscriptions are valid — payment is captured but not charged until physician approval.
    const requirePayment = process.env.NODE_ENV === 'production' || process.env.REQUIRE_PAYMENT === 'true';
    if (requirePayment && intake.paymentStatus !== 'COMPLETED') {
      // Check if user has an active or trialing subscription (payment-first flow)
      const subscription = await prisma.subscription.findFirst({
        where: { userId, status: { in: ['ACTIVE', 'TRIALING'] } },
        select: { id: true },
      });

      if (subscription) {
        // Payment method confirmed via subscription — update intake paymentStatus
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

    const fd = formData as Record<string, unknown>;

    // Normalize opioidUse to an array before scoring and persistence. Corrupted draft data
    // (string, object, null) would silently bypass the naltrexone contraindication check in
    // detectContraindications via its Array.isArray guard — clinical-safety critical.
    const opioidUse = Array.isArray(fd.opioidUse) ? fd.opioidUse : [];
    fd.opioidUse = opioidUse;

    // Generate provider decision summary (includes DSM-5 scoring + contraindications + withdrawal risk + scores)
    const providerSummary = generateProviderDecisionSummary(fd);
    // Use scores from the provider summary to avoid computing them twice
    const scores = { riskScore: providerSummary.riskScore, complexityScore: providerSummary.complexityScore };

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
    // treatmentGoal: prefer explicit DB enum value, fall back to mapping intake's primaryGoal.
    const rawTreatmentGoal = fd.treatmentGoal as string | undefined;
    const rawPrimaryGoal = fd.primaryGoal as string | undefined;
    const treatmentGoal: TreatmentGoal | undefined =
      (rawTreatmentGoal && (TreatmentGoal as Record<string, TreatmentGoal>)[rawTreatmentGoal]) ||
      (rawPrimaryGoal ? PRIMARY_GOAL_TO_TREATMENT_GOAL[rawPrimaryGoal] : undefined);

    // Biological sex (demographic — not encrypted, MALE/FEMALE/OTHER)
    const biologicalSex = fd.biologicalSex as string | undefined;

    // Allergies: intake stores as drugAllergies enum ('naltrexone' | 'other' | 'none').
    // Translate to a human-readable label for the profile; only persist when meaningful.
    const drugAllergies = fd.drugAllergies as string | undefined;
    let allergiesForProfile: string | null = null;
    if (drugAllergies && drugAllergies !== 'none') {
      allergiesForProfile = humanizeValue(drugAllergies);
    }

    // Map DSM-5 safety screening fields to medical history booleans
    // DSM-5 format uses: liverCondition, pregnancyStatus, medicalHistory (array), etc.
    // AUDIT-C format uses: isPregnant, hasSeizureHistory, hasLiverDisease, etc.
    const liverCondition = fd.liverCondition as string | undefined;
    const pregnancyStatus = fd.pregnancyStatus as string | undefined;
    const medicalHistoryArray = fd.medicalHistory as string[] | undefined;
    // Persist human-readable labels (e.g., "Depression / Anxiety") instead of raw
    // intake keys (e.g., "depression-anxiety") so the profile and physician chips
    // render cleanly without per-component mapping.
    const medicalHistoryLabels = Array.isArray(medicalHistoryArray)
      ? medicalHistoryArray.map((k) => humanizeValue(k)).filter((s) => s.length > 0)
      : undefined;
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
        ...(medicalHistoryLabels && medicalHistoryLabels.length > 0
          ? { medicalHistoryItems: medicalHistoryLabels }
          : {}),
        ...(fd.withdrawalSeizure !== undefined ? { withdrawalSeizure: fd.withdrawalSeizure } : {}),
        ...(fd.withdrawalDTs !== undefined ? { withdrawalDTs: fd.withdrawalDTs } : {}),
        ...(fd.withdrawalHospitalized !== undefined ? { withdrawalHospitalized: fd.withdrawalHospitalized } : {}),
        ...(fd.morningDrinking !== undefined ? { morningDrinking: fd.morningDrinking } : {}),
        ...(opioidUse.length > 0 ? { opioidUse } : {}),
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
    if (biologicalSex) profileUpdate.biologicalSex = biologicalSex;
    if (allergiesForProfile) profileUpdate.allergies = allergiesForProfile;

    // Update patient profile with form data
    // Note: PHI fields (firstName, lastName, phone, etc.) are auto-encrypted
    // by the Prisma encryption extension -- do NOT manually encrypt them here.
    await prisma.patientProfile.update({
      where: { userId },
      data: profileUpdate,
    });

    // Save pharmacy from intake to patient profile (preferredPharmacyId)
    const pharmacyName = fd.pharmacyName as string | undefined;
    const pharmacyZip = fd.pharmacyZip as string | undefined;
    if (pharmacyName && pharmacyZip) {
      try {
        const pharmacy = await prisma.pharmacy.findFirst({
          where: {
            name: { equals: pharmacyName.trim(), mode: 'insensitive' },
            zipCode: pharmacyZip.trim().slice(0, 5),
          },
          select: { id: true },
        });
        if (pharmacy) {
          await prisma.patientProfile.update({
            where: { userId },
            data: { preferredPharmacyId: pharmacy.id },
          });
        } else {
          const newPharmacy = await prisma.pharmacy.create({
            data: {
              // ncpdpId is required+unique. Patient-supplied pharmacies are unverified,
              // so stamp a placeholder — admin can reconcile with a real NCPDP lookup later.
              ncpdpId: `TEMP-${randomUUID()}`,
              name: pharmacyName.trim(),
              zipCode: pharmacyZip.trim(),
              address: (fd.pharmacyAddress as string) || '',
              city: (fd.pharmacyCity as string) || '',
              state: (fd.pharmacyState as string) || 'CA',
              phone: (fd.pharmacyPhone as string) || '',
            },
          });
          await prisma.patientProfile.update({
            where: { userId },
            data: { preferredPharmacyId: newPharmacy.id },
          });
        }
      } catch (pharmacyError) {
        // Pharmacy save failure should not block intake submission
        console.error('Failed to save pharmacy to profile:', pharmacyError instanceof Error ? pharmacyError.message : 'Unknown error');
      }
    }

    // Create an INTAKE_FORM document record so the intake appears in the Documents tab.
    // This is a "virtual" document (no S3 file) that references the intake by ID.
    // Pin to America/Los_Angeles so the date in the fileName matches what the
    // CA-only patient sees in their browser — without the timeZone option this
    // formats in the server's UTC and shifts a day for late-evening submissions.
    const submittedDate = (updatedIntake.submittedAt
      ? new Date(updatedIntake.submittedAt)
      : new Date()
    ).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/Los_Angeles',
    });
    try {
      await prisma.document.create({
        data: {
          patientId: userId,
          documentType: DocumentType.INTAKE_FORM,
          fileName: `Intake Form — Submitted ${submittedDate}`,
          fileSize: 0,
          mimeType: 'application/json',
          s3Key: null,
          s3Bucket: null,
          status: DocumentStatus.ACTIVE,
          intakeId: intakeId,
        },
      });
    } catch (docError) {
      // Document creation failure should not block the intake submission
      console.error('Failed to create intake form document record:', docError instanceof Error ? docError.message : 'Unknown error');
    }

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
      ...(warnings.length > 0 && { warnings }),
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
