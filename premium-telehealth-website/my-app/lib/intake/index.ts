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
  calculateDSM5Score,
  detectContraindications,
  assessWithdrawalRisk,
  generateProviderDecisionSummary,
  type AuditCResult,
  type RiskScoreParams,
  type ComplexityScoreParams,
  type DSM5Result,
  type DSM5Severity,
  type ContraindicationResult,
  type WithdrawalRiskResult,
  type ProviderDecisionSummary,
} from './scoring';

// Note: The auto-save module (auto-save.ts) was removed because it stored
// unencrypted PHI in browser sessionStorage, violating HIPAA requirements.
// The current IntakeClient.tsx uses server-side auto-save instead.

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
