/**
 * Unit tests for refill eligibility — the GLP-1 lab gate + supplyEndDate
 * preference are additive, and AUD (no labGate / no supplyEndDate) is unchanged.
 */
import { describe, it, expect } from 'vitest';
import { canRequestRefill, getRefillEligibilityMessage } from '@/types/prescriptions';
import { PrescriptionStatus } from '@prisma/client';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number): Date => new Date(Date.now() + n * MS_PER_DAY);

describe('canRequestRefill — AUD regression (no lab gate, no supply window)', () => {
  it('is eligible within 7 days of the refill date', () => {
    expect(
      canRequestRefill({
        nextRefillAvailable: inDays(3),
        refillsRemaining: 2,
        status: PrescriptionStatus.ACTIVE,
      })
    ).toBe(true);
  });

  it('is not eligible when the refill date is far out', () => {
    expect(
      canRequestRefill({
        nextRefillAvailable: inDays(30),
        refillsRemaining: 2,
        status: PrescriptionStatus.ACTIVE,
      })
    ).toBe(false);
  });

  it('is not eligible with no refills remaining', () => {
    expect(
      canRequestRefill({
        nextRefillAvailable: inDays(1),
        refillsRemaining: 0,
        status: PrescriptionStatus.ACTIVE,
      })
    ).toBe(false);
  });
});

describe('canRequestRefill — GLP-1 lab gate', () => {
  const base = {
    nextRefillAvailable: inDays(2),
    refillsRemaining: 3,
    status: PrescriptionStatus.ACTIVE,
  };

  it('blocks when the lab gate is required and not passed', () => {
    expect(canRequestRefill({ ...base, labGate: { required: true, passed: false } })).toBe(false);
  });

  it('allows when the lab gate is required and passed', () => {
    expect(canRequestRefill({ ...base, labGate: { required: true, passed: true } })).toBe(true);
  });

  it('ignores the gate when not required (AUD)', () => {
    expect(canRequestRefill({ ...base, labGate: { required: false, passed: false } })).toBe(true);
  });
});

describe('canRequestRefill — supplyEndDate preference', () => {
  it('derives the refill window from supplyEndDate when present', () => {
    // supplyEnd in 9 days → refill window opens in 2 days (supplyEnd - 7) → eligible,
    // even though nextRefillAvailable is far out.
    expect(
      canRequestRefill({
        nextRefillAvailable: inDays(60),
        supplyEndDate: inDays(9),
        refillsRemaining: 3,
        status: PrescriptionStatus.ACTIVE,
      })
    ).toBe(true);
  });

  it('is not eligible when supplyEndDate is far out', () => {
    expect(
      canRequestRefill({
        nextRefillAvailable: inDays(1),
        supplyEndDate: inDays(40),
        refillsRemaining: 3,
        status: PrescriptionStatus.ACTIVE,
      })
    ).toBe(false);
  });
});

describe('getRefillEligibilityMessage — lab gate', () => {
  it('returns the lab-required message when the gate blocks', () => {
    const msg = getRefillEligibilityMessage({
      nextRefillAvailable: inDays(2),
      refillsRemaining: 3,
      status: PrescriptionStatus.ACTIVE,
      labGate: { required: true, passed: false },
    });
    expect(msg).toMatch(/recent lab result is required/i);
  });
});
