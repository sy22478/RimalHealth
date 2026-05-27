// REQUIRES CLINICAL SIGN-OFF — placeholder values pending clinician approval
//
// Every clinical constant for the GLP-1 weight-management intake lives in THIS
// file so a clinician can review them in one place. The values below are
// reasonable, literature-informed PLACEHOLDERS chosen to be clinically
// conservative (safer to over-flag than under-flag). They are NOT a substitute
// for clinician judgment and MUST be confirmed before go-live.
//
// Dosing and titration are intentionally absent — that is Phase 4, out of scope.
//
// @module lib/intake/glp1/clinical-config

import type {
  ConditionOption,
  ContraindicationDef,
  EmergencyDisposition,
} from './types';

// ============================================================================
// BMI eligibility thresholds (Step 1 BMI gate)
// ============================================================================
// TODO(clinical): REQUIRES CLINICAL SIGN-OFF — confirm BMI cutoffs and whether
// a weight-related comorbidity lowers the threshold (commonly BMI >= 27 with a
// comorbidity, >= 30 without). The comorbidity-adjusted path is NOT yet modeled.
export const BMI_THRESHOLDS = {
  /** At/above this BMI → ELIGIBLE. */
  eligible: 30,
  /** At/above this BMI (but below `eligible`) → BORDERLINE. */
  borderline: 27,
  // Below `borderline` → INELIGIBLE.
} as const;

// ============================================================================
// Medical-condition checklist (Step 3, Q18) — ~40 items
// ============================================================================
// TODO(clinical): REQUIRES CLINICAL SIGN-OFF — confirm the condition list and
// labels. Items whose `value` is referenced by the diabetic-eye-screening gate
// are: 'type-2-diabetes', 'pre-diabetes', 'diabetic-retinopathy'.
export const MEDICAL_CONDITIONS: ConditionOption[] = [
  { value: 'type-2-diabetes', label: 'Type 2 diabetes' },
  { value: 'type-1-diabetes', label: 'Type 1 diabetes' },
  { value: 'pre-diabetes', label: 'Pre-diabetes / insulin resistance' },
  { value: 'diabetic-retinopathy', label: 'Diabetic retinopathy' },
  { value: 'hypertension', label: 'High blood pressure (hypertension)' },
  { value: 'high-cholesterol', label: 'High cholesterol' },
  { value: 'heart-disease', label: 'Coronary artery / heart disease' },
  { value: 'heart-failure', label: 'Congestive heart failure' },
  { value: 'arrhythmia', label: 'Heart rhythm problems (arrhythmia)' },
  { value: 'stroke-tia', label: 'Stroke or TIA' },
  { value: 'sleep-apnea', label: 'Obstructive sleep apnea' },
  { value: 'fatty-liver', label: 'Fatty liver disease (NAFLD/NASH)' },
  { value: 'liver-disease', label: 'Other liver disease' },
  { value: 'kidney-disease', label: 'Chronic kidney disease' },
  { value: 'pancreatitis', label: 'Pancreatitis (current or past)' },
  { value: 'gallbladder-disease', label: 'Gallbladder disease / gallstones' },
  { value: 'gastroparesis', label: 'Gastroparesis / delayed gastric emptying' },
  { value: 'gerd', label: 'GERD / chronic acid reflux' },
  { value: 'ibd', label: 'Inflammatory bowel disease (Crohn’s / colitis)' },
  { value: 'thyroid-disease', label: 'Thyroid disease (non-cancer)' },
  { value: 'thyroid-cancer', label: 'Thyroid cancer' },
  { value: 'men2', label: 'Multiple endocrine neoplasia type 2 (MEN2)' },
  { value: 'pcos', label: 'PCOS (polycystic ovary syndrome)' },
  { value: 'asthma', label: 'Asthma' },
  { value: 'copd', label: 'COPD' },
  { value: 'depression', label: 'Depression' },
  { value: 'anxiety', label: 'Anxiety' },
  { value: 'bipolar', label: 'Bipolar disorder' },
  { value: 'eating-disorder', label: 'Eating disorder (current or past)' },
  { value: 'substance-use', label: 'Substance use disorder' },
  { value: 'cancer-other', label: 'Cancer (other than thyroid)' },
  { value: 'autoimmune', label: 'Autoimmune disease' },
  { value: 'osteoporosis', label: 'Osteoporosis' },
  { value: 'arthritis', label: 'Arthritis / joint disease' },
  { value: 'anemia', label: 'Anemia' },
  { value: 'migraines', label: 'Migraines' },
  { value: 'seizure-disorder', label: 'Seizure disorder' },
  { value: 'blood-clots', label: 'Blood clots (DVT/PE)' },
  { value: 'hiv', label: 'HIV' },
  { value: 'none', label: 'None of the above' },
];

/** Condition `value`s that open the conditional diabetic-eye-screening step. */
// TODO(clinical): REQUIRES CLINICAL SIGN-OFF — confirm which conditions warrant
// the retinopathy screening sub-flow.
export const DIABETIC_EYE_SCREENING_TRIGGERS: string[] = [
  'type-2-diabetes',
  'type-1-diabetes',
  'pre-diabetes',
  'diabetic-retinopathy',
];

// ============================================================================
// Contraindications (Step 5) — data-driven dispositions
// ============================================================================
// TODO(clinical): REQUIRES CLINICAL SIGN-OFF — confirm each disposition.
// HARD_STOP blocks the prescription pathway; PHYSICIAN_FLAG tags for review.
export const CONTRAINDICATIONS: ContraindicationDef[] = [
  {
    field: 'personalHistoryMTC',
    condition: 'Personal history of medullary thyroid carcinoma (MTC)',
    disposition: 'HARD_STOP',
    message:
      'GLP-1 medications carry a boxed warning for medullary thyroid carcinoma. Because of your personal history, this medication is not appropriate. Please discuss alternatives with your primary care provider.',
  },
  {
    field: 'familyHistoryMTC',
    condition: 'Family history of medullary thyroid carcinoma (MTC)',
    disposition: 'HARD_STOP',
    message:
      'GLP-1 medications carry a boxed warning for medullary thyroid carcinoma, including family history. This medication is not appropriate. Please discuss alternatives with your primary care provider.',
  },
  {
    field: 'men2Syndrome',
    condition: 'Multiple endocrine neoplasia syndrome type 2 (MEN2)',
    disposition: 'HARD_STOP',
    message:
      'MEN2 is a contraindication to GLP-1 therapy. This medication is not appropriate. Please discuss alternatives with your primary care provider.',
  },
  {
    field: 'pancreatitisHistory',
    condition: 'History of pancreatitis',
    disposition: 'HARD_STOP',
    message:
      'A history of pancreatitis requires evaluation before GLP-1 therapy. We are not able to prescribe this medication through this service; please discuss with your primary care provider.',
  },
  {
    field: 'pregnancyStatus',
    condition: 'Pregnant or trying to conceive',
    disposition: 'HARD_STOP',
    message:
      'GLP-1 medications are not recommended during pregnancy or while trying to conceive. This medication is not appropriate at this time.',
  },
  {
    field: 'gallbladderDisease',
    condition: 'Gallbladder disease / gallstones',
    disposition: 'PHYSICIAN_FLAG',
    message:
      'Gallbladder disease will be reviewed by the prescribing physician before any decision.',
  },
  {
    field: 'severeGastroparesis',
    condition: 'Severe gastroparesis / delayed gastric emptying',
    disposition: 'PHYSICIAN_FLAG',
    message:
      'Gastroparesis will be reviewed by the prescribing physician before any decision.',
  },
  {
    field: 'endStageRenalDisease',
    condition: 'End-stage renal disease',
    disposition: 'PHYSICIAN_FLAG',
    message:
      'Kidney disease will be reviewed by the prescribing physician before any decision.',
  },
];

/**
 * The pregnancyStatus values that constitute a HARD_STOP (vs the field simply
 * being truthy). Used by scoring to evaluate the enum field correctly.
 */
// TODO(clinical): REQUIRES CLINICAL SIGN-OFF — confirm breastfeeding disposition
// (currently PHYSICIAN_FLAG, not a hard stop).
export const PREGNANCY_HARD_STOP_VALUES: string[] = [
  'pregnant',
  'trying-to-conceive',
];

// ============================================================================
// Prescribing-time medication warnings (physician MedicationSelector card)
// ============================================================================
// TODO(clinical): REQUIRES CLINICAL SIGN-OFF — confirm the warning copy shown to
// the physician when selecting the GLP-1 medication at prescribe time. Kept here
// (the single source of truth for GLP-1 clinical constants) so it is reviewed
// alongside the contraindications above rather than duplicated in the catalog.
export const GLP1_MEDICATION_WARNINGS: string[] = [
  'Common GI effects: nausea, vomiting, diarrhea, constipation — usually transient',
  'Boxed warning: risk of thyroid C-cell tumors (rodent data) — counsel on neck symptoms',
  'Discontinue and evaluate if severe, persistent abdominal pain occurs (pancreatitis)',
  'Risk of gallbladder events (cholelithiasis, cholecystitis)',
  'Hypoglycemia risk when combined with insulin or sulfonylureas — consider dose reduction',
  'Hold around scheduled surgery/anesthesia due to delayed gastric emptying',
  'Monitor for new or worsening depression, mood changes, or suicidal ideation',
];

// ============================================================================
// Drug-interaction flags (Step 6)
// ============================================================================
// TODO(clinical): REQUIRES CLINICAL SIGN-OFF — confirm the interaction list and
// matching strategy (substring match on medication name, case-insensitive).
export const DRUG_INTERACTION_KEYWORDS: string[] = [
  'insulin',
  'glipizide',
  'glyburide',
  'glimepiride', // sulfonylureas — hypoglycemia risk
  'warfarin',
  'levothyroxine',
  'cyclosporine',
  'digoxin',
  'oral contraceptive',
  'birth control',
];

// ============================================================================
// PHQ-2 depression screen (Step 10)
// ============================================================================
// TODO(clinical): REQUIRES CLINICAL SIGN-OFF — standard PHQ-2 positive cutoff is
// a total score >= 3 (range 0–6). Confirm.
export const PHQ2_POSITIVE_CUTOFF = 3;

// ============================================================================
// Emergency disposition (Q37 suicidal ideation, Q56 positive PHQ-2)
// ============================================================================
// TODO(clinical): REQUIRES CLINICAL SIGN-OFF — confirm emergency disposition.
// Defaulting to EMERGENCY_FLAG (allow submission, route for urgent review +
// show 988 crisis resources) to match the existing AUD precedent, which warns
// but does not block. Switch to EMERGENCY_BLOCK only on clinical direction.
export const EMERGENCY_DISPOSITION: EmergencyDisposition = 'EMERGENCY_FLAG';

// ============================================================================
// Lab reference ranges (Step 7) — display/flagging only, not gating
// ============================================================================
// TODO(clinical): REQUIRES CLINICAL SIGN-OFF — these reference ranges are for
// physician display context only and do not currently drive any automated
// decision. Confirm before surfacing as "abnormal" flags.
export const LAB_REFERENCE_RANGES = {
  a1cPercent: { low: 4.0, high: 5.6 },
  fastingGlucoseMgDl: { low: 70, high: 99 },
  cholesterolTotalMgDl: { low: 0, high: 200 },
  triglyceridesMgDl: { low: 0, high: 150 },
  creatinineMgDl: { low: 0.6, high: 1.3 },
  altUL: { low: 7, high: 56 },
} as const;

/** Maximum dynamic medication entries (Step 6). */
export const MAX_MEDICATION_ENTRIES = 12;
