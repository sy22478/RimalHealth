/**
 * GET /api/physician/reviews
 * Get completed intake reviews (APPROVED, REJECTED, NEEDS_INFO)
 *
 * HIPAA Compliance:
 * - Requires PHYSICIAN or ADMIN role
 * - Logs PHI access for review history viewing
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { Role, IntakeStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
  if (auth instanceof NextResponse) return auth;

  const { userId } = auth.user;
  const auditContext = AuditService.createAuditContext(request, userId, auth.user.role);

  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    const completedStatuses = [IntakeStatus.APPROVED, IntakeStatus.REJECTED, IntakeStatus.NEEDS_INFO];

    const [intakes, total] = await Promise.all([
      prisma.intake.findMany({
        where: { status: { in: completedStatuses } },
        include: {
          patient: {
            include: { patientProfile: true },
          },
          review: {
            include: {
              physician: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.intake.count({
        where: { status: { in: completedStatuses } },
      }),
    ]);

    const reviews = intakes.map((intake) => {
      const profile = intake.patient?.patientProfile;
      const review = intake.review;
      const firstName = typeof profile?.firstName === 'string' ? profile.firstName : '';
      const lastName = typeof profile?.lastName === 'string' ? profile.lastName : '';
      const patientName = `${firstName} ${lastName}`.trim() || 'Unknown';

      return {
        intakeId: intake.id,
        patientId: intake.patientId,
        patientName,
        decision: intake.status,
        reviewedAt: review?.completedAt?.toISOString() || intake.updatedAt.toISOString(),
        clinicalNotes: review?.clinicalNotes
          ? (review.clinicalNotes as string).substring(0, 120) + ((review.clinicalNotes as string).length > 120 ? '...' : '')
          : null,
        physicianName: review?.physician
          ? `${review.physician.firstName} ${review.physician.lastName}`.trim()
          : null,
      };
    });

    await AuditService.logIntakeAccess(
      userId,
      auth.user.role,
      'review-history',
      'VIEW',
      auditContext,
    );

    return NextResponse.json({
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get completed reviews error:', error instanceof Error ? error.message : 'Unknown error');

    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/physician/reviews',
      auditContext,
      userId,
    );

    return NextResponse.json(
      { error: 'Failed to retrieve review history', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
