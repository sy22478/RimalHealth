/**
 * Audit Utilities
 * Helper functions for audit logging operations
 * 
 * HIPAA Compliance:
 * - Sanitizes sensitive data from metadata (no PHI leakage)
 * - Hashes identifiers when needed for tamper evidence
 * - Determines severity based on event type for prioritization
 */

import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { AuditEventType, AuditSeverity } from './types';

/**
 * Sensitive field patterns that should be sanitized from metadata
 * These fields must NEVER be logged to prevent data leakage
 */
const SENSITIVE_FIELDS = [
  // Authentication credentials
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'apiKey',
  'apiSecret',
  'secret',
  'credentials',
  'authCode',
  'otp',
  'mfaCode',
  'verificationCode',
  
  // PHI fields that should not be in metadata
  'ssn',
  'socialSecurityNumber',
  'dob',
  'dateOfBirth',
  'diagnosis',
  'medicalHistory',
  'prescription',
  'medication',
  'allergies',
  'symptoms',
  'notes',
  'clinicalNotes',
  'treatmentPlan',
  'insuranceId',
  'memberId',
  
  // Payment information
  'cardNumber',
  'cvv',
  'cvc',
  'expiryDate',
  'accountNumber',
  'routingNumber',
  'bankAccount',
  
  // Session/Security
  'sessionId',
  'csrfToken',
  'xsrfToken',
  'state',
];

/**
 * Fields to completely remove from metadata (not just redact)
 */
const FIELDS_TO_OMIT = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'idToken',
  'apiKey',
  'apiSecret',
  'secret',
  'credentials',
  'authCode',
  'otp',
  'mfaCode',
  'verificationCode',
  'cardNumber',
  'cvv',
  'cvc',
  'accountNumber',
];

/**
 * Sanitize sensitive data from metadata
 * Removes or redacts fields that contain sensitive information
 * 
 * HIPAA Requirement: PHI must never be stored in audit log metadata
 * 
 * @param metadata - Raw metadata object
 * @returns Sanitized metadata safe for audit logging
 * 
 * @example
 * ```typescript
 * const safe = sanitizeMetadata({ 
 *   userId: '123', 
 *   password: 'secret123',
 *   action: 'view'
 * });
 * // Result: { userId: '123', action: 'view', password: '[REDACTED]' }
 * ```
 */
export function sanitizeMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    
    // Check if field should be completely omitted
    if (FIELDS_TO_OMIT.some(field => lowerKey === field.toLowerCase())) {
      continue;
    }

    // Check if field is sensitive and should be redacted
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      if (Array.isArray(value)) {
        sanitized[key] = value.map(item => 
          typeof item === 'object' && item !== null 
            ? sanitizeMetadata(item as Record<string, unknown>) 
            : item
        );
      } else {
        sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Get client IP address from request
 * Handles various proxy headers for accurate IP detection
 * 
 * HIPAA Requirement: Must record where access occurred (IP address)
 * 
 * @param request - Next.js request or standard Request
 * @returns Client IP address or 'unknown'
 * 
 * @example
 * ```typescript
 * const ip = getClientIP(request);
 * // Returns: '192.168.1.1' or 'unknown'
 * ```
 */
export function getClientIP(request: Request | NextRequest): string {
  // For NextRequest, use the built-in ip property first
  if ('ip' in request && request.ip) {
    return request.ip as string;
  }

  // Check various proxy headers (in order of preference)
  const headers = request.headers;
  
  // X-Forwarded-For can contain multiple IPs (client, proxy1, proxy2, ...)
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP (client IP)
    const clientIp = forwardedFor.split(',')[0]?.trim();
    if (clientIp && isValidIP(clientIp)) {
      return clientIp;
    }
  }

  // Other common proxy headers
  const realIp = headers.get('x-real-ip');
  if (realIp && isValidIP(realIp)) {
    return realIp;
  }

  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp && isValidIP(cfConnectingIp)) {
    return cfConnectingIp;
  }

  const trueClientIp = headers.get('true-client-ip');
  if (trueClientIp && isValidIP(trueClientIp)) {
    return trueClientIp;
  }

  const forwarded = headers.get('forwarded');
  if (forwarded) {
    // Parse Forwarded header (RFC 7239)
    // Example: for=192.0.2.60;proto=http;by=203.0.113.43
    const match = forwarded.match(/for=\[?([^;\]]+)\]?/);
    if (match && match[1]) {
      const ip = match[1].trim();
      if (isValidIP(ip)) {
        return ip;
      }
    }
  }

  // If running locally in development
  if (process.env.NODE_ENV === 'development') {
    return '127.0.0.1';
  }

  return 'unknown';
}

/**
 * Validate if a string is a valid IP address (IPv4 or IPv6)
 */
function isValidIP(ip: string): boolean {
  // IPv4 regex
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  // IPv6 regex (simplified)
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Hash a sensitive identifier for logging
 * Used when you need to track that an ID was accessed without logging the actual ID
 * Creates a tamper-evident hash suitable for audit trails
 * 
 * @param id - Identifier to hash
 * @returns SHA-256 hash of the identifier
 * 
 * @example
 * ```typescript
 * const hash = hashIdentifier('patient-123');
 * // Returns: 'a1b2c3d4...' (64 character hex string)
 * ```
 */
export function hashIdentifier(id: string): string {
  return createHash('sha256')
    .update(id)
    .update(process.env.AUDIT_HASH_SALT || 'rimal-health-default-salt')
    .digest('hex');
}

/**
 * Get severity level based on event type
 * Critical events require immediate attention
 * 
 * @param eventType - Type of audit event
 * @returns Appropriate severity level
 */
export function getEventSeverity(eventType: AuditEventType): AuditSeverity {
  // Critical events - immediate security concern
  const criticalEvents: AuditEventType[] = [
    AuditEventType.USER_LOGIN_FAILED,
    AuditEventType.PATIENT_DATA_DELETED,
    AuditEventType.USER_DEACTIVATED,
  ];

  // Warning events - notable but not critical
  const warningEvents: AuditEventType[] = [
    AuditEventType.PASSWORD_RESET_REQUESTED,
    AuditEventType.PASSWORD_CHANGED,
    AuditEventType.USER_ROLE_CHANGED,
    AuditEventType.AUDIT_LOG_EXPORTED,
    AuditEventType.SYSTEM_SETTING_CHANGED,
    AuditEventType.PATIENT_DATA_UPDATED,
    AuditEventType.MFA_SETUP,
    AuditEventType.MFA_DISABLED,
    AuditEventType.MFA_FAILED,
  ];

  // Error events - failures
  const errorEvents: AuditEventType[] = [
    AuditEventType.USER_LOGIN_FAILED,
  ];

  if (criticalEvents.includes(eventType) && !errorEvents.includes(eventType)) {
    return AuditSeverity.CRITICAL;
  }

  if (errorEvents.includes(eventType)) {
    return AuditSeverity.ERROR;
  }

  if (warningEvents.includes(eventType)) {
    return AuditSeverity.WARNING;
  }

  return AuditSeverity.INFO;
}

/**
 * Create a tamper-evident hash for an audit log entry
 * This can be used to verify log integrity
 * 
 * Note: This is a simplified implementation. For production,
 * consider using a blockchain-like chain of hashes or external
 * immutable storage (e.g., AWS QLDB, Amazon S3 with Object Lock)
 * 
 * @param entry - Audit log entry data
 * @param previousHash - Hash of previous entry (for chain)
 * @returns Tamper-evident hash
 */
export function createIntegrityHash(
  entry: {
    eventType: AuditEventType;
    userId?: string;
    resourceType?: string;
    resourceId?: string;
    timestamp: Date;
    action: string;
  },
  previousHash?: string
): string {
  const data = JSON.stringify({
    eventType: entry.eventType,
    userId: entry.userId,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    timestamp: entry.timestamp.toISOString(),
    action: entry.action,
    previousHash,
  });

  return createHash('sha256')
    .update(data)
    .update(process.env.AUDIT_HASH_SALT || 'rimal-health-default-salt')
    .digest('hex');
}

/**
 * Validate that an audit log entry has all required HIPAA fields
 * 
 * Required fields per HIPAA:
 * - Who: userId (when available)
 * - What: eventType, action, resourceType
 * - When: timestamp
 * - Where: ipAddress
 * - Success: success status
 * 
 * @param entry - Audit log entry to validate
 * @returns Validation result with missing fields
 */
export function validateAuditEntry(
  entry: Partial<{
    eventType: AuditEventType;
    action: string;
    resourceType: string;
    ipAddress: string;
    timestamp: Date;
    success: boolean;
  }>
): { valid: boolean; missingFields: string[] } {
  const missingFields: string[] = [];

  if (!entry.eventType) {
    missingFields.push('eventType');
  }

  if (!entry.action) {
    missingFields.push('action');
  }

  if (!entry.resourceType) {
    missingFields.push('resourceType');
  }

  if (!entry.ipAddress) {
    missingFields.push('ipAddress');
  }

  if (!entry.timestamp) {
    missingFields.push('timestamp');
  }

  if (entry.success === undefined) {
    missingFields.push('success');
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Truncate metadata to prevent audit log bloat
 * 
 * @param metadata - Metadata object
 * @param maxLength - Maximum length for string values (default: 1000)
 * @param maxDepth - Maximum nesting depth (default: 3)
 * @returns Truncated metadata
 */
export function truncateMetadata(
  metadata: Record<string, unknown> | undefined,
  maxLength: number = 1000,
  maxDepth: number = 3,
  currentDepth: number = 0
): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  if (currentDepth >= maxDepth) {
    return { '[truncated]': 'Max depth exceeded' };
  }

  const truncated: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string' && value.length > maxLength) {
      truncated[key] = value.substring(0, maxLength) + '...[truncated]';
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        // Limit array length
        const limitedArray = value.slice(0, 50);
        truncated[key] = limitedArray.map(item =>
          typeof item === 'object' && item !== null
            ? truncateMetadata(item as Record<string, unknown>, maxLength, maxDepth, currentDepth + 1)
            : item
        );
        if (value.length > 50) {
          (truncated[key] as unknown[]).push(`...and ${value.length - 50} more items`);
        }
      } else {
        truncated[key] = truncateMetadata(value as Record<string, unknown>, maxLength, maxDepth, currentDepth + 1);
      }
    } else {
      truncated[key] = value;
    }
  }

  return truncated;
}

/**
 * Format audit log entry for display/export
 * 
 * @param entry - Audit log entry
 * @returns Formatted string representation
 */
export function formatAuditEntry(entry: {
  eventType: AuditEventType;
  userId?: string;
  userRole?: string;
  resourceType?: string;
  resourceId?: string;
  action: string;
  timestamp: Date;
  ipAddress: string;
  success: boolean;
}): string {
  const timestamp = entry.timestamp.toISOString();
  const status = entry.success ? 'SUCCESS' : 'FAILURE';
  const user = entry.userId ? `${entry.userId}(${entry.userRole || 'unknown'})` : 'anonymous';
  const resource = entry.resourceId 
    ? `${entry.resourceType}/${entry.resourceId}` 
    : entry.resourceType || 'SYSTEM';

  return `[${timestamp}] [${status}] ${entry.eventType} | User: ${user} | Resource: ${resource} | Action: ${entry.action} | IP: ${entry.ipAddress}`;
}
