/**
 * Unit tests for the GLP-1 titration engine (pure, no I/O).
 * Verifies: schedule build, step-advance-due math, supply/refill date math, and
 * the physician-in-the-loop guarantee that proposeAdvance never mutates/advances.
 */
import { describe, it, expect } from 'vitest';
import {
  buildSchedule,
  getCurrentStep,
  isStepAdvanceDue,
  proposeAdvance,
  computeSupplyEnd,
  computeNextRefillAvailable,
  REFILL_LEAD_DAYS,
  type ScheduleStepState,
} from '@/lib/titration/engine';
import { TITRATION_SCHEDULE } from '@/lib/intake/glp1/clinical-config';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number): Date => new Date(Date.now() - n * MS_PER_DAY);

function step(overrides: Partial<ScheduleStepState> & { stepIndex: number }): ScheduleStepState {
  return {
    dosage: '0.25mg weekly',
    durationDays: 28,
    status: 'PENDING',
    actualStartDate: null,
    physicianApprovedAt: null,
    ...overrides,
  };
}

describe('buildSchedule', () => {
  it('builds one ordered step per configured titration step', () => {
    const steps = buildSchedule();
    expect(steps).toHaveLength(TITRATION_SCHEDULE.length);
    expect(steps[0]).toEqual({ stepIndex: 0, dosage: '0.25mg weekly', durationDays: 28 });
    expect(steps[steps.length - 1].dosage).toBe('2.4mg weekly');
    steps.forEach((s, i) => expect(s.stepIndex).toBe(i));
  });

  it('accepts a custom schedule', () => {
    const steps = buildSchedule([{ dosage: '1mg weekly', durationDays: 14 }]);
    expect(steps).toEqual([{ stepIndex: 0, dosage: '1mg weekly', durationDays: 14 }]);
  });
});

describe('getCurrentStep', () => {
  it('returns the CURRENT step', () => {
    const steps = [step({ stepIndex: 0, status: 'COMPLETED' }), step({ stepIndex: 1, status: 'CURRENT' })];
    expect(getCurrentStep(steps)?.stepIndex).toBe(1);
  });
  it('returns null when none is current', () => {
    expect(getCurrentStep([step({ stepIndex: 0, status: 'PENDING' })])).toBeNull();
  });
});

describe('isStepAdvanceDue', () => {
  it('is false when the step has not actually started', () => {
    expect(isStepAdvanceDue({ durationDays: 28, actualStartDate: null })).toBe(false);
  });
  it('is false before the duration elapses', () => {
    expect(isStepAdvanceDue({ durationDays: 28, actualStartDate: daysAgo(10) })).toBe(false);
  });
  it('is true once the duration has elapsed', () => {
    expect(isStepAdvanceDue({ durationDays: 28, actualStartDate: daysAgo(30) })).toBe(true);
  });
  it('is true exactly at the boundary', () => {
    const start = new Date(Date.now() - 28 * MS_PER_DAY);
    expect(isStepAdvanceDue({ durationDays: 28, actualStartDate: start })).toBe(true);
  });
});

describe('proposeAdvance', () => {
  it('returns null when no step is current', () => {
    expect(proposeAdvance([step({ stepIndex: 0, status: 'PENDING' })])).toBeNull();
  });

  it('returns null when the current step is not yet due', () => {
    const steps = [
      step({ stepIndex: 0, status: 'CURRENT', actualStartDate: daysAgo(5) }),
      step({ stepIndex: 1, status: 'PENDING', dosage: '0.5mg weekly' }),
    ];
    expect(proposeAdvance(steps)).toBeNull();
  });

  it('proposes the next step when the current is due', () => {
    const steps = [
      step({ stepIndex: 0, status: 'CURRENT', actualStartDate: daysAgo(30) }),
      step({ stepIndex: 1, status: 'PENDING', dosage: '0.5mg weekly' }),
    ];
    const proposal = proposeAdvance(steps);
    expect(proposal).toMatchObject({
      fromStepIndex: 0,
      toStepIndex: 1,
      fromDosage: '0.25mg weekly',
      toDosage: '0.5mg weekly',
      eligible: true,
    });
  });

  it('returns null at the maintenance dose (no next step)', () => {
    const steps = [step({ stepIndex: 0, status: 'CURRENT', actualStartDate: daysAgo(30), dosage: '2.4mg weekly' })];
    expect(proposeAdvance(steps)).toBeNull();
  });

  it('returns null when the next step was already physician-approved', () => {
    const steps = [
      step({ stepIndex: 0, status: 'CURRENT', actualStartDate: daysAgo(30) }),
      step({ stepIndex: 1, status: 'PENDING', physicianApprovedAt: new Date() }),
    ];
    expect(proposeAdvance(steps)).toBeNull();
  });

  it('NEVER mutates its input (physician-in-the-loop)', () => {
    const steps = [
      step({ stepIndex: 0, status: 'CURRENT', actualStartDate: daysAgo(30) }),
      step({ stepIndex: 1, status: 'PENDING' }),
    ];
    const before = JSON.parse(JSON.stringify(steps));
    proposeAdvance(steps);
    // Statuses and approval gates are untouched — nothing was advanced.
    expect(JSON.parse(JSON.stringify(steps))).toEqual(before);
    expect(steps[1].status).toBe('PENDING');
    expect(steps[1].physicianApprovedAt).toBeNull();
  });
});

describe('supply + refill date math', () => {
  it('computeSupplyEnd adds the step duration to the send date', () => {
    const sentAt = new Date('2026-06-01T00:00:00.000Z');
    const end = computeSupplyEnd({ durationDays: 28 }, sentAt);
    expect(end.getTime()).toBe(sentAt.getTime() + 28 * MS_PER_DAY);
  });

  it('computeNextRefillAvailable is REFILL_LEAD_DAYS before supply end', () => {
    const supplyEnd = new Date('2026-06-29T00:00:00.000Z');
    const next = computeNextRefillAvailable(supplyEnd);
    expect(next.getTime()).toBe(supplyEnd.getTime() - REFILL_LEAD_DAYS * MS_PER_DAY);
  });
});
