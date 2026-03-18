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
import { verifyAccessToken } from '@/lib/auth/jwt';
import { verifyPassword, hashPassword } from '@/lib/auth/password';

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

async function getAuthenticatedUser(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  // Try middleware-injected headers first
  const userId = request.headers.get('x-user-id');
  const userRole = request.headers.get('x-user-role');
  if (userId && userRole) {
    return { userId, role: userRole };
  }

  // Fall back to token
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const cookieToken = request.cookies.get('accessToken')?.value ?? null;
  const token = bearerToken ?? cookieToken;
  if (!token) return null;

  try {
    const payload = await verifyAccessToken(token);
    return payload ? { userId: payload.userId, role: payload.role } : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';

  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

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
      where: { id: auth.userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      await auditLogger.log({
        eventType: AuditEventType.PASSWORD_CHANGE_FAILED,
        userId: auth.userId,
        userRole: auth.role,
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
      where: { id: auth.userId },
      data: { passwordHash: newHash },
    });

    await auditLogger.log({
      eventType: AuditEventType.PASSWORD_CHANGED,
      userId: auth.userId,
      userRole: auth.role,
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
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
