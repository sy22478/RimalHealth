/**
 * GET /api/physician/checkins
 * List SUBMITTED GLP-1 check-ins awaiting physician review (across all patients).
 *
 * HIPAA: PHYSICIAN/ADMIN only; viewing decrypted check-in responses is PHI access
 * and is audit-logged. No PHI is logged to the console.
 *
 * @module app/api/physician/checkins
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getClientIp, getUserAgent } from '@/lib/auth/require-auth';
import { enforceRateLimit, rateLimitPresets } from '@/lib/middleware/rate-limit';
import { Role } from '@prisma/client';
import { getSubmittedCheckIns } from '@/lib/checkins/service';
import { auditLogger } from '@/lib/audit/logger';
import { AuditEventType } from '@/lib/audit/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limited = await enforceRateLimit(request, rateLimitPresets.api);
  if (limited) return limited;

  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
  if (auth instanceof NextResponse) return auth;
  const { userId, role } = auth.user;

  try {
    const checkIns = await getSubmittedCheckIns();

    await auditLogger.log({
      eventType: AuditEventType.PATIENT_DATA_VIEWED,
      userId,
      userRole: role,
      action: 'Viewed submitted check-in review queue',
      resourceType: 'CheckIn',
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      success: true,
    });

    return NextResponse.json({ checkIns });
  } catch (error) {
    console.error(
      'List check-ins error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
