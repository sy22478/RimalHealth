/**
 * GET /api/patient/prescriptions
 * List patient's prescriptions
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
    // Get prescriptions
    const prescriptions = await getPatientPrescriptions(userId);

    // Log access
    await AuditService.logPrescriptionAccess(
      userId,
      'PATIENT',
      'list',
      'VIEW',
      auditContext
    );

    return NextResponse.json({ prescriptions });
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
