/**
 * POST /api/patient/documents
 * Generate presigned URL for document upload
 * 
 * HIPAA Compliance:
 * - Validates file type and size
 * - Generates time-limited presigned URL
 * - Logs document upload initiation
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { DocumentService } from '@/lib/services/document-service';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { documentUploadSchema } from '@/lib/validation/schemas';
import { Role } from '@prisma/client';
import { PHIResourceType } from '@/lib/audit/index';

// ============================================================================
// POST - Generate Upload URL
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Require patient role
  const auth = await requireRole(request, [Role.PATIENT]);
  
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const auditContext = AuditService.createAuditContext(request, userId, 'PATIENT');

  try {
    // Validate request body
    const validation = await ValidationService.validateRequestBody(
      request,
      documentUploadSchema
    );

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const { fileName, fileType, documentType, fileSize } = validation.data!;

    // Generate presigned URL
    const result = await DocumentService.generatePresignedUploadUrl(
      userId,
      fileName,
      fileType,
      fileSize,
      documentType,
      auditContext
    );

    return NextResponse.json({
      success: true,
      uploadUrl: result.url,
      key: result.key,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error('Document upload error:', error instanceof Error ? error.message : 'Unknown error');
    
    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/patient/documents',
      auditContext,
      userId
    );

    if (error instanceof Error && error.name === 'DocumentValidationError') {
      return NextResponse.json(
        { error: error.message, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate upload URL', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - List Documents
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Require patient role
  const auth = await requireRole(request, [Role.PATIENT]);
  
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const auditContext = AuditService.createAuditContext(request, userId, 'PATIENT');

  try {
    // Get document type filter from query params
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('type') || undefined;

    // List documents
    const documents = await DocumentService.listPatientDocuments(userId, documentType);

    // Log access
    await AuditService.logPHIAccess(
      'VIEW',
      userId,
      'PATIENT',
      PHIResourceType.DOCUMENT,
      'list',
      auditContext,
      { recordCount: documents.length }
    );

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('List documents error:', error instanceof Error ? error.message : 'Unknown error');
    
    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/patient/documents',
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to list documents', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
