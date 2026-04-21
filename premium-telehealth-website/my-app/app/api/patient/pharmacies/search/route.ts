/**
 * GET /api/patient/pharmacies/search
 * Search pharmacies via NPI Registry (primary) with local DB fallback.
 * Available to authenticated patients.
 *
 * Query params:
 *   q     — legacy single input, auto-detected as ZIP if it starts with a digit, else city
 *   name  — optional pharmacy organization name (e.g., "CVS")
 *   zip   — optional ZIP code (takes precedence over q auto-detect)
 *   limit — optional result cap (max 50)
 *
 * At least one of (q, name, zip) must be provided.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { Role } from '@prisma/client';
import { auditLogger, createAuditContext } from '@/lib/audit/index';
import { searchNpiPharmacies } from '@/lib/integrations/npi-registry';
import { validateAddress } from '@/lib/integrations/location';
import { haversineDistanceMiles } from '@/lib/utils/distance';
import { rateLimit } from '@/lib/middleware/rate-limit';

const QuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    name: z.string().trim().min(2, { message: 'Name must be at least 2 characters' }).max(100).optional(),
    zip: z.string().trim().max(10).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .refine(
    (v) => Boolean((v.q && v.q.length > 0) || (v.name && v.name.length > 0) || (v.zip && v.zip.length > 0)),
    { message: 'At least one of q, name, or zip is required' }
  );

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
    const parsed = QuerySchema.safeParse({
      q: searchParams.get('q') ?? undefined,
      name: searchParams.get('name') ?? undefined,
      zip: searchParams.get('zip') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? 'Invalid query',
          code: 'INVALID_QUERY',
        },
        { status: 400 }
      );
    }

    const { q, name, zip, limit = 20 } = parsed.data;

    // Determine location search params: explicit zip wins, else auto-detect from q.
    let searchCity: string | undefined;
    let searchZip: string | undefined;

    if (zip) {
      searchZip = zip.substring(0, 5);
    } else if (q && /^\d/.test(q)) {
      searchZip = q.substring(0, 5);
    } else if (q) {
      searchCity = q;
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
      latitude?: number | null;
      longitude?: number | null;
      distanceMiles?: number;
    }> = [];

    // Primary: NPI Registry
    const npiResult = await searchNpiPharmacies({
      city: searchCity,
      zip: searchZip,
      name,
      limit,
    });

    if (npiResult.success && npiResult.pharmacies.length > 0) {
      // Hydrate coordinates from local Pharmacy cache (keyed by NPI) so we
      // don't re-geocode every search. Lazy geocoding below fills in the rest.
      const npiNumbers = npiResult.pharmacies.map((p) => p.npiNumber);
      const cached = await prisma.pharmacy.findMany({
        where: { npiNumber: { in: npiNumbers } },
        select: { npiNumber: true, latitude: true, longitude: true },
      });
      const coordsByNpi = new Map<string, { latitude: number | null; longitude: number | null }>();
      for (const row of cached) {
        if (row.npiNumber) {
          coordsByNpi.set(row.npiNumber, { latitude: row.latitude, longitude: row.longitude });
        }
      }

      pharmacies = npiResult.pharmacies.map((p) => {
        const cachedCoords = coordsByNpi.get(p.npiNumber);
        return {
          id: `npi-${p.npiNumber}`,
          name: p.name,
          address: p.address,
          city: p.city,
          state: p.state,
          zipCode: p.zipCode,
          phone: p.phone || null,
          source: 'npi' as const,
          npiNumber: p.npiNumber,
          latitude: cachedCoords?.latitude ?? null,
          longitude: cachedCoords?.longitude ?? null,
        };
      });
    } else {
      // Fallback: local database
      const where: Record<string, unknown> = { isActive: true, state: 'CA' };

      const orClauses: Record<string, unknown>[] = [];
      if (searchCity) {
        orClauses.push(
          { name: { contains: searchCity, mode: 'insensitive' } },
          { city: { contains: searchCity, mode: 'insensitive' } }
        );
      }
      if (name) {
        orClauses.push({ name: { contains: name, mode: 'insensitive' } });
      }
      if (orClauses.length > 0) {
        where.OR = orClauses;
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
          latitude: true,
          longitude: true,
        },
        take: limit,
        orderBy: { name: 'asc' },
      });

      pharmacies = localResults.map((p) => ({
        ...p,
        source: 'local' as const,
      }));
    }

    // Proximity sort: if the patient has a saved geocoded address, lazy-geocode
    // any results missing coordinates, compute Haversine distances, and sort
    // by distance ascending. Skipped entirely when the patient has no address.
    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId: auth.user.userId },
      select: { latitude: true, longitude: true },
    });

    if (
      patientProfile?.latitude != null &&
      patientProfile?.longitude != null &&
      pharmacies.length > 0
    ) {
      const patientLat = patientProfile.latitude;
      const patientLon = patientProfile.longitude;

      // Lazy geocode: only fills in coords for pharmacies that don't already have them.
      await Promise.all(
        pharmacies.map(async (p) => {
          if (p.latitude != null && p.longitude != null) return;
          try {
            const geocode = await validateAddress({
              street: p.address,
              city: p.city,
              state: p.state,
              zip: p.zipCode,
            });
            const top = geocode.suggestions[0];
            if (top && typeof top.latitude === 'number' && typeof top.longitude === 'number') {
              p.latitude = top.latitude;
              p.longitude = top.longitude;
              // Persist for NPI-sourced pharmacies already cached locally, so
              // repeated searches don't re-hit the geocoder.
              if (p.npiNumber) {
                await prisma.pharmacy
                  .updateMany({
                    where: { npiNumber: p.npiNumber },
                    data: { latitude: top.latitude, longitude: top.longitude },
                  })
                  .catch((err) => {
                    console.warn(
                      'Failed to cache pharmacy coords:',
                      err instanceof Error ? err.message : 'Unknown error'
                    );
                  });
              }
            }
          } catch (geoErr) {
            console.warn(
              'Lazy pharmacy geocoding failed:',
              geoErr instanceof Error ? geoErr.message : 'Unknown error'
            );
          }
        })
      );

      for (const p of pharmacies) {
        if (p.latitude != null && p.longitude != null) {
          const miles = haversineDistanceMiles(patientLat, patientLon, p.latitude, p.longitude);
          p.distanceMiles = Math.round(miles * 10) / 10;
        }
      }

      pharmacies.sort((a, b) => {
        // Results without a distance sink to the bottom but preserve relative order.
        if (a.distanceMiles == null && b.distanceMiles == null) return 0;
        if (a.distanceMiles == null) return 1;
        if (b.distanceMiles == null) return -1;
        return a.distanceMiles - b.distanceMiles;
      });
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
      { query: q ?? '', name: name ?? '', zipCode: zip ?? '', resultCount: pharmacies.length } as Record<string, unknown>
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
