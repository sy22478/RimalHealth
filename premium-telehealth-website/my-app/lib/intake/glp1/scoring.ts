/**
 * GLP-1 Intake Scoring / Triage
 *
 * Pure, server-side scoring for the GLP-1 weight-management intake. Mirrors the
 * AUD scoring module's shape (`lib/intake/scoring.ts`). EVERY clinical
 * threshold, list, and disposition comes from `./clinical-config.ts` — there
 * are no magic numbers here.
 *
 * @module lib/intake/glp1/scoring
 */

import {
  BMI_THRESHOLDS,
  CONTRAINDICATIONS,
  PREGNANCY_HARD_STOP_VALUES,
  DRUG_INTERACTION_KEYWORDS,
  PHQ2_POSITIVE_CUTOFF,
} from './clinical-config';
import type {
  Glp1FormData,
  Glp1IntakeResult,
  EligibilityBand,
  Disposition,
  Glp1Priority,
} from './types';

// ============================================================================
// BMI
// ============================================================================

/**
 * Compute BMI from US units (feet + inches height, pounds weight).
 * BMI = 703 * lbs / inches^2. Returns 0 when inputs are missing/invalid so
 * downstream callers get a defined number rather than NaN.
 */
export function calculateBmi(
  heightFeet: number | undefined,
  heightInches: number | undefined,
  weightLbs: number | undefined
): number {
  const feet = Number(heightFeet) || 0;
  const inches = Number(heightInches) || 0;
  const lbs = Number(weightLbs) || 0;
  const totalInches = feet * 12 + inches;
  if (totalInches <= 0 || lbs <= 0) return 0;
  const bmi = (703 * lbs) / (totalInches * totalInches);
  return Math.round(bmi * 10) / 10; // one decimal place
}

/** Classify a BMI value into an eligibility band using config thresholds. */
export function classifyEligibility(bmi: number): EligibilityBand {
  if (bmi >= BMI_THRESHOLDS.eligible) return 'ELIGIBLE';
  if (bmi >= BMI_THRESHOLDS.borderline) return 'BORDERLINE';
  return 'INELIGIBLE';
}

// ============================================================================
// Contraindications
// ============================================================================

/**
 * Evaluate the config-driven contraindication list against the answers.
 * Boolean fields flag when true; pregnancyStatus flags when its value is a
 * configured hard-stop value (pregnant / trying-to-conceive).
 */
export function evaluateContraindications(
  answers: Glp1FormData
): Array<{ condition: string; disposition: Disposition }> {
  const flags: Array<{ condition: string; disposition: Disposition }> = [];

  for (const def of CONTRAINDICATIONS) {
    let triggered = false;

    if (def.field === 'pregnancyStatus') {
      const status = answers.pregnancyStatus;
      triggered = typeof status === 'string' && PREGNANCY_HARD_STOP_VALUES.includes(status);
    } else {
      triggered = answers[def.field] === true;
    }

    if (triggered) {
      flags.push({ condition: def.condition, disposition: def.disposition });
    }
  }

  return flags;
}

// ============================================================================
// Drug interactions
// ============================================================================

/**
 * Detect medications that warrant GLP-1 interaction review. Scans the dynamic
 * medication list (case-insensitive substring match against config keywords)
 * plus the explicit insulin/sulfonylurea and other-GLP-1 yes/no flags.
 */
export function getDrugInteractionFlags(answers: Glp1FormData): string[] {
  const flags = new Set<string>();

  const meds = Array.isArray(answers.medicationList) ? answers.medicationList : [];
  for (const med of meds) {
    const name = (med?.name ?? '').toString().toLowerCase();
    if (!name) continue;
    for (const keyword of DRUG_INTERACTION_KEYWORDS) {
      if (name.includes(keyword.toLowerCase())) {
        flags.add(med.name.trim());
        break;
      }
    }
  }

  if (answers.takingInsulinOrSulfonylurea === true) {
    flags.add('Insulin or sulfonylurea (hypoglycemia risk)');
  }
  if (answers.takingOtherGlp1 === true) {
    flags.add('Another GLP-1 / incretin medication (duplicate therapy)');
  }

  // Explicit drug-interaction questions (Q39–Q42). Safety-critical: these are
  // flagged from the standalone yes/no answers even when the drug never appears
  // in the free-text medication list above (which the keyword scan can miss).
  if (answers.takingOralContraceptive === true) {
    flags.add('Oral contraceptive (possible reduced effectiveness)');
  }
  if (answers.takingWarfarin === true) {
    flags.add('Warfarin / blood thinner (INR monitoring)');
  }
  if (answers.takingCyclosporineTacrolimus === true) {
    flags.add('Cyclosporine / tacrolimus (absorption change)');
  }
  if (answers.takingLevothyroxine === true) {
    flags.add('Levothyroxine (absorption / TSH monitoring)');
  }

  return Array.from(flags);
}

// ============================================================================
// PHQ-2 + emergency triggers
// ============================================================================

/** PHQ-2 total score (0–6) from the two 0–3 items. */
export function calculatePhq2Score(answers: Glp1FormData): number {
  const interest = parseInt(answers.phq2Interest ?? '0', 10);
  const down = parseInt(answers.phq2Down ?? '0', 10);
  return (Number.isFinite(interest) ? interest : 0) + (Number.isFinite(down) ? down : 0);
}

/**
 * Emergency triggers: active suicidal ideation (Q37) and a positive PHQ-2
 * depression screen (Q55–Q56, scored together; reported under source 'Q56').
 */
export function getEmergencyFlags(
  answers: Glp1FormData,
  phq2Score: number
): Array<{ trigger: string; source: 'Q37' | 'Q56' }> {
  const flags: Array<{ trigger: string; source: 'Q37' | 'Q56' }> = [];

  if (answers.suicidalIdeation === true) {
    flags.push({ trigger: 'Reported suicidal ideation', source: 'Q37' });
  }
  if (phq2Score >= PHQ2_POSITIVE_CUTOFF) {
    flags.push({
      trigger: `Positive depression screen (PHQ-2 ${phq2Score}/6)`,
      source: 'Q56',
    });
  }

  return flags;
}

// ============================================================================
// Master scorer
// ============================================================================

/**
 * Score a completed GLP-1 intake into a triage result for the physician queue.
 *
 * Priority precedence:
 *   HARD_STOP contraindication      → CONTRAINDICATED
 *   emergency flag (Q37/Q56)        → URGENT
 *   PHYSICIAN_FLAG or drug interaction → ELEVATED
 *   otherwise                       → ROUTINE
 */
export function scoreGlp1Intake(answers: Glp1FormData): Glp1IntakeResult {
  const bmi = calculateBmi(answers.heightFeet, answers.heightInches, answers.weightLbs);
  const eligibilityBand = classifyEligibility(bmi);

  const contraindicationFlags = evaluateContraindications(answers);
  const hasHardStop = contraindicationFlags.some((f) => f.disposition === 'HARD_STOP');
  const hasPhysicianFlag = contraindicationFlags.some((f) => f.disposition === 'PHYSICIAN_FLAG');

  const phq2Score = calculatePhq2Score(answers);
  const emergencyFlags = getEmergencyFlags(answers, phq2Score);

  const drugInteractionFlags = getDrugInteractionFlags(answers);

  let priority: Glp1Priority;
  if (hasHardStop) {
    priority = 'CONTRAINDICATED';
  } else if (emergencyFlags.length > 0) {
    priority = 'URGENT';
  } else if (hasPhysicianFlag || drugInteractionFlags.length > 0) {
    priority = 'ELEVATED';
  } else {
    priority = 'ROUTINE';
  }

  const requiresUrgentReview =
    emergencyFlags.length > 0 || priority === 'URGENT' || priority === 'CONTRAINDICATED';

  return {
    bmi,
    eligibilityBand,
    contraindicationFlags,
    emergencyFlags,
    phq2Score,
    drugInteractionFlags,
    priority,
    requiresUrgentReview,
  };
}
