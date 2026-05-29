/**
 * GLP-1 titration engine (Phase 4) — PURE functions, no I/O.
 *
 * The engine PROPOSES and computes dates; it NEVER advances a dose or issues a
 * prescription. A physician must explicitly approve each step advance (recorded
 * as `physicianApprovedAt`/`physicianApprovedBy` on the persisted TitrationStep).
 * `proposeAdvance` only reports that a step has become *eligible* for review.
 *
 * Clinical cadence/durations come from `TITRATION_SCHEDULE` in
 * `lib/intake/glp1/clinical-config.ts` (sign-off gated). Dose strings match the
 * Wegovy entry in `MEDICATION_OPTIONS`.
 *
 * @module lib/titration/engine
 */
import { TITRATION_SCHEDULE } from '@/lib/intake/glp1/clinical-config';

/** Lead time before a supply runs out that a refill becomes available. */
export const REFILL_LEAD_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type TitrationStepStatus = 'PENDING' | 'CURRENT' | 'COMPLETED' | 'SKIPPED';

/** A planned step produced when a schedule is first built. */
export interface PlannedStep {
  stepIndex: number;
  dosage: string;
  durationDays: number;
}

/** The runtime state of a step on a persisted schedule. */
export interface ScheduleStepState {
  stepIndex: number;
  dosage: string;
  durationDays: number;
  status: TitrationStepStatus;
  /** When the patient actually started this dose; null until advanced. */
  actualStartDate: Date | null;
  /** Physician-in-the-loop gate; null means this step was never approved. */
  physicianApprovedAt: Date | null;
}

/** A non-mutating recommendation that the current step is due to advance. */
export interface AdvanceProposal {
  fromStepIndex: number;
  toStepIndex: number;
  fromDosage: string;
  toDosage: string;
  /** Always true when returned; null is returned instead when not eligible. */
  eligible: true;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * Build the initial ordered set of planned steps for a new GLP-1 prescription.
 * Defaults to the sign-off-gated `TITRATION_SCHEDULE`.
 */
export function buildSchedule(
  schedule: ReadonlyArray<{ dosage: string; durationDays: number }> = TITRATION_SCHEDULE
): PlannedStep[] {
  return schedule.map((step, stepIndex) => ({
    stepIndex,
    dosage: step.dosage,
    durationDays: step.durationDays,
  }));
}

/** Return the step currently being taken, or null if none is marked CURRENT. */
export function getCurrentStep(
  steps: ReadonlyArray<ScheduleStepState>
): ScheduleStepState | null {
  return steps.find((s) => s.status === 'CURRENT') ?? null;
}

/**
 * Whether a step's planned duration has elapsed, making it ELIGIBLE for a
 * physician-reviewed advance. A step that has not actually started (no
 * `actualStartDate`) is never due.
 */
export function isStepAdvanceDue(
  step: Pick<ScheduleStepState, 'durationDays' | 'actualStartDate'>,
  now: Date = new Date()
): boolean {
  if (!step.actualStartDate) return false;
  const dueAt = addDays(step.actualStartDate, step.durationDays);
  return now.getTime() >= dueAt.getTime();
}

/**
 * Propose (but never perform) the next dose advance. Returns a recommendation
 * when the current step's duration has elapsed and a subsequent un-advanced step
 * exists; returns null otherwise (e.g. at the maintenance dose, or not yet due).
 *
 * This function does NOT mutate its input and does NOT approve anything — the
 * physician approval step is a separate, explicit write.
 */
export function proposeAdvance(
  steps: ReadonlyArray<ScheduleStepState>,
  now: Date = new Date()
): AdvanceProposal | null {
  const current = getCurrentStep(steps);
  if (!current) return null;
  if (!isStepAdvanceDue(current, now)) return null;

  const next = steps.find((s) => s.stepIndex === current.stepIndex + 1);
  // No next step (already at maintenance) or it was already advanced/approved.
  if (!next || next.physicianApprovedAt) return null;

  return {
    fromStepIndex: current.stepIndex,
    toStepIndex: next.stepIndex,
    fromDosage: current.dosage,
    toDosage: next.dosage,
    eligible: true,
  };
}

/**
 * End of the supply dispensed for a step: when the patient started it plus the
 * step's duration. Used to set `Prescription.supplyEndDate` at send time.
 */
export function computeSupplyEnd(
  step: Pick<ScheduleStepState, 'durationDays'>,
  sentAt: Date
): Date {
  return addDays(sentAt, step.durationDays);
}

/** Refill becomes available `REFILL_LEAD_DAYS` before the supply ends. */
export function computeNextRefillAvailable(supplyEnd: Date): Date {
  return addDays(supplyEnd, -REFILL_LEAD_DAYS);
}
