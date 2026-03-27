/**
 * Cron: Process Email Retry Queue
 *
 * Processes failed emails sitting in the `notifications:email:retry` Redis
 * sorted set. Each job includes exponential-backoff scoring so only jobs whose
 * delay has elapsed will be picked up.
 *
 * Authentication: Bearer token via `CRON_SECRET` env var.
 * - Set `CRON_SECRET` in Netlify (and .env.local for dev).
 * - Pass as `Authorization: Bearer <CRON_SECRET>` header.
 *
 * Trigger options (pick one):
 *   1. **Netlify Scheduled Functions** — wrap this route in a Netlify scheduled
 *      function that fires every 5 minutes.
 *   2. **External cron service** — e.g. cron-job.org, Uptime Robot, or EasyCron
 *      hitting `GET /api/cron/process-email-retry` every 5 minutes with the
 *      Authorization header.
 *   3. **Claude Code `/schedule` skill** — for ad-hoc or dev invocation.
 *
 * @module app/api/cron/process-email-retry/route
 */

import { NextResponse } from 'next/server';
import { processRetryQueue } from '@/lib/integrations/sendgrid';
import { getRedisClient } from '@/lib/redis/client';

/**
 * Verify the request carries a valid CRON_SECRET bearer token.
 */
function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[Cron:EmailRetry] CRON_SECRET env var is not set');
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
 * GET /api/cron/process-email-retry
 *
 * Processes the email retry queue and returns a summary.
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
    // Grab queue depth before processing for reporting
    let pendingBefore = 0;
    let deadLetterCount = 0;

    try {
      const redis = getRedisClient();
      pendingBefore = await redis.zcard('notifications:email:retry');
      deadLetterCount = await redis.llen('notifications:email:dead');
    } catch {
      // Redis unavailable — still attempt processing (it will fail gracefully)
    }

    // Run the retry processor
    await processRetryQueue();

    // Grab queue depth after processing
    let pendingAfter = 0;
    let deadLetterAfter = 0;

    try {
      const redis = getRedisClient();
      pendingAfter = await redis.zcard('notifications:email:retry');
      deadLetterAfter = await redis.llen('notifications:email:dead');
    } catch {
      // Redis unavailable
    }

    const processed = pendingBefore - pendingAfter;
    const newDeadLetters = deadLetterAfter - deadLetterCount;
    const durationMs = Date.now() - startTime;

    console.log(
      `[Cron:EmailRetry] Done — processed: ${processed}, remaining: ${pendingAfter}, dead-lettered: ${newDeadLetters}, duration: ${durationMs}ms`
    );

    return NextResponse.json({
      ok: true,
      processed,
      remaining: pendingAfter,
      deadLettered: newDeadLetters,
      durationMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Cron:EmailRetry] Failed:', message);

    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
