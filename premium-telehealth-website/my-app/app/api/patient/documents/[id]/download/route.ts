/**
 * Document Download API
 * GET: Generate presigned URL for document download
 *
 * @module app/api/patient/documents/[id]/download
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { generateDownloadUrl } from '@/lib/integrations/s3';
import { auditPHIAccess, createAuditContext, PHIResourceType } from '@/lib/audit/index';
import { DocumentStatus, Role } from '@prisma/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/patient/documents/[id]/download
 * Generate presigned download URL for a document
 *
 * Flow:
 * 1. Validate user is authenticated and has PATIENT role
 * 2. Verify document ownership
 * 3. Generate presigned download URL (5 min expiry)
 * 4. Log audit event
 * 5. Return download URL
 *
 * HIPAA: Download access is logged with document ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  // Require patient role
  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const { id } = await params;
    const userId = auth.user.userId;

    // Fetch document — Document.patientId FK references PatientProfile.userId
    const document = await prisma.document.findFirst({
      where: {
        id,
        patientId: userId,
        status: { not: DocumentStatus.DELETED },
      },
      select: {
        id: true,
        s3Key: true,
        fileName: true,
        mimeType: true,
        documentType: true,
        fileSize: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Virtual documents (like INTAKE_FORM) have no S3 key
    if (!document.s3Key) {
      return NextResponse.json(
        { error: 'This document does not have a downloadable file' },
        { status: 400 }
      );
    }

    // Generate presigned download URL (5 minute expiry for security)
    const downloadUrl = await generateDownloadUrl({
      key: document.s3Key,
      expiresIn: 300, // 5 minutes
    });

    // Audit log - PHI access (document downloaded)
    const auditContext = createAuditContext(request);
    await auditPHIAccess(
      userId,
      PHIResourceType.DOCUMENT,
      document.id,
      'DOWNLOAD',
      auditContext,
      {
        accessReason: 'Patient downloaded document',
        documentType: document.documentType,
        fileName: document.fileName,
        fileSize: document.fileSize,
      }
    );

    return NextResponse.json({
      downloadUrl,
      fileName: document.fileName,
      mimeType: document.mimeType,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });

  } catch (error) {
    console.error('Error generating download URL:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to generate download URL' },
      { status: 500 }
    );
  }
}
