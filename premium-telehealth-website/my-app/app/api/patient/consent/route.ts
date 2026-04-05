/**
 * Patient Consent Management API
 * 42 CFR Part 2 — Consent records for SUD treatment data
 *
 * GET  — List patient's consent records
 * POST — Create a new consent record
 * PUT  — Revoke a consent record
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/require-auth';
import { auditLogger, AuditEventType } from '@/lib/audit';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Validation schemas (Zod v4 syntax)
// ---------------------------------------------------------------------------

const createConsentSchema = z.object({
  consentType: z.string().min(1, { message: 'Consent type is required' }),
  consentText: z.string().min(1, { message: 'Consent text is required' }),
  consentVersion: z.string().min(1, { message: 'Consent version is required' }),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const revokeConsentSchema = z.object({
  consentRecordId: z.string().min(1, { message: 'Consent record ID is required' }),
  revokedReason: z.string().min(1, { message: 'Revocation reason is required' }),
});

// ---------------------------------------------------------------------------
// GET — List consent records
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) return auth;

  const { userId } = auth.user;

  try {
    const records = await prisma.consentRecord.findMany({
      where: { userId },
      orderBy: { grantedAt: 'desc' },
    });

    return NextResponse.json({ consents: records });
  } catch (error) {
    console.error('Failed to fetch consent records:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to fetch consent records' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — Create consent record
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) return auth;

  const { userId } = auth.user;

  try {
    const body = await request.json();
    const parsed = createConsentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { consentType, consentText, consentVersion, metadata } = parsed.data;

    const record = await prisma.consentRecord.create({
      data: {
        userId,
        consentType,
        consentText,
        consentVersion,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        metadata: metadata ? (metadata as Record<string, string>) : undefined,
      },
    });

    await auditLogger.log({
      eventType: AuditEventType.CONSENT_RECORDED,
      userId,
      resourceType: 'ConsentRecord',
      resourceId: record.id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
      success: true,
      metadata: { consentType, consentVersion },
    });

    return NextResponse.json({ consent: record }, { status: 201 });
  } catch (error) {
    console.error('Failed to create consent record:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to create consent record' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT — Revoke consent record
// ---------------------------------------------------------------------------

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) return auth;

  const { userId } = auth.user;

  try {
    const body = await request.json();
    const parsed = revokeConsentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { consentRecordId, revokedReason } = parsed.data;

    // Verify ownership
    const existing = await prisma.consentRecord.findFirst({
      where: { id: consentRecordId, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Consent record not found' }, { status: 404 });
    }

    if (existing.revokedAt) {
      return NextResponse.json({ error: 'Consent already revoked' }, { status: 409 });
    }

    const updated = await prisma.consentRecord.update({
      where: { id: consentRecordId },
      data: {
        revokedAt: new Date(),
        revokedReason,
      },
    });

    await auditLogger.log({
      eventType: AuditEventType.CONSENT_REVOKED,
      userId,
      resourceType: 'ConsentRecord',
      resourceId: consentRecordId,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || undefined,
      success: true,
      metadata: { consentType: existing.consentType, revokedReason },
    });

    return NextResponse.json({ consent: updated });
  } catch (error) {
    console.error('Failed to revoke consent:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to revoke consent' }, { status: 500 });
  }
}
