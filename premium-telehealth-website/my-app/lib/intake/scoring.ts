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
  // Calculate AUDIT-C score
  const auditResult = calculateAuditCScore({
    audit_1: formData.audit_1 as string,
    audit_2: formData.audit_2 as string,
    audit_3: formData.audit_3 as string,
  });
  const auditScore: number | undefined = auditResult.score;
  
  // Calculate quit attempts for risk scoring
  const quitAttempts = parseInt(formData.alcoholQuitAttempts as string || '0', 10);
  
  // Calculate risk score
  const riskScore = calculateRiskScore({
    auditScore,
    hasSeizureHistory: formData.hasSeizureHistory === true || formData.hasSeizureHistory === 'true',
    hasPsychiatricHistory: formData.hasPsychiatricHistory === true || formData.hasPsychiatricHistory === 'true',
    hasLiverDisease: formData.hasLiverDisease === true || formData.hasLiverDisease === 'true',
    isPregnant: formData.isPregnant === true || formData.isPregnant === 'true',
    quitAttempts,
    concernLevel: formData.alcoholConcernLevel as string,
  });
  
  // Calculate medication count for complexity
  const medicationList = formData.medicationList as string || '';
  const medicationCount = medicationList
    .split('\n')
    .filter(line => line.trim().length > 0)
    .length;
  
  // Calculate complexity score
  const complexityScore = calculateComplexityScore({
    takingMedications: formData.takingMedications === true || formData.takingMedications === 'true',
    medicationCount,
    hasSeizureHistory: formData.hasSeizureHistory === true || formData.hasSeizureHistory === 'true',
    hasPsychiatricHistory: formData.hasPsychiatricHistory === true || formData.hasPsychiatricHistory === 'true',
    hasLiverDisease: formData.hasLiverDisease === true || formData.hasLiverDisease === 'true',
    hasKidneyDisease: formData.hasKidneyDisease === true || formData.hasKidneyDisease === 'true',
    hasHeartCondition: formData.hasHeartCondition === true || formData.hasHeartCondition === 'true',
    isPregnant: formData.isPregnant === true || formData.isPregnant === 'true',
    otherConditions: formData.otherConditions as string,
    previousTreatment: formData.previousTreatment === true || formData.previousTreatment === 'true',
    previousMedications: formData.previousMedications as string,
  });
  
  return {
    auditScore,
    riskScore,
    complexityScore,
  };
}
