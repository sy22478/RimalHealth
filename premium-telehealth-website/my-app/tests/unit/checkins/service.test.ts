/**
 * Unit tests for check-in urgent-review detection (pure logic).
 */
import { describe, it, expect, vi } from 'vitest';

// Avoid pulling a real Prisma client into the unit test.
vi.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import { isUrgentCheckIn } from '@/lib/checkins/service';
import type { CheckInResponses } from '@/lib/validation/checkin-schemas';

function responses(overrides: Partial<CheckInResponses> = {}): CheckInResponses {
  return {
    currentWeightLbs: 210,
    doseAdherence: 'none',
    nauseaSeverity: 'none',
    vomitingSeverity: 'none',
    abdominalPain: false,
    ...overrides,
  };
}

describe('isUrgentCheckIn', () => {
  it('is not urgent for a clean check-in', () => {
    expect(isUrgentCheckIn(responses())).toBe(false);
  });

  it('is urgent when abdominal pain is reported', () => {
    expect(isUrgentCheckIn(responses({ abdominalPain: true }))).toBe(true);
  });

  it('is urgent for severe nausea', () => {
    expect(isUrgentCheckIn(responses({ nauseaSeverity: 'severe' }))).toBe(true);
  });

  it('is urgent for severe vomiting', () => {
    expect(isUrgentCheckIn(responses({ vomitingSeverity: 'severe' }))).toBe(true);
  });

  it('is not urgent for moderate symptoms without abdominal pain', () => {
    expect(
      isUrgentCheckIn(responses({ nauseaSeverity: 'moderate', vomitingSeverity: 'mild' }))
    ).toBe(false);
  });
});
