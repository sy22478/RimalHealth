/**
 * Document Detail API
 * GET: Get document details
 * DELETE: Delete a document
 *
 * @module app/api/patient/documents/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { deleteFile } from '@/lib/integrations/s3';
import { auditPHIAccess, createAuditContext, PHIResourceType } from '@/lib/audit/index';
import { DocumentStatus, Role } from '@prisma/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/patient/documents/[id]
 * Get details of a specific document
 *
 * HIPAA: Validates patient ownership before returning document info
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
        patientId: true,
        documentType: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        s3Key: true,
        s3Bucket: true,
        status: true,
        uploadedAt: true,
        expiresAt: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Audit log - PHI access
    const auditContext = createAuditContext(request);
    await auditPHIAccess(
      userId,
      PHIResourceType.DOCUMENT,
      document.id,
      'VIEW',
      auditContext,
      {
        accessReason: 'Patient viewed document details',
        documentType: document.documentType,
        fileName: document.fileName,
      }
    );

    return NextResponse.json({ document });

  } catch (error) {
    console.error('Error fetching document:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/patient/documents/[id]
 * Soft delete a document (marks as DELETED in DB and removes from S3)
 * 
 * HIPAA: Validates patient ownership before deletion
 */
export async function DELETE(
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

    // Find document — Document.patientId FK references PatientProfile.userId
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
        documentType: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Delete file from S3 (only for documents with an S3 key)
    if (document.s3Key) {
      try {
        await deleteFile(document.s3Key);
      } catch (s3Error) {
        console.error('Error deleting file from S3:', s3Error instanceof Error ? s3Error.message : 'Unknown error');
        // Continue with DB update even if S3 deletion fails
        // The file will be orphaned but marked as deleted in DB
      }
    }

    // Soft delete in database
    await prisma.document.update({
      where: { id },
      data: {
        status: DocumentStatus.DELETED,
      },
    });

    // Audit log - PHI access (document deleted)
    const auditContext = createAuditContext(request);
    await auditPHIAccess(
      userId,
      PHIResourceType.DOCUMENT,
      document.id,
      'DELETE',
      auditContext,
      {
        accessReason: 'Patient deleted document',
        documentType: document.documentType,
        fileName: document.fileName,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting document:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
