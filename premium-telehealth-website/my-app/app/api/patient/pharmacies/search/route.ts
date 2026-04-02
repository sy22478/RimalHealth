/**
 * GET /api/patient/pharmacies/search
 * Search pharmacies by name, city, or zip code.
 * Available to authenticated patients.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { Role } from '@prisma/client';
import { auditLogger, createAuditContext } from '@/lib/audit/index';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const zipCode = searchParams.get('zip') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    const where: Record<string, unknown> = { isActive: true };

    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { city: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (zipCode) {
      where.zipCode = { startsWith: zipCode.substring(0, 5) };
    }

    const pharmacies = await prisma.pharmacy.findMany({
      where,
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        phone: true,
        is24Hour: true,
        hasDelivery: true,
        hasDriveThru: true,
      },
      take: limit,
      orderBy: { name: 'asc' },
    });

    // Audit log the pharmacy search
    const auditContext = createAuditContext(request, auth.user.userId, 'PATIENT');
    await auditLogger.logPHIAccess(
      'VIEW',
      auth.user.userId,
      'PATIENT',
      'pharmacy_search',
      'search',
      auditContext,
      { query, zipCode, resultCount: pharmacies.length } as Record<string, unknown>
    );

    return NextResponse.json({ pharmacies });
  } catch (error) {
    console.error('Pharmacy search error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to search pharmacies', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
