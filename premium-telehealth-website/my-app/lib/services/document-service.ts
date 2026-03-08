/**
 * Document Service
 * Service for managing patient document uploads and downloads
 * 
 * HIPAA Compliance:
 * - Uses S3 presigned URLs for direct browser upload/download
 * - All file types validated before generating URLs
 * - File size limits enforced
 * - Document access is logged
 * 
 * @module lib/services/document-service
 */

import {
  generateUploadUrl,
  generateDownloadUrl,
  generateDocumentKey,
  isAllowedFileType,
  isValidFileSize,
  MAX_FILE_SIZE,
  ALLOWED_DOCUMENT_TYPES,
  type DocumentKeyOptions,
} from '@/lib/integrations/s3';
import { prisma } from '@/lib/db/prisma';
import { auditLogger, AuditContext } from '@/lib/audit';
import { AuditEventType, PHIResourceType } from '@/lib/audit/types';

// ============================================================================
// Types
// ============================================================================

export interface PresignedUploadResult {
  url: string;
  key: string;
  expiresAt: string;
}

export interface PresignedDownloadResult {
  url: string;
  expiresAt: string;
}

export interface DocumentMetadata {
  id: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
  status: string;
}

// ============================================================================
// Presigned URL Generation
// ============================================================================

/**
 * Generate presigned URL for document upload
 * 
 * @param patientId - Patient's user ID
 * @param fileName - Original file name
 * @param fileType - MIME type of the file
 * @param fileSize - File size in bytes
 * @param documentType - Type of document (id, insurance, medical, consent, other)
 * @param auditContext - Audit context for logging
 * @returns Presigned upload URL and key
 */
export async function generatePresignedUploadUrl(
  patientId: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  documentType: 'id' | 'insurance' | 'medical' | 'consent' | 'other',
  auditContext: AuditContext
): Promise<PresignedUploadResult> {
  // Validate file type
  if (!isAllowedFileType(fileType)) {
    throw new DocumentValidationError(
      `File type "${fileType}" is not allowed. ` +
      `Allowed types: ${ALLOWED_DOCUMENT_TYPES.join(', ')}`
    );
  }

  // Validate file size
  if (!isValidFileSize(fileSize)) {
    throw new DocumentValidationError(
      `File size ${fileSize} bytes exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes (10MB)`
    );
  }

  // Generate S3 key
  const key = generateDocumentKey({
    userId: patientId,
    documentType,
    fileName,
  });

  // Generate presigned URL (15 minute expiration)
  const uploadData = await generateUploadUrl({
    key,
    contentType: fileType,
    contentLength: fileSize,
    metadata: {
      userId: patientId,
      documentType,
      uploadedBy: 'patient',
    },
    expiresIn: 900, // 15 minutes
  });

  // Log document upload initiated
  await auditLogger.logPHIAccess(
    'CREATE',
    patientId,
    'PATIENT',
    PHIResourceType.DOCUMENT,
    key,
    auditContext,
    {
      documentType,
      fileName,
      fileSize,
    }
  );

  return {
    url: uploadData.url,
    key,
    expiresAt: new Date(Date.now() + 900 * 1000).toISOString(),
  };
}

/**
 * Generate presigned URL for document download
 * 
 * @param patientId - Patient's user ID
 * @param documentId - Document ID from database
 * @param auditContext - Audit context for logging
 * @returns Presigned download URL
 */
export async function generatePresignedDownloadUrl(
  patientId: string,
  documentId: string,
  auditContext: AuditContext
): Promise<PresignedDownloadResult> {
  // Get document from database
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      patientId,
    },
  });

  if (!document) {
    throw new DocumentNotFoundError(`Document ${documentId} not found`);
  }

  // Check if document is active
  if (document.status !== 'ACTIVE') {
    throw new DocumentAccessError(`Document ${documentId} is not available for download`);
  }

  // Generate presigned URL (5 minute expiration for security)
  const downloadUrl = await generateDownloadUrl({
    key: document.s3Key,
    expiresIn: 300, // 5 minutes
  });

  // Log document access
  await auditLogger.logPHIAccess(
    'VIEW',
    patientId,
    'PATIENT',
    PHIResourceType.DOCUMENT,
    documentId,
    auditContext,
    {
      documentType: document.documentType,
      fileName: document.fileName,
    }
  );

  return {
    url: downloadUrl,
    expiresAt: new Date(Date.now() + 300 * 1000).toISOString(),
  };
}

// ============================================================================
// Document Management
// ============================================================================

/**
 * Confirm document upload after successful S3 upload
 * Creates database record for the uploaded document
 * 
 * @param patientId - Patient's user ID
 * @param key - S3 object key
 * @param fileName - Original file name
 * @param fileSize - File size in bytes
 * @param mimeType - MIME type
 * @param documentType - Document type
 * @returns Created document record
 */
export async function confirmDocumentUpload(
  patientId: string,
  key: string,
  fileName: string,
  fileSize: number,
  mimeType: string,
  documentType: 'ID_VERIFICATION' | 'INSURANCE_CARD' | 'MEDICAL_RECORD' | 'CONSENT_FORM' | 'OTHER'
): Promise<DocumentMetadata> {
  // Verify patient profile exists
  const profile = await prisma.patientProfile.findUnique({
    where: { userId: patientId },
  });

  if (!profile) {
    throw new DocumentValidationError('Patient profile not found');
  }

  // Create document record
  const document = await prisma.document.create({
    data: {
      patientId,
      documentType,
      fileName,
      fileSize,
      mimeType,
      s3Key: key,
      s3Bucket: process.env.AWS_S3_BUCKET_NAME || 'rimalhealth-documents',
      status: 'ACTIVE',
    },
  });

  return {
    id: document.id,
    documentType: document.documentType,
    fileName: document.fileName,
    fileSize: document.fileSize,
    mimeType: document.mimeType,
    uploadedAt: document.uploadedAt,
    status: document.status,
  };
}

/**
 * List documents for a patient
 * 
 * @param patientId - Patient's user ID
 * @param documentType - Optional filter by document type
 * @returns Array of document metadata
 */
export async function listPatientDocuments(
  patientId: string,
  documentType?: string
): Promise<DocumentMetadata[]> {
  const where: Record<string, unknown> = { patientId };
  
  if (documentType) {
    where.documentType = documentType;
  }

  const documents = await prisma.document.findMany({
    where,
    orderBy: { uploadedAt: 'desc' },
  });

  return documents.map((doc) => ({
    id: doc.id,
    documentType: doc.documentType,
    fileName: doc.fileName,
    fileSize: doc.fileSize,
    mimeType: doc.mimeType,
    uploadedAt: doc.uploadedAt,
    status: doc.status,
  }));
}

/**
 * Soft delete a document
 * Marks document as deleted but keeps S3 object for compliance
 * 
 * @param patientId - Patient's user ID
 * @param documentId - Document ID
 * @param auditContext - Audit context for logging
 */
export async function deleteDocument(
  patientId: string,
  documentId: string,
  auditContext: AuditContext
): Promise<void> {
  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      patientId,
    },
  });

  if (!document) {
    throw new DocumentNotFoundError(`Document ${documentId} not found`);
  }

  // Soft delete - mark as deleted
  await prisma.document.update({
    where: { id: documentId },
    data: { status: 'DELETED' },
  });

  // Log deletion
  await auditLogger.logPHIAccess(
    'DELETE',
    patientId,
    'PATIENT',
    PHIResourceType.DOCUMENT,
    documentId,
    auditContext,
    {
      documentType: document.documentType,
      fileName: document.fileName,
    }
  );
}

// ============================================================================
// Error Classes
// ============================================================================

export class DocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentValidationError';
  }
}

export class DocumentNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentNotFoundError';
  }
}

export class DocumentAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentAccessError';
  }
}

// ============================================================================
// Service Export
// ============================================================================

/**
 * Document Service class
 * Provides a consistent interface for document operations
 */
export class DocumentService {
  static async generatePresignedUploadUrl(
    patientId: string,
    fileName: string,
    fileType: string,
    fileSize: number,
    documentType: 'id' | 'insurance' | 'medical' | 'consent' | 'other',
    auditContext: AuditContext
  ): Promise<PresignedUploadResult> {
    return generatePresignedUploadUrl(
      patientId,
      fileName,
      fileType,
      fileSize,
      documentType,
      auditContext
    );
  }

  static async generatePresignedDownloadUrl(
    patientId: string,
    documentId: string,
    auditContext: AuditContext
  ): Promise<PresignedDownloadResult> {
    return generatePresignedDownloadUrl(patientId, documentId, auditContext);
  }

  static async confirmDocumentUpload(
    patientId: string,
    key: string,
    fileName: string,
    fileSize: number,
    mimeType: string,
    documentType: 'ID_VERIFICATION' | 'INSURANCE_CARD' | 'MEDICAL_RECORD' | 'CONSENT_FORM' | 'OTHER'
  ): Promise<DocumentMetadata> {
    return confirmDocumentUpload(
      patientId,
      key,
      fileName,
      fileSize,
      mimeType,
      documentType
    );
  }

  static async listPatientDocuments(
    patientId: string,
    documentType?: string
  ): Promise<DocumentMetadata[]> {
    return listPatientDocuments(patientId, documentType);
  }

  static async deleteDocument(
    patientId: string,
    documentId: string,
    auditContext: AuditContext
  ): Promise<void> {
    return deleteDocument(patientId, documentId, auditContext);
  }
}

export default DocumentService;
