/**
 * Intake Form Types
 * Type definitions for the dynamic intake form system
 * 
 * @module types/intake
 */

import { ConcernType, TreatmentGoal, IntakeStatus, PaymentStatus } from '@prisma/client';

// ============================================================================
// Question Types
// ============================================================================

export type QuestionType = 'select' | 'radio' | 'text' | 'textarea' | 'number' | 'checkbox' | 'date';

export interface QuestionOption {
  value: string;
  label: string;
  score?: number;
  helpText?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  options?: QuestionOption[];
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  dependsOn?: { field: string; value: unknown };
  min?: number;
  max?: number;
  step?: number;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    message?: string;
  };
}

export interface QuestionSection {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  dependsOn?: { field: string; value: unknown };
}

// ============================================================================
// Form Data Types
// ============================================================================

export interface IntakeFormData {
  // Basic Info
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  email?: string;

  // Address
  addressStreet: string;
  addressCity: string;
  addressState?: string;
  addressZip: string;

  // Treatment
  primaryConcern?: ConcernType;
  treatmentGoal?: TreatmentGoal;

  // Medical History (legacy AUDIT-C format)
  isPregnant?: boolean;
  isPregnantDetails?: string;
  hasSeizureHistory?: boolean;
  seizureDetails?: string;
  hasPsychiatricHistory?: boolean;
  psychiatricDetails?: string;
  hasLiverDisease?: boolean;
  liverDiseaseDetails?: string;
  hasKidneyDisease?: boolean;
  kidneyDiseaseDetails?: string;
  hasHeartCondition?: boolean;
  heartConditionDetails?: string;
  otherConditions?: string;

  // Medications (legacy AUDIT-C format)
  takingMedications?: boolean;
  medicationList?: string;
  medicationAllergies?: string;

  // Previous Treatment (legacy AUDIT-C format)
  previousTreatment?: boolean;
  previousTreatmentDetails?: string;
  previousMedications?: string;

  // Alcohol Questions (legacy AUDIT-C format)
  audit_1?: string;
  audit_2?: string;
  audit_3?: string;
  alcoholQuitAttempts?: string;
  alcoholQuitDetails?: string;
  alcoholConcernLevel?: string;

  // Consent (collected during checkout, not part of intake form)
  hipaaConsent?: boolean;
  termsConsent?: boolean;
  telehealthConsent?: boolean;
  treatmentConsent?: boolean;

  // ---- DSM-5 Intake Form Fields ----

  // Pharmacy
  pharmacyName?: string;
  pharmacyAddress?: string;
  pharmacyCity?: string;
  pharmacyState?: string;
  pharmacyZip?: string;
  pharmacyPhone?: string;

  // DSM-5 AUD Screening (Q1-Q11)
  dsm5Q1?: boolean;
  dsm5Q2?: boolean;
  dsm5Q3?: boolean;
  dsm5Q4?: boolean;
  dsm5Q5?: boolean;
  dsm5Q6?: boolean;
  dsm5Q7?: boolean;
  dsm5Q8?: boolean;
  dsm5Q9?: boolean;
  dsm5Q10?: boolean;
  dsm5Q11?: boolean;

  // Current Drinking Pattern (Q12-Q15)
  drinkingDaysPerWeek?: string;
  drinksPerDay?: string;
  lastDrink?: string;
  bingeDrinking?: string;

  // Withdrawal Risk Assessment (Q16-Q19)
  withdrawalSeizure?: boolean;
  withdrawalDTs?: boolean;
  withdrawalHospitalized?: boolean;
  morningDrinking?: boolean;

  // Naltrexone Safety Screening (Q20-Q25)
  opioidUse?: string[];
  opioidMaintenance?: boolean;
  liverCondition?: string;
  liverTests?: string;
  pregnancyStatus?: string;
  drugAllergies?: string;

  // Medical & Psychiatric History (Q26-Q29)
  medicalHistory?: string[];
  currentMedications?: boolean;
  previousTreatments?: string[];
  seeingTherapist?: boolean;

  // Treatment Goals & Readiness (Q30-Q32)
  primaryGoal?: string;
  motivationLevel?: string;
  supportSystem?: string;

  // Demographics (Q33-Q34)
  biologicalSex?: string;
  biologicalSexOther?: string;
  age?: string;

  // Injected by submit route
  treatmentType?: string;
}

// ============================================================================
// Scoring Types
// ============================================================================

export interface IntakeScores {
  auditScore?: number; // 0-12 (AUDIT-C)
  riskScore: number; // 0-100
  complexityScore: number; // 0-100
}

export interface RiskAssessment {
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  description: string;
  recommendations: string[];
}

// ============================================================================
// API Types
// ============================================================================

export interface IntakeResponse {
  id: string;
  patientId: string;
  status: IntakeStatus;
  formData: Partial<IntakeFormData>;
  scores?: IntakeScores;
  riskAssessment?: RiskAssessment;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIntakeRequest {
  primaryConcern: ConcernType;
  formData?: Partial<IntakeFormData>;
}

export interface UpdateIntakeRequest {
  formData: Partial<IntakeFormData>;
  isDraft?: boolean;
}

export interface SubmitIntakeRequest {
  formData: IntakeFormData;
}

// ============================================================================
// UI Types
// ============================================================================

export interface FormSection {
  id: string;
  title: string;
  description: string;
  icon?: string;
  fields: string[];
  isOptional?: boolean;
}

export interface FormProgress {
  currentSection: number;
  totalSections: number;
  completedSections: string[];
  percentComplete: number;
}

export interface AutoSaveState {
  lastSaved: Date | null;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  error: string | null;
}

// ============================================================================
// Concern Type Mapping
// ============================================================================

// Note: SMOKING and BOTH concern types have been removed from the platform (2026-02-28).
// They remain in the Prisma enum for backward compatibility with existing database records.
export const CONCERN_TYPE_LABELS: Record<ConcernType, string> = {
  ALCOHOL: 'Alcohol Use',
  SMOKING: 'Discontinued',
  BOTH: 'Discontinued',
};

export const TREATMENT_GOAL_LABELS: Record<TreatmentGoal, string> = {
  QUIT: 'Stop completely',
  REDUCE: 'Reduce use',
  EXPLORE: 'Explore options',
};

// ============================================================================
// Section Definitions
// ============================================================================

export const INTAKE_SECTIONS: FormSection[] = [
  {
    id: 'personal',
    title: 'Personal Information',
    description: 'Basic information about you',
    fields: ['firstName', 'lastName', 'dateOfBirth', 'phone', 'email'],
  },
  {
    id: 'address',
    title: 'Address',
    description: 'Your California address',
    fields: ['addressStreet', 'addressCity', 'addressState', 'addressZip'],
  },
  {
    id: 'medical',
    title: 'Medical History',
    description: 'Important health information',
    fields: ['isPregnant', 'hasSeizureHistory', 'hasPsychiatricHistory', 'hasLiverDisease', 'hasKidneyDisease', 'hasHeartCondition'],
  },
  {
    id: 'medications',
    title: 'Medications',
    description: 'Current medications and allergies',
    fields: ['takingMedications', 'medicationList', 'medicationAllergies'],
    isOptional: true,
  },
  {
    id: 'alcohol',
    title: 'Alcohol Assessment',
    description: 'Questions about your alcohol use',
    fields: ['audit_1', 'audit_2', 'audit_3', 'alcoholQuitAttempts'],
  },
  {
    id: 'previous',
    title: 'Previous Treatment',
    description: 'Have you tried to quit before?',
    fields: ['previousTreatment', 'previousTreatmentDetails'],
    isOptional: true,
  },
  {
    id: 'consent',
    title: 'Consent',
    description: 'Review and consent to treatment',
    fields: ['hipaaConsent', 'termsConsent', 'telehealthConsent', 'treatmentConsent'],
  },
];
