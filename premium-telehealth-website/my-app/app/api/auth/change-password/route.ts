/**
 * POST /api/auth/change-password
 * Change password for any authenticated user (PATIENT, PHYSICIAN, ADMIN)
 *
 * HIPAA Compliance:
 * - Current password required to prevent unauthorized changes
 * - Audit logging for all password changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { auditLogger, AuditEventType } from '@/lib/audit/index';
import { getClientIP } from '@/lib/audit/utils';
import { requireAuth } from '@/lib/auth/require-auth';
import { verifyPassword, hashPassword } from '@/lib/auth/password';
import { requireCSRF } from '@/lib/security/csrf';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be under 128 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/\d/, 'Must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';

  // CSRF guard before any state change
  const csrfError = requireCSRF(request);
  if (csrfError) return csrfError;

  // Verify JWT directly — never trust x-user-id/x-user-role headers from
  // potentially-misconfigured proxies.
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { userId, role } = auth.user;

  try {
    const body = await request.json();
    const validation = changePasswordSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = validation.data;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      await auditLogger.log({
        eventType: AuditEventType.PASSWORD_CHANGE_FAILED,
        userId,
        userRole: role,
        action: 'Password change failed - incorrect current password',
        ipAddress,
        userAgent,
        success: false,
      });

      return NextResponse.json(
        { error: 'Current password is incorrect', code: 'INVALID_PASSWORD' },
        { status: 403 }
      );
    }

    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    await auditLogger.log({
      eventType: AuditEventType.PASSWORD_CHANGED,
      userId,
      userRole: role,
      action: 'Password changed successfully',
      ipAddress,
      userAgent,
      success: true,
    });

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
      requireReLogin: true,
    });
  } catch (error) {
    console.error('Change password error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'An unexpected error occurred', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
