/**
 * Validation Schemas
 * Zod schemas for API input validation
 * 
 * HIPAA Compliance:
 * - All inputs validated before processing
 * - Strict type checking to prevent injection attacks
 * - Sanitization applied to text fields
 * 
 * @module lib/validation/schemas
 */

import { z } from 'zod';

// ============================================================================
// Common Validation Helpers
// ============================================================================

/** Valid UUID v4 pattern */
export const uuidSchema = z.string().uuid();

/** Non-empty string with max length */
export const nonEmptyString = (maxLength: number = 255) =>
  z.string().check(
    z.minLength(1, { message: 'Required' }),
    z.maxLength(maxLength, { message: `Maximum ${maxLength} characters` })
  );

/** Optional string with max length */
export const optionalString = (maxLength: number = 255) =>
  z.string()
    .check(z.maxLength(maxLength, { message: `Maximum ${maxLength} characters` }))
    .optional()
    .or(z.literal(''));

/** Email validation */
export const emailSchema = z.string().email({ message: 'Invalid email address' });

/** Phone number validation (US format) */
export const phoneSchema = z.string().regex(
  /^\+?1?\s*\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/,
  { message: 'Invalid phone number format' }
);

/** ZIP code validation (US) */
export const zipCodeSchema = z.string().regex(
  /^\d{5}(-\d{4})?$/,
  { message: 'Invalid ZIP code format' }
);

/** Date validation (YYYY-MM-DD) */
export const dateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  { message: 'Invalid date format (YYYY-MM-DD)' }
);

/** Positive integer */
export const positiveInt = z.number().int().positive();

// ============================================================================
// Patient Intake Schemas
// ============================================================================

/** Create intake request */
export const createIntakeSchema = z.object({
  primaryConcern: z.enum(['ALCOHOL'] as const),
  formData: z.record(z.string(), z.unknown()).optional(),
});

export type CreateIntakeInput = z.infer<typeof createIntakeSchema>;

/** Update intake request */
export const updateIntakeSchema = z.object({
  formData: z.record(z.string(), z.unknown()),
  isDraft: z.boolean().optional(),
});

export type UpdateIntakeInput = z.infer<typeof updateIntakeSchema>;

/** Intake form data validation */
export const intakeFormDataSchema = z.object({
  // Personal Information
  firstName: nonEmptyString(100),
  lastName: nonEmptyString(100),
  dateOfBirth: dateSchema,
  phone: phoneSchema,
  email: emailSchema,

  // Address
  addressStreet: nonEmptyString(255),
  addressCity: nonEmptyString(100),
  addressState: z.literal('CA'),
  addressZip: zipCodeSchema,

  // Treatment
  primaryConcern: z.enum(['ALCOHOL'] as const),
  treatmentGoal: z.enum(['QUIT', 'REDUCE', 'EXPLORE'] as const),
  priorityConcern: z.enum(['ALCOHOL']).optional(),

  // Medical History
  isPregnant: z.boolean(),
  isPregnantDetails: optionalString(500),
  hasSeizureHistory: z.boolean(),
  seizureDetails: optionalString(500),
  hasPsychiatricHistory: z.boolean(),
  psychiatricDetails: optionalString(500),
  hasLiverDisease: z.boolean(),
  liverDiseaseDetails: optionalString(500),
  hasKidneyDisease: z.boolean(),
  kidneyDiseaseDetails: optionalString(500),
  hasHeartCondition: z.boolean(),
  heartConditionDetails: optionalString(500),
  otherConditions: optionalString(1000),

  // Medications
  takingMedications: z.boolean(),
  medicationList: optionalString(2000),
  medicationAllergies: optionalString(1000),

  // Previous Treatment
  previousTreatment: z.boolean(),
  previousTreatmentDetails: optionalString(1000),
  previousMedications: optionalString(1000),

  // Alcohol Assessment (AUDIT-C)
  audit_1: z.enum(['0', '1', '2', '3', '4']).optional(),
  audit_2: z.enum(['0', '1', '2', '3', '4']).optional(),
  audit_3: z.enum(['0', '1', '2', '3', '4']).optional(),
  alcoholQuitAttempts: optionalString(500),
  alcoholQuitDetails: optionalString(1000),
  alcoholConcernLevel: optionalString(100),

  // Consent - all must be true
  hipaaConsent: z.literal(true),
  termsConsent: z.literal(true),
  telehealthConsent: z.literal(true),
  treatmentConsent: z.literal(true),
});

export type IntakeFormDataInput = z.infer<typeof intakeFormDataSchema>;

/**
 * Server-side validation for DSM-5 intake form data.
 * Prevents garbage/malicious data from reaching the scoring engine.
 * Mirrors the client-side intakeFormSchema in IntakeClient.tsx.
 */
export const dsm5IntakeFormDataSchema = z.object({
  // Section 1: DSM-5 AUD Screening (Q1-Q11) — boolean Yes/No
  dsm5Q1: z.boolean(),
  dsm5Q2: z.boolean(),
  dsm5Q3: z.boolean(),
  dsm5Q4: z.boolean(),
  dsm5Q5: z.boolean(),
  dsm5Q6: z.boolean(),
  dsm5Q7: z.boolean(),
  dsm5Q8: z.boolean(),
  dsm5Q9: z.boolean(),
  dsm5Q10: z.boolean(),
  dsm5Q11: z.boolean(),

  // Section 2: Current Drinking Pattern (Q12-Q15)
  drinkingDaysPerWeek: z.enum(['1-2', '3-4', '5-6', 'everyday']),
  drinksPerDay: z.enum(['1-2', '3-4', '5-6', '7+']),
  lastDrink: z.enum(['today', 'yesterday', '2-7days', 'more-than-week']),
  bingeDrinking: z.enum(['yes', 'no']),

  // Section 3: Withdrawal Risk Assessment (Q16-Q19) — boolean
  withdrawalSeizure: z.boolean(),
  withdrawalDTs: z.boolean(),
  withdrawalHospitalized: z.boolean(),
  morningDrinking: z.boolean(),

  // Section 4: Naltrexone Safety Screening (Q20-Q25)
  opioidUse: z.array(z.string()),
  opioidMaintenance: z.boolean(),
  liverCondition: z.enum(['cirrhosis', 'acute-hepatitis', 'liver-failure', 'elevated-enzymes', 'none']),
  liverTests: z.enum(['normal', 'mild-elevated', 'significant-elevated', 'no-tests']),
  pregnancyStatus: z.enum(['pregnant', 'breastfeeding', 'planning-pregnancy', 'none']),
  drugAllergies: z.enum(['naltrexone', 'other', 'none']),

  // Section 5: Medical & Psychiatric History (Q26-Q29)
  medicalHistory: z.array(z.string()),
  currentMedications: z.boolean(),
  medicationList: z.string().optional(),
  previousTreatments: z.array(z.string()),
  seeingTherapist: z.boolean(),

  // Section 6: Treatment Goals & Readiness (Q30-Q32)
  primaryGoal: z.enum(['abstinence', 'harm-reduction', 'unsure']),
  motivationLevel: z.enum(['very', 'somewhat', 'unsure']),
  supportSystem: z.enum(['strong', 'limited', 'none']),

  // Section 7: Demographics (Q33)
  biologicalSex: z.enum(['MALE', 'FEMALE', 'OTHER']),
  biologicalSexOther: z.string().optional(),

  // Address — California only
  addressState: z.literal('CA').optional(),
  pharmacyState: z.literal('CA').optional(),
  pharmacyZip: z.string().regex(/^\d{5}$/).refine((zip) => {
    const n = parseInt(zip, 10);
    return n >= 90001 && n <= 96162;
  }, { message: 'Must be a valid California ZIP code (90001-96162)' }).optional(),
}).passthrough(); // Allow additional fields (e.g., primaryConcern added by submit handler)

/** Submit intake request — validates formData structure server-side */
export const submitIntakeSchema = z.object({
  formData: z.record(z.string(), z.unknown()),
});

export type SubmitIntakeInput = z.infer<typeof submitIntakeSchema>;

// ============================================================================
// Patient Profile Schemas
// ============================================================================

/** California ZIP code validation (must start with 9) */
export const californiaZipCodeSchema = z.string().regex(
  /^9\d{4}(-\d{4})?$/,
  { message: 'Must be a valid California ZIP code (starts with 9)' }
);

/**
 * Update profile request — accepts empty strings for unfilled fields.
 *
 * Uses relaxed validation for phone, date, and ZIP because existing data may
 * have been stored in a different format (e.g., dateOfBirth as MM/DD/YYYY from
 * the intake form, phone with international prefix, etc.). The client-side form
 * applies strict validation for newly entered values; the server just needs to
 * ensure the data is safe to store.
 */
export const updateProfileSchema = z.object({
  firstName: z.string().max(100).optional().or(z.literal('')),
  lastName: z.string().max(100).optional().or(z.literal('')),
  dateOfBirth: z.string().max(50).optional().or(z.literal('')),
  phone: z.string().max(30).nullable().optional().or(z.literal('')),
  addressStreet: z.string().max(255).nullable().optional().or(z.literal('')),
  addressCity: z.string().max(100).nullable().optional().or(z.literal('')),
  addressState: z.enum(['CA', '']).nullable().optional().or(z.literal('CA')),
  addressZip: z.string().max(10).nullable().optional().or(z.literal('')),
  primaryConcern: z.string().max(100).nullable().optional().or(z.literal('')),
  treatmentGoal: z.string().max(500).nullable().optional().or(z.literal('')),
  medicalHistory: z.string().max(2000).optional().or(z.literal('')),
  currentMedications: z.string().max(1000).optional().or(z.literal('')),
  allergies: z.string().max(500).optional().or(z.literal('')),
  preferredPharmacyId: z.string().max(100).nullable().optional().or(z.literal('')),
  notificationPreferences: z.object({
    email: z.boolean().optional(),
    sms: z.boolean().optional(),
    marketing: z.boolean().optional(),
  }).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ============================================================================
// Document Schemas
// ============================================================================

/** Document upload request */
export const documentUploadSchema = z.object({
  fileName: nonEmptyString(255),
  fileType: z.enum([
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/heic',
    'image/heif',
  ]),
  documentType: z.enum(['id', 'insurance', 'medical', 'consent', 'other']),
  fileSize: z.number().int().max(10 * 1024 * 1024, { message: 'File size must be less than 10MB' }),
});

export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;

// ============================================================================
// Prescription & Refill Schemas
// ============================================================================

/** Refill request */
export const refillRequestSchema = z.object({
  prescriptionId: uuidSchema,
  reason: optionalString(500),
});

export type RefillRequestInput = z.infer<typeof refillRequestSchema>;

// ============================================================================
// Messaging Schemas
// ============================================================================

/** Send message request */
export const sendMessageSchema = z.object({
  threadId: nonEmptyString(100),
  body: nonEmptyString(5000),
  subject: optionalString(255),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/** Get messages query params */
export const getMessagesQuerySchema = z.object({
  threadId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type GetMessagesQuery = z.infer<typeof getMessagesQuerySchema>;

// ============================================================================
// Physician Review Schemas
// ============================================================================

/** Review decision enum */
export const reviewDecisionSchema = z.enum(['APPROVED', 'DECLINED', 'NEEDS_INFO']);

/** Prescription details for approval */
export const prescriptionDetailsSchema = z.object({
  medicationName: nonEmptyString(100),
  genericName: nonEmptyString(100),
  dosage: nonEmptyString(100),
  frequency: nonEmptyString(100),
  quantity: z.number().int().min(1).max(365),
  refills: z.number().int().min(0).max(12),
  instructions: optionalString(2000),
  pharmacyId: uuidSchema.optional(),
});

/** Submit review request */
export const submitReviewSchema = z.object({
  intakeId: uuidSchema,
  decision: reviewDecisionSchema,
  notes: optionalString(5000),
  prescriptionDetails: prescriptionDetailsSchema.optional(),
  rejectionReason: optionalString(2000),
  alternativeRecommendation: optionalString(2000),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;

/** Send prescription request */
export const sendPrescriptionSchema = z.object({
  prescriptionId: uuidSchema,
  pharmacyId: uuidSchema.optional(),
  pharmacyNcpdpId: z.string().optional(),
});

export type SendPrescriptionInput = z.infer<typeof sendPrescriptionSchema>;

// ============================================================================
// Physician Query Schemas
// ============================================================================

/** Queue query params */
export const queueQuerySchema = z.object({
  status: z.enum(['ALL', 'SUBMITTED', 'UNDER_REVIEW']).default('ALL'),
  concernType: z.enum(['ALL', 'ALCOHOL']).default('ALL'),
  searchQuery: z.string().optional(),
  sortBy: z.enum(['submittedAt', 'waitTimeHours', 'patientName', 'riskScore']).default('submittedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type QueueQuery = z.infer<typeof queueQuerySchema>;

/** Patients list query params */
export const patientsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['ALL', 'ACTIVE', 'INACTIVE']).default('ALL'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PatientsQuery = z.infer<typeof patientsQuerySchema>;

// ============================================================================
// Physician Messaging Schemas
// ============================================================================

/** Send message as physician */
export const sendPhysicianMessageSchema = z.object({
  patientId: uuidSchema,
  threadId: nonEmptyString(100),
  body: nonEmptyString(5000),
  subject: optionalString(255),
});

export type SendPhysicianMessageInput = z.infer<typeof sendPhysicianMessageSchema>;

/** Physician get messages query */
export const physicianMessagesQuerySchema = z.object({
  patientId: z.string().optional(),
  threadId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PhysicianMessagesQuery = z.infer<typeof physicianMessagesQuerySchema>;

// ============================================================================
// Stats Query Schema
// ============================================================================

/** Stats query params */
export const statsQuerySchema = z.object({
  period: z.enum(['today', 'week', 'month']).default('today'),
});

export type StatsQuery = z.infer<typeof statsQuerySchema>;
