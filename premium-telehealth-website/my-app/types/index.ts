/**
 * Type Definitions
 * 
 * Central export point for all TypeScript types used in the application.
 * 
 * @module types
 */

// ============================================
// Auth Types
// ============================================

export type {
  // JWT Payloads
  AccessTokenPayload,
  RefreshTokenPayload,
  
  // Session Types
  SessionUser,
  Session,
  
  // API Types
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  AuthErrorResponse,
  
  // Request Context
  AuthRequestHeaders,
  AuthContext,
  
  // Role Types
  RoleRouteConfig,
  RoleDashboardUrl,
  
  // Re-export Role enum
  Role,
} from './next-auth';

// Dashboard Types
export type {
  DashboardStatus,
  DashboardPatientProfile,
  DashboardIntake,
  DashboardSubscription,
  DashboardPrescription,
  DashboardMessage,
  DashboardData,
  StatusIconType,
  StatusConfig,
  QuickAction,
} from './dashboard';

export {
  getDashboardStatus,
  statusConfig,
  getNextSteps,
  defaultQuickActions,
  formatDistanceToNow,
  formatPrescriptionStatus,
  formatIntakeStatus,
  formatSubscriptionStatus,
  formatConcernType,
  formatTreatmentGoal,
  formatCurrency,
} from './dashboard';

// Intake Types
export type {
  QuestionType,
  QuestionOption,
  Question,
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
  AutoSaveState,
} from './intake';

export {
  CONCERN_TYPE_LABELS,
  TREATMENT_GOAL_LABELS,
  INTAKE_SECTIONS,
} from './intake';

// Prescription Types
export type {
  Prescription,
  PrescriptionSummary,
  RefillRequest,
  RefillRequestWithDetails,
  ListPrescriptionsResponse,
  GetPrescriptionResponse,
  RequestRefillResponse,
} from './prescriptions';

export {
  prescriptionStatusVariants,
  refillStatusVariants,
  formatPrescriptionStatusText,
  formatRefillStatus,
  getDaysRemaining,
  getDaysUntilRefill,
  canRequestRefill,
  getRefillEligibilityMessage,
  getDaysRemainingProgress,
  getDaysRemainingColorClass,
} from './prescriptions';

// Physician Queue Types
export type {
  ConcernType,
  QueueIntakeStatus,
  RiskLevel,
  QueueItem,
  QueueStats,
  QueueFilters,
  QueueApiResponse,
  RiskScoreConfig,
  QueueRefreshState,
} from './physician-queue';

export {
  getPatientInitials,
  formatWaitTime,
  getRiskScoreConfig,
  CONCERN_TYPE_LABELS as QUEUE_CONCERN_TYPE_LABELS,
  QUEUE_STATUS_LABELS,
  DEFAULT_QUEUE_FILTERS,
} from './physician-queue';

// Physician Dashboard Types
export type {
  PhysicianDashboardStats,
  TreatmentType,
  ReviewStatus,
  ReviewQueueItem,
  ReviewQueueFilters,
  ReviewQueueStats,
  ReviewDecision,
  DiagnosisCode,
  ReviewPrescription,
  IntakeReviewFormData,
  PhysicianPatientListItem,
  PhysicianPatientDetail,
  PatientFilters,
  PhysicianPrescriptionListItem,
  MedicationOption,
  PharmacyOption,
  PhysicianMessageThread,
  PhysicianMessage,
} from './physician-dashboard';

export {
  TREATMENT_TYPE_LABELS,
  REVIEW_STATUS_LABELS,
  RISK_LEVEL_CONFIG,
  getRiskLevelFromScore,
  formatWaitTime as formatReviewWaitTime,
  PATIENT_STATUS_LABELS,
} from './physician-dashboard';
