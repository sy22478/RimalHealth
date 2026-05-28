/**
 * GLP-1 Weight-Management Intake — Type Contract
 *
 * This is the AUTHORITATIVE field list for the GLP-1 intake. The wizard form,
 * the Zod schemas (`lib/validation/glp1-schemas.ts`), and the scoring module
 * (`lib/intake/glp1/scoring.ts`) all derive from these names. Keep them in sync.
 *
 * All answers are persisted in the encrypted `Intake.formData` JSON column.
 * Clinical thresholds/lists live in `./clinical-config.ts` (sign-off gated).
 *
 * @module lib/intake/glp1/types
 */

// ============================================================================
// Disposition + result unions
// ============================================================================

/** How a flagged contraindication affects the prescription pathway. */
export type Disposition = 'HARD_STOP' | 'PHYSICIAN_FLAG';

/** How an emergency trigger (suicidal ideation / positive depression screen) is handled. */
export type EmergencyDisposition = 'EMERGENCY_BLOCK' | 'EMERGENCY_FLAG';

/** BMI-based eligibility classification (thresholds in clinical-config). */
export type EligibilityBand = 'ELIGIBLE' | 'BORDERLINE' | 'INELIGIBLE';

/** Physician-queue priority (mirrors the AUD ProviderDecisionSummary union). */
export type Glp1Priority = 'ROUTINE' | 'ELEVATED' | 'URGENT' | 'CONTRAINDICATED';

// ============================================================================
// Clinical-config shapes (values supplied by ./clinical-config.ts)
// ============================================================================

/** One entry in the medical-condition checklist (Step 3). */
export interface ConditionOption {
  value: string;
  label: string;
}

/** A contraindication the screening can detect, with its disposition + message. */
export interface ContraindicationDef {
  /** The `Glp1FormData` boolean field (or pregnancy value) that triggers this. */
  field: keyof Glp1FormData;
  /** Human-readable condition name for the physician summary. */
  condition: string;
  disposition: Disposition;
  /** Patient-facing message (shown for HARD_STOP) / physician note. */
  message: string;
}

// ============================================================================
// One dynamic medication entry (Step 6, useFieldArray)
// ============================================================================

export interface Glp1MedicationEntry {
  name: string;
  dosage: string;
  frequency: string;
  reason: string;
}

// ============================================================================
// Glp1FormData — the 63-question answer set, grouped by wizard step
// ============================================================================

export interface Glp1FormData {
  // --- Step 1: Demographics (Q1–Q10) — pre-filled from profile, confirm ------
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  biologicalSex: 'MALE' | 'FEMALE' | 'OTHER';
  biologicalSexOther?: string;
  /** Gender identity (Q4) — distinct from biological sex; for respectful interaction. */
  genderIdentity?:
    | 'male'
    | 'female'
    | 'transgender_male'
    | 'transgender_female'
    | 'non_binary'
    | 'prefer_not_to_say'
    | 'other';
  genderIdentityOther?: string;
  phone: string;
  addressStreet: string;
  addressCity: string;
  addressState: 'CA';
  addressZip: string;
  heightFeet: number;
  heightInches: number;
  weightLbs: number;
  /** Auto-calculated from height + weight; stored read-only. */
  bmi?: number;
  /** Occupation (Q50) — optional. */
  occupation?: string;
  /** Emergency contact (Q9) — required per PDF spec. */
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;

  // --- Step 2: Weight history (Q11–Q17) -------------------------------------
  highestAdultWeightLbs: number;
  goalWeightLbs: number;
  weightLossMethodsTried: string[];
  weightChangePastYear: 'gained' | 'lost' | 'stable';
  hadBariatricSurgery: boolean;
  bariatricSurgeryDetails?: string; // visibleIf hadBariatricSurgery
  priorWeightLossMeds: boolean;
  priorWeightLossMedsList?: string; // visibleIf priorWeightLossMeds
  /** Primary goal for the medication (Q11). */
  primaryMedicationGoal?: 'weight_loss' | 'blood_sugar_control' | 'both' | 'other';
  primaryMedicationGoalOther?: string; // visibleIf primaryMedicationGoal === 'other'
  /** How long at/above current weight (Q12). */
  timeAtCurrentWeight?:
    | 'less_than_6_months'
    | '6_to_12_months'
    | '1_to_2_years'
    | '2_to_5_years'
    | 'over_5_years';

  // --- Step 3: Medical history (Q18–Q19) ------------------------------------
  medicalConditions: string[]; // ~40-item checklist (clinical-config)
  medicalConditionsOther?: string;
  recentHospitalization: boolean;
  recentHospitalizationDetails?: string;

  // --- Step 4: Diabetic eye screening (Q20–Q28) — conditional step ----------
  diabetesType?: 'type-1' | 'type-2' | 'pre-diabetes' | 'gestational' | 'none';
  yearsSinceDiabetesDiagnosis?: string;
  lastA1c?: string;
  onInsulin?: boolean;
  /** Retinopathy severity staging (Q20) — replaces the old diabeticRetinopathy boolean. */
  retinopathySeverity?: 'none' | 'mild_npdr' | 'moderate_npdr' | 'severe_npdr' | 'pdr';
  /** Diabetic macular edema diagnosis (Q21). */
  diabeticMacularEdema?: boolean;
  /** Treating eye doctor (Q23) — optional. */
  ophthalmologistName?: string;
  ophthalmologistPhone?: string;
  lastEyeExam?: 'within-1-year' | '1-2-years' | 'over-2-years' | 'never';
  visionChanges?: boolean;
  /** Retinopathy treatment details (Q24/Q25) — replaces the old retinopathyTreatment boolean. */
  retinopathyTreatmentDetails?: string;
  acknowledgeRetinopathyMonitoring?: boolean;

  // --- Step 5: Contraindications (Q29–Q37) ----------------------------------
  personalHistoryMTC: boolean; // medullary thyroid carcinoma
  familyHistoryMTC: boolean;
  men2Syndrome: boolean; // multiple endocrine neoplasia type 2
  pancreatitisHistory: boolean;
  gallbladderDisease: boolean;
  severeGastroparesis: boolean;
  pregnancyStatus: 'pregnant' | 'trying-to-conceive' | 'breastfeeding' | 'none';
  endStageRenalDisease: boolean;
  suicidalIdeation: boolean; // Q37 — emergency trigger

  // --- Step 6: Medications & allergies (Q38–Q43) ----------------------------
  currentlyTakingMedications: boolean;
  medicationList: Glp1MedicationEntry[]; // useFieldArray, max 12
  hasDrugAllergies: boolean;
  drugAllergiesList?: string; // visibleIf hasDrugAllergies
  takingInsulinOrSulfonylurea: boolean;
  takingOtherGlp1: boolean;
  /** Explicit drug-interaction questions (Q39–Q42); visibleIf currentlyTakingMedications. */
  takingOralContraceptive?: boolean;
  takingWarfarin?: boolean;
  takingCyclosporineTacrolimus?: boolean;
  takingLevothyroxine?: boolean;

  // --- Step 7: Labs & vitals (Q44 + self-reported table) --------------------
  hasRecentLabs: boolean;
  labA1c?: string;
  labFastingGlucose?: string;
  labCholesterolTotal?: string;
  labTriglycerides?: string;
  labCreatinine?: string;
  labAlt?: string;
  labLDL?: string;
  labHDL?: string;
  labAST?: string;
  labTSH?: string;
  labLipase?: string;
  restingHeartRate?: string;
  bloodPressure?: string;
  labDocumentUploaded?: boolean;

  // --- Step 8: Lifestyle (Q45–Q51) ------------------------------------------
  dietPattern: string;
  exerciseFrequency: 'none' | '1-2-week' | '3-4-week' | '5-plus-week';
  alcoholUse: 'none' | 'occasional' | 'moderate' | 'heavy';
  tobaccoUse: 'never' | 'former' | 'current';
  recreationalSubstances: boolean;
  recreationalSubstancesDetails?: string;
  stressLevel: 'low' | 'moderate' | 'high';
  emotionalEating: 'never' | 'sometimes' | 'often';

  // --- Step 9: Procedures & surgery (Q52–Q53) -------------------------------
  upcomingSurgery: boolean;
  upcomingSurgeryDetails?: string;
  acknowledgeAnesthesiaHold?: boolean; // visibleIf upcomingSurgery
  /** Past abdominal/GI surgery (Q53). */
  pastGiSurgery?: boolean;
  pastGiSurgeryDetails?: string; // visibleIf pastGiSurgery

  // --- Step 10: Mental health (Q54–Q58) -------------------------------------
  eatingDisorderHistory: boolean;
  phq2Interest: '0' | '1' | '2' | '3'; // PHQ-2 item 1
  phq2Down: '0' | '1' | '2' | '3'; // PHQ-2 item 2
  mentalHealthConditions: string[];
  currentMentalHealthTreatment: boolean;
  /** Emotional readiness for lifestyle change (Q58). */
  emotionallyReady?: 'yes' | 'somewhat' | 'no' | 'unsure';
  emotionallyReadyConcerns?: string; // visibleIf emotionallyReady is 'no' | 'unsure'

  // --- Step 11: Referral & care coordination (Q59–Q63) ----------------------
  referralSource?:
    | 'internet_search'
    | 'social_media'
    | 'physician_referral'
    | 'friend_family'
    | 'insurance'
    | 'other';
  referralSourceOther?: string; // visibleIf referralSource === 'other'
  hasPrimaryCarePhysician: boolean;
  pcpName?: string; // visibleIf hasPrimaryCarePhysician
  pcpPhone?: string;
  pcpFaxOrEmail?: string;
  consentToCoordinateWithPcp?: boolean;
  additionalPharmacyNotes?: string;

  // --- Step 12: Review & consent acknowledgements ---------------------------
  ackInfoAccurate: boolean;
  ackClinicalIndication: boolean;
  ackFollowUpCompliance: boolean;

  // --- Pharmacy (CA-only; mirrors AUD intake for submit-route reuse) ---------
  pharmacyName?: string;
  pharmacyAddress?: string;
  pharmacyCity?: string;
  pharmacyState?: 'CA';
  pharmacyZip?: string;
  pharmacyPhone?: string;
}

// ============================================================================
// Glp1IntakeResult — output of scoreGlp1Intake()
// ============================================================================

export interface Glp1IntakeResult {
  /** Body mass index computed from height + weight. */
  bmi: number;
  /** BMI-based eligibility band (thresholds from clinical-config). */
  eligibilityBand: EligibilityBand;
  /** Contraindications detected, each with its disposition. */
  contraindicationFlags: Array<{ condition: string; disposition: Disposition }>;
  /** Emergency triggers detected (suicidal ideation / positive PHQ-2). */
  emergencyFlags: Array<{ trigger: string; source: 'Q37' | 'Q56' }>;
  /** PHQ-2 total (0–6). */
  phq2Score: number;
  /** Medications flagged for GLP-1 interaction review. */
  drugInteractionFlags: string[];
  /** Physician-queue priority. */
  priority: Glp1Priority;
  /** True when an emergency or urgent clinical flag requires fast-track review. */
  requiresUrgentReview: boolean;
}
