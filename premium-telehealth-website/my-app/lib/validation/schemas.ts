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

/** Submit intake request */
export const submitIntakeSchema = z.object({
  formData: intakeFormDataSchema,
});

export type SubmitIntakeInput = z.infer<typeof submitIntakeSchema>;

// ============================================================================
// Patient Profile Schemas
// ============================================================================

/** Update profile request */
export const updateProfileSchema = z.object({
  firstName: nonEmptyString(100).optional(),
  lastName: nonEmptyString(100).optional(),
  phone: phoneSchema.optional(),
  addressStreet: nonEmptyString(255).optional(),
  addressCity: nonEmptyString(100).optional(),
  addressZip: zipCodeSchema.optional(),
  preferredPharmacyId: z.string().uuid('Invalid pharmacy ID').optional(),
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
  instructions: nonEmptyString(2000),
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
