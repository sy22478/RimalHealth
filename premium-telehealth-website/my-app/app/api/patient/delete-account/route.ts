/**
 * Account Deletion Request API Route
 *
 * POST /api/patient/delete-account
 * Creates an account deletion request and deactivates the patient account.
 * Does NOT delete any data — medical records are retained for 7 years
 * per HIPAA and 42 CFR Part 2.
 *
 * HIPAA Compliance:
 * - Password verification required for identity confirmation
 * - Full audit logging of the request
 * - No PHI in error messages or logs
 * - Stripe subscription cancelled (no billing data logged)
 * - Account deactivated, sessions invalidated
 *
 * @module app/api/patient/delete-account
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/require-auth';
import { getClientIp, getUserAgent } from '@/lib/auth/require-auth';
import { verifyPassword } from '@/lib/auth/password';
import { getStripe } from '@/lib/stripe/stripe-server';
import { auditLogger, AuditEventType } from '@/lib/audit/index';
import { requireCSRF } from '@/lib/security/csrf';

// ============================================================================
// Validation Schema
// ============================================================================

const DELETION_REASONS = [
  'NO_LONGER_NEEDED',
  'COST',
  'PRIVACY_CONCERNS',
  'SWITCHING_PROVIDER',
  'DISSATISFIED',
  'OTHER',
] as const;

const deleteAccountSchema = z.object({
  reason: z.enum(DELETION_REASONS, {
    message: 'Please select a reason for account deletion',
  }),
  details: z
    .string()
    .max(1000, { message: 'Additional details must be under 1000 characters' })
    .optional(),
  password: z
    .string()
    .min(1, { message: 'Password is required for verification' }),
});

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ipAddress = getClientIp(request);
  const userAgent = getUserAgent(request);

  // CSRF guard before any state change
  const csrfError = requireCSRF(request);
  if (csrfError) return csrfError;

  try {
    // 1. Require PATIENT role
    const auth = await requireRole(request, [Role.PATIENT]);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { userId } = auth.user;

    // 2. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const validation = deleteAccountSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { reason, details, password } = validation.data;

    // 3. Fetch user and verify password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        email: true,
        tokenVersion: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      // Audit log failed attempt
      await auditLogger.log({
        eventType: AuditEventType.ACCOUNT_DELETION_REQUESTED,
        userId,
        action: 'Account deletion request failed - incorrect password',
        ipAddress,
        userAgent,
        resourceType: 'User',
        resourceId: userId,
        success: false,
      });

      return NextResponse.json(
        { error: 'Incorrect password' },
        { status: 401 }
      );
    }

    // 4. Check for existing pending/grace-period deletion request
    const existingRequest = await prisma.accountDeletionRequest.findFirst({
      where: {
        userId,
        status: { in: ['PENDING', 'GRACE_PERIOD'] },
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        {
          error: 'An account deletion request is already pending',
          requestedAt: existingRequest.requestedAt.toISOString(),
        },
        { status: 409 }
      );
    }

    // 5. Create deletion request and deactivate account in a transaction
    const deletionRequest = await prisma.$transaction(async (tx) => {
      // Create the deletion request
      const request = await tx.accountDeletionRequest.create({
        data: {
          userId,
          reason,
          details: details ?? null,
          status: 'GRACE_PERIOD',
          ipAddress,
          userAgent,
        },
      });

      // Increment token version to invalidate all existing sessions
      // and mark the account as deactivated
      await tx.user.update({
        where: { id: userId },
        data: {
          tokenVersion: { increment: 1 },
          deactivatedAt: new Date(),
        },
      });

      // Delete all active sessions for this user
      await tx.session.deleteMany({
        where: { userId },
      });

      return request;
    });

    // 6. Cancel Stripe subscription if active (best-effort, outside transaction)
    try {
      const activeSubscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          cancelAtPeriodEnd: false,
        },
      });

      if (activeSubscription?.stripeSubscriptionId) {
        await getStripe().subscriptions.update(
          activeSubscription.stripeSubscriptionId,
          { cancel_at_period_end: true }
        );

        await prisma.subscription.update({
          where: { id: activeSubscription.id },
          data: { cancelAtPeriodEnd: true },
        });
      }
    } catch (stripeError) {
      // Stripe failure must not block the deletion request
      console.error(
        '[Delete Account API] Stripe cancellation error:',
        stripeError instanceof Error ? stripeError.message : 'Unknown error'
      );
    }

    // 7. Audit log successful deletion request
    await auditLogger.log({
      eventType: AuditEventType.ACCOUNT_DELETION_REQUESTED,
      userId,
      action: 'Account deletion requested - account deactivated',
      ipAddress,
      userAgent,
      resourceType: 'User',
      resourceId: userId,
      success: true,
      metadata: {
        reason,
        deletionRequestId: deletionRequest.id,
      },
    });

    // 8. Clear auth cookies to sign out the user immediately
    const cookieStore = await cookies();
    cookieStore.delete('accessToken');
    cookieStore.delete('refreshToken');

    // 9. Return success response
    return NextResponse.json({
      success: true,
      message: 'Your account deletion request has been submitted.',
      deletionRequestId: deletionRequest.id,
      gracePeriodEnds: new Date(
        deletionRequest.requestedAt.getTime() + 30 * 24 * 60 * 60 * 1000
      ).toISOString(),
      whatHappensNext: {
        immediate: [
          'Your account has been deactivated',
          'You will be signed out of all devices',
          'Your active subscription has been cancelled',
        ],
        gracePeriod:
          'You have 30 days to contact support@rimalhealth.com to reactivate your account',
        afterGracePeriod:
          'Your account will be permanently deactivated',
        dataRetention:
          'Your medical records will be retained for 7 years as required by federal law (HIPAA and 42 CFR Part 2), then anonymized',
      },
    });
  } catch (error) {
    console.error(
      '[Delete Account API] Error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
