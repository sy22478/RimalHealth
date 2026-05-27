/**
 * POST /api/patient/intake/[id]/submit-glp1
 * Submit a GLP-1 weight-management intake for physician review.
 *
 * Design: this is a SEPARATE route from the AUD submit handler
 * (`../submit/route.ts`) rather than a branch inside it. Rationale — it keeps
 * the AUD path completely untouched (Phase-2 requirement) and avoids a single
 * ~1000-line route with two divergent validation/scoring paths. Shared
 * concerns (CA-only checks, Amazon Location verification, payment gate,
 * ownership, document record, physician notification, profile mirroring) are
 * adapted inline below.
 *
 * HIPAA: verifies ownership, never logs PHI, formData auto-encrypted by the
 * Prisma extension. Triage metadata (bmi, glp1Eligibility, requiresUrgentReview)
 * is written to dedicated non-PHI columns so the physician queue can sort/filter.
 */

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { NotificationService } from '@/lib/services/notification-service';
import { submitGlp1IntakeSchema, glp1IntakeFormDataSchema } from '@/lib/validation/glp1-schemas';
import { scoreGlp1Intake } from '@/lib/intake/glp1/scoring';
import { MEDICAL_CONDITIONS } from '@/lib/intake/glp1/clinical-config';
import { resolveProductId, WEIGHT_MANAGEMENT_SLUG } from '@/lib/products/product';
import type { Glp1FormData, Glp1Priority } from '@/lib/intake/glp1/types';
import { Role, IntakeStatus, DocumentType, DocumentStatus, Prisma } from '@prisma/client';
import { DataModificationAction } from '@/lib/audit/index';
import { validateAddress } from '@/lib/integrations/location';

// Larger cap than AUD (50k): the GLP-1 form has 63 questions plus a dynamic
// medication list and several free-text fields.
const MAX_FORM_DATA_BYTES = 80000;

// Queue-ordering proxies derived from the GLP-1 triage priority. These populate
// the existing riskScore/complexityScore columns purely so the physician queue
// (which sorts by riskScore) surfaces urgent GLP-1 cases — they are NOT the
// AUD DSM-5 clinical scores. The authoritative GLP-1 triage lives in
// requiresUrgentReview / glp1Eligibility and formData._glp1DecisionSummary.
const PRIORITY_TO_RISK_SCORE: Record<Glp1Priority, number> = {
  CONTRAINDICATED: 95,
  URGENT: 80,
  ELEVATED: 50,
  ROUTINE: 15,
};

// value → human label for the medical-condition checklist (profile mirroring).
const CONDITION_LABELS: Record<string, string> = Object.fromEntries(
  MEDICAL_CONDITIONS.map((c) => [c.value, c.label])
);

function computeAge(dobStr: string): number | null {
  const dateOnly = dobStr.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const parsed = new Date(dobStr);
    if (Number.isNaN(parsed.getTime())) return null;
    return computeAge(parsed.toISOString());
  }
  const [y, m, d] = dateOnly.split('-').map(Number);
  const dob = new Date(y, m - 1, d);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) return auth;

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

    // Validate request body shape
    const validation = await ValidationService.validateRequestBody(
      request,
      submitGlp1IntakeSchema
    );
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', details: validation.errors },
        { status: 400 }
      );
    }

    const { formData } = validation.data!;

    // Payload size guard
    const formDataStr = JSON.stringify(formData);
    if (formDataStr.length > MAX_FORM_DATA_BYTES) {
      return NextResponse.json(
        { error: 'Form data exceeds maximum allowed size', code: 'PAYLOAD_TOO_LARGE' },
        { status: 400 }
      );
    }

    // Server-side structural validation of the GLP-1 answer set
    const fd_raw = formData as Record<string, unknown>;
    const glp1Validation = glp1IntakeFormDataSchema.safeParse(fd_raw);
    if (!glp1Validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid intake form data',
          code: 'FORM_DATA_VALIDATION_ERROR',
          details: glp1Validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Age 18+
    if (fd_raw.dateOfBirth && typeof fd_raw.dateOfBirth === 'string') {
      const age = computeAge(fd_raw.dateOfBirth);
      if (age !== null && age < 18) {
        return NextResponse.json(
          { error: 'You must be at least 18 years old to use this service', code: 'AGE_REQUIREMENT' },
          { status: 400 }
        );
      }
    }

    // California-only patient address (state + ZIP)
    const addressState = fd_raw.addressState as string | undefined;
    if (addressState && addressState.toUpperCase() !== 'CA') {
      return NextResponse.json(
        { error: 'Service is only available to California residents', code: 'CA_ONLY' },
        { status: 400 }
      );
    }
    if (fd_raw.addressZip && typeof fd_raw.addressZip === 'string') {
      const zip = parseInt(fd_raw.addressZip.substring(0, 5), 10);
      if (Number.isNaN(zip) || zip < 90001 || zip > 96162) {
        return NextResponse.json(
          { error: 'Patient address must be in California (ZIP 90001-96162)', code: 'CA_ONLY' },
          { status: 400 }
        );
      }
    }

    // California-only pharmacy (state + ZIP), when provided
    const pharmacyState = fd_raw.pharmacyState as string | undefined;
    if (pharmacyState && pharmacyState.toUpperCase() !== 'CA') {
      return NextResponse.json(
        { error: 'Pharmacy must be in California', code: 'CA_ONLY' },
        { status: 400 }
      );
    }
    if (fd_raw.pharmacyZip && typeof fd_raw.pharmacyZip === 'string') {
      const zip = parseInt(fd_raw.pharmacyZip.substring(0, 5), 10);
      if (Number.isNaN(zip) || zip < 90001 || zip > 96162) {
        return NextResponse.json(
          { error: 'Pharmacy ZIP code must be a valid California ZIP code (90001-96162)', code: 'CA_ONLY' },
          { status: 400 }
        );
      }
    }

    // Amazon Location address verification (graceful degradation — never blocks
    // on service failure, only on a confirmed invalid/mismatched CA address)
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
      } catch (addrError) {
        console.error('Address validation service unavailable:', addrError instanceof Error ? addrError.message : 'Unknown error');
      }
    }

    // Pharmacy address verification (warn-only)
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

    // Load intake
    const intake = await prisma.intake.findUnique({
      where: { id: intakeId },
      include: { patient: { include: { patientProfile: true } } },
    });
    if (!intake) {
      return NextResponse.json({ error: 'Intake not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // Ownership
    if (intake.patientId !== userId) {
      await AuditService.logUnauthorizedAccess(
        userId,
        `/api/patient/intake/${intakeId}/submit-glp1`,
        auditContext,
        'Patient does not own this intake'
      );
      return NextResponse.json({ error: 'Access denied', code: 'ACCESS_DENIED' }, { status: 403 });
    }

    // Only DRAFT intakes may be submitted
    if (intake.status !== IntakeStatus.DRAFT) {
      return NextResponse.json(
        { error: 'Intake already submitted', code: 'INTAKE_ALREADY_SUBMITTED' },
        { status: 409 }
      );
    }

    // Guard against submitting a non-GLP-1 intake through this endpoint.
    // Only enforced when both ids are known (null productId on un-migrated DBs
    // stays behavior-neutral).
    const glp1ProductId = await resolveProductId(WEIGHT_MANAGEMENT_SLUG);
    if (intake.productId && glp1ProductId && intake.productId !== glp1ProductId) {
      return NextResponse.json(
        { error: 'This intake is not a weight-management intake', code: 'WRONG_PRODUCT' },
        { status: 400 }
      );
    }

    // Payment gate (payment-first flow; TRIALING is valid)
    const requirePayment = process.env.NODE_ENV === 'production' || process.env.REQUIRE_PAYMENT === 'true';
    if (requirePayment && intake.paymentStatus !== 'COMPLETED') {
      const subscription = await prisma.subscription.findFirst({
        where: { userId, status: { in: ['ACTIVE', 'TRIALING'] } },
        select: { id: true },
      });
      if (subscription) {
        await prisma.intake.update({ where: { id: intakeId }, data: { paymentStatus: 'COMPLETED' } });
      } else {
        return NextResponse.json(
          { error: 'Payment required before submission', code: 'PAYMENT_REQUIRED' },
          { status: 402 }
        );
      }
    }

    // Score the intake (typed via the validated GLP-1 form data)
    const fd = glp1Validation.data as unknown as Glp1FormData;
    const result = scoreGlp1Intake(fd);

    // Enrich formData with the provider decision summary (mirrors AUD pattern)
    const enrichedFormData = {
      ...fd_raw,
      bmi: result.bmi,
      _glp1DecisionSummary: {
        bmi: result.bmi,
        eligibilityBand: result.eligibilityBand,
        contraindicationFlags: result.contraindicationFlags,
        emergencyFlags: result.emergencyFlags,
        phq2Score: result.phq2Score,
        drugInteractionFlags: result.drugInteractionFlags,
        priority: result.priority,
        requiresUrgentReview: result.requiresUrgentReview,
      },
    };

    // Persist the submission. formData auto-encrypted by the Prisma extension.
    const updatedIntake = await prisma.intake.update({
      where: { id: intakeId },
      data: {
        status: IntakeStatus.SUBMITTED,
        formData: enrichedFormData as Prisma.InputJsonValue,
        submittedAt: new Date(),
        // Triage metadata (non-PHI) for the physician queue
        bmi: result.bmi,
        glp1Eligibility: result.eligibilityBand,
        requiresUrgentReview: result.requiresUrgentReview,
        // Queue-ordering proxies (see PRIORITY_TO_RISK_SCORE note above)
        riskScore: PRIORITY_TO_RISK_SCORE[result.priority],
        complexityScore: Math.min(
          100,
          (result.contraindicationFlags.length + result.drugInteractionFlags.length) * 15
        ),
      },
    });

    // Mirror a subset of data to the patient profile (non-blocking: a mirroring
    // failure must not fail the submission — the full record is in formData).
    try {
      const conditionLabels = Array.isArray(fd.medicalConditions)
        ? fd.medicalConditions.map((v) => CONDITION_LABELS[v] ?? v).filter((s) => s && s !== 'None of the above')
        : [];

      const medsSummary = Array.isArray(fd.medicationList)
        ? fd.medicationList
            .filter((m) => m && m.name)
            .map((m) => [m.name, m.dosage, m.frequency].filter(Boolean).join(' '))
            .join('\n')
        : '';

      const profileUpdate: Record<string, unknown> = {
        primaryConcern: 'WEIGHT_MANAGEMENT',
        medicalHistory: {
          conditions: conditionLabels,
          otherConditions: fd.medicalConditionsOther || '',
          recentHospitalization: fd.recentHospitalization ?? false,
          bmi: result.bmi,
          highestAdultWeightLbs: fd.highestAdultWeightLbs ?? null,
          goalWeightLbs: fd.goalWeightLbs ?? null,
          diabetesType: fd.diabetesType ?? null,
          glp1Eligibility: result.eligibilityBand,
        } as Prisma.InputJsonValue,
        currentMedications: {
          takingMedications: fd.currentlyTakingMedications ?? false,
          medicationList: medsSummary,
        } as Prisma.InputJsonValue,
        privacyConsentGiven: true,
        privacyConsentDate: new Date(),
        termsAccepted: true,
        termsAcceptedDate: new Date(),
      };

      if (fd.firstName) profileUpdate.firstName = fd.firstName;
      if (fd.lastName) profileUpdate.lastName = fd.lastName;
      if (fd.phone) profileUpdate.phone = fd.phone;
      if (fd.dateOfBirth) profileUpdate.dateOfBirth = fd.dateOfBirth;
      if (fd.addressStreet) profileUpdate.addressStreet = fd.addressStreet;
      if (fd.addressCity) profileUpdate.addressCity = fd.addressCity;
      if (fd.addressStreet || fd.addressCity || fd.addressZip) profileUpdate.addressState = 'CA';
      if (fd.addressZip) profileUpdate.addressZip = fd.addressZip;
      if (fd.biologicalSex) profileUpdate.biologicalSex = fd.biologicalSex;
      if (fd.hasDrugAllergies && fd.drugAllergiesList) profileUpdate.allergies = fd.drugAllergiesList;

      await prisma.patientProfile.update({ where: { userId }, data: profileUpdate });
    } catch (profileError) {
      console.error('Failed to mirror GLP-1 intake to profile:', profileError instanceof Error ? profileError.message : 'Unknown error');
    }

    // Save pharmacy to profile (non-blocking)
    const pharmacyName = fd.pharmacyName;
    const pharmacyZip = fd.pharmacyZip;
    if (pharmacyName && pharmacyZip) {
      try {
        const pharmacy = await prisma.pharmacy.findFirst({
          where: {
            name: { equals: pharmacyName.trim(), mode: 'insensitive' },
            zipCode: pharmacyZip.trim().slice(0, 5),
          },
          select: { id: true },
        });
        const pharmacyId = pharmacy
          ? pharmacy.id
          : (
              await prisma.pharmacy.create({
                data: {
                  ncpdpId: `TEMP-${randomUUID()}`,
                  name: pharmacyName.trim(),
                  zipCode: pharmacyZip.trim(),
                  address: fd.pharmacyAddress || '',
                  city: fd.pharmacyCity || '',
                  state: fd.pharmacyState || 'CA',
                  phone: fd.pharmacyPhone || '',
                },
              })
            ).id;
        await prisma.patientProfile.update({
          where: { userId },
          data: { preferredPharmacyId: pharmacyId },
        });
      } catch (pharmacyError) {
        console.error('Failed to save pharmacy to profile:', pharmacyError instanceof Error ? pharmacyError.message : 'Unknown error');
      }
    }

    // Virtual INTAKE_FORM document so the intake appears in the Documents tab
    const submittedDate = (updatedIntake.submittedAt ? new Date(updatedIntake.submittedAt) : new Date())
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' });
    try {
      await prisma.document.create({
        data: {
          patientId: userId,
          documentType: DocumentType.INTAKE_FORM,
          fileName: `Weight Management Intake — Submitted ${submittedDate}`,
          fileSize: 0,
          mimeType: 'application/json',
          s3Key: null,
          s3Bucket: null,
          status: DocumentStatus.ACTIVE,
          intakeId,
        },
      });
    } catch (docError) {
      console.error('Failed to create intake form document record:', docError instanceof Error ? docError.message : 'Unknown error');
    }

    // Audit log (no PHI)
    await AuditService.logDataModification(
      DataModificationAction.UPDATE,
      userId,
      'Intake',
      intakeId,
      auditContext,
      ['status', 'submittedAt', 'bmi', 'glp1Eligibility', 'requiresUrgentReview'],
      'GLP-1 intake submitted for review'
    );

    // Notify physicians
    await NotificationService.notifyPhysicianNewIntake(intakeId, 'WEIGHT_MANAGEMENT');

    return NextResponse.json({
      success: true,
      intake: {
        id: updatedIntake.id,
        status: updatedIntake.status,
        submittedAt: updatedIntake.submittedAt?.toISOString(),
        bmi: updatedIntake.bmi,
        glp1Eligibility: updatedIntake.glp1Eligibility,
        requiresUrgentReview: updatedIntake.requiresUrgentReview,
      },
      ...(warnings.length > 0 && { warnings }),
    });
  } catch (error) {
    console.error('Submit GLP-1 intake error:', error instanceof Error ? error.message : 'Unknown error');
    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      `/api/patient/intake/${intakeId}/submit-glp1`,
      auditContext,
      userId
    );
    return NextResponse.json(
      { error: 'Failed to submit intake', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
