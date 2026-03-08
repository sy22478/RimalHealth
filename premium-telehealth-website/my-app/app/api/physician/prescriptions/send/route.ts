/**
 * POST /api/physician/prescriptions/send
 * Send prescription to pharmacy (DoseSpot integration)
 * 
 * HIPAA Compliance:
 * - Requires PHYSICIAN role
 * - Logs prescription sending
 * - Notifies patient
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { NotificationService } from '@/lib/services/notification-service';
import { sendPrescriptionSchema } from '@/lib/validation/schemas';
import { Role, PrescriptionStatus } from '@prisma/client';
// import { sendPrescription as sendToDoseSpot } from '@/lib/integrations/dosespot';

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

    const { prescriptionId, pharmacyId, pharmacyNcpdpId } = validation.data!;

    // Get prescription
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
          error: 'Prescription cannot be sent',
          code: 'PRESCRIPTION_NOT_SENDABLE',
          status: prescription.status,
        },
        { status: 409 }
      );
    }

    // Get pharmacy details
    let pharmacyName = 'Unknown Pharmacy';
    if (pharmacyId) {
      const pharmacy = await prisma.pharmacy.findUnique({
        where: { id: pharmacyId },
      });
      if (pharmacy) {
        pharmacyName = pharmacy.name;
      }
    }

    // TODO: Integrate with DoseSpot for e-prescribing
    // For now, simulate sending
    const sendResult: { success: boolean; mock?: boolean } = { success: true, mock: true };
    // try {
    //   sendResult = await sendToDoseSpot({
    //     patientId: prescription.patientId,
    //     pharmacyId: pharmacyId || 'PENDING',
    //     medication: prescription.medicationName,
    //     genericName: prescription.genericName,
    //     dosage: prescription.dosage,
    //     quantity: prescription.quantity,
    //     refills: prescription.refills,
    //     instructions: prescription.instructions || '',
    //   });
    // } catch (dosespotError) {
    //   console.error('DoseSpot error:', dosespotError);
    //   // In development, continue without actual sending
    //   if (process.env.NODE_ENV !== 'development') {
    //     throw dosespotError;
    //   }
    //   sendResult = { success: true, mock: true };
    // }

    // Update prescription status
    const updatedPrescription = await prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        status: PrescriptionStatus.SENT,
        sentAt: new Date(),
        pharmacyId: pharmacyId || undefined,
        pharmacyName,
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

    // Notify patient
    await NotificationService.notifyPrescriptionSent(
      prescription.patientId,
      prescriptionId,
      pharmacyName
    );

    return NextResponse.json({
      success: true,
      prescription: {
        id: updatedPrescription.id,
        status: updatedPrescription.status,
        sentAt: updatedPrescription.sentAt?.toISOString(),
        pharmacyName: updatedPrescription.pharmacyName,
      },
      _mock: 'mock' in sendResult ? sendResult.mock : false,
    });
  } catch (error) {
    console.error('Send prescription error:', error);
    
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
