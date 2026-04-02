/**
 * GET /api/patient/prescriptions
 * List patient's prescriptions with intake status context
 *
 * HIPAA Compliance:
 * - Returns only own prescriptions
 * - Logs prescription access
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { Role } from '@prisma/client';
import { getPatientPrescriptions } from '@/lib/patient/prescriptions';

// ============================================================================
// GET - List Prescriptions
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Require patient role
  const auth = await requireRole(request, [Role.PATIENT]);

  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const auditContext = AuditService.createAuditContext(request, userId, 'PATIENT');

  try {
    // Get prescriptions and intake status in parallel
    const [prescriptions, intake] = await Promise.all([
      getPatientPrescriptions(userId),
      prisma.intake.findFirst({
        where: { patientId: userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          submittedAt: true,
        },
      }),
    ]);

    // Log access
    await AuditService.logPrescriptionAccess(
      userId,
      'PATIENT',
      'list',
      'VIEW',
      auditContext
    );

    return NextResponse.json({
      prescriptions,
      intakeStatus: intake?.status ?? null,
      intakeSubmittedAt: intake?.submittedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('List prescriptions error:', error instanceof Error ? error.message : 'Unknown error');

    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/patient/prescriptions',
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to list prescriptions', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
