/**
 * PHI Encryption Utilities
 * Uses AES-256-GCM for HIPAA-compliant encryption
 * 
 * HIPAA Requirements:
 * - AES-256 encryption for data at rest
 * - Authentication tag for integrity verification
 * - Unique IV for each encryption operation
 * - Secure key management via environment variables
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

// Encryption format version for future compatibility
const ENCRYPTION_PREFIX = 'enc';
const ENCRYPTION_FORMAT_VERSION = 'v1';

// Cache for derived key to avoid repeated scrypt operations
let cachedKey: Buffer | null = null;
let cachedRawKey: string | null = null;

/**
 * Get encryption key from environment
 * Derives a 32-byte key using scrypt for enhanced security
 */
function getEncryptionKey(): Buffer {
  const key = process.env.PHI_ENCRYPTION_KEY;
  
  if (!key) {
    throw new Error('PHI_ENCRYPTION_KEY environment variable is required');
  }

  // Use cached key if available and raw key hasn't changed
  if (cachedKey && cachedRawKey === key) {
    return cachedKey;
  }

  // Validate key format (hex string of at least 32 characters)
  if (!/^[a-f0-9]{64,}$/i.test(key)) {
    throw new Error(
      'PHI_ENCRYPTION_KEY must be a 64+ character hex string (32+ bytes)'
    );
  }

  // Derive 32-byte key from provided key using scrypt
  // Using a fixed salt is acceptable here since the input key is already high-entropy
  const derivedKey = scryptSync(key, 'phi_encryption_salt_v1', KEY_LENGTH);
  
  // Cache for performance
  cachedKey = derivedKey;
  cachedRawKey = key;
  
  return derivedKey;
}

/**
 * Encrypt PHI data using AES-256-GCM
 * 
 * @param plaintext - The sensitive data to encrypt
 * @returns Encrypted string in format: enc:v1:salt:iv:authTag:ciphertext (base64)
 * 
 * @example
 * ```typescript
 * const encrypted = encryptPHI('patient@example.com');
 * // Returns: "enc:v1:abc123...:def456...:ghi789...:jkl012..."
 * ```
 */
export function encryptPHI(plaintext: string): string {
  if (!plaintext) {
    return plaintext;
  }

  // Skip if already encrypted (idempotent)
  if (isEncrypted(plaintext)) {
    return plaintext;
  }

  try {
    const key = getEncryptionKey();
    
    // Generate random salt and IV
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt
    const encryptedBuffer = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);
    
    // Get authentication tag for integrity
    const authTag = cipher.getAuthTag();
    
    // Combine: prefix:version:salt:iv:authTag:ciphertext (all base64)
    const result = [
      ENCRYPTION_PREFIX,
      ENCRYPTION_FORMAT_VERSION,
      salt.toString('base64'),
      iv.toString('base64'),
      authTag.toString('base64'),
      encryptedBuffer.toString('base64')
    ].join(':');
    
    return result;
  } catch (error) {
    throw new Error(
      `PHI encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Decrypt PHI data using AES-256-GCM
 * 
 * @param encrypted - The encrypted string in format: enc:v1:salt:iv:authTag:ciphertext
 * @returns Decrypted plaintext string
 * @throws Error if decryption fails or integrity check fails
 * 
 * @example
 * ```typescript
 * const decrypted = decryptPHI('enc:v1:abc123...:def456...');
 * // Returns: "patient@example.com"
 * ```
 */
export function decryptPHI(encrypted: string): string {
  if (!encrypted) {
    return encrypted;
  }

  // Return as-is if not encrypted
  if (!isEncrypted(encrypted)) {
    return encrypted;
  }

  try {
    // Parse the encrypted format
    const parts = encrypted.split(':');
    
    // Validate format
    if (parts.length !== 6) {
      throw new Error('Invalid encrypted format: expected 6 parts separated by ":"');
    }
    
    const [prefix, version, saltB64, ivB64, authTagB64, ciphertextB64] = parts;
    
    // Validate prefix
    if (prefix !== ENCRYPTION_PREFIX.replace(':', '')) {
      throw new Error('Invalid encryption prefix');
    }
    
    // Validate version (for future compatibility)
    if (version !== ENCRYPTION_FORMAT_VERSION) {
      throw new Error(`Unsupported encryption version: ${version}`);
    }
    
    // Decode base64 parts
    const salt = Buffer.from(saltB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');
    
    // Validate lengths
    if (salt.length !== SALT_LENGTH) {
      throw new Error(`Invalid salt length: expected ${SALT_LENGTH}, got ${salt.length}`);
    }
    if (iv.length !== IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`);
    }
    
    // Get key
    const key = getEncryptionKey();
    
    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    // Check if it's an integrity/authentication error
    if (error instanceof Error && error.message.includes('Unsupported state or unable to authenticate data')) {
      throw new Error('PHI decryption failed: Data integrity check failed - possible tampering');
    }
    throw new Error(
      `PHI decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if a value is encrypted
 * Used by middleware to prevent double-encryption
 * 
 * @param value - The value to check
 * @returns True if the value appears to be encrypted
 */
export function isEncrypted(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  
  if (!value.startsWith(ENCRYPTION_PREFIX + ':')) {
    return false;
  }
  
  const parts = value.split(':');
  return parts.length === 6 && parts[1] === ENCRYPTION_FORMAT_VERSION;
}

/**
 * Encrypt a JSON object by serializing and encrypting
 * Used for JSON fields in database models
 * 
 * @param data - The object to encrypt
 * @returns Encrypted JSON string
 */
export function encryptJSON<T extends Record<string, unknown>>(data: T | null): string | null {
  if (data === null || data === undefined) {
    return null;
  }
  
  const jsonString = JSON.stringify(data);
  return encryptPHI(jsonString);
}

/**
 * Decrypt a JSON object
 * Used for JSON fields in database models
 * 
 * @param encrypted - The encrypted JSON string
 * @returns Decrypted and parsed object
 */
export function decryptJSON<T extends Record<string, unknown>>(encrypted: string | null): T | null {
  if (encrypted === null || encrypted === undefined) {
    return null;
  }
  
  const decrypted = decryptPHI(encrypted);
  return JSON.parse(decrypted) as T;
}

/**
 * Rotate encryption key for a value
 * Decrypts with old key and re-encrypts with new key
 * Useful for key rotation scenarios
 * 
 * @param encrypted - The encrypted value
 * @param newKey - The new encryption key (temporary override)
 * @returns Re-encrypted value with new key
 */
export async function rotateEncryptionKey(
  encrypted: string, 
  newKey: string
): Promise<string> {
  // Store current cached key
  const currentCachedKey = cachedKey;
  const currentCachedRawKey = cachedRawKey;
  
  try {
    // Decrypt with current key
    const plaintext = decryptPHI(encrypted);
    
    // Temporarily override key
    cachedRawKey = newKey;
    cachedKey = scryptSync(newKey, 'phi_encryption_salt_v1', KEY_LENGTH);
    
    // Re-encrypt with new key
    const reencrypted = encryptPHI(plaintext);
    
    return reencrypted;
  } finally {
    // Restore cached key
    cachedKey = currentCachedKey;
    cachedRawKey = currentCachedRawKey;
  }
}

/**
 * Generate a secure encryption key
 * Helper function for generating keys during setup
 * 
 * @returns A 64-character hex string (32 bytes)
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Validate that encryption is properly configured
 * Throws error if configuration is invalid
 */
export function validateEncryptionConfig(): void {
  try {
    getEncryptionKey();
  } catch (error) {
    throw new Error(
      `Encryption configuration invalid: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
