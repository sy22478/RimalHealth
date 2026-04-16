/**
 * POST /api/physician/prescriptions/send
 * Mark prescription as sent to pharmacy and notify the patient.
 *
 * The physician sends prescriptions manually through a separate app.
 * This route records the status change and notifies the patient.
 *
 * HIPAA Compliance:
 * - Requires PHYSICIAN role
 * - Logs prescription status change
 * - Notifies patient (no PHI in notification)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { NotificationService } from '@/lib/services/notification-service';
import { sendPrescriptionSchema } from '@/lib/validation/schemas';
import { Role, PrescriptionStatus } from '@prisma/client';

// ============================================================================
// POST - Send Prescription
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Require physician role
  const auth = await requireRole(request, [Role.PHYSICIAN]);

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
      sendPrescriptionSchema
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

    const { prescriptionId } = validation.data!;

    // Get prescription with patient info
    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        intake: {
          include: {
            patient: {
              include: {
                patientProfile: true,
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

    // Check if prescription can be sent
    if (prescription.status !== PrescriptionStatus.PENDING) {
      return NextResponse.json(
        {
          error: 'Prescription cannot be sent — only PENDING prescriptions can be sent',
          code: 'PRESCRIPTION_NOT_SENDABLE',
          status: prescription.status,
        },
        { status: 409 }
      );
    }

    // Use pharmacy info already on the prescription record
    const pharmacyName = prescription.pharmacyName || 'Unknown Pharmacy';

    // TODO: Re-enable when DoseSpot goes live — physician currently sends manually
    // The physician sends the prescription through their own e-prescribing app,
    // then clicks "Send" here to record the status change and notify the patient.

    // Update prescription status to SENT
    const updatedPrescription = await prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        status: PrescriptionStatus.SENT,
        sentAt: new Date(),
      },
    });

    // Log prescription sending
    await AuditService.logPrescriptionAccess(
      userId,
      auth.user.role,
      prescriptionId,
      'UPDATE',
      auditContext
    );

    // Notify patient — graceful degradation: don't fail if notification errors
    try {
      await NotificationService.notifyPrescriptionSent(
        prescription.patientId,
        prescriptionId,
        pharmacyName
      );
    } catch (notifyError) {
      console.error(
        'Failed to notify patient of prescription send:',
        notifyError instanceof Error ? notifyError.message : 'Unknown error'
      );
    }

    return NextResponse.json({
      success: true,
      prescription: {
        id: updatedPrescription.id,
        status: updatedPrescription.status,
        sentAt: updatedPrescription.sentAt?.toISOString(),
        medicationName: updatedPrescription.medicationName,
        pharmacyName: updatedPrescription.pharmacyName,
      },
    });
  } catch (error) {
    console.error('Send prescription error:', error instanceof Error ? error.message : 'Unknown error');

    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/physician/prescriptions/send',
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to send prescription', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
