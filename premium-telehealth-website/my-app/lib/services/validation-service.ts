/**
 * Validation Service
 * Centralized input validation and sanitization service
 * 
 * HIPAA Compliance:
 * - Prevents injection attacks that could compromise PHI
 * - Validates all inputs before processing
 * - Sanitizes outputs to prevent XSS
 * 
 * @module lib/services/validation-service
 */

import { z, ZodError, ZodSchema } from 'zod';
import { NextRequest } from 'next/server';
import {
  sanitizeText,
  sanitizeMultilineText,
  sanitizeObject,
  escapeHtml,
  stripHtml,
  sanitizeName,
  sanitizePhone,
  sanitizeEmail,
  truncateText,
} from '@/lib/validation/sanitization';

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

// ============================================================================
// Generic Validation
// ============================================================================

/**
 * Validate data against a Zod schema
 * 
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validation result with data or errors
 */
export async function validateWithSchema<T>(
  schema: ZodSchema<T>,
  data: unknown
): Promise<ValidationResult<T>> {
  try {
    const validatedData = await schema.parseAsync(data);
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return {
        success: false,
        errors,
      };
    }
    throw error;
  }
}

/**
 * Validate JSON body from NextRequest
 * 
 * @param request - Next.js request object
 * @param schema - Zod schema to validate against
 * @returns Validation result with parsed data or errors
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    const body = await request.json();
    return validateWithSchema(schema, body);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        success: false,
        errors: [{ field: 'body', message: 'Invalid JSON in request body' }],
      };
    }
    throw error;
  }
}

/**
 * Validate query parameters from URL
 * 
 * @param request - Next.js request object
 * @param schema - Zod schema to validate against
 * @returns Validation result with parsed params or errors
 */
export async function validateQueryParams<T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  const { searchParams } = new URL(request.url);
  const params: Record<string, unknown> = {};

  searchParams.forEach((value, key) => {
    // Try to parse as number if it looks like one
    if (/^\d+$/.test(value)) {
      params[key] = parseInt(value, 10);
    } else if (value === 'true') {
      params[key] = true;
    } else if (value === 'false') {
      params[key] = false;
    } else {
      params[key] = value;
    }
  });

  return validateWithSchema(schema, params);
}

// ============================================================================
// Specific Validations
// ============================================================================

/**
 * Validate UUID format
 * 
 * @param id - ID to validate
 * @returns Validation result
 */
export function validateUUID(id: string): ValidationResult<string> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(id)) {
    return {
      success: false,
      errors: [{ field: 'id', message: 'Invalid UUID format' }],
    };
  }
  
  return {
    success: true,
    data: id,
  };
}

/**
 * Validate email address
 * 
 * @param email - Email to validate
 * @returns Validation result
 */
export function validateEmail(email: string): ValidationResult<string> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return {
      success: false,
      errors: [{ field: 'email', message: 'Invalid email format' }],
    };
  }
  
  return {
    success: true,
    data: sanitizeEmail(email),
  };
}

/**
 * Validate phone number (US format)
 * 
 * @param phone - Phone number to validate
 * @returns Validation result
 */
export function validatePhone(phone: string): ValidationResult<string> {
  const phoneRegex = /^\+?1?\s*\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/;
  
  if (!phoneRegex.test(phone)) {
    return {
      success: false,
      errors: [{ field: 'phone', message: 'Invalid US phone number format' }],
    };
  }
  
  return {
    success: true,
    data: sanitizePhone(phone),
  };
}

/**
 * Validate ZIP code (US)
 * 
 * @param zip - ZIP code to validate
 * @returns Validation result
 */
export function validateZipCode(zip: string): ValidationResult<string> {
  const zipRegex = /^\d{5}(-\d{4})?$/;
  
  if (!zipRegex.test(zip)) {
    return {
      success: false,
      errors: [{ field: 'zip', message: 'Invalid ZIP code format' }],
    };
  }
  
  return {
    success: true,
    data: zip,
  };
}

/**
 * Validate date string (YYYY-MM-DD)
 * 
 * @param date - Date string to validate
 * @returns Validation result
 */
export function validateDate(date: string): ValidationResult<string> {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!dateRegex.test(date)) {
    return {
      success: false,
      errors: [{ field: 'date', message: 'Invalid date format (YYYY-MM-DD)' }],
    };
  }
  
  // Check if it's a valid date
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return {
      success: false,
      errors: [{ field: 'date', message: 'Invalid date value' }],
    };
  }
  
  return {
    success: true,
    data: date,
  };
}

// ============================================================================
// Sanitization
// ============================================================================

/**
 * Sanitize text input
 * 
 * @param input - Raw input string
 * @param maxLength - Maximum length
 * @returns Sanitized string
 */
export function sanitizeInput(input: string, maxLength: number = 10000): string {
  return sanitizeText(input, maxLength);
}

/**
 * Sanitize multi-line text input
 * 
 * @param input - Raw input string
 * @param maxLength - Maximum length
 * @returns Sanitized multi-line string
 */
export function sanitizeMultilineInput(input: string, maxLength: number = 10000): string {
  return sanitizeMultilineText(input, maxLength);
}

/**
 * Sanitize object values
 * 
 * @param obj - Object to sanitize
 * @param maxLength - Maximum string length
 * @returns Sanitized object
 */
export function sanitizeInputObject<T extends Record<string, unknown>>(
  obj: T,
  maxLength: number = 10000
): T {
  return sanitizeObject(obj, maxLength);
}

/**
 * Escape HTML for safe display
 * 
 * @param input - Raw input string
 * @returns HTML-escaped string
 */
export function escapeHtmlContent(input: string): string {
  return escapeHtml(input);
}

/**
 * Strip HTML tags from string
 * 
 * @param input - String with potential HTML
 * @returns String with HTML removed
 */
export function stripHtmlTags(input: string): string {
  return stripHtml(input);
}

/**
 * Sanitize name field
 * 
 * @param name - Raw name input
 * @returns Sanitized name
 */
export function sanitizeNameField(name: string): string {
  return sanitizeName(name);
}

// ============================================================================
// Security Validations
// ============================================================================

/**
 * Check if string contains potential SQL injection
 * Basic check for common SQL injection patterns
 * 
 * @param input - String to check
 * @returns True if suspicious patterns found
 */
export function containsSqlInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(\b(OR|AND)\b.*=.*)/i,
    /(--|#|\/\*|\*\/)/,
    /(\bUNION\b.*\bSELECT\b)/i,
    /(;|\|\||&&)/,
  ];
  
  return sqlPatterns.some((pattern) => pattern.test(input));
}

/**
 * Check if string contains potential XSS
 * Basic check for common XSS patterns
 * 
 * @param input - String to check
 * @returns True if suspicious patterns found
 */
export function containsXss(input: string): boolean {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
  ];
  
  return xssPatterns.some((pattern) => pattern.test(input));
}

/**
 * Validate that input is safe (no SQL injection or XSS)
 * 
 * @param input - String to validate
 * @param fieldName - Field name for error message
 * @returns Validation result
 */
export function validateSafety(input: string, fieldName: string = 'input'): ValidationResult<string> {
  if (containsSqlInjection(input)) {
    return {
      success: false,
      errors: [{ field: fieldName, message: 'Input contains potentially dangerous content' }],
    };
  }
  
  if (containsXss(input)) {
    return {
      success: false,
      errors: [{ field: fieldName, message: 'Input contains potentially dangerous content' }],
    };
  }
  
  return {
    success: true,
    data: input,
  };
}

// ============================================================================
// Service Export
// ============================================================================

/**
 * Validation Service class
 * Provides a consistent interface for all validation operations
 */
export class ValidationService {
  static async validateWithSchema<T>(schema: ZodSchema<T>, data: unknown): Promise<ValidationResult<T>> {
    return validateWithSchema(schema, data);
  }

  static async validateRequestBody<T>(
    request: NextRequest,
    schema: ZodSchema<T>
  ): Promise<ValidationResult<T>> {
    return validateRequestBody(request, schema);
  }

  static async validateQueryParams<T>(
    request: NextRequest,
    schema: ZodSchema<T>
  ): Promise<ValidationResult<T>> {
    return validateQueryParams(request, schema);
  }

  static validateUUID(id: string): ValidationResult<string> {
    return validateUUID(id);
  }

  static validateEmail(email: string): ValidationResult<string> {
    return validateEmail(email);
  }

  static validatePhone(phone: string): ValidationResult<string> {
    return validatePhone(phone);
  }

  static validateZipCode(zip: string): ValidationResult<string> {
    return validateZipCode(zip);
  }

  static validateDate(date: string): ValidationResult<string> {
    return validateDate(date);
  }

  static sanitizeInput(input: string, maxLength: number = 10000): string {
    return sanitizeInput(input, maxLength);
  }

  static sanitizeMultilineInput(input: string, maxLength: number = 10000): string {
    return sanitizeMultilineInput(input, maxLength);
  }

  static sanitizeInputObject<T extends Record<string, unknown>>(
    obj: T,
    maxLength: number = 10000
  ): T {
    return sanitizeInputObject(obj, maxLength);
  }

  static escapeHtmlContent(input: string): string {
    return escapeHtmlContent(input);
  }

  static stripHtmlTags(input: string): string {
    return stripHtmlTags(input);
  }

  static sanitizeNameField(name: string): string {
    return sanitizeNameField(name);
  }

  static containsSqlInjection(input: string): boolean {
    return containsSqlInjection(input);
  }

  static containsXss(input: string): boolean {
    return containsXss(input);
  }

  static validateSafety(input: string, fieldName: string = 'input'): ValidationResult<string> {
    return validateSafety(input, fieldName);
  }
}

export default ValidationService;
