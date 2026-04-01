/**
 * Physician Dashboard Types
 * 
 * Type definitions for the physician portal dashboard and related components.
 * 
 * @module types/physician-dashboard
 */

import { IntakeStatus, PrescriptionStatus, MessageStatus, SenderType } from '@prisma/client';

// ============================================================================
// Dashboard Stats
// ============================================================================

/**
 * Dashboard statistics for physician overview
 */
export interface PhysicianDashboardStats {
  /** Number of pending intake reviews */
  pendingReviews: number;
  /** Number of patients seen today */
  patientsToday: number;
  /** Number of unread patient messages */
  unreadMessages: number;
  /** Number of prescriptions written this month */
  prescriptionsThisMonth: number;
  /** Number of overdue reviews (>24h) */
  overdueReviews: number;
  /** Average review time in hours */
  averageReviewTime: number;
}

// ============================================================================
// Review Queue Types
// ============================================================================

/**
 * Treatment type for patient intake
 */
// Note: Only ALCOHOL is actively used. SMOKING and BOTH remain for backward compatibility.
export type TreatmentType = 'ALCOHOL' | 'SMOKING' | 'BOTH';

/**
 * Review status for intake items
 */
export type ReviewStatus = 'PENDING' | 'IN_REVIEW' | 'COMPLETED' | 'NEEDS_INFO';

/**
 * Risk level for patient prioritization
 */
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';

/**
 * Queue item representing a pending intake for physician review
 */
export interface ReviewQueueItem {
  /** Unique intake ID */
  intakeId: string;
  /** Patient user ID */
  patientId: string;
  /** Patient full name */
  patientName: string;
  /** Patient age */
  patientAge: number;
  /** Patient gender */
  patientGender?: string;
  /** Primary treatment type */
  treatmentType: TreatmentType;
  /** Current review status */
  status: ReviewStatus;
  /** When intake was submitted */
  submittedAt: Date;
  /** Hours since submission */
  waitTimeHours: number;
  /** True if waiting over 24 hours (SLA breach) */
  isOverdue: boolean;
  /** Risk assessment score (0-100) */
  riskScore?: number;
  /** Risk level based on score */
  riskLevel: RiskLevel;
  /** Brief summary of patient history */
  summary?: string;
  /** Assigned physician ID (if any) */
  assignedTo?: string;
  /** AUDIT-C score for alcohol assessments */
  auditScore?: number;
}

/**
 * Review queue filters
 */
export interface ReviewQueueFilters {
  /** Filter by treatment type */
  treatmentType?: TreatmentType | 'ALL';
  /** Filter by status */
  status?: ReviewStatus | 'ALL';
  /** Filter by risk level */
  riskLevel?: RiskLevel | 'ALL';
  /** Search by patient name */
  searchQuery?: string;
  /** Sort column */
  sortBy: 'submittedAt' | 'waitTimeHours' | 'patientName' | 'riskScore';
  /** Sort direction */
  sortOrder: 'asc' | 'desc';
}

/**
 * Review queue statistics
 */
export interface ReviewQueueStats {
  /** Total pending reviews */
  totalPending: number;
  /** Number of overdue items (>24h) */
  overdueCount: number;
  /** Number under review */
  inReviewCount: number;
  /** Number newly submitted */
  newlySubmittedCount: number;
  /** High risk count */
  highRiskCount: number;
}

// ============================================================================
// Intake Review Form Types
// ============================================================================

/**
 * Review decision options
 */
export type ReviewDecision = 'APPROVED' | 'DECLINED' | 'NEEDS_INFO';

/**
 * ICD-10 diagnosis code
 */
export interface DiagnosisCode {
  code: string;
  description: string;
}

/**
 * Prescription data for intake review
 */
export interface ReviewPrescription {
  /** Medication name */
  medicationName: string;
  /** Generic name */
  genericName?: string;
  /** Dosage (e.g., "50mg") */
  dosage: string;
  /** Frequency (e.g., "once daily") */
  frequency: string;
  /** Quantity to dispense */
  quantity: number;
  /** Number of refills allowed */
  refills: number;
  /** Special instructions */
  instructions?: string;
  /** Pharmacy ID */
  pharmacyId?: string;
  /** Pharmacy name */
  pharmacyName?: string;
}

/**
 * Intake review form data
 */
export interface IntakeReviewFormData {
  /** Review decision */
  decision: ReviewDecision;
  /** Physician notes */
  notes: string;
  /** Internal notes (not visible to patient) */
  internalNotes?: string;
  /** ICD-10 diagnosis codes */
  diagnosis: DiagnosisCode[];
  /** Prescription if approved */
  prescription?: ReviewPrescription;
  /** Reason for decline (if declined) */
  declineReason?: string;
  /** Information requested (if needs_info) */
  informationRequested?: string;
}

// ============================================================================
// Patient Management Types
// ============================================================================

/**
 * Patient list item for physician view
 */
export interface PhysicianPatientListItem {
  /** Patient ID */
  id: string;
  /** Patient full name */
  name: string;
  /** Patient age */
  age: number;
  /** Patient gender */
  gender?: string;
  /** Primary treatment type */
  treatmentType: TreatmentType;
  /** Current status */
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'COMPLETED';
  /** Date enrolled */
  enrolledAt: Date;
  /** Last visit date */
  lastVisitAt?: Date;
  /** Next scheduled appointment */
  nextAppointmentAt?: Date;
  /** Active prescriptions count */
  activePrescriptions: number;
  /** Unread messages count */
  unreadMessages: number;
  /** Risk level */
  riskLevel: RiskLevel;
  /** Email (masked) */
  emailMasked: string;
  /** Phone (masked) */
  phoneMasked: string;
  /** Whether the patient's account has been deactivated */
  isDeactivated?: boolean;
}

/**
 * Physician note type
 */
export type PhysicianNoteType = 'CLINICAL' | 'ADMINISTRATIVE';

/**
 * Physician note
 */
export interface PhysicianNote {
  id: string;
  content: string;
  type: PhysicianNoteType;
  createdAt: Date;
  physician: {
    firstName: string;
    lastName: string;
  };
}

/**
 * Patient document
 */
export interface PatientDocument {
  id: string;
  name: string;
  type: string;
  uploadedAt: Date;
  size: number;
  category: 'INSURANCE' | 'IDENTIFICATION' | 'MEDICAL_RECORD' | 'LAB_RESULT' | 'OTHER';
}

/**
 * Patient detail for physician view
 */
export interface PhysicianPatientDetail extends PhysicianPatientListItem {
  /** Date of birth */
  dateOfBirth?: Date;
  /** Full address */
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  /** Emergency contact */
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  /** Full medical history */
  medicalHistory?: {
    conditions: string[];
    medications: string[];
    allergies: string[];
    surgeries?: string[];
    familyHistory?: string[];
  };
  /** Treatment preferences */
  treatmentPreferences?: {
    preferredPharmacy?: string;
    communicationPreference?: string;
    languagePreference?: string;
  };
  /** All intakes for this patient */
  intakes: {
    id: string;
    status: IntakeStatus;
    submittedAt: Date;
    reviewedAt?: Date;
    reviewedBy?: string;
    riskScore?: number;
    outcome?: string;
    notes?: string;
  }[];
  /** All prescriptions */
  prescriptions: {
    id: string;
    medicationName: string;
    genericName?: string;
    dosage: string;
    frequency?: string;
    quantity: number;
    refillsRemaining: number;
    status: PrescriptionStatus;
    prescribedAt: Date;
    pharmacyName: string;
    instructions?: string;
  }[];
  /** Recent messages */
  recentMessages: {
    id: string;
    subject?: string;
    body: string;
    senderType: SenderType;
    sentAt: Date;
    read: boolean;
  }[];
  /** Treatment timeline */
  timeline: {
    date: Date;
    event: string;
    type: 'intake' | 'prescription' | 'message' | 'appointment' | 'note';
  }[];
  /** Physician notes */
  notes?: PhysicianNote[];
  /** Patient documents */
  documents?: PatientDocument[];
}

/**
 * Patient filters
 */
export interface PatientFilters {
  /** Filter by treatment type */
  treatmentType?: TreatmentType | 'ALL';
  /** Filter by status */
  status?: string;
  /** Filter by risk level */
  riskLevel?: RiskLevel | 'ALL';
  /** Search by name */
  searchQuery?: string;
  /** Sort column */
  sortBy: 'name' | 'enrolledAt' | 'lastVisitAt' | 'riskScore';
  /** Sort direction */
  sortOrder: 'asc' | 'desc';
}

// ============================================================================
// Prescription Management Types
// ============================================================================

/**
 * Prescription list item for physician view
 */
export interface PhysicianPrescriptionListItem {
  /** Prescription ID */
  id: string;
  /** Patient ID */
  patientId: string;
  /** Patient name */
  patientName: string;
  /** Medication name */
  medicationName: string;
  /** Generic name */
  genericName: string;
  /** Dosage */
  dosage: string;
  /** Quantity */
  quantity: number;
  /** Refills remaining */
  refillsRemaining: number;
  /** Current status */
  status: PrescriptionStatus;
  /** Date prescribed */
  prescribedAt: Date;
  /** Date sent to pharmacy */
  sentAt?: Date;
  /** Pharmacy name */
  pharmacyName: string;
}

/**
 * Medication option for prescription writer
 */
export interface MedicationOption {
  /** Medication ID */
  id: string;
  /** Brand name */
  name: string;
  /** Generic name */
  genericName: string;
  /** Available dosages */
  dosages: string[];
  /** Common frequencies */
  frequencies: string[];
  /** Typical quantities */
  quantities: number[];
  /** Maximum refills allowed */
  maxRefills: number;
  /** Drug class */
  drugClass: string;
  /** Controlled substance schedule (if applicable) */
  controlledSchedule?: number;
}

/**
 * Pharmacy option
 */
export interface PharmacyOption {
  /** Pharmacy ID */
  id: string;
  /** Pharmacy name */
  name: string;
  /** Address */
  address: string;
  /** Phone number */
  phone: string;
  /** NCPDP ID */
  ncpdpId: string;
}

// ============================================================================
// Messaging Types
// ============================================================================

/**
 * Message thread for physician view
 */
export interface PhysicianMessageThread {
  /** Thread ID (patient ID) */
  patientId: string;
  /** Patient name */
  patientName: string;
  /** Last message preview */
  lastMessagePreview: string;
  /** Last message date */
  lastMessageAt: Date;
  /** Unread count */
  unreadCount: number;
  /** Patient avatar/initials */
  patientInitials: string;
}

/**
 * Message in a thread
 */
export interface PhysicianMessage {
  /** Message ID */
  id: string;
  /** Thread/patient ID */
  patientId: string;
  /** Sender type */
  senderType: SenderType;
  /** Sender name */
  senderName: string;
  /** Message subject */
  subject?: string;
  /** Message body */
  body: string;
  /** Sent timestamp */
  sentAt: Date;
  /** Read timestamp */
  readAt?: Date;
  /** Whether message has been read (computed) */
  read?: boolean;
  /** Attachments */
  attachments?: {
    id: string;
    name: string;
    url: string;
    type: string;
  }[];
}

// ============================================================================
// Message Form Types
// ============================================================================

/**
 * Form values for sending a message
 */
export interface MessageFormValues {
  /** Message subject */
  subject?: string;
  /** Message body */
  body: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Treatment type labels for display
 */
export const TREATMENT_TYPE_LABELS: Record<TreatmentType | 'ALL', string> = {
  ALL: 'All Types',
  ALCOHOL: 'Alcohol Use',
  SMOKING: 'Discontinued',
  BOTH: 'Discontinued',
};

/**
 * Review status labels for display
 */
export const REVIEW_STATUS_LABELS: Record<ReviewStatus | 'ALL', string> = {
  ALL: 'All Statuses',
  PENDING: 'Pending Review',
  IN_REVIEW: 'Under Review',
  COMPLETED: 'Completed',
  NEEDS_INFO: 'Needs Information',
};

/**
 * Risk level labels and colors
 */
export const RISK_LEVEL_CONFIG: Record<RiskLevel, { label: string; color: string; variant: string }> = {
  LOW: { label: 'Low Risk', color: 'text-green-600 bg-green-50 border-green-200', variant: 'default' },
  MODERATE: { label: 'Moderate', color: 'text-yellow-600 bg-yellow-50 border-yellow-200', variant: 'secondary' },
  HIGH: { label: 'High Risk', color: 'text-orange-600 bg-orange-50 border-orange-200', variant: 'outline' },
  SEVERE: { label: 'Severe', color: 'text-red-600 bg-red-50 border-red-200', variant: 'destructive' },
};

/**
 * Get risk level from score
 */
export function getRiskLevelFromScore(score?: number): RiskLevel {
  if (score === undefined) return 'LOW';
  if (score >= 70) return 'SEVERE';
  if (score >= 50) return 'HIGH';
  if (score >= 30) return 'MODERATE';
  return 'LOW';
}

/**
 * Format wait time for display
 */
export function formatWaitTime(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} min`;
  }
  if (hours < 24) {
    return `${Math.round(hours)}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  if (remainingHours === 0) {
    return `${days}d`;
  }
  return `${days}d ${remainingHours}h`;
}

/**
 * Patient status labels
 */
export const PATIENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Active', color: 'text-green-600 bg-green-50 border-green-200' },
  INACTIVE: { label: 'Inactive', color: 'text-gray-600 bg-gray-50 border-gray-200' },
  PENDING: { label: 'Pending', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  COMPLETED: { label: 'Completed', color: 'text-blue-600 bg-blue-50 border-blue-200' },
};
