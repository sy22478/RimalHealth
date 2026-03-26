/**
 * DSM-5 Scoring Function Tests
 *
 * Tests for calculateDSM5Score, detectContraindications,
 * assessWithdrawalRisk, and generateProviderDecisionSummary.
 *
 * Covers TASK 3.3.3 and TASK 2.10.4
 *
 * @module tests/unit/scoring
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDSM5Score,
  detectContraindications,
  assessWithdrawalRisk,
  generateProviderDecisionSummary,
} from '@/lib/intake/scoring';
import type {
  DSM5Result,
  ContraindicationResult,
  WithdrawalRiskResult,
  ProviderDecisionSummary,
} from '@/lib/intake/scoring';

// ============================================================================
// Helpers
// ============================================================================

/** Build a Record with the given DSM-5 keys set to true and the rest false. */
function makeDSM5Answers(yesKeys: string[]): Record<string, unknown> {
  const all = [
    'dsm5Q1', 'dsm5Q2', 'dsm5Q3', 'dsm5Q4', 'dsm5Q5',
    'dsm5Q6', 'dsm5Q7', 'dsm5Q8', 'dsm5Q9', 'dsm5Q10', 'dsm5Q11',
  ];
  const answers: Record<string, unknown> = {};
  for (const k of all) {
    answers[k] = yesKeys.includes(k);
  }
  return answers;
}

// ============================================================================
// 3.3.3: calculateDSM5Score
// ============================================================================

describe('calculateDSM5Score', () => {
  it('should return SEVERE when all 11 answers are Yes', () => {
    const answers = makeDSM5Answers([
      'dsm5Q1', 'dsm5Q2', 'dsm5Q3', 'dsm5Q4', 'dsm5Q5',
      'dsm5Q6', 'dsm5Q7', 'dsm5Q8', 'dsm5Q9', 'dsm5Q10', 'dsm5Q11',
    ]);

    const result: DSM5Result = calculateDSM5Score(answers);

    expect(result.score).toBe(11);
    expect(result.severity).toBe('SEVERE');
    expect(result.meetsCriteria).toBe(true);
    expect(result.interpretation).toContain('Severe Alcohol Use Disorder');
  });

  it('should return NONE when all answers are No (score 0)', () => {
    const answers = makeDSM5Answers([]);

    const result: DSM5Result = calculateDSM5Score(answers);

    expect(result.score).toBe(0);
    expect(result.severity).toBe('NONE');
    expect(result.meetsCriteria).toBe(false);
    expect(result.interpretation).toContain('Does not meet diagnostic threshold');
  });

  it('should return NONE when only 1 answer is Yes (below threshold)', () => {
    const answers = makeDSM5Answers(['dsm5Q3']);

    const result: DSM5Result = calculateDSM5Score(answers);

    expect(result.score).toBe(1);
    expect(result.severity).toBe('NONE');
    expect(result.meetsCriteria).toBe(false);
  });

  it('should return MILD when 2 answers are Yes', () => {
    const answers = makeDSM5Answers(['dsm5Q1', 'dsm5Q2']);

    const result: DSM5Result = calculateDSM5Score(answers);

    expect(result.score).toBe(2);
    expect(result.severity).toBe('MILD');
    expect(result.meetsCriteria).toBe(true);
    expect(result.interpretation).toContain('Mild Alcohol Use Disorder');
  });

  it('should return MILD when 3 answers are Yes', () => {
    const answers = makeDSM5Answers(['dsm5Q1', 'dsm5Q4', 'dsm5Q7']);

    const result: DSM5Result = calculateDSM5Score(answers);

    expect(result.score).toBe(3);
    expect(result.severity).toBe('MILD');
    expect(result.meetsCriteria).toBe(true);
  });

  it('should return MODERATE when 4 answers are Yes', () => {
    const answers = makeDSM5Answers(['dsm5Q1', 'dsm5Q2', 'dsm5Q3', 'dsm5Q4']);

    const result: DSM5Result = calculateDSM5Score(answers);

    expect(result.score).toBe(4);
    expect(result.severity).toBe('MODERATE');
    expect(result.meetsCriteria).toBe(true);
    expect(result.interpretation).toContain('Moderate Alcohol Use Disorder');
  });

  it('should return MODERATE when 5 answers are Yes', () => {
    const answers = makeDSM5Answers([
      'dsm5Q1', 'dsm5Q2', 'dsm5Q3', 'dsm5Q4', 'dsm5Q5',
    ]);

    const result: DSM5Result = calculateDSM5Score(answers);

    expect(result.score).toBe(5);
    expect(result.severity).toBe('MODERATE');
    expect(result.meetsCriteria).toBe(true);
  });

  it('should return SEVERE when 6 answers are Yes (boundary)', () => {
    const answers = makeDSM5Answers([
      'dsm5Q1', 'dsm5Q2', 'dsm5Q3', 'dsm5Q4', 'dsm5Q5', 'dsm5Q6',
    ]);

    const result: DSM5Result = calculateDSM5Score(answers);

    expect(result.score).toBe(6);
    expect(result.severity).toBe('SEVERE');
    expect(result.meetsCriteria).toBe(true);
  });
});

// ============================================================================
// 3.3.3: detectContraindications
// ============================================================================

describe('detectContraindications', () => {
  it('should flag absolute contraindication for opioid use', () => {
    const answers: Record<string, unknown> = {
      opioidUse: ['heroin', 'prescription-opioids'],
    };

    const result: ContraindicationResult = detectContraindications(answers);

    expect(result.hasAbsoluteContraindication).toBe(true);
    expect(result.absolute.length).toBeGreaterThanOrEqual(1);
    expect(result.absolute[0]).toContain('Active opioid use');
  });

  it('should NOT flag opioid use when value is ["none"]', () => {
    const answers: Record<string, unknown> = {
      opioidUse: ['none'],
    };

    const result = detectContraindications(answers);

    expect(result.hasAbsoluteContraindication).toBe(false);
    expect(result.absolute).toHaveLength(0);
  });

  it('should flag absolute contraindication for opioid maintenance program', () => {
    const answers: Record<string, unknown> = {
      opioidMaintenance: true,
    };

    const result = detectContraindications(answers);

    expect(result.hasAbsoluteContraindication).toBe(true);
    expect(result.absolute.some((s) => s.includes('maintenance program'))).toBe(true);
  });

  it('should flag absolute contraindication for liver failure', () => {
    const answers: Record<string, unknown> = {
      liverCondition: 'liver-failure',
    };

    const result = detectContraindications(answers);

    expect(result.hasAbsoluteContraindication).toBe(true);
    expect(result.absolute.some((s) => s.includes('Liver failure'))).toBe(true);
  });

  it('should flag relative contraindication for cirrhosis', () => {
    const answers: Record<string, unknown> = {
      liverCondition: 'cirrhosis',
    };

    const result = detectContraindications(answers);

    expect(result.hasAbsoluteContraindication).toBe(false);
    expect(result.hasRelativeContraindication).toBe(true);
    expect(result.relative.some((s) => s.includes('Cirrhosis'))).toBe(true);
  });

  it('should flag relative contraindication for pregnancy', () => {
    const answers: Record<string, unknown> = {
      pregnancyStatus: 'pregnant',
    };

    const result = detectContraindications(answers);

    expect(result.hasAbsoluteContraindication).toBe(false);
    expect(result.hasRelativeContraindication).toBe(true);
    expect(result.relative.some((s) => s.includes('pregnant'))).toBe(true);
  });

  it('should flag relative contraindication for breastfeeding', () => {
    const answers: Record<string, unknown> = {
      pregnancyStatus: 'breastfeeding',
    };

    const result = detectContraindications(answers);

    expect(result.hasRelativeContraindication).toBe(true);
    expect(result.relative.some((s) => s.includes('breastfeeding'))).toBe(true);
  });

  it('should flag absolute contraindication for naltrexone allergy', () => {
    const answers: Record<string, unknown> = {
      drugAllergies: 'naltrexone',
    };

    const result = detectContraindications(answers);

    expect(result.hasAbsoluteContraindication).toBe(true);
    expect(result.absolute.some((s) => s.includes('allergy to naltrexone'))).toBe(true);
  });

  it('should return no contraindications when answers are clean', () => {
    const answers: Record<string, unknown> = {
      opioidUse: ['none'],
      opioidMaintenance: false,
      liverCondition: 'none',
      pregnancyStatus: 'none',
      drugAllergies: 'none',
    };

    const result = detectContraindications(answers);

    expect(result.hasAbsoluteContraindication).toBe(false);
    expect(result.hasRelativeContraindication).toBe(false);
    expect(result.absolute).toHaveLength(0);
    expect(result.relative).toHaveLength(0);
  });

  it('should return no contraindications for empty answers', () => {
    const result = detectContraindications({});

    expect(result.hasAbsoluteContraindication).toBe(false);
    expect(result.hasRelativeContraindication).toBe(false);
  });
});

// ============================================================================
// 3.3.3: assessWithdrawalRisk
// ============================================================================

describe('assessWithdrawalRisk', () => {
  it('should detect elevated risk from seizure history', () => {
    const answers: Record<string, unknown> = {
      withdrawalSeizure: true,
    };

    const result: WithdrawalRiskResult = assessWithdrawalRisk(answers);

    expect(result.isElevated).toBe(true);
    expect(result.riskFactors.length).toBeGreaterThanOrEqual(1);
    expect(result.riskFactors[0]).toContain('seizures');
    expect(result.recommendation).toContain('ELEVATED');
  });

  it('should detect elevated risk from delirium tremens history', () => {
    const result = assessWithdrawalRisk({ withdrawalDTs: true });

    expect(result.isElevated).toBe(true);
    expect(result.riskFactors.some((f) => f.includes('delirium tremens'))).toBe(true);
  });

  it('should flag HIGH withdrawal risk when 3+ factors are present', () => {
    const answers: Record<string, unknown> = {
      withdrawalSeizure: true,
      withdrawalDTs: true,
      withdrawalHospitalized: true,
    };

    const result = assessWithdrawalRisk(answers);

    expect(result.isElevated).toBe(true);
    expect(result.riskFactors).toHaveLength(3);
    expect(result.recommendation).toContain('HIGH');
  });

  it('should return normal risk when no history is present', () => {
    const answers: Record<string, unknown> = {
      withdrawalSeizure: false,
      withdrawalDTs: false,
      withdrawalHospitalized: false,
      morningDrinking: false,
    };

    const result = assessWithdrawalRisk(answers);

    expect(result.isElevated).toBe(false);
    expect(result.riskFactors).toHaveLength(0);
    expect(result.recommendation).toContain('No significant withdrawal risk');
  });

  it('should return normal risk for empty answers', () => {
    const result = assessWithdrawalRisk({});

    expect(result.isElevated).toBe(false);
    expect(result.riskFactors).toHaveLength(0);
  });

  it('should detect morning drinking as a risk factor', () => {
    const result = assessWithdrawalRisk({ morningDrinking: true });

    expect(result.isElevated).toBe(true);
    expect(result.riskFactors.some((f) => f.includes('Morning drinking'))).toBe(true);
  });
});

// ============================================================================
// 3.3.3: generateProviderDecisionSummary
// ============================================================================

describe('generateProviderDecisionSummary', () => {
  it('should generate a complete summary for a patient with severe AUD and no contraindications', () => {
    const formData: Record<string, unknown> = {
      // All DSM-5 Yes
      dsm5Q1: true, dsm5Q2: true, dsm5Q3: true, dsm5Q4: true, dsm5Q5: true,
      dsm5Q6: true, dsm5Q7: true, dsm5Q8: true, dsm5Q9: true, dsm5Q10: true, dsm5Q11: true,
      // No contraindications
      opioidUse: ['none'],
      opioidMaintenance: false,
      liverCondition: 'none',
      pregnancyStatus: 'none',
      // No withdrawal risk
      withdrawalSeizure: false,
      withdrawalDTs: false,
      withdrawalHospitalized: false,
      morningDrinking: false,
    };

    const result: ProviderDecisionSummary = generateProviderDecisionSummary(formData);

    expect(result.dsm5.score).toBe(11);
    expect(result.dsm5.severity).toBe('SEVERE');
    expect(result.contraindications.hasAbsoluteContraindication).toBe(false);
    expect(result.withdrawalRisk.isElevated).toBe(false);
    expect(result.eligibleForNaltrexone).toBe(true);
    // Severe DSM-5 with high risk score -> ELEVATED priority
    expect(['ELEVATED', 'URGENT']).toContain(result.priority);
    expect(result.summary).toContain('DSM-5: 11/11 (SEVERE)');
    expect(result.riskScore).toBeGreaterThanOrEqual(0);
    expect(result.complexityScore).toBeGreaterThanOrEqual(0);
  });

  it('should mark CONTRAINDICATED priority when absolute contraindication exists', () => {
    const formData: Record<string, unknown> = {
      dsm5Q1: true, dsm5Q2: true, dsm5Q3: false, dsm5Q4: false, dsm5Q5: false,
      dsm5Q6: false, dsm5Q7: false, dsm5Q8: false, dsm5Q9: false, dsm5Q10: false, dsm5Q11: false,
      opioidUse: ['heroin'],
      opioidMaintenance: false,
      liverCondition: 'none',
      pregnancyStatus: 'none',
    };

    const result = generateProviderDecisionSummary(formData);

    expect(result.eligibleForNaltrexone).toBe(false);
    expect(result.priority).toBe('CONTRAINDICATED');
    expect(result.summary).toContain('ABSOLUTE CONTRAINDICATION');
  });

  it('should mark URGENT priority when withdrawal risk is elevated', () => {
    const formData: Record<string, unknown> = {
      dsm5Q1: true, dsm5Q2: true, dsm5Q3: false, dsm5Q4: false, dsm5Q5: false,
      dsm5Q6: false, dsm5Q7: false, dsm5Q8: false, dsm5Q9: false, dsm5Q10: false, dsm5Q11: false,
      opioidUse: ['none'],
      opioidMaintenance: false,
      liverCondition: 'none',
      pregnancyStatus: 'none',
      withdrawalSeizure: true,
    };

    const result = generateProviderDecisionSummary(formData);

    expect(result.priority).toBe('URGENT');
    expect(result.withdrawalRisk.isElevated).toBe(true);
  });

  it('should mark ROUTINE priority for mild AUD with no complications', () => {
    const formData: Record<string, unknown> = {
      dsm5Q1: true, dsm5Q2: true, dsm5Q3: false, dsm5Q4: false, dsm5Q5: false,
      dsm5Q6: false, dsm5Q7: false, dsm5Q8: false, dsm5Q9: false, dsm5Q10: false, dsm5Q11: false,
      opioidUse: ['none'],
      opioidMaintenance: false,
      liverCondition: 'none',
      pregnancyStatus: 'none',
      withdrawalSeizure: false,
      withdrawalDTs: false,
      withdrawalHospitalized: false,
      morningDrinking: false,
    };

    const result = generateProviderDecisionSummary(formData);

    expect(result.dsm5.severity).toBe('MILD');
    expect(result.priority).toBe('ROUTINE');
    expect(result.eligibleForNaltrexone).toBe(true);
  });

  it('should include risk and complexity scores in the summary text', () => {
    const formData: Record<string, unknown> = {
      dsm5Q1: true, dsm5Q2: false, dsm5Q3: false, dsm5Q4: false, dsm5Q5: false,
      dsm5Q6: false, dsm5Q7: false, dsm5Q8: false, dsm5Q9: false, dsm5Q10: false, dsm5Q11: false,
    };

    const result = generateProviderDecisionSummary(formData);

    expect(result.summary).toContain('Risk score:');
    expect(result.summary).toContain('Complexity:');
  });
});

// ============================================================================
// 2.10.4: DSM-5 Scoring Edge Cases
// ============================================================================

describe('calculateDSM5Score edge cases', () => {
  it('should not crash with completely empty object', () => {
    const result = calculateDSM5Score({});

    expect(result.score).toBe(0);
    expect(result.severity).toBe('NONE');
    expect(result.meetsCriteria).toBe(false);
  });

  it('should not crash with null-valued formData fields', () => {
    const answers: Record<string, unknown> = {
      dsm5Q1: null,
      dsm5Q2: null,
      dsm5Q3: null,
      dsm5Q4: null,
      dsm5Q5: null,
      dsm5Q6: null,
      dsm5Q7: null,
      dsm5Q8: null,
      dsm5Q9: null,
      dsm5Q10: null,
      dsm5Q11: null,
    };

    const result = calculateDSM5Score(answers);

    expect(result.score).toBe(0);
    expect(result.severity).toBe('NONE');
    expect(result.meetsCriteria).toBe(false);
  });

  it('should not crash with undefined-valued formData fields', () => {
    const answers: Record<string, unknown> = {
      dsm5Q1: undefined,
      dsm5Q2: undefined,
      dsm5Q3: undefined,
    };

    const result = calculateDSM5Score(answers);

    expect(result.score).toBe(0);
    expect(result.severity).toBe('NONE');
  });

  it('should not count empty string answers as Yes', () => {
    const answers: Record<string, unknown> = {
      dsm5Q1: '',
      dsm5Q2: '',
      dsm5Q3: '',
      dsm5Q4: '',
      dsm5Q5: '',
      dsm5Q6: '',
      dsm5Q7: '',
      dsm5Q8: '',
      dsm5Q9: '',
      dsm5Q10: '',
      dsm5Q11: '',
    };

    const result = calculateDSM5Score(answers);

    expect(result.score).toBe(0);
    expect(result.severity).toBe('NONE');
    expect(result.meetsCriteria).toBe(false);
  });

  it('should not count string "true" as boolean true', () => {
    const answers: Record<string, unknown> = {
      dsm5Q1: 'true',
      dsm5Q2: 'true',
      dsm5Q3: 'true',
    };

    const result = calculateDSM5Score(answers);

    // The filter checks === true (boolean), so strings should not count
    expect(result.score).toBe(0);
    expect(result.severity).toBe('NONE');
  });

  it('should handle partial form with only some DSM-5 keys present (Section 1 only)', () => {
    // Only dsm5Q1 through dsm5Q4 are set (simulating partial intake)
    const answers: Record<string, unknown> = {
      dsm5Q1: true,
      dsm5Q2: true,
      dsm5Q3: true,
      dsm5Q4: false,
      // Q5-Q11 not present at all
    };

    const result = calculateDSM5Score(answers);

    expect(result.score).toBe(3);
    expect(result.severity).toBe('MILD');
    expect(result.meetsCriteria).toBe(true);
  });

  it('should handle numeric values gracefully (not count them as true)', () => {
    const answers: Record<string, unknown> = {
      dsm5Q1: 1,
      dsm5Q2: 0,
      dsm5Q3: 1,
    };

    const result = calculateDSM5Score(answers);

    // Strict === true check means numbers should not count
    expect(result.score).toBe(0);
  });

  it('should handle mixed valid and invalid values', () => {
    const answers: Record<string, unknown> = {
      dsm5Q1: true,
      dsm5Q2: null,
      dsm5Q3: undefined,
      dsm5Q4: '',
      dsm5Q5: true,
      dsm5Q6: 'yes',
      dsm5Q7: 1,
      dsm5Q8: false,
      dsm5Q9: true,
      dsm5Q10: {},
      dsm5Q11: [],
    };

    const result = calculateDSM5Score(answers);

    // Only dsm5Q1, dsm5Q5, dsm5Q9 are boolean true
    expect(result.score).toBe(3);
    expect(result.severity).toBe('MILD');
  });
});

// ============================================================================
// 2.10.4: detectContraindications edge cases
// ============================================================================

describe('detectContraindications edge cases', () => {
  it('should handle null/undefined fields without crashing', () => {
    const answers: Record<string, unknown> = {
      opioidUse: null,
      opioidMaintenance: null,
      liverCondition: null,
      pregnancyStatus: null,
      drugAllergies: null,
    };

    const result = detectContraindications(answers);

    expect(result.hasAbsoluteContraindication).toBe(false);
    expect(result.hasRelativeContraindication).toBe(false);
  });

  it('should handle undefined fields without crashing', () => {
    const answers: Record<string, unknown> = {
      opioidUse: undefined,
      opioidMaintenance: undefined,
      liverCondition: undefined,
      pregnancyStatus: undefined,
      drugAllergies: undefined,
    };

    const result = detectContraindications(answers);

    expect(result.hasAbsoluteContraindication).toBe(false);
    expect(result.hasRelativeContraindication).toBe(false);
  });

  it('should handle empty array for opioidUse', () => {
    const answers: Record<string, unknown> = {
      opioidUse: [],
    };

    const result = detectContraindications(answers);

    expect(result.hasAbsoluteContraindication).toBe(false);
  });

  it('should handle empty string for liverCondition', () => {
    const answers: Record<string, unknown> = {
      liverCondition: '',
    };

    const result = detectContraindications(answers);

    // Empty string is falsy so the liverCondition block is skipped
    expect(result.hasAbsoluteContraindication).toBe(false);
    expect(result.hasRelativeContraindication).toBe(false);
  });
});

// ============================================================================
// 2.10.4: assessWithdrawalRisk edge cases
// ============================================================================

describe('assessWithdrawalRisk edge cases', () => {
  it('should handle null values for withdrawal fields', () => {
    const answers: Record<string, unknown> = {
      withdrawalSeizure: null,
      withdrawalDTs: null,
      withdrawalHospitalized: null,
      morningDrinking: null,
    };

    const result = assessWithdrawalRisk(answers);

    expect(result.isElevated).toBe(false);
    expect(result.riskFactors).toHaveLength(0);
  });

  it('should not count string "true" as elevated risk', () => {
    const answers: Record<string, unknown> = {
      withdrawalSeizure: 'true',
    };

    const result = assessWithdrawalRisk(answers);

    // Strict === true check
    expect(result.isElevated).toBe(false);
  });
});

// ============================================================================
// 2.10.4: generateProviderDecisionSummary edge cases
// ============================================================================

describe('generateProviderDecisionSummary edge cases', () => {
  it('should not crash with completely empty formData', () => {
    const result = generateProviderDecisionSummary({});

    expect(result.dsm5.score).toBe(0);
    expect(result.dsm5.severity).toBe('NONE');
    expect(result.contraindications.hasAbsoluteContraindication).toBe(false);
    expect(result.withdrawalRisk.isElevated).toBe(false);
    expect(result.eligibleForNaltrexone).toBe(true);
    expect(result.priority).toBe('ROUTINE');
    expect(typeof result.summary).toBe('string');
    expect(typeof result.riskScore).toBe('number');
    expect(typeof result.complexityScore).toBe('number');
  });

  it('should handle formData with all null values', () => {
    const formData: Record<string, unknown> = {
      dsm5Q1: null,
      dsm5Q2: null,
      opioidUse: null,
      liverCondition: null,
      withdrawalSeizure: null,
    };

    const result = generateProviderDecisionSummary(formData);

    expect(result.dsm5.score).toBe(0);
    expect(result.eligibleForNaltrexone).toBe(true);
    expect(typeof result.summary).toBe('string');
  });
});
