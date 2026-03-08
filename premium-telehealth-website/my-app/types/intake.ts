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
  email: string;

  // Address
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;

  // Treatment
  primaryConcern: ConcernType;
  treatmentGoal: TreatmentGoal;

  // Medical History
  isPregnant: boolean;
  isPregnantDetails?: string;
  hasSeizureHistory: boolean;
  seizureDetails?: string;
  hasPsychiatricHistory: boolean;
  psychiatricDetails?: string;
  hasLiverDisease: boolean;
  liverDiseaseDetails?: string;
  hasKidneyDisease: boolean;
  kidneyDiseaseDetails?: string;
  hasHeartCondition: boolean;
  heartConditionDetails?: string;
  otherConditions?: string;

  // Medications
  takingMedications: boolean;
  medicationList?: string;
  medicationAllergies?: string;

  // Previous Treatment
  previousTreatment: boolean;
  previousTreatmentDetails?: string;
  previousMedications?: string;

  // Alcohol Questions (AUDIT-C)
  audit_1?: string; // How often drink alcohol
  audit_2?: string; // How many drinks typical day
  audit_3?: string; // How often 6+ drinks
  alcoholQuitAttempts?: string;
  alcoholQuitDetails?: string;
  alcoholConcernLevel?: string;

  // Consent
  hipaaConsent: boolean;
  termsConsent: boolean;
  telehealthConsent: boolean;
  treatmentConsent: boolean;
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
