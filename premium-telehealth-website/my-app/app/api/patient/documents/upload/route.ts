/**
 * Document Upload API (S3)
 * POST: Accept file upload directly and store in S3
 *
 * Replaces the presigned-URL flow (upload-url → S3 PUT → confirm)
 * with a single request: client POSTs FormData → server stores in Blobs + creates DB record.
 *
 * @module app/api/patient/documents/upload
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { enforceRateLimit } from '@/lib/middleware/rate-limit';
import { prisma } from '@/lib/db/prisma';
import { uploadFile, isAllowedFileType, MAX_FILE_SIZE, generateDocumentKey } from '@/lib/integrations/storage';
import { auditPHIAccess, createAuditContext, PHIResourceType } from '@/lib/audit/index';
import { DocumentType, DocumentStatus, Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

const VALID_DOCUMENT_TYPES = new Set<string>([
  DocumentType.ID_VERIFICATION,
  DocumentType.INSURANCE_CARD,
  DocumentType.MEDICAL_RECORD,
  DocumentType.CONSENT_FORM,
  DocumentType.INTAKE_FORM,
  DocumentType.OTHER,
]);

/**
 * POST /api/patient/documents/upload
 * Accept file via FormData and store in S3
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Strict limit on uploads — they cost storage + bandwidth (10/hour/IP).
  const limited = await enforceRateLimit(request, {
    requests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyPrefix: 'ratelimit:upload',
    useMemoryFallback: true,
  });
  if (limited) return limited;

  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) return auth;

  try {
    const userId = auth.user.userId;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentType = formData.get('documentType') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!documentType || !VALID_DOCUMENT_TYPES.has(documentType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }

    if (!isAllowedFileType(file.type)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      const maxMB = MAX_FILE_SIZE / (1024 * 1024);
      return NextResponse.json({ error: `File too large. Maximum size: ${maxMB}MB` }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    // Verify patient profile exists
    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId },
      select: { userId: true },
    });

    if (!patientProfile) {
      return NextResponse.json({ error: 'Patient profile not found' }, { status: 404 });
    }

    // Map Prisma DocumentType to s3 key type
    const typeMap: Record<string, 'id' | 'insurance' | 'medical' | 'consent' | 'other'> = {
      [DocumentType.ID_VERIFICATION]: 'id',
      [DocumentType.INSURANCE_CARD]: 'insurance',
      [DocumentType.MEDICAL_RECORD]: 'medical',
      [DocumentType.CONSENT_FORM]: 'consent',
      [DocumentType.INTAKE_FORM]: 'medical',
      [DocumentType.OTHER]: 'other',
    };

    const key = generateDocumentKey({
      userId,
      documentType: typeMap[documentType] || 'other',
      fileName: file.name,
    });

    // Store file
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadFile(key, buffer, file.type, {
      originalName: file.name,
      uploadedBy: 'PATIENT',
    });

    // Create DB record
    const document = await prisma.document.create({
      data: {
        patientId: userId,
        documentType: documentType as DocumentType,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        s3Key: key,
        s3Bucket: process.env.AWS_S3_BUCKET_NAME || 'rimalhealth-documents',
        status: DocumentStatus.ACTIVE,
      },
      select: {
        id: true,
        patientId: true,
        documentType: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        status: true,
        uploadedAt: true,
      },
    });

    // Audit log
    const auditContext = createAuditContext(request);
    await auditPHIAccess(
      userId,
      PHIResourceType.DOCUMENT,
      document.id,
      'CREATE',
      auditContext,
      {
        accessReason: 'Patient uploaded document',
        documentType,
        fileName: file.name,
        fileSize: file.size,
      }
    );

    return NextResponse.json({
      success: true,
      document,
      message: 'Document uploaded successfully',
    }, { status: 201 });
  } catch (error) {
    // Surface enough detail in CloudWatch to diagnose S3 misconfiguration
    // without leaking anything sensitive to the client. AWS SDK v3 errors
    // carry a discriminating `name` (e.g. NoSuchBucket, AccessDenied,
    // InvalidAccessKeyId, CredentialsProviderError) and a structured
    // $metadata object with the HTTP status code.
    const err = error as {
      name?: string;
      message?: string;
      Code?: string;
      $metadata?: { httpStatusCode?: number; requestId?: string };
      cause?: { name?: string; message?: string; Code?: string };
    };
    const rootErr = err?.cause ?? err;
    const errName = rootErr?.name ?? err?.name ?? 'UnknownError';
    const errCode = rootErr?.Code ?? err?.Code;
    const httpStatus = err?.$metadata?.httpStatusCode;
    const requestId = err?.$metadata?.requestId;
    console.error('Error uploading document:', {
      errName,
      errCode,
      httpStatus,
      requestId,
      message: err?.message ?? 'Unknown error',
      hasBucketEnv: Boolean(process.env.AWS_S3_BUCKET_NAME),
      region: process.env.AWS_REGION ?? 'unset',
    });

    // Map well-known configuration/permission failures to a clearer response
    // so the operator can diagnose from the frontend behaviour. Anything else
    // falls back to a generic 500.
    const configCodes = new Set([
      'NoSuchBucket',
      'AccessDenied',
      'InvalidAccessKeyId',
      'SignatureDoesNotMatch',
      'CredentialsProviderError',
      'ExpiredToken',
    ]);
    if (configCodes.has(errName) || configCodes.has(errCode ?? '')) {
      return NextResponse.json(
        {
          error:
            'Document storage is temporarily unavailable. Please try again shortly.',
          code: 'STORAGE_UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
