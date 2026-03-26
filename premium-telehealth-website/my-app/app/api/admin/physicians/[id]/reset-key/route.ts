/**
 * POST /api/admin/physicians/:id/reset-key
 * Reset physician secret key
 * 
 * HIPAA Compliance:
 * - Requires ADMIN role
 * - Generates new secret key
 * - Revokes old key immediately
 * - Logs key reset
 * - Sends new key via email
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { generatePhysicianSecretKey } from '@/lib/auth/secret-key';
import { AuditService } from '@/lib/services/audit-service';
import { sendEmail } from '@/lib/integrations/sendgrid';
import { Role, PhysicianStatus, AuthorizationAction } from '@prisma/client';
import { DataModificationAction } from '@/lib/audit/index';
import { EmailTemplate } from '@/lib/notifications/templates';

// ============================================================================
// POST - Reset Physician Secret Key
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
        `/api/admin/physicians/${id}/reset-key`,
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

    // Validate physician status - can only reset key for INVITED or ACTIVE physicians
    if (physician.status !== PhysicianStatus.INVITED && physician.status !== PhysicianStatus.ACTIVE) {
      return NextResponse.json(
        {
          error: 'Cannot reset key for physician with current status',
          code: 'INVALID_STATUS',
          currentStatus: physician.status,
        },
        { status: 400 }
      );
    }

    // Generate new secret key
    const secretKeyResult = generatePhysicianSecretKey();

    // Update physician record in transaction
    const [updatedPhysician] = await prisma.$transaction([
      prisma.physician.update({
        where: { id },
        data: {
          secretKeyHash: secretKeyResult.hash,
          secretKeyExpiry: secretKeyResult.expiryDate,
          secretKeyUsedAt: null, // Reset usage timestamp
          // If previously ACTIVE, set back to INVITED to require new key usage
          status: physician.status === PhysicianStatus.ACTIVE 
            ? PhysicianStatus.INVITED 
            : physician.status,
          updatedAt: new Date(),
        },
      }),
      prisma.physicianAuthorizationLog.create({
        data: {
          physicianId: id,
          adminId: user.userId,
          action: AuthorizationAction.SECRET_KEY_RESET,
          reason: 'Secret key reset by admin',
          ipAddress: auditContext.ipAddress,
          userAgent: auditContext.userAgent,
        },
      }),
    ]);

    // Send email with new secret key
    await sendEmail({
      to: physician.user.email,
      template: EmailTemplate.GENERIC_NOTIFICATION,
      data: {
        subject: 'Rimal Health - Your New Secret Access Key',
        message: `Dear Dr. ${physician.lastName},

Your secret access key has been reset by an administrator.

Your new secret access key is: ${secretKeyResult.key}

This key will expire on ${secretKeyResult.expiryDate.toLocaleDateString()}.

${physician.status === PhysicianStatus.ACTIVE 
  ? 'IMPORTANT: Since you were an active physician, you will need to use this new key to re-verify your account.' 
  : 'To complete your registration, use this key at the physician portal.'}

To access the portal:
1. Visit ${process.env.NEXT_PUBLIC_APP_URL}/physician/setup
2. Enter your new secret key when prompted
3. Follow the setup instructions

If you did not request this reset, please contact our admin team immediately.

Best regards,
Rimal Health Team`,
      },
    });

    // Log key reset action
    await AuditService.logDataModification(
      DataModificationAction.UPDATE,
      user.userId,
      'PHYSICIAN',
      id,
      auditContext,
      ['secretKeyHash', 'secretKeyExpiry', 'secretKeyUsedAt', 'status'],
      'Physician secret key reset - old key revoked'
    );

    return NextResponse.json({
      success: true,
      secretKey: secretKeyResult.key,
      physician: {
        id: updatedPhysician.id,
        status: updatedPhysician.status,
        secretKeyExpiry: updatedPhysician.secretKeyExpiry?.toISOString(),
      },
      message: 'Secret key reset successfully. New key has been sent via email.',
    });
  } catch (error) {
    console.error('Reset secret key error:', error instanceof Error ? error.message : 'Unknown error');

    const { id } = await params;

    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      `/api/admin/physicians/${id}/reset-key`,
      auditContext,
      user.userId
    );

    return NextResponse.json(
      {
        error: 'Failed to reset secret key',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
