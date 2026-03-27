/**
 * Consent Record Download (Plain Text)
 * 42 CFR Part 2 — Generate downloadable consent document
 *
 * GET /api/patient/consent/[id]/pdf
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuth } from '@/lib/auth/require-auth';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { userId, role } = auth.user;
  if (role !== Role.PATIENT) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const record = await prisma.consentRecord.findFirst({
      where: { id, userId },
    });

    if (!record) {
      return NextResponse.json({ error: 'Consent record not found' }, { status: 404 });
    }

    const statusLine = record.revokedAt
      ? `Status: REVOKED on ${record.revokedAt.toISOString()}\nRevocation Reason: ${record.revokedReason || 'Not specified'}`
      : 'Status: ACTIVE';

    const content = [
      '========================================',
      'RIMAL HEALTH — CONSENT RECORD',
      '========================================',
      '',
      `Record ID: ${record.id}`,
      `Consent Type: ${record.consentType}`,
      `Consent Version: ${record.consentVersion}`,
      `Granted Date: ${record.grantedAt.toISOString()}`,
      statusLine,
      '',
      '--- Consent Text ---',
      '',
      record.consentText,
      '',
      '========================================',
      'This document is a record of consent provided',
      'in accordance with 42 CFR Part 2.',
      '========================================',
    ].join('\n');

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="consent-${record.id}.txt"`,
      },
    });
  } catch (error) {
    console.error('Failed to generate consent document:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Failed to generate consent document' }, { status: 500 });
  }
}
