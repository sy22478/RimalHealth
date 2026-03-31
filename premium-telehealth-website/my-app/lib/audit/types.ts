/**
 * Audit Logging Types
 * Defines audit event types and structures for HIPAA compliance
 * 
 * HIPAA Requirements:
 * - All PHI access must be logged
 * - Logs must include: who, what, when, where (IP)
 * - Logs cannot be modified or deleted
 * - Retain logs for 6 years minimum
 * 
 * @module lib/audit/types
 */

/**
 * Types of audit events
 * Comprehensive coverage of authentication, PHI access, and system events
 */
export enum AuditEventType {
  // Authentication events
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  USER_LOGIN_FAILED = 'user_login_failed',
  PASSWORD_CHANGED = 'password_changed',
  PASSWORD_CHANGE_FAILED = 'password_change_failed',
  PASSWORD_RESET_REQUESTED = 'password_reset_requested',
  PASSWORD_RESET_COMPLETED = 'password_reset_completed',
  EMAIL_VERIFIED = 'email_verified',

  // PHI access events - All PHI viewing operations
  PATIENT_DATA_VIEWED = 'patient_data_viewed',
  PATIENT_DATA_CREATED = 'patient_data_created',
  PATIENT_DATA_UPDATED = 'patient_data_updated',
  PATIENT_DATA_DELETED = 'patient_data_deleted',
  INTAKE_VIEWED = 'intake_viewed',
  INTAKE_REVIEWED = 'intake_reviewed',
  PRESCRIPTION_VIEWED = 'prescription_viewed',
  REFILL_REQUESTED = 'refill_requested',
  REFILL_APPROVED = 'refill_approved',
  REFILL_DENIED = 'refill_denied',
  PRESCRIPTION_STATUS_UPDATED = 'prescription_status_updated',
  MESSAGE_VIEWED = 'message_viewed',

  // System events - User management
  USER_REGISTERED = 'user_registered',
  USER_ROLE_CHANGED = 'user_role_changed',
  USER_DEACTIVATED = 'user_deactivated',

  // Admin events
  AUDIT_LOG_EXPORTED = 'audit_log_exported',
  SYSTEM_SETTING_CHANGED = 'system_setting_changed',

  // API and security events
  API_ERROR = 'API_ERROR',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',

  // User profile events
  PREFERENCES_UPDATED = 'PREFERENCES_UPDATED',
  PROFILE_UPDATED = 'PROFILE_UPDATED',

  // Consent events
  CONSENT_RECORDED = 'CONSENT_RECORDED',

  // MFA events
  MFA_SETUP = 'mfa_setup',
  MFA_VERIFIED = 'mfa_verified',
  MFA_DISABLED = 'mfa_disabled',
  MFA_FAILED = 'mfa_failed',

  // Account deletion events
  ACCOUNT_DELETION_REQUESTED = 'account_deletion_requested',
  ACCOUNT_DELETION_CANCELLED = 'account_deletion_cancelled',

  // 42 CFR Part 2 — Disclosure events
  PHI_DISCLOSURE = 'phi_disclosure',
  CONSENT_REVOKED = 'consent_revoked',
  DISCLOSURE_RESTRICTION_REQUESTED = 'disclosure_restriction_requested',
  DISCLOSURE_RESTRICTION_REVIEWED = 'disclosure_restriction_reviewed',
}

/**
 * Audit log severity levels
 * Used for filtering and prioritizing audit events
 */
export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

/**
 * Audit log entry structure
 * Matches Prisma AuditLog model for database storage
 */
export interface AuditLogEntry {
  id?: string;
  eventType: AuditEventType;
  severity?: AuditSeverity;
  userId?: string;
  targetUserId?: string; // For actions on other users' data
  userRole?: string; // Role of the actor
  resourceType?: string; // e.g., 'PatientProfile', 'Intake'
  resourceId?: string;
  action?: string;
  metadata?: Record<string, unknown>;
  ipAddress: string;
  userAgent?: string;
  success?: boolean;
  errorMessage?: string;
  timestamp?: Date;
  /** Optional request ID for end-to-end tracing (set by middleware) */
  requestId?: string;
}

/**
 * Audit context passed through request
 * Contains request-specific information for audit logging
 */
export interface AuditContext {
  userId?: string;
  userRole?: string;
  ipAddress: string;
  userAgent: string;
  requestId: string;
}

/**
 * Query options for retrieving audit logs
 * Used by admin dashboard and compliance reports
 */
export interface AuditLogQueryOptions {
  userId?: string;
  targetUserId?: string;
  eventType?: AuditEventType;
  resourceType?: string;
  resourceId?: string;
  severity?: AuditSeverity;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  orderBy?: 'asc' | 'desc';
}

/**
 * Paginated audit log results
 */
export interface AuditLogQueryResult {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Resource types that contain PHI
 * Used for identifying PHI access events
 */
export enum PHIResourceType {
  PATIENT_PROFILE = 'PatientProfile',
  INTAKE = 'Intake',
  REVIEW = 'Review',
  PRESCRIPTION = 'Prescription',
  MESSAGE = 'Message',
  DOCUMENT = 'Document',
  MEDICAL_HISTORY = 'MedicalHistory',
  PHYSICIAN_NOTE = 'PHYSICIAN_NOTE',
}

/**
 * Data modification actions
 * Used for tracking create/update/delete operations
 */
export enum DataModificationAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

// String literal types for convenience
export type DataModificationActionString = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * Metadata for data modification events
 * Tracks field-level changes for compliance
 */
export interface DataModificationMetadata {
  action: DataModificationAction;
  fieldsChanged?: string[];
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  reason?: string;
}

/**
 * Metadata for PHI access events
 */
export interface PHIAccessMetadata {
  accessReason?: string;
  consentVerified?: boolean;
  emergencyAccess?: boolean;
  breakGlass?: boolean;
  authorizedBy?: string;
  // Document-specific metadata
  documentType?: string;
  fileName?: string;
  fileSize?: number;
  // List operation metadata
  recordCount?: number;
}

/**
 * Metadata for authentication events
 */
export interface AuthenticationMetadata {
  authMethod?: 'password' | 'mfa' | 'sso' | 'token';
  mfaVerified?: boolean;
  failureReason?: string;
  attemptCount?: number;
  /** Additional metadata for authentication events */
  metadata?: {
    attemptsRemaining?: number;
    ipAddress?: string;
    userAgent?: string;
    [key: string]: unknown;
  };
}

/**
 * Options for audit middleware configuration
 */
export interface AuditMiddlewareOptions {
  /**
   * Log all requests, not just PHI access
   * @default false
   */
  logAllRequests?: boolean;
  
  /**
   * Paths to exclude from audit logging
   * @default []
   */
  excludePaths?: string[];
  
  /**
   * Paths that contain PHI and should always be logged
   * @default ['/api/patients', '/api/intake', '/api/prescriptions', '/api/messages']
   */
  phiPaths?: string[];
  
  /**
   * Function to extract user info from request
   */
  getUserFromRequest?: (request: Request) => Promise<{ id: string; role: string } | undefined>;
}

/**
 * PHI resource types as a constant array
 * Useful for validation and iteration
 */
export const PHI_RESOURCES = [
  'PatientProfile',
  'Intake',
  'Review',
  'Prescription',
  'Message',
  'Document',
  'MedicalHistory',
] as const;

/**
 * Type for PHI resource type values
 */
export type PHIResourceTypeValue = typeof PHI_RESOURCES[number];

/**
 * Audit log export format options
 */
export enum AuditExportFormat {
  JSON = 'json',
  CSV = 'csv',
  PDF = 'pdf',
}

/**
 * Options for exporting audit logs
 */
export interface AuditExportOptions {
  startDate: Date;
  endDate: Date;
  eventTypes?: AuditEventType[];
  userIds?: string[];
  format?: AuditExportFormat;
  includeMetadata?: boolean;
}

/**
 * Audit alert configuration
 * For real-time alerts on critical events
 */
export interface AuditAlertConfig {
  enabled: boolean;
  severityThreshold?: AuditSeverity;
  eventTypes?: AuditEventType[];
  webhookUrl?: string;
  emailRecipients?: string[];
  slackWebhook?: string;
}

/**
 * Audit retention policy
 * HIPAA requires 6 years minimum retention
 */
export interface AuditRetentionPolicy {
  minRetentionDays: number; // 6 years = 2190 days
  archiveAfterDays?: number;
  deleteAfterDays?: number; // Should be > 2190 for HIPAA
}

/**
 * Default HIPAA-compliant retention policy
 * 6 years = 2190 days
 */
export const DEFAULT_RETENTION_POLICY: AuditRetentionPolicy = {
  minRetentionDays: 2190, // 6 years
  archiveAfterDays: 365,  // Archive after 1 year
  deleteAfterDays: 2555,  // Delete after 7 years
};
