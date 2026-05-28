/**
 * Unit tests for the GLP-1 intake scoring/triage module.
 */
import { describe, it, expect } from 'vitest';
import {
  calculateBmi,
  classifyEligibility,
  evaluateContraindications,
  getDrugInteractionFlags,
  calculatePhq2Score,
  getEmergencyFlags,
  scoreGlp1Intake,
} from '@/lib/intake/glp1/scoring';
import { PHQ2_POSITIVE_CUTOFF, BMI_THRESHOLDS } from '@/lib/intake/glp1/clinical-config';
import type { Glp1FormData } from '@/lib/intake/glp1/types';

/** A clean, eligible baseline with no flags. Override per test. */
function baseAnswers(overrides: Partial<Glp1FormData> = {}): Glp1FormData {
  return {
    // Step 1 — height 5'10", weight 230 → BMI ~33 (ELIGIBLE)
    firstName: 'Test',
    lastName: 'Patient',
    dateOfBirth: '1990-01-01',
    biologicalSex: 'FEMALE',
    phone: '5551234567',
    addressStreet: '1 Main St',
    addressCity: 'Los Angeles',
    addressState: 'CA',
    addressZip: '90012',
    heightFeet: 5,
    heightInches: 10,
    weightLbs: 230,
    emergencyContactName: 'Jane Doe',
    emergencyContactPhone: '5559876543',
    emergencyContactRelationship: 'Spouse',
    // Step 2
    highestAdultWeightLbs: 240,
    goalWeightLbs: 180,
    weightLossMethodsTried: [],
    weightChangePastYear: 'stable',
    hadBariatricSurgery: false,
    priorWeightLossMeds: false,
    // Step 3
    medicalConditions: [],
    recentHospitalization: false,
    // Step 5 — all contraindications negative
    personalHistoryMTC: false,
    familyHistoryMTC: false,
    men2Syndrome: false,
    pancreatitisHistory: false,
    gallbladderDisease: false,
    severeGastroparesis: false,
    pregnancyStatus: 'none',
    endStageRenalDisease: false,
    suicidalIdeation: false,
    // Step 6
    currentlyTakingMedications: false,
    medicationList: [],
    hasDrugAllergies: false,
    takingInsulinOrSulfonylurea: false,
    takingOtherGlp1: false,
    // Step 7
    hasRecentLabs: false,
    // Step 8
    dietPattern: 'balanced',
    exerciseFrequency: '1-2-week',
    alcoholUse: 'none',
    tobaccoUse: 'never',
    recreationalSubstances: false,
    stressLevel: 'low',
    emotionalEating: 'never',
    // Step 9
    upcomingSurgery: false,
    // Step 10 — PHQ-2 = 0
    eatingDisorderHistory: false,
    phq2Interest: '0',
    phq2Down: '0',
    mentalHealthConditions: [],
    currentMentalHealthTreatment: false,
    // Step 11 — Referral & care coordination
    hasPrimaryCarePhysician: false,
    // Step 12 — Review & consent
    ackInfoAccurate: true,
    ackClinicalIndication: true,
    ackFollowUpCompliance: true,
    ...overrides,
  };
}

describe('calculateBmi', () => {
  it('computes BMI from US units (5\'10", 230 lbs ≈ 33.0)', () => {
    expect(calculateBmi(5, 10, 230)).toBe(33);
  });

  it('computes BMI for 6\'0", 200 lbs ≈ 27.1', () => {
    expect(calculateBmi(6, 0, 200)).toBe(27.1);
  });

  it('computes BMI for 5\'4", 150 lbs ≈ 25.7', () => {
    expect(calculateBmi(5, 4, 150)).toBe(25.7);
  });

  it('returns 0 for missing/zero height', () => {
    expect(calculateBmi(0, 0, 200)).toBe(0);
    expect(calculateBmi(undefined, undefined, 200)).toBe(0);
  });

  it('returns 0 for missing/zero weight', () => {
    expect(calculateBmi(5, 10, 0)).toBe(0);
    expect(calculateBmi(5, 10, undefined)).toBe(0);
  });
});

describe('classifyEligibility (boundary values)', () => {
  it('classifies at/above the eligible threshold as ELIGIBLE', () => {
    expect(classifyEligibility(BMI_THRESHOLDS.eligible)).toBe('ELIGIBLE');
    expect(classifyEligibility(BMI_THRESHOLDS.eligible + 5)).toBe('ELIGIBLE');
  });

  it('classifies the borderline band correctly', () => {
    expect(classifyEligibility(BMI_THRESHOLDS.borderline)).toBe('BORDERLINE');
    expect(classifyEligibility(BMI_THRESHOLDS.eligible - 0.1)).toBe('BORDERLINE');
  });

  it('classifies below borderline as INELIGIBLE', () => {
    expect(classifyEligibility(BMI_THRESHOLDS.borderline - 0.1)).toBe('INELIGIBLE');
    expect(classifyEligibility(22)).toBe('INELIGIBLE');
  });
});

describe('evaluateContraindications', () => {
  it('returns no flags for a clean baseline', () => {
    expect(evaluateContraindications(baseAnswers())).toEqual([]);
  });

  it.each([
    ['personalHistoryMTC'],
    ['familyHistoryMTC'],
    ['men2Syndrome'],
    ['pancreatitisHistory'],
  ] as const)('flags %s as HARD_STOP', (field) => {
    const flags = evaluateContraindications(baseAnswers({ [field]: true } as Partial<Glp1FormData>));
    expect(flags).toHaveLength(1);
    expect(flags[0].disposition).toBe('HARD_STOP');
  });

  it.each([
    ['gallbladderDisease'],
    ['severeGastroparesis'],
    ['endStageRenalDisease'],
  ] as const)('flags %s as PHYSICIAN_FLAG', (field) => {
    const flags = evaluateContraindications(baseAnswers({ [field]: true } as Partial<Glp1FormData>));
    expect(flags).toHaveLength(1);
    expect(flags[0].disposition).toBe('PHYSICIAN_FLAG');
  });

  it('treats pregnant / trying-to-conceive as HARD_STOP', () => {
    expect(evaluateContraindications(baseAnswers({ pregnancyStatus: 'pregnant' }))[0]?.disposition).toBe('HARD_STOP');
    expect(evaluateContraindications(baseAnswers({ pregnancyStatus: 'trying-to-conceive' }))[0]?.disposition).toBe('HARD_STOP');
  });

  it('does not flag breastfeeding or none for pregnancy', () => {
    expect(evaluateContraindications(baseAnswers({ pregnancyStatus: 'breastfeeding' }))).toEqual([]);
    expect(evaluateContraindications(baseAnswers({ pregnancyStatus: 'none' }))).toEqual([]);
  });

  it('accumulates multiple contraindications', () => {
    const flags = evaluateContraindications(
      baseAnswers({ men2Syndrome: true, gallbladderDisease: true })
    );
    expect(flags).toHaveLength(2);
    expect(flags.some((f) => f.disposition === 'HARD_STOP')).toBe(true);
    expect(flags.some((f) => f.disposition === 'PHYSICIAN_FLAG')).toBe(true);
  });
});

describe('getDrugInteractionFlags', () => {
  it('detects interaction meds by name (case-insensitive)', () => {
    const flags = getDrugInteractionFlags(
      baseAnswers({
        medicationList: [
          { name: 'Warfarin', dosage: '5mg', frequency: 'daily', reason: 'AFib' },
          { name: 'Lisinopril', dosage: '10mg', frequency: 'daily', reason: 'BP' },
        ],
      })
    );
    expect(flags).toContain('Warfarin');
    expect(flags).not.toContain('Lisinopril');
  });

  it('flags the insulin/sulfonylurea yes/no field', () => {
    const flags = getDrugInteractionFlags(baseAnswers({ takingInsulinOrSulfonylurea: true }));
    expect(flags.some((f) => f.toLowerCase().includes('insulin'))).toBe(true);
  });

  it('flags concurrent GLP-1 use', () => {
    const flags = getDrugInteractionFlags(baseAnswers({ takingOtherGlp1: true }));
    expect(flags.some((f) => f.toLowerCase().includes('glp-1'))).toBe(true);
  });

  it('returns no flags for non-interacting meds', () => {
    expect(
      getDrugInteractionFlags(
        baseAnswers({ medicationList: [{ name: 'Vitamin D', dosage: '1000IU', frequency: 'daily', reason: 'supplement' }] })
      )
    ).toEqual([]);
  });

  it('guards against a non-array medicationList', () => {
    const bad = baseAnswers();
    // Simulate corrupted draft data
    (bad as unknown as Record<string, unknown>).medicationList = 'not-an-array';
    expect(() => getDrugInteractionFlags(bad)).not.toThrow();
    expect(getDrugInteractionFlags(bad)).toEqual([]);
  });
});

describe('calculatePhq2Score + getEmergencyFlags', () => {
  it('sums the two PHQ-2 items', () => {
    expect(calculatePhq2Score(baseAnswers({ phq2Interest: '2', phq2Down: '3' }))).toBe(5);
    expect(calculatePhq2Score(baseAnswers({ phq2Interest: '0', phq2Down: '0' }))).toBe(0);
  });

  it('flags suicidal ideation (Q37)', () => {
    const flags = getEmergencyFlags(baseAnswers({ suicidalIdeation: true }), 0);
    expect(flags).toHaveLength(1);
    expect(flags[0].source).toBe('Q37');
  });

  it('flags a positive PHQ-2 at the cutoff (Q56)', () => {
    const flags = getEmergencyFlags(baseAnswers(), PHQ2_POSITIVE_CUTOFF);
    expect(flags).toHaveLength(1);
    expect(flags[0].source).toBe('Q56');
  });

  it('does not flag a PHQ-2 below the cutoff', () => {
    expect(getEmergencyFlags(baseAnswers(), PHQ2_POSITIVE_CUTOFF - 1)).toEqual([]);
  });

  it('reports both triggers when present', () => {
    const flags = getEmergencyFlags(baseAnswers({ suicidalIdeation: true }), PHQ2_POSITIVE_CUTOFF);
    expect(flags).toHaveLength(2);
  });
});

describe('scoreGlp1Intake (priority precedence + result shape)', () => {
  it('a clean eligible intake is ROUTINE and not urgent', () => {
    const r = scoreGlp1Intake(baseAnswers());
    expect(r.eligibilityBand).toBe('ELIGIBLE');
    expect(r.priority).toBe('ROUTINE');
    expect(r.requiresUrgentReview).toBe(false);
    expect(r.contraindicationFlags).toEqual([]);
    expect(r.emergencyFlags).toEqual([]);
  });

  it('HARD_STOP contraindication → CONTRAINDICATED (and urgent)', () => {
    const r = scoreGlp1Intake(baseAnswers({ personalHistoryMTC: true }));
    expect(r.priority).toBe('CONTRAINDICATED');
    expect(r.requiresUrgentReview).toBe(true);
  });

  it('emergency flag → URGENT when no hard stop', () => {
    const r = scoreGlp1Intake(baseAnswers({ suicidalIdeation: true }));
    expect(r.priority).toBe('URGENT');
    expect(r.requiresUrgentReview).toBe(true);
  });

  it('hard stop outranks an emergency flag', () => {
    const r = scoreGlp1Intake(baseAnswers({ suicidalIdeation: true, men2Syndrome: true }));
    expect(r.priority).toBe('CONTRAINDICATED');
  });

  it('PHYSICIAN_FLAG or drug interaction → ELEVATED', () => {
    expect(scoreGlp1Intake(baseAnswers({ gallbladderDisease: true })).priority).toBe('ELEVATED');
    expect(scoreGlp1Intake(baseAnswers({ takingOtherGlp1: true })).priority).toBe('ELEVATED');
  });

  it('includes computed BMI in the result', () => {
    expect(scoreGlp1Intake(baseAnswers()).bmi).toBe(33);
  });
});
