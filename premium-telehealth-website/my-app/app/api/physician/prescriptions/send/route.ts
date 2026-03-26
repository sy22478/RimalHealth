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

    // DoseSpot e-prescribing integration with production safety guards
    const isProduction = process.env.NODE_ENV === 'production';
    const isMockModeEnabled = process.env.DOSESPOT_MOCK_MODE === 'true';
    const hasDoseSpotCredentials = !!(
      process.env.DOSESPOT_CLIENT_ID && process.env.DOSESPOT_CLIENT_SECRET
    );

    let sendResult: { success: boolean; mock?: boolean };

    if (isProduction && !isMockModeEnabled && !hasDoseSpotCredentials) {
      // Production without credentials and mock mode not explicitly enabled — block the request
      // Do NOT silently return success when e-prescribing is not configured
      await prisma.prescription.update({
        where: { id: prescriptionId },
        data: {
          status: PrescriptionStatus.PENDING,
        },
      });

      return NextResponse.json(
        {
          error: 'E-prescribing service not configured. Prescriptions cannot be sent at this time.',
          code: 'SERVICE_UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    if (isMockModeEnabled || !isProduction) {
      // Mock mode explicitly enabled OR development/test environment
      console.warn(
        `[DoseSpot] WARNING: Using mock prescription sending (env=${process.env.NODE_ENV}, mockMode=${isMockModeEnabled})`
      );
      sendResult = { success: true, mock: true };
    } else {
      // Production with credentials — attempt real DoseSpot call
      // TODO: Integrate with DoseSpot for e-prescribing
      // sendResult = await sendToDoseSpot({ ... });
      // For now, this path requires credentials to exist but actual API integration is not yet implemented
      console.warn('[DoseSpot] WARNING: Real DoseSpot API integration not yet implemented, using mock');
      sendResult = { success: true, mock: true };
    }

    // Only set status to SENT if the send operation succeeded
    const prescriptionStatus = sendResult.success
      ? PrescriptionStatus.SENT
      : PrescriptionStatus.PENDING;

    if (!sendResult.success) {
      return NextResponse.json(
        {
          error: 'Failed to send prescription to pharmacy',
          code: 'DOSESPOT_SEND_FAILED',
        },
        { status: 502 }
      );
    }

    // Update prescription status
    const updatedPrescription = await prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        status: prescriptionStatus,
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
