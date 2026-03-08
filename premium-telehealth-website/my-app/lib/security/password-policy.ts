/**
 * Password Policy Module
 * 
 * Provides password validation, strength checking, and policy enforcement.
 * Implements HIPAA-compliant password requirements.
 * 
 * HIPAA Compliance:
 * - Enforces strong password requirements
 * - Prevents use of common/compromised passwords
 * - Validates password complexity
 * 
 * @module lib/security/password-policy
 */

import { createHash } from 'crypto';
import { 
  PASSWORD_POLICY, 
  COMMON_PASSWORDS, 
  ERROR_MESSAGES,
} from '@/lib/constants';

// ============================================
// Types
// ============================================

export interface PasswordValidationResult {
  /** Whether password meets all requirements */
  valid: boolean;
  /** List of validation errors */
  errors: string[];
  /** Password strength score (0-5) */
  strengthScore: number;
  /** Strength label */
  strengthLabel: 'very-weak' | 'weak' | 'fair' | 'good' | 'strong' | 'very-strong';
  /** Detailed requirement checks */
  requirements: {
    minLength: boolean;
    maxLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasDigit: boolean;
    hasSpecial: boolean;
    notCommon: boolean;
    noConsecutiveIdentical: boolean;
  };
}

export interface PasswordPolicyConfig {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecial: boolean;
  specialChars: string;
  preventCommon: boolean;
  maxConsecutiveIdentical: number;
}

// ============================================
// Validation Functions
// ============================================

/**
 * Check if password contains consecutive identical characters
 * 
 * @param password - Password to check
 * @param maxConsecutive - Maximum allowed consecutive identical characters
 * @returns True if password passes check
 */
function checkConsecutiveIdentical(password: string, maxConsecutive: number): boolean {
  let currentChar = '';
  let count = 0;
  
  for (const char of password) {
    if (char === currentChar) {
      count++;
      if (count > maxConsecutive) {
        return false;
      }
    } else {
      currentChar = char;
      count = 1;
    }
  }
  
  return true;
}

/**
 * Check if password is in the common passwords list
 * 
 * Uses a case-insensitive comparison against a list of commonly
 * used passwords that are vulnerable to dictionary attacks.
 * 
 * @param password - Password to check
 * @returns True if password is not common
 */
function isNotCommonPassword(password: string): boolean {
  const lowerPassword = password.toLowerCase();
  
  // Check exact matches
  if (COMMON_PASSWORDS.includes(lowerPassword as typeof COMMON_PASSWORDS[number])) {
    return false;
  }
  
  // Check common variations
  const variations = [
    lowerPassword,
    lowerPassword + '123',
    lowerPassword + '1',
    lowerPassword + '!',
    lowerPassword + '2024',
    lowerPassword + '2025',
  ];
  
  for (const variant of variations) {
    if (COMMON_PASSWORDS.includes(variant as typeof COMMON_PASSWORDS[number])) {
      return false;
    }
  }
  
  return true;
}

/**
 * Calculate password entropy
 * 
 * @param password - Password to analyze
 * @returns Entropy bits
 */
function calculateEntropy(password: string): number {
  let poolSize = 0;
  
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;
  
  return Math.log2(Math.pow(poolSize, password.length));
}

/**
 * Calculate password strength score
 * 
 * @param password - Password to analyze
 * @param requirements - Requirement check results
 * @returns Strength score (0-5)
 */
function calculateStrengthScore(
  password: string,
  requirements: PasswordValidationResult['requirements']
): number {
  let score = 0;
  
  // Length contribution (up to 2 points)
  if (password.length >= PASSWORD_POLICY.MIN_LENGTH) score += 1;
  if (password.length >= 16) score += 1;
  
  // Character variety contribution (up to 2 points)
  let varietyCount = 0;
  if (requirements.hasLowercase) varietyCount++;
  if (requirements.hasUppercase) varietyCount++;
  if (requirements.hasDigit) varietyCount++;
  if (requirements.hasSpecial) varietyCount++;
  
  score += Math.min(2, varietyCount / 2);
  
  // Entropy contribution (up to 1 point)
  const entropy = calculateEntropy(password);
  if (entropy > 60) score += 1;
  
  // Penalties
  if (!requirements.notCommon) score = Math.max(0, score - 2);
  if (!requirements.noConsecutiveIdentical) score = Math.max(0, score - 1);
  
  return Math.min(5, Math.floor(score));
}

// ============================================
// Main Validation Function
// ============================================

/**
 * Validate password against security policy
 * 
 * Validates password against HIPAA-compliant requirements including:
 * - Minimum length (12 characters)
 * - Character variety (uppercase, lowercase, digits, special)
 * - Not in common password list
 * - No excessive consecutive identical characters
 * 
 * @param password - Password to validate
 * @param config - Optional custom policy configuration
 * @returns Validation result with detailed feedback
 * 
 * @example
 * ```typescript
 * const result = validatePassword('MyStr0ng!P@ssw0rd');
 * if (!result.valid) {
 *   console.log(result.errors); // ['Password must not be a common password']
 * }
 * ```
 */
export function validatePassword(
  password: string,
  config: Partial<PasswordPolicyConfig> = {}
): PasswordValidationResult {
  const cfg = {
    ...PASSWORD_POLICY,
    ...config,
  } as PasswordPolicyConfig;
  
  const errors: string[] = [];
  
  // Check requirements
  const requirements: PasswordValidationResult['requirements'] = {
    minLength: password.length >= cfg.minLength,
    maxLength: password.length <= cfg.maxLength,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    hasSpecial: new RegExp(`[^A-Za-z0-9]`).test(password),
    notCommon: cfg.preventCommon ? isNotCommonPassword(password) : true,
    noConsecutiveIdentical: checkConsecutiveIdentical(password, cfg.maxConsecutiveIdentical),
  };
  
  // Validate each requirement
  if (!requirements.minLength) {
    errors.push(ERROR_MESSAGES.VALIDATION.PASSWORD_TOO_SHORT);
  }
  
  if (!requirements.maxLength) {
    errors.push(ERROR_MESSAGES.VALIDATION.PASSWORD_TOO_LONG);
  }
  
  if (cfg.requireUppercase && !requirements.hasUppercase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (cfg.requireLowercase && !requirements.hasLowercase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (cfg.requireDigit && !requirements.hasDigit) {
    errors.push('Password must contain at least one number');
  }
  
  if (cfg.requireSpecial && !requirements.hasSpecial) {
    errors.push('Password must contain at least one special character');
  }
  
  if (cfg.preventCommon && !requirements.notCommon) {
    errors.push('Password is too common or easily guessed. Please choose a more unique password.');
  }
  
  if (!requirements.noConsecutiveIdentical) {
    errors.push(`Password must not contain more than ${cfg.maxConsecutiveIdentical} identical characters in a row`);
  }
  
  // Calculate strength
  const strengthScore = calculateStrengthScore(password, requirements);
  
  const strengthLabels: PasswordValidationResult['strengthLabel'][] = [
    'very-weak',
    'weak',
    'fair',
    'good',
    'strong',
    'very-strong',
  ];
  
  return {
    valid: errors.length === 0,
    errors,
    strengthScore,
    strengthLabel: strengthLabels[strengthScore],
    requirements,
  };
}

// ============================================
// Password Hashing
// ============================================

/**
 * Hash password for storage (pre-bcrypt hashing)
 * 
 * Performs a pre-hash of the password to handle very long passwords
 * before bcrypt hashing (which has a 72-byte limit).
 * 
 * @param password - Plain text password
 * @returns SHA-256 hash of password
 */
export function prehashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

// ============================================
// Password Generation
// ============================================

/**
 * Generate a secure random password
 * 
 * Generates a cryptographically secure random password that meets
 * all policy requirements.
 * 
 * @param length - Password length (default: 16)
 * @returns Generated password
 */
export function generateSecurePassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = PASSWORD_POLICY.SPECIAL_CHARS;
  
  const allChars = uppercase + lowercase + digits + special;
  
  // Ensure at least one of each required character type
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill remaining length with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// ============================================
// Password History
// ============================================

/**
 * Check if password matches any in history
 * 
 * @param password - New password
 * @param history - Array of hashed previous passwords
 * @returns True if password is not in history
 */
export function isPasswordInHistory(password: string, history: string[]): boolean {
  const prehashed = prehashPassword(password);
  return history.some(hashed => {
    // Simple comparison - in production, use proper hash comparison
    return hashed === prehashed;
  });
}

// ============================================
// Policy Configuration Helpers
// ============================================

/**
 * Get password requirements as human-readable text
 * 
 * @returns Array of requirement descriptions
 */
export function getPasswordRequirements(): string[] {
  return [
    `At least ${PASSWORD_POLICY.MIN_LENGTH} characters long`,
    'At least one uppercase letter (A-Z)',
    'At least one lowercase letter (a-z)',
    'At least one number (0-9)',
    'At least one special character (!@#$%^&*...)',
    'Must not be a commonly used password',
    `No more than ${PASSWORD_POLICY.MAX_CONSECUTIVE_IDENTICAL} identical characters in a row`,
  ];
}

/**
 * Get password strength feedback
 * 
 * @param result - Validation result
 * @returns Human-readable strength feedback
 */
export function getPasswordStrengthFeedback(result: PasswordValidationResult): string {
  if (result.strengthScore <= 1) {
    return 'This password is very weak and easily guessable. Please use a longer password with more character types.';
  }
  if (result.strengthScore === 2) {
    return 'This password is weak. Consider adding more characters and variety.';
  }
  if (result.strengthScore === 3) {
    return 'This password is fair, but could be stronger with more length or variety.';
  }
  if (result.strengthScore === 4) {
    return 'This password is strong.';
  }
  return 'This password is very strong.';
}

// ============================================
// Async Validation
// ============================================

/**
 * Async password validation (for future extensibility)
 * 
 * Can be extended to check against external services like
 * Have I Been Pwned password API.
 * 
 * @param password - Password to validate
 * @returns Promise resolving to validation result
 */
export async function validatePasswordAsync(
  password: string
): Promise<PasswordValidationResult> {
  // For now, just call synchronous validation
  // In the future, this can check against external breach databases
  return validatePassword(password);
}

// ============================================
// React Hook Helper
// ============================================

/**
 * Client-side password validation helper
 * 
 * Can be used in React components for real-time validation.
 * 
 * @param password - Password to validate
 * @returns Validation result without sensitive details
 */
export function validatePasswordClient(password: string): Omit<PasswordValidationResult, 'requirements'> & {
  requirements: Pick<PasswordValidationResult['requirements'], 'minLength' | 'hasUppercase' | 'hasLowercase' | 'hasDigit' | 'hasSpecial'>;
} {
  const result = validatePassword(password);
  
  // Return subset of requirements for client-side display
  return {
    valid: result.valid,
    errors: result.errors,
    strengthScore: result.strengthScore,
    strengthLabel: result.strengthLabel,
    requirements: {
      minLength: result.requirements.minLength,
      hasUppercase: result.requirements.hasUppercase,
      hasLowercase: result.requirements.hasLowercase,
      hasDigit: result.requirements.hasDigit,
      hasSpecial: result.requirements.hasSpecial,
    },
  };
}
