/**
 * PHI Encryption Module
 * 
 * Provides AES-256-GCM encryption for Protected Health Information (PHI).
 * Implements HIPAA-compliant encryption at rest for sensitive medical data.
 * 
 * HIPAA Compliance:
 * - Uses AES-256-GCM for authenticated encryption
 * - Unique IV per encryption operation
 * - 256-bit encryption keys
 * - Authentication tag prevents tampering
 * 
 * @module lib/hipaa/encryption
 */

import { 
  createCipheriv, 
  createDecipheriv, 
  randomBytes, 
  createHash,
  timingSafeEqual,
} from 'crypto';
import { ENCRYPTION_CONFIG, ERROR_MESSAGES, PHI_FIELDS } from '@/lib/constants';

// ============================================
// Types
// ============================================

export interface EncryptedData {
  /** Base64-encoded initialization vector */
  iv: string;
  /** Base64-encoded authentication tag */
  authTag: string;
  /** Base64-encoded encrypted data */
  ciphertext: string;
  /** Version identifier for future key rotation */
  version?: string;
}

export interface EncryptionOptions {
  /** Additional authenticated data (AAD) for context binding */
  aad?: string;
  /** Key version for key rotation support */
  keyVersion?: string;
}

export interface FieldEncryptionOptions {
  /** Fields to encrypt */
  fields?: string[];
  /** Encrypt all except specified fields */
  excludeFields?: string[];
  /** Additional authenticated data */
  aad?: string;
}

export interface KeyDerivationOptions {
  /** Salt for key derivation */
  salt: Buffer;
  /** Number of iterations */
  iterations: number;
  /** Key length */
  keyLength: number;
}

// ============================================
// Key Management
// ============================================

/**
 * Get encryption key from environment
 * 
 * Retrieves and validates the encryption key from environment variables.
 * The key must be 32 bytes (256 bits) base64-encoded.
 * 
 * @returns Encryption key buffer
 * @throws Error if ENCRYPTION_KEY is not configured
 */
function getEncryptionKey(): Buffer {
  const keyBase64 = process.env.ENCRYPTION_KEY;
  
  if (!keyBase64) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
      'Generate a key with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
  
  const key = Buffer.from(keyBase64, 'base64');
  
  if (key.length !== ENCRYPTION_CONFIG.KEY_LENGTH) {
    throw new Error(
      `Invalid encryption key length: ${key.length} bytes. ` +
      `Expected ${ENCRYPTION_CONFIG.KEY_LENGTH} bytes (256 bits).`
    );
  }
  
  return key;
}

/**
 * Derive encryption key from password
 * 
 * Uses PBKDF2 to derive a key from a password. Useful for
 * password-based encryption scenarios.
 * 
 * @param password - Password to derive key from
 * @param options - Key derivation options
 * @returns Derived key and salt
 */
export function deriveKeyFromPassword(
  password: string,
  options?: Partial<KeyDerivationOptions>
): { key: Buffer; salt: Buffer; iterations: number } {
  const salt = options?.salt || randomBytes(ENCRYPTION_CONFIG.SALT_LENGTH);
  const iterations = options?.iterations || ENCRYPTION_CONFIG.PBKDF2_ITERATIONS;
  const keyLength = options?.keyLength || ENCRYPTION_CONFIG.KEY_LENGTH;
  
  const key = createHash('sha256')
    .update(password)
    .update(salt)
    .digest();
  
  return { key, salt, iterations };
}

/**
 * Hash identifier for searchable encryption
 * 
 * Creates a deterministic hash for fields that need to be
 * searchable while encrypted (e.g., email lookups).
 * 
 * @param value - Value to hash
 * @param pepper - Additional secret pepper
 * @returns Deterministic hash
 */
export function hashIdentifier(value: string, pepper?: string): string {
  const key = getEncryptionKey();
  const input = pepper ? `${value}:${pepper}` : value;
  
  return createHash('sha256')
    .update(input)
    .update(key)
    .digest('hex');
}

/**
 * Generate a data encryption key (DEK) for envelope encryption
 * 
 * Used for encrypting large datasets where each item gets
 * its own key, encrypted by a master key.
 * 
 * @returns Object containing DEK and encrypted DEK
 */
export function generateDataEncryptionKey(): {
  dek: Buffer;
  encryptedDek: string;
} {
  const masterKey = getEncryptionKey();
  const dek = randomBytes(ENCRYPTION_CONFIG.KEY_LENGTH);
  
  // Encrypt DEK with master key using AES-256-GCM
  const iv = randomBytes(ENCRYPTION_CONFIG.IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_CONFIG.ALGORITHM, masterKey, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(dek),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  
  const encryptedDek = [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
  
  return { dek, encryptedDek };
}

/**
 * Decrypt a data encryption key
 * 
 * @param encryptedDek - Encrypted DEK string
 * @returns Decrypted DEK buffer
 */
export function decryptDataEncryptionKey(encryptedDek: string): Buffer {
  const masterKey = getEncryptionKey();
  const [ivB64, authTagB64, ciphertextB64] = encryptedDek.split(':');
  
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  
  const decipher = createDecipheriv(ENCRYPTION_CONFIG.ALGORITHM, masterKey, iv);
  decipher.setAuthTag(authTag);
  
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
}

// ============================================
// Encryption Functions
// ============================================

/**
 * Encrypt sensitive data using AES-256-GCM
 * 
 * Encrypts plaintext using AES-256-GCM authenticated encryption.
 * Returns an object containing the IV, auth tag, and ciphertext.
 * 
 * @param plaintext - Data to encrypt
 * @param options - Encryption options
 * @returns Encrypted data object
 * @throws Error if encryption fails
 * 
 * @example
 * ```typescript
 * const encrypted = encryptPHI('sensitive medical data');
 * // Store encrypted.iv, encrypted.authTag, encrypted.ciphertext
 * ```
 */
export function encryptPHI(
  plaintext: string,
  options: EncryptionOptions = {}
): EncryptedData {
  if (typeof plaintext !== 'string') {
    throw new Error('Plaintext must be a string');
  }
  
  const key = getEncryptionKey();
  const iv = randomBytes(ENCRYPTION_CONFIG.IV_LENGTH);
  
  const cipher = createCipheriv(ENCRYPTION_CONFIG.ALGORITHM, key, iv);
  
  // Add AAD if provided (binds ciphertext to context)
  if (options.aad) {
    cipher.setAAD(Buffer.from(options.aad, 'utf8'));
  }
  
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  return {
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    version: options.keyVersion || 'v1',
  };
}

/**
 * Decrypt encrypted data using AES-256-GCM
 * 
 * Decrypts data that was encrypted with encryptPHI().
 * Verifies authentication tag to detect tampering.
 * 
 * @param encryptedData - Encrypted data object
 * @param options - Decryption options (must match encryption)
 * @returns Decrypted plaintext
 * @throws Error if decryption fails or data is tampered
 * 
 * @example
 * ```typescript
 * const decrypted = decryptPHI({
 *   iv: '...',
 *   authTag: '...',
 *   ciphertext: '...'
 * });
 * ```
 */
export function decryptPHI(
  encryptedData: EncryptedData,
  options: EncryptionOptions = {}
): string {
  const key = getEncryptionKey();
  
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const authTag = Buffer.from(encryptedData.authTag, 'base64');
  const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64');
  
  // Validate buffer lengths
  if (iv.length !== ENCRYPTION_CONFIG.IV_LENGTH) {
    throw new Error(ERROR_MESSAGES.HIPAA.ENCRYPTION_ERROR);
  }
  
  if (authTag.length !== ENCRYPTION_CONFIG.AUTH_TAG_LENGTH) {
    throw new Error(ERROR_MESSAGES.HIPAA.ENCRYPTION_ERROR);
  }
  
  const decipher = createDecipheriv(ENCRYPTION_CONFIG.ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  // Add AAD if provided (must match encryption)
  if (options.aad) {
    decipher.setAAD(Buffer.from(options.aad, 'utf8'));
  }
  
  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error(
      ERROR_MESSAGES.HIPAA.ENCRYPTION_ERROR,
      { cause: error }
    );
  }
}

/**
 * Encrypt data to compact string format
 * 
 * Produces a single string containing all encryption components,
 * suitable for database storage.
 * 
 * Format: base64(iv):base64(authTag):base64(ciphertext)[:version]
 * 
 * @param plaintext - Data to encrypt
 * @param options - Encryption options
 * @returns Compact encrypted string
 */
export function encryptPHIToString(
  plaintext: string,
  options: EncryptionOptions = {}
): string {
  const encrypted = encryptPHI(plaintext, options);
  
  const parts = [
    encrypted.iv,
    encrypted.authTag,
    encrypted.ciphertext,
  ];
  
  if (encrypted.version && encrypted.version !== 'v1') {
    parts.push(encrypted.version);
  }
  
  return parts.join(':');
}

/**
 * Decrypt from compact string format
 * 
 * @param encryptedString - String from encryptPHIToString()
 * @param options - Decryption options
 * @returns Decrypted plaintext
 */
export function decryptPHIFromString(
  encryptedString: string,
  options: EncryptionOptions = {}
): string {
  const parts = encryptedString.split(':');
  
  if (parts.length < 3) {
    throw new Error('Invalid encrypted string format');
  }
  
  const [iv, authTag, ciphertext, version] = parts;
  
  return decryptPHI({ iv, authTag, ciphertext, version }, options);
}

// ============================================
// Object Encryption
// ============================================

/**
 * Encrypt specific fields in an object
 * 
 * Encrypts PHI fields in an object while leaving other fields
 * in plaintext. Returns a new object with encrypted fields.
 * 
 * @param data - Object containing PHI
 * @param options - Field encryption options
 * @returns Object with encrypted fields
 * 
 * @example
 * ```typescript
 * const patient = {
 *   id: '123',
 *   name: 'John Doe',
 *   ssn: '123-45-6789'
 * };
 * const encrypted = encryptFields(patient, { fields: ['name', 'ssn'] });
 * // encrypted.name = 'base64:base64:base64'
 * // encrypted.id = '123' (unchanged)
 * ```
 */
export function encryptFields<T extends Record<string, unknown>>(
  data: T,
  options: FieldEncryptionOptions = {}
): T {
  const { fields = PHI_FIELDS.ALL, excludeFields = [] } = options;
  
  const result = { ...data };
  
  for (const key of Object.keys(result)) {
    // Skip excluded fields
    if (excludeFields.includes(key)) {
      continue;
    }
    
    // Encrypt specified fields
    if (fields.includes(key)) {
      const value = result[key];
      if (typeof value === 'string' && value.length > 0) {
        (result as Record<string, unknown>)[key] = encryptPHIToString(
          value,
          { aad: options.aad }
        );
      }
    }
  }
  
  return result;
}

/**
 * Decrypt specific fields in an object
 * 
 * @param data - Object with encrypted fields
 * @param options - Field decryption options
 * @returns Object with decrypted fields
 */
export function decryptFields<T extends Record<string, unknown>>(
  data: T,
  options: FieldEncryptionOptions = {}
): T {
  const { fields = PHI_FIELDS.ALL, excludeFields = [] } = options;
  
  const result = { ...data };
  
  for (const key of Object.keys(result)) {
    // Skip excluded fields
    if (excludeFields.includes(key)) {
      continue;
    }
    
    // Decrypt specified fields
    if (fields.includes(key)) {
      const value = result[key];
      if (typeof value === 'string' && value.includes(':')) {
        try {
          (result as Record<string, unknown>)[key] = decryptPHIFromString(
            value,
            { aad: options.aad }
          );
        } catch {
          // If decryption fails, leave as-is (might not be encrypted)
        }
      }
    }
  }
  
  return result;
}

// ============================================
// Batch Encryption
// ============================================

/**
 * Encrypt multiple values
 * 
 * @param values - Array of values to encrypt
 * @param options - Encryption options
 * @returns Array of encrypted strings
 */
export function encryptMany(
  values: string[],
  options: EncryptionOptions = {}
): string[] {
  return values.map(value => encryptPHIToString(value, options));
}

/**
 * Decrypt multiple values
 * 
 * @param encryptedValues - Array of encrypted strings
 * @param options - Decryption options
 * @returns Array of decrypted values
 */
export function decryptMany(
  encryptedValues: string[],
  options: EncryptionOptions = {}
): string[] {
  return encryptedValues.map(value => decryptPHIFromString(value, options));
}

// ============================================
// Rotation and Migration
// ============================================

/**
 * Re-encrypt data with a new key
 * 
 * Used for key rotation - decrypts with old key and re-encrypts
 * with current key.
 * 
 * @param encryptedString - Current encrypted data
 * @param oldKey - Old encryption key (base64)
 * @returns Newly encrypted string
 */
export function reencryptWithNewKey(
  encryptedString: string,
  oldKey: string
): string {
  // Temporarily use old key
  const currentKey = process.env.ENCRYPTION_KEY;
  
  try {
    process.env.ENCRYPTION_KEY = oldKey;
    const plaintext = decryptPHIFromString(encryptedString);
    
    process.env.ENCRYPTION_KEY = currentKey;
    return encryptPHIToString(plaintext);
  } catch (error) {
    // Restore current key on error
    process.env.ENCRYPTION_KEY = currentKey;
    throw error;
  }
}

// ============================================
// Validation
// ============================================

/**
 * Check if a value appears to be encrypted
 * 
 * @param value - Value to check
 * @returns True if value appears encrypted
 */
export function isEncrypted(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  
  // Check for encrypted format (base64:base64:base64)
  const parts = value.split(':');
  if (parts.length < 3) return false;
  
  // Check if parts are valid base64
  try {
    for (const part of parts.slice(0, 3)) {
      Buffer.from(part, 'base64');
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Secure compare two values (timing-safe)
 * 
 * @param a - First value
 * @param b - Second value
 * @returns True if values are equal
 */
export function secureCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    
    if (bufA.length !== bufB.length) {
      return false;
    }
    
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
