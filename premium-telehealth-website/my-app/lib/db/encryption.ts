/**
 * Database Encryption Service
 * 
 * Centralized PHI encryption/decryption utilities for database operations.
 * Re-exports from lib/encryption/phi.ts for convenient access.
 * 
 * HIPAA Compliance:
 * - AES-256-GCM encryption for all PHI fields
 * - Unique IV per encryption operation
 * - Authentication tag for integrity verification
 * - Secure key management via environment variables
 * 
 * @example
 * ```typescript
 * import { encryptField, decryptField } from '@/lib/db/encryption';
 * 
 * // Encrypt a PHI field before saving
 * const encryptedName = encryptField(patientName);
 * 
 * // Decrypt when reading
 * const decryptedName = decryptField(encryptedName);
 * ```
 */

// Re-export all PHI encryption functions
export {
  encryptPHI as encryptField,
  decryptPHI as decryptField,
  encryptJSON,
  decryptJSON,
  isEncrypted,
  generateEncryptionKey,
  validateEncryptionConfig,
} from '../encryption/phi';

// Note: PHI field definitions are in encryption-extension.ts
// and automatically applied via Prisma Client Extensions
