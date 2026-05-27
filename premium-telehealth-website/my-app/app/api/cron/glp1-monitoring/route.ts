/**
 * GET /api/cron/glp1-monitoring
 * External-triggered GLP-1 monitoring sweep (EventBridge / cron-job.org). Guarded
 * by CRON_SECRET. This job ONLY marks state and notifies — it never advances a
 * dose, approves a refill, or issues a prescription (those require a physician).
 *
 * Per run:
 *  (a) SCHEDULED check-ins past their dueAt → DUE, and remind the patient.
 *  (b) DUE check-ins past the grace window → MISSED.
 *  (c) Recompute nextRefillAvailable from supplyEndDate for GLP-1 prescriptions,
 *      and notify patients newly inside the refill window.
 *  (d) Flag titration steps eligible for a physician-reviewed advance, and notify
 *      active physicians.
 *
 * @module app/api/cron/glp1-monitoring
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { CheckInStatus, PrescriptionStatus } from '@prisma/client';
import { CHECK_IN_SCHEDULE } from '@/lib/intake/glp1/clinical-config';
import { computeNextRefillAvailable } from '@/lib/titration/engine';
import { getStepsReadyForReview } from '@/lib/titration/service';
import { NotificationService } from '@/lib/services/notification-service';

export const dynamic = 'force-dynamic';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Timing-safe CRON_SECRET bearer check (mirrors other cron routes). */
function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[Cron:Glp1Monitoring] CRON_SECRET env var is not set');
    return false;
  }
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token.length !== secret.length) return false;
  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const summary = { markedDue: 0, markedMissed: 0, refillDatesUpdated: 0, refillReady: 0, stepsReady: 0 };

  try {
    // (a) SCHEDULED → DUE, with a patient reminder.
    const dueCheckIns = await prisma.checkIn.findMany({
      where: { status: CheckInStatus.SCHEDULED, deletedAt: null, dueAt: { lte: now } },
      select: { id: true, patientId: true },
    });
    for (const checkIn of dueCheckIns) {
      await prisma.checkIn.update({
        where: { id: checkIn.id },
        data: { status: CheckInStatus.DUE },
      });
      try {
        await NotificationService.notifyCheckInDue(checkIn.patientId);
      } catch (e) {
        console.error('[Cron:Glp1Monitoring] check-in reminder failed', e instanceof Error ? e.message : 'Unknown error');
      }
    }
    summary.markedDue = dueCheckIns.length;

    // (b) DUE past grace → MISSED.
    const graceCutoff = new Date(now.getTime() - CHECK_IN_SCHEDULE.graceDays * MS_PER_DAY);
    const missed = await prisma.checkIn.updateMany({
      where: { status: CheckInStatus.DUE, deletedAt: null, dueAt: { lt: graceCutoff } },
      data: { status: CheckInStatus.MISSED },
    });
    summary.markedMissed = missed.count;

    // (c) Recompute nextRefillAvailable from supplyEndDate (idempotent) and notify
    //     patients newly inside the refill window (~once, assuming ≈daily runs).
    const glp1Prescriptions = await prisma.prescription.findMany({
      where: {
        deletedAt: null,
        supplyEndDate: { not: null },
        status: { notIn: [PrescriptionStatus.CANCELLED, PrescriptionStatus.EXPIRED, PrescriptionStatus.COMPLETED, PrescriptionStatus.DENIED] },
        product: { concernType: 'WEIGHT_MANAGEMENT' },
      },
      select: { id: true, patientId: true, supplyEndDate: true, nextRefillAvailable: true, refillsRemaining: true },
    });
    for (const rx of glp1Prescriptions) {
      if (!rx.supplyEndDate) continue;
      const recomputed = computeNextRefillAvailable(rx.supplyEndDate);
      if (rx.nextRefillAvailable?.getTime() !== recomputed.getTime()) {
        await prisma.prescription.update({
          where: { id: rx.id },
          data: { nextRefillAvailable: recomputed },
        });
        summary.refillDatesUpdated++;
      }
      // Newly inside the window: opened within the last day and refills remain.
      const openedWithinLastDay =
        recomputed.getTime() <= now.getTime() &&
        recomputed.getTime() > now.getTime() - MS_PER_DAY;
      if (openedWithinLastDay && rx.refillsRemaining > 0) {
        try {
          await NotificationService.notifyRefillReady(rx.patientId, rx.id);
          summary.refillReady++;
        } catch (e) {
          console.error('[Cron:Glp1Monitoring] refill-ready notice failed', e instanceof Error ? e.message : 'Unknown error');
        }
      }
    }

    // (d) Flag titration steps ready for physician review (no advance happens here).
    const ready = await getStepsReadyForReview(now);
    summary.stepsReady = ready.length;
    if (ready.length > 0) {
      try {
        await NotificationService.notifyTitrationStepsReady(ready.length);
      } catch (e) {
        console.error('[Cron:Glp1Monitoring] step-ready notice failed', e instanceof Error ? e.message : 'Unknown error');
      }
    }

    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error('[Cron:Glp1Monitoring] run failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Monitoring run failed' }, { status: 500 });
  }
}
