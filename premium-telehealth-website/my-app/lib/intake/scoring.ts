/**
 * Intake Scoring Algorithms
 * Calculates risk and complexity scores for patient intakes
 * 
 * @module lib/intake/scoring
 */

import { IntakeScores, RiskAssessment } from '@/types/intake';

// ============================================================================
// AUDIT-C Scoring
// ============================================================================

/**
 * AUDIT-C Score Interpretation
 * 0-3: Low risk (women), 0-4: Low risk (men)
 * 4-5: Moderate risk (women), 5-6: Moderate risk (men)
 * 6+: High risk (women), 7+: High risk (men)
 * 8+: Severe risk
 */

export interface AuditCResult {
  score: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  interpretation: string;
}

export function calculateAuditCScore(answers: {
  audit_1?: string;
  audit_2?: string;
  audit_3?: string;
}): AuditCResult {
  const q1Score = parseInt(answers.audit_1 || '0', 10);
  const q2Score = parseInt(answers.audit_2 || '0', 10);
  const q3Score = parseInt(answers.audit_3 || '0', 10);
  
  const totalScore = q1Score + q2Score + q3Score;
  
  let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  let interpretation: string;
  
  if (totalScore >= 8) {
    riskLevel = 'SEVERE';
    interpretation = 'Severe alcohol use disorder likely. Immediate medical attention recommended.';
  } else if (totalScore >= 6) {
    riskLevel = 'HIGH';
    interpretation = 'High risk for alcohol use disorder. Medical intervention strongly recommended.';
  } else if (totalScore >= 4) {
    riskLevel = 'MODERATE';
    interpretation = 'Moderate risk. Brief counseling and monitoring recommended.';
  } else {
    riskLevel = 'LOW';
    interpretation = 'Low risk for alcohol use disorder. Continue monitoring.';
  }
  
  return {
    score: totalScore,
    riskLevel,
    interpretation,
  };
}

// ============================================================================
// Risk Score Calculation (0-100)
// ============================================================================

/**
 * Calculate overall risk score based on screening results and medical history
 * Higher score = higher risk/severity
 */

export interface RiskScoreParams {
  auditScore?: number;
  hasSeizureHistory?: boolean;
  hasPsychiatricHistory?: boolean;
  hasLiverDisease?: boolean;
  isPregnant?: boolean;
  quitAttempts?: number;
  concernLevel?: string;
}

export function calculateRiskScore(params: RiskScoreParams): number {
  let score = 0;
  
  // Base score from AUDIT-C screening (max 40 points)
  if (params.auditScore !== undefined) {
    // AUDIT-C: 0-12 scale, map to 0-40 points
    score += Math.min(params.auditScore * 3.33, 40);
  }
  
  // Medical complexity factors (max 30 points)
  if (params.hasSeizureHistory) score += 10;
  if (params.hasPsychiatricHistory) score += 8;
  if (params.hasLiverDisease) score += 10;
  if (params.isPregnant) score += 12;
  
  // Treatment resistance factors (max 20 points)
  if (params.quitAttempts !== undefined) {
    // More quit attempts = higher resistance = higher score
    score += Math.min(params.quitAttempts * 5, 20);
  }
  
  // Concern level adjustment
  if (params.concernLevel) {
    const concernMultiplier: Record<string, number> = {
      'not': 0,
      'slightly': 2,
      'moderately': 5,
      'very': 8,
      'extremely': 10,
    };
    score += concernMultiplier[params.concernLevel] || 0;
  }
  
  // Cap at 100
  return Math.min(Math.round(score), 100);
}

// ============================================================================
// Complexity Score Calculation (0-100)
// ============================================================================

/**
 * Calculate complexity score based on medical factors
 * Higher score = more complex case requiring specialized care
 */

export interface ComplexityScoreParams {
  takingMedications?: boolean;
  medicationCount?: number;
  hasSeizureHistory?: boolean;
  hasPsychiatricHistory?: boolean;
  hasLiverDisease?: boolean;
  hasKidneyDisease?: boolean;
  hasHeartCondition?: boolean;
  isPregnant?: boolean;
  otherConditions?: string;
  previousTreatment?: boolean;
  previousMedications?: string;
}

export function calculateComplexityScore(params: ComplexityScoreParams): number {
  let score = 0;
  
  // Medication complexity (max 20 points)
  if (params.takingMedications) {
    const medCount = params.medicationCount || 1;
    score += Math.min(medCount * 4, 20);
  }
  
  // Medical conditions (max 40 points)
  if (params.hasSeizureHistory) score += 12;
  if (params.hasPsychiatricHistory) score += 10;
  if (params.hasLiverDisease) score += 12;
  if (params.hasKidneyDisease) score += 8;
  if (params.hasHeartCondition) score += 8;
  
  // Pregnancy adds significant complexity
  if (params.isPregnant) score += 15;
  
  // Other conditions (estimate based on text length/detail)
  if (params.otherConditions && params.otherConditions.length > 10) {
    score += Math.min(params.otherConditions.length / 20, 10);
  }
  
  // Previous treatment history
  if (params.previousTreatment) {
    score += 5;
    // If tried medications before, add complexity
    if (params.previousMedications && params.previousMedications.length > 5) {
      score += 10;
    }
  }
  
  // Cap at 100
  return Math.min(Math.round(score), 100);
}

// ============================================================================
// Risk Assessment
// ============================================================================

/**
 * Generate a comprehensive risk assessment based on scores
 */

export function generateRiskAssessment(
  scores: IntakeScores
): RiskAssessment {
  const { riskScore, complexityScore, auditScore } = scores;
  
  let level: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  let description: string;
  const recommendations: string[] = [];
  
  // Determine risk level
  if (riskScore >= 70 || complexityScore >= 70) {
    level = 'SEVERE';
  } else if (riskScore >= 50 || complexityScore >= 50) {
    level = 'HIGH';
  } else if (riskScore >= 25 || complexityScore >= 30) {
    level = 'MODERATE';
  } else {
    level = 'LOW';
  }
  
  // Generate description
  if (auditScore !== undefined) {
    description = `AUDIT-C score of ${auditScore} indicates ${getAuditCRiskLevel(auditScore).toLowerCase()} risk for alcohol use disorder.`;
  } else {
    description = 'Alcohol use assessment incomplete.';
  }
  
  // Generate recommendations based on scores
  if (level === 'SEVERE') {
    recommendations.push('Immediate physician review required');
    recommendations.push('Consider intensive outpatient or inpatient treatment');
    recommendations.push('Medication-assisted treatment strongly recommended');
  } else if (level === 'HIGH') {
    recommendations.push('Priority physician review within 24 hours');
    recommendations.push('Medication-assisted treatment recommended');
    recommendations.push('Regular monitoring and follow-up');
  } else if (level === 'MODERATE') {
    recommendations.push('Standard physician review within 24-48 hours');
    recommendations.push('Consider medication options');
    recommendations.push('Behavioral support recommended');
  } else {
    recommendations.push('Routine physician review');
    recommendations.push('Behavioral interventions may be sufficient');
    recommendations.push('Preventive counseling recommended');
  }
  
  // Add complexity-based recommendations
  if (complexityScore >= 50) {
    recommendations.push('High medical complexity - specialist consultation may be needed');
  }
  if (complexityScore >= 30) {
    recommendations.push('Monitor for medication interactions');
  }
  
  return {
    level,
    description,
    recommendations,
  };
}

// ============================================================================
// DSM-5 Scoring (Primary scoring for AUD Naltrexone Intake Form)
// ============================================================================

/**
 * DSM-5 AUD Severity Levels
 * 0-1 symptoms = No AUD diagnosis
 * 2-3 symptoms = Mild AUD
 * 4-5 symptoms = Moderate AUD
 * 6+  symptoms = Severe AUD
 */

export type DSM5Severity = 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE';

export interface DSM5Result {
  /** Raw count of Yes answers from Q1-Q11 */
  score: number;
  /** DSM-5 severity classification */
  severity: DSM5Severity;
  /** Whether the patient meets AUD criteria (score >= 2) */
  meetsCriteria: boolean;
  /** Human-readable interpretation */
  interpretation: string;
}

/**
 * Calculate DSM-5 AUD score from Q1-Q11 answers.
 * Counts the number of Yes (true) answers.
 */
export function calculateDSM5Score(
  answers: Record<string, unknown>
): DSM5Result {
  const dsm5Keys = [
    'dsm5Q1', 'dsm5Q2', 'dsm5Q3', 'dsm5Q4', 'dsm5Q5',
    'dsm5Q6', 'dsm5Q7', 'dsm5Q8', 'dsm5Q9', 'dsm5Q10', 'dsm5Q11',
  ];

  const score = dsm5Keys.filter(k => answers[k] === true).length;

  let severity: DSM5Severity;
  let interpretation: string;

  if (score >= 6) {
    severity = 'SEVERE';
    interpretation = `${score} of 11 DSM-5 criteria met. Severe Alcohol Use Disorder. Naltrexone strongly recommended with comprehensive treatment plan.`;
  } else if (score >= 4) {
    severity = 'MODERATE';
    interpretation = `${score} of 11 DSM-5 criteria met. Moderate Alcohol Use Disorder. Naltrexone recommended as part of treatment.`;
  } else if (score >= 2) {
    severity = 'MILD';
    interpretation = `${score} of 11 DSM-5 criteria met. Mild Alcohol Use Disorder. Naltrexone may be beneficial with behavioral support.`;
  } else {
    severity = 'NONE';
    interpretation = `${score} of 11 DSM-5 criteria met. Does not meet diagnostic threshold for AUD. Provider discretion advised.`;
  }

  return {
    score,
    severity,
    meetsCriteria: score >= 2,
    interpretation,
  };
}

// ============================================================================
// Contraindication Detection
// ============================================================================

export interface ContraindicationResult {
  /** Absolute contraindications (must not prescribe) */
  absolute: string[];
  /** Relative contraindications (prescribe with caution) */
  relative: string[];
  /** Whether any absolute contraindication exists */
  hasAbsoluteContraindication: boolean;
  /** Whether any relative contraindication exists */
  hasRelativeContraindication: boolean;
}

/**
 * Detect contraindications from intake form answers.
 * Q20 (opioid use) + Q21 (opioid maintenance program) = ABSOLUTE contraindication.
 * Q22 (liver conditions), Q24 (pregnancy), Q25 (naltrexone allergy) = relative contraindications.
 */
export function detectContraindications(
  answers: Record<string, unknown>
): ContraindicationResult {
  const absolute: string[] = [];
  const relative: string[] = [];

  // Q20: Opioid use -- absolute contraindication if any selected (except 'none')
  const opioidUse = answers.opioidUse as string[] | undefined;
  if (Array.isArray(opioidUse) && opioidUse.length > 0 && !opioidUse.includes('none')) {
    absolute.push(`Active opioid use detected: ${opioidUse.join(', ')}. Patient must be opioid-free 7-10 days before naltrexone.`);
  }

  // Q21: Opioid maintenance program -- absolute contraindication
  if (answers.opioidMaintenance === true) {
    absolute.push('Patient is enrolled in methadone/buprenorphine maintenance program. Naltrexone is contraindicated.');
  }

  // Q22: Liver conditions -- relative contraindication
  const liverCondition = answers.liverCondition as string | undefined;
  if (liverCondition && liverCondition !== 'none') {
    if (liverCondition === 'liver-failure') {
      absolute.push('Liver failure detected. Naltrexone is contraindicated.');
    } else if (liverCondition === 'cirrhosis') {
      relative.push('Cirrhosis detected. Liver function tests required before prescribing. Use with extreme caution.');
    } else if (liverCondition === 'acute-hepatitis') {
      relative.push('Acute hepatitis detected. Liver function tests required. Delay naltrexone until resolved.');
    } else if (liverCondition === 'elevated-enzymes') {
      relative.push('Elevated liver enzymes reported. Monitor liver function closely during treatment.');
    }
  }

  // Q24: Pregnancy/breastfeeding -- relative contraindication
  const pregnancyStatus = answers.pregnancyStatus as string | undefined;
  if (pregnancyStatus && pregnancyStatus !== 'none') {
    if (pregnancyStatus === 'pregnant') {
      relative.push('Patient is pregnant. Naltrexone requires individual risk-benefit assessment. Category C medication.');
    } else if (pregnancyStatus === 'breastfeeding') {
      relative.push('Patient is breastfeeding. Naltrexone is excreted in breast milk. Risk-benefit discussion required.');
    } else if (pregnancyStatus === 'planning-pregnancy') {
      relative.push('Patient planning pregnancy. Discuss contraception and timing of naltrexone treatment.');
    }
  }

  // Q25: Drug allergies -- relative or absolute depending on type
  const drugAllergies = answers.drugAllergies as string | undefined;
  if (drugAllergies === 'naltrexone') {
    absolute.push('Known allergy to naltrexone or similar medications. Do not prescribe.');
  }

  return {
    absolute,
    relative,
    hasAbsoluteContraindication: absolute.length > 0,
    hasRelativeContraindication: relative.length > 0,
  };
}

// ============================================================================
// Withdrawal Risk Assessment
// ============================================================================

export interface WithdrawalRiskResult {
  /** Whether elevated withdrawal risk is present */
  isElevated: boolean;
  /** List of risk factors identified */
  riskFactors: string[];
  /** Recommendation for provider */
  recommendation: string;
}

/**
 * Assess withdrawal risk from Q16-Q19.
 * Any Yes answer = elevated withdrawal risk flag.
 */
export function assessWithdrawalRisk(
  answers: Record<string, unknown>
): WithdrawalRiskResult {
  const riskFactors: string[] = [];

  if (answers.withdrawalSeizure === true) {
    riskFactors.push('History of alcohol withdrawal seizures (Q16)');
  }
  if (answers.withdrawalDTs === true) {
    riskFactors.push('History of delirium tremens (Q17)');
  }
  if (answers.withdrawalHospitalized === true) {
    riskFactors.push('Previous hospitalization for alcohol detox/withdrawal (Q18)');
  }
  if (answers.morningDrinking === true) {
    riskFactors.push('Morning drinking to avoid withdrawal symptoms (Q19)');
  }

  const isElevated = riskFactors.length > 0;

  let recommendation: string;
  if (riskFactors.length >= 3) {
    recommendation = 'HIGH withdrawal risk. Supervised medical detox strongly recommended before starting naltrexone. Do not advise abrupt cessation.';
  } else if (riskFactors.length >= 1) {
    recommendation = 'ELEVATED withdrawal risk. Consider supervised tapering or detox before naltrexone. Monitor closely during initiation.';
  } else {
    recommendation = 'No significant withdrawal risk factors identified. Standard naltrexone initiation protocol appropriate.';
  }

  return {
    isElevated,
    riskFactors,
    recommendation,
  };
}

// ============================================================================
// Provider Decision Summary
// ============================================================================

export interface ProviderDecisionSummary {
  /** DSM-5 scoring result */
  dsm5: DSM5Result;
  /** Contraindication analysis */
  contraindications: ContraindicationResult;
  /** Withdrawal risk assessment */
  withdrawalRisk: WithdrawalRiskResult;
  /** Overall risk score (0-100) for prioritization */
  riskScore: number;
  /** Overall complexity score (0-100) */
  complexityScore: number;
  /** Whether the patient is eligible for naltrexone (no absolute contraindications) */
  eligibleForNaltrexone: boolean;
  /** Priority level for physician queue */
  priority: 'ROUTINE' | 'ELEVATED' | 'URGENT' | 'CONTRAINDICATED';
  /** Summary text for physician review */
  summary: string;
}

/**
 * Generate a comprehensive provider decision summary for physician review.
 * Combines DSM-5 scoring, contraindications, withdrawal risk, and overall scores.
 */
export function generateProviderDecisionSummary(
  formData: Record<string, unknown>
): ProviderDecisionSummary {
  const dsm5 = calculateDSM5Score(formData);
  const contraindications = detectContraindications(formData);
  const withdrawalRisk = assessWithdrawalRisk(formData);
  const scores = calculateIntakeScores(formData);

  const eligibleForNaltrexone = !contraindications.hasAbsoluteContraindication;

  let priority: ProviderDecisionSummary['priority'];
  if (contraindications.hasAbsoluteContraindication) {
    priority = 'CONTRAINDICATED';
  } else if (withdrawalRisk.isElevated || contraindications.hasRelativeContraindication) {
    priority = 'URGENT';
  } else if (dsm5.severity === 'SEVERE' || scores.riskScore >= 50) {
    priority = 'ELEVATED';
  } else {
    priority = 'ROUTINE';
  }

  const summaryParts: string[] = [];
  summaryParts.push(`DSM-5: ${dsm5.score}/11 (${dsm5.severity})`);

  if (contraindications.hasAbsoluteContraindication) {
    summaryParts.push(`ABSOLUTE CONTRAINDICATION: ${contraindications.absolute.length} issue(s)`);
  }
  if (contraindications.hasRelativeContraindication) {
    summaryParts.push(`Relative contraindication: ${contraindications.relative.length} issue(s)`);
  }
  if (withdrawalRisk.isElevated) {
    summaryParts.push(`Withdrawal risk: ${withdrawalRisk.riskFactors.length} factor(s)`);
  }
  summaryParts.push(`Risk score: ${scores.riskScore}/100, Complexity: ${scores.complexityScore}/100`);

  return {
    dsm5,
    contraindications,
    withdrawalRisk,
    riskScore: scores.riskScore,
    complexityScore: scores.complexityScore,
    eligibleForNaltrexone,
    priority,
    summary: summaryParts.join(' | '),
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getAuditCRiskLevel(score: number): string {
  if (score >= 8) return 'SEVERE';
  if (score >= 6) return 'HIGH';
  if (score >= 4) return 'MODERATE';
  return 'LOW';
}

// ============================================================================
// Main Scoring Function
// ============================================================================

/**
 * Calculate all scores for an intake form
 */
export function calculateIntakeScores(
  formData: Record<string, unknown>
): IntakeScores {
  // Determine if this is DSM-5 format (has dsm5Q1) or AUDIT-C format (has audit_1)
  const isDSM5 = formData.dsm5Q1 !== undefined;

  // Calculate AUDIT-C score if available
  let auditScore: number | undefined;
  if (formData.audit_1 !== undefined) {
    const auditResult = calculateAuditCScore({
      audit_1: formData.audit_1 as string,
      audit_2: formData.audit_2 as string,
      audit_3: formData.audit_3 as string,
    });
    auditScore = auditResult.score;
  }

  // For DSM-5 format, derive a proxy risk score from DSM-5 symptom count
  // DSM-5 AUD: 2-3 symptoms = mild, 4-5 = moderate, 6+ = severe
  let dsm5Score: number | undefined;
  if (isDSM5) {
    const dsm5Keys = [
      'dsm5Q1', 'dsm5Q2', 'dsm5Q3', 'dsm5Q4', 'dsm5Q5',
      'dsm5Q6', 'dsm5Q7', 'dsm5Q8', 'dsm5Q9', 'dsm5Q10', 'dsm5Q11',
    ];
    dsm5Score = dsm5Keys.filter(k => formData[k] === true).length;
  }

  // Map DSM-5 safety/medical fields to boolean flags for scoring
  const liverCondition = formData.liverCondition as string | undefined;
  const pregnancyStatus = formData.pregnancyStatus as string | undefined;
  const medicalHistoryArray = formData.medicalHistory as string[] | undefined;
  const withdrawalSeizure = formData.withdrawalSeizure as boolean | undefined;

  const hasSeizureHistory = formData.hasSeizureHistory === true
    || formData.hasSeizureHistory === 'true'
    || withdrawalSeizure === true
    || (Array.isArray(medicalHistoryArray) && medicalHistoryArray.includes('seizures'));

  const hasPsychiatricHistory = formData.hasPsychiatricHistory === true
    || formData.hasPsychiatricHistory === 'true'
    || (Array.isArray(medicalHistoryArray) && (
      medicalHistoryArray.includes('depression')
      || medicalHistoryArray.includes('anxiety')
      || medicalHistoryArray.includes('bipolar')
      || medicalHistoryArray.includes('schizophrenia')
      || medicalHistoryArray.includes('ptsd')
    ));

  const hasLiverDisease = formData.hasLiverDisease === true
    || formData.hasLiverDisease === 'true'
    || (liverCondition !== undefined && liverCondition !== 'none');

  const isPregnant = formData.isPregnant === true
    || formData.isPregnant === 'true'
    || (pregnancyStatus !== undefined && pregnancyStatus !== 'none');

  const hasKidneyDisease = formData.hasKidneyDisease === true
    || formData.hasKidneyDisease === 'true'
    || (Array.isArray(medicalHistoryArray) && medicalHistoryArray.includes('kidney'));

  const hasHeartCondition = formData.hasHeartCondition === true
    || formData.hasHeartCondition === 'true'
    || (Array.isArray(medicalHistoryArray) && (
      medicalHistoryArray.includes('heart')
      || medicalHistoryArray.includes('hypertension')
    ));

  const takingMedications = formData.takingMedications === true
    || formData.takingMedications === 'true'
    || formData.currentMedications === true;

  // Calculate quit attempts for risk scoring
  const quitAttempts = parseInt(formData.alcoholQuitAttempts as string || '0', 10);

  // Use AUDIT-C score if available; for DSM-5 map symptom count to 0-12 AUDIT-C equivalent
  const effectiveAuditScore = auditScore ?? (dsm5Score !== undefined ? Math.min(Math.round(dsm5Score * 12 / 11), 12) : undefined);

  // Calculate risk score
  const riskScore = calculateRiskScore({
    auditScore: effectiveAuditScore,
    hasSeizureHistory,
    hasPsychiatricHistory,
    hasLiverDisease,
    isPregnant,
    quitAttempts,
    concernLevel: formData.alcoholConcernLevel as string,
  });

  // Calculate medication count for complexity
  const medicationList = formData.medicationList as string || '';
  const medicationCount = medicationList
    .split('\n')
    .filter(line => line.trim().length > 0)
    .length;

  // Check for previous treatment
  const previousTreatments = formData.previousTreatments as string[] | undefined;
  const hasPreviousTreatment = formData.previousTreatment === true
    || formData.previousTreatment === 'true'
    || (Array.isArray(previousTreatments) && previousTreatments.length > 0);

  // Calculate complexity score
  const complexityScore = calculateComplexityScore({
    takingMedications,
    medicationCount,
    hasSeizureHistory,
    hasPsychiatricHistory,
    hasLiverDisease,
    hasKidneyDisease,
    hasHeartCondition,
    isPregnant,
    otherConditions: formData.otherConditions as string,
    previousTreatment: hasPreviousTreatment,
    previousMedications: formData.previousMedications as string,
  });

  return {
    auditScore: effectiveAuditScore,
    riskScore,
    complexityScore,
  };
}
