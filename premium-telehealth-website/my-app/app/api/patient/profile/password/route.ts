/**
 * Patient Password Change API
 * 
 * HIPAA Compliance:
 * - Current password required to prevent unauthorized changes
 * - Constant-time password comparison to prevent timing attacks
 * - Audit logging for all password changes
 * - PATIENT role verification required
 * - Secure password hashing with bcrypt
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { auditLogger, AuditEventType } from '@/lib/audit/index';
import { getClientIP } from '@/lib/audit/utils';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { verifyPassword, hashPassword } from '@/lib/auth/password';

// ============================================================================
// Validation Schema
// ============================================================================

const changePasswordSchema = z.object({
  currentPassword: z.string()
    .min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be under 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ============================================================================
// Authentication Helper
// ============================================================================

async function authenticatePatient(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  try {
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const cookieToken = request.cookies.get('accessToken')?.value ?? null;
    const token = bearerToken ?? cookieToken;
    if (!token) {
      return null;
    }
    const payload = await verifyAccessToken(token);
    
    if (!payload || payload.role !== 'PATIENT') {
      return null;
    }

    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}

// ============================================================================
// POST Handler - Change Password
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';

  try {
    // Authenticate and verify PATIENT role
    const auth = await authenticatePatient(request);
    
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { userId } = auth;

    // Parse and validate request body
    const body = await request.json();
    const validation = changePasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          code: 'VALIDATION_ERROR',
          details: validation.error.flatten().fieldErrors 
        },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = validation.data;

    // Fetch user with password hash
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.passwordHash);

    if (!isCurrentPasswordValid) {
      // Audit log - failed password change attempt
      await auditLogger.log({
        eventType: AuditEventType.PASSWORD_CHANGE_FAILED,
        userId,
        action: 'Password change failed - incorrect current password',
        ipAddress,
        userAgent,
        resourceType: 'User',
        resourceId: userId,
        success: false,
      });

      return NextResponse.json(
        { error: 'Current password is incorrect', code: 'INVALID_PASSWORD' },
        { status: 401 }
      );
    }

    // Check that new password is different from current
    const isSamePassword = await verifyPassword(newPassword, user.passwordHash);
    if (isSamePassword) {
      return NextResponse.json(
        { 
          error: 'New password must be different from current password', 
          code: 'SAME_PASSWORD' 
        },
        { status: 400 }
      );
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password and increment token version (invalidates existing sessions)
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        tokenVersion: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    // Invalidate all existing sessions for this user
    await prisma.session.deleteMany({
      where: { userId },
    });

    // Audit log - successful password change
    await auditLogger.log({
      eventType: AuditEventType.PASSWORD_CHANGED,
      userId,
      action: 'Password changed successfully',
      ipAddress,
      userAgent,
      resourceType: 'User',
      resourceId: userId,
      success: true,
    });

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully. Please log in again with your new password.',
      requireReLogin: true,
    });

  } catch (error) {
    console.error('Password change error:', error);
    
    return NextResponse.json(
      { error: 'Failed to change password', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
