/**
 * GLP-1 check-in service (Phase 4) — DB operations for patient check-ins.
 *
 * Answers persist in the encrypted `CheckIn.responses` JSON column (handled by
 * the Prisma encryption extension). This layer holds no clinical thresholds —
 * urgent-review triggers come from `clinical-config` (sign-off gated).
 *
 * @module lib/checkins/service
 */
import { prisma } from '@/lib/db/prisma';
import { CheckInStatus } from '@prisma/client';
import {
  CHECK_IN_SCHEDULE,
  CHECK_IN_URGENT_TRIGGERS,
} from '@/lib/intake/glp1/clinical-config';
import type { CheckInResponses } from '@/lib/validation/checkin-schemas';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CheckInSummary {
  id: string;
  status: CheckInStatus;
  scheduledFor: Date;
  dueAt: Date;
  submittedAt: Date | null;
  reviewedAt: Date | null;
}

export interface SubmitCheckInResult {
  success: boolean;
  error?: string;
  code?: string;
  urgent?: boolean;
}

/** Whether a check-in's answers warrant fast-tracked physician review. */
export function isUrgentCheckIn(responses: CheckInResponses): boolean {
  if (CHECK_IN_URGENT_TRIGGERS.abdominalPain && responses.abdominalPain) {
    return true;
  }
  const severe = CHECK_IN_URGENT_TRIGGERS.severeSymptomValues as readonly string[];
  return (
    severe.includes(responses.nauseaSeverity) ||
    severe.includes(responses.vomitingSeverity)
  );
}

/** List a patient's check-ins (newest first). Excludes soft-deleted. */
export async function getPatientCheckIns(
  patientId: string
): Promise<CheckInSummary[]> {
  return prisma.checkIn.findMany({
    where: { patientId, deletedAt: null },
    orderBy: { dueAt: 'desc' },
    select: {
      id: true,
      status: true,
      scheduledFor: true,
      dueAt: true,
      submittedAt: true,
      reviewedAt: true,
    },
  });
}

/**
 * Submit a check-in's responses. One submission per open check-in — only
 * SCHEDULED/DUE check-ins can be submitted.
 */
export async function submitCheckIn(
  checkInId: string,
  patientId: string,
  responses: CheckInResponses
): Promise<SubmitCheckInResult> {
  const checkIn = await prisma.checkIn.findFirst({
    where: { id: checkInId, patientId, deletedAt: null },
    select: { id: true, status: true },
  });

  if (!checkIn) {
    return { success: false, error: 'Check-in not found', code: 'NOT_FOUND' };
  }
  if (
    checkIn.status !== CheckInStatus.SCHEDULED &&
    checkIn.status !== CheckInStatus.DUE
  ) {
    return {
      success: false,
      error: 'This check-in has already been submitted',
      code: 'ALREADY_SUBMITTED',
    };
  }

  await prisma.checkIn.update({
    where: { id: checkInId },
    data: {
      status: CheckInStatus.SUBMITTED,
      submittedAt: new Date(),
      // Encrypted JSON via the Prisma extension.
      responses,
    },
  });

  return { success: true, urgent: isUrgentCheckIn(responses) };
}

export interface ReviewCheckInResult {
  success: boolean;
  error?: string;
  code?: string;
  patientId?: string;
}

/** Mark a submitted check-in as reviewed by a physician. */
export async function reviewCheckIn(
  checkInId: string,
  physicianUserId: string
): Promise<ReviewCheckInResult> {
  const checkIn = await prisma.checkIn.findUnique({
    where: { id: checkInId },
    select: { id: true, status: true, patientId: true },
  });

  if (!checkIn) {
    return { success: false, error: 'Check-in not found', code: 'NOT_FOUND' };
  }
  if (checkIn.status !== CheckInStatus.SUBMITTED) {
    return {
      success: false,
      error: 'Only submitted check-ins can be reviewed',
      code: 'NOT_SUBMITTED',
    };
  }

  await prisma.checkIn.update({
    where: { id: checkInId },
    data: {
      status: CheckInStatus.REVIEWED,
      reviewedAt: new Date(),
      reviewedBy: physicianUserId,
    },
  });

  return { success: true, patientId: checkIn.patientId };
}

/** Create the next scheduled check-in `intervalDays` out from `from`. */
export async function scheduleNextCheckIn(
  patientId: string,
  scheduleId: string | null,
  from: Date = new Date()
): Promise<{ id: string }> {
  const due = new Date(from.getTime() + CHECK_IN_SCHEDULE.intervalDays * MS_PER_DAY);
  const created = await prisma.checkIn.create({
    data: {
      patientId,
      scheduleId,
      status: CheckInStatus.SCHEDULED,
      scheduledFor: due,
      dueAt: due,
    },
    select: { id: true },
  });
  return created;
}

/**
 * Ensure the patient has an open (SCHEDULED or DUE) check-in; create one if not.
 * Idempotent — used by the cron to keep check-ins flowing for active schedules.
 */
export async function ensureUpcomingCheckIn(
  patientId: string,
  scheduleId: string | null
): Promise<void> {
  const open = await prisma.checkIn.findFirst({
    where: {
      patientId,
      deletedAt: null,
      status: { in: [CheckInStatus.SCHEDULED, CheckInStatus.DUE] },
    },
    select: { id: true },
  });
  if (!open) {
    await scheduleNextCheckIn(patientId, scheduleId);
  }
}
