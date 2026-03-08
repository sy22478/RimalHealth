/**
 * Intake Module
 * Dynamic intake form system for patient onboarding
 * 
 * @module lib/intake
 */

// Question definitions
export {
  AUDIT_C_QUESTIONS,
  MEDICAL_HISTORY_QUESTIONS,
  MEDICATIONS_QUESTIONS,
  PREVIOUS_TREATMENT_QUESTIONS,
  ALCOHOL_SPECIFIC_QUESTIONS,
  getQuestionSections,
  getAllQuestions,
  getQuestionById,
  getConditionalQuestions,
  shouldShowQuestion,
  getOptionScore,
} from './questions';

// Validation schemas
export {
  medicalHistorySchema,
  medicationsSchema,
  auditCSchema,
  previousTreatmentSchema,
  consentSchema,
  createIntakeSchema,
  draftIntakeSchema,
  validateSection,
  isIntakeComplete,
  type MedicalHistoryData,
  type MedicationsData,
  type AuditCData,
  type PreviousTreatmentData,
  type ConsentData,
  type DraftIntakeData,
} from './validations';

// Scoring algorithms
export {
  calculateAuditCScore,
  calculateRiskScore,
  calculateComplexityScore,
  generateRiskAssessment,
  calculateIntakeScores,
  type AuditCResult,
  type RiskScoreParams,
  type ComplexityScoreParams,
} from './scoring';

// Auto-save functionality
export {
  saveDraftToLocalStorage,
  loadDraftFromLocalStorage,
  clearDraftFromLocalStorage,
  hasSavedDraft,
  saveDraftToServer,
  loadDraftFromServer,
  debounce,
  throttle,
  createAutoSaveHandler,
  calculateProgress,
  type AutoSaveState,
  type AutoSaveStatus,
  type SavedDraft,
  type AutoSaveOptions,
  type AutoSaveActions,
} from './auto-save';

// Types
export type {
  Question,
  QuestionOption,
  QuestionSection,
  IntakeFormData,
  IntakeScores,
  RiskAssessment,
  IntakeResponse,
  CreateIntakeRequest,
  UpdateIntakeRequest,
  SubmitIntakeRequest,
  FormSection,
  FormProgress,
} from '@/types/intake';
