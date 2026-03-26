/**
 * POST /api/physician/patients/:id/notes
 * Create a new physician note for a patient
 * 
 * HIPAA Compliance:
 * - Requires PHYSICIAN or ADMIN role
 * - Logs note creation to audit log
 * - Content encrypted at rest via Prisma extension
 * 
 * Body: { content: string, type: 'CLINICAL' | 'ADMINISTRATIVE' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { Role } from '@prisma/client';
import { DataModificationAction } from '@/lib/audit/index';
import { PHIResourceType } from '@/lib/audit/types';
// PHI encryption/decryption is handled automatically by the Prisma encryption extension.
// Do NOT manually call encryptPHI/decryptPHI on fields in PHI_FIELDS.

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Validation schema for creating a note
const createNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(10000, 'Note too long'),
  type: z.enum(['CLINICAL', 'ADMINISTRATIVE']).default('CLINICAL'),
});

// ============================================================================
// POST - Create Note
// ============================================================================

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  // Require physician or admin role
  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
  
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const { id: patientId } = await context.params;
  const auditContext = AuditService.createAuditContext(
    request,
    userId,
    auth.user.role
  );

  try {
    // Validate UUID
    const uuidValidation = ValidationService.validateUUID(patientId);
    if (!uuidValidation.success) {
      return NextResponse.json(
        { error: 'Invalid patient ID', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Validate request body
    const validation = await ValidationService.validateRequestBody(
      request,
      createNoteSchema
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

    const { content, type } = validation.data!;

    // Get physician profile
    const physician = await prisma.physician.findUnique({
      where: { userId },
    });

    if (!physician) {
      return NextResponse.json(
        { error: 'Physician profile not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify patient exists
    const patient = await prisma.patientProfile.findUnique({
      where: { userId: patientId },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Create the note with encrypted content
    const note = await prisma.physicianNote.create({
      data: {
        patientId,
        physicianId: physician.id,
        content,
      },
    });

    // Log to audit log
    await AuditService.logDataModification(
      DataModificationAction.CREATE,
      userId,
      'PHYSICIAN_NOTE',
      note.id,
      auditContext,
      ['content', 'type'],
      `Physician created ${type.toLowerCase()} note for patient ${patientId}`
    );

    // Also log PHI access for the patient
    await AuditService.logPatientProfileAccess(
      userId,
      auth.user.role,
      patientId,
      'UPDATE',
      auditContext
    );

    return NextResponse.json({
      success: true,
      note: {
        id: note.id,
        patientId: note.patientId,
        physicianId: note.physicianId,
        content: content, // Return decrypted for immediate use
        type,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
        physician: {
          firstName: physician.firstName,
          lastName: physician.lastName,
        },
      },
      message: 'Note created successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('[Physician Notes POST] Error:', error instanceof Error ? error.message : 'Unknown error');
    
    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      `/api/physician/patients/${patientId}/notes`,
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to create note', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET - List Notes (optional - for convenience)
// ============================================================================

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  // Require physician or admin role
  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
  
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const { id: patientId } = await context.params;
  const auditContext = AuditService.createAuditContext(
    request,
    userId,
    auth.user.role
  );

  try {
    // Validate UUID
    const uuidValidation = ValidationService.validateUUID(patientId);
    if (!uuidValidation.success) {
      return NextResponse.json(
        { error: 'Invalid patient ID', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Verify patient exists
    const patient = await prisma.patientProfile.findUnique({
      where: { userId: patientId },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Fetch notes with physician info
    const notes = await prisma.physicianNote.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        physician: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    // Log PHI access
    await AuditService.logPHIAccess(
      'VIEW',
      userId,
      auth.user.role,
      'PHYSICIAN_NOTE' as PHIResourceType,
      patientId,
      auditContext,
      { recordCount: notes.length }
    );

    // Format notes — content is already decrypted by the Prisma encryption extension
    const formattedNotes = notes.map((note) => ({
      id: note.id,
      patientId: note.patientId,
      physicianId: note.physicianId,
      content: note.content,
      physician: note.physician,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      notes: formattedNotes,
    });

  } catch (error) {
    console.error('[Physician Notes GET] Error:', error instanceof Error ? error.message : 'Unknown error');
    
    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      `/api/physician/patients/${patientId}/notes`,
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to retrieve notes', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
