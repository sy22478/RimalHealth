/**
 * Storage abstraction layer
 *
 * All document storage uses AWS S3.
 * Re-exports from s3.ts so callers can import from '@/lib/integrations/storage'.
 *
 * @module lib/integrations/storage
 */

export {
  // Constants
  ALLOWED_DOCUMENT_TYPES,
  MAX_FILE_SIZE,
  DEFAULT_EXPIRES_IN,

  // Key generation
  generateDocumentKey,
  generateTempKey,
  parseDocumentKey,

  // Content type utilities
  getContentType,
  isAllowedFileType,
  getExtensionFromContentType,
  isValidFileSize,

  // Server-side operations
  uploadFile,
  downloadFile,
  deleteFile,
  getObjectInfo,

  // Presigned URL generation
  generateUploadUrl,
  generateDownloadUrl,
  generateDeleteUrl,
} from '@/lib/integrations/s3';
