/**
 * GET /api/patient/prescriptions/[id]
 * Returns detailed information about a specific prescription.
 *
 * HIPAA Compliance:
 * - PATIENT role verification required
 * - Access logged via audit service
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPrescriptionById,
  getRecentRefillRequests,
  auditPrescriptionAccess,
} from '@/lib/patient/prescriptions';
import { requireRole } from '@/lib/auth/require-auth';
import { enforceRateLimit, rateLimitPresets } from '@/lib/middleware/rate-limit';
import { Role } from '@prisma/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: RouteParams) {
  const limited = await enforceRateLimit(request, rateLimitPresets.api);
  if (limited) return limited;

  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) return auth;

  const { userId } = auth.user;

  try {
    const { id: prescriptionId } = await params;

    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent');

    const prescription = await getPrescriptionById(prescriptionId, userId);

    if (!prescription) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
    }

    const recentRefillRequests = await getRecentRefillRequests(prescriptionId, userId);

    // Audit log
    auditPrescriptionAccess(userId, prescriptionId, ipAddress, userAgent).catch(
      (err) => { console.error('Audit log failed:', err instanceof Error ? err.message : 'Unknown error'); }
    );

    return NextResponse.json({
      prescription: {
        ...prescription,
        lastRefillDate: prescription.lastRefillDate?.toISOString() || null,
        nextRefillAvailable: prescription.nextRefillAvailable?.toISOString() || null,
        sentAt: prescription.sentAt?.toISOString() || null,
        createdAt: prescription.createdAt.toISOString(),
      },
      recentRefillRequests: recentRefillRequests.map((r) => ({
        ...r,
        requestedAt: r.requestedAt.toISOString(),
        respondedAt: r.respondedAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    console.error('Error fetching prescription details:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to fetch prescription details', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
