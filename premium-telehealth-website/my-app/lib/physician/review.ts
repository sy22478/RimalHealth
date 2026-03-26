/**
 * Physician Review Logic
 * Business logic for intake review workflow
 * 
 * HIPAA Compliance: All PHI access is logged
 * @module lib/physician/review
 */

import { IntakeStatus, ReviewDecision } from '@prisma/client';
import { IntakeFormData, IntakeScores, RiskAssessment } from '@/types/intake';
import { AuditEventType, PHIResourceType, AuditSeverity } from '@/lib/audit/types';
import { prisma } from '@/lib/db/prisma';
import { calculateIntakeScores, generateRiskAssessment, generateProviderDecisionSummary } from '@/lib/intake/scoring';

// Import types for internal use
import type {
  ReviewSubmission,
  MedicationSelection,
  IntakeWithPatient,
} from './review-types';

// Re-export types and constants that can be used on client
export {
  REJECTION_REASONS,
  MEDICATIONS,
  MEDICATION_OPTIONS,
  type ReviewSubmission,
  type MedicationSelection,
  type IntakeWithPatient,
  type MedicationOption,
  checkContraindications,
  getMedicationsForConcern,
} from './review-types';

// ============================================================================
// Server-only Types
// ============================================================================

export interface ReviewResult {
  success: boolean;
  reviewId?: string;
  intakeStatus?: IntakeStatus;
  error?: string;
  prescriptionId?: string;
}

// ============================================================================
// Review Logic
// ============================================================================

/**
 * Submit a physician review for an intake
 * 
 * @param submission - Review submission data
 * @param auditContext - Audit context for logging
 * @returns ReviewResult with success status and IDs
 */
export async function submitReview(
  submission: ReviewSubmission,
  auditContext: {
    ipAddress: string;
    userAgent: string;
    requestId: string;
  }
): Promise<ReviewResult> {
  const { intakeId, physicianId, decision, clinicalNotes } = submission;

  try {
    // Validate intake exists and is in correct status
    const intake = await prisma.intake.findUnique({
      where: { id: intakeId },
    });

    if (!intake) {
      return { success: false, error: 'Intake not found' };
    }

    if (intake.status !== IntakeStatus.SUBMITTED && intake.status !== IntakeStatus.UNDER_REVIEW) {
      return { success: false, error: 'Intake is not available for review' };
    }

    // Create review record
    const review = await prisma.review.create({
      data: {
        intakeId,
        physicianId,
        decision,
        clinicalNotes,
        prescribedMedication: submission.medication?.name,
        genericName: submission.medication?.genericName,
        dosage: submission.medication?.dosage,
        quantity: submission.medication?.quantity,
        refills: submission.medication?.refills,
        instructions: submission.medication?.instructions,
        rejectionReason: submission.rejectionReason,
        alternativeRecommendation: submission.alternativeRecommendation,
        completedAt: new Date(),
      },
    });

    // Update intake status based on decision
    let newStatus: IntakeStatus;
    switch (decision) {
      case ReviewDecision.APPROVE:
        newStatus = IntakeStatus.APPROVED;
        break;
      case ReviewDecision.REJECT:
        newStatus = IntakeStatus.REJECTED;
        break;
      case ReviewDecision.NEEDS_INFO:
        newStatus = IntakeStatus.NEEDS_INFO;
        break;
      default:
        newStatus = IntakeStatus.UNDER_REVIEW;
    }

    await prisma.intake.update({
      where: { id: intakeId },
      data: {
        status: newStatus,
      },
    });

    // Create prescription if approved
    let prescriptionId: string | undefined;
    if (decision === ReviewDecision.APPROVE && submission.medication) {
      const prescription = await prisma.prescription.create({
        data: {
          intakeId,
          patientId: intake.patientId,
          medicationName: submission.medication.name,
          genericName: submission.medication.genericName,
          dosage: submission.medication.dosage,
          quantity: submission.medication.quantity,
          refills: submission.medication.refills,
          refillsRemaining: submission.medication.refills,
          instructions: submission.medication.instructions,
          pharmacyName: 'Pending', // Will be set when e-prescribed
          pharmacyNcpdpId: 'PENDING',
          status: 'PENDING',
        },
      });
      prescriptionId = prescription.id;
    }

    // Log audit event
    await logReviewEvent(review.id, submission, auditContext);

    return {
      success: true,
      reviewId: review.id,
      intakeStatus: newStatus,
      prescriptionId,
    };
  } catch {
    console.error('Review submission error'); // Don't log PHI
    return { success: false, error: 'Failed to submit review' };
  }
}

/**
 * Get intake data for physician review
 * 
 * @param intakeId - Intake ID to retrieve
 * @param physicianId - ID of physician accessing (for audit)
 * @param auditContext - Audit context for logging
 * @returns Intake data with patient profile
 */
export async function getIntakeForReview(
  intakeId: string,
  physicianId: string,
  auditContext: {
    ipAddress: string;
    userAgent: string;
    requestId: string;
  }
): Promise<{ success: true; data: IntakeWithPatient } | { success: false; error: string }> {
  try {
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
      return { success: false, error: 'Intake not found' };
    }

    // Log PHI access
    await logIntakeAccess(intakeId, physicianId, auditContext);

    // Transform to expected format
    // Note: In production, decrypt PHI fields here
    const profile = intake.patient?.patientProfile;
    
    // Compute scores and risk assessment from formData
    const formDataRecord = intake.formData as Record<string, unknown> || {};
    const scores = calculateIntakeScores(formDataRecord);
    const riskAssessment = generateRiskAssessment(scores);
    const providerSummary = generateProviderDecisionSummary(formDataRecord);

    // Attach provider decision summary to formData for the review UI
    const enrichedFormData = {
      ...(intake.formData as Record<string, unknown>),
      _providerDecisionSummary: providerSummary,
    } as unknown as IntakeFormData;

    const data: IntakeWithPatient = {
      id: intake.id,
      patientId: intake.patientId,
      status: intake.status,
      formData: enrichedFormData,
      scores,
      riskAssessment,
      submittedAt: intake.submittedAt,
      createdAt: intake.createdAt,
      updatedAt: intake.updatedAt,
      patient: {
        id: intake.patientId,
        firstName: profile?.firstName || 'Unknown',
        lastName: profile?.lastName || 'Patient',
        dateOfBirth: profile?.dateOfBirth ? new Date(profile.dateOfBirth) : new Date(),
        email: intake.patient?.email || '',
        phone: profile?.phone || '',
        address: profile ? {
          street: profile.addressStreet || '',
          city: profile.addressCity || '',
          state: profile.addressState || '',
          zipCode: profile.addressZip || '',
        } : null,
      },
    };

    return { success: true, data };
  } catch {
    console.error('Get intake for review error');
    return { success: false, error: 'Failed to retrieve intake' };
  }
}

// ============================================================================
// Audit Logging
// ============================================================================

async function logReviewEvent(
  reviewId: string,
  submission: ReviewSubmission,
  auditContext: { ipAddress: string; userAgent: string; requestId: string }
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        eventType: AuditEventType.INTAKE_REVIEWED,
        severity: AuditSeverity.INFO,
        userId: submission.physicianId,
        targetUserId: submission.intakeId,
        resourceType: PHIResourceType.REVIEW,
        resourceId: reviewId,
        metadata: {
          decision: submission.decision,
          hasMedication: !!submission.medication,
          requestId: auditContext.requestId,
        },
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        success: true,
      },
    });
  } catch {
    // Audit logging failure should not break the workflow
    console.error('Audit log error');
  }
}

async function logIntakeAccess(
  intakeId: string,
  physicianId: string,
  auditContext: { ipAddress: string; userAgent: string; requestId: string }
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        eventType: AuditEventType.INTAKE_VIEWED,
        severity: AuditSeverity.INFO,
        userId: physicianId,
        targetUserId: intakeId,
        resourceType: PHIResourceType.INTAKE,
        resourceId: intakeId,
        metadata: {
          accessReason: 'Clinical review',
          requestId: auditContext.requestId,
        },
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        success: true,
      },
    });
  } catch {
    console.error('Audit log error');
  }
}

// ============================================================================
// Validation
// ============================================================================

export const reviewSubmissionSchema = {
  intakeId: { required: true },
  decision: { required: true, values: ['APPROVE', 'REJECT', 'NEEDS_INFO'] as const },
  clinicalNotes: { required: true, minLength: 10, maxLength: 5000 },
  medication: {
    required: (decision: string) => decision === 'APPROVE',
    fields: {
      name: { required: true },
      genericName: { required: true },
      dosage: { required: true },
      quantity: { required: true, min: 1, max: 180 },
      refills: { required: true, min: 0, max: 11 },
      instructions: { required: true, minLength: 10, maxLength: 1000 },
    },
  },
  rejectionReason: {
    required: (decision: string) => decision === 'REJECT',
    minLength: 10,
    maxLength: 2000,
  },
  requestedInfo: {
    required: (decision: string) => decision === 'NEEDS_INFO',
    minLength: 10,
    maxLength: 2000,
  },
};
