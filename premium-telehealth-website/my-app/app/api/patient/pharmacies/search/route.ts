/**
 * GET /api/patient/pharmacies/search
 * Search pharmacies via NPI Registry (primary) with local DB fallback.
 * Available to authenticated patients.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { Role } from '@prisma/client';
import { auditLogger, createAuditContext } from '@/lib/audit/index';
import { searchNpiPharmacies } from '@/lib/integrations/npi-registry';
import { rateLimit } from '@/lib/middleware/rate-limit';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  // Cap NPI Registry calls at 10 searches per minute per user so a single
  // patient can't burn the shared NPI Registry quota.
  const rl = await rateLimit(`pharmacy-search:${auth.user.userId}`, {
    requests: 10,
    windowMs: 60 * 1000,
    keyPrefix: 'ratelimit:pharmacy-search',
    useMemoryFallback: true,
  });
  if (!rl.success) {
    return NextResponse.json(
      {
        error: 'Too many pharmacy searches. Please wait before searching again.',
        code: 'RATE_LIMITED',
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.retryAfter ?? 60),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': String(rl.remaining),
        },
      }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const zipCode = searchParams.get('zip') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    // Determine search params: detect if query looks like a ZIP
    let searchCity: string | undefined;
    let searchZip: string | undefined;

    if (zipCode) {
      searchZip = zipCode.substring(0, 5);
    } else if (query && /^\d/.test(query.trim())) {
      searchZip = query.trim().substring(0, 5);
    } else if (query) {
      searchCity = query.trim();
    }

    let pharmacies: Array<{
      id: string;
      name: string;
      address: string;
      city: string;
      state: string;
      zipCode: string;
      phone: string | null;
      source: 'npi' | 'local';
      npiNumber?: string;
    }> = [];

    // Primary: NPI Registry
    if (searchCity || searchZip) {
      const npiResult = await searchNpiPharmacies({
        city: searchCity,
        zip: searchZip,
        limit,
      });

      if (npiResult.success && npiResult.pharmacies.length > 0) {
        pharmacies = npiResult.pharmacies.map((p) => ({
          id: `npi-${p.npiNumber}`,
          name: p.name,
          address: p.address,
          city: p.city,
          state: p.state,
          zipCode: p.zipCode,
          phone: p.phone || null,
          source: 'npi' as const,
          npiNumber: p.npiNumber,
        }));
      } else {
        // Fallback: local database
        const where: Record<string, unknown> = { isActive: true, state: 'CA' };

        if (searchCity) {
          where.OR = [
            { name: { contains: searchCity, mode: 'insensitive' } },
            { city: { contains: searchCity, mode: 'insensitive' } },
          ];
        }

        if (searchZip) {
          where.zipCode = { startsWith: searchZip.substring(0, 5) };
        }

        const localResults = await prisma.pharmacy.findMany({
          where,
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
            phone: true,
          },
          take: limit,
          orderBy: { name: 'asc' },
        });

        pharmacies = localResults.map((p) => ({
          ...p,
          source: 'local' as const,
        }));
      }
    }

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
