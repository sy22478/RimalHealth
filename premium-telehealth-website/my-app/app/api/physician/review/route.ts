/**
 * POST /api/physician/review
 * Submit intake review decision
 * 
 * HIPAA Compliance:
 * - Requires PHYSICIAN or ADMIN role
 * - Logs review submission
 * - Creates prescription if approved
 * - Notifies patient of decision
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { NotificationService } from '@/lib/services/notification-service';
import { submitReviewSchema } from '@/lib/validation/schemas';
import { Role, IntakeStatus, ReviewDecision, PrescriptionStatus } from '@prisma/client';
import { DataModificationAction } from '@/lib/audit/index';
import { encryptPHI } from '@/lib/encryption/phi';

// ============================================================================
// POST - Submit Review
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Require physician or admin role
  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
  
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const auditContext = AuditService.createAuditContext(
    request,
    userId,
    auth.user.role
  );

  try {
    // Validate request body
    const validation = await ValidationService.validateRequestBody(
      request,
      submitReviewSchema
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

    const {
      intakeId,
      decision,
      notes,
      prescriptionDetails,
      rejectionReason,
      alternativeRecommendation,
    } = validation.data!;

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

    // Check if intake is under review
    if (intake.status !== IntakeStatus.UNDER_REVIEW && intake.status !== IntakeStatus.SUBMITTED) {
      return NextResponse.json(
        {
          error: 'Intake not available for review',
          code: 'INTAKE_NOT_AVAILABLE',
          status: intake.status,
        },
        { status: 409 }
      );
    }

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create review record
      const review = await tx.review.create({
        data: {
          intakeId,
          physicianId: userId,
          decision:
            decision === 'APPROVED'
              ? ReviewDecision.APPROVE
              : decision === 'DECLINED'
              ? ReviewDecision.REJECT
              : ReviewDecision.NEEDS_INFO,
          clinicalNotes: notes ? encryptPHI(notes) : null,
          rejectionReason: rejectionReason ? encryptPHI(rejectionReason) : null,
          alternativeRecommendation: alternativeRecommendation
            ? encryptPHI(alternativeRecommendation)
            : null,
          completedAt: new Date(),
        },
      });

      // Update intake status
      const newStatus =
        decision === 'APPROVED'
          ? IntakeStatus.APPROVED
          : decision === 'DECLINED'
          ? IntakeStatus.REJECTED
          : IntakeStatus.NEEDS_INFO;

      await tx.intake.update({
        where: { id: intakeId },
        data: { status: newStatus },
      });

      // Create prescription if approved
      let prescription = null;
      if (decision === 'APPROVED' && prescriptionDetails) {
        prescription = await tx.prescription.create({
          data: {
            intakeId,
            patientId: intake.patientId,
            medicationName: prescriptionDetails.medicationName,
            genericName: prescriptionDetails.genericName,
            dosage: prescriptionDetails.dosage,
            quantity: prescriptionDetails.quantity,
            refills: prescriptionDetails.refills,
            refillsRemaining: prescriptionDetails.refills,
            instructions: encryptPHI(prescriptionDetails.instructions),
            pharmacyName: 'Pending', // Will be updated when sent
            pharmacyNcpdpId: 'PENDING',
            status: PrescriptionStatus.PENDING,
          },
        });
      }

      return { review, prescription };
    });

    // Log review submission
    await AuditService.logDataModification(
      DataModificationAction.CREATE,
      userId,
      'Review',
      result.review.id,
      auditContext,
      ['decision', 'intakeId'],
      `Review submitted: ${decision}`
    );

    // Notify patient
    await NotificationService.notifyReviewComplete(
      intake.patientId,
      decision,
      notes
    );

    return NextResponse.json({
      success: true,
      review: {
        id: result.review.id,
        intakeId: result.review.intakeId,
        decision: decision,
        completedAt: result.review.completedAt?.toISOString(),
      },
      prescription: result.prescription
        ? {
            id: result.prescription.id,
            medicationName: result.prescription.medicationName,
            status: result.prescription.status,
          }
        : null,
    });
  } catch (error) {
    console.error('Submit review error:', error);
    
    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/physician/review',
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to submit review', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
