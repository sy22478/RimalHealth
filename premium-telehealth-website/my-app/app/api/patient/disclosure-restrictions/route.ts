/**
 * Disclosure Restriction Requests API
 * 42 CFR Part 2 — Patients can request restrictions on PHI disclosures
 *
 * GET  — List patient's restriction requests
 * POST — Submit a new restriction request
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/require-auth';
import { auditLogger, AuditEventType } from '@/lib/audit';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

const createRestrictionSchema = z.object({
  restrictionType: z.string().min(1, { message: 'Restriction type is required' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters' }),
});

// ---------------------------------------------------------------------------
// GET — List restriction requests
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) return auth;

  const { userId } = auth.user;

  try {
    const restrictions = await prisma.disclosureRestriction.findMany({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
    });

    await auditLogger.logPHIAccess(
      'VIEW',
      userId,
      Role.PATIENT,
      'PATIENT_PROFILE',
      userId,
      {
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        requestId: crypto.randomUUID(),
      },
    );

    return NextResponse.json({ restrictions });
  } catch (error) {
    console.error('Failed to fetch restrictions:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to fetch disclosure restrictions' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — Create restriction request
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) return auth;

  const { userId } = auth.user;

  try {
    const body = await request.json();
    const parsed = createRestrictionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { restrictionType, description } = parsed.data;

    const restriction = await prisma.disclosureRestriction.create({
      data: {
        userId,
        restrictionType,
        description,
      },
    });

    await auditLogger.log({
      eventType: AuditEventType.DISCLOSURE_RESTRICTION_REQUESTED,
      userId,
      resourceType: 'DisclosureRestriction',
      resourceId: restriction.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
      success: true,
      metadata: { restrictionType },
    });

    return NextResponse.json({ restriction }, { status: 201 });
  } catch (error) {
    console.error('Failed to create restriction:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to create disclosure restriction' }, { status: 500 });
  }
}
