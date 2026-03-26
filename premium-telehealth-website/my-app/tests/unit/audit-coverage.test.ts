/**
 * Audit Logger Coverage Tests
 * Tests the auditLogger API for HIPAA compliance:
 * - log() creates an audit record
 * - logPHIAccess() works with correct params
 * - logAuth() works with correct params
 * - Silent fallback on DB failure (never throws)
 * - All required HIPAA fields present
 *
 * Covers TASK 2.10.2
 *
 * @module tests/unit/audit-coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuditEventType, AuditSeverity, PHIResourceType } from '@/lib/audit/types';

// ============================================================================
// Mock Prisma before importing the logger
// ============================================================================

const mockCreate = vi.fn().mockResolvedValue({ id: 'audit-1' });

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    auditLog: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

// Import AFTER mock is set up
import { AuditLogger } from '@/lib/audit/logger';

// ============================================================================
// Setup
// ============================================================================

let logger: AuditLogger;

beforeEach(() => {
  logger = new AuditLogger();
  mockCreate.mockClear();
  mockCreate.mockResolvedValue({ id: 'audit-1' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ============================================================================
// 1. auditLogger.log() creates an audit record
// ============================================================================

describe('auditLogger.log()', () => {
  it('should call prisma.auditLog.create with correct data', async () => {
    await logger.log({
      eventType: AuditEventType.USER_LOGIN,
      userId: 'user-123',
      userRole: 'PATIENT',
      resourceType: 'User',
      resourceId: 'user-123',
      action: 'User logged in',
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      success: true,
      timestamp: new Date('2026-01-01T00:00:00Z'),
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.eventType).toBe(AuditEventType.USER_LOGIN);
    expect(callData.userId).toBe('user-123');
    expect(callData.userRole).toBe('PATIENT');
    expect(callData.resourceType).toBe('User');
    expect(callData.resourceId).toBe('user-123');
    expect(callData.ipAddress).toBe('192.168.1.1');
    expect(callData.userAgent).toBe('Mozilla/5.0');
    expect(callData.success).toBe(true);
    expect(callData.timestamp).toBeInstanceOf(Date);
  });

  it('should include severity from getEventSeverity when not explicitly provided', async () => {
    await logger.log({
      eventType: AuditEventType.PATIENT_DATA_VIEWED,
      ipAddress: '10.0.0.1',
      success: true,
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callData = mockCreate.mock.calls[0][0].data;
    // PATIENT_DATA_VIEWED defaults to INFO severity
    expect(callData.severity).toBe(AuditSeverity.INFO);
  });

  it('should use explicitly provided severity', async () => {
    await logger.log({
      eventType: AuditEventType.PATIENT_DATA_VIEWED,
      severity: AuditSeverity.CRITICAL,
      ipAddress: '10.0.0.1',
      success: true,
    });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.severity).toBe(AuditSeverity.CRITICAL);
  });

  it('should sanitize metadata to prevent PHI leakage', async () => {
    await logger.log({
      eventType: AuditEventType.USER_LOGIN,
      ipAddress: '10.0.0.1',
      success: true,
      metadata: {
        action: 'login',
        password: 'secret123',
        dateOfBirth: '1990-01-01',
      },
    });

    const callData = mockCreate.mock.calls[0][0].data;
    const meta = callData.metadata as Record<string, unknown>;
    expect(meta.action).toBe('login');
    // password should be omitted (FIELDS_TO_OMIT)
    expect(meta).not.toHaveProperty('password');
    // dateOfBirth should be redacted (SENSITIVE_FIELDS)
    expect(meta.dateOfBirth).toBe('[REDACTED]');
  });

  it('should attach requestId to metadata when provided', async () => {
    await logger.log({
      eventType: AuditEventType.USER_LOGIN,
      ipAddress: '10.0.0.1',
      success: true,
      requestId: 'req-abc-123',
    });

    const callData = mockCreate.mock.calls[0][0].data;
    const meta = callData.metadata as Record<string, unknown>;
    expect(meta.requestId).toBe('req-abc-123');
  });

  it('should default success to true when not specified', async () => {
    await logger.log({
      eventType: AuditEventType.PATIENT_DATA_VIEWED,
      ipAddress: '10.0.0.1',
    });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.success).toBe(true);
  });
});

// ============================================================================
// 2. auditLogger.logPHIAccess() works with correct params
// ============================================================================

describe('auditLogger.logPHIAccess()', () => {
  const context = {
    ipAddress: '192.168.1.100',
    userAgent: 'TestAgent/1.0',
    requestId: 'req-phi-001',
    userRole: 'PHYSICIAN',
  };

  it('should log a VIEW action for PatientProfile', async () => {
    await logger.logPHIAccess(
      'VIEW',
      'physician-1',
      'PHYSICIAN',
      PHIResourceType.PATIENT_PROFILE,
      'profile-99',
      context,
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.eventType).toBe(AuditEventType.PATIENT_DATA_VIEWED);
    expect(callData.userId).toBe('physician-1');
    expect(callData.userRole).toBe('PHYSICIAN');
    expect(callData.resourceType).toBe(PHIResourceType.PATIENT_PROFILE);
    expect(callData.resourceId).toBe('profile-99');
    expect(callData.ipAddress).toBe('192.168.1.100');
    expect(callData.userAgent).toBe('TestAgent/1.0');
    expect(callData.success).toBe(true);
  });

  it('should log a VIEW action for Intake', async () => {
    await logger.logPHIAccess(
      'VIEW',
      'physician-1',
      'PHYSICIAN',
      PHIResourceType.INTAKE,
      'intake-42',
      context,
    );

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.eventType).toBe(AuditEventType.INTAKE_VIEWED);
  });

  it('should log a VIEW action for Prescription', async () => {
    await logger.logPHIAccess(
      'VIEW',
      'patient-1',
      'PATIENT',
      PHIResourceType.PRESCRIPTION,
      'rx-10',
      context,
    );

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.eventType).toBe(AuditEventType.PRESCRIPTION_VIEWED);
  });

  it('should log a VIEW action for Message', async () => {
    await logger.logPHIAccess(
      'VIEW',
      'patient-1',
      'PATIENT',
      PHIResourceType.MESSAGE,
      'msg-5',
      context,
    );

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.eventType).toBe(AuditEventType.MESSAGE_VIEWED);
  });

  it('should log CREATE actions with PATIENT_DATA_CREATED event type', async () => {
    await logger.logPHIAccess(
      'CREATE',
      'patient-1',
      'PATIENT',
      PHIResourceType.PATIENT_PROFILE,
      'profile-new',
      context,
    );

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.eventType).toBe(AuditEventType.PATIENT_DATA_CREATED);
  });

  it('should log UPDATE actions with PATIENT_DATA_UPDATED event type', async () => {
    await logger.logPHIAccess(
      'UPDATE',
      'patient-1',
      'PATIENT',
      PHIResourceType.PATIENT_PROFILE,
      'profile-1',
      context,
    );

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.eventType).toBe(AuditEventType.PATIENT_DATA_UPDATED);
  });

  it('should log DELETE actions with WARNING severity', async () => {
    await logger.logPHIAccess(
      'DELETE',
      'admin-1',
      'ADMIN',
      PHIResourceType.DOCUMENT,
      'doc-1',
      context,
    );

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.eventType).toBe(AuditEventType.PATIENT_DATA_DELETED);
    expect(callData.severity).toBe(AuditSeverity.WARNING);
  });

  it('should set CRITICAL severity for break-glass access', async () => {
    await logger.logPHIAccess(
      'VIEW',
      'physician-1',
      'PHYSICIAN',
      PHIResourceType.PATIENT_PROFILE,
      'profile-99',
      context,
      { breakGlass: true, accessReason: 'Emergency' },
    );

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.severity).toBe(AuditSeverity.CRITICAL);
  });

  it('should set CRITICAL severity for emergency access', async () => {
    await logger.logPHIAccess(
      'VIEW',
      'physician-1',
      'PHYSICIAN',
      PHIResourceType.PATIENT_PROFILE,
      'profile-99',
      context,
      { emergencyAccess: true },
    );

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.severity).toBe(AuditSeverity.CRITICAL);
  });
});

// ============================================================================
// 3. auditLogger.logAuth() works with correct params
// ============================================================================

describe('auditLogger.logAuth()', () => {
  const context = {
    ipAddress: '203.0.113.50',
    userAgent: 'Chrome/120.0',
    requestId: 'req-auth-001',
    userRole: 'PATIENT',
  };

  it('should log a successful login', async () => {
    await logger.logAuth(
      AuditEventType.USER_LOGIN,
      'user-1',
      true,
      context,
      { authMethod: 'password' },
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.eventType).toBe(AuditEventType.USER_LOGIN);
    expect(callData.userId).toBe('user-1');
    expect(callData.success).toBe(true);
    expect(callData.severity).toBe(AuditSeverity.INFO);
    expect(callData.ipAddress).toBe('203.0.113.50');
    expect(callData.userAgent).toBe('Chrome/120.0');
  });

  it('should map failed login to USER_LOGIN_FAILED event type', async () => {
    await logger.logAuth(
      AuditEventType.USER_LOGIN,
      undefined,
      false,
      context,
      { failureReason: 'Invalid credentials' },
    );

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.eventType).toBe(AuditEventType.USER_LOGIN_FAILED);
    expect(callData.success).toBe(false);
    expect(callData.severity).toBe(AuditSeverity.WARNING);
    expect(callData.errorMessage).toBe('Invalid credentials');
  });

  it('should log a logout event', async () => {
    await logger.logAuth(
      AuditEventType.USER_LOGOUT,
      'user-1',
      true,
      context,
    );

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.eventType).toBe(AuditEventType.USER_LOGOUT);
    expect(callData.success).toBe(true);
  });

  it('should log a password change event', async () => {
    await logger.logAuth(
      AuditEventType.PASSWORD_CHANGED,
      'user-1',
      true,
      context,
    );

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.eventType).toBe(AuditEventType.PASSWORD_CHANGED);
  });

  it('should log a password reset request', async () => {
    await logger.logAuth(
      AuditEventType.PASSWORD_RESET_REQUESTED,
      'user-1',
      true,
      context,
    );

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.eventType).toBe(AuditEventType.PASSWORD_RESET_REQUESTED);
  });

  it('should include a timestamp', async () => {
    await logger.logAuth(
      AuditEventType.USER_LOGIN,
      'user-1',
      true,
      context,
    );

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.timestamp).toBeInstanceOf(Date);
  });
});

// ============================================================================
// 4. Logger does NOT throw on DB failure (silent fallback)
// ============================================================================

describe('Silent fallback on DB failure', () => {
  it('should NOT throw when prisma.auditLog.create rejects', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Database connection lost'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      logger.log({
        eventType: AuditEventType.USER_LOGIN,
        ipAddress: '10.0.0.1',
        success: true,
      })
    ).resolves.toBeUndefined();

    consoleSpy.mockRestore();
  });

  it('should log a fallback message to console.error on DB failure', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Connection timeout'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await logger.log({
      eventType: AuditEventType.PATIENT_DATA_VIEWED,
      userId: 'user-1',
      ipAddress: '10.0.0.1',
      success: true,
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const args = consoleSpy.mock.calls[0];
    expect(args[0]).toContain('[AuditLogger] CRITICAL');
    // The fallback log object should contain key fields
    const fallbackObj = args[1] as Record<string, unknown>;
    expect(fallbackObj.FALLBACK_AUDIT_LOG).toBe(true);
    expect(fallbackObj.eventType).toBe(AuditEventType.PATIENT_DATA_VIEWED);
    expect(fallbackObj.userId).toBe('user-1');
    expect(fallbackObj.dbError).toBe('Connection timeout');

    consoleSpy.mockRestore();
  });

  it('should not throw when logPHIAccess encounters DB failure', async () => {
    mockCreate.mockRejectedValueOnce(new Error('DB error'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      logger.logPHIAccess(
        'VIEW',
        'user-1',
        'PATIENT',
        PHIResourceType.PATIENT_PROFILE,
        'profile-1',
        { ipAddress: '10.0.0.1', userAgent: 'Test', requestId: 'req-1' },
      )
    ).resolves.toBeUndefined();

    consoleSpy.mockRestore();
  });

  it('should not throw when logAuth encounters DB failure', async () => {
    mockCreate.mockRejectedValueOnce(new Error('DB error'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      logger.logAuth(
        AuditEventType.USER_LOGIN,
        'user-1',
        true,
        { ipAddress: '10.0.0.1', userAgent: 'Test', requestId: 'req-1' },
      )
    ).resolves.toBeUndefined();

    consoleSpy.mockRestore();
  });
});

// ============================================================================
// 5. All required HIPAA fields present in log entries
// ============================================================================

describe('Required HIPAA fields', () => {
  it('should include userId, eventType, resourceType, ipAddress, userAgent, success, timestamp', async () => {
    await logger.log({
      eventType: AuditEventType.PATIENT_DATA_VIEWED,
      userId: 'user-hipaa',
      userRole: 'PHYSICIAN',
      resourceType: 'PatientProfile',
      resourceId: 'profile-hipaa',
      action: 'Viewed patient profile',
      ipAddress: '198.51.100.10',
      userAgent: 'Firefox/115.0',
      success: true,
      timestamp: new Date('2026-03-25T12:00:00Z'),
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callData = mockCreate.mock.calls[0][0].data;

    // WHO
    expect(callData.userId).toBe('user-hipaa');
    expect(callData.userRole).toBe('PHYSICIAN');

    // WHAT
    expect(callData.eventType).toBe(AuditEventType.PATIENT_DATA_VIEWED);
    expect(callData.resourceType).toBe('PatientProfile');
    expect(callData.resourceId).toBe('profile-hipaa');

    // WHEN
    expect(callData.timestamp).toBeInstanceOf(Date);

    // WHERE
    expect(callData.ipAddress).toBe('198.51.100.10');
    expect(callData.userAgent).toBe('Firefox/115.0');

    // STATUS
    expect(callData.success).toBe(true);
  });

  it('should default resourceType to SYSTEM when not provided', async () => {
    await logger.log({
      eventType: AuditEventType.USER_LOGIN,
      ipAddress: '10.0.0.1',
      success: true,
    });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.resourceType).toBe('SYSTEM');
  });

  it('should auto-generate timestamp when not provided', async () => {
    const before = new Date();

    await logger.log({
      eventType: AuditEventType.USER_LOGIN,
      ipAddress: '10.0.0.1',
      success: true,
    });

    const callData = mockCreate.mock.calls[0][0].data;
    const after = new Date();
    expect(callData.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(callData.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('should include errorMessage when operation fails', async () => {
    await logger.log({
      eventType: AuditEventType.USER_LOGIN_FAILED,
      ipAddress: '10.0.0.1',
      success: false,
      errorMessage: 'Invalid credentials',
    });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.errorMessage).toBe('Invalid credentials');
    expect(callData.success).toBe(false);
  });

  it('should include targetUserId when acting on another user', async () => {
    await logger.log({
      eventType: AuditEventType.PATIENT_DATA_VIEWED,
      userId: 'physician-1',
      targetUserId: 'patient-1',
      ipAddress: '10.0.0.1',
      success: true,
    });

    const callData = mockCreate.mock.calls[0][0].data;
    expect(callData.userId).toBe('physician-1');
    expect(callData.targetUserId).toBe('patient-1');
  });
});
