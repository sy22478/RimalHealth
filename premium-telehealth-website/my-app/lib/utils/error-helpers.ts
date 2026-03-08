/**
 * Error Handling Utilities
 * 
 * Provides standardized error handling, custom error classes, and error formatting.
 * HIPAA-compliant error handling that prevents PHI leakage.
 * 
 * @module lib/utils/error-helpers
 */

import { ERROR_MESSAGES } from '@/lib/constants';

// ============================================
// Error Types
// ============================================

/**
 * Application error codes
 */
export type ErrorCode = 
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_UNAUTHORIZED'
  | 'AUTH_FORBIDDEN'
  | 'AUTH_SESSION_EXPIRED'
  | 'AUTH_RATE_LIMITED'
  | 'AUTH_CSRF_INVALID'
  | 'VALIDATION_REQUIRED'
  | 'VALIDATION_INVALID_FORMAT'
  | 'VALIDATION_INVALID_EMAIL'
  | 'VALIDATION_INVALID_PHONE'
  | 'VALIDATION_INVALID_ZIP'
  | 'VALIDATION_PASSWORD_WEAK'
  | 'VALIDATION_PASSWORD_MISMATCH'
  | 'HIPAA_PHI_ACCESS_DENIED'
  | 'HIPAA_ENCRYPTION_ERROR'
  | 'HIPAA_AUDIT_FAILED'
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_CONFLICT'
  | 'RESOURCE_GONE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SERVER_INTERNAL_ERROR'
  | 'SERVER_DATABASE_ERROR'
  | 'SERVER_EXTERNAL_SERVICE_ERROR'
  | 'SERVER_TIMEOUT'
  | 'SERVER_UNAVAILABLE';

/**
 * HTTP status codes mapping
 */
export const ERROR_STATUS_CODES: Record<ErrorCode, number> = {
  AUTH_INVALID_CREDENTIALS: 401,
  AUTH_UNAUTHORIZED: 401,
  AUTH_FORBIDDEN: 403,
  AUTH_SESSION_EXPIRED: 401,
  AUTH_RATE_LIMITED: 429,
  AUTH_CSRF_INVALID: 403,
  VALIDATION_REQUIRED: 400,
  VALIDATION_INVALID_FORMAT: 400,
  VALIDATION_INVALID_EMAIL: 400,
  VALIDATION_INVALID_PHONE: 400,
  VALIDATION_INVALID_ZIP: 400,
  VALIDATION_PASSWORD_WEAK: 400,
  VALIDATION_PASSWORD_MISMATCH: 400,
  HIPAA_PHI_ACCESS_DENIED: 403,
  HIPAA_ENCRYPTION_ERROR: 500,
  HIPAA_AUDIT_FAILED: 500,
  RESOURCE_NOT_FOUND: 404,
  RESOURCE_CONFLICT: 409,
  RESOURCE_GONE: 410,
  RATE_LIMIT_EXCEEDED: 429,
  SERVER_INTERNAL_ERROR: 500,
  SERVER_DATABASE_ERROR: 500,
  SERVER_EXTERNAL_SERVICE_ERROR: 502,
  SERVER_TIMEOUT: 504,
  SERVER_UNAVAILABLE: 503,
};

// ============================================
// Custom Error Classes
// ============================================

/**
 * Base application error
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly isOperational: boolean;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = ERROR_STATUS_CODES[code] || 500;
    this.isOperational = isOperational;
    this.details = details;

    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to JSON-serializable object
   */
  toJSON(): {
    code: ErrorCode;
    message: string;
    statusCode: number;
    details?: Record<string, unknown>;
  } {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      ...(this.details && { details: this.sanitizeDetails() }),
    };
  }

  /**
   * Sanitize details to prevent PHI leakage
   */
  private sanitizeDetails(): Record<string, unknown> | undefined {
    if (!this.details) return undefined;
    
    // Remove potentially sensitive fields
    const sensitiveFields = ['password', 'token', 'ssn', 'email', 'phone', 'address'];
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(this.details)) {
      if (sensitiveFields.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
}

/**
 * Authentication error
 */
export class AuthError extends AppError {
  constructor(
    code: Extract<ErrorCode, `AUTH_${string}`>,
    message?: string,
    details?: Record<string, unknown>
  ) {
    super(
      code,
      message || ERROR_MESSAGES.AUTH[code.replace('AUTH_', '') as keyof typeof ERROR_MESSAGES.AUTH] || 'Authentication error',
      details
    );
    this.name = 'AuthError';
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  readonly field?: string;

  constructor(
    code: Extract<ErrorCode, `VALIDATION_${string}`>,
    message?: string,
    field?: string,
    details?: Record<string, unknown>
  ) {
    super(
      code,
      message || 'Validation error',
      details
    );
    this.name = 'ValidationError';
    this.field = field;
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      ...(this.field && { field: this.field }),
    };
  }
}

/**
 * HIPAA/PHI access error
 */
export class HIPAAError extends AppError {
  constructor(
    code: Extract<ErrorCode, `HIPAA_${string}`>,
    message?: string,
    details?: Record<string, unknown>
  ) {
    super(
      code,
      message || ERROR_MESSAGES.HIPAA[code.replace('HIPAA_', '') as keyof typeof ERROR_MESSAGES.HIPAA] || 'HIPAA compliance error',
      details
    );
    this.name = 'HIPAAError';
  }
}

/**
 * Resource not found error
 */
export class NotFoundError extends AppError {
  constructor(
    resource: string,
    identifier?: string
  ) {
    super(
      'RESOURCE_NOT_FOUND',
      `${resource}${identifier ? ` '${identifier}'` : ''} not found`,
      { resource, identifier }
    );
    this.name = 'NotFoundError';
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
  readonly retryAfter?: number;

  constructor(retryAfter?: number) {
    super(
      'RATE_LIMIT_EXCEEDED',
      ERROR_MESSAGES.AUTH.RATE_LIMITED,
      { retryAfter }
    );
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      ...(this.retryAfter && { retryAfter: this.retryAfter }),
    };
  }
}

/**
 * Database error
 */
export class DatabaseError extends AppError {
  constructor(
    message: string = 'Database error',
    details?: Record<string, unknown>
  ) {
    super(
      'SERVER_DATABASE_ERROR',
      message,
      details,
      false // Not operational - may need developer attention
    );
    this.name = 'DatabaseError';
  }
}

// ============================================
// Error Handling Functions
// ============================================

/**
 * Check if error is an operational error (expected)
 * 
 * @param error - Error to check
 * @returns True if operational
 */
export function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}

/**
 * Check if error is an AppError
 * 
 * @param error - Error to check
 * @returns True if AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Check if error is an auth error
 * 
 * @param error - Error to check
 * @returns True if AuthError
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

/**
 * Check if error is a validation error
 * 
 * @param error - Error to check
 * @returns True if ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Get HTTP status code from error
 * 
 * @param error - Error to check
 * @returns HTTP status code
 */
export function getErrorStatusCode(error: unknown): number {
  if (error instanceof AppError) {
    return error.statusCode;
  }
  return 500;
}

/**
 * Get safe error message for client
 * 
 * Prevents leaking internal error details to clients.
 * 
 * @param error - Error to process
 * @returns Safe error message
 */
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  
  // For unknown errors, return generic message
  return ERROR_MESSAGES.SERVER.INTERNAL_ERROR;
}

/**
 * Format error for API response
 * 
 * @param error - Error to format
 * @returns Formatted error response
 */
export function formatErrorResponse(error: unknown): {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
} {
  if (error instanceof AppError) {
    return {
      success: false,
      error: error.toJSON(),
    };
  }
  
  // Handle standard Error
  if (error instanceof Error) {
    return {
      success: false,
      error: {
        code: 'SERVER_INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'development' 
          ? error.message 
          : ERROR_MESSAGES.SERVER.INTERNAL_ERROR,
      },
    };
  }
  
  // Handle unknown errors
  return {
    success: false,
    error: {
      code: 'SERVER_INTERNAL_ERROR',
      message: ERROR_MESSAGES.SERVER.INTERNAL_ERROR,
    },
  };
}

// ============================================
// Error Logging
// ============================================

/**
 * Log error safely (without PHI)
 * 
 * @param error - Error to log
 * @param context - Additional context
 */
export function logError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  const errorInfo: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    ...(context && { context: sanitizeContext(context) }),
  };
  
  if (error instanceof AppError) {
    errorInfo.error = {
      name: error.name,
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
    };
  } else if (error instanceof Error) {
    errorInfo.error = {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    };
  } else {
    errorInfo.error = { unknown: String(error) };
  }
  
  // In production, send to logging service
  // In development, log to console
  if (process.env.NODE_ENV === 'production') {
    // Send to external logging service (e.g., DataDog, Splunk)
    // logger.send(errorInfo);
    console.error('[ERROR]', JSON.stringify(errorInfo));
  } else {
    console.error('[ERROR]', errorInfo);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  }
}

/**
 * Sanitize context to prevent PHI logging
 * 
 * @param context - Context object
 * @returns Sanitized context
 */
function sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = [
    'password', 'token', 'secret', 'ssn', 'socialSecurity',
    'email', 'phone', 'address', 'firstName', 'lastName',
    'dateOfBirth', 'medicalRecord', 'mrn'
  ];
  
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeContext(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

// ============================================
// Async Error Handling
// ============================================

/**
 * Wrap async function with error handling
 * 
 * @param fn - Async function to wrap
 * @returns Wrapped function
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args) as ReturnType<T>;
    } catch (error) {
      logError(error, { function: fn.name, args: 'REDACTED' });
      throw error;
    }
  };
}

/**
 * Try to execute function, return default on error
 * 
 * @param fn - Function to execute
 * @param defaultValue - Default value on error
 * @returns Result or default
 */
export function tryOrDefault<T>(
  fn: () => T,
  defaultValue: T
): T {
  try {
    return fn();
  } catch {
    return defaultValue;
  }
}

/**
 * Try to execute async function, return default on error
 * 
 * @param fn - Async function to execute
 * @param defaultValue - Default value on error
 * @returns Result or default
 */
export async function tryOrDefaultAsync<T>(
  fn: () => Promise<T>,
  defaultValue: T
): Promise<T> {
  try {
    return await fn();
  } catch {
    return defaultValue;
  }
}

// ============================================
// API Error Helpers
// ============================================

/**
 * Create error response for API routes
 * 
 * @param error - Error to respond with
 * @returns Response object
 */
export function createErrorResponse(error: unknown): Response {
  const statusCode = getErrorStatusCode(error);
  const body = formatErrorResponse(error);
  
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Assert condition, throw error if false
 * 
 * @param condition - Condition to check
 * @param error - Error to throw
 */
export function assert(
  condition: unknown,
  error: Error | string
): asserts condition {
  if (!condition) {
    if (typeof error === 'string') {
      throw new AppError('SERVER_INTERNAL_ERROR', error);
    }
    throw error;
  }
}

/**
 * Assert value exists, throw NotFoundError if null/undefined
 * 
 * @param value - Value to check
 * @param resource - Resource name
 * @param identifier - Resource identifier
 */
export function assertExists<T>(
  value: T | null | undefined,
  resource: string,
  identifier?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(resource, identifier);
  }
}
