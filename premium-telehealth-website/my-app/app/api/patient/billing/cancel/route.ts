/**
 * Cancel Subscription API Route
 * 
 * POST /api/patient/billing/cancel
 * Cancels the patient's subscription at period end.
 * 
 * Pattern: API-001 - Route handler template
 * Pattern: PHI-001 - Audit logging
 * HIPAA: Only Stripe IDs logged, no PHI
 * 
 * @module app/api/patient/billing/cancel
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { stripe } from '@/lib/integrations/stripe';
import { auditLogger, createAuditContext } from '@/lib/audit';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth/jwt';

// ============================================================================
// Types & Validation
// ============================================================================

const cancelSchema = z.object({
  reason: z.string().optional(),
  feedback: z.string().optional(),
});

interface CancelResponse {
  success: boolean;
  message: string;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Authenticate request and get user ID
 * Accepts Bearer token from Authorization header or accessToken cookie.
 */
async function authenticateRequest(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  const authHeader = request.headers.get('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const cookieToken = request.cookies.get('accessToken')?.value ?? null;
  const token = bearerToken ?? cookieToken;
  if (!token) {
    return null;
  }
  const payload = await verifyAccessToken(token);
  if (!payload) {
    return null;
  }
  return { userId: payload.userId, role: payload.role };
}

/**
 * Calculate prorated refund amount
 * Based on days remaining in billing period
 */
function calculateProratedRefund(
  amount: number,
  periodStart: Date,
  periodEnd: Date
): number {
  const now = new Date();
  const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (remainingDays <= 0) return 0;
  
  // Calculate daily rate and remaining amount
  const dailyRate = amount / totalDays;
  const refundAmount = Math.round(dailyRate * remainingDays);
  
  // Only refund if more than 7 days remaining (our policy)
  if (remainingDays < 7) return 0;
  
  return refundAmount;
}

// ============================================================================
// Route Handler
// ============================================================================

/**
 * POST handler - Cancel subscription
 * 
 * Returns:
 * - Success confirmation
 * - Period end date (when access ends)
 * - Cancel at period end flag
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (auth.role !== 'PATIENT') {
      return NextResponse.json(
        { error: 'Forbidden - Patient access only' },
        { status: 403 }
      );
    }

    const userId = auth.userId;

    // Parse and validate request body
    let body: z.infer<typeof cancelSchema>;
    try {
      const json = await request.json();
      const result = cancelSchema.safeParse(json);
      if (!result.success) {
        return NextResponse.json(
          { error: 'Invalid request body', details: result.error.flatten() },
          { status: 400 }
        );
      }
      body = result.data;
    } catch {
      body = {};
    }

    try {
      // Fetch subscription from database
      const subscription = await prisma.subscription.findFirst({
        where: { 
          userId,
          status: 'ACTIVE',
        },
      });

      if (!subscription) {
        return NextResponse.json(
          { error: 'No active subscription found' },
          { status: 404 }
        );
      }

      if (subscription.cancelAtPeriodEnd) {
        return NextResponse.json(
          { error: 'Subscription is already set to cancel' },
          { status: 400 }
        );
      }

      // Cancel in Stripe
      if (subscription.stripeSubscriptionId) {
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
      }

      // Update database
      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: true,
        },
      });

      // Calculate potential refund (for informational purposes)
      const proratedRefund = calculateProratedRefund(
        subscription.amount,
        subscription.currentPeriodStart,
        subscription.currentPeriodEnd
      );

      // Audit log the cancellation
      const auditContext = createAuditContext(request, userId, 'PATIENT');
      await auditLogger.logPHIAccess(
        'UPDATE',
        userId,
        'PATIENT',
        'subscription',
        subscription.id,
        auditContext,
        { 
          accessReason: 'Cancelling subscription',
        } as Record<string, unknown>
      );

      // Send cancellation confirmation email (async)
      // TODO: Implement email notification
      // await sendCancellationEmail(userId, subscription);

      const response: CancelResponse = {
        success: true,
        message: 'Your subscription has been scheduled for cancellation.',
        periodEnd: updatedSubscription.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: true,
      };

      return NextResponse.json(response);

    } catch (dbError) {
      console.error('[Cancel API] Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to cancel subscription' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[Cancel API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
