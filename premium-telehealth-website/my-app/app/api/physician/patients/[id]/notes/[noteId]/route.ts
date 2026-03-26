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
import { verifyAccessToken } from '@/lib/auth/jwt';
import {
  updateClinicalNote,
  deleteClinicalNote,
} from '@/lib/physician/patients';
import { auditLogger } from '@/lib/audit/index';
import { getClientIP } from '@/lib/audit/utils';

interface RouteContext {
  params: Promise<{ id: string; noteId: string }>;
}

// Validation schema
const updateNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(10000, 'Note too long'),
});

/**
 * Verify physician access and extract user info
 */
async function verifyPhysicianAccess(
  request: NextRequest
): Promise<{ authorized: boolean; userId?: string; physicianProfileId?: string }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { authorized: false };
  }

  const token = authHeader.substring(7);
  
  try {
    const payload = await verifyAccessToken(token);
    
    if (payload.role !== 'PHYSICIAN' && payload.role !== 'ADMIN') {
      return { authorized: false };
    }

    return {
      authorized: true,
      userId: payload.userId,
      physicianProfileId: payload.userId,
    };
  } catch {
    return { authorized: false };
  }
}

// ============================================================================
// PUT - Update Note
// ============================================================================

export async function PUT(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';

  try {
    const { id: _patientId, noteId } = await context.params;

    // Verify access
    const access = await verifyPhysicianAccess(request);
    
    if (!access.authorized || !access.userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Physician access required.' },
        { status: 403 }
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

    // Update note
    const note = await updateClinicalNote(
      noteId,
      access.userId,
      validation.data.content,
      { ipAddress, userAgent, requestId }
    );

    if (!note) {
      return NextResponse.json(
        { error: 'Note not found or you do not have permission to edit it' },
        { status: 404 }
      );
    }

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
  const requestId = crypto.randomUUID();
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';

  try {
    const { id: _patientId, noteId } = await context.params;

    // Verify access
    const access = await verifyPhysicianAccess(request);
    
    if (!access.authorized || !access.userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Physician access required.' },
        { status: 403 }
      );
    }

    // Delete note
    const deleted = await deleteClinicalNote(
      noteId,
      access.userId,
      { ipAddress, userAgent, requestId }
    );

    if (!deleted) {
      return NextResponse.json(
        { error: 'Note not found or you do not have permission to delete it' },
        { status: 404 }
      );
    }

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
