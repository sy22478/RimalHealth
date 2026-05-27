/**
 * GET /api/physician/stats
 * Get physician dashboard statistics
 * 
 * HIPAA Compliance:
 * - Requires PHYSICIAN or ADMIN role
 * - Returns aggregated statistics (no individual PHI)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { statsQuerySchema } from '@/lib/validation/schemas';
import { Role, IntakeStatus, RefillStatus, CheckInStatus } from '@prisma/client';
import { PHIResourceType } from '@/lib/audit/index';
import { getStepsReadyForReview } from '@/lib/titration/service';

// ============================================================================
// GET - Get Stats
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
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
    // Validate query params
    const validation = await ValidationService.validateQueryParams(
      request,
      statsQuerySchema
    );

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const { period } = validation.data!;

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

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // Get queue stats
    const [
      pendingIntakes,
      overdueIntakes,
      reviewsCompleted,
      pendingRefills,
      prescriptionsSent,
      newPatients,
      messagesUnread,
    ] = await Promise.all([
      // Pending intakes
      prisma.intake.count({
        where: {
          status: {
            in: [IntakeStatus.SUBMITTED, IntakeStatus.UNDER_REVIEW],
          },
        },
      }),

      // Overdue intakes (> 24 hours)
      prisma.intake.count({
        where: {
          status: {
            in: [IntakeStatus.SUBMITTED, IntakeStatus.UNDER_REVIEW],
          },
          submittedAt: {
            lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Reviews completed in period
      prisma.review.count({
        where: {
          physicianId,
          completedAt: {
            gte: startDate,
          },
        },
      }),

      // Pending refill requests
      prisma.refillRequest.count({
        where: {
          status: RefillStatus.PENDING,
        },
      }),

      // Prescriptions sent in period
      prisma.prescription.count({
        where: {
          sentAt: {
            gte: startDate,
          },
        },
      }),

      // New patients in period (exclude deactivated)
      prisma.patientProfile.count({
        where: {
          createdAt: {
            gte: startDate,
          },
          user: {
            deactivatedAt: null,
          },
        },
      }),

      // Unread messages for this physician
      prisma.message.count({
        where: {
          recipientId: userId,
          readAt: null,
        },
      }),
    ]);

    // Get review stats and approval rate in parallel
    const [reviewStats, reviewDecisions] = await Promise.all([
      prisma.review.aggregate({
        where: {
          physicianId,
          completedAt: { gte: startDate },
          reviewDurationSec: { not: null },
        },
        _avg: { reviewDurationSec: true },
        _count: { id: true },
      }),
      prisma.review.groupBy({
        by: ['decision'],
        where: {
          physicianId,
          completedAt: { gte: startDate },
        },
        _count: { id: true },
      }),
    ]);

    const totalDecisions = reviewDecisions.reduce((sum, r) => sum + (r._count?.id ?? 0), 0);
    const approvedCount =
      reviewDecisions.find((r) => r.decision === 'APPROVE')?._count?.id ?? 0;
    const approvalRate = totalDecisions > 0 ? Math.round((approvedCount / totalDecisions) * 100) : 0;

    // Calculate average wait time
    const pendingIntakeDates = await prisma.intake.findMany({
      where: {
        status: {
          in: [IntakeStatus.SUBMITTED, IntakeStatus.UNDER_REVIEW],
        },
      },
      select: {
        submittedAt: true,
      },
    });

    const avgWaitHours =
      pendingIntakeDates.length > 0
        ? pendingIntakeDates.reduce((sum, i) => {
            const hours = i.submittedAt
              ? (Date.now() - new Date(i.submittedAt).getTime()) / (1000 * 60 * 60)
              : 0;
            return sum + hours;
          }, 0) / pendingIntakeDates.length
        : 0;

    // GLP-1 monitoring stats (Phase 4): check-ins awaiting review, GLP-1 refills
    // pending review, and titration steps eligible for a physician-approved advance.
    const [checkInsAwaitingReview, refillsPendingReview, stepsReady] = await Promise.all([
      prisma.checkIn.count({
        where: { status: CheckInStatus.SUBMITTED, deletedAt: null },
      }),
      prisma.refillRequest.count({
        where: {
          status: RefillStatus.PENDING,
          prescription: { product: { concernType: 'WEIGHT_MANAGEMENT' } },
        },
      }),
      getStepsReadyForReview(now).then((r) => r.length),
    ]);

    // Log access
    await AuditService.logPHIAccess(
      'VIEW',
      userId,
      auth.user.role,
      PHIResourceType.PATIENT_PROFILE,
      'stats',
      auditContext,
      { period }
    );

    return NextResponse.json({
      stats: {
        pendingReviews: pendingIntakes,
        patientsToday: newPatients,
        unreadMessages: messagesUnread,
        prescriptionsThisMonth: prescriptionsSent,
        overdueReviews: overdueIntakes,
        averageReviewTime: Math.round(avgWaitHours * 10) / 10,
      },
      period,
      detail: {
        reviewsCompleted,
        averageReviewMinutes: reviewStats._avg.reviewDurationSec
          ? Math.round(reviewStats._avg.reviewDurationSec / 60)
          : 0,
        approvalRate: Math.round(approvalRate),
        pendingRefills,
      },
      // GLP-1 weight-management monitoring queue (Phase 4)
      monitoring: {
        checkInsAwaitingReview,
        refillsPendingReview,
        titrationStepsReady: stepsReady,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error instanceof Error ? error.message : 'Unknown error');
    
    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/physician/stats',
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to retrieve statistics', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
