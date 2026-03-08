/**
 * GET /api/physician/patients
 * List all patients with pagination and search
 * 
 * HIPAA Compliance:
 * - Requires PHYSICIAN or ADMIN role
 * - Logs patient list access
 * - Returns decrypted firstName, lastName, email for physicians
 * - Search works on decrypted PHI fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { patientsQuerySchema } from '@/lib/validation/schemas';
import { Role } from '@prisma/client';
import { PHIResourceType } from '@/lib/audit';
import { decryptPHI } from '@/lib/encryption/phi';

// ============================================================================
// GET - List Patients
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
    // Validate query params
    const validation = await ValidationService.validateQueryParams(
      request,
      patientsQuerySchema
    );

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const { search, limit = 20, offset = 0 } = validation.data!;

    // Get patients with their user data - ordered by last name ascending
    const patients = await prisma.$queryRaw<Array<{
      user_id: string;
      first_name: string;
      last_name: string;
      email: string;
      date_of_birth: string;
      primary_concern: string | null;
      treatment_goal: string | null;
      created_at: Date;
    }>>`
      SELECT 
        pp.user_id,
        pp.first_name,
        pp.last_name,
        u.email,
        pp.date_of_birth,
        pp.primary_concern,
        pp.treatment_goal,
        pp.created_at
      FROM patient_profiles pp
      JOIN users u ON u.id = pp.user_id
      ${search ? `
        WHERE pp.first_name ILIKE ${`%${search}%`} 
        OR pp.last_name ILIKE ${`%${search}%`}
        OR u.email ILIKE ${`%${search}%`}
      ` : ''}
      ORDER BY pp.last_name ASC, pp.first_name ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Log access
    await AuditService.logPHIAccess(
      'VIEW',
      userId,
      auth.user.role,
      PHIResourceType.PATIENT_PROFILE,
      'list',
      auditContext,
      { recordCount: patients.length, search: search || null }
    );

    // Decrypt and format patient data
    const formattedPatients = patients.map((patient) => ({
      id: patient.user_id,
      firstName: decryptPHI(patient.first_name),
      lastName: decryptPHI(patient.last_name),
      email: patient.email,
      dateOfBirth: decryptPHI(patient.date_of_birth),
      primaryConcern: patient.primary_concern,
      treatmentGoal: patient.treatment_goal,
      createdAt: patient.created_at.toISOString(),
    }));

    // Get total count for pagination
    const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM patient_profiles pp
      JOIN users u ON u.id = pp.user_id
      ${search ? `
        WHERE pp.first_name ILIKE ${`%${search}%`} 
        OR pp.last_name ILIKE ${`%${search}%`}
        OR u.email ILIKE ${`%${search}%`}
      ` : ''}
    `;
    const total = Number(countResult[0].count);

    return NextResponse.json({
      patients: formattedPatients,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + patients.length < total,
      },
    });
  } catch (error) {
    console.error('List patients error:', error);
    
    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/physician/patients',
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to list patients', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
