/**
 * POST /api/physician/titration/steps/[stepId]
 * Physician approves advancing a GLP-1 titration to the given (pending) step.
 *
 * This is the physician-in-the-loop write the engine deliberately refuses to do:
 * it sets the step CURRENT with physicianApprovedAt/By and rolls the supply
 * window forward. Audit-logged with the step id only (no PHI).
 *
 * @module app/api/physician/titration/steps/[stepId]
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole, getClientIp, getUserAgent } from '@/lib/auth/require-auth';
import { requireCSRF } from '@/lib/security/csrf';
import { Role } from '@prisma/client';
import { approveTitrationStep } from '@/lib/titration/service';
import { auditLogger } from '@/lib/audit/logger';
import { AuditEventType } from '@/lib/audit/types';

const paramsSchema = z.object({ stepId: z.string().uuid('Invalid step ID') });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stepId: string }> }
): Promise<NextResponse> {
  const csrfError = requireCSRF(request);
  if (csrfError) return csrfError;

  const auth = await requireRole(request, [Role.PHYSICIAN]);
  if (auth instanceof NextResponse) return auth;
  const { userId, role } = auth.user;

  try {
    const paramsValidation = paramsSchema.safeParse(await params);
    if (!paramsValidation.success) {
      return NextResponse.json(
        { error: 'Invalid step ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }
    const { stepId } = paramsValidation.data;

    const result = await approveTitrationStep(stepId, userId);
    if (!result.success) {
      const status = result.code === 'NOT_FOUND' ? 404 : 409;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
    }

    await auditLogger.log({
      eventType: AuditEventType.PRESCRIPTION_STATUS_UPDATED,
      userId,
      userRole: role,
      action: 'Titration step advanced (physician-approved)',
      resourceType: 'TitrationStep',
      resourceId: stepId,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      success: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      'Titration step approval error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
