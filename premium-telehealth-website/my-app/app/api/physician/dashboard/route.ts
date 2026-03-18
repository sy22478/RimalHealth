/**
 * GET /api/physician/dashboard
 * Get physician dashboard statistics
 * 
 * HIPAA Compliance:
 * - Requires PHYSICIAN or ADMIN role
 * - Returns aggregated statistics with minimal PHI
 * - Logs access for audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { Role, IntakeStatus } from '@prisma/client';
import { PHIResourceType } from '@/lib/audit/index';

// ============================================================================
// Types
// ============================================================================

interface RecentActivity {
  id: string;
  type: 'REVIEW' | 'MESSAGE' | 'NOTE';
  description: string;
  timestamp: Date;
  patientName?: string;
}

interface DashboardStats {
  pendingReviews: number;
  completedToday: number;
  unreadMessages: number;
  assignedToday: number;
  totalPatients: number;
  recentActivity: RecentActivity[];
}

// ============================================================================
// GET - Get Dashboard Stats
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
    // Calculate today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get physician record (needed for proper physicianId lookup)
    const physician = await prisma.physician.findFirst({
      where: { userId },
      select: { id: true },
    });

    const physicianId = physician?.id || userId;

    // Fetch all dashboard statistics in parallel
    const [
      pendingReviews,
      completedToday,
      unreadMessages,
      assignedToday,
      totalPatients,
      recentReviews,
      recentMessages,
      recentNotes,
    ] = await Promise.all([
      // Pending reviews (intakes waiting for review)
      prisma.intake.count({
        where: { status: IntakeStatus.SUBMITTED },
      }),

      // Reviews completed today by this physician
      prisma.review.count({
        where: {
          physicianId,
          completedAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),

      // Unread messages for this physician
      prisma.physicianMessage.count({
        where: {
          recipientId: userId,
          isRead: false,
        },
      }),

      // Intakes assigned to physician today
      prisma.review.count({
        where: {
          physicianId,
          assignedAt: {
            gte: today,
            lt: tomorrow,
          },
        },
      }),

      // Total unique patients reviewed by this physician
      prisma.review.groupBy({
        by: ['intakeId'],
        where: { physicianId },
        _count: { intakeId: true },
      }).then((results) => results.length),

      // Recent reviews activity (last 5)
      prisma.review.findMany({
        where: { physicianId },
        take: 5,
        orderBy: { completedAt: 'desc' },
        select: {
          id: true,
          completedAt: true,
          decision: true,
          intake: {
            select: {
              patient: {
                select: {
                  patientProfile: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),

      // Recent messages activity (last 5)
      prisma.physicianMessage.findMany({
        where: {
          OR: [{ senderId: userId }, { recipientId: userId }],
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          subject: true,
          senderId: true,
          isRead: true,
        },
      }),

      // Recent notes activity (last 5)
      prisma.physicianNote.findMany({
        where: { physicianId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true,
          patientId: true,
        },
      }),
    ]);

    // Build recent activity list
    const recentActivity: RecentActivity[] = [];

    // Add review activities
    recentReviews.forEach((review) => {
      if (review.completedAt) {
        const firstName = review.intake?.patient?.patientProfile?.firstName || '';
        const lastName = review.intake?.patient?.patientProfile?.lastName || '';
        const patientName = firstName || lastName 
          ? `${firstName} ${lastName}`.trim() 
          : undefined;

        recentActivity.push({
          id: review.id,
          type: 'REVIEW',
          description: `Completed review: ${review.decision || 'Pending'}`,
          timestamp: review.completedAt,
          patientName,
        });
      }
    });

    // Add message activities
    recentMessages.forEach((message) => {
      const isOutgoing = message.senderId === userId;
      recentActivity.push({
        id: message.id,
        type: 'MESSAGE',
        description: isOutgoing 
          ? `Sent message: ${message.subject || 'No subject'}`
          : `Received message: ${message.subject || 'No subject'}`,
        timestamp: message.createdAt,
      });
    });

    // Add note activities
    recentNotes.forEach((note) => {
      recentActivity.push({
        id: note.id,
        type: 'NOTE',
        description: 'Added patient note',
        timestamp: note.createdAt,
      });
    });

    // Sort all activities by timestamp (descending) and take top 10
    recentActivity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const limitedActivity = recentActivity.slice(0, 10);

    // Log PHI access for dashboard view
    await AuditService.logPHIAccess(
      'VIEW',
      userId,
      auth.user.role,
      PHIResourceType.PATIENT_PROFILE,
      'dashboard-stats',
      auditContext,
      { 
        pendingReviews,
        completedToday,
        unreadMessages,
        totalPatients,
      }
    );

    const stats: DashboardStats = {
      pendingReviews,
      completedToday,
      unreadMessages,
      assignedToday,
      totalPatients,
      recentActivity: limitedActivity,
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    
    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/physician/dashboard',
      auditContext,
      userId
    );

    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to retrieve dashboard statistics', 
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
