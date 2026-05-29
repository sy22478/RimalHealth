/**
 * GET /api/physician/titration/steps
 * List GLP-1 titration steps ready for a physician-reviewed dose advance.
 *
 * Wraps the pure `getStepsReadyForReview()` query and enriches each step with
 * the patient's (decrypted) name for display. PHYSICIAN/ADMIN only.
 *
 * @module app/api/physician/titration/steps
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { enforceRateLimit, rateLimitPresets } from '@/lib/middleware/rate-limit';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getStepsReadyForReview } from '@/lib/titration/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limited = await enforceRateLimit(request, rateLimitPresets.api);
  if (limited) return limited;

  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
  if (auth instanceof NextResponse) return auth;

  try {
    const ready = await getStepsReadyForReview();

    // Resolve patient names in one query (PatientProfile names auto-decrypt).
    const patientIds = Array.from(new Set(ready.map((s) => s.patientId)));
    const users = patientIds.length
      ? await prisma.user.findMany({
          where: { id: { in: patientIds } },
          select: {
            id: true,
            patientProfile: { select: { firstName: true, lastName: true } },
          },
        })
      : [];

    const nameById = new Map<string, string>();
    for (const u of users) {
      const profile = u.patientProfile;
      const firstName = typeof profile?.firstName === 'string' ? profile.firstName : '';
      const lastName = typeof profile?.lastName === 'string' ? profile.lastName : '';
      nameById.set(u.id, `${firstName} ${lastName}`.trim() || 'Unknown patient');
    }

    const steps = ready.map((s) => ({
      stepId: s.stepId,
      scheduleId: s.scheduleId,
      patientName: nameById.get(s.patientId) ?? 'Unknown patient',
      fromDosage: s.fromDosage,
      toDosage: s.toDosage,
    }));

    return NextResponse.json({ steps });
  } catch (error) {
    console.error(
      'List titration steps error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
