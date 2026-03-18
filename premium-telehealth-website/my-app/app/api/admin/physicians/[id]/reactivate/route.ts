/**
 * POST /api/admin/physicians/:id/reactivate
 * Reactivate a suspended physician
 * 
 * HIPAA Compliance:
 * - Requires ADMIN role
 * - Logs reactivation
 * - Sends reactivation notification email
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { sendEmail } from '@/lib/integrations/sendgrid';
import { Role, PhysicianStatus, AuthorizationAction } from '@prisma/client';
import { DataModificationAction } from '@/lib/audit/index';
import { EmailTemplate } from '@/lib/notifications/templates';

// ============================================================================
// POST - Reactivate Physician
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
        `/api/admin/physicians/${id}/reactivate`,
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

    // Validate physician status - can only reactivate INACTIVE physicians
    if (physician.status !== PhysicianStatus.INACTIVE) {
      return NextResponse.json(
        {
          error: 'Cannot reactivate physician with current status',
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
          status: PhysicianStatus.ACTIVE,
          isActive: true,
          updatedAt: new Date(),
        },
      }),
      prisma.physicianAuthorizationLog.create({
        data: {
          physicianId: id,
          adminId: user.userId,
          action: AuthorizationAction.REACTIVATED,
          ipAddress: auditContext.ipAddress,
          userAgent: auditContext.userAgent,
        },
      }),
    ]);

    // Send reactivation email
    await sendEmail({
      to: physician.user.email,
      template: EmailTemplate.GENERIC_NOTIFICATION,
      data: {
        subject: 'Welcome Back - Your Rimal Health Account Has Been Reactivated',
        message: `Dear Dr. ${physician.lastName},

Great news! Your Rimal Health physician account has been reactivated.

Your account is now active and you can:
- Access the physician portal
- Review patient intakes
- Send prescriptions
- Communicate with patients

To log in, visit: ${process.env.NEXT_PUBLIC_APP_URL}/login

If you have any questions or need assistance, please contact our admin team.

Welcome back!

Best regards,
Rimal Health Team`,
      },
    });

    // Log reactivation action
    await AuditService.logDataModification(
      DataModificationAction.UPDATE,
      user.userId,
      'PHYSICIAN',
      id,
      auditContext,
      ['status', 'isActive'],
      'Physician reactivated'
    );

    return NextResponse.json({
      success: true,
      physician: {
        id: updatedPhysician.id,
        status: updatedPhysician.status,
        isActive: updatedPhysician.isActive,
      },
      message: 'Physician reactivated successfully.',
    });
  } catch (error) {
    console.error('Reactivate physician error:', error);

    const { id } = await params;

    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      `/api/admin/physicians/${id}/reactivate`,
      auditContext,
      user.userId
    );

    return NextResponse.json(
      {
        error: 'Failed to reactivate physician',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
