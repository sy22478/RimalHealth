/**
 * GET /api/physician/colleagues
 * Returns list of other physicians for physician-to-physician messaging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { Role } from '@prisma/client';
import { PHIResourceType } from '@/lib/audit/index';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);

  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const auditContext = AuditService.createAuditContext(request, userId, auth.user.role);

  try {
    const physicians = await prisma.physician.findMany({
      where: {
        status: 'ACTIVE',
        userId: { not: userId },
      },
      select: {
        userId: true,
        firstName: true,
        lastName: true,
        specialty: true,
      },
    });

    // Log access
    await AuditService.logPHIAccess(
      'VIEW',
      userId,
      auth.user.role,
      PHIResourceType.PATIENT_PROFILE,
      'colleagues-list',
      auditContext,
      { accessReason: 'View colleague list for messaging' }
    );

    return NextResponse.json({
      physicians: physicians.map((p) => ({
        id: p.userId,
        name: `Dr. ${p.firstName} ${p.lastName}`,
        specialty: p.specialty,
      })),
    });
  } catch (error) {
    console.error('Error fetching colleagues:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to fetch colleagues' },
      { status: 500 }
    );
  }
}
