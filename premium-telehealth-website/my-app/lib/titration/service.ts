/**
 * GLP-1 titration service (Phase 4) — DB operations layered over the pure
 * `engine.ts`. Provisions a schedule when a weight-management prescription is
 * sent, performs the physician-approved dose advance, and exposes progress /
 * "ready for review" queries for the dashboards and cron.
 *
 * Physician-in-the-loop: `approveTitrationStep` is the ONLY function that
 * advances a dose, and it is only called from an authenticated physician route.
 *
 * @module lib/titration/service
 */
import { prisma } from '@/lib/db/prisma';
import {
  Prisma,
  TitrationStatus,
  TitrationStepStatus,
} from '@prisma/client';
import {
  buildSchedule,
  isStepAdvanceDue,
  computeSupplyEnd,
  computeNextRefillAvailable,
} from './engine';
import { scheduleNextCheckIn } from '@/lib/checkins/service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Days supply for a weekly GLP-1 pen prescription. */
function daysSupply(quantity: number): number {
  return quantity * 7;
}

/**
 * Create the titration schedule + first check-in for a weight-management
 * prescription at send time, and set its supply/refill window. No-op for AUD or
 * when a schedule already exists (idempotent).
 *
 * @returns the schedule id, or null if not applicable.
 */
export async function provisionTitrationForPrescription(
  prescriptionId: string,
  sentAt: Date = new Date()
): Promise<string | null> {
  const prescription = await prisma.prescription.findUnique({
    where: { id: prescriptionId },
    select: {
      id: true,
      patientId: true,
      quantity: true,
      product: { select: { concernType: true } },
      titrationSchedules: { select: { id: true } },
    },
  });

  if (!prescription || prescription.product?.concernType !== 'WEIGHT_MANAGEMENT') {
    return null;
  }
  if (prescription.titrationSchedules.length > 0) {
    return prescription.titrationSchedules[0].id;
  }

  const planned = buildSchedule();
  const firstDuration = planned[0]?.durationDays ?? 28;
  const supplyEnd = computeSupplyEnd({ durationDays: daysSupply(prescription.quantity) }, sentAt);
  const nextRefillAvailable = computeNextRefillAvailable(supplyEnd);

  const schedule = await prisma.titrationSchedule.create({
    data: {
      patientId: prescription.patientId,
      prescriptionId: prescription.id,
      status: TitrationStatus.ACTIVE,
      startedAt: sentAt,
      steps: {
        create: planned.map((s) => ({
          stepIndex: s.stepIndex,
          dosage: s.dosage,
          durationDays: s.durationDays,
          // Step 0 is the prescribed starting dose — already "approved" implicitly.
          status: s.stepIndex === 0 ? TitrationStepStatus.CURRENT : TitrationStepStatus.PENDING,
          actualStartDate: s.stepIndex === 0 ? sentAt : null,
          physicianApprovedAt: s.stepIndex === 0 ? sentAt : null,
        })),
      },
    },
    select: { id: true },
  });

  await prisma.prescription.update({
    where: { id: prescription.id },
    data: { supplyEndDate: supplyEnd, nextRefillAvailable },
  });

  // First check-in is scheduled one cadence out (independent of step duration).
  void firstDuration;
  await scheduleNextCheckIn(prescription.patientId, schedule.id, sentAt);

  return schedule.id;
}

export interface ApproveStepResult {
  success: boolean;
  error?: string;
  code?: string;
}

/**
 * Physician-approved dose advance: mark the target (PENDING) step CURRENT with
 * `actualStartDate`/`physicianApprovedAt/By`, complete the prior CURRENT step,
 * and roll the prescription's supply/refill window forward. Never called
 * automatically — only from an authenticated physician route.
 */
export async function approveTitrationStep(
  stepId: string,
  physicianUserId: string,
  now: Date = new Date()
): Promise<ApproveStepResult> {
  const step = await prisma.titrationStep.findUnique({
    where: { id: stepId },
    select: {
      id: true,
      stepIndex: true,
      status: true,
      durationDays: true,
      physicianApprovedAt: true,
      schedule: {
        select: {
          id: true,
          patientId: true,
          prescriptionId: true,
          steps: { select: { id: true, stepIndex: true, status: true } },
        },
      },
    },
  });

  if (!step) {
    return { success: false, error: 'Titration step not found', code: 'NOT_FOUND' };
  }
  if (step.physicianApprovedAt || step.status !== TitrationStepStatus.PENDING) {
    return {
      success: false,
      error: 'Only a pending, un-approved step can be advanced',
      code: 'NOT_ADVANCEABLE',
    };
  }

  const prior = step.schedule.steps.find((s) => s.stepIndex === step.stepIndex - 1);

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.titrationStep.update({
      where: { id: step.id },
      data: {
        status: TitrationStepStatus.CURRENT,
        actualStartDate: now,
        physicianApprovedAt: now,
        physicianApprovedBy: physicianUserId,
      },
    }),
  ];
  if (prior) {
    ops.push(
      prisma.titrationStep.update({
        where: { id: prior.id },
        data: { status: TitrationStepStatus.COMPLETED },
      })
    );
  }

  // Roll the prescription supply window forward for the new step.
  if (step.schedule.prescriptionId) {
    const supplyEnd = computeSupplyEnd({ durationDays: step.durationDays }, now);
    ops.push(
      prisma.prescription.update({
        where: { id: step.schedule.prescriptionId },
        data: {
          supplyEndDate: supplyEnd,
          nextRefillAvailable: computeNextRefillAvailable(supplyEnd),
        },
      })
    );
  }

  await prisma.$transaction(ops);
  return { success: true };
}

export interface TitrationProgress {
  scheduleId: string;
  status: TitrationStatus;
  currentDosage: string | null;
  currentStepNumber: number; // 1-based
  totalSteps: number;
  nextDosage: string | null;
  /** When the next advance becomes eligible for physician review. */
  nextAdvanceEligibleAt: Date | null;
}

/** Active titration progress for a patient (for the patient dashboard). */
export async function getTitrationProgress(
  patientId: string
): Promise<TitrationProgress | null> {
  const schedule = await prisma.titrationSchedule.findFirst({
    where: { patientId, status: TitrationStatus.ACTIVE },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      steps: {
        orderBy: { stepIndex: 'asc' },
        select: {
          stepIndex: true,
          dosage: true,
          durationDays: true,
          status: true,
          actualStartDate: true,
        },
      },
    },
  });

  if (!schedule) return null;

  const current = schedule.steps.find((s) => s.status === TitrationStepStatus.CURRENT);
  const next = current
    ? schedule.steps.find((s) => s.stepIndex === current.stepIndex + 1)
    : null;
  const nextAdvanceEligibleAt =
    current?.actualStartDate != null
      ? new Date(current.actualStartDate.getTime() + current.durationDays * MS_PER_DAY)
      : null;

  return {
    scheduleId: schedule.id,
    status: schedule.status,
    currentDosage: current?.dosage ?? null,
    currentStepNumber: current ? current.stepIndex + 1 : 0,
    totalSteps: schedule.steps.length,
    nextDosage: next?.dosage ?? null,
    nextAdvanceEligibleAt,
  };
}

export interface StepReadyForReview {
  stepId: string;
  scheduleId: string;
  patientId: string;
  fromDosage: string;
  toDosage: string;
}

/**
 * Steps whose current dose duration has elapsed and that have an un-approved
 * next step — i.e. eligible for a physician-reviewed advance. Used by the
 * physician dashboard and the monitoring cron (flag only; never auto-advance).
 */
export async function getStepsReadyForReview(
  now: Date = new Date()
): Promise<StepReadyForReview[]> {
  const schedules = await prisma.titrationSchedule.findMany({
    where: { status: TitrationStatus.ACTIVE },
    select: {
      id: true,
      patientId: true,
      steps: {
        orderBy: { stepIndex: 'asc' },
        select: {
          id: true,
          stepIndex: true,
          dosage: true,
          durationDays: true,
          status: true,
          actualStartDate: true,
          physicianApprovedAt: true,
        },
      },
    },
  });

  const ready: StepReadyForReview[] = [];
  for (const schedule of schedules) {
    const current = schedule.steps.find((s) => s.status === TitrationStepStatus.CURRENT);
    if (!current) continue;
    if (!isStepAdvanceDue(current, now)) continue;
    const next = schedule.steps.find((s) => s.stepIndex === current.stepIndex + 1);
    if (!next || next.physicianApprovedAt) continue;
    ready.push({
      stepId: next.id,
      scheduleId: schedule.id,
      patientId: schedule.patientId,
      fromDosage: current.dosage,
      toDosage: next.dosage,
    });
  }
  return ready;
}
