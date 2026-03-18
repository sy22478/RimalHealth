/**
 * POST /api/patient/prescriptions/[id]/refill
 * Request prescription refill
 * 
 * HIPAA Compliance:
 * - Verifies patient owns the prescription
 * - Validates refill eligibility
 * - Logs refill request
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { NotificationService } from '@/lib/services/notification-service';
import { Role } from '@prisma/client';
import { PHIResourceType } from '@/lib/audit/index';
import { createRefillRequest } from '@/lib/patient/prescriptions';

// ============================================================================
// POST - Request Refill
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // Require patient role
  const auth = await requireRole(request, [Role.PATIENT]);
  
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const { id: prescriptionId } = await params;
  const auditContext = AuditService.createAuditContext(request, userId, 'PATIENT');

  try {
    // Validate UUID
    const uuidValidation = ValidationService.validateUUID(prescriptionId);
    if (!uuidValidation.success) {
      return NextResponse.json(
        { error: 'Invalid prescription ID', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Get prescription
    const prescription = await prisma.prescription.findFirst({
      where: {
        id: prescriptionId,
        patientId: userId,
      },
    });

    if (!prescription) {
      return NextResponse.json(
        { error: 'Prescription not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get patient name for notification
    const profile = await prisma.patientProfile.findUnique({
      where: { userId },
      select: { firstName: true, lastName: true },
    });

    const patientName = profile 
      ? `${profile.firstName} ${profile.lastName}`
      : 'Unknown Patient';

    // Create refill request
    const result = await createRefillRequest(
      prescriptionId,
      userId,
      patientName
    );

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error || 'Refill request failed', 
          code: result.errorCode || 'REFILL_FAILED' 
        },
        { status: 400 }
      );
    }

    // Log refill request
    await AuditService.logPHIAccess(
      'CREATE',
      userId,
      'PATIENT',
      PHIResourceType.PRESCRIPTION,
      result.refillRequest?.id || prescriptionId,
      auditContext,
      { prescriptionId }
    );

    // Notify physicians (in a real implementation, this would notify specific physician)
    // For now, we log the intent
    console.log(`[Refill] Notifying physicians of refill request for ${prescriptionId}`);

    return NextResponse.json({
      success: true,
      refillRequest: result.refillRequest,
      message: 'Refill request submitted successfully',
    });
  } catch (error) {
    console.error('Refill request error:', error);
    
    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      `/api/patient/prescriptions/${prescriptionId}/refill`,
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to request refill', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
