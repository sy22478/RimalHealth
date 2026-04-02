/**
 * Stripe Customer Portal API Route
 * 
 * POST /api/patient/billing/portal
 * Creates a Stripe Customer Portal session for payment method management.
 * 
 * Pattern: INTEGRATION-001 - Stripe integration
 * Pattern: API-001 - Route handler template
 * Pattern: PHI-001 - Audit logging
 * HIPAA: Only Stripe IDs logged, no PHI
 * PCI: All payment data handled by Stripe
 * 
 * @module app/api/patient/billing/portal
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getStripe } from '@/lib/stripe/stripe-server';
import { auditLogger, createAuditContext } from '@/lib/audit/index';
import { requireRole } from '@/lib/auth/require-auth';
import { Role } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface PortalResponse {
  portalUrl: string;
  expiresAt: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

// ============================================================================
// Route Handler
// ============================================================================

/**
 * POST handler - Create Stripe Customer Portal session
 *
 * Returns:
 * - Stripe Customer Portal URL
 * - Expiration timestamp
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Require PATIENT role
    const auth = await requireRole(request, [Role.PATIENT]);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const userId = auth.user.userId;

    try {
      // Fetch subscription to get Stripe customer ID
      const subscription = await prisma.subscription.findFirst({
        where: { userId },
        select: {
          id: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
        },
      });

      if (!subscription?.stripeCustomerId) {
        return NextResponse.json(
          { error: 'No subscription found' },
          { status: 404 }
        );
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      // Create Stripe Customer Portal session
      const portalSession = await getStripe().billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${appUrl}/patient/billing`,
        flow_data: {
          type: 'payment_method_update',
        },
      });

      // Audit log the portal access
      const auditContext = createAuditContext(request, userId, 'PATIENT');
      await auditLogger.logPHIAccess(
        'UPDATE',
        userId,
        'PATIENT',
        'payment_method',
        subscription.id,
        auditContext,
        { 
          accessReason: 'Accessing Stripe Customer Portal',
        } as Record<string, unknown>
      );

      const response: PortalResponse = {
        portalUrl: portalSession.url,
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 1 hour
      };

      return NextResponse.json(response);

    } catch (dbError) {
      console.error('[Portal API] Database error:', dbError instanceof Error ? dbError.message : 'Unknown error');
      return NextResponse.json(
        { error: 'Failed to create billing portal session' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[Portal API] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
