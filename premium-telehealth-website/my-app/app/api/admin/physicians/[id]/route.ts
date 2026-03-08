/**
 * GET /api/admin/physicians/:id
 * Get single physician with all details
 * 
 * HIPAA Compliance:
 * - Requires ADMIN role
 * - Logs all access
 * - Returns full physician profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { Role } from '@prisma/client';
import { PHIResourceType } from '@/lib/audit';

// ============================================================================
// GET - Get Single Physician
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // Require ADMIN role
  const auth = await requireRole(request, [Role.ADMIN]);

  if (auth instanceof NextResponse) {
    return auth;
  }

  const { user } = auth;
  const auditContext = AuditService.createAuditContext(
    request,
    user.userId,
    user.role
  );

  try {
    const { id } = await params;

    // Fetch physician with all related data
    const physician = await prisma.physician.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
            lastLoginAt: true,
            tokenVersion: true,
          },
        },
        reviews: {
          select: {
            id: true,
            intakeId: true,
            assignedAt: true,
            startedAt: true,
            completedAt: true,
            decision: true,
          },
          orderBy: { assignedAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            reviews: true,
            notes: true,
            messages: true,
          },
        },
      },
    });

    if (!physician) {
      await AuditService.logUnauthorizedAccess(
        user.userId,
        `/api/admin/physicians/${id}`,
        auditContext,
        'Physician not found'
      );

      return NextResponse.json(
        {
          error: 'Physician not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Fetch authorization history
    const authorizationHistory = await prisma.physicianAuthorizationLog.findMany({
      where: { physicianId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Calculate stats
    const completedReviews = physician.reviews.filter((r) => r.completedAt).length;
    const avgReviewTime = physician.reviews
      .filter((r) => r.startedAt && r.completedAt)
      .map((r) => {
        if (r.startedAt && r.completedAt) {
          return (r.completedAt.getTime() - r.startedAt.getTime()) / 60000; // minutes
        }
        return 0;
      });

    const avgReviewTimeMin = avgReviewTime.length > 0
      ? Math.round(avgReviewTime.reduce((a, b) => a + b, 0) / avgReviewTime.length)
      : null;

    // Format response
    const response = {
      id: physician.id,
      userId: physician.userId,
      user: {
        id: physician.user.id,
        email: physician.user.email,
        emailVerified: physician.user.emailVerified,
        createdAt: physician.user.createdAt.toISOString(),
        updatedAt: physician.user.updatedAt.toISOString(),
        lastLoginAt: physician.user.lastLoginAt?.toISOString() || null,
        tokenVersion: physician.user.tokenVersion,
      },
      credentials: {
        npiNumber: physician.npiNumber,
        licenseNumber: physician.licenseNumber,
        licenseState: physician.licenseState,
        deaNumber: physician.deaNumber,
      },
      profile: {
        firstName: physician.firstName,
        lastName: physician.lastName,
        specialty: physician.specialty,
      },
      status: {
        current: physician.status,
        authorizedBy: physician.authorizedBy,
        authorizedAt: physician.authorizedAt?.toISOString() || null,
        secretKeyExpiry: physician.secretKeyExpiry?.toISOString() || null,
        secretKeyUsedAt: physician.secretKeyUsedAt?.toISOString() || null,
      },
      settings: {
        isActive: physician.isActive,
        maxDailyReviews: physician.maxDailyReviews,
      },
      stats: {
        totalReviews: physician._count.reviews,
        completedReviews,
        avgReviewTimeMin,
        noteCount: physician._count.notes,
        messageCount: physician._count.messages,
      },
      recentReviews: physician.reviews.map((review) => ({
        id: review.id,
        intakeId: review.intakeId,
        assignedAt: review.assignedAt.toISOString(),
        startedAt: review.startedAt?.toISOString() || null,
        completedAt: review.completedAt?.toISOString() || null,
        decision: review.decision,
      })),
      authorizationHistory: authorizationHistory.map((log) => ({
        id: log.id,
        action: log.action,
        adminId: log.adminId,
        reason: log.reason,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
      })),
      createdAt: physician.createdAt.toISOString(),
      updatedAt: physician.updatedAt.toISOString(),
    };

    // Log access
    await AuditService.logPHIAccess(
      'VIEW',
      user.userId,
      user.role,
      PHIResourceType.PHYSICIAN_NOTE,
      id,
      auditContext
    );

    return NextResponse.json({ physician: response });
  } catch (error) {
    console.error('Get physician error:', error);

    const { id } = await params;

    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      `/api/admin/physicians/${id}`,
      auditContext,
      user.userId
    );

    return NextResponse.json(
      {
        error: 'Failed to get physician',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
