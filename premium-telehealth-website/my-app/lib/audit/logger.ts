/**
 * Audit Logger
 * Creates immutable audit logs for HIPAA compliance
 * 
 * Design Principles:
 * - Never throw errors from audit logging (don't disrupt user flow)
 * - All PHI access must be logged with full context
 * - Logs are append-only and cannot be modified
 * - Fallback to console logging if database fails
 * - Include all required HIPAA fields: who, what, when, where
 * 
 * @module lib/audit/logger
 */

import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import {
  AuditEventType,
  AuditSeverity,
  AuditLogEntry,
  AuditContext,
  AuditLogQueryOptions,
  AuditLogQueryResult,
  DataModificationAction,
  DataModificationMetadata,
  PHIAccessMetadata,
  AuthenticationMetadata,
  PHIResourceType,
} from './types';
import { sanitizeMetadata, getEventSeverity, truncateMetadata } from './utils';

/**
 * AuditLogger class
 * Main interface for creating HIPAA-compliant audit logs
 * 
 * Usage:
 * ```typescript
 * import { auditLogger } from '@/lib/audit';
 * 
 * await auditLogger.log({
 *   eventType: AuditEventType.USER_LOGIN,
 *   action: 'User logged in',
 *   ipAddress: getClientIP(request),
 *   userAgent: request.headers.get('user-agent') || '',
 *   success: true,
 * });
 * ```
 */
export class AuditLogger {
  /**
   * Core logging method
   * Creates an immutable audit log entry in the database
   * 
   * HIPAA Requirements Met:
   * - User identification (who)
   * - Action details (what)
   * - Timestamp (when) - automatic
   * - IP address and user agent (where)
   * - Resource identification
   * - Success/failure status
   * 
   * @param entry - Audit log entry data
   * @returns Promise that resolves when log is written (never throws)
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Sanitize and truncate metadata to prevent PHI leakage and bloat
      const rawMetadata = entry.metadata ?? {};

      // Attach requestId to metadata when provided for end-to-end tracing
      const metadataWithRequestId = entry.requestId
        ? { ...rawMetadata, requestId: entry.requestId }
        : rawMetadata;

      const hasMetadata = Object.keys(metadataWithRequestId).length > 0;
      const sanitizedMetadata = hasMetadata
        ? truncateMetadata(sanitizeMetadata(metadataWithRequestId))
        : undefined;

      await prisma.auditLog.create({
        data: {
          eventType: entry.eventType,
          severity: entry.severity || getEventSeverity(entry.eventType),
          userId: entry.userId,
          targetUserId: entry.targetUserId,
          userRole: entry.userRole,
          resourceType: entry.resourceType || 'SYSTEM',
          resourceId: entry.resourceId,
          metadata: sanitizedMetadata as Prisma.InputJsonValue | undefined,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          success: entry.success ?? true,
          errorMessage: entry.errorMessage,
          timestamp: entry.timestamp || new Date(),
        },
      });
    } catch (error) {
      // Fail silently - don't break application for audit failure
      // This is critical for HIPAA compliance - we must not lose audit events
      const fallbackLog = {
        FALLBACK_AUDIT_LOG: true,
        timestamp: new Date().toISOString(),
        eventType: entry.eventType,
        severity: entry.severity || getEventSeverity(entry.eventType),
        userId: entry.userId,
        targetUserId: entry.targetUserId,
        userRole: entry.userRole,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        action: entry.action,
        success: entry.success,
        errorMessage: entry.errorMessage,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        dbError: error instanceof Error ? error.message : 'Unknown error',
      };
      
      // Log to console as emergency fallback
      console.error('[AuditLogger] CRITICAL: Failed to create audit log:', fallbackLog);
      
      // In production, you might also want to:
      // - Send to external logging service (CloudWatch, Datadog, etc.)
      // - Send alert to ops team via PagerDuty/Opsgenie
      // - Queue for retry with exponential backoff
    }
  }

  /**
   * Log authentication events
   * Tracks login attempts (success and failure), logout, password changes
   * 
   * @param event - Type of authentication event
   * @param userId - User ID (undefined for failed login attempts)
   * @param success - Whether the authentication was successful
   * @param context - Audit context with IP, user agent, etc.
   * @param metadata - Additional authentication metadata (method, MFA status, etc.)
   */
  async logAuth(
    event: AuditEventType,
    userId: string | undefined,
    success: boolean,
    context: AuditContext,
    metadata?: AuthenticationMetadata
  ): Promise<void> {
    // Determine the appropriate event type based on success if not specified
    let eventType = event;
    if (event === AuditEventType.USER_LOGIN && !success) {
      eventType = AuditEventType.USER_LOGIN_FAILED;
    }

    const actionMap: Record<string, string> = {
      [AuditEventType.USER_LOGIN]: 'User logged in successfully',
      [AuditEventType.USER_LOGIN_FAILED]: 'Login attempt failed',
      [AuditEventType.USER_LOGOUT]: 'User logged out',
      [AuditEventType.PASSWORD_CHANGED]: 'Password changed',
      [AuditEventType.PASSWORD_RESET_REQUESTED]: 'Password reset requested',
      [AuditEventType.PASSWORD_RESET_COMPLETED]: 'Password reset completed',
    };

    await this.log({
      eventType,
      userId,
      userRole: context.userRole,
      action: actionMap[eventType] || 'Authentication event',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      success,
      severity: success ? AuditSeverity.INFO : AuditSeverity.WARNING,
      metadata: metadata as Record<string, unknown>,
      errorMessage: metadata?.failureReason,
      requestId: context.requestId,
      timestamp: new Date(),
    });
  }

  /**
   * Log PHI access events
   * Critical for HIPAA compliance - all PHI viewing must be logged
   * 
   * @param action - Type of access (VIEW, CREATE, UPDATE, DELETE)
   * @param userId - User accessing the PHI
   * @param userRole - Role of the accessing user
   * @param resourceType - Type of PHI resource
   * @param resourceId - ID of the resource accessed
   * @param context - Audit context
   * @param metadata - Additional PHI access metadata
   */
  async logPHIAccess(
    action: 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE',
    userId: string,
    userRole: string,
    resourceType: PHIResourceType | string,
    resourceId: string,
    context: AuditContext,
    metadata?: PHIAccessMetadata
  ): Promise<void> {
    // Map action and resource to appropriate event type
    const eventTypeMap: Record<string, Record<string, AuditEventType>> = {
      VIEW: {
        [PHIResourceType.INTAKE]: AuditEventType.INTAKE_VIEWED,
        [PHIResourceType.PRESCRIPTION]: AuditEventType.PRESCRIPTION_VIEWED,
        [PHIResourceType.MESSAGE]: AuditEventType.MESSAGE_VIEWED,
        [PHIResourceType.PATIENT_PROFILE]: AuditEventType.PATIENT_DATA_VIEWED,
        [PHIResourceType.REVIEW]: AuditEventType.PATIENT_DATA_VIEWED,
        [PHIResourceType.DOCUMENT]: AuditEventType.PATIENT_DATA_VIEWED,
        [PHIResourceType.MEDICAL_HISTORY]: AuditEventType.PATIENT_DATA_VIEWED,
      },
      CREATE: {
        default: AuditEventType.PATIENT_DATA_CREATED,
      },
      UPDATE: {
        default: AuditEventType.PATIENT_DATA_UPDATED,
      },
      DELETE: {
        default: AuditEventType.PATIENT_DATA_DELETED,
      },
    };

    const eventType: AuditEventType = eventTypeMap[action]?.[resourceType] || eventTypeMap[action]?.default || AuditEventType.PATIENT_DATA_VIEWED;

    // Determine severity based on action and metadata
    let severity = AuditSeverity.INFO;
    if (action === 'DELETE') {
      severity = AuditSeverity.WARNING;
    }
    if (metadata?.breakGlass || metadata?.emergencyAccess) {
      severity = AuditSeverity.CRITICAL;
    }

    await this.log({
      eventType,
      userId,
      userRole,
      resourceType,
      resourceId,
      action: `${action} ${resourceType}`,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      success: true,
      severity,
      metadata: metadata as Record<string, unknown>,
      requestId: context.requestId,
      timestamp: new Date(),
    });
  }

  /**
   * Log PHI disclosure events (42 CFR Part 2)
   * Tracks who disclosed PHI, to whom, what was disclosed, and why
   */
  async logDisclosure(
    userId: string,
    userRole: string,
    targetPatientId: string,
    context: AuditContext,
    disclosure: {
      recipientDescription: string;
      dataCategories: string[];
      purpose: string;
      legalBasis: string;
    }
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.PHI_DISCLOSURE,
      userId,
      userRole,
      targetUserId: targetPatientId,
      resourceType: 'PHI_DISCLOSURE',
      action: `PHI disclosed to ${disclosure.recipientDescription}`,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      success: true,
      severity: AuditSeverity.WARNING,
      metadata: {
        recipientDescription: disclosure.recipientDescription,
        dataCategories: disclosure.dataCategories,
        purpose: disclosure.purpose,
        legalBasis: disclosure.legalBasis,
      },
      requestId: context.requestId,
      timestamp: new Date(),
    });
  }

  /**
   * Log data modification events
   * Tracks create, update, and delete operations with field-level changes
   *
   * @param action - Type of modification
   * @param userId - User making the modification
   * @param resourceType - Type of resource being modified
   * @param resourceId - ID of the resource
   * @param context - Audit context
   * @param changes - Details of the changes made
   */
  async logDataModification(
    action: DataModificationAction,
    userId: string,
    resourceType: string,
    resourceId: string,
    context: AuditContext,
    changes: DataModificationMetadata
  ): Promise<void> {
    let eventType: AuditEventType;
    
    switch (action) {
      case DataModificationAction.CREATE:
        eventType = AuditEventType.PATIENT_DATA_CREATED;
        break;
      case DataModificationAction.UPDATE:
        eventType = AuditEventType.PATIENT_DATA_UPDATED;
        break;
      case DataModificationAction.DELETE:
        eventType = AuditEventType.PATIENT_DATA_DELETED;
        break;
    }

    // Sanitize changes to prevent PHI in metadata
    const sanitizedChanges: DataModificationMetadata = {
      action: changes.action,
      fieldsChanged: changes.fieldsChanged,
      reason: changes.reason,
      // Note: previousValues and newValues should NOT include actual PHI
      // They should only contain field names or sanitized non-PHI data
    };

    await this.log({
      eventType,
      userId,
      resourceType,
      resourceId,
      // action field removed - does not exist in DB schema
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      success: true,
      severity: action === DataModificationAction.DELETE ? AuditSeverity.WARNING : AuditSeverity.INFO,
      metadata: sanitizedChanges as unknown as Record<string, unknown>,
      requestId: context.requestId,
      timestamp: new Date(),
    });
  }

  /**
   * Query audit logs (for admin use)
   * Returns paginated results for compliance reporting
   * 
   * Note: This is a read-only operation. Audit logs cannot be modified or deleted.
   * 
   * @param options - Query options for filtering and pagination
   * @returns Paginated audit log results
   */
  async queryLogs(options: AuditLogQueryOptions = {}): Promise<AuditLogQueryResult> {
    const {
      userId,
      targetUserId,
      eventType,
      resourceType,
      resourceId,
      severity,
      success,
      startDate,
      endDate,
      page = 1,
      limit = 50,
      orderBy = 'desc',
    } = options;

    // Build where clause
    const where: Record<string, unknown> = {};
    
    if (userId) where.userId = userId;
    if (targetUserId) where.targetUserId = targetUserId;
    if (eventType) where.eventType = eventType;
    if (resourceType) where.resourceType = resourceType;
    if (resourceId) where.resourceId = resourceId;
    if (severity) where.severity = severity;
    if (success !== undefined) where.success = success;
    
    // Date range filter
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) (where.timestamp as Record<string, Date>).gte = startDate;
      if (endDate) (where.timestamp as Record<string, Date>).lte = endDate;
    }

    // Execute count and query in parallel for efficiency
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { timestamp: orderBy },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      logs: logs.map(log => ({
        id: log.id,
        eventType: log.eventType as AuditEventType,
        severity: log.severity as AuditSeverity,
        userId: log.userId ?? undefined,
        targetUserId: log.targetUserId ?? undefined,
        userRole: log.userRole ?? undefined,
        resourceType: log.resourceType,
        resourceId: log.resourceId ?? undefined,
        action: log.eventType,
        metadata: (log.metadata as Record<string, unknown>) ?? undefined,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent ?? undefined,
        success: log.success,
        errorMessage: log.errorMessage ?? undefined,
        timestamp: log.timestamp,
      })),
      total,
      page,
      totalPages,
      hasMore: page < totalPages,
    };
  }
}

/**
 * Singleton instance of AuditLogger
 * Use this for all audit logging operations
 */
export const auditLogger = new AuditLogger();

// ============================================================================
// Standalone convenience functions (for backward compatibility)
// ============================================================================

/**
 * Create audit log entry (standalone function)
 * Uses the singleton auditLogger instance
 */
export async function auditLog(
  eventType: AuditEventType,
  data: Omit<AuditLogEntry, 'id' | 'eventType' | 'timestamp'>,
  context: AuditContext
): Promise<void> {
  await auditLogger.log({
    ...data,
    eventType,
    timestamp: new Date(),
  });
}

/**
 * Convenience method for login events
 */
export async function auditLogin(
  userId: string | undefined,
  success: boolean,
  context: AuditContext,
  metadata?: AuthenticationMetadata
): Promise<void> {
  const eventType = success 
    ? AuditEventType.USER_LOGIN 
    : AuditEventType.USER_LOGIN_FAILED;
  
  await auditLogger.logAuth(eventType, userId, success, context, metadata);
}

/**
 * Convenience method for logout events
 */
export async function auditLogout(
  userId: string,
  context: AuditContext
): Promise<void> {
  await auditLogger.logAuth(
    AuditEventType.USER_LOGOUT,
    userId,
    true,
    context
  );
}

/**
 * Convenience method for PHI access events
 */
export async function auditPHIAccess(
  userId: string,
  resourceType: PHIResourceType | string,
  resourceId: string,
  action: string,
  context: AuditContext,
  metadata?: PHIAccessMetadata
): Promise<void> {
  // Map resource type and action to appropriate event type
  let eventType: AuditEventType;
  
  switch (resourceType) {
    case PHIResourceType.INTAKE:
      eventType = AuditEventType.INTAKE_VIEWED;
      break;
    case PHIResourceType.PRESCRIPTION:
      eventType = AuditEventType.PRESCRIPTION_VIEWED;
      break;
    case PHIResourceType.MESSAGE:
      eventType = AuditEventType.MESSAGE_VIEWED;
      break;
    case PHIResourceType.PATIENT_PROFILE:
    default:
      eventType = AuditEventType.PATIENT_DATA_VIEWED;
  }

  const severity = metadata?.breakGlass || metadata?.emergencyAccess 
    ? AuditSeverity.CRITICAL 
    : AuditSeverity.INFO;

  await auditLogger.log({
    eventType,
    userId,
    userRole: context.userRole,
    resourceType,
    resourceId,
    action,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    success: true,
    severity,
    metadata: metadata as Record<string, unknown>,
    timestamp: new Date(),
  });
}

/**
 * Convenience method for data modification events
 */
export async function auditDataModification(
  userId: string,
  targetUserId: string | undefined,
  resourceType: string,
  resourceId: string,
  action: DataModificationAction,
  context: AuditContext,
  changes?: DataModificationMetadata
): Promise<void> {
  await auditLogger.logDataModification(
    action,
    userId,
    resourceType,
    resourceId,
    context,
    changes || { action }
  );
}

/**
 * Audit password-related events
 */
export async function auditPasswordEvent(
  eventType: AuditEventType.PASSWORD_CHANGED | AuditEventType.PASSWORD_RESET_REQUESTED | AuditEventType.PASSWORD_RESET_COMPLETED | AuditEventType.EMAIL_VERIFIED,
  userId: string,
  context: AuditContext,
  success: boolean = true,
  errorMessage?: string
): Promise<void> {
  await auditLogger.logAuth(eventType, userId, success, context, {
    failureReason: errorMessage,
  });
}

/**
 * Audit user registration
 */
export async function auditUserRegistration(
  userId: string,
  userRole: string,
  context: AuditContext
): Promise<void> {
  await auditLogger.log({
    eventType: AuditEventType.USER_REGISTERED,
    userId,
    userRole,
    resourceType: 'User',
    resourceId: userId,
    action: 'New user registered',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    success: true,
    timestamp: new Date(),
  });
}

/**
 * Audit admin actions
 */
export async function auditAdminAction(
  eventType: AuditEventType,
  adminUserId: string,
  targetUserId: string | undefined,
  action: string,
  context: AuditContext,
  metadata?: Record<string, unknown>
): Promise<void> {
  await auditLogger.log({
    eventType,
    userId: adminUserId,
    targetUserId,
    resourceType: 'System',
    action,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    success: true,
    severity: AuditSeverity.WARNING, // Admin actions are higher severity
    metadata,
    timestamp: new Date(),
  });
}

/**
 * Query audit logs (for admin use) - standalone function
 */
export async function queryAuditLogs(
  options: AuditLogQueryOptions = {}
): Promise<AuditLogQueryResult> {
  return auditLogger.queryLogs(options);
}

/**
 * Export audit logs for compliance reporting
 */
export async function exportAuditLogs(
  startDate: Date,
  endDate: Date,
  eventTypes?: AuditEventType[]
): Promise<AuditLogEntry[]> {
  const where: Record<string, unknown> = {
    timestamp: {
      gte: startDate,
      lte: endDate,
    },
  };
  
  if (eventTypes && eventTypes.length > 0) {
    where.eventType = { in: eventTypes };
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { timestamp: 'asc' },
  });

  return logs.map(log => ({
    id: log.id,
    eventType: log.eventType as AuditEventType,
    severity: log.severity as AuditSeverity,
    userId: log.userId ?? undefined,
    targetUserId: log.targetUserId ?? undefined,
    userRole: log.userRole ?? undefined,
    resourceType: log.resourceType,
    resourceId: log.resourceId ?? undefined,
    action: log.eventType,
    metadata: (log.metadata as Record<string, unknown>) ?? undefined,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent ?? undefined,
    success: log.success,
    errorMessage: log.errorMessage ?? undefined,
    timestamp: log.timestamp,
  }));
}

/**
 * Get recent audit activity for a specific user
 */
export async function getUserAuditActivity(
  userId: string,
  limit: number = 10
): Promise<AuditLogEntry[]> {
  const logs = await prisma.auditLog.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  return logs.map(log => ({
    id: log.id,
    eventType: log.eventType as AuditEventType,
    severity: log.severity as AuditSeverity,
    userId: log.userId ?? undefined,
    targetUserId: log.targetUserId ?? undefined,
    userRole: log.userRole ?? undefined,
    resourceType: log.resourceType,
    resourceId: log.resourceId ?? undefined,
    action: log.eventType,
    metadata: (log.metadata as Record<string, unknown>) ?? undefined,
    ipAddress: log.ipAddress,
    userAgent: log.userAgent ?? undefined,
    success: log.success,
    errorMessage: log.errorMessage ?? undefined,
    timestamp: log.timestamp,
  }));
}
