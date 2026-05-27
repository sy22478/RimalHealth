/**
 * POST /api/physician/checkins/[id]
 * Physician marks a submitted GLP-1 check-in as reviewed.
 *
 * HIPAA: audit logs the review with the check-in id only; the patient is
 * notified (no PHI in the notification).
 *
 * @module app/api/physician/checkins/[id]
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole, getClientIp, getUserAgent } from '@/lib/auth/require-auth';
import { requireCSRF } from '@/lib/security/csrf';
import { Role } from '@prisma/client';
import { reviewCheckIn } from '@/lib/checkins/service';
import { NotificationService } from '@/lib/services/notification-service';
import { auditLogger } from '@/lib/audit/logger';
import { AuditEventType } from '@/lib/audit/types';

const paramsSchema = z.object({ id: z.string().uuid('Invalid check-in ID') });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
        { error: 'Invalid check-in ID', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }
    const { id: checkInId } = paramsValidation.data;

    const result = await reviewCheckIn(checkInId, userId);
    if (!result.success) {
      const status = result.code === 'NOT_FOUND' ? 404 : 409;
      return NextResponse.json({ error: result.error, code: result.code }, { status });
    }

    await auditLogger.log({
      eventType: AuditEventType.PATIENT_DATA_VIEWED,
      userId,
      userRole: role,
      action: 'Check-in reviewed',
      resourceType: 'CheckIn',
      resourceId: checkInId,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      success: true,
    });

    if (result.patientId) {
      try {
        await NotificationService.notifyCheckInReviewed(result.patientId);
      } catch (notifyError) {
        console.error(
          'Failed to notify patient of check-in review:',
          notifyError instanceof Error ? notifyError.message : 'Unknown error'
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      'Check-in review error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
