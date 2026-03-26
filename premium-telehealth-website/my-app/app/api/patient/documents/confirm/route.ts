/**
 * Document Upload Confirmation API
 * POST: Confirm successful S3 upload and create database record
 *
 * @module app/api/patient/documents/confirm
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { getObjectInfo } from '@/lib/integrations/s3';
import { auditPHIAccess, createAuditContext, PHIResourceType } from '@/lib/audit/index';
import { DocumentType, DocumentStatus, Role } from '@prisma/client';

// Validation schema
const confirmUploadSchema = z.object({
  key: z.string().min(1, 'S3 key is required'),
  documentType: z.enum([
    DocumentType.ID_VERIFICATION,
    DocumentType.INSURANCE_CARD,
    DocumentType.MEDICAL_RECORD,
    DocumentType.CONSENT_FORM,
    DocumentType.OTHER,
  ]),
});

/**
 * POST /api/patient/documents/confirm
 * Confirm document upload and create database record
 *
 * Flow:
 * 1. Validate user is authenticated and has PATIENT role
 * 2. Verify file exists in S3
 * 3. Create Document record in database
 * 4. Log audit event
 * 5. Return document info
 *
 * HIPAA: Document creation is logged as PHI access
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Require patient role
  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const userId = auth.user.userId;

    // Parse and validate request body
    const body = await request.json();
    const validation = confirmUploadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { key, documentType } = validation.data;

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

    // Verify file exists in S3
    const objectInfo = await getObjectInfo(key);

    if (!objectInfo) {
      return NextResponse.json(
        { error: 'File not found in storage' },
        { status: 404 }
      );
    }

    // Extract filename from key
    const fileName = key.split('/').pop() || 'unknown';
    // Remove timestamp prefix from filename
    const cleanFileName = fileName.replace(/^\d+-/, '');

    // Create document record
    const document = await prisma.document.create({
      data: {
        patientId: patientProfile.id,
        documentType,
        fileName: cleanFileName,
        fileSize: objectInfo.size,
        mimeType: objectInfo.contentType || 'application/octet-stream',
        s3Key: key,
        s3Bucket: process.env.AWS_S3_BUCKET_NAME || '',
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

    // Audit log - PHI access (document created)
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
        fileName: cleanFileName,
        fileSize: objectInfo.size,
      }
    );

    return NextResponse.json({
      success: true,
      document,
      message: 'Document uploaded successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('Error confirming document upload:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to confirm upload' },
      { status: 500 }
    );
  }
}
