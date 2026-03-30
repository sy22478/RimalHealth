/**
 * Document Upload URL API
 * POST: Generate presigned URL for direct S3 upload
 *
 * @module app/api/patient/documents/upload-url
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import {
  generateUploadUrl,
  generateDocumentKey,
  isAllowedFileType,
  MAX_FILE_SIZE,
} from '@/lib/integrations/s3';
import { auditLog, createAuditContext, AuditEventType } from '@/lib/audit/index';
import { DocumentType, Role } from '@prisma/client';

// Validation schema
const uploadUrlSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  contentType: z.string().min(1, 'Content type is required'),
  documentType: z.enum([
    DocumentType.ID_VERIFICATION,
    DocumentType.INSURANCE_CARD,
    DocumentType.MEDICAL_RECORD,
    DocumentType.CONSENT_FORM,
    DocumentType.INTAKE_FORM,
    DocumentType.OTHER,
  ]),
  fileSize: z.number().positive('File size must be positive'),
});

/**
 * POST /api/patient/documents/upload-url
 * Generate presigned URL for document upload
 *
 * Flow:
 * 1. Validate user is authenticated and has PATIENT role
 * 2. Validate file type and size
 * 3. Generate unique S3 key
 * 4. Generate presigned URL
 * 5. Log audit event
 * 6. Return URL to client
 *
 * HIPAA: All document uploads are logged
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Require patient role
  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const userId = auth.user.userId;
    const userRole = 'PATIENT';

    // Parse and validate request body
    const body = await request.json();
    const validation = uploadUrlSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { fileName, contentType, documentType, fileSize } = validation.data;

    // Validate file type
    if (!isAllowedFileType(contentType)) {
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 400 }
      );
    }

    // Validate file size
    if (fileSize > MAX_FILE_SIZE) {
      const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
      return NextResponse.json(
        { error: `File too large. Maximum size: ${maxSizeMB}MB` },
        { status: 400 }
      );
    }

    // Get patient profile
    const patientProfile = await prisma.patientProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!patientProfile) {
      return NextResponse.json(
        { error: 'Patient profile not found' },
        { status: 404 }
      );
    }

    // Map document type to S3 key type
    const s3DocumentTypeMap: Record<DocumentType, 'id' | 'insurance' | 'medical' | 'consent' | 'other'> = {
      [DocumentType.ID_VERIFICATION]: 'id',
      [DocumentType.INSURANCE_CARD]: 'insurance',
      [DocumentType.MEDICAL_RECORD]: 'medical',
      [DocumentType.CONSENT_FORM]: 'consent',
      [DocumentType.INTAKE_FORM]: 'medical',
      [DocumentType.OTHER]: 'other',
    };

    // Generate S3 key
    const key = generateDocumentKey({
      userId: patientProfile.id,
      documentType: s3DocumentTypeMap[documentType],
      fileName,
    });

    // Generate presigned upload URL (15 minute expiry)
    const uploadData = await generateUploadUrl({
      key,
      contentType,
      expiresIn: 900, // 15 minutes
      metadata: {
        userId: patientProfile.id,
        documentType,
        uploadedBy: userRole,
        originalFileName: fileName,
      },
    });

    // Audit log - document upload initiated
    const auditContext = createAuditContext(request);
    await auditLog(
      AuditEventType.PATIENT_DATA_CREATED,
      {
        userId,
        userRole,
        action: 'Document upload initiated',
        resourceType: 'Document',
        resourceId: key,
        success: true,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        metadata: {
          documentType,
          fileName,
          fileSize,
          contentType,
        },
      },
      auditContext
    );

    return NextResponse.json({
      uploadUrl: uploadData.url,
      key: uploadData.key,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

  } catch (error) {
    console.error('Error generating upload URL:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
