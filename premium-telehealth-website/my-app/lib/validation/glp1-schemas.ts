/**
 * Server-side Zod validation for the GLP-1 weight-management intake.
 *
 * Mirrors the `Glp1FormData` contract in `lib/intake/glp1/types.ts` and the
 * client-side schema in `app/intake/glp1/Glp1IntakeClient.tsx`. Prevents
 * garbage/malicious data from reaching the scoring engine. Zod v4 syntax.
 *
 * @module lib/validation/glp1-schemas
 */
import { z } from 'zod';
import { MAX_MEDICATION_ENTRIES } from '@/lib/intake/glp1/clinical-config';

const caState = z.literal('CA');

/** One dynamic medication entry (Step 6). */
export const glp1MedicationEntrySchema = z.object({
  name: z.string().max(200),
  dosage: z.string().max(100),
  frequency: z.string().max(100),
  reason: z.string().max(200),
});

/**
 * Full GLP-1 intake answer-set validation. Conditional fields (the diabetic
 * eye-screening step and visibleIf sub-fields) are optional because the wizard
 * may legitimately skip them. `.passthrough()` allows server-appended keys
 * (e.g. `_glp1DecisionSummary`, `bmi`, pharmacy fields).
 */
export const glp1IntakeFormDataSchema = z
  .object({
    // Step 1: Demographics
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    dateOfBirth: z.string().min(1),
    biologicalSex: z.enum(['MALE', 'FEMALE', 'OTHER']),
    biologicalSexOther: z.string().max(100).optional(),
    genderIdentity: z
      .enum([
        'male',
        'female',
        'transgender_male',
        'transgender_female',
        'non_binary',
        'prefer_not_to_say',
        'other',
      ])
      .optional(),
    genderIdentityOther: z.string().max(100).optional(),
    occupation: z.string().max(100).optional(),
    phone: z.string().max(20),
    addressStreet: z.string().max(255),
    addressCity: z.string().max(100),
    addressState: caState,
    addressZip: z
      .string()
      .regex(/^\d{5}(-\d{4})?$/)
      .refine((zip) => {
        const n = parseInt(zip.slice(0, 5), 10);
        return n >= 90001 && n <= 96162;
      }, { message: 'Must be a valid California ZIP code (90001-96162)' }),
    heightFeet: z.number().min(1).max(8),
    heightInches: z.number().min(0).max(11),
    weightLbs: z.number().min(50).max(1500),
    bmi: z.number().optional(),
    // Emergency contact (required per PDF spec)
    emergencyContactName: z.string().min(1).max(100),
    emergencyContactPhone: z.string().min(10).max(20),
    emergencyContactRelationship: z.string().min(1).max(50),

    // Step 2: Weight history
    highestAdultWeightLbs: z.number().min(50).max(1500),
    goalWeightLbs: z.number().min(50).max(1500),
    weightLossMethodsTried: z.array(z.string()),
    weightChangePastYear: z.enum(['gained', 'lost', 'stable']),
    hadBariatricSurgery: z.boolean(),
    bariatricSurgeryDetails: z.string().max(1000).optional(),
    priorWeightLossMeds: z.boolean(),
    priorWeightLossMedsList: z.string().max(1000).optional(),
    primaryMedicationGoal: z
      .enum(['weight_loss', 'blood_sugar_control', 'both', 'other'])
      .optional(),
    primaryMedicationGoalOther: z.string().max(200).optional(),
    timeAtCurrentWeight: z
      .enum([
        'less_than_6_months',
        '6_to_12_months',
        '1_to_2_years',
        '2_to_5_years',
        'over_5_years',
      ])
      .optional(),

    // Step 3: Medical history
    medicalConditions: z.array(z.string()),
    medicalConditionsOther: z.string().max(1000).optional(),
    recentHospitalization: z.boolean(),
    recentHospitalizationDetails: z.string().max(1000).optional(),

    // Step 4: Diabetic eye screening (conditional step → all optional)
    diabetesType: z
      .enum(['type-1', 'type-2', 'pre-diabetes', 'gestational', 'none'])
      .optional(),
    yearsSinceDiabetesDiagnosis: z.string().max(50).optional(),
    lastA1c: z.string().max(50).optional(),
    onInsulin: z.boolean().optional(),
    retinopathySeverity: z
      .enum(['none', 'mild_npdr', 'moderate_npdr', 'severe_npdr', 'pdr'])
      .optional(),
    diabeticMacularEdema: z.boolean().optional(),
    ophthalmologistName: z.string().max(100).optional(),
    ophthalmologistPhone: z.string().max(20).optional(),
    lastEyeExam: z
      .enum(['within-1-year', '1-2-years', 'over-2-years', 'never'])
      .optional(),
    visionChanges: z.boolean().optional(),
    retinopathyTreatmentDetails: z.string().max(500).optional(),
    acknowledgeRetinopathyMonitoring: z.boolean().optional(),

    // Step 5: Contraindications
    personalHistoryMTC: z.boolean(),
    familyHistoryMTC: z.boolean(),
    men2Syndrome: z.boolean(),
    pancreatitisHistory: z.boolean(),
    gallbladderDisease: z.boolean(),
    severeGastroparesis: z.boolean(),
    pregnancyStatus: z.enum([
      'pregnant',
      'trying-to-conceive',
      'breastfeeding',
      'none',
    ]),
    endStageRenalDisease: z.boolean(),
    suicidalIdeation: z.boolean(),

    // Step 6: Medications & allergies
    currentlyTakingMedications: z.boolean(),
    medicationList: z.array(glp1MedicationEntrySchema).max(MAX_MEDICATION_ENTRIES),
    hasDrugAllergies: z.boolean(),
    drugAllergiesList: z.string().max(1000).optional(),
    takingInsulinOrSulfonylurea: z.boolean(),
    takingOtherGlp1: z.boolean(),
    takingOralContraceptive: z.boolean().optional(),
    takingWarfarin: z.boolean().optional(),
    takingCyclosporineTacrolimus: z.boolean().optional(),
    takingLevothyroxine: z.boolean().optional(),

    // Step 7: Labs & vitals (self-reported → optional strings)
    hasRecentLabs: z.boolean(),
    labA1c: z.string().max(50).optional(),
    labFastingGlucose: z.string().max(50).optional(),
    labCholesterolTotal: z.string().max(50).optional(),
    labTriglycerides: z.string().max(50).optional(),
    labCreatinine: z.string().max(50).optional(),
    labAlt: z.string().max(50).optional(),
    labLDL: z.string().max(10).optional(),
    labHDL: z.string().max(10).optional(),
    labAST: z.string().max(10).optional(),
    labTSH: z.string().max(10).optional(),
    labLipase: z.string().max(10).optional(),
    restingHeartRate: z.string().max(50).optional(),
    bloodPressure: z.string().max(50).optional(),
    labDocumentUploaded: z.boolean().optional(),

    // Step 8: Lifestyle
    dietPattern: z.string().max(200),
    exerciseFrequency: z.enum(['none', '1-2-week', '3-4-week', '5-plus-week']),
    alcoholUse: z.enum(['none', 'occasional', 'moderate', 'heavy']),
    tobaccoUse: z.enum(['never', 'former', 'current']),
    recreationalSubstances: z.boolean(),
    recreationalSubstancesDetails: z.string().max(1000).optional(),
    stressLevel: z.enum(['low', 'moderate', 'high']),
    emotionalEating: z.enum(['never', 'sometimes', 'often']),

    // Step 9: Procedures & surgery
    upcomingSurgery: z.boolean(),
    upcomingSurgeryDetails: z.string().max(1000).optional(),
    acknowledgeAnesthesiaHold: z.boolean().optional(),
    pastGiSurgery: z.boolean().optional(),
    pastGiSurgeryDetails: z.string().max(300).optional(),

    // Step 10: Mental health
    eatingDisorderHistory: z.boolean(),
    phq2Interest: z.enum(['0', '1', '2', '3']),
    phq2Down: z.enum(['0', '1', '2', '3']),
    mentalHealthConditions: z.array(z.string()),
    currentMentalHealthTreatment: z.boolean(),
    emotionallyReady: z.enum(['yes', 'somewhat', 'no', 'unsure']).optional(),
    emotionallyReadyConcerns: z.string().max(500).optional(),

    // Step 11: Referral & care coordination
    referralSource: z
      .enum([
        'internet_search',
        'social_media',
        'physician_referral',
        'friend_family',
        'insurance',
        'other',
      ])
      .optional(),
    referralSourceOther: z.string().max(200).optional(),
    hasPrimaryCarePhysician: z.boolean(),
    pcpName: z.string().max(100).optional(),
    pcpPhone: z.string().max(20).optional(),
    pcpFaxOrEmail: z.string().max(100).optional(),
    consentToCoordinateWithPcp: z.boolean().optional(),
    additionalPharmacyNotes: z.string().max(500).optional(),

    // Step 12: Review & consent acknowledgements
    ackInfoAccurate: z.literal(true),
    ackClinicalIndication: z.literal(true),
    ackFollowUpCompliance: z.literal(true),

    // Pharmacy (CA-only; optional, mirrors AUD intake)
    pharmacyName: z.string().max(255).optional(),
    pharmacyAddress: z.string().max(255).optional(),
    pharmacyCity: z.string().max(100).optional(),
    pharmacyState: caState.optional(),
    pharmacyZip: z
      .string()
      .regex(/^\d{5}(-\d{4})?$/)
      .optional(),
    pharmacyPhone: z.string().max(20).optional(),
  })
  .passthrough();

export type Glp1IntakeFormDataInput = z.infer<typeof glp1IntakeFormDataSchema>;

/** Submit request body — validates the formData blob server-side. */
export const submitGlp1IntakeSchema = z.object({
  formData: z.record(z.string(), z.unknown()),
});

export type SubmitGlp1IntakeInput = z.infer<typeof submitGlp1IntakeSchema>;
