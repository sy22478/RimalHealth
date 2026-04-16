/**
 * GET /api/patient/documents
 * List patient documents
 *
 * HIPAA Compliance:
 * - Requires patient role
 * - Logs document list access
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { DocumentService } from '@/lib/services/document-service';
import { AuditService } from '@/lib/services/audit-service';
import { Role } from '@prisma/client';
import { PHIResourceType } from '@/lib/audit/index';

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
