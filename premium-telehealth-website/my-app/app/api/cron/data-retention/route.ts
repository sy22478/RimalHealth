/**
 * Cron: Data Retention Processing
 *
 * Processes soft-deleted records that have exceeded the HIPAA minimum
 * retention period (6 years) and anonymizes their PHI fields.
 *
 * Authentication: Bearer token via `CRON_SECRET` env var.
 * - Set `CRON_SECRET` in Netlify (and .env.local for dev).
 * - Pass as `Authorization: Bearer <CRON_SECRET>` header.
 *
 * Trigger options (pick one):
 *   1. **Netlify Scheduled Functions** -- fire daily or weekly.
 *   2. **External cron service** -- e.g. cron-job.org hitting
 *      `GET /api/cron/data-retention` daily with the Authorization header.
 *   3. **Claude Code `/schedule` skill** -- for ad-hoc or dev invocation.
 *
 * HIPAA Compliance:
 * - 6-year minimum retention enforced before any anonymization
 * - All actions audit-logged via auditLogger
 * - PHI is never included in response payloads or logs
 *
 * @module app/api/cron/data-retention/route
 */

import { NextResponse } from 'next/server';
import { processExpiredDeletions } from '@/lib/hipaa/data-retention';

export const dynamic = 'force-dynamic';

/**
 * Verify the request carries a valid CRON_SECRET bearer token.
 */
function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[Cron:DataRetention] CRON_SECRET env var is not set');
    return false;
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  // Timing-safe comparison to avoid timing attacks
  if (token.length !== secret.length) return false;

  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * GET /api/cron/data-retention
 *
 * Processes expired soft-deleted records and anonymizes their PHI fields.
 * Returns a summary of the processing run (no PHI in response).
 */
export async function GET(request: Request): Promise<NextResponse> {
  // --- Auth ---
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const startTime = Date.now();

  try {
    const result = await processExpiredDeletions();

    // === Deactivate accounts past their scheduled deactivation date ===
    let deactivatedCount = 0;
    try {
      const { prisma } = await import('@/lib/db/prisma');
      const expiredAccounts = await prisma.user.findMany({
        where: {
          deactivateAt: { lte: new Date() },
          deactivatedAt: null,
        },
        select: { id: true },
      });

      for (const account of expiredAccounts) {
        await prisma.user.update({
          where: { id: account.id },
          data: { deactivatedAt: new Date() },
        });
        deactivatedCount++;
      }

      if (deactivatedCount > 0) {
        console.error(`[Cron:DataRetention] Deactivated ${deactivatedCount} expired accounts`);
      }
    } catch (deactivateError) {
      console.error('[Cron:DataRetention] Account deactivation failed:', deactivateError instanceof Error ? deactivateError.message : 'Unknown error');
    }

    const durationMs = Date.now() - startTime;

    console.error(
      `[Cron:DataRetention] Done -- processed: ${result.processed}, anonymized: ${result.anonymized}, errors: ${result.errors}, duration: ${durationMs}ms`
    );

    return NextResponse.json({
      ok: true,
      processed: result.processed,
      anonymized: result.anonymized,
      softDeleted: result.softDeleted,
      errors: result.errors,
      deactivatedCount,
      durationMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Cron:DataRetention] Failed:', message);

    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
