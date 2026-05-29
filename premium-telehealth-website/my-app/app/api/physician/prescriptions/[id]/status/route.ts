/**
 * GET /api/physician/prescriptions/[id]/status
 * Check prescription status from DoseSpot/Surescripts
 * 
 * HIPAA Compliance:
 * - Returns status only, no PHI
 * - Physician must have permission to view prescription
 * - Audit logged with prescription ID only
 * 
 * Response:
 * - status: Current prescription status
 * - history: Timeline of status changes
 * - estimatedReadyTime: When prescription will be ready (if available)
 * 
 * @module app/api/physician/prescriptions/[id]/status
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requirePermission } from '@/lib/auth/require-auth';
import { enforceRateLimit, rateLimitPresets } from '@/lib/middleware/rate-limit';
import { Permission } from '@/lib/auth/rbac';
import { checkPrescriptionStatus } from '@/lib/integrations/dosespot';
import { auditLogger, PHIResourceType, AuditEventType } from '@/lib/audit/index';
import { getClientIp, getUserAgent } from '@/lib/auth/require-auth';
import { PrescriptionStatus } from '@prisma/client';

// ============================================
// PATH PARAMETER SCHEMA
// ============================================

const paramsSchema = z.object({
  id: z.string().uuid('Invalid prescription ID'),
});

type Params = z.infer<typeof paramsSchema>;

// ============================================
// STATUS MAPPING
// ============================================

/**
 * Map DoseSpot status to our internal status
 */
function mapDoseSpotStatus(doseSpotStatus: string): PrescriptionStatus {
  const statusMap: Record<string, PrescriptionStatus> = {
    'PENDING': PrescriptionStatus.PENDING,
    'SENT': PrescriptionStatus.SENT,
    'RECEIVED_BY_PHARMACY': PrescriptionStatus.RECEIVED_BY_PHARMACY,
    'FILLED': PrescriptionStatus.FILLED,
    'READY_FOR_PICKUP': PrescriptionStatus.READY_FOR_PICKUP,
    'PICKED_UP': PrescriptionStatus.PICKED_UP,
    'CANCELLED': PrescriptionStatus.CANCELLED,
    'EXPIRED': PrescriptionStatus.EXPIRED,
    'ERROR': PrescriptionStatus.CANCELLED,
    'REJECTED': PrescriptionStatus.CANCELLED,
  };

  return statusMap[doseSpotStatus] || PrescriptionStatus.PENDING;
}

// ============================================
// GET HANDLER
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const limited = await enforceRateLimit(request, rateLimitPresets.api);
  if (limited) return limited;

  // Check authentication and permission
  const authResult = await requirePermission(request, Permission.VIEW_PATIENT_DETAILS);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  try {
    // Validate path parameters
    const pathParams = await params;
    const paramsValidation = paramsSchema.safeParse(pathParams);

    if (!paramsValidation.success) {
      return NextResponse.json(
        {
          error: 'Invalid prescription ID',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const { id: prescriptionId } = paramsValidation.data;

    // Get prescription from database
    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        intake: {
          select: {
            id: true,
            patientId: true,
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

    // Log prescription view (status check)
    await auditLogger.logPHIAccess(
      'VIEW',
      user.userId,
      user.role,
      PHIResourceType.PRESCRIPTION,
      prescriptionId,
      {
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        requestId: crypto.randomUUID(),
      },
      {
        accessReason: 'Prescription status check',
        consentVerified: true,
      }
    );

    // If no Surescripts Rx ID, return local status only
    if (!prescription.surescriptsRxId) {
      return NextResponse.json({
        success: true,
        prescriptionId,
        status: prescription.status,
        localStatus: true,
        createdAt: prescription.createdAt.toISOString(),
        sentAt: prescription.sentAt?.toISOString() || null,
      });
    }

    // Check status from DoseSpot
    const statusResult = await checkPrescriptionStatus(prescription.surescriptsRxId);

    if (!statusResult.success) {
      // Log the error
      await auditLogger.log({
        eventType: AuditEventType.PRESCRIPTION_VIEWED,
        userId: user.userId,
        userRole: user.role,
        action: 'Prescription status check failed',
        resourceType: 'Prescription',
        resourceId: prescriptionId,
        ipAddress: getClientIp(request),
        userAgent: getUserAgent(request),
        success: false,
        errorMessage: statusResult.error,
        metadata: {
          surescriptsRxId: prescription.surescriptsRxId,
          errorCode: statusResult.errorCode,
        },
      });

      // Return local status if DoseSpot check fails
      return NextResponse.json({
        success: false,
        error: statusResult.error || 'Failed to check prescription status',
        code: statusResult.errorCode || 'STATUS_ERROR',
        prescriptionId,
        status: prescription.status,
        localStatus: true,
      }, { status: 502 });
    }

    // Map DoseSpot status to our status
    const mappedStatus = mapDoseSpotStatus(statusResult.status);

    // Update prescription status if changed
    if (mappedStatus !== prescription.status) {
      await prisma.prescription.update({
        where: { id: prescriptionId },
        data: { status: mappedStatus },
      });
    }

    // Log successful status check
    await auditLogger.log({
      eventType: AuditEventType.PRESCRIPTION_VIEWED,
      userId: user.userId,
      userRole: user.role,
      action: 'Prescription status checked',
      resourceType: 'Prescription',
      resourceId: prescriptionId,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      success: true,
      metadata: {
        surescriptsRxId: prescription.surescriptsRxId,
        previousStatus: prescription.status,
        currentStatus: mappedStatus,
        dosepotStatus: statusResult.status,
      },
    });

    return NextResponse.json({
      success: true,
      prescriptionId,
      status: mappedStatus,
      surescriptsRxId: prescription.surescriptsRxId,
      history: statusResult.statusHistory || [],
      estimatedReadyTime: statusResult.estimatedReadyTime || null,
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Prescription status check error:', error instanceof Error ? error.message : 'Unknown error');

    // Log the error
    await auditLogger.log({
      eventType: AuditEventType.PRESCRIPTION_VIEWED,
      userId: user.userId,
      userRole: user.role,
      action: 'Prescription status check error',
      resourceType: 'Prescription',
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        error: 'Failed to check prescription status',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
