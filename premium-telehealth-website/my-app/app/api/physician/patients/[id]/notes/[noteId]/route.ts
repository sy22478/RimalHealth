/**
 * Physician Clinical Note Operations API
 *
 * PUT    /api/physician/patients/[id]/notes/[noteId] - Update note
 * DELETE /api/physician/patients/[id]/notes/[noteId] - Delete note
 *
 * HIPAA Compliance:
 * - PHYSICIAN role required
 * - Physicians can only edit/delete their own notes
 * - All operations are audit logged
 * - PHI encrypted at rest via Prisma extension
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import {
  updateClinicalNote,
  deleteClinicalNote,
} from '@/lib/physician/patients';
import { auditLogger, PHIResourceType } from '@/lib/audit/index';
import { getClientIP } from '@/lib/audit/utils';
import { Role } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string; noteId: string }>;
}

// Validation schema
const updateNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(10000, 'Note too long'),
});

// ============================================================================
// PUT - Update Note
// ============================================================================

export async function PUT(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
  if (auth instanceof NextResponse) return auth;

  const { userId } = auth.user;
  const requestId = crypto.randomUUID();
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';

  try {
    const { id: patientId, noteId } = await context.params;

    // Look up the physician record (PhysicianNote FK references Physician.id, not User.id)
    const physician = await prisma.physician.findFirst({
      where: { userId },
      select: { id: true },
    });

    if (!physician) {
      return NextResponse.json(
        { error: 'Physician profile not found' },
        { status: 404 }
      );
    }

    // Validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validation = updateNoteSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    // Update note — pass Physician.id (not User.id) since PhysicianNote.physicianId references Physician.id
    const note = await updateClinicalNote(
      noteId,
      physician.id,
      validation.data.content,
      { ipAddress, userAgent, requestId }
    );

    if (!note) {
      return NextResponse.json(
        { error: 'Note not found or you do not have permission to edit it' },
        { status: 404 }
      );
    }

    // Audit log the PHI modification
    await auditLogger.logPHIAccess(
      'UPDATE',
      userId,
      auth.user.role,
      PHIResourceType.PHYSICIAN_NOTE,
      noteId,
      { ipAddress, userAgent, requestId },
      { accessReason: `Updated note for patient ${patientId}` }
    );

    return NextResponse.json({
      success: true,
      data: note,
      message: 'Clinical note updated successfully',
    });

  } catch (error) {
    console.error('[Physician Notes PUT] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Delete Note
// ============================================================================

export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
  if (auth instanceof NextResponse) return auth;

  const { userId } = auth.user;
  const requestId = crypto.randomUUID();
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';

  try {
    const { id: patientId, noteId } = await context.params;

    // Look up the physician record (PhysicianNote FK references Physician.id, not User.id)
    const physician = await prisma.physician.findFirst({
      where: { userId },
      select: { id: true },
    });

    if (!physician) {
      return NextResponse.json(
        { error: 'Physician profile not found' },
        { status: 404 }
      );
    }

    // Delete note — pass Physician.id (not User.id)
    const deleted = await deleteClinicalNote(
      noteId,
      physician.id,
      { ipAddress, userAgent, requestId }
    );

    if (!deleted) {
      return NextResponse.json(
        { error: 'Note not found or you do not have permission to delete it' },
        { status: 404 }
      );
    }

    // Audit log the PHI deletion
    await auditLogger.logPHIAccess(
      'DELETE',
      userId,
      auth.user.role,
      PHIResourceType.PHYSICIAN_NOTE,
      noteId,
      { ipAddress, userAgent, requestId },
      { accessReason: `Deleted note for patient ${patientId}` }
    );

    return NextResponse.json({
      success: true,
      message: 'Clinical note deleted successfully',
    });

  } catch (error) {
    console.error('[Physician Notes DELETE] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
