/**
 * Document Management Utilities
 * 
 * Client-side utilities for document upload, validation, and management.
 * 
 * @module lib/patient/documents
 */

import {
  ALLOWED_DOCUMENT_TYPES,
  MAX_FILE_SIZE,
} from '@/lib/integrations/s3';

// ============================================
// Types
// ============================================

/**
 * Document type enum matching Prisma schema
 */
export enum DocumentType {
  ID_VERIFICATION = 'ID_VERIFICATION',
  INSURANCE_CARD = 'INSURANCE_CARD',
  MEDICAL_RECORD = 'MEDICAL_RECORD',
  CONSENT_FORM = 'CONSENT_FORM',
  OTHER = 'OTHER',
}

/**
 * Document status enum matching Prisma schema
 */
export enum DocumentStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  DELETED = 'DELETED',
}

/**
 * Document data structure
 */
export interface Document {
  id: string;
  patientId: string;
  documentType: DocumentType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  s3Key: string;
  s3Bucket: string;
  status: DocumentStatus;
  uploadedAt: string;
  expiresAt?: string;
  downloadUrl?: string;
}

/**
 * File validation result
 */
export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Upload progress state
 */
export interface UploadProgress {
  status: 'idle' | 'validating' | 'requesting_url' | 'uploading' | 'confirming' | 'success' | 'error';
  progress: number; // 0-100
  error?: string;
}


// ============================================
// Constants
// ============================================

/**
 * Human-readable labels for document types
 */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  [DocumentType.ID_VERIFICATION]: 'ID Verification',
  [DocumentType.INSURANCE_CARD]: 'Insurance Card',
  [DocumentType.MEDICAL_RECORD]: 'Medical Record',
  [DocumentType.CONSENT_FORM]: 'Consent Form',
  [DocumentType.OTHER]: 'Other Document',
};

/**
 * Document type descriptions for UI
 */
export const DOCUMENT_TYPE_DESCRIPTIONS: Record<DocumentType, string> = {
  [DocumentType.ID_VERIFICATION]: 'Driver\'s license, passport, or state ID',
  [DocumentType.INSURANCE_CARD]: 'Front and back of your insurance card',
  [DocumentType.MEDICAL_RECORD]: 'Previous medical records or test results',
  [DocumentType.CONSENT_FORM]: 'Signed consent or authorization forms',
  [DocumentType.OTHER]: 'Any other relevant documentation',
};

/**
 * File type icons mapping
 */
export const FILE_TYPE_ICONS: Record<string, string> = {
  'application/pdf': 'file-text',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/heic': 'image',
  'image/heif': 'image',
};

/**
 * Allowed file types for client-side validation
 */
export const ALLOWED_FILE_TYPES = [...ALLOWED_DOCUMENT_TYPES];

/**
 * Maximum file size (10MB)
 */
export const MAX_UPLOAD_SIZE = MAX_FILE_SIZE;

// ============================================
// Validation Functions
// ============================================

/**
 * Validate a file for upload
 * 
 * @param file - File to validate
 * @returns Validation result
 */
export function validateFile(file: File): FileValidationResult {
  // Check file exists
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }

  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.type as typeof ALLOWED_FILE_TYPES[number])) {
    const allowedTypes = ALLOWED_FILE_TYPES
      .map(t => t.split('/')[1].toUpperCase())
      .join(', ');
    return { 
      valid: false, 
      error: `Invalid file type. Allowed types: ${allowedTypes}` 
    };
  }

  // Check file size
  if (file.size > MAX_UPLOAD_SIZE) {
    const maxSizeMB = MAX_UPLOAD_SIZE / (1024 * 1024);
    return { 
      valid: false, 
      error: `File too large. Maximum size: ${maxSizeMB}MB` 
    };
  }

  // Check file is not empty
  if (file.size === 0) {
    return { valid: false, error: 'File is empty' };
  }

  return { valid: true };
}

/**
 * Validate document type
 * 
 * @param type - Document type to validate
 * @returns True if valid
 */
export function isValidDocumentType(type: string): type is DocumentType {
  return Object.values(DocumentType).includes(type as DocumentType);
}

// ============================================
// Formatting Utilities
// ============================================

/**
 * Format file size for display
 * 
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "2.3 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format date for display
 * 
 * @param dateString - ISO date string
 * @returns Formatted date (e.g., "Jan 15, 2026")
 */
export function formatDocumentDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get file icon based on mime type
 * 
 * @param mimeType - File MIME type
 * @returns Icon identifier
 */
export function getFileIcon(mimeType: string): string {
  return FILE_TYPE_ICONS[mimeType] || 'file';
}

/**
 * Get file extension from mime type
 * 
 * @param mimeType - File MIME type
 * @returns File extension
 */
export function getFileExtension(mimeType: string): string {
  const extensions: Record<string, string> = {
    'application/pdf': 'PDF',
    'image/jpeg': 'JPG',
    'image/jpg': 'JPG',
    'image/png': 'PNG',
    'image/heic': 'HEIC',
    'image/heif': 'HEIF',
  };
  return extensions[mimeType] || 'FILE';
}

// ============================================
// API Functions
// ============================================

/**
 * Upload file directly to the server (Netlify Blobs backend)
 *
 * @param file - File to upload
 * @param documentType - Type of document
 * @param onProgress - Progress callback (0–100)
 */
export async function uploadToServer(
  file: File,
  documentType: DocumentType,
  onProgress?: (progress: number) => void
): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        try {
          const result = JSON.parse(xhr.responseText);
          reject(new Error(result.error || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed. Please try again.'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload was cancelled.'));
    });

    xhr.open('POST', '/api/patient/documents/upload');
    xhr.withCredentials = true;
    xhr.send(formData);
  });
}

/**
 * Fetch user's documents
 * 
 * @returns Array of documents
 */
export async function fetchDocuments(): Promise<Document[]> {
  const response = await fetch('/api/patient/documents', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch documents');
  }

  const data = await response.json();
  return data.documents;
}

/**
 * Delete a document
 * 
 * @param documentId - Document ID to delete
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const response = await fetch(`/api/patient/documents/${documentId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete document');
  }
}

/**
 * Download a document as a Blob
 *
 * @param documentId - Document ID
 * @returns Object URL that can be used for download
 */
export async function getDownloadUrl(documentId: string): Promise<string> {
  const response = await fetch(`/api/patient/documents/${documentId}/download`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error('Failed to download document');
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

// ============================================
// Upload Helper
// ============================================

/**
 * Complete upload flow: validate → upload to server → done
 *
 * @param file - File to upload
 * @param documentType - Document type
 * @param onProgress - Progress callback
 * @returns Promise that resolves when upload is complete
 */
export async function uploadDocument(
  file: File,
  documentType: DocumentType,
  onProgress?: (state: UploadProgress) => void
): Promise<void> {
  // Step 1: Validate
  onProgress?.({ status: 'validating', progress: 0 });
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Step 2: Upload directly to server (stores in Netlify Blobs + creates DB record)
  onProgress?.({ status: 'uploading', progress: 10 });
  await uploadToServer(file, documentType, (progress) => {
    onProgress?.({ status: 'uploading', progress: 10 + Math.round(progress * 0.85) });
  });

  // Success
  onProgress?.({ status: 'success', progress: 100 });
}
