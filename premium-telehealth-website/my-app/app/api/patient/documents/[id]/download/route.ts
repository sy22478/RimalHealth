/**
 * Document Download API
 * GET: Stream document from storage (Netlify Blobs or S3)
 *
 * @module app/api/patient/documents/[id]/download
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { downloadFile } from '@/lib/integrations/storage';
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

    // Download file from storage
    const fileBuffer = await downloadFile(document.s3Key);

    // Support inline viewing for images via ?mode=view
    const mode = request.nextUrl.searchParams.get('mode');
    const isInlineView = mode === 'view' && document.mimeType?.startsWith('image/');
    const disposition = isInlineView
      ? `inline; filename="${document.fileName}"`
      : `attachment; filename="${document.fileName}"`;

    // Audit log - PHI access (document downloaded/viewed)
    const auditContext = createAuditContext(request);
    await auditPHIAccess(
      userId,
      PHIResourceType.DOCUMENT,
      document.id,
      isInlineView ? 'VIEW' : 'DOWNLOAD',
      auditContext,
      {
        accessReason: isInlineView ? 'Patient viewed document' : 'Patient downloaded document',
        documentType: document.documentType,
        fileName: document.fileName,
        fileSize: document.fileSize,
      }
    );

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': document.mimeType || 'application/octet-stream',
        'Content-Disposition': disposition,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'no-store',
      },
    });

  } catch (error) {
    console.error('Error generating download URL:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to generate download URL' },
      { status: 500 }
    );
  }
}
