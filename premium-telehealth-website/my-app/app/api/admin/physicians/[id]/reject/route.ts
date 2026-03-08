/**
 * POST /api/admin/physicians/:id/reject
 * Reject a pending physician application
 * 
 * HIPAA Compliance:
 * - Requires ADMIN role
 * - Logs rejection with reason
 * - Sends rejection email
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { sendEmail } from '@/lib/integrations/sendgrid';
import { Role, PhysicianStatus, AuthorizationAction } from '@prisma/client';
import { DataModificationAction } from '@/lib/audit';
import { EmailTemplate } from '@/lib/notifications/templates';

// ============================================================================
// Validation Schema
// ============================================================================

const rejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(1000),
});

// ============================================================================
// POST - Reject Physician
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
    const validation = rejectSchema.safeParse(body);

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
          },
        },
      },
    });

    if (!physician) {
      await AuditService.logUnauthorizedAccess(
        user.userId,
        `/api/admin/physicians/${id}/reject`,
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

    // Validate physician status - can only reject PENDING or INVITED physicians
    if (physician.status !== PhysicianStatus.PENDING && physician.status !== PhysicianStatus.INVITED) {
      return NextResponse.json(
        {
          error: 'Cannot reject physician with current status',
          code: 'INVALID_STATUS',
          currentStatus: physician.status,
        },
        { status: 400 }
      );
    }

    // Update physician record in transaction
    const [updatedPhysician] = await prisma.$transaction([
      prisma.physician.update({
        where: { id },
        data: {
          status: PhysicianStatus.INACTIVE,
          isActive: false,
          secretKeyHash: null,
          secretKeyExpiry: null,
          updatedAt: new Date(),
        },
      }),
      prisma.physicianAuthorizationLog.create({
        data: {
          physicianId: id,
          adminId: user.userId,
          action: AuthorizationAction.REJECTED,
          reason,
          ipAddress: auditContext.ipAddress,
          userAgent: auditContext.userAgent,
        },
      }),
    ]);

    // Send rejection email
    await sendEmail({
      to: physician.user.email,
      template: EmailTemplate.GENERIC_NOTIFICATION,
      data: {
        subject: 'Update on Your Rimal Health Physician Application',
        message: `Dear Dr. ${physician.lastName},

Thank you for your interest in joining Rimal Health as a physician provider.

After careful review of your application, we regret to inform you that we are unable to approve your physician account at this time.

Reason: ${reason}

If you believe this decision was made in error or if your circumstances have changed, please feel free to contact our admin team for further discussion.

Best regards,
Rimal Health Team`,
      },
    });

    // Log rejection action
    await AuditService.logDataModification(
      DataModificationAction.UPDATE,
      user.userId,
      'PHYSICIAN',
      id,
      auditContext,
      ['status', 'isActive'],
      `Physician rejected - ${reason}`
    );

    return NextResponse.json({
      success: true,
      physician: {
        id: updatedPhysician.id,
        status: updatedPhysician.status,
        isActive: updatedPhysician.isActive,
      },
      message: 'Physician rejected successfully.',
    });
  } catch (error) {
    console.error('Reject physician error:', error);

    const { id } = await params;

    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      `/api/admin/physicians/${id}/reject`,
      auditContext,
      user.userId
    );

    return NextResponse.json(
      {
        error: 'Failed to reject physician',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
