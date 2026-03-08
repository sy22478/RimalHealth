/**
 * @deprecated This file is deprecated. Use encryption-extension.ts instead.
 * 
 * Prisma Middleware for Automatic PHI Encryption (Legacy)
 * 
 * Note: Prisma 7.x no longer supports the $use() middleware API.
 * The recommended approach is to use Prisma Client Extensions.
 * 
 * This file is kept for reference purposes only.
 * See encryption-extension.ts for the current implementation.
 */

export { PHI_FIELDS, encryptModelFields, decryptModelFields, getPHIFields, hasPHIFields } from './encryption-extension';

/**
 * @deprecated Use createEncryptionExtension() from encryption-extension.ts instead
 */
export function encryptionMiddleware(): never {
  throw new Error(
    'encryptionMiddleware() is deprecated. ' +
    'Prisma 7.x no longer supports $use() middleware. ' +
    'Use createEncryptionExtension() from encryption-extension.ts instead. ' +
    'See lib/db/prisma.ts for usage example.'
  );
}
