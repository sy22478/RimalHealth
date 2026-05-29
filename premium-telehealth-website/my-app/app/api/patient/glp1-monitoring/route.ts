/**
 * GET /api/patient/glp1-monitoring
 * Titration progress + the patient's open check-in, for the dashboard widget.
 * Returns non-PHI workflow metadata only (dosages, step numbers, dates).
 *
 * @module app/api/patient/glp1-monitoring
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { Role, CheckInStatus } from '@prisma/client';
import { getTitrationProgress } from '@/lib/titration/service';
import { getPatientCheckIns } from '@/lib/checkins/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth.user;

  try {
    const [titration, checkIns] = await Promise.all([
      getTitrationProgress(userId),
      getPatientCheckIns(userId),
    ]);

    const openCheckIn =
      checkIns.find(
        (c) => c.status === CheckInStatus.DUE || c.status === CheckInStatus.SCHEDULED
      ) ?? null;

    return NextResponse.json({
      titration,
      openCheckIn: openCheckIn
        ? { id: openCheckIn.id, status: openCheckIn.status, dueAt: openCheckIn.dueAt }
        : null,
    });
  } catch (error) {
    console.error(
      'GLP-1 monitoring fetch error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
