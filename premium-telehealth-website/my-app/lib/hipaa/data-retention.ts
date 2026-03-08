/**
 * Data Retention Policy Module
 * 
 * Implements HIPAA-compliant data retention and deletion policies.
 * Manages automated data lifecycle including soft delete, retention, and purging.
 * 
 * HIPAA Compliance:
 * - 7-year retention for medical records
 * - Secure deletion procedures
 * - Audit trail for deletions
 * - Patient right to deletion (with medical exceptions)
 * 
 * @module lib/hipaa/data-retention
 */

import { DATA_RETENTION, type PHIResourceType } from '@/lib/constants';
import { logPhiDelete, logAuditEvent, createAuditEvent } from './audit-logger';

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
  action: 'soft-delete' | 'permanent-delete' | 'cancelled';
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

// ============================================
// Default Retention Policies
// ============================================

/**
 * Default retention policies by resource type
 * 
 * HIPAA requires medical records be retained for 7 years.
 * Different record types may have different requirements.
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
  
  // Log the deletion request
  await logAuditEvent(createAuditEvent({
    userId: params.requestedBy,
    action: 'DELETE',
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    success: true,
    details: {
      metadata: {
        softDelete: true,
        patientRequested: params.patientRequested,
        reason: params.reason,
        scheduledDeletion: record.scheduledDeletionAt,
      },
    },
  }));
  
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
  // In a real implementation, this would update the database
  // For now, just log the approval
  
  await logAuditEvent(createAuditEvent({
    userId: approvedBy,
    action: 'UPDATE',
    resourceType: 'PATIENT', // Using PATIENT as generic for admin actions
    resourceId: retentionId,
    success: true,
    details: {
      metadata: { action: 'deletion_approved' },
    },
  }));
  
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
  await logAuditEvent(createAuditEvent({
    userId: cancelledBy,
    action: 'UPDATE',
    resourceType: 'PATIENT',
    resourceId: retentionId,
    success: true,
    details: {
      metadata: { action: 'deletion_cancelled' },
    },
  }));
  
  return true;
}

/**
 * Perform permanent deletion
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
    // In a real implementation:
    // 1. Archive if required by policy
    // 2. Delete from primary database
    // 3. Delete from backups (or schedule for deletion)
    // 4. Clear from search indexes
    // 5. Log the deletion
    
    await logPhiDelete({
      userId: params.deletedBy,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      success: true,
    });
    
    return {
      success: true,
      resourceId: params.resourceId,
      action: 'permanent-delete',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await logPhiDelete({
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
// Batch Operations
// ============================================

/**
 * Get records ready for deletion
 * 
 * @returns Array of records eligible for deletion
 */
export async function getRecordsForDeletion(): Promise<DataRetentionRecord[]> {
  // In a real implementation, this would query the database
  // for records where scheduledDeletionAt <= now
  return [];
}

/**
 * Process expired deletions
 * 
 * Automatically deletes records that have passed their retention period.
 * Should be called by a scheduled job.
 * 
 * @returns Results of deletion operations
 */
export async function processExpiredDeletions(): Promise<DeletionResult[]> {
  const records = await getRecordsForDeletion();
  const results: DeletionResult[] = [];
  
  for (const record of records) {
    // Check if approved (if required)
    const policy = getRetentionPolicy(record.resourceType);
    if (policy.requiresApproval && !record.deletionApproved) {
      continue; // Skip unapproved deletions
    }
    
    const result = await performPermanentDeletion({
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      deletedBy: 'system',
      patientId: record.patientId,
    });
    
    results.push(result);
  }
  
  return results;
}

// ============================================
// Reporting
// ============================================

/**
 * Generate retention report
 * 
 * @returns Retention statistics
 */
export async function generateRetentionReport(): Promise<RetentionReport> {
  // In a real implementation, this would aggregate from database
  return {
    totalRecords: 0,
    byResourceType: {
      PATIENT: 0,
      INTAKE: 0,
      PRESCRIPTION: 0,
      MESSAGE: 0,
      DOCUMENT: 0,
      BILLING: 0,
      APPOINTMENT: 0,
      MEDICAL_RECORD: 0,
    },
    pendingDeletion: 0,
    softDeleted: 0,
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
  // In a real implementation, this would query the database
  return {
    recordTypes: [],
    totalRecords: 0,
    canRequestDeletion: false,
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
 * @param patientId - Patient ID
 * @returns Whether deletion can be requested
 */
export async function canPatientRequestDeletion(patientId: string): Promise<{
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
  
  // Log the export
  await logAuditEvent(createAuditEvent({
    userId: patientId,
    action: 'EXPORT',
    resourceType: 'PATIENT',
    resourceId: patientId,
    success: true,
    details: {
      metadata: { exportId, expiresAt },
    },
  }));
  
  return {
    exportId,
    createdAt,
    expiresAt,
  };
}
