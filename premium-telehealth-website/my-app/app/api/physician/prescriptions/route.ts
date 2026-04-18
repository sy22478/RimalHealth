/**
 * GET /api/physician/prescriptions
 * List prescriptions for physician dashboard and prescriptions page
 *
 * HIPAA Compliance:
 * - Requires PHYSICIAN or ADMIN role
 * - Logs PHI access for prescription list viewing
 * - Returns decrypted patient names via Prisma encryption extension
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { Role } from '@prisma/client';
import { PHIResourceType } from '@/lib/audit/index';

// ============================================================================
// GET - List Prescriptions
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
    // Parse optional query params
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 50, 100) : 50;

    // Fetch recent prescriptions with patient information
    const prescriptions = await prisma.prescription.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        intake: {
          select: {
            patient: {
              select: {
                id: true,
                patientProfile: {
                  select: {
                    firstName: true,
                    lastName: true,
                    addressZip: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    // Log PHI access
    await AuditService.logPHIAccess(
      'VIEW',
      userId,
      auth.user.role,
      PHIResourceType.PRESCRIPTION,
      'list',
      auditContext,
      { recordCount: prescriptions.length }
    );

    // Format prescriptions for the dashboard
    const formattedPrescriptions = prescriptions.map((rx) => {
      const firstName = rx.intake?.patient?.patientProfile?.firstName || '';
      const lastName = rx.intake?.patient?.patientProfile?.lastName || '';
      const patientName =
        firstName || lastName
          ? `${firstName} ${lastName}`.trim()
          : 'Unknown Patient';

      return {
        id: rx.id,
        patientId: rx.patientId,
        patientName,
        // Patient ZIP — used to prefill the Set Pharmacy dialog so search
        // starts near the patient instead of a hardcoded fallback.
        patientZip: rx.intake?.patient?.patientProfile?.addressZip ?? null,
        medicationName: rx.medicationName,
        genericName: rx.genericName,
        dosage: rx.dosage,
        quantity: rx.quantity,
        refillsRemaining: rx.refillsRemaining,
        status: rx.status,
        prescribedAt: rx.createdAt.toISOString(),
        sentAt: rx.sentAt?.toISOString() ?? null,
        pharmacyName: rx.pharmacyName,
        pharmacyAddress: rx.pharmacyAddress,
      };
    });

    return NextResponse.json({
      prescriptions: formattedPrescriptions,
      total: formattedPrescriptions.length,
    });
  } catch (error) {
    console.error(
      'List prescriptions error:',
      error instanceof Error ? error.message : 'Unknown error'
    );

    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/physician/prescriptions',
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to retrieve prescriptions', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
