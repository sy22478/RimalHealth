/**
 * POST /api/admin/physicians/:id/suspend
 * Suspend an active physician
 * 
 * HIPAA Compliance:
 * - Requires ADMIN role
 * - Revokes all active sessions
 * - Logs suspension with reason
 * - Sends suspension notification email
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { sendEmail } from '@/lib/integrations/sendgrid';
import { getRedisClient } from '@/lib/redis/client';
import { Role, PhysicianStatus, AuthorizationAction } from '@prisma/client';
import { DataModificationAction } from '@/lib/audit';
import { EmailTemplate } from '@/lib/notifications/templates';

// ============================================================================
// Validation Schema
// ============================================================================

const suspendSchema = z.object({
  reason: z.string().min(1, 'Suspension reason is required').max(1000),
});

// ============================================================================
// POST - Suspend Physician
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // Require ADMIN role
  const auth = await requireRole(request, [Role.ADMIN]);

  if (auth instanceof NextResponse) {
    return auth;
  }

  const { user } = auth;
  const auditContext = AuditService.createAuditContext(
    request,
    user.userId,
    user.role
  );

  try {
    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validation = suspendSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          code: 'VALIDATION_ERROR',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { reason } = validation.data;

    // Fetch physician with user data
    const physician = await prisma.physician.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            tokenVersion: true,
          },
        },
      },
    });

    if (!physician) {
      await AuditService.logUnauthorizedAccess(
        user.userId,
        `/api/admin/physicians/${id}/suspend`,
        auditContext,
        'Physician not found'
      );

      return NextResponse.json(
        {
          error: 'Physician not found',
          code: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Validate physician status - can only suspend ACTIVE or INVITED physicians
    if (physician.status !== PhysicianStatus.ACTIVE && physician.status !== PhysicianStatus.INVITED) {
      return NextResponse.json(
        {
          error: 'Cannot suspend physician with current status',
          code: 'INVALID_STATUS',
          currentStatus: physician.status,
        },
        { status: 400 }
      );
    }

    // Update physician record in transaction
    // Update physician and revoke sessions in transaction
    const [updatedPhysician] = await prisma.$transaction([
      prisma.physician.update({
        where: { id },
        data: {
          status: PhysicianStatus.INACTIVE,
          isActive: false,
          updatedAt: new Date(),
        },
      }),
      prisma.physicianAuthorizationLog.create({
        data: {
          physicianId: id,
          adminId: user.userId,
          action: AuthorizationAction.SUSPENDED,
          reason,
          ipAddress: auditContext.ipAddress,
          userAgent: auditContext.userAgent,
        },
      }),
      // Delete all active sessions
      prisma.session.deleteMany({
        where: { userId: physician.userId },
      }),
      // Increment token version to invalidate all existing tokens
      prisma.user.update({
        where: { id: physician.userId },
        data: {
          tokenVersion: {
            increment: 1,
          },
        },
      }),
    ]);

    // Get count of deleted sessions (we can't get this from transaction easily, so query separately)
    const sessions = await prisma.session.count({
      where: { userId: physician.userId },
    });

    // Revoke sessions in Redis (if any cached)
    try {
      const redis = getRedisClient();
      const sessionPattern = `session:*:${physician.userId}`;
      const keys = await redis.keys(sessionPattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (redisError) {
      console.error('Redis session cleanup error:', redisError);
      // Non-fatal error - continue
    }

    // Send suspension email
    await sendEmail({
      to: physician.user.email,
      template: EmailTemplate.GENERIC_NOTIFICATION,
      data: {
        subject: 'Important: Your Rimal Health Account Has Been Suspended',
        message: `Dear Dr. ${physician.lastName},

We are writing to inform you that your Rimal Health physician account has been suspended.

Reason: ${reason}

During this suspension:
- You will not be able to access the physician portal
- You will not be assigned new patient reviews
- Your existing patient assignments may be transferred to other physicians

If you believe this suspension was made in error or would like to discuss reactivation, please contact our admin team immediately.

Best regards,
Rimal Health Team`,
      },
    });

    // Log suspension action
    await AuditService.logDataModification(
      DataModificationAction.UPDATE,
      user.userId,
      'PHYSICIAN',
      id,
      auditContext,
      ['status', 'isActive'],
      `Physician suspended - ${reason}`
    );

    return NextResponse.json({
      success: true,
      physician: {
        id: updatedPhysician.id,
        status: updatedPhysician.status,
        isActive: updatedPhysician.isActive,
      },
      sessionsRevoked: sessions,
      message: 'Physician suspended successfully. All sessions revoked.',
    });
  } catch (error) {
    console.error('Suspend physician error:', error);

    const { id } = await params;

    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      `/api/admin/physicians/${id}/suspend`,
      auditContext,
      user.userId
    );

    return NextResponse.json(
      {
        error: 'Failed to suspend physician',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
