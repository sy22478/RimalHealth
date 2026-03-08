/**
 * Patient Billing API Route
 * 
 * GET /api/patient/billing
 * Returns subscription details and billing summary for the authenticated patient.
 * 
 * Pattern: API-001 - Route handler template
 * Pattern: PHI-001 - Audit logging
 * HIPAA: Only Stripe IDs logged, no PHI in logs
 * 
 * @module app/api/patient/billing
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { stripe, getDefaultPaymentMethod } from '@/lib/integrations/stripe';
import { auditLogger, createAuditContext } from '@/lib/audit';
import { verifyAccessToken } from '@/lib/auth/jwt';

// ============================================================================
// Types
// ============================================================================

interface BillingResponse {
  subscription: {
    id: string;
    planType: string;
    status: string;
    amount: number;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelledAt: string | null;
    cancelAtPeriodEnd: boolean;
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    paymentMethod: {
      brand: string;
      last4: string;
      expMonth: number;
      expYear: number;
    } | null;
  } | null;
  summary: {
    totalPaid: number;
    nextBillingDate: string | null;
  };
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
 * Fetch payment method details from Stripe
 */
async function fetchPaymentMethod(stripeCustomerId: string) {
  try {
    const paymentMethod = await getDefaultPaymentMethod(stripeCustomerId);
    
    if (!paymentMethod || paymentMethod.type !== 'card') {
      return null;
    }

    const card = paymentMethod.card;
    if (!card) return null;

    return {
      brand: card.brand,
      last4: card.last4,
      expMonth: card.exp_month,
      expYear: card.exp_year,
    };
  } catch (error) {
    console.error('[Billing API] Failed to fetch payment method:', error);
    return null;
  }
}

// ============================================================================
// Route Handler
// ============================================================================

/**
 * GET handler - Fetch billing information
 * 
 * Returns:
 * - Subscription details
 * - Payment method info (from Stripe)
 * - Billing summary
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

    try {
      // Fetch subscription from database
      const subscription = await prisma.subscription.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (!subscription) {
        // No subscription found - return null
        const auditContext = createAuditContext(request, userId, 'PATIENT');
        await auditLogger.logPHIAccess(
          'VIEW',
          userId,
          'PATIENT',
          'billing_info',
          'none',
          auditContext,
          { accessReason: 'Viewing billing information - no subscription' } as Record<string, unknown>
        );

        return NextResponse.json({
          subscription: null,
          summary: {
            totalPaid: 0,
            nextBillingDate: null,
          },
        });
      }

      // Fetch payment method from Stripe
      let paymentMethod = null;
      if (subscription.stripeCustomerId) {
        paymentMethod = await fetchPaymentMethod(subscription.stripeCustomerId);
      }

      // Calculate total paid from invoices
      const paidInvoices = await prisma.invoice.findMany({
        where: {
          userId,
          status: 'PAID',
        },
        select: { amount: true },
      });

      const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

      // Audit log the access
      const auditContext = createAuditContext(request, userId, 'PATIENT');
      await auditLogger.logPHIAccess(
        'VIEW',
        userId,
        'PATIENT',
        'billing_info',
        subscription.id,
        auditContext,
        { 
          accessReason: 'Viewing billing information',
          hasPaymentMethod: !!paymentMethod,
        } as Record<string, unknown>
      );

      const response: BillingResponse = {
        subscription: {
          id: subscription.id,
          planType: subscription.planType,
          status: subscription.status,
          amount: subscription.amount,
          currentPeriodStart: subscription.currentPeriodStart.toISOString(),
          currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
          cancelledAt: subscription.cancelledAt?.toISOString() || null,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          stripeCustomerId: subscription.stripeCustomerId,
          paymentMethod,
        },
        summary: {
          totalPaid,
          nextBillingDate: subscription.cancelAtPeriodEnd 
            ? null 
            : subscription.currentPeriodEnd.toISOString(),
        },
      };

      return NextResponse.json(response);

    } catch (dbError) {
      console.error('[Billing API] Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to fetch billing information' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[Billing API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
