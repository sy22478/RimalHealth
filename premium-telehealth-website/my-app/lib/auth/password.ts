/**
 * Password Hashing Utilities
 * Uses bcrypt with 12 rounds for HIPAA-compliant security
 * 
 * HIPAA Compliance:
 * - bcrypt with high work factor (12 rounds)
 * - Async operations to prevent blocking
 * - Proper error handling
 * - No plain text password storage
 */

import bcrypt from 'bcrypt';

// ============================================
// Configuration
// ============================================

/**
 * Salt rounds for bcrypt
 * 12 rounds = ~250ms on modern hardware (good balance of security/performance)
 * 
 * HIPAA Recommendation: Use at least 10+ rounds
 * OWASP Recommendation: Use at least 10 rounds
 */
const SALT_ROUNDS = 12;

// ============================================
// Password Hashing
// ============================================

/**
 * Hash a password using bcrypt
 * 
 * Uses 12 salt rounds for strong security. This is a computationally
 * expensive operation (intentionally) to resist brute-force attacks.
 * 
 * @param password - Plain text password to hash
 * @returns Hashed password string (includes salt)
 * @throws Error if hashing fails
 * 
 * @example
 * ```typescript
 * // During user registration
 * const hashedPassword = await hashPassword(password);
 * await prisma.user.create({
 *   data: {
 *     email,
 *     passwordHash: hashedPassword,
 *   }
 * });
 * ```
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // Generate salt and hash in one operation
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
  } catch (error) {
    throw new Error(
      `Password hashing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================
// Password Verification
// ============================================

/**
 * Verify a password against a hash
 * 
 * Compares a plain text password with a bcrypt hash.
 * Uses constant-time comparison to prevent timing attacks.
 * 
 * @param password - Plain text password to verify
 * @param hash - Stored bcrypt hash from database
 * @returns true if password matches, false otherwise
 * @throws Error if verification fails
 * 
 * @example
 * ```typescript
 * // During login
 * const user = await prisma.user.findUnique({ where: { email } });
 * if (!user) {
 *   // Don't reveal if email exists
 *   throw new Error('Invalid credentials');
 * }
 * 
 * const isValid = await verifyPassword(password, user.passwordHash);
 * if (!isValid) {
 *   // Log failed attempt for security monitoring
 *   await logAuditEvent('LOGIN_FAILED', { email });
 *   throw new Error('Invalid credentials');
 * }
 * 
 * // Password verified - proceed with login
 * ```
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    throw new Error(
      `Password verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================
// Security Utilities
// ============================================

/**
 * Check if a password meets minimum strength requirements
 * 
 * HIPAA requires strong passwords. This enforces:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * 
 * @param password - Password to validate
 * @returns Object with validity and reasons for rejection
 * 
 * @example
 * ```typescript
 * const result = validatePasswordStrength(password);
 * if (!result.isValid) {
 *   return res.status(400).json({
 *     error: 'Password too weak',
 *     requirements: result.requirements
 *   });
 * }
 * ```
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  requirements: string[];
} {
  const requirements: string[] = [];

  if (password.length < 12) {
    requirements.push('At least 12 characters');
  }

  if (!/[A-Z]/.test(password)) {
    requirements.push('At least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    requirements.push('At least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    requirements.push('At least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    requirements.push('At least one special character');
  }

  return {
    isValid: requirements.length === 0,
    requirements,
  };
}

/**
 * Generate a secure random password
 * 
 * Useful for generating temporary passwords or reset tokens.
 * Creates a password that meets strength requirements.
 * 
 * @param length - Password length (default: 16, minimum: 12)
 * @returns Generated password string
 * 
 * @example
 * ```typescript
 * // Generate temporary password for new physician account
 * const tempPassword = generateSecurePassword(16);
 * const hashedPassword = await hashPassword(tempPassword);
 * // Send tempPassword to user via secure channel
 * ```
 */
export function generateSecurePassword(length: number = 16): string {
  const minLength = 12;
  const finalLength = Math.max(length, minLength);

  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const allChars = uppercase + lowercase + numbers + special;

  // Ensure at least one of each required type
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill remaining length with random characters
  for (let i = 4; i < finalLength; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}

// ============================================
// Constants for External Use
// ============================================

/** Number of salt rounds used by bcrypt */
export const BCRYPT_SALT_ROUNDS = SALT_ROUNDS;

/** Minimum password length required */
export const MIN_PASSWORD_LENGTH = 12;
