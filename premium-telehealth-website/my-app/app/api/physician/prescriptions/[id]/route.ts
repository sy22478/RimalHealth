/**
 * GET/PUT /api/physician/prescriptions/[id]
 * Get or update a single prescription
 *
 * HIPAA Compliance:
 * - Requires PHYSICIAN or ADMIN role
 * - Logs all status changes via AuditService
 * - Notifies patient on status transitions
 * - No PHI in notification emails
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { enforceRateLimit, rateLimitPresets } from '@/lib/middleware/rate-limit';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { NotificationService } from '@/lib/services/notification-service';
import { Role, PrescriptionStatus } from '@prisma/client';
import { DataModificationAction, PHIResourceType } from '@/lib/audit/index';
import { z } from 'zod';

// ============================================================================
// Valid Status Transitions
// ============================================================================

const VALID_TRANSITIONS: Record<PrescriptionStatus, PrescriptionStatus[]> = {
  PENDING: [PrescriptionStatus.SENT, PrescriptionStatus.CANCELLED],
  SENT: [PrescriptionStatus.RECEIVED_BY_PHARMACY, PrescriptionStatus.ACTIVE, PrescriptionStatus.CANCELLED],
  RECEIVED_BY_PHARMACY: [PrescriptionStatus.FILLED, PrescriptionStatus.ACTIVE, PrescriptionStatus.CANCELLED, PrescriptionStatus.DENIED],
  FILLED: [PrescriptionStatus.READY_FOR_PICKUP, PrescriptionStatus.ACTIVE, PrescriptionStatus.CANCELLED],
  READY_FOR_PICKUP: [PrescriptionStatus.PICKED_UP, PrescriptionStatus.ACTIVE, PrescriptionStatus.CANCELLED],
  PICKED_UP: [PrescriptionStatus.ACTIVE, PrescriptionStatus.COMPLETED],
  ACTIVE: [PrescriptionStatus.COMPLETED, PrescriptionStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
  DENIED: [],
  EXPIRED: [],
};

// ============================================================================
// Validation Schema
// ============================================================================

const updateStatusSchema = z.object({
  status: z.nativeEnum(PrescriptionStatus),
  pharmacyName: z.string().min(1).optional(),
  pharmacyAddress: z.string().optional(),
  pharmacyCity: z.string().optional(),
  pharmacyState: z.string().optional(),
  pharmacyNcpdpId: z.string().optional(),
  pharmacyPhone: z.string().optional(),
});

// ============================================================================
// GET - Single Prescription
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const limited = await enforceRateLimit(request, rateLimitPresets.api);
  if (limited) return limited;

  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
  if (auth instanceof NextResponse) return auth;

  const { userId } = auth.user;
  const { id } = await params;
  const auditContext = AuditService.createAuditContext(request, userId, auth.user.role);

  try {
    const prescription = await prisma.prescription.findUnique({
      where: { id, deletedAt: null },
      include: {
        intake: {
          select: {
            patient: {
              select: {
                id: true,
                patientProfile: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
    });

    if (!prescription) {
      return NextResponse.json(
        { error: 'Prescription not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    await AuditService.logPHIAccess(
      'VIEW',
      userId,
      auth.user.role,
      PHIResourceType.PRESCRIPTION,
      prescription.id,
      auditContext,
      {}
    );

    const firstName = prescription.intake?.patient?.patientProfile?.firstName || '';
    const lastName = prescription.intake?.patient?.patientProfile?.lastName || '';

    return NextResponse.json({
      prescription: {
        id: prescription.id,
        patientId: prescription.patientId,
        patientName: `${firstName} ${lastName}`.trim() || 'Unknown Patient',
        medicationName: prescription.medicationName,
        genericName: prescription.genericName,
        dosage: prescription.dosage,
        quantity: prescription.quantity,
        refills: prescription.refills,
        refillsRemaining: prescription.refillsRemaining,
        status: prescription.status,
        pharmacyName: prescription.pharmacyName,
        pharmacyAddress: prescription.pharmacyAddress,
        pharmacyPhone: prescription.pharmacyPhone,
        pharmacyNcpdpId: prescription.pharmacyNcpdpId,
        sentAt: prescription.sentAt?.toISOString() ?? null,
        createdAt: prescription.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get prescription error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to get prescription', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Update Prescription Status
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const limited = await enforceRateLimit(request, rateLimitPresets.api);
  if (limited) return limited;

  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
  if (auth instanceof NextResponse) return auth;

  const { userId } = auth.user;
  const { id } = await params;
  const auditContext = AuditService.createAuditContext(request, userId, auth.user.role);

  try {
    const body = await request.json();
    const parsed = updateStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { status: newStatus, pharmacyName, pharmacyAddress, pharmacyCity, pharmacyState, pharmacyNcpdpId, pharmacyPhone } = parsed.data;

    // Fetch current prescription
    const prescription = await prisma.prescription.findUnique({
      where: { id, deletedAt: null },
    });

    if (!prescription) {
      return NextResponse.json(
        { error: 'Prescription not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Validate transition. Same-status is treated as a pharmacy-info-only update
    // (used when setting/updating the pharmacy on a PENDING prescription).
    if (newStatus !== prescription.status) {
      const allowed = VALID_TRANSITIONS[prescription.status];
      if (!allowed || !allowed.includes(newStatus)) {
        return NextResponse.json(
          {
            error: `Cannot transition from ${prescription.status} to ${newStatus}`,
            code: 'INVALID_TRANSITION',
            currentStatus: prescription.status,
            allowedTransitions: allowed,
          },
          { status: 409 }
        );
      }
    }

    // If marking as SENT, pharmacy info is required
    if (newStatus === PrescriptionStatus.SENT && prescription.pharmacyName === 'Pending' && !pharmacyName) {
      return NextResponse.json(
        { error: 'Pharmacy information is required before sending', code: 'PHARMACY_REQUIRED' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      status: newStatus,
    };

    // Set sentAt when transitioning to SENT
    if (newStatus === PrescriptionStatus.SENT) {
      updateData.sentAt = new Date();
    }

    // Update pharmacy info if provided
    if (pharmacyName) {
      updateData.pharmacyName = pharmacyName;
    }
    if (pharmacyAddress) {
      const fullAddress = pharmacyCity
        ? `${pharmacyAddress}, ${pharmacyCity}, ${pharmacyState || 'CA'}`
        : pharmacyAddress;
      updateData.pharmacyAddress = fullAddress;
    }
    if (pharmacyNcpdpId) {
      updateData.pharmacyNcpdpId = pharmacyNcpdpId;
    }
    if (pharmacyPhone) {
      updateData.pharmacyPhone = pharmacyPhone;
    }

    // Perform update
    const updated = await prisma.prescription.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await AuditService.logDataModification(
      DataModificationAction.UPDATE,
      userId,
      'Prescription',
      id,
      auditContext,
      ['status', ...(pharmacyName ? ['pharmacyName'] : [])],
      `Status changed: ${prescription.status} -> ${newStatus}`
    );

    // Notify patient on SENT
    if (newStatus === PrescriptionStatus.SENT) {
      const finalPharmacyName = pharmacyName || prescription.pharmacyName;
      await NotificationService.notifyPrescriptionSent(
        prescription.patientId,
        prescription.id,
        finalPharmacyName
      );
    }

    return NextResponse.json({
      success: true,
      prescription: {
        id: updated.id,
        status: updated.status,
        pharmacyName: updated.pharmacyName,
        sentAt: updated.sentAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error('Update prescription error:', error instanceof Error ? error.message : 'Unknown error');

    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      `/api/physician/prescriptions/${id}`,
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to update prescription', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
