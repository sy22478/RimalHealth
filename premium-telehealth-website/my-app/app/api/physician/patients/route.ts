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
import { PHIResourceType } from '@/lib/audit/index';

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

    // Build where clause using Prisma's type-safe query builder (no raw SQL)
    const whereClause = search
      ? {
          OR: [
            { firstName: { contains: search } },
            { lastName: { contains: search } },
            { user: { email: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : {};

    // Get patients with their user data - ordered by last name ascending
    const [patients, total] = await Promise.all([
      prisma.patientProfile.findMany({
        where: whereClause,
        include: {
          user: {
            select: { email: true },
          },
        },
        orderBy: [
          { lastName: 'asc' },
          { firstName: 'asc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.patientProfile.count({ where: whereClause }),
    ]);

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
    // Note: The Prisma encryption extension handles decryption automatically
    // for fields registered in PHI_FIELDS. decryptPHI is used as a safety net
    // for raw query results, but with findMany the extension does the work.
    const formattedPatients = patients.map((patient) => ({
      id: patient.userId,
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: patient.user.email,
      dateOfBirth: patient.dateOfBirth,
      primaryConcern: patient.primaryConcern,
      treatmentGoal: patient.treatmentGoal,
      createdAt: patient.createdAt.toISOString(),
    }));

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
    console.error('List patients error:', error instanceof Error ? error.message : 'Unknown error');
    
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
