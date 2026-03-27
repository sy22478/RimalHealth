/**
 * Audit Logging Module
 * HIPAA-compliant audit logging for the telehealth platform
 * 
 * @module lib/audit
 * 
 * This module provides comprehensive audit logging capabilities to meet
 * HIPAA compliance requirements for the telehealth platform.
 * 
 * HIPAA Requirements Met:
 * - All PHI access is logged with full context (who, what, when, where)
 * - Audit logs are immutable (append-only)
 * - 6-year retention policy
 * - Failed access attempts are logged
 * - Emergency/break-glass access is flagged as critical
 * 
 * Usage:
 * ```typescript
 * import { auditLogger, AuditEventType, withAuditLogging } from '@/lib/audit';
 * 
 * // Manual logging
 * await auditLogger.log({
 *   eventType: AuditEventType.USER_LOGIN,
 *   userId: user.id,
 *   action: 'User logged in',
 *   ipAddress: getClientIP(request),
 *   success: true,
 * });
 * 
 * // With middleware
 * export const GET = withAuditLogging(
 *   async (request, { params }) => {
 *     const data = await fetchData(params.id);
 *     return Response.json(data);
 *   },
 *   {
 *     resourceType: PHIResourceType.PATIENT_PROFILE,
 *     action: 'VIEW',
 *     getResourceId: (_, params) => params.id,
 *   }
 * );
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export {
  AuditEventType,
  AuditSeverity,
  PHIResourceType,
  DataModificationAction,
  AuditExportFormat,
  PHI_RESOURCES,
  DEFAULT_RETENTION_POLICY,
} from './types';

export type {
  AuditLogEntry,
  AuditContext,
  AuditLogQueryOptions,
  AuditLogQueryResult,
  DataModificationMetadata,
  PHIAccessMetadata,
  AuthenticationMetadata,
  AuditMiddlewareOptions,
  PHIResourceTypeValue,
  AuditExportOptions,
  AuditAlertConfig,
  AuditRetentionPolicy,
} from './types';

// ============================================================================
// Logger - Class and standalone functions
// ============================================================================

export {
  // Main class
  AuditLogger,
  auditLogger,
  
  // Standalone convenience functions
  auditLog,
  auditLogin,
  auditLogout,
  auditPHIAccess,
  auditDataModification,
  auditPasswordEvent,
  auditUserRegistration,
  auditAdminAction,
  queryAuditLogs,
  exportAuditLogs,
  getUserAuditActivity,
} from './logger';

// ============================================================================
// Middleware
// ============================================================================

export {
  // Context extraction
  createAuditContext,
  createAuditContextFromHeaders,
  extractAuditContext,
  
  // API route middleware
  auditMiddleware,
  auditMiddlewareWithRole,
  withAuditLogging,
  withAuditLoggingForModification,
  withAuthAuditLogging,
  withPHIAudit,
  
  // Next.js middleware integration
  createAuditMiddleware,
  
  // User extraction helpers
  getUserIdFromRequest,
  
  // Server actions
  auditServerAction,
  
  // Special access
  auditBreakGlassAccess,
  auditBatchPHIAccess,
} from './middleware';

// ============================================================================
// Utilities
// ============================================================================

export {
  // Metadata sanitization
  sanitizeMetadata,
  truncateMetadata,
  
  // IP extraction
  getClientIP,
  
  // Security utilities
  hashIdentifier,
  createIntegrityHash,
  
  // Severity helpers
  getEventSeverity,
  
  // Validation
  validateAuditEntry,
  
  // Formatting
  formatAuditEntry,
} from './utils';
