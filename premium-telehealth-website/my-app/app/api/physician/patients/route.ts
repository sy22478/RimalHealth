/**
 * GET /api/physician/patients
 * List all patients with pagination and search
 *
 * HIPAA Compliance:
 * - Requires PHYSICIAN or ADMIN role
 * - Logs patient list access
 * - Returns decrypted firstName, lastName, email for physicians
 * - Search works on email (firstName/lastName are encrypted and not searchable at SQL level)
 *
 * Base entity is User (role=PATIENT) so that patients with prescriptions or
 * intakes but no fully-populated PatientProfile still appear in the list.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { patientsQuerySchema } from '@/lib/validation/schemas';
import { Role, PrescriptionStatus, Prisma } from '@prisma/client';
import { PHIResourceType } from '@/lib/audit/index';

// ============================================================================
// GET - List Patients
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
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

    // Query from User (role=PATIENT) so that users without a full PatientProfile
    // still show up (they can still have intakes/prescriptions). firstName/lastName
    // are encrypted so only email is searchable at the SQL level.
    const whereClause: Prisma.UserWhereInput = {
      role: Role.PATIENT,
      ...(search
        ? { email: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        include: {
          patientProfile: true,
          intakes: {
            select: {
              id: true,
              status: true,
              submittedAt: true,
            },
            orderBy: { submittedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    // Aggregate counts scoped to the current page only
    const patientUserIds = users.map((u) => u.id);
    const [intakeStatusCounts, prescriptionCounts, unreadMessageCounts] = await Promise.all([
      prisma.intake.groupBy({
        by: ['status'],
        where: { patientId: { in: patientUserIds } },
        _count: true,
      }),
      prisma.prescription.groupBy({
        by: ['patientId'],
        where: {
          patientId: { in: patientUserIds },
          status: { in: [PrescriptionStatus.PENDING, PrescriptionStatus.SENT] },
        },
        _count: true,
      }),
      prisma.message.groupBy({
        by: ['senderId'],
        where: {
          senderId: { in: patientUserIds },
          senderType: 'PATIENT',
          readAt: null,
        },
        _count: true,
      }),
    ]);

    const rxCountMap = new Map(prescriptionCounts.map((r) => [r.patientId, r._count]));
    const unreadMap = new Map(unreadMessageCounts.map((m) => [m.senderId, m._count]));

    await AuditService.logPHIAccess(
      'VIEW',
      userId,
      auth.user.role,
      PHIResourceType.PATIENT_PROFILE,
      'list',
      auditContext,
      { recordCount: users.length, search: search || null }
    );

    const formattedPatients = users.map((user) => {
      const profile = user.patientProfile;
      const latestIntake = user.intakes?.[0];

      let status = 'ACTIVE';
      if (latestIntake) {
        switch (latestIntake.status) {
          case 'SUBMITTED':
          case 'UNDER_REVIEW':
          case 'NEEDS_INFO':
          case 'DRAFT':
            status = 'PENDING';
            break;
          case 'APPROVED':
          case 'REJECTED':
            status = 'COMPLETED';
            break;
          default:
            status = 'ACTIVE';
        }
      }

      return {
        id: user.id,
        firstName: profile?.firstName ?? '',
        lastName: profile?.lastName ?? '',
        email: user.email,
        dateOfBirth: profile?.dateOfBirth ?? null,
        primaryConcern: profile?.primaryConcern ?? null,
        treatmentGoal: profile?.treatmentGoal ?? null,
        biologicalSex: profile?.biologicalSex ?? null,
        createdAt: user.createdAt.toISOString(),
        status,
        intakeStatus: latestIntake?.status || null,
        isDeactivated: !!user.deactivatedAt,
        hasProfile: !!profile,
        activePrescriptions: rxCountMap.get(user.id) || 0,
        unreadMessages: unreadMap.get(user.id) || 0,
      };
    });

    const statusCountMap: Record<string, number> = {};
    for (const entry of intakeStatusCounts) {
      statusCountMap[entry.status] = entry._count;
    }

    return NextResponse.json({
      patients: formattedPatients,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + users.length < total,
      },
      counts: {
        total,
        pending: (statusCountMap['SUBMITTED'] || 0) + (statusCountMap['UNDER_REVIEW'] || 0) + (statusCountMap['NEEDS_INFO'] || 0),
        completed: (statusCountMap['APPROVED'] || 0) + (statusCountMap['REJECTED'] || 0),
        approved: statusCountMap['APPROVED'] || 0,
        rejected: statusCountMap['REJECTED'] || 0,
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
