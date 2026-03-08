/**
 * Validation Helper Utilities
 * 
 * Provides common validation functions for forms, inputs, and data integrity.
 * HIPAA-compliant validators for medical and personal information.
 * 
 * @module lib/utils/validation-helpers
 */

import { ERROR_MESSAGES, EMAIL_REGEX, PHONE_REGEX, ZIP_REGEX, SSN_REGEX } from '@/lib/constants';
import { isValidMedicalDate, parseDate } from './date-helpers';

// ============================================
// Types
// ============================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface ValidationRule<T = string> {
  validate: (value: T) => boolean;
  message: string;
}

export interface FieldValidation {
  field: string;
  value: unknown;
  result: ValidationResult;
}

// ============================================
// String Validations
// ============================================

/**
 * Validate required field
 * 
 * @param value - Value to validate
 * @returns Validation result
 */
export function validateRequired(value: unknown): ValidationResult {
  if (value === undefined || value === null) {
    return { valid: false, error: ERROR_MESSAGES.VALIDATION.REQUIRED };
  }
  
  if (typeof value === 'string' && value.trim() === '') {
    return { valid: false, error: ERROR_MESSAGES.VALIDATION.REQUIRED };
  }
  
  if (Array.isArray(value) && value.length === 0) {
    return { valid: false, error: ERROR_MESSAGES.VALIDATION.REQUIRED };
  }
  
  return { valid: true };
}

/**
 * Validate email address
 * 
 * @param email - Email to validate
 * @returns Validation result
 */
export function validateEmail(email: string | null | undefined): ValidationResult {
  if (!email || email.trim() === '') {
    return { valid: false, error: ERROR_MESSAGES.VALIDATION.INVALID_EMAIL };
  }
  
  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, error: ERROR_MESSAGES.VALIDATION.INVALID_EMAIL };
  }
  
  return { valid: true };
}

/**
 * Validate phone number
 * 
 * @param phone - Phone number to validate
 * @returns Validation result
 */
export function validatePhone(phone: string | null | undefined): ValidationResult {
  if (!phone || phone.trim() === '') {
    return { valid: false, error: ERROR_MESSAGES.VALIDATION.INVALID_PHONE };
  }
  
  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
  
  if (!PHONE_REGEX.test(cleaned)) {
    return { valid: false, error: ERROR_MESSAGES.VALIDATION.INVALID_PHONE };
  }
  
  return { valid: true };
}

/**
 * Validate US ZIP code
 * 
 * @param zip - ZIP code to validate
 * @returns Validation result
 */
export function validateZipCode(zip: string | null | undefined): ValidationResult {
  if (!zip || zip.trim() === '') {
    return { valid: false, error: ERROR_MESSAGES.VALIDATION.INVALID_ZIP };
  }
  
  if (!ZIP_REGEX.test(zip)) {
    return { valid: false, error: ERROR_MESSAGES.VALIDATION.INVALID_ZIP };
  }
  
  return { valid: true };
}

/**
 * Validate SSN
 * 
 * @param ssn - SSN to validate
 * @returns Validation result
 */
export function validateSSN(ssn: string | null | undefined): ValidationResult {
  if (!ssn || ssn.trim() === '') {
    return { valid: true }; // SSN is optional
  }
  
  // Remove dashes
  const cleaned = ssn.replace(/-/g, '');
  
  if (!SSN_REGEX.test(cleaned)) {
    return { valid: false, error: ERROR_MESSAGES.VALIDATION.INVALID_SSN };
  }
  
  // Check for invalid SSNs
  if (cleaned.startsWith('000') || cleaned.startsWith('666')) {
    return { valid: false, error: ERROR_MESSAGES.VALIDATION.INVALID_SSN };
  }
  
  if (cleaned.substring(3, 5) === '00') {
    return { valid: false, error: ERROR_MESSAGES.VALIDATION.INVALID_SSN };
  }
  
  if (cleaned.substring(5) === '0000') {
    return { valid: false, error: ERROR_MESSAGES.VALIDATION.INVALID_SSN };
  }
  
  return { valid: true };
}

/**
 * Validate string length
 * 
 * @param value - String to validate
 * @param min - Minimum length
 * @param max - Maximum length
 * @returns Validation result
 */
export function validateLength(
  value: string | null | undefined,
  min: number = 0,
  max: number = Infinity
): ValidationResult {
  if (!value) {
    return { valid: false, error: `Must be at least ${min} characters` };
  }
  
  if (value.length < min) {
    return { valid: false, error: `Must be at least ${min} characters` };
  }
  
  if (value.length > max) {
    return { valid: false, error: `Must not exceed ${max} characters` };
  }
  
  return { valid: true };
}

/**
 * Validate string matches pattern
 * 
 * @param value - String to validate
 * @param pattern - Regex pattern
 * @param message - Error message
 * @returns Validation result
 */
export function validatePattern(
  value: string | null | undefined,
  pattern: RegExp,
  message: string = 'Invalid format'
): ValidationResult {
  if (!value) {
    return { valid: false, error: message };
  }
  
  if (!pattern.test(value)) {
    return { valid: false, error: message };
  }
  
  return { valid: true };
}

// ============================================
// California-Specific Validations
// ============================================

/**
 * Validate California ZIP code
 * 
 * @param zip - ZIP code to validate
 * @returns Validation result
 */
export function validateCaliforniaZip(zip: string | null | undefined): ValidationResult {
  const baseValidation = validateZipCode(zip);
  if (!baseValidation.valid) return baseValidation;
  
  // California ZIP codes start with 900-961 (with some gaps)
  const caPrefixes = ['900', '901', '902', '903', '904', '905', '906', '907', '908', '909', 
    '910', '911', '912', '913', '914', '915', '916', '917', '918', '919', '920', '921', '922',
    '923', '924', '925', '926', '927', '928', '930', '931', '932', '933', '934', '935', '936',
    '937', '938', '939', '940', '941', '942', '943', '944', '945', '946', '947', '948', '949',
    '950', '951', '952', '953', '954', '955', '956', '957', '958', '959', '960', '961'];
  
  const prefix = zip?.substring(0, 3);
  if (!prefix || !caPrefixes.includes(prefix)) {
    return { valid: false, error: ERROR_MESSAGES.VALIDATION.CALIFORNIA_ONLY };
  }
  
  return { valid: true };
}

/**
 * Validate California state code
 * 
 * @param state - State code to validate
 * @returns Validation result
 */
export function validateCaliforniaState(state: string | null | undefined): ValidationResult {
  if (!state) {
    return { valid: false, error: 'State is required' };
  }
  
  if (state.toUpperCase() !== 'CA') {
    return { valid: false, error: ERROR_MESSAGES.VALIDATION.CALIFORNIA_ONLY };
  }
  
  return { valid: true };
}

// ============================================
// Medical Validations
// ============================================

/**
 * Validate date of birth
 * 
 * @param dob - Date of birth to validate
 * @returns Validation result
 */
export function validateDateOfBirth(dob: string | Date | null | undefined): ValidationResult {
  const dateValidation = isValidMedicalDate(dob);
  if (!dateValidation.valid) {
    return { valid: false, error: dateValidation.error };
  }
  
  const parsed = parseDate(dob);
  if (!parsed) {
    return { valid: false, error: 'Invalid date of birth' };
  }
  
  // Check age
  const now = new Date();
  const age = now.getFullYear() - parsed.getFullYear();
  
  if (age > 150) {
    return { valid: false, error: 'Please enter a valid date of birth' };
  }
  
  if (parsed > now) {
    return { valid: false, error: 'Date of birth cannot be in the future' };
  }
  
  if (age < 18) {
    return { valid: false, error: 'You must be 18 or older to use this service' };
  }
  
  return { valid: true };
}

/**
 * Validate medical record number
 * 
 * @param mrn - MRN to validate
 * @returns Validation result
 */
export function validateMRN(mrn: string | null | undefined): ValidationResult {
  if (!mrn || mrn.trim() === '') {
    return { valid: false, error: 'Medical record number is required' };
  }
  
  // MRN typically alphanumeric, 5-20 characters
  if (!/^[A-Z0-9]{5,20}$/i.test(mrn)) {
    return { valid: false, error: 'Invalid medical record number format' };
  }
  
  return { valid: true };
}

// ============================================
// Numeric Validations
// ============================================

/**
 * Validate number is within range
 * 
 * @param value - Number to validate
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Validation result
 */
export function validateNumberRange(
  value: number | null | undefined,
  min: number = -Infinity,
  max: number = Infinity
): ValidationResult {
  if (value === undefined || value === null) {
    return { valid: false, error: 'Value is required' };
  }
  
  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: false, error: 'Must be a valid number' };
  }
  
  if (value < min) {
    return { valid: false, error: `Must be at least ${min}` };
  }
  
  if (value > max) {
    return { valid: false, error: `Must not exceed ${max}` };
  }
  
  return { valid: true };
}

/**
 * Validate positive number
 * 
 * @param value - Number to validate
 * @returns Validation result
 */
export function validatePositiveNumber(value: number | null | undefined): ValidationResult {
  return validateNumberRange(value, 0, Infinity);
}

// ============================================
// Array Validations
// ============================================

/**
 * Validate array is not empty
 * 
 * @param value - Array to validate
 * @returns Validation result
 */
export function validateNonEmptyArray<T>(value: T[] | null | undefined): ValidationResult {
  if (!value || !Array.isArray(value)) {
    return { valid: false, error: 'Must be a valid array' };
  }
  
  if (value.length === 0) {
    return { valid: false, error: 'At least one item is required' };
  }
  
  return { valid: true };
}

/**
 * Validate array length
 * 
 * @param value - Array to validate
 * @param min - Minimum items
 * @param max - Maximum items
 * @returns Validation result
 */
export function validateArrayLength<T>(
  value: T[] | null | undefined,
  min: number = 0,
  max: number = Infinity
): ValidationResult {
  if (!value || !Array.isArray(value)) {
    return { valid: false, error: 'Must be a valid array' };
  }
  
  if (value.length < min) {
    return { valid: false, error: `At least ${min} item${min !== 1 ? 's' : ''} required` };
  }
  
  if (value.length > max) {
    return { valid: false, error: `No more than ${max} items allowed` };
  }
  
  return { valid: true };
}

// ============================================
// Complex Validations
// ============================================

/**
 * Validate all fields in an object
 * 
 * @param validations - Array of field validations
 * @returns Overall result and individual results
 */
export function validateObject(validations: FieldValidation[]): {
  valid: boolean;
  errors: Record<string, string>;
  results: FieldValidation[];
} {
  const errors: Record<string, string> = {};
  
  for (const validation of validations) {
    if (!validation.result.valid && validation.result.error) {
      errors[validation.field] = validation.result.error;
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    results: validations,
  };
}

/**
 * Create validation chain
 * 
 * @param value - Value to validate
 * @param validators - Array of validation functions
 * @returns First error or valid result
 */
export function validateChain<T>(
  value: T,
  validators: ((value: T) => ValidationResult)[]
): ValidationResult {
  for (const validator of validators) {
    const result = validator(value);
    if (!result.valid) {
      return result;
    }
  }
  
  return { valid: true };
}

// ============================================
// Form-Specific Validations
// ============================================

/**
 * Validate passwords match
 * 
 * @param password - Password
 * @param confirmPassword - Confirmation
 * @returns Validation result
 */
export function validatePasswordsMatch(
  password: string | null | undefined,
  confirmPassword: string | null | undefined
): ValidationResult {
  if (!password || !confirmPassword) {
    return { valid: false, error: 'Both password fields are required' };
  }
  
  if (password !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match' };
  }
  
  return { valid: true };
}

/**
 * Validate terms acceptance
 * 
 * @param accepted - Whether terms are accepted
 * @returns Validation result
 */
export function validateTermsAccepted(accepted: boolean): ValidationResult {
  if (!accepted) {
    return { valid: false, error: 'You must accept the terms and conditions' };
  }
  
  return { valid: true };
}

// ============================================
// Preset Validation Rules
// ============================================

/** Common validation rules */
export const ValidationRules = {
  required: (): ValidationRule => ({
    validate: (value) => validateRequired(value).valid,
    message: ERROR_MESSAGES.VALIDATION.REQUIRED,
  }),
  
  email: (): ValidationRule<string> => ({
    validate: (value) => validateEmail(value).valid,
    message: ERROR_MESSAGES.VALIDATION.INVALID_EMAIL,
  }),
  
  phone: (): ValidationRule<string> => ({
    validate: (value) => validatePhone(value).valid,
    message: ERROR_MESSAGES.VALIDATION.INVALID_PHONE,
  }),
  
  minLength: (min: number): ValidationRule<string> => ({
    validate: (value) => (value?.length || 0) >= min,
    message: `Must be at least ${min} characters`,
  }),
  
  maxLength: (max: number): ValidationRule<string> => ({
    validate: (value) => (value?.length || 0) <= max,
    message: `Must not exceed ${max} characters`,
  }),
  
  pattern: (regex: RegExp, message: string): ValidationRule<string> => ({
    validate: (value) => regex.test(value || ''),
    message,
  }),
  
  californiaZip: (): ValidationRule<string> => ({
    validate: (value) => validateCaliforniaZip(value).valid,
    message: ERROR_MESSAGES.VALIDATION.CALIFORNIA_ONLY,
  }),
};

// ============================================
// Sanitization
// ============================================

/**
 * Sanitize input for display
 * 
 * @param value - Value to sanitize
 * @returns Sanitized string
 */
export function sanitizeInput(value: unknown): string {
  if (value === null || value === undefined) return '';
  
  const str = String(value);
  
  // Remove control characters
  return str.replace(/[\x00-\x1F\x7F]/g, '');
}

/**
 * Normalize string for comparison
 * 
 * @param value - Value to normalize
 * @returns Normalized string
 */
export function normalizeForComparison(value: unknown): string {
  return sanitizeInput(value).toLowerCase().trim();
}
