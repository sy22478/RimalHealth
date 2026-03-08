/**
 * AWS S3 Integration Module
 * HIPAA-compliant document storage with presigned URLs
 * 
 * HIPAA Compliance Requirements:
 * - Encryption at Rest: SSE-S3 (AES-256) or SSE-KMS
 * - Encryption in Transit: HTTPS only via presigned URLs
 * - Access Control: No public access, presigned URLs expire quickly
 * - Audit Logging: All S3 operations logged via audit system
 * - Bucket Policy: Deny unencrypted uploads
 * - CORS: Strict origin restrictions for browser uploads
 * 
 * Required Packages:
 * npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 * 
 * Environment Variables:
 * - AWS_ACCESS_KEY_ID: IAM access key
 * - AWS_SECRET_ACCESS_KEY: IAM secret key
 * - AWS_REGION: AWS region (default: us-west-2)
 * - AWS_S3_BUCKET_NAME: S3 bucket name
 * - AWS_S3_ENDPOINT: Optional, for MinIO/local testing
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  S3ClientConfig,
  NotFound,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';

// ============================================
// Types
// ============================================

/**
 * S3 configuration options
 * Supports both AWS S3 and MinIO (for local development)
 */
export interface S3Config {
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string; // For MinIO/local testing
  forcePathStyle?: boolean; // For MinIO
}

/**
 * Options for generating presigned URLs
 */
export interface PresignedUrlOptions {
  key: string;
  bucket?: string;
  expiresIn?: number; // seconds (default: 900 = 15 min)
  contentType?: string;
  contentLength?: number; // max file size
  metadata?: Record<string, string>;
}

/**
 * Result of generating a presigned upload URL
 */
export interface PresignedUploadUrl extends PresignedUrlOptions {
  url: string; // Presigned PUT URL
  fields?: Record<string, string>; // For POST policy (if needed)
  publicUrl: string; // S3 object URL (for reference)
}

/**
 * S3 object metadata
 */
export interface S3ObjectInfo {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

/**
 * Document key generation options
 */
export interface DocumentKeyOptions {
  userId: string;
  documentType: 'id' | 'insurance' | 'medical' | 'consent' | 'other';
  fileName: string;
  timestamp?: Date;
}

/**
 * Parsed document key metadata
 */
export interface ParsedDocumentKey {
  userId?: string;
  documentType?: string;
  timestamp?: Date;
  fileName?: string;
}

// ============================================
// Constants
// ============================================

/**
 * Allowed document MIME types for upload
 * Restricted to common document and image formats
 */
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
] as const;

/**
 * Maximum file size: 10MB
 * Prevents abuse and keeps storage costs reasonable
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Default presigned URL expiration: 15 minutes
 * Short expiration for security (HIPAA requirement)
 */
export const DEFAULT_EXPIRES_IN = 900; // 15 minutes

/**
 * Default S3 region
 */
export const DEFAULT_REGION = 'us-west-2';

// Content type to extension mapping
const CONTENT_TYPE_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
};

// Extension to content type mapping
const EXTENSION_MAP: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

// ============================================
// S3 Client
// ============================================

// Singleton instance
let s3Client: S3Client | null = null;

/**
 * Create a new S3 client instance
 * Supports both AWS S3 and MinIO for local development
 * 
 * @param config - Optional configuration overrides
 * @returns Configured S3Client instance
 * @throws Error if AWS credentials are not configured
 */
export function createS3Client(config?: S3Config): S3Client {
  const region = config?.region || process.env.AWS_REGION || DEFAULT_REGION;
  const accessKeyId = config?.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    config?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'AWS credentials not configured. ' +
        'Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.'
    );
  }

  const clientConfig: S3ClientConfig = {
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  };

  // Support MinIO for local development/testing
  if (config?.endpoint) {
    clientConfig.endpoint = config.endpoint;
    clientConfig.forcePathStyle = config.forcePathStyle ?? true;
  }

  return new S3Client(clientConfig);
}

/**
 * Get or create the singleton S3 client instance
 * Reuses the same client for connection pooling
 * 
 * @returns S3Client singleton instance
 */
export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = createS3Client();
  }
  return s3Client;
}

/**
 * Reset the singleton client (useful for testing)
 */
export function resetS3Client(): void {
  s3Client = null;
}

// ============================================
// Presigned URL Generation
// ============================================

/**
 * Generate presigned URL for direct browser upload
 * Client uploads directly to S3, bypassing our server (better performance)
 * 
 * HIPAA Compliance:
 * - URL expires quickly (default: 15 min)
 * - Server-side encryption enforced (SSE-S3)
 * - HTTPS only
 * - Metadata can include audit info (userId, purpose)
 * 
 * @param options - Upload options
 * @returns Presigned upload URL and metadata
 * @throws Error if S3 operation fails
 * 
 * @example
 * ```typescript
 * const uploadData = await generateUploadUrl({
 *   key: 'documents/user-123/id/1234567890-license.pdf',
 *   contentType: 'application/pdf',
 *   expiresIn: 900,
 *   metadata: { userId: 'user-123', documentType: 'id' }
 * });
 * // Client uses uploadData.url to PUT file directly to S3
 * ```
 */
export async function generateUploadUrl(
  options: Omit<PresignedUrlOptions, 'url' | 'fields' | 'publicUrl'>
): Promise<PresignedUploadUrl> {
  try {
    const client = getS3Client();
    const bucket = options.bucket || getBucketName();
    const expiresIn = options.expiresIn || DEFAULT_EXPIRES_IN;

    // Validate content type
    if (options.contentType && !isAllowedFileType(options.contentType)) {
      throw new Error(
        `Content type "${options.contentType}" is not allowed. ` +
          `Allowed types: ${ALLOWED_DOCUMENT_TYPES.join(', ')}`
      );
    }

    // Build the PutObject command with HIPAA-compliant settings
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: options.key,
      ContentType: options.contentType,
      Metadata: sanitizeMetadata(options.metadata),
      // HIPAA Requirement: Server-side encryption
      ServerSideEncryption: 'AES256',
      // Optional: enforce content length limit
      ...(options.contentLength && {
        ContentLength: options.contentLength,
      }),
    });

    // Generate presigned URL
    const url = await getSignedUrl(client, command, { expiresIn });

    // Build the public URL for reference (not for direct access)
    const publicUrl = buildPublicUrl(bucket, options.key, client);

    return {
      ...options,
      url,
      publicUrl,
      expiresIn,
    };
  } catch (error) {
    throw wrapS3Error('Failed to generate upload URL', error);
  }
}

/**
 * Generate presigned URL for file download
 * 
 * HIPAA Compliance:
 * - URL expires quickly (configure based on use case)
 * - HTTPS only
 * - Access logged via audit system
 * 
 * @param options - Download options
 * @returns Presigned download URL string
 * @throws Error if S3 operation fails
 * 
 * @example
 * ```typescript
 * const downloadUrl = await generateDownloadUrl({
 *   key: 'documents/user-123/id/1234567890-license.pdf',
 *   expiresIn: 300 // 5 minutes
 * });
 * // Client uses downloadUrl to GET file directly from S3
 * ```
 */
export async function generateDownloadUrl(
  options: Omit<PresignedUrlOptions, 'url' | 'fields' | 'publicUrl'>
): Promise<string> {
  try {
    const client = getS3Client();
    const bucket = options.bucket || getBucketName();
    const expiresIn = options.expiresIn || DEFAULT_EXPIRES_IN;

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: options.key,
    });

    return await getSignedUrl(client, command, { expiresIn });
  } catch (error) {
    throw wrapS3Error('Failed to generate download URL', error);
  }
}

/**
 * Generate presigned URL for file deletion
 * Use with caution - deletions should be logged
 * 
 * @param key - S3 object key
 * @param bucket - Optional bucket name
 * @returns Presigned delete URL string
 * @throws Error if S3 operation fails
 */
export async function generateDeleteUrl(
  key: string,
  bucket?: string
): Promise<string> {
  try {
    const client = getS3Client();
    const targetBucket = bucket || getBucketName();

    const command = new DeleteObjectCommand({
      Bucket: targetBucket,
      Key: key,
    });

    return await getSignedUrl(client, command, {
      expiresIn: DEFAULT_EXPIRES_IN,
    });
  } catch (error) {
    throw wrapS3Error('Failed to generate delete URL', error);
  }
}

// ============================================
// Server-side Operations
// ============================================

/**
 * Upload file from server to S3
 * Use for server-side processing or when presigned URLs aren't suitable
 * 
 * HIPAA Compliance:
 * - Server-side encryption enforced
 * - Audit logging recommended
 * 
 * @param key - S3 object key
 * @param body - File content
 * @param contentType - MIME type
 * @param metadata - Optional metadata
 * @throws Error if upload fails
 */
export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<void> {
  try {
    const client = getS3Client();
    const bucket = getBucketName();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: sanitizeMetadata(metadata),
      ServerSideEncryption: 'AES256',
    });

    await client.send(command);
  } catch (error) {
    throw wrapS3Error(`Failed to upload file: ${key}`, error);
  }
}

/**
 * Download file from S3 to server
 * Returns the file as a Buffer for server-side processing
 * 
 * @param key - S3 object key
 * @returns File content as Buffer
 * @throws Error if file not found or download fails
 */
export async function downloadFile(key: string): Promise<Buffer> {
  try {
    const client = getS3Client();
    const bucket = getBucketName();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);

    if (!response.Body) {
      throw new Error('Empty response body');
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (error) {
    if (error instanceof NotFound || (error as Error).name === 'NotFound') {
      throw new Error(`File not found: ${key}`);
    }
    throw wrapS3Error(`Failed to download file: ${key}`, error);
  }
}

/**
 * Delete file from S3
 * IMPORTANT: Deletions should be logged for HIPAA compliance
 * 
 * @param key - S3 object key
 * @throws Error if deletion fails
 */
export async function deleteFile(key: string): Promise<void> {
  try {
    const client = getS3Client();
    const bucket = getBucketName();

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
  } catch (error) {
    throw wrapS3Error(`Failed to delete file: ${key}`, error);
  }
}

/**
 * Check if file exists and get metadata
 * Returns null if file doesn't exist (no error thrown)
 * 
 * @param key - S3 object key
 * @returns Object info or null if not found
 */
export async function getObjectInfo(key: string): Promise<S3ObjectInfo | null> {
  try {
    const client = getS3Client();
    const bucket = getBucketName();

    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);

    return {
      key,
      size: response.ContentLength || 0,
      lastModified: response.LastModified || new Date(),
      etag: response.ETag?.replace(/"/g, '') || '',
      contentType: response.ContentType,
      metadata: response.Metadata,
    };
  } catch (error) {
    if (error instanceof NotFound || (error as Error).name === 'NotFound') {
      return null;
    }
    throw wrapS3Error(`Failed to get object info: ${key}`, error);
  }
}

// ============================================
// Key Generation Helpers
// ============================================

/**
 * Generate S3 key for user document
 * Format: documents/{userId}/{documentType}/{timestamp}-{filename}
 * 
 * This structure:
 * - Groups documents by user for easy management
 * - Separates by document type for organization
 * - Includes timestamp for uniqueness and sorting
 * - Prevents filename collisions
 * 
 * @param options - Key generation options
 * @returns S3 object key string
 * 
 * @example
 * ```typescript
 * const key = generateDocumentKey({
 *   userId: 'user-123',
 *   documentType: 'id',
 *   fileName: 'drivers-license.pdf'
 * });
 * // Returns: "documents/user-123/id/1706745600000-drivers-license.pdf"
 * ```
 */
export function generateDocumentKey(options: DocumentKeyOptions): string {
  const { userId, documentType, fileName, timestamp = new Date() } = options;

  // Sanitize filename: remove path components and special chars
  const sanitizedFileName = sanitizeFileName(fileName);

  // Use timestamp for uniqueness and chronological sorting
  const timestampStr = timestamp.getTime().toString();

  return `documents/${userId}/${documentType}/${timestampStr}-${sanitizedFileName}`;
}

/**
 * Generate S3 key for temporary upload
 * Temporary files should be cleaned up periodically
 * Format: temp/{timestamp}-{random}-{filename}
 * 
 * @param fileName - Original file name
 * @returns S3 object key for temporary storage
 */
export function generateTempKey(fileName: string): string {
  const sanitizedFileName = sanitizeFileName(fileName);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);

  return `temp/${timestamp}-${random}-${sanitizedFileName}`;
}

/**
 * Parse S3 key to extract metadata
 * Reverse operation of generateDocumentKey
 * 
 * @param key - S3 object key
 * @returns Parsed metadata or empty object if format doesn't match
 * 
 * @example
 * ```typescript
 * const info = parseDocumentKey('documents/user-123/id/1706745600000-license.pdf');
 * // Returns: { userId: 'user-123', documentType: 'id', timestamp: Date, fileName: 'license.pdf' }
 * ```
 */
export function parseDocumentKey(key: string): ParsedDocumentKey {
  // Match pattern: documents/{userId}/{documentType}/{timestamp}-{filename}
  const match = key.match(
    /^documents\/([^/]+)\/(id|insurance|medical|consent|other)\/(\d+)-(.+)$/
  );

  if (!match) {
    return {};
  }

  const [, userId, documentType, timestampStr, fileName] = match;

  return {
    userId,
    documentType,
    timestamp: new Date(parseInt(timestampStr, 10)),
    fileName,
  };
}

// ============================================
// Content Type Utilities
// ============================================

/**
 * Get MIME content type from file name
 * Uses file extension to determine content type
 * 
 * @param fileName - File name with extension
 * @returns MIME type or 'application/octet-stream' if unknown
 */
export function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  return CONTENT_TYPE_MAP[ext] || 'application/octet-stream';
}

/**
 * Check if file type is allowed for upload
 * Compares against ALLOWED_DOCUMENT_TYPES
 * 
 * @param fileNameOrType - File name or MIME type
 * @param allowedTypes - Optional custom allowed types
 * @returns True if file type is allowed
 */
export function isAllowedFileType(
  fileNameOrType: string,
  allowedTypes: string[] = [...ALLOWED_DOCUMENT_TYPES]
): boolean {
  // Check if it's already a MIME type
  if (fileNameOrType.includes('/')) {
    return allowedTypes.includes(fileNameOrType);
  }

  // Otherwise, treat as filename and extract extension
  const contentType = getContentType(fileNameOrType);
  return allowedTypes.includes(contentType);
}

/**
 * Get file extension from MIME type
 * @param contentType - MIME type
 * @returns File extension or '.bin' if unknown
 */
export function getExtensionFromContentType(contentType: string): string {
  return EXTENSION_MAP[contentType] || '.bin';
}

/**
 * Validate file size
 * @param size - File size in bytes
 * @param maxSize - Maximum allowed size (default: MAX_FILE_SIZE)
 * @returns True if size is within limit
 */
export function isValidFileSize(
  size: number,
  maxSize: number = MAX_FILE_SIZE
): boolean {
  return size > 0 && size <= maxSize;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get bucket name from environment
 * @throws Error if AWS_S3_BUCKET_NAME is not set
 */
function getBucketName(): string {
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  if (!bucket) {
    throw new Error(
      'AWS_S3_BUCKET_NAME environment variable is not configured'
    );
  }
  return bucket;
}

/**
 * Build public URL for S3 object
 * Note: This URL is NOT publicly accessible (bucket is private)
 * Used for reference and logging only
 */
function buildPublicUrl(
  bucket: string,
  key: string,
  client: S3Client
): string {
  // Check if using custom endpoint (MinIO)
  const config = client.config;
  if (config.endpoint) {
    // For MinIO, use path-style URL
    return `${config.endpoint}/${bucket}/${key}`;
  }

  // Standard AWS S3 URL
  const region = process.env.AWS_REGION || DEFAULT_REGION;
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Sanitize metadata for S3
 * S3 metadata has restrictions on keys and values
 */
function sanitizeMetadata(
  metadata?: Record<string, string>
): Record<string, string> | undefined {
  if (!metadata) return undefined;

  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(metadata)) {
    // S3 metadata keys must be alphanumeric and certain special chars
    const sanitizedKey = key.replace(/[^a-zA-Z0-9-_.]/g, '_');
    // Values must be ASCII printable
    const sanitizedValue = value
      .replace(/[^\x20-\x7E]/g, '')
      .substring(0, 1024);

    if (sanitizedValue) {
      sanitized[sanitizedKey] = sanitizedValue;
    }
  }

  return sanitized;
}

/**
 * Sanitize file name for S3
 * Removes path components and special characters
 */
function sanitizeFileName(fileName: string): string {
  // Extract just the file name (no path)
  const baseName = path.basename(fileName);

  // Replace special characters that could cause issues
  // Allow: alphanumeric, dots, hyphens, underscores, spaces
  return baseName
    .replace(/[^a-zA-Z0-9._\-\s]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 255); // S3 key limit
}

/**
 * Wrap S3 errors with descriptive messages
 * Preserves original error as cause
 */
function wrapS3Error(message: string, error: unknown): Error {
  const originalError = error instanceof Error ? error : new Error(String(error));
  const wrappedError = new Error(`${message}: ${originalError.message}`);
  wrappedError.cause = originalError;
  return wrappedError;
}

// ============================================
// S3 Bucket Configuration (Documentation)
// ============================================

/**
 * Recommended S3 Bucket Configuration for HIPAA Compliance
 * 
 * CORS Configuration for Browser Uploads:
 * ```json
 * {
 *   "CORSRules": [{
 *     "AllowedHeaders": ["*"],
 *     "AllowedMethods": ["PUT", "POST", "GET", "HEAD"],
 *     "AllowedOrigins": ["https://rimalhealth.com"],
 *     "ExposeHeaders": ["ETag"],
 *     "MaxAgeSeconds": 3000
 *   }]
 * }
 * ```
 * 
 * Bucket Policy (Deny Unencrypted Uploads):
 * ```json
 * {
 *   "Version": "2012-10-17",
 *   "Statement": [
 *     {
 *       "Sid": "DenyUnencryptedUploads",
 *       "Effect": "Deny",
 *       "Principal": "*",
 *       "Action": "s3:PutObject",
 *       "Resource": "arn:aws:s3:::rimalhealth-documents/*",
 *       "Condition": {
 *         "StringNotEquals": {
 *           "s3:x-amz-server-side-encryption": "AES256"
 *         }
 *       }
 *     },
 *     {
 *       "Sid": "DenyIncorrectEncryptionHeader",
 *       "Effect": "Deny",
 *       "Principal": "*",
 *       "Action": "s3:PutObject",
 *       "Resource": "arn:aws:s3:::rimalhealth-documents/*",
 *       "Condition": {
 *         "StringNotEquals": {
 *           "s3:x-amz-server-side-encryption": "aws:kms"
 *         }
 *       }
 *     }
 *   ]
 * }
 * ```
 * 
 * Bucket Settings:
 * - Block Public Access: Enabled (all four settings)
 * - Versioning: Enabled (for document history)
 * - Server-side encryption: AES-256 (SSE-S3) or KMS (SSE-KMS)
 * - Access logging: Enabled, target: rimalhealth-logs bucket
 * - Lifecycle policy: Move to Glacier after 1 year, delete after 7 years
 * 
 * IAM Policy for Application:
 * ```json
 * {
 *   "Version": "2012-10-17",
 *   "Statement": [
 *     {
 *       "Effect": "Allow",
 *       "Action": [
 *         "s3:PutObject",
 *         "s3:GetObject",
 *         "s3:DeleteObject",
 *         "s3:ListBucket"
 *       ],
 *       "Resource": [
 *         "arn:aws:s3:::rimalhealth-documents",
 *         "arn:aws:s3:::rimalhealth-documents/*"
 *       ]
 *     }
 *   ]
 * }
 * ```
 */

// ============================================
// Usage Examples
// ============================================

/**
 * Example: Generate upload URL for patient ID document
 * ```typescript
 * import { 
 *   generateUploadUrl, 
 *   generateDocumentKey,
 *   ALLOWED_DOCUMENT_TYPES 
 * } from '@/lib/integrations/s3';
 * 
 * // Generate upload URL
 * const uploadData = await generateUploadUrl({
 *   key: generateDocumentKey({
 *     userId: 'user-123',
 *     documentType: 'id',
 *     fileName: 'drivers-license.pdf',
 *   }),
 *   contentType: 'application/pdf',
 *   expiresIn: 900, // 15 minutes
 *   metadata: {
 *     userId: 'user-123',
 *     documentType: 'id_verification',
 *     uploadedBy: 'patient',
 *   },
 * });
 * 
 * // Return to client
 * return NextResponse.json({
 *   uploadUrl: uploadData.url,
 *   publicUrl: uploadData.publicUrl,
 *   expiresAt: new Date(Date.now() + 900 * 1000).toISOString(),
 * });
 * 
 * // Client uploads directly to S3 using uploadUrl
 * ```
 */

/**
 * Example: Generate download URL for physician review
 * ```typescript
 * import { generateDownloadUrl } from '@/lib/integrations/s3';
 * import { auditPHIAccess } from '@/lib/audit/logger';
 * 
 * // Log PHI access before generating URL
 * await auditPHIAccess(
 *   physicianId,
 *   'Document',
 *   documentId,
 *   'Viewed patient ID document',
 *   auditContext,
 *   { accessReason: 'Patient intake review' }
 * );
 * 
 * // Generate download URL (short expiration for security)
 * const downloadUrl = await generateDownloadUrl({
 *   key: 'documents/user-123/id/1706745600000-license.pdf',
 *   expiresIn: 300, // 5 minutes
 * });
 * ```
 */

/**
 * Example: Server-side file processing
 * ```typescript
 * import { uploadFile, downloadFile, deleteFile, getObjectInfo } from '@/lib/integrations/s3';
 * 
 * // Upload processed document
 * await uploadFile(
 *   'documents/user-123/processed/report.pdf',
 *   pdfBuffer,
 *   'application/pdf',
 *   { userId: 'user-123', documentType: 'processed_report' }
 * );
 * 
 * // Check if file exists
 * const info = await getObjectInfo('documents/user-123/id/license.pdf');
 * if (info) {
 *   console.log(`File size: ${info.size} bytes`);
 * }
 * 
 * // Download for processing
 * const fileBuffer = await downloadFile('documents/user-123/id/license.pdf');
 * 
 * // Clean up temporary file
 * await deleteFile('temp/upload-123-file.pdf');
 * ```
 */

/**
 * Example: API Route Handler
 * ```typescript
 * // app/api/documents/upload-url/route.ts
 * import { NextRequest, NextResponse } from 'next/server';
 * import { generateUploadUrl, generateDocumentKey, isAllowedFileType, MAX_FILE_SIZE } from '@/lib/integrations/s3';
 * import { requireAuth } from '@/lib/auth/require-auth';
 * import { auditLog } from '@/lib/audit/logger';
 * 
 * export async function POST(request: NextRequest) {
 *   try {
 *     // Authenticate user
 *     const user = await requireAuth(request);
 *     
 *     // Parse request
 *     const { fileName, contentType, documentType } = await request.json();
 *     
 *     // Validate file type
 *     if (!isAllowedFileType(contentType)) {
 *       return NextResponse.json(
 *         { error: 'File type not allowed' },
 *         { status: 400 }
 *       );
 *     }
 *     
 *     // Generate upload URL
 *     const uploadData = await generateUploadUrl({
 *       key: generateDocumentKey({
 *         userId: user.id,
 *         documentType,
 *         fileName,
 *       }),
 *       contentType,
 *       contentLength: MAX_FILE_SIZE,
 *       metadata: {
 *         userId: user.id,
 *         documentType,
 *         uploadedBy: user.role,
 *       },
 *     });
 *     
 *     // Log document upload initiated
 *     await auditLog(
 *       'DOCUMENT_UPLOAD_INITIATED',
 *       {
 *         userId: user.id,
 *         resourceType: 'Document',
 *         resourceId: uploadData.key,
 *         metadata: { documentType, fileName },
 *       },
 *       getAuditContext(request)
 *     );
 *     
 *     return NextResponse.json({
 *       uploadUrl: uploadData.url,
 *       key: uploadData.key,
 *       expiresAt: new Date(Date.now() + (uploadData.expiresIn || 900) * 1000).toISOString(),
 *     });
 *   } catch (error) {
 *     console.error('Upload URL generation failed:', error);
 *     return NextResponse.json(
 *       { error: 'Failed to generate upload URL' },
 *       { status: 500 }
 *     );
 *   }
 * }
 * ```
 */
