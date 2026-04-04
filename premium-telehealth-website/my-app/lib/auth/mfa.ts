// TODO: Replace TOTP-based MFA with SMS verification code via Twilio
// Current: Patient scans QR code with authenticator app
// Desired: Patient receives 6-digit code via SMS to their registered phone number
// Requires: Twilio integration (lib/integrations/twilio.ts is implemented but not connected)

/**
 * MFA (Multi-Factor Authentication) Utilities
 * TOTP-based MFA for all user roles (patients, physicians, admins)
 *
 * Uses the otpauth library for TOTP generation and verification.
 * MFA secrets and backup codes are encrypted at rest using PHI encryption.
 *
 * 2026 HIPAA Security Rule mandates MFA for all ePHI access.
 *
 * @module lib/auth/mfa
 */

import { TOTP } from 'otpauth';
import { randomBytes } from 'crypto';
import { encryptPHI, decryptPHI } from '@/lib/encryption/phi';

// ============================================
// Constants
// ============================================

const ISSUER = 'RimalHealth';
const TOTP_PERIOD = 30; // seconds
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = 'SHA1';
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;

// ============================================
// Secret Generation
// ============================================

/**
 * Generate a new MFA secret and otpauth URI for QR code generation.
 *
 * The secret is returned in plaintext so the caller can display
 * the otpauth URI (e.g., as a QR code). It should be encrypted
 * with `encryptMFASecret()` before persisting to the database.
 *
 * @param email - User email, used as the account label in the URI
 * @returns Object with raw secret (base32) and otpauth URI
 */
export function generateMFASecret(email: string): {
  secret: string;
  otpauthUri: string;
} {
  const totp = new TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
  });

  return {
    secret: totp.secret.base32,
    otpauthUri: totp.toString(),
  };
}

// ============================================
// TOTP Verification
// ============================================

/**
 * Verify a 6-digit TOTP code against a secret.
 *
 * Allows a 1-step window (previous, current, next period)
 * to account for clock drift.
 *
 * @param secret - Base32-encoded TOTP secret
 * @param token  - 6-digit code from the authenticator app
 * @returns true if the code is valid
 */
export function verifyMFATOTP(secret: string, token: string): boolean {
  const totp = new TOTP({
    issuer: ISSUER,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: secret,
  });

  // validate() returns the time step difference or null if invalid.
  // window: 1 means we accept codes from the previous, current, and next period.
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

// ============================================
// Backup Codes
// ============================================

/**
 * Generate a set of single-use backup codes.
 *
 * Each code is an 8-character alphanumeric string.
 * These are returned in plaintext for display to the user
 * and should be encrypted with `encryptBackupCodes()` before storage.
 *
 * @returns Array of 10 backup codes
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const bytes = randomBytes(BACKUP_CODE_LENGTH);
    let code = '';
    for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
      code += charset[bytes[j] % charset.length];
    }
    codes.push(code);
  }

  return codes;
}

/**
 * Verify a backup code against the stored list.
 *
 * If valid the code is removed from the list so it cannot be reused.
 *
 * @param storedCodes - Array of remaining backup codes (plaintext)
 * @param code        - The code the user entered
 * @returns Object with `valid` flag and the updated `remainingCodes`
 */
export function verifyBackupCode(
  storedCodes: string[],
  code: string
): { valid: boolean; remainingCodes: string[] } {
  const normalizedCode = code.toLowerCase().trim();
  const index = storedCodes.findIndex(
    (c) => c.toLowerCase() === normalizedCode
  );

  if (index === -1) {
    return { valid: false, remainingCodes: storedCodes };
  }

  // Remove the used code
  const remainingCodes = [...storedCodes];
  remainingCodes.splice(index, 1);

  return { valid: true, remainingCodes };
}

// ============================================
// Encryption Helpers
// ============================================

/**
 * Encrypt an MFA secret for database storage.
 *
 * @param secret - Base32 TOTP secret
 * @returns Encrypted string safe for DB storage
 */
export function encryptMFASecret(secret: string): string {
  return encryptPHI(secret);
}

/**
 * Decrypt an MFA secret from database storage.
 *
 * @param encrypted - Encrypted MFA secret
 * @returns Plaintext base32 secret
 */
export function decryptMFASecret(encrypted: string): string {
  return decryptPHI(encrypted);
}

/**
 * Encrypt backup codes for database storage.
 *
 * Serialises the array to JSON and encrypts the result.
 *
 * @param codes - Array of plaintext backup codes
 * @returns Encrypted JSON string
 */
export function encryptBackupCodes(codes: string[]): string {
  return encryptPHI(JSON.stringify(codes));
}

/**
 * Decrypt backup codes from database storage.
 *
 * @param encrypted - Encrypted JSON string of backup codes
 * @returns Array of plaintext backup codes
 */
export function decryptBackupCodes(encrypted: string): string[] {
  const json = decryptPHI(encrypted);
  return JSON.parse(json) as string[];
}
