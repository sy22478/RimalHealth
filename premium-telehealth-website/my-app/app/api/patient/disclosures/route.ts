/**
 * Accounting of Disclosures API
 * 42 CFR Part 2 — Patients can view who accessed their PHI and why
 *
 * GET /api/patient/disclosures
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/require-auth';
import { AuditEventType } from '@/lib/audit';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { userId, role } = auth.user;
  if (role !== Role.PATIENT) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  try {
    // Query audit logs for disclosures related to this patient
    const [disclosures, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          targetUserId: userId,
          eventType: {
            in: [
              AuditEventType.PHI_DISCLOSURE,
              AuditEventType.PATIENT_DATA_VIEWED,
              AuditEventType.INTAKE_VIEWED,
              AuditEventType.PRESCRIPTION_VIEWED,
              AuditEventType.MESSAGE_VIEWED,
            ],
          },
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          eventType: true,
          userId: true,
          userRole: true,
          resourceType: true,
          metadata: true,
          timestamp: true,
          success: true,
        },
      }),
      prisma.auditLog.count({
        where: {
          targetUserId: userId,
          eventType: {
            in: [
              AuditEventType.PHI_DISCLOSURE,
              AuditEventType.PATIENT_DATA_VIEWED,
              AuditEventType.INTAKE_VIEWED,
              AuditEventType.PRESCRIPTION_VIEWED,
              AuditEventType.MESSAGE_VIEWED,
            ],
          },
        },
      }),
    ]);

    // Format disclosures for patient display (no raw user IDs)
    const formatted = disclosures.map((d) => {
      const meta = (d.metadata as Record<string, unknown>) || {};
      return {
        id: d.id,
        date: d.timestamp,
        accessorRole: d.userRole || 'Unknown',
        recipient: (meta.recipientDescription as string) || d.userRole || 'Healthcare provider',
        purpose: (meta.purpose as string) || mapEventToPurpose(d.eventType),
        dataCategories: (meta.dataCategories as string[]) || [mapResourceToCategory(d.resourceType)],
        legalBasis: (meta.legalBasis as string) || 'treatment_exception',
      };
    });

    return NextResponse.json({
      disclosures: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    });
  } catch (error) {
    console.error('Failed to fetch disclosures:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to fetch disclosures' }, { status: 500 });
  }
}

function mapEventToPurpose(eventType: string): string {
  switch (eventType) {
    case AuditEventType.PHI_DISCLOSURE:
      return 'Authorized disclosure';
    case AuditEventType.INTAKE_VIEWED:
      return 'Intake review for treatment';
    case AuditEventType.PRESCRIPTION_VIEWED:
      return 'Prescription management';
    case AuditEventType.MESSAGE_VIEWED:
      return 'Patient communication';
    default:
      return 'Healthcare operations';
  }
}

function mapResourceToCategory(resourceType: string): string {
  switch (resourceType) {
    case 'Intake':
      return 'treatment_records';
    case 'Prescription':
      return 'prescription_data';
    case 'Message':
      return 'communications';
    case 'PatientProfile':
      return 'demographics';
    case 'PHI_DISCLOSURE':
      return 'treatment_records';
    default:
      return 'health_records';
  }
}
