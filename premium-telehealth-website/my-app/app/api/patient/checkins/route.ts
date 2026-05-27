/**
 * GET /api/patient/checkins
 * List the authenticated patient's GLP-1 check-ins (metadata only — no PHI).
 *
 * @module app/api/patient/checkins
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { enforceRateLimit, rateLimitPresets } from '@/lib/middleware/rate-limit';
import { Role } from '@prisma/client';
import { getPatientCheckIns } from '@/lib/checkins/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limited = await enforceRateLimit(request, rateLimitPresets.api);
  if (limited) return limited;

  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth.user;

  try {
    const checkIns = await getPatientCheckIns(userId);
    return NextResponse.json({ checkIns });
  } catch (error) {
    console.error(
      'Check-ins list error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
