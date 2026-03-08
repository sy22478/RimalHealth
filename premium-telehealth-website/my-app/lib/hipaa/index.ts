/**
 * HIPAA Compliance Module
 * 
 * HIPAA-compliant utilities for PHI encryption, audit logging, and data retention.
 * Ensures all medical data handling meets regulatory requirements.
 * 
 * @module lib/hipaa
 */

// PHI Encryption
export {
  encryptPHI,
  decryptPHI,
  encryptPHIToString,
  decryptPHIFromString,
  encryptFields,
  decryptFields,
  encryptMany,
  decryptMany,
  deriveKeyFromPassword,
  hashIdentifier,
  generateDataEncryptionKey,
  decryptDataEncryptionKey,
  reencryptWithNewKey,
  isEncrypted,
  secureCompare,
  type EncryptedData,
  type EncryptionOptions,
  type FieldEncryptionOptions,
  type KeyDerivationOptions,
} from './encryption';

// Audit Logging
export {
  logAuditEvent,
  logPhiRead,
  logPhiCreate,
  logPhiUpdate,
  logPhiDelete,
  logAuthEvent,
  logExportEvent,
  queryAuditLogs,
  countAuditLogs,
  getUserActivity,
  getResourceAccessHistory,
  getFailedLoginAttempts,
  withAuditLogging,
  generatePatientAccessReport,
  initAuditStorage,
  setAuditLoggingEnabled,
  isAuditLoggingEnabled,
  createAuditEvent,
  extractRequestInfo,
  type AuditEvent,
  type AuditEventDetails,
  type AuditQuery,
  type AuditLogStorage,
} from './audit-logger';

// PHI Identifiers
export {
  getPHIField,
  isPHIField,
  shouldEncryptField,
  isSearchableField,
  getFieldSensitivity,
  getAllPHIFields,
  getFieldsByCategory,
  getFieldsBySensitivity,
  getEncryptedFields,
  getSearchableFields,
  classifyPHI,
  validatePHIField,
  validatePHIFields,
  maskPHIValue,
  maskPHIFields,
  isHIPAAIdentifier,
  PHI_FIELD_DEFINITIONS,
  HIPAA_18_IDENTIFIERS,
  type PHICategory,
  type SensitivityLevel,
  type PHIFieldDefinition,
  type PHIClassification,
} from './phi-identifiers';

// Data Retention
export {
  setRetentionPolicy,
  getRetentionPolicy,
  getAllRetentionPolicies,
  calculateDeletionDate,
  calculateGracePeriodEnd,
  isEligibleForDeletion,
  getDaysUntilDeletion,
  requestDeletion,
  approveDeletion,
  cancelDeletion,
  performPermanentDeletion,
  getRecordsForDeletion,
  processExpiredDeletions,
  generateRetentionReport,
  getPatientDataSummary,
  canPatientRequestDeletion,
  exportPatientData,
  DEFAULT_RETENTION_POLICIES,
  type RetentionPolicy,
  type DataRetentionRecord,
  type DeletionResult,
  type RetentionReport,
} from './data-retention';
