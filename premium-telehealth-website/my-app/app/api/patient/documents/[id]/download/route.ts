/**
 * Document Download API
 * GET: Stream document from storage (S3)
 *
 * @module app/api/patient/documents/[id]/download
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { downloadFile, getContentType } from '@/lib/integrations/storage';
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

    // Download file from storage (S3)
    let fileBuffer: Buffer;
    try {
      fileBuffer = await downloadFile(document.s3Key);
    } catch {
      return NextResponse.json(
        { error: 'File not found in storage' },
        { status: 404 }
      );
    }

    // Resolve Content-Type. Fall back to file-extension lookup when the
    // stored MIME type is missing or is the generic octet-stream — otherwise
    // the browser refuses to render images/PDFs inline and shows raw bytes.
    const storedMime = document.mimeType;
    const isUsableMime = Boolean(storedMime) && storedMime !== 'application/octet-stream';
    const resolvedMime = isUsableMime
      ? storedMime
      : getContentType(document.fileName);

    // Support inline viewing for images and PDFs via ?mode=view
    const mode = request.nextUrl.searchParams.get('mode');
    const viewableMime = resolvedMime.startsWith('image/') || resolvedMime === 'application/pdf';
    const isInlineView = mode === 'view' && viewableMime;

    // Sanitize filename for the Content-Disposition header to prevent CRLF /
    // quote injection. Keep ASCII-safe chars only for the `filename=` form and
    // also emit an RFC 6266 `filename*` token so Unicode names still round-trip.
    const rawName = document.fileName || 'document';
    const safeName = rawName.replace(/[^\w.-]/g, '_');
    const encodedName = encodeURIComponent(rawName).replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16)}`);
    const dispositionType = isInlineView ? 'inline' : 'attachment';
    const disposition = `${dispositionType}; filename="${safeName}"; filename*=UTF-8''${encodedName}`;

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
        'Content-Type': resolvedMime,
        'Content-Disposition': disposition,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'no-store',
      },
    });

  } catch (error) {
    console.error('Error downloading document:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to download document' },
      { status: 500 }
    );
  }
}
