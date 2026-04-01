/**
 * GET /api/physician/profile
 * Fetch authenticated physician's profile
 *
 * HIPAA Compliance:
 * - Requires PHYSICIAN or ADMIN role
 * - Audit logging for all profile access
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { Role } from '@prisma/client';
import { PHIResourceType } from '@/lib/audit/index';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
  if (auth instanceof NextResponse) return auth;

  const { userId } = auth.user;
  const auditContext = AuditService.createAuditContext(request, userId, auth.user.role);

  try {
    const physician = await prisma.physician.findUnique({
      where: { userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        npiNumber: true,
        licenseNumber: true,
        licenseState: true,
        deaNumber: true,
        specialty: true,
        isActive: true,
        maxDailyReviews: true,
        status: true,
        totalReviews: true,
        createdAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!physician) {
      return NextResponse.json(
        { error: 'Physician profile not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Log PHI access (NPI, DEA, license numbers)
    await AuditService.logPHIAccess(
      'VIEW',
      userId,
      auth.user.role,
      PHIResourceType.PATIENT_PROFILE,
      physician.id,
      auditContext,
      { accessReason: 'View own physician profile' }
    );

    // Destructure to exclude nested `user` object from response
    const { user, ...physicianData } = physician;
    return NextResponse.json({
      success: true,
      physician: {
        ...physicianData,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Physician profile fetch error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to fetch profile', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
