/**
 * POST /api/admin/physicians/:id/authorize
 * Authorize a pending physician and generate secret key
 * 
 * HIPAA Compliance:
 * - Requires ADMIN role
 * - Logs all authorization actions
 * - Sends secret key via secure email
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
// POST - Authorize Physician
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
            emailVerified: true,
          },
        },
      },
    });

    if (!physician) {
      await AuditService.logUnauthorizedAccess(
        user.userId,
        `/api/admin/physicians/${id}/authorize`,
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

    // Validate physician status
    if (physician.status !== PhysicianStatus.PENDING) {
      return NextResponse.json(
        {
          error: 'Physician must be in PENDING status to authorize',
          code: 'INVALID_STATUS',
          currentStatus: physician.status,
        },
        { status: 400 }
      );
    }

    // Generate secret key
    const secretKeyResult = generatePhysicianSecretKey();

    // Update physician record in transaction
    const [updatedPhysician] = await prisma.$transaction([
      prisma.physician.update({
        where: { id },
        data: {
          status: PhysicianStatus.INVITED,
          authorizedBy: user.userId,
          authorizedAt: new Date(),
          secretKeyHash: secretKeyResult.hash,
          secretKeyExpiry: secretKeyResult.expiryDate,
          secretKeyUsedAt: null,
          updatedAt: new Date(),
        },
      }),
      prisma.physicianAuthorizationLog.create({
        data: {
          physicianId: id,
          adminId: user.userId,
          action: AuthorizationAction.INVITED,
          ipAddress: auditContext.ipAddress,
          userAgent: auditContext.userAgent,
        },
      }),
    ]);

    // Send email with secret key
    await sendEmail({
      to: physician.user.email,
      template: EmailTemplate.GENERIC_NOTIFICATION,
      data: {
        subject: 'Welcome to Rimal Health - Your Physician Account is Ready',
        message: `Dear Dr. ${physician.lastName},

Congratulations! Your physician account has been approved and authorized.

Your secret access key is: ${secretKeyResult.key}

This key will expire on ${secretKeyResult.expiryDate.toLocaleDateString()}.

To complete your registration:
1. Visit the physician portal at ${process.env.NEXT_PUBLIC_APP_URL}/physician/setup
2. Enter your secret key when prompted
3. Set up your password and complete your profile

If you have any questions, please contact our admin team.

Best regards,
Rimal Health Team`,
      },
    });

    // Log authorization action
    await AuditService.logDataModification(
      DataModificationAction.UPDATE,
      user.userId,
      'PHYSICIAN',
      id,
      auditContext,
      ['status', 'authorizedBy', 'authorizedAt', 'secretKeyHash', 'secretKeyExpiry'],
      'Physician authorized - secret key generated'
    );

    return NextResponse.json({
      success: true,
      secretKey: secretKeyResult.key,
      physician: {
        id: updatedPhysician.id,
        status: updatedPhysician.status,
        authorizedAt: updatedPhysician.authorizedAt?.toISOString(),
        secretKeyExpiry: updatedPhysician.secretKeyExpiry?.toISOString(),
      },
      message: 'Physician authorized successfully. Secret key has been sent via email.',
    });
  } catch (error) {
    console.error('Authorize physician error:', error instanceof Error ? error.message : 'Unknown error');

    const { id } = await params;

    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      `/api/admin/physicians/${id}/authorize`,
      auditContext,
      user.userId
    );

    return NextResponse.json(
      {
        error: 'Failed to authorize physician',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
