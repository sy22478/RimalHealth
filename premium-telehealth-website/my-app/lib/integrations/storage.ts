/**
 * Storage abstraction layer
 *
 * Primary: Netlify Blobs (production on Netlify)
 * Fallback: Database storage via Document.fileData column (local dev / non-Netlify)
 *
 * The fallback stores files as base64 in the database with a 5MB limit.
 * This is temporary until AWS S3 migration.
 *
 * @module lib/integrations/storage
 */

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
const DB_FALLBACK_MAX_SIZE = 5 * 1024 * 1024; // 5MB for DB fallback

/**
 * Check if Netlify Blobs is available (running on Netlify)
 */
function isNetlifyEnvironment(): boolean {
  return !!(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT);
}

// In-memory storage for local development (non-persistent, for dev only)
const localStore = new Map<string, { data: Buffer; metadata: Record<string, string> }>();

/**
 * Upload a file to Netlify Blobs (or local fallback)
 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
  metadata?: Record<string, string>
): Promise<void> {
  if (isNetlifyEnvironment()) {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore(STORE_NAME);
    const bytes = new Uint8Array(body.buffer, body.byteOffset, body.byteLength) as unknown as string;
    await store.set(key, bytes, {
      metadata: { contentType, ...metadata },
    });
  } else {
    // Local dev fallback — store in memory
    if (body.length > DB_FALLBACK_MAX_SIZE) {
      throw new Error(`File too large for local storage. Maximum: ${DB_FALLBACK_MAX_SIZE / (1024 * 1024)}MB`);
    }
    localStore.set(key, {
      data: Buffer.from(body),
      metadata: { contentType, ...(metadata ?? {}) },
    });
  }
}

/**
 * Download a file from Netlify Blobs (or local fallback)
 */
export async function downloadFile(key: string): Promise<Buffer> {
  if (isNetlifyEnvironment()) {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore(STORE_NAME);
    const data = await store.get(key, { type: 'arrayBuffer' });
    if (!data) {
      throw new Error(`File not found: ${key}`);
    }
    return Buffer.from(data);
  } else {
    const entry = localStore.get(key);
    if (!entry) {
      throw new Error(`File not found: ${key}`);
    }
    return entry.data;
  }
}

/**
 * Delete a file from Netlify Blobs (or local fallback)
 */
export async function deleteFile(key: string): Promise<void> {
  if (isNetlifyEnvironment()) {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore(STORE_NAME);
    await store.delete(key);
  } else {
    localStore.delete(key);
  }
}

/**
 * Check if a file exists and return its metadata
 */
export async function getObjectInfo(
  key: string
): Promise<{ key: string; size: number; contentType?: string; metadata?: Record<string, string> } | null> {
  if (isNetlifyEnvironment()) {
    const { getStore } = await import('@netlify/blobs');
    const store = getStore(STORE_NAME);
    try {
      const result = await store.getMetadata(key);
      if (!result) return null;
      return {
        key,
        size: 0,
        contentType: typeof result.metadata?.contentType === 'string' ? result.metadata.contentType : undefined,
        metadata: result.metadata as Record<string, string> | undefined,
      };
    } catch {
      return null;
    }
  } else {
    const entry = localStore.get(key);
    if (!entry) return null;
    return {
      key,
      size: entry.data.length,
      contentType: entry.metadata.contentType,
      metadata: entry.metadata,
    };
  }
}
