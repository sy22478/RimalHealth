/**
 * POST /api/patient/checkins/[id]
 * Submit responses for one of the patient's open (SCHEDULED/DUE) check-ins.
 *
 * HIPAA: answers persist in the encrypted CheckIn.responses column; audit logs
 * the write with the check-in id only (no PHI).
 *
 * @module app/api/patient/checkins/[id]
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole, getClientIp, getUserAgent } from '@/lib/auth/require-auth';
import { requireCSRF } from '@/lib/security/csrf';
import { Role } from '@prisma/client';
import { submitCheckIn } from '@/lib/checkins/service';
import { submitCheckInSchema } from '@/lib/validation/checkin-schemas';
import { auditLogger } from '@/lib/audit/logger';
import { AuditEventType } from '@/lib/audit/types';

const paramsSchema = z.object({ id: z.string().uuid('Invalid check-in ID') });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const csrfError = requireCSRF(request);
  if (csrfError) return csrfError;

  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) return auth;
  const { userId, role } = auth.user;

  try {
    const paramsValidation = paramsSchema.safeParse(await params);
    if (!paramsValidation.success) {
      return NextResponse.json(
        { error: 'Invalid check-in ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }
    const { id: checkInId } = paramsValidation.data;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }
    const bodyValidation = submitCheckInSchema.safeParse(body);
    if (!bodyValidation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: bodyValidation.error.issues,
        },
        { status: 400 }
      );
    }

    const result = await submitCheckIn(checkInId, userId, bodyValidation.data.responses);
    if (!result.success) {
      const status = result.code === 'NOT_FOUND' ? 404 : 409;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
    }

    await auditLogger.log({
      eventType: AuditEventType.PATIENT_DATA_UPDATED,
      userId,
      userRole: role,
      action: 'Check-in submitted',
      resourceType: 'CheckIn',
      resourceId: checkInId,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      success: true,
    });

    return NextResponse.json({ success: true, urgent: result.urgent ?? false });
  } catch (error) {
    console.error(
      'Check-in submit error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
