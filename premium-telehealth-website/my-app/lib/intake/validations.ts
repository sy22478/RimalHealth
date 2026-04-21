/**
 * Intake Form Validations
 * Zod schemas for intake form validation
 * 
 * @module lib/intake/validations
 */

import { z } from 'zod';
import { ConcernType, TreatmentGoal } from '@prisma/client';

// ============================================================================
// Base Schemas
// ============================================================================

const stringBoolean = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform(val => val === 'true'),
]);

// ============================================================================
// Medical History Schema
// ============================================================================

export const medicalHistorySchema = z.object({
  isPregnant: stringBoolean,
  isPregnantDetails: z.string().optional(),
  hasSeizureHistory: stringBoolean,
  seizureDetails: z.string().optional(),
  hasPsychiatricHistory: stringBoolean,
  psychiatricDetails: z.string().optional(),
  hasLiverDisease: stringBoolean,
  liverDiseaseDetails: z.string().optional(),
  hasKidneyDisease: stringBoolean,
  kidneyDiseaseDetails: z.string().optional(),
  hasHeartCondition: stringBoolean,
  heartConditionDetails: z.string().optional(),
  otherConditions: z.string().optional(),
}).refine((data) => {
  // If isPregnant is true, details are recommended but not required
  return true;
}, {
  message: 'Please provide pregnancy details',
  path: ['isPregnantDetails'],
});

// ============================================================================
// Medications Schema
// ============================================================================

export const medicationsSchema = z.object({
  takingMedications: stringBoolean,
  medicationList: z.string().optional(),
  medicationAllergies: z.string().optional(),
}).refine((data) => {
  // If takingMedications is true, medicationList should be provided
  if (data.takingMedications === true && (!data.medicationList || data.medicationList.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: 'Please list your current medications',
  path: ['medicationList'],
});

// ============================================================================
// AUDIT-C Schema (Alcohol)
// ============================================================================

export const auditCSchema = z.object({
  audit_1: z.enum(['0', '1', '2', '3', '4'], {
    message: 'Please answer how often you drink alcohol',
  }),
  audit_2: z.enum(['0', '1', '2', '3', '4'], {
    message: 'Please answer how many drinks on a typical day',
  }),
  audit_3: z.enum(['0', '1', '2', '3', '4'], {
    message: 'Please answer how often you have 6+ drinks',
  }),
  alcoholQuitAttempts: z.enum(['0', '1', '2', '3'], {
    message: 'Please indicate your quit attempts',
  }),
  alcoholQuitDetails: z.string().optional(),
  alcoholConcernLevel: z.enum(['not', 'slightly', 'moderately', 'very', 'extremely'], {
    message: 'Please indicate your concern level',
  }),
});

// ============================================================================
// Previous Treatment Schema
// ============================================================================

export const previousTreatmentSchema = z.object({
  previousTreatment: stringBoolean,
  previousTreatmentDetails: z.string().optional(),
  previousMedications: z.string().optional(),
});

// ============================================================================
// Consent Schema
// ============================================================================

export const consentSchema = z.object({
  hipaaConsent: z.boolean().refine((val) => val === true, {
    message: 'You must consent to HIPAA terms',
  }),
  termsConsent: z.boolean().refine((val) => val === true, {
    message: 'You must agree to Terms of Service',
  }),
  telehealthConsent: z.boolean().refine((val) => val === true, {
    message: 'You must consent to telehealth services',
  }),
  treatmentConsent: z.boolean().refine((val) => val === true, {
    message: 'You must consent to treatment',
  }),
});

// ============================================================================
// Complete Intake Schema
// ============================================================================

export function createIntakeSchema(_concernType: ConcernType) {
  return z.object({
    // Personal info (usually pre-filled from profile)
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    dateOfBirth: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Date must be in MM/DD/YYYY format'),
    phone: z.string().min(10, 'Phone number is required'),
    email: z.string().email('Valid email is required'),
    
    // Address
    addressStreet: z.string().min(1, 'Street address is required'),
    addressCity: z.string().min(1, 'City is required'),
    addressState: z.literal('CA'),
    addressZip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Zip code must be 5 or 9 digits (e.g., 90210 or 90210-1234)'),
    
    // Treatment
    primaryConcern: z.nativeEnum(ConcernType),
    treatmentGoal: z.nativeEnum(TreatmentGoal),
  })
    .merge(medicalHistorySchema)
    .merge(medicationsSchema)
    .merge(auditCSchema)
    .merge(previousTreatmentSchema)
    .merge(consentSchema);
}

// ============================================================================
// Partial Schema for Auto-Save (Drafts)
// ============================================================================

export const draftIntakeSchema = z.object({
  // Personal info
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  
  // Address
  addressStreet: z.string().optional(),
  addressCity: z.string().optional(),
  addressState: z.string().optional(),
  addressZip: z.string().optional(),
  
  // Treatment
  primaryConcern: z.nativeEnum(ConcernType).optional(),
  treatmentGoal: z.nativeEnum(TreatmentGoal).optional(),
  
  // Medical History (all optional for draft)
  isPregnant: stringBoolean.optional(),
  isPregnantDetails: z.string().optional(),
  hasSeizureHistory: stringBoolean.optional(),
  seizureDetails: z.string().optional(),
  hasPsychiatricHistory: stringBoolean.optional(),
  psychiatricDetails: z.string().optional(),
  hasLiverDisease: stringBoolean.optional(),
  liverDiseaseDetails: z.string().optional(),
  hasKidneyDisease: stringBoolean.optional(),
  kidneyDiseaseDetails: z.string().optional(),
  hasHeartCondition: stringBoolean.optional(),
  heartConditionDetails: z.string().optional(),
  otherConditions: z.string().optional(),
  
  // Medications
  takingMedications: stringBoolean.optional(),
  medicationList: z.string().optional(),
  medicationAllergies: z.string().optional(),
  
  // AUDIT-C
  audit_1: z.enum(['0', '1', '2', '3', '4']).optional(),
  audit_2: z.enum(['0', '1', '2', '3', '4']).optional(),
  audit_3: z.enum(['0', '1', '2', '3', '4']).optional(),
  alcoholQuitAttempts: z.enum(['0', '1', '2', '3']).optional(),
  alcoholQuitDetails: z.string().optional(),
  alcoholConcernLevel: z.enum(['not', 'slightly', 'moderately', 'very', 'extremely']).optional(),
  
  // Previous treatment
  previousTreatment: stringBoolean.optional(),
  previousTreatmentDetails: z.string().optional(),
  previousMedications: z.string().optional(),
  
  // Consent (not required for draft)
  hipaaConsent: z.boolean().optional(),
  termsConsent: z.boolean().optional(),
  telehealthConsent: z.boolean().optional(),
  treatmentConsent: z.boolean().optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type MedicalHistoryData = z.infer<typeof medicalHistorySchema>;
export type MedicationsData = z.infer<typeof medicationsSchema>;
export type AuditCData = z.infer<typeof auditCSchema>;
export type PreviousTreatmentData = z.infer<typeof previousTreatmentSchema>;
export type ConsentData = z.infer<typeof consentSchema>;
export type DraftIntakeData = z.infer<typeof draftIntakeSchema>;

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate a specific section of the intake form
 */
export function validateSection(
  section: 'medical' | 'medications' | 'alcohol' | 'previous' | 'consent',
  data: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  let result;
  
  switch (section) {
    case 'medical':
      result = medicalHistorySchema.safeParse(data);
      break;
    case 'medications':
      result = medicationsSchema.safeParse(data);
      break;
    case 'alcohol':
      result = auditCSchema.safeParse(data);
      break;
    case 'previous':
      result = previousTreatmentSchema.safeParse(data);
      break;
    case 'consent':
      result = consentSchema.safeParse(data);
      break;
    default:
      return { valid: true, errors: [] };
  }
  
  if (result.success) {
    return { valid: true, errors: [] };
  }
  
  return {
    valid: false,
    errors: result.error.issues?.map((e: { message: string }) => e.message) || [],
  };
}

/**
 * Check if all required fields for a concern type are present
 */
export function isIntakeComplete(
  concernType: ConcernType,
  data: Record<string, unknown>
): boolean {
  const schema = createIntakeSchema(concernType);
  const result = schema.safeParse(data);
  return result.success;
}
