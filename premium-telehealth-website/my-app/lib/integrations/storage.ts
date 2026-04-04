/**
 * Storage abstraction layer
 *
 * Currently uses Netlify Blobs. Switch to S3 by setting STORAGE_PROVIDER=s3.
 *
 * @module lib/integrations/storage
 */

import { getStore } from '@netlify/blobs';

// Re-export constants and utilities from s3.ts so callers don't need both imports
export {
  ALLOWED_DOCUMENT_TYPES,
  MAX_FILE_SIZE,
  DEFAULT_EXPIRES_IN,
  generateDocumentKey,
  generateTempKey,
  parseDocumentKey,
  getContentType,
  isAllowedFileType,
  getExtensionFromContentType,
  isValidFileSize,
} from '@/lib/integrations/s3';

const STORE_NAME = 'patient-documents';

// ============================================
// Netlify Blobs implementation
// ============================================

/**
 * Upload a file to Netlify Blobs
 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
  metadata?: Record<string, string>
): Promise<void> {
  const store = getStore(STORE_NAME);
  // Convert to Uint8Array to satisfy Netlify Blobs type constraints
  const bytes = new Uint8Array(body.buffer, body.byteOffset, body.byteLength) as unknown as string;
  await store.set(key, bytes, {
    metadata: { contentType, ...metadata },
  });
}

/**
 * Download a file from Netlify Blobs
 */
export async function downloadFile(key: string): Promise<Buffer> {
  const store = getStore(STORE_NAME);
  const data = await store.get(key, { type: 'arrayBuffer' });
  if (!data) {
    throw new Error(`File not found: ${key}`);
  }
  return Buffer.from(data);
}

/**
 * Delete a file from Netlify Blobs
 */
export async function deleteFile(key: string): Promise<void> {
  const store = getStore(STORE_NAME);
  await store.delete(key);
}

/**
 * Check if a file exists and return its metadata
 */
export async function getObjectInfo(
  key: string
): Promise<{ key: string; size: number; contentType?: string; metadata?: Record<string, string> } | null> {
  const store = getStore(STORE_NAME);
  try {
    const result = await store.getMetadata(key);
    if (!result) return null;
    return {
      key,
      size: 0, // Netlify Blobs metadata doesn't include size; caller provides it
      contentType: typeof result.metadata?.contentType === 'string' ? result.metadata.contentType : undefined,
      metadata: result.metadata as Record<string, string> | undefined,
    };
  } catch {
    return null;
  }
}
