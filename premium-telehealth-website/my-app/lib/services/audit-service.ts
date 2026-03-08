/**
 * Audit Service
 * High-level service for HIPAA-compliant audit logging
 * 
 * HIPAA Compliance:
 * - All PHI access is logged with full context
 * - Logs are immutable and cannot be deleted
 * - 6-year retention policy
 * - Failed access attempts are logged
 * 
 * @module lib/services/audit-service
 */

import { NextRequest } from 'next/server';
import {
  auditLogger,
  AuditContext,
  AuditEventType,
  AuditSeverity,
  PHIResourceType,
  DataModificationAction,
} from '@/lib/audit';

// ============================================================================
// Types
// ============================================================================

export interface AuditServiceContext {
  userId: string;
  userRole: string;
  ipAddress: string;
  userAgent: string;
  requestId: string;
}

// ============================================================================
// Context Creation
// ============================================================================

/**
 * Create audit context from Next.js request
 * 
 * @param request - Next.js request object
 * @param userId - User ID from authentication
 * @param userRole - User role from authentication
 * @returns AuditContext for logging
 */
export function createAuditContext(
  request: NextRequest,
  userId?: string,
  userRole?: string
): AuditContext {
  const forwarded = request.headers.get('x-forwarded-for');
  const ipAddress = forwarded?.split(',')[0]?.trim() ?? 'unknown';
  const userAgent = request.headers.get('user-agent') ?? 'unknown';

  return {
    userId,
    userRole,
    ipAddress,
    userAgent,
    requestId: crypto.randomUUID(),
  };
}

/**
 * Create audit context from request headers
 * Used when request object is not available
 * 
 * @param headers - Request headers
 * @param userId - User ID
 * @param userRole - User role
 * @returns AuditContext for logging
 */
export function createAuditContextFromHeaders(
  headers: Headers,
  userId?: string,
  userRole?: string
): AuditContext {
  const forwarded = headers.get('x-forwarded-for');
  const ipAddress = forwarded?.split(',')[0]?.trim() ?? 'unknown';
  const userAgent = headers.get('user-agent') ?? 'unknown';

  return {
    userId,
    userRole,
    ipAddress,
    userAgent,
    requestId: crypto.randomUUID(),
  };
}

// ============================================================================
// PHI Access Logging
// ============================================================================

/**
 * Log PHI access event
 * 
 * @param action - Type of access (VIEW, CREATE, UPDATE, DELETE)
 * @param userId - User accessing the PHI
 * @param userRole - Role of the accessing user
 * @param resourceType - Type of PHI resource
 * @param resourceId - ID of the resource
 * @param context - Audit context
 * @param metadata - Additional metadata
 */
export async function logPHIAccess(
  action: 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE',
  userId: string,
  userRole: string,
  resourceType: PHIResourceType,
  resourceId: string,
  context: AuditContext,
  metadata?: Record<string, unknown>
): Promise<void> {
  await auditLogger.logPHIAccess(
    action,
    userId,
    userRole,
    resourceType,
    resourceId,
    context,
    metadata
  );
}

/**
 * Log patient profile access
 * 
 * @param userId - User accessing the profile
 * @param userRole - User role
 * @param patientId - Patient profile ID
 * @param action - Access action
 * @param context - Audit context
 */
export async function logPatientProfileAccess(
  userId: string,
  userRole: string,
  patientId: string,
  action: 'VIEW' | 'UPDATE',
  context: AuditContext
): Promise<void> {
  await auditLogger.logPHIAccess(
    action,
    userId,
    userRole,
    PHIResourceType.PATIENT_PROFILE,
    patientId,
    context,
    { accessReason: `${action} patient profile` }
  );
}

/**
 * Log intake access
 * 
 * @param userId - User accessing the intake
 * @param userRole - User role
 * @param intakeId - Intake ID
 * @param action - Access action
 * @param context - Audit context
 */
export async function logIntakeAccess(
  userId: string,
  userRole: string,
  intakeId: string,
  action: 'VIEW' | 'CREATE' | 'UPDATE',
  context: AuditContext
): Promise<void> {
  await auditLogger.logPHIAccess(
    action,
    userId,
    userRole,
    PHIResourceType.INTAKE,
    intakeId,
    context,
    { accessReason: `${action} intake form` }
  );
}

/**
 * Log prescription access
 * 
 * @param userId - User accessing the prescription
 * @param userRole - User role
 * @param prescriptionId - Prescription ID
 * @param action - Access action
 * @param context - Audit context
 */
export async function logPrescriptionAccess(
  userId: string,
  userRole: string,
  prescriptionId: string,
  action: 'VIEW' | 'CREATE' | 'UPDATE',
  context: AuditContext
): Promise<void> {
  await auditLogger.logPHIAccess(
    action,
    userId,
    userRole,
    PHIResourceType.PRESCRIPTION,
    prescriptionId,
    context,
    { accessReason: `${action} prescription` }
  );
}

/**
 * Log message access
 * 
 * @param userId - User accessing messages
 * @param userRole - User role
 * @param threadId - Message thread ID
 * @param action - Access action
 * @param context - Audit context
 */
export async function logMessageAccess(
  userId: string,
  userRole: string,
  threadId: string,
  action: 'VIEW' | 'CREATE',
  context: AuditContext
): Promise<void> {
  await auditLogger.logPHIAccess(
    action,
    userId,
    userRole,
    PHIResourceType.MESSAGE,
    threadId,
    context,
    { accessReason: `${action} message` }
  );
}

/**
 * Log document access
 * 
 * @param userId - User accessing the document
 * @param userRole - User role
 * @param documentId - Document ID
 * @param action - Access action
 * @param context - Audit context
 * @param metadata - Additional metadata
 */
export async function logDocumentAccess(
  userId: string,
  userRole: string,
  documentId: string,
  action: 'VIEW' | 'CREATE' | 'DELETE',
  context: AuditContext,
  metadata?: Record<string, unknown>
): Promise<void> {
  await auditLogger.logPHIAccess(
    action,
    userId,
    userRole,
    PHIResourceType.DOCUMENT,
    documentId,
    context,
    metadata
  );
}

// ============================================================================
// Data Modification Logging
// ============================================================================

/**
 * Log data modification event
 * 
 * @param action - Modification action (CREATE, UPDATE, DELETE)
 * @param userId - User making the modification
 * @param resourceType - Type of resource
 * @param resourceId - Resource ID
 * @param context - Audit context
 * @param fieldsChanged - Array of changed field names
 * @param reason - Reason for modification
 */
export async function logDataModification(
  action: DataModificationAction,
  userId: string,
  resourceType: string,
  resourceId: string,
  context: AuditContext,
  fieldsChanged?: string[],
  reason?: string
): Promise<void> {
  await auditLogger.logDataModification(
    action,
    userId,
    resourceType,
    resourceId,
    context,
    {
      action,
      fieldsChanged,
      reason,
    }
  );
}

// ============================================================================
// Authentication Logging
// ============================================================================

/**
 * Log login attempt
 * 
 * @param userId - User ID (undefined for failed attempts)
 * @param success - Whether login was successful
 * @param context - Audit context
 * @param failureReason - Reason for failure (if applicable)
 */
export async function logLogin(
  userId: string | undefined,
  success: boolean,
  context: AuditContext,
  failureReason?: string
): Promise<void> {
  await auditLogger.logAuth(
    success ? AuditEventType.USER_LOGIN : AuditEventType.USER_LOGIN_FAILED,
    userId,
    success,
    context,
    failureReason ? { failureReason } : undefined
  );
}

/**
 * Log logout
 * 
 * @param userId - User ID
 * @param context - Audit context
 */
export async function logLogout(userId: string, context: AuditContext): Promise<void> {
  await auditLogger.logAuth(AuditEventType.USER_LOGOUT, userId, true, context);
}

/**
 * Log password change
 * 
 * @param userId - User ID
 * @param success - Whether change was successful
 * @param context - Audit context
 */
export async function logPasswordChange(
  userId: string,
  success: boolean,
  context: AuditContext
): Promise<void> {
  await auditLogger.logAuth(
    AuditEventType.PASSWORD_CHANGED,
    userId,
    success,
    context
  );
}

// ============================================================================
// Security Logging
// ============================================================================

/**
 * Log unauthorized access attempt
 * 
 * @param userId - User ID (if authenticated)
 * @param attemptedResource - Resource that was accessed
 * @param context - Audit context
 * @param reason - Reason for denial
 */
export async function logUnauthorizedAccess(
  userId: string | undefined,
  attemptedResource: string,
  context: AuditContext,
  reason: string
): Promise<void> {
  await auditLogger.log({
    eventType: AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
    userId,
    userRole: context.userRole,
    action: 'Unauthorized access attempt',
    resourceType: 'SYSTEM',
    resourceId: attemptedResource,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    success: false,
    severity: AuditSeverity.WARNING,
    metadata: { reason },
    timestamp: new Date(),
  });
}

/**
 * Log API error
 * 
 * @param error - Error that occurred
 * @param endpoint - API endpoint
 * @param context - Audit context
 * @param userId - User ID (if available)
 */
export async function logApiError(
  error: Error,
  endpoint: string,
  context: AuditContext,
  userId?: string
): Promise<void> {
  await auditLogger.log({
    eventType: AuditEventType.API_ERROR,
    userId,
    userRole: context.userRole,
    action: 'API Error',
    resourceType: 'API',
    resourceId: endpoint,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    success: false,
    severity: AuditSeverity.ERROR,
    metadata: {
      errorMessage: error.message,
      errorStack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    },
    timestamp: new Date(),
  });
}

// ============================================================================
// Service Export
// ============================================================================

/**
 * Audit Service class
 * Provides a consistent interface for all audit logging
 */
export class AuditService {
  static createAuditContext(
    request: NextRequest,
    userId?: string,
    userRole?: string
  ): AuditContext {
    return createAuditContext(request, userId, userRole);
  }

  static createAuditContextFromHeaders(
    headers: Headers,
    userId?: string,
    userRole?: string
  ): AuditContext {
    return createAuditContextFromHeaders(headers, userId, userRole);
  }

  static async logPHIAccess(
    action: 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE',
    userId: string,
    userRole: string,
    resourceType: PHIResourceType,
    resourceId: string,
    context: AuditContext,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    return logPHIAccess(action, userId, userRole, resourceType, resourceId, context, metadata);
  }

  static async logPatientProfileAccess(
    userId: string,
    userRole: string,
    patientId: string,
    action: 'VIEW' | 'UPDATE',
    context: AuditContext
  ): Promise<void> {
    return logPatientProfileAccess(userId, userRole, patientId, action, context);
  }

  static async logIntakeAccess(
    userId: string,
    userRole: string,
    intakeId: string,
    action: 'VIEW' | 'CREATE' | 'UPDATE',
    context: AuditContext
  ): Promise<void> {
    return logIntakeAccess(userId, userRole, intakeId, action, context);
  }

  static async logPrescriptionAccess(
    userId: string,
    userRole: string,
    prescriptionId: string,
    action: 'VIEW' | 'CREATE' | 'UPDATE',
    context: AuditContext
  ): Promise<void> {
    return logPrescriptionAccess(userId, userRole, prescriptionId, action, context);
  }

  static async logMessageAccess(
    userId: string,
    userRole: string,
    threadId: string,
    action: 'VIEW' | 'CREATE',
    context: AuditContext
  ): Promise<void> {
    return logMessageAccess(userId, userRole, threadId, action, context);
  }

  static async logDocumentAccess(
    userId: string,
    userRole: string,
    documentId: string,
    action: 'VIEW' | 'CREATE' | 'DELETE',
    context: AuditContext,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    return logDocumentAccess(userId, userRole, documentId, action, context, metadata);
  }

  static async logDataModification(
    action: DataModificationAction,
    userId: string,
    resourceType: string,
    resourceId: string,
    context: AuditContext,
    fieldsChanged?: string[],
    reason?: string
  ): Promise<void> {
    return logDataModification(action, userId, resourceType, resourceId, context, fieldsChanged, reason);
  }

  static async logLogin(
    userId: string | undefined,
    success: boolean,
    context: AuditContext,
    failureReason?: string
  ): Promise<void> {
    return logLogin(userId, success, context, failureReason);
  }

  static async logLogout(userId: string, context: AuditContext): Promise<void> {
    return logLogout(userId, context);
  }

  static async logPasswordChange(
    userId: string,
    success: boolean,
    context: AuditContext
  ): Promise<void> {
    return logPasswordChange(userId, success, context);
  }

  static async logUnauthorizedAccess(
    userId: string | undefined,
    attemptedResource: string,
    context: AuditContext,
    reason: string
  ): Promise<void> {
    return logUnauthorizedAccess(userId, attemptedResource, context, reason);
  }

  static async logApiError(
    error: Error,
    endpoint: string,
    context: AuditContext,
    userId?: string
  ): Promise<void> {
    return logApiError(error, endpoint, context, userId);
  }
}

export default AuditService;
