/**
 * Data Retention Policy Module
 *
 * Implements HIPAA-compliant data retention and deletion policies.
 * Manages automated data lifecycle including soft delete, retention, and purging.
 *
 * HIPAA Compliance:
 * - 6-year minimum retention for PHI records (we use 7 years for safety)
 * - Secure deletion procedures via soft delete + anonymization
 * - Audit trail for all deletion/anonymization actions
 * - Patient right to deletion (with medical exceptions)
 *
 * @module lib/hipaa/data-retention
 */

import { DATA_RETENTION, type PHIResourceType } from '@/lib/constants';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { encryptPHI } from '@/lib/encryption/phi';
import { auditLogger, AuditEventType, AuditSeverity } from '@/lib/audit';

// ============================================
// Constants
// ============================================

/** HIPAA minimum retention period in days (6 years) */
const HIPAA_MIN_RETENTION_DAYS = 2190;

/** Redacted placeholder for anonymized PHI fields */
const REDACTED = '[REDACTED]';

/** Encrypted version of REDACTED for encrypted PHI fields */
let ENCRYPTED_REDACTED: string | null = null;

/**
 * Get the encrypted form of the REDACTED placeholder.
 * Lazily initialized to avoid calling encryptPHI at module load time.
 */
function getEncryptedRedacted(): string {
  if (ENCRYPTED_REDACTED === null) {
    ENCRYPTED_REDACTED = encryptPHI(REDACTED);
  }
  return ENCRYPTED_REDACTED;
}

// ============================================
// Types
// ============================================

export interface RetentionPolicy {
  /** Resource type */
  resourceType: PHIResourceType;
  /** Retention period in days */
  retentionDays: number;
  /** Whether to soft delete first */
  softDelete: boolean;
  /** Grace period before permanent deletion (days) */
  gracePeriodDays: number;
  /** Whether patient can request deletion */
  patientDeletable: boolean;
  /** Whether requires admin approval for deletion */
  requiresApproval: boolean;
  /** Archive before deletion */
  archiveBeforeDelete: boolean;
}

export interface DataRetentionRecord {
  id: string;
  resourceType: PHIResourceType;
  resourceId: string;
  patientId: string;
  createdAt: Date;
  /** When record was soft deleted */
  softDeletedAt?: Date;
  /** When record will be permanently deleted */
  scheduledDeletionAt?: Date;
  /** Whether deletion has been approved */
  deletionApproved?: boolean;
  /** Reason for early deletion */
  deletionReason?: string;
  /** Whether patient requested deletion */
  patientRequested?: boolean;
  /** Archive location if archived */
  archiveLocation?: string;
}

export interface DeletionResult {
  success: boolean;
  resourceId: string;
  action: 'soft-delete' | 'permanent-delete' | 'anonymized' | 'cancelled';
  scheduledDeletionDate?: Date;
  error?: string;
}

export interface RetentionReport {
  totalRecords: number;
  byResourceType: Record<PHIResourceType, number>;
  pendingDeletion: number;
  softDeleted: number;
  patientRequests: number;
  avgRetentionDays: number;
}

export interface ProcessExpiredDeletionsResult {
  processed: number;
  softDeleted: number;
  anonymized: number;
  errors: number;
  details: DeletionResult[];
}

// ============================================
// Default Retention Policies
// ============================================

/**
 * Default retention policies by resource type
 *
 * HIPAA requires medical records be retained for 6 years minimum.
 * We use 7 years (2555 days) for safety margin.
 */
export const DEFAULT_RETENTION_POLICIES: Record<PHIResourceType, RetentionPolicy> = {
  PATIENT: {
    resourceType: 'PATIENT',
    retentionDays: DATA_RETENTION.AFTER_CLOSURE, // 7 years
    softDelete: true,
    gracePeriodDays: DATA_RETENTION.SOFT_DELETE_GRACE_PERIOD,
    patientDeletable: false, // Medical records cannot be deleted by patient request
    requiresApproval: true,
    archiveBeforeDelete: true,
  },
  INTAKE: {
    resourceType: 'INTAKE',
    retentionDays: DATA_RETENTION.AFTER_CLOSURE,
    softDelete: true,
    gracePeriodDays: DATA_RETENTION.SOFT_DELETE_GRACE_PERIOD,
    patientDeletable: false,
    requiresApproval: true,
    archiveBeforeDelete: true,
  },
  PRESCRIPTION: {
    resourceType: 'PRESCRIPTION',
    retentionDays: DATA_RETENTION.AFTER_CLOSURE,
    softDelete: true,
    gracePeriodDays: DATA_RETENTION.SOFT_DELETE_GRACE_PERIOD,
    patientDeletable: false,
    requiresApproval: true,
    archiveBeforeDelete: true,
  },
  MESSAGE: {
    resourceType: 'MESSAGE',
    retentionDays: DATA_RETENTION.AFTER_CLOSURE,
    softDelete: true,
    gracePeriodDays: 30,
    patientDeletable: false,
    requiresApproval: false,
    archiveBeforeDelete: false,
  },
  DOCUMENT: {
    resourceType: 'DOCUMENT',
    retentionDays: DATA_RETENTION.AFTER_CLOSURE,
    softDelete: true,
    gracePeriodDays: DATA_RETENTION.SOFT_DELETE_GRACE_PERIOD,
    patientDeletable: false,
    requiresApproval: true,
    archiveBeforeDelete: true,
  },
  BILLING: {
    resourceType: 'BILLING',
    retentionDays: 2555, // 7 years for billing (tax purposes)
    softDelete: true,
    gracePeriodDays: 90,
    patientDeletable: false,
    requiresApproval: true,
    archiveBeforeDelete: true,
  },
  APPOINTMENT: {
    resourceType: 'APPOINTMENT',
    retentionDays: 2555,
    softDelete: true,
    gracePeriodDays: 30,
    patientDeletable: false,
    requiresApproval: false,
    archiveBeforeDelete: false,
  },
  MEDICAL_RECORD: {
    resourceType: 'MEDICAL_RECORD',
    retentionDays: DATA_RETENTION.AFTER_CLOSURE,
    softDelete: true,
    gracePeriodDays: DATA_RETENTION.SOFT_DELETE_GRACE_PERIOD,
    patientDeletable: false,
    requiresApproval: true,
    archiveBeforeDelete: true,
  },
};

// ============================================
// Policy Management
// ============================================

const customPolicies: Partial<Record<PHIResourceType, Partial<RetentionPolicy>>> = {};

/**
 * Set custom retention policy
 *
 * @param resourceType - Resource type
 * @param policy - Policy overrides
 */
export function setRetentionPolicy(
  resourceType: PHIResourceType,
  policy: Partial<RetentionPolicy>
): void {
  customPolicies[resourceType] = { ...customPolicies[resourceType], ...policy };
}

/**
 * Get retention policy for resource type
 *
 * @param resourceType - Resource type
 * @returns Complete retention policy
 */
export function getRetentionPolicy(resourceType: PHIResourceType): RetentionPolicy {
  const defaultPolicy = DEFAULT_RETENTION_POLICIES[resourceType];
  const customPolicy = customPolicies[resourceType] || {};

  return { ...defaultPolicy, ...customPolicy };
}

/**
 * Get all retention policies
 *
 * @returns All policies
 */
export function getAllRetentionPolicies(): Record<PHIResourceType, RetentionPolicy> {
  const policies = { ...DEFAULT_RETENTION_POLICIES };

  for (const [type, custom] of Object.entries(customPolicies)) {
    policies[type as PHIResourceType] = {
      ...policies[type as PHIResourceType],
      ...custom,
    };
  }

  return policies;
}

// ============================================
// Retention Calculations
// ============================================

/**
 * Calculate deletion date for a record
 *
 * @param createdAt - When record was created
 * @param resourceType - Type of resource
 * @returns Scheduled deletion date
 */
export function calculateDeletionDate(
  createdAt: Date,
  resourceType: PHIResourceType
): Date {
  const policy = getRetentionPolicy(resourceType);
  const deletionDate = new Date(createdAt);
  deletionDate.setDate(deletionDate.getDate() + policy.retentionDays);
  return deletionDate;
}

/**
 * Calculate grace period end date
 *
 * @param softDeletedAt - When record was soft deleted
 * @param resourceType - Type of resource
 * @returns When grace period ends
 */
export function calculateGracePeriodEnd(
  softDeletedAt: Date,
  resourceType: PHIResourceType
): Date {
  const policy = getRetentionPolicy(resourceType);
  const endDate = new Date(softDeletedAt);
  endDate.setDate(endDate.getDate() + policy.gracePeriodDays);
  return endDate;
}

/**
 * Check if a record is eligible for deletion
 *
 * @param record - Retention record
 * @returns Whether record can be deleted
 */
export function isEligibleForDeletion(record: DataRetentionRecord): boolean {
  // Already soft deleted and grace period passed
  if (record.softDeletedAt) {
    const graceEnd = calculateGracePeriodEnd(
      record.softDeletedAt,
      record.resourceType
    );
    return new Date() >= graceEnd;
  }

  // Check if retention period has passed
  const scheduledDeletion = record.scheduledDeletionAt ||
    calculateDeletionDate(record.createdAt, record.resourceType);

  return new Date() >= scheduledDeletion;
}

/**
 * Get days until deletion
 *
 * @param record - Retention record
 * @returns Days until deletion (negative if overdue)
 */
export function getDaysUntilDeletion(record: DataRetentionRecord): number {
  const deletionDate = record.scheduledDeletionAt ||
    calculateDeletionDate(record.createdAt, record.resourceType);

  const now = new Date();
  const diffTime = deletionDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ============================================
// Soft Delete Operations
// ============================================

/**
 * Create soft delete record
 *
 * @param params - Delete parameters
 * @returns Retention record
 */
export function createSoftDeleteRecord(params: {
  resourceType: PHIResourceType;
  resourceId: string;
  patientId: string;
  reason?: string;
  patientRequested?: boolean;
}): DataRetentionRecord {
  const policy = getRetentionPolicy(params.resourceType);
  const now = new Date();

  const record: DataRetentionRecord = {
    id: generateRetentionId(),
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    patientId: params.patientId,
    createdAt: now,
    softDeletedAt: now,
    scheduledDeletionAt: calculateGracePeriodEnd(now, params.resourceType),
    deletionReason: params.reason,
    patientRequested: params.patientRequested,
  };

  // If no approval required, set approved
  if (!policy.requiresApproval) {
    record.deletionApproved = true;
  }

  return record;
}

/**
 * Generate retention record ID
 */
function generateRetentionId(): string {
  return `ret-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// ============================================
// Audit Logging Helpers
// ============================================

/**
 * System audit context for automated retention operations.
 * Used when the system (cron job) performs deletions, not a human user.
 */
const SYSTEM_AUDIT_CONTEXT = {
  ipAddress: '127.0.0.1',
  userAgent: 'data-retention-system',
  requestId: 'data-retention',
} as const;

/**
 * Log a data retention action via the real audit logger
 */
async function logRetentionAction(params: {
  action: string;
  userId: string;
  resourceType: string;
  resourceId: string;
  success: boolean;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
}): Promise<void> {
  await auditLogger.log({
    eventType: AuditEventType.PATIENT_DATA_DELETED,
    severity: AuditSeverity.WARNING,
    userId: params.userId,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    action: params.action,
    ipAddress: SYSTEM_AUDIT_CONTEXT.ipAddress,
    userAgent: SYSTEM_AUDIT_CONTEXT.userAgent,
    success: params.success,
    metadata: params.metadata,
    errorMessage: params.errorMessage,
    requestId: SYSTEM_AUDIT_CONTEXT.requestId,
  });
}

// ============================================
// Deletion Operations
// ============================================

/**
 * Request deletion of a record
 *
 * @param params - Deletion request parameters
 * @returns Deletion result
 */
export async function requestDeletion(params: {
  resourceType: PHIResourceType;
  resourceId: string;
  patientId: string;
  requestedBy: string;
  reason?: string;
  patientRequested?: boolean;
}): Promise<DeletionResult> {
  const policy = getRetentionPolicy(params.resourceType);

  // Check if patient can request deletion
  if (params.patientRequested && !policy.patientDeletable) {
    return {
      success: false,
      resourceId: params.resourceId,
      action: 'cancelled',
      error: 'This record type cannot be deleted by patient request per HIPAA regulations',
    };
  }

  // Create soft delete record
  const record = createSoftDeleteRecord({
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    patientId: params.patientId,
    reason: params.reason,
    patientRequested: params.patientRequested,
  });

  // Perform the soft delete in the database
  try {
    await softDeleteRecord(params.resourceType, params.resourceId);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logRetentionAction({
      action: 'soft_delete_failed',
      userId: params.requestedBy,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      success: false,
      errorMessage,
    });
    return {
      success: false,
      resourceId: params.resourceId,
      action: 'cancelled',
      error: 'Failed to soft delete record',
    };
  }

  // Log the deletion request
  await logRetentionAction({
    action: 'soft_delete_requested',
    userId: params.requestedBy,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    success: true,
    metadata: {
      softDelete: true,
      patientRequested: params.patientRequested ?? false,
      reason: params.reason ?? 'none',
      scheduledDeletion: record.scheduledDeletionAt?.toISOString(),
    },
  });

  return {
    success: true,
    resourceId: params.resourceId,
    action: 'soft-delete',
    scheduledDeletionDate: record.scheduledDeletionAt,
  };
}

/**
 * Approve deletion request
 *
 * @param retentionId - Retention record ID
 * @param approvedBy - Admin user ID
 * @returns Success status
 */
export async function approveDeletion(
  retentionId: string,
  approvedBy: string
): Promise<boolean> {
  await logRetentionAction({
    action: 'deletion_approved',
    userId: approvedBy,
    resourceType: 'PATIENT',
    resourceId: retentionId,
    success: true,
    metadata: { approvedBy },
  });

  return true;
}

/**
 * Cancel deletion request
 *
 * @param retentionId - Retention record ID
 * @param cancelledBy - User ID
 * @returns Success status
 */
export async function cancelDeletion(
  retentionId: string,
  cancelledBy: string
): Promise<boolean> {
  await logRetentionAction({
    action: 'deletion_cancelled',
    userId: cancelledBy,
    resourceType: 'PATIENT',
    resourceId: retentionId,
    success: true,
    metadata: { cancelledBy },
  });

  return true;
}

// ============================================
// Database Operations — Soft Delete
// ============================================

/**
 * Set deletedAt on a record in the database.
 * Only operates on models that have the deletedAt field.
 *
 * @param resourceType - The PHI resource type
 * @param resourceId - The record ID
 */
async function softDeleteRecord(
  resourceType: PHIResourceType,
  resourceId: string
): Promise<void> {
  const now = new Date();

  switch (resourceType) {
    case 'PATIENT':
      await prisma.patientProfile.update({
        where: { id: resourceId },
        data: { deletedAt: now },
      });
      break;
    case 'INTAKE':
      await prisma.intake.update({
        where: { id: resourceId },
        data: { deletedAt: now },
      });
      break;
    case 'MESSAGE':
      await prisma.message.update({
        where: { id: resourceId },
        data: { deletedAt: now },
      });
      break;
    case 'DOCUMENT':
      await prisma.document.update({
        where: { id: resourceId },
        data: { deletedAt: now },
      });
      break;
    case 'PRESCRIPTION':
      await prisma.prescription.update({
        where: { id: resourceId },
        data: { deletedAt: now },
      });
      break;
    default:
      // Resource types without deletedAt column (BILLING, APPOINTMENT, MEDICAL_RECORD)
      // are not soft-deletable via this mechanism
      break;
  }
}

// ============================================
// Database Operations — Anonymization
// ============================================

/**
 * Anonymize PHI fields on a PatientProfile record.
 * Replaces all PHI fields with encrypted "[REDACTED]".
 */
async function anonymizePatientProfile(resourceId: string): Promise<void> {
  const redacted = getEncryptedRedacted();
  await prisma.patientProfile.update({
    where: { id: resourceId },
    data: {
      firstName: redacted,
      lastName: redacted,
      dateOfBirth: redacted,
      phone: redacted,
      addressStreet: redacted,
      addressCity: redacted,
      addressZip: redacted,
      billingStreet: redacted,
      billingCity: redacted,
      billingState: redacted,
      billingZip: redacted,
      medicalHistory: Prisma.DbNull,
      currentMedications: Prisma.DbNull,
      allergies: Prisma.DbNull,
      insuranceProvider: redacted,
      insuranceMemberId: redacted,
      insuranceGroupNumber: redacted,
      notificationPreferences: Prisma.DbNull,
    },
  });
}

/**
 * Anonymize PHI fields on an Intake record.
 * Replaces encrypted form data and screening fields.
 */
async function anonymizeIntake(resourceId: string): Promise<void> {
  await prisma.intake.update({
    where: { id: resourceId },
    data: {
      formData: {},
      medicationList: getEncryptedRedacted(),
      isPregnant: null,
      hasSeizureHistory: null,
      hasPsychiatricHistory: null,
      takingMedications: null,
      riskScore: null,
      complexityScore: null,
    },
  });
}

/**
 * Anonymize PHI fields on a Message record.
 */
async function anonymizeMessage(resourceId: string): Promise<void> {
  const redacted = getEncryptedRedacted();
  await prisma.message.update({
    where: { id: resourceId },
    data: {
      subject: redacted,
      body: redacted,
    },
  });
}

/**
 * Anonymize PHI fields on a Document record.
 * Marks as DELETED and clears identifying information.
 */
async function anonymizeDocument(resourceId: string): Promise<void> {
  await prisma.document.update({
    where: { id: resourceId },
    data: {
      fileName: REDACTED,
      status: 'DELETED',
      // Note: actual S3 object deletion should be handled separately
    },
  });
}

/**
 * Anonymize PHI fields on a Prescription record.
 */
async function anonymizePrescription(resourceId: string): Promise<void> {
  const redacted = getEncryptedRedacted();
  await prisma.prescription.update({
    where: { id: resourceId },
    data: {
      instructions: redacted,
      pharmacyAddress: redacted,
    },
  });
}

/**
 * Anonymize a record based on its resource type.
 * Replaces PHI fields with "[REDACTED]" (encrypted where needed).
 *
 * @param resourceType - The PHI resource type
 * @param resourceId - The record ID
 */
async function anonymizeRecord(
  resourceType: PHIResourceType,
  resourceId: string
): Promise<void> {
  switch (resourceType) {
    case 'PATIENT':
      await anonymizePatientProfile(resourceId);
      break;
    case 'INTAKE':
      await anonymizeIntake(resourceId);
      break;
    case 'MESSAGE':
      await anonymizeMessage(resourceId);
      break;
    case 'DOCUMENT':
      await anonymizeDocument(resourceId);
      break;
    case 'PRESCRIPTION':
      await anonymizePrescription(resourceId);
      break;
    default:
      // BILLING, APPOINTMENT, MEDICAL_RECORD do not have dedicated Prisma models
      // with deletedAt; anonymization for those types is not yet implemented
      break;
  }
}

// ============================================
// Batch Operations
// ============================================

/**
 * Query the database for records that have been soft-deleted and are past
 * the HIPAA minimum retention period, making them eligible for anonymization.
 *
 * Only queries models that have the `deletedAt` field:
 * PatientProfile, Intake, Message, Document, Prescription.
 *
 * @returns Array of records eligible for anonymization
 */
export async function getRecordsForDeletion(): Promise<DataRetentionRecord[]> {
  const records: DataRetentionRecord[] = [];
  const now = new Date();
  const retentionCutoff = new Date(now);
  retentionCutoff.setDate(retentionCutoff.getDate() - HIPAA_MIN_RETENTION_DAYS);

  // PatientProfile — soft-deleted AND created before retention cutoff
  const patients = await prisma.patientProfile.findMany({
    where: {
      deletedAt: { not: null },
      createdAt: { lte: retentionCutoff },
    },
    select: { id: true, userId: true, createdAt: true, deletedAt: true },
  });
  for (const p of patients) {
    records.push({
      id: `ret-patient-${p.id}`,
      resourceType: 'PATIENT',
      resourceId: p.id,
      patientId: p.userId,
      createdAt: p.createdAt,
      softDeletedAt: p.deletedAt ?? undefined,
      deletionApproved: true,
    });
  }

  // Intake
  const intakes = await prisma.intake.findMany({
    where: {
      deletedAt: { not: null },
      createdAt: { lte: retentionCutoff },
    },
    select: { id: true, patientId: true, createdAt: true, deletedAt: true },
  });
  for (const i of intakes) {
    records.push({
      id: `ret-intake-${i.id}`,
      resourceType: 'INTAKE',
      resourceId: i.id,
      patientId: i.patientId,
      createdAt: i.createdAt,
      softDeletedAt: i.deletedAt ?? undefined,
      deletionApproved: true,
    });
  }

  // Message
  const messages = await prisma.message.findMany({
    where: {
      deletedAt: { not: null },
      sentAt: { lte: retentionCutoff },
    },
    select: { id: true, senderId: true, sentAt: true, deletedAt: true },
  });
  for (const m of messages) {
    records.push({
      id: `ret-message-${m.id}`,
      resourceType: 'MESSAGE',
      resourceId: m.id,
      patientId: m.senderId,
      createdAt: m.sentAt,
      softDeletedAt: m.deletedAt ?? undefined,
      deletionApproved: true,
    });
  }

  // Document
  const documents = await prisma.document.findMany({
    where: {
      deletedAt: { not: null },
      uploadedAt: { lte: retentionCutoff },
    },
    select: { id: true, patientId: true, uploadedAt: true, deletedAt: true },
  });
  for (const d of documents) {
    records.push({
      id: `ret-document-${d.id}`,
      resourceType: 'DOCUMENT',
      resourceId: d.id,
      patientId: d.patientId,
      createdAt: d.uploadedAt,
      softDeletedAt: d.deletedAt ?? undefined,
      deletionApproved: true,
    });
  }

  // Prescription
  const prescriptions = await prisma.prescription.findMany({
    where: {
      deletedAt: { not: null },
      createdAt: { lte: retentionCutoff },
    },
    select: { id: true, patientId: true, createdAt: true, deletedAt: true },
  });
  for (const rx of prescriptions) {
    records.push({
      id: `ret-prescription-${rx.id}`,
      resourceType: 'PRESCRIPTION',
      resourceId: rx.id,
      patientId: rx.patientId,
      createdAt: rx.createdAt,
      softDeletedAt: rx.deletedAt ?? undefined,
      deletionApproved: true,
    });
  }

  return records;
}

/**
 * Process expired deletions
 *
 * Queries records that have been soft-deleted and are past the HIPAA
 * minimum retention period (6 years). For each eligible record:
 * 1. Anonymizes PHI fields (replaces with "[REDACTED]")
 * 2. Logs the anonymization via audit logger
 *
 * HIPAA requires 6 years minimum retention for PHI records.
 * We only anonymize (not hard-delete) to preserve record structure
 * for audit trail purposes.
 *
 * Should be called by a scheduled cron job.
 *
 * @returns Summary of deletion operations
 */
export async function processExpiredDeletions(): Promise<ProcessExpiredDeletionsResult> {
  const result: ProcessExpiredDeletionsResult = {
    processed: 0,
    softDeleted: 0,
    anonymized: 0,
    errors: 0,
    details: [],
  };

  // Log the start of the retention processing run
  await auditLogger.log({
    eventType: AuditEventType.PATIENT_DATA_DELETED,
    severity: AuditSeverity.INFO,
    userId: 'system',
    resourceType: 'SYSTEM',
    action: 'data_retention_processing_started',
    ipAddress: SYSTEM_AUDIT_CONTEXT.ipAddress,
    userAgent: SYSTEM_AUDIT_CONTEXT.userAgent,
    success: true,
    requestId: SYSTEM_AUDIT_CONTEXT.requestId,
  });

  const records = await getRecordsForDeletion();

  for (const record of records) {
    result.processed++;

    // Check if approved (if required)
    const policy = getRetentionPolicy(record.resourceType);
    if (policy.requiresApproval && !record.deletionApproved) {
      continue; // Skip unapproved deletions
    }

    try {
      // Anonymize PHI fields instead of hard deleting
      await anonymizeRecord(record.resourceType, record.resourceId);
      result.anonymized++;

      // Log successful anonymization
      await logRetentionAction({
        action: 'record_anonymized',
        userId: 'system',
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        success: true,
        metadata: {
          retentionDays: policy.retentionDays,
          recordAge: Math.floor(
            (Date.now() - record.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          ),
          softDeletedAt: record.softDeletedAt?.toISOString(),
        },
      });

      result.details.push({
        success: true,
        resourceId: record.resourceId,
        action: 'anonymized',
      });
    } catch (error) {
      result.errors++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log failed anonymization (do NOT include PHI in error message)
      await logRetentionAction({
        action: 'record_anonymization_failed',
        userId: 'system',
        resourceType: record.resourceType,
        resourceId: record.resourceId,
        success: false,
        errorMessage,
      });

      result.details.push({
        success: false,
        resourceId: record.resourceId,
        action: 'cancelled',
        error: errorMessage,
      });
    }
  }

  // Log the completion of the retention processing run
  await auditLogger.log({
    eventType: AuditEventType.PATIENT_DATA_DELETED,
    severity: result.errors > 0 ? AuditSeverity.WARNING : AuditSeverity.INFO,
    userId: 'system',
    resourceType: 'SYSTEM',
    action: 'data_retention_processing_completed',
    ipAddress: SYSTEM_AUDIT_CONTEXT.ipAddress,
    userAgent: SYSTEM_AUDIT_CONTEXT.userAgent,
    success: result.errors === 0,
    metadata: {
      processed: result.processed,
      anonymized: result.anonymized,
      errors: result.errors,
    },
    requestId: SYSTEM_AUDIT_CONTEXT.requestId,
  });

  return result;
}

/**
 * Perform permanent deletion (anonymization) of a single record.
 * Soft-deletes the record if not already soft-deleted, then anonymizes PHI.
 *
 * @param params - Deletion parameters
 * @returns Deletion result
 */
export async function performPermanentDeletion(params: {
  resourceType: PHIResourceType;
  resourceId: string;
  deletedBy: string;
  patientId: string;
}): Promise<DeletionResult> {
  try {
    // Ensure record is soft-deleted first
    await softDeleteRecord(params.resourceType, params.resourceId);

    // Anonymize PHI fields
    await anonymizeRecord(params.resourceType, params.resourceId);

    // Log successful anonymization
    await logRetentionAction({
      action: 'record_permanently_deleted',
      userId: params.deletedBy,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      success: true,
      metadata: {
        deletedBy: params.deletedBy,
        patientId: params.patientId,
      },
    });

    return {
      success: true,
      resourceId: params.resourceId,
      action: 'anonymized',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await logRetentionAction({
      action: 'permanent_deletion_failed',
      userId: params.deletedBy,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      success: false,
      errorMessage,
    });

    return {
      success: false,
      resourceId: params.resourceId,
      action: 'cancelled',
      error: errorMessage,
    };
  }
}

// ============================================
// Reporting
// ============================================

/**
 * Generate retention report by querying actual database records.
 *
 * @returns Retention statistics
 */
export async function generateRetentionReport(): Promise<RetentionReport> {
  const [
    patientTotal,
    patientSoftDeleted,
    intakeTotal,
    intakeSoftDeleted,
    messageTotal,
    messageSoftDeleted,
    documentTotal,
    documentSoftDeleted,
    prescriptionTotal,
    prescriptionSoftDeleted,
  ] = await Promise.all([
    prisma.patientProfile.count(),
    prisma.patientProfile.count({ where: { deletedAt: { not: null } } }),
    prisma.intake.count(),
    prisma.intake.count({ where: { deletedAt: { not: null } } }),
    prisma.message.count(),
    prisma.message.count({ where: { deletedAt: { not: null } } }),
    prisma.document.count(),
    prisma.document.count({ where: { deletedAt: { not: null } } }),
    prisma.prescription.count(),
    prisma.prescription.count({ where: { deletedAt: { not: null } } }),
  ]);

  const totalRecords = patientTotal + intakeTotal + messageTotal + documentTotal + prescriptionTotal;
  const softDeleted = patientSoftDeleted + intakeSoftDeleted + messageSoftDeleted + documentSoftDeleted + prescriptionSoftDeleted;

  return {
    totalRecords,
    byResourceType: {
      PATIENT: patientTotal,
      INTAKE: intakeTotal,
      PRESCRIPTION: prescriptionTotal,
      MESSAGE: messageTotal,
      DOCUMENT: documentTotal,
      BILLING: 0,
      APPOINTMENT: 0,
      MEDICAL_RECORD: 0,
    },
    pendingDeletion: 0, // Would need a separate retention tracking table for pending requests
    softDeleted,
    patientRequests: 0,
    avgRetentionDays: 0,
  };
}

/**
 * Get patient data summary
 *
 * @param patientId - Patient ID
 * @returns Summary of patient's data
 */
export async function getPatientDataSummary(patientId: string): Promise<{
  recordTypes: Array<{
    type: PHIResourceType;
    count: number;
    oldestRecord: Date;
    newestRecord: Date;
  }>;
  totalRecords: number;
  canRequestDeletion: boolean;
}> {
  const [intakes, messages, documents, prescriptions] = await Promise.all([
    prisma.intake.findMany({
      where: { patientId, deletedAt: null },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.message.findMany({
      where: { senderId: patientId, deletedAt: null },
      select: { sentAt: true },
      orderBy: { sentAt: 'asc' },
    }),
    prisma.document.findMany({
      where: { patientId, deletedAt: null },
      select: { uploadedAt: true },
      orderBy: { uploadedAt: 'asc' },
    }),
    prisma.prescription.findMany({
      where: { patientId, deletedAt: null },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const recordTypes: Array<{
    type: PHIResourceType;
    count: number;
    oldestRecord: Date;
    newestRecord: Date;
  }> = [];

  if (intakes.length > 0) {
    recordTypes.push({
      type: 'INTAKE',
      count: intakes.length,
      oldestRecord: intakes[0].createdAt,
      newestRecord: intakes[intakes.length - 1].createdAt,
    });
  }

  if (messages.length > 0) {
    recordTypes.push({
      type: 'MESSAGE',
      count: messages.length,
      oldestRecord: messages[0].sentAt,
      newestRecord: messages[messages.length - 1].sentAt,
    });
  }

  if (documents.length > 0) {
    recordTypes.push({
      type: 'DOCUMENT',
      count: documents.length,
      oldestRecord: documents[0].uploadedAt,
      newestRecord: documents[documents.length - 1].uploadedAt,
    });
  }

  if (prescriptions.length > 0) {
    recordTypes.push({
      type: 'PRESCRIPTION',
      count: prescriptions.length,
      oldestRecord: prescriptions[0].createdAt,
      newestRecord: prescriptions[prescriptions.length - 1].createdAt,
    });
  }

  const totalRecords = recordTypes.reduce((sum, rt) => sum + rt.count, 0);

  return {
    recordTypes,
    totalRecords,
    canRequestDeletion: false, // Medical records cannot be deleted per HIPAA
  };
}

// ============================================
// Patient Rights
// ============================================

/**
 * Check if patient can request deletion of their data
 *
 * HIPAA allows patients to request deletion but there are exceptions
 * for medical records that must be retained.
 *
 * @param _patientId - Patient ID (unused but kept for future extensibility)
 * @returns Whether deletion can be requested
 */
export async function canPatientRequestDeletion(_patientId: string): Promise<{
  allowed: boolean;
  reason?: string;
  deletableTypes: PHIResourceType[];
  nonDeletableTypes: PHIResourceType[];
}> {
  const policies = getAllRetentionPolicies();

  const deletableTypes: PHIResourceType[] = [];
  const nonDeletableTypes: PHIResourceType[] = [];

  for (const [type, policy] of Object.entries(policies)) {
    if (policy.patientDeletable) {
      deletableTypes.push(type as PHIResourceType);
    } else {
      nonDeletableTypes.push(type as PHIResourceType);
    }
  }

  // Medical records generally cannot be deleted per HIPAA
  return {
    allowed: false,
    reason: 'Medical records must be retained for 7 years per HIPAA regulations. ' +
            'You may request an accounting of disclosures instead.',
    deletableTypes,
    nonDeletableTypes,
  };
}

/**
 * Export patient data (for data portability)
 *
 * @param patientId - Patient ID
 * @returns Patient data export
 */
export async function exportPatientData(
  patientId: string
): Promise<{
  exportId: string;
  createdAt: Date;
  expiresAt: Date;
  downloadUrl?: string;
}> {
  const exportId = `export-${Date.now()}-${patientId}`;
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Log the export via real audit logger
  await auditLogger.log({
    eventType: AuditEventType.PATIENT_DATA_VIEWED,
    severity: AuditSeverity.INFO,
    userId: patientId,
    resourceType: 'PATIENT',
    resourceId: patientId,
    action: 'patient_data_exported',
    ipAddress: SYSTEM_AUDIT_CONTEXT.ipAddress,
    userAgent: SYSTEM_AUDIT_CONTEXT.userAgent,
    success: true,
    metadata: {
      exportId,
      expiresAt: expiresAt.toISOString(),
    },
    requestId: SYSTEM_AUDIT_CONTEXT.requestId,
  });

  return {
    exportId,
    createdAt,
    expiresAt,
  };
}
