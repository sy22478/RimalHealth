import { randomBytes } from 'crypto';
import bcrypt from 'bcrypt';

/**
 * Result of generating a new physician secret key
 */
export interface SecretKeyResult {
  /** The plaintext secret key (shown once to user) */
  key: string;
  /** The bcrypt hash of the key (stored in database) */
  hash: string;
  /** The expiration date (7 days from generation) */
  expiryDate: Date;
}

/**
 * Number of bcrypt rounds for hashing secret keys
 */
const BCRYPT_ROUNDS = 12;

/**
 * Secret key validity period in days
 */
const KEY_VALIDITY_DAYS = 7;

/**
 * Generates a cryptographically secure secret key for physician onboarding.
 * 
 * The key format is: RH-MD-XXXX-XXXX-XXXX-XXXX
 * - RH-MD: Prefix indicating Rimal Health Medical Doctor
 * - XXXX: 4-character alphanumeric segments (A-Z, a-z, 0-9)
 * - Total length: 16 characters + 6 hyphens = 22 characters
 * 
 * @returns SecretKeyResult containing the key, its hash, and expiry date
 */
export function generatePhysicianSecretKey(): SecretKeyResult {
  // Generate 32 bytes of random data
  const randomBuffer = randomBytes(32);

  // Convert to alphanumeric string (A-Z, a-z, 0-9)
  const alphanumericChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let rawKey = '';

  // Use the random bytes to select characters from our set
  for (let i = 0; i < 16; i++) {
    // Use modulo to map random byte to our character set
    const index = randomBuffer[i] % alphanumericChars.length;
    rawKey += alphanumericChars[index];
  }

  // Format the key with hyphens and uppercase
  const formattedKey = formatSecretKey(rawKey);

  // Hash the key using bcrypt with 12 rounds
  const hash = bcrypt.hashSync(formattedKey, BCRYPT_ROUNDS);

  // Set expiry to 7 days from now
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + KEY_VALIDITY_DAYS);

  return {
    key: formattedKey,
    hash,
    expiryDate,
  };
}

/**
 * Verifies a provided secret key against a stored bcrypt hash.
 * 
 * @param providedKey - The plaintext key provided by the user
 * @param storedHash - The bcrypt hash stored in the database
 * @returns Promise<boolean> - True if the key matches the hash
 */
export async function verifySecretKey(
  providedKey: string,
  storedHash: string
): Promise<boolean> {
  // Normalize the provided key: uppercase and trim
  const normalizedKey = providedKey.trim().toUpperCase();

  try {
    return await bcrypt.compare(normalizedKey, storedHash);
  } catch {
    // Return false if bcrypt throws (invalid hash format, etc.)
    return false;
  }
}

/**
 * Checks if a secret key has expired.
 * 
 * @param expiryDate - The expiration date of the key
 * @returns boolean - True if the key has expired
 */
export function isSecretKeyExpired(expiryDate: Date): boolean {
  const now = new Date();
  return now > expiryDate;
}

/**
 * Formats a raw alphanumeric string into the secret key format.
 * 
 * Format: RH-MD-XXXX-XXXX-XXXX-XXXX
 * - Adds "RH-MD-" prefix
 * - Groups remaining characters into 4-character segments
 * - Separates segments with hyphens
 * - Uppercases all letters
 * 
 * @param rawKey - The raw alphanumeric string (should be 16 characters)
 * @returns The formatted secret key
 */
function formatSecretKey(rawKey: string): string {
  // Uppercase the raw key
  const upperKey = rawKey.toUpperCase();

  // Split into 4-character segments
  const segment1 = upperKey.slice(0, 4);
  const segment2 = upperKey.slice(4, 8);
  const segment3 = upperKey.slice(8, 12);
  const segment4 = upperKey.slice(12, 16);

  // Join with RH-MD prefix and hyphens
  return `RH-MD-${segment1}-${segment2}-${segment3}-${segment4}`;
}

/**
 * Validates the format of a secret key.
 * 
 * Expected format: RH-MD-XXXX-XXXX-XXXX-XXXX
 * where X is alphanumeric (A-Z, 0-9)
 * 
 * @param key - The key to validate
 * @returns boolean - True if the key format is valid
 */
export function isValidSecretKeyFormat(key: string): boolean {
  const pattern = /^RH-MD-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  return pattern.test(key.trim().toUpperCase());
}

/**
 * Normalizes a user-provided secret key.
 * Removes extra spaces, uppercases, and ensures consistent formatting.
 * 
 * @param key - The key to normalize
 * @returns The normalized key
 */
export function normalizeSecretKey(key: string): string {
  return key.trim().toUpperCase();
}
