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
import { enforceRateLimit, rateLimitPresets } from '@/lib/middleware/rate-limit';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { NotificationService } from '@/lib/services/notification-service';
import { submitReviewSchema } from '@/lib/validation/schemas';
import { Role, IntakeStatus, ReviewDecision, PrescriptionStatus, SubscriptionStatus } from '@prisma/client';
import { DataModificationAction } from '@/lib/audit/index';
import { getStripe } from '@/lib/stripe/stripe-server';

// ============================================================================
// POST - Submit Review
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const limited = await enforceRateLimit(request, rateLimitPresets.api);
  if (limited) return limited;

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

    // Look up the physician record (Review FK references Physician.id, not User.id)
    const physician = await prisma.physician.findFirst({
      where: { userId },
      select: { id: true },
    });

    if (!physician) {
      return NextResponse.json(
        { error: 'Physician profile not found', code: 'PHYSICIAN_NOT_FOUND' },
        { status: 404 }
      );
    }

    const physicianId = physician.id;

    // Get intake with patient's preferred pharmacy
    const intake = await prisma.intake.findUnique({
      where: { id: intakeId },
      include: {
        patient: {
          include: {
            patientProfile: {
              include: {
                preferredPharmacy: true,
              },
            },
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
          physicianId,
          decision:
            decision === 'APPROVED'
              ? ReviewDecision.APPROVE
              : decision === 'DECLINED'
              ? ReviewDecision.REJECT
              : ReviewDecision.NEEDS_INFO,
          clinicalNotes: notes || null,
          rejectionReason: rejectionReason || null,
          alternativeRecommendation: alternativeRecommendation || null,
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
        const pharmacy = intake.patient?.patientProfile?.preferredPharmacy;
        prescription = await tx.prescription.create({
          data: {
            intakeId,
            patientId: intake.patientId,
            pharmacyId: pharmacy?.id || undefined,
            medicationName: prescriptionDetails.medicationName,
            genericName: prescriptionDetails.genericName,
            dosage: prescriptionDetails.dosage,
            quantity: prescriptionDetails.quantity,
            refills: prescriptionDetails.refills,
            refillsRemaining: prescriptionDetails.refills,
            instructions: prescriptionDetails.instructions || 'As directed by physician',
            pharmacyName: pharmacy?.name || 'Pending',
            pharmacyNcpdpId: pharmacy?.ncpdpId || 'PENDING',
            pharmacyPhone: pharmacy?.phone || null,
            pharmacyAddress: pharmacy ? `${pharmacy.address}, ${pharmacy.city}, ${pharmacy.state} ${pharmacy.zipCode}` : null,
            status: PrescriptionStatus.PENDING,
          },
        });
      }

      return { review, prescription };
    });

    // Activate or cancel the patient's Stripe subscription based on decision
    try {
      const subscription = await prisma.subscription.findFirst({
        where: { userId: intake.patientId },
        orderBy: { createdAt: 'desc' },
      });

      if (subscription?.stripeSubscriptionId) {
        const stripe = getStripe();
        if (decision === 'APPROVED' && subscription.status === SubscriptionStatus.TRIALING) {
          // End trial immediately — first charge happens now
          await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            trial_end: 'now',
          });
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: SubscriptionStatus.ACTIVE },
          });
        } else if (decision === 'DECLINED') {
          // Cancel subscription — no charge
          await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
          });
        }
      }
    } catch (stripeError) {
      // Log but don't fail the review — subscription can be fixed manually
      console.error('Subscription update error:', stripeError instanceof Error ? stripeError.message : 'Unknown error');
    }

    // Schedule account deactivation for rejected patients
    if (decision === 'DECLINED') {
      try {
        await prisma.user.update({
          where: { id: intake.patientId },
          data: {
            deactivateAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          },
        });
      } catch (deactivateError) {
        console.error('[Review] Failed to set deactivateAt:', deactivateError instanceof Error ? deactivateError.message : 'Unknown error');
      }
    }

    // Log review submission
    await AuditService.logDataModification(
      DataModificationAction.CREATE,
      userId,
      'Review',
      result.review.id,
      auditContext,
      ['decision', 'intakeId', 'clinicalNotes', 'rejectionReason', 'alternativeRecommendation', 'instructions'],
      `Review submitted: ${decision}`
    );

    // Notify patient
    await NotificationService.notifyReviewComplete(
      intake.patientId,
      decision
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
    console.error('Submit review error:', error instanceof Error ? error.message : 'Unknown error');
    
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
