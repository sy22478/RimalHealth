/**
 * Stripe Subscription Management API
 * 
 * POST /api/stripe/subscription - Create a subscription directly (alternative to Checkout)
 * GET /api/stripe/subscription - Get user's subscription details
 * DELETE /api/stripe/subscription - Cancel subscription
 * PATCH /api/stripe/subscription - Update subscription (resume, change plan)
 * 
 * HIPAA Compliance:
 * - Authenticated endpoints only
 * - Users can only access their own subscriptions
 * - Audit logging for all subscription changes
 * - No PHI in Stripe metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type Stripe from 'stripe';
import { PlanType, SubscriptionStatus } from '@prisma/client';

// JWT verification - safe to import at top level (no external deps)
import { verifyAccessToken } from '@/lib/auth/jwt';

// Audit logging - safe to import at top level
import { auditLogger } from '@/lib/audit/logger';
import { AuditEventType, AuditSeverity } from '@/lib/audit/types';
import { prisma } from '@/lib/db/prisma';

// ============================================
// Validation Schemas
// ============================================

const createSubscriptionSchema = z.object({
  planType: z.enum(['ACTIVE_TREATMENT', 'MAINTENANCE']),
  paymentMethodId: z.string().optional(), // For direct payment method attachment
});

const cancelSubscriptionSchema = z.object({
  immediate: z.boolean().default(false),
});

const updateSubscriptionSchema = z.object({
  action: z.enum(['resume', 'change_plan']),
  planType: z.enum(['ACTIVE_TREATMENT', 'MAINTENANCE']).optional(),
});

// ============================================
// Helper Functions
// ============================================

/**
 * Extract and verify access token from request.
 * Accepts Bearer token from Authorization header or accessToken cookie.
 */
async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const cookieToken = request.cookies.get('accessToken')?.value ?? null;
  const token = bearerToken ?? cookieToken;
  if (!token) {
    return null;
  }
  try {
    const payload = await verifyAccessToken(token);
    return payload;
  } catch {
    return null;
  }
}

/**
 * Get audit context from request
 */
function getAuditContext(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  return {
    ipAddress: forwarded?.split(',')[0]?.trim() ?? 'unknown',
    userAgent: request.headers.get('user-agent') ?? 'unknown',
    requestId: crypto.randomUUID(),
  };
}

/**
 * Get user's active subscription from database
 */
async function getUserSubscription(userId: string, prismaClient?: typeof prisma) {
  const prisma = prismaClient || (await import('@/lib/db/prisma')).prisma;
  return prisma.subscription.findFirst({
    where: {
      userId,
      status: {
        in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE],
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

// ============================================
// POST /api/stripe/subscription
// Create a new subscription directly
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Lazy load Stripe integration
  const {
    createSubscription,
    getOrCreateCustomer,
    getPriceId,
    isStripeConfigured,
    getPlanAmount,
  } = await import('@/lib/integrations/stripe');

  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: 'Payment processing is not available',
        code: 'STRIPE_NOT_CONFIGURED',
      },
      { status: 503 }
    );
  }

  const auditContext = getAuditContext(request);

  try {
    // Authenticate user
    const userPayload = await getAuthenticatedUser(request);
    
    if (!userPayload) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validationResult = createSubscriptionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { planType } = validationResult.data;

    // Get user from database
    const { prisma } = await import('@/lib/db/prisma');
    const user = await prisma.user.findUnique({
      where: { id: userPayload.userId },
      include: {
        patientProfile: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if user already has an active subscription
    const existingSubscription = await getUserSubscription(user.id);
    if (existingSubscription) {
      return NextResponse.json(
        {
          error: 'User already has an active subscription',
          code: 'SUBSCRIPTION_EXISTS',
          subscriptionId: existingSubscription.id,
        },
        { status: 409 }
      );
    }

    // Get or create Stripe customer
    const customerName = user.patientProfile
      ? `${user.patientProfile.firstName} ${user.patientProfile.lastName}`
      : user.email;

    const customerId = await getOrCreateCustomer(
      user.email,
      customerName,
      { userId: user.id }
    );

    // Get price ID for the plan
    const priceId = getPriceId(planType as PlanType);

    // Create subscription in Stripe
    const stripeSubscription = await createSubscription(
      customerId,
      priceId,
      {
        userId: user.id,
        planType,
      }
    );

    // Note: Payment intent may need to be retrieved separately if needed
    // The subscription is created, payment method will be collected via invoice

    // Calculate period dates from billing_cycle_anchor
    const periodStart = new Date(stripeSubscription.billing_cycle_anchor * 1000);
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 30); // 30-day subscription

    // Create subscription record in database (prisma already imported above)
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        planType: planType as PlanType,
        status: SubscriptionStatus.ACTIVE,
        amount: getPlanAmount(planType as PlanType),
        currency: 'USD',
        stripeCustomerId: customerId,
        stripeSubscriptionId: stripeSubscription.id,
        stripePriceId: priceId,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
    });

    // Log successful subscription creation
    await auditLogger.log({
      eventType: AuditEventType.PATIENT_DATA_CREATED,
      severity: AuditSeverity.INFO,
      userId: user.id,
      userRole: userPayload.role,
      resourceType: 'Subscription',
      resourceId: subscription.id,
      action: 'Subscription created',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      success: true,
      metadata: {
        planType,
        stripeSubscriptionId: stripeSubscription.id,
        amount: subscription.amount,
      },
    });

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        planType: subscription.planType,
        status: subscription.status,
        amount: subscription.amount,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
      stripeSubscriptionId: stripeSubscription.id,
    }, { status: 201 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[Stripe Subscription] Error creating subscription:', errorMessage);

    await auditLogger.log({
      eventType: AuditEventType.PATIENT_DATA_CREATED,
      severity: AuditSeverity.ERROR,
      action: 'Subscription creation failed',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      success: false,
      errorMessage,
    });

    return NextResponse.json(
      {
        error: 'Failed to create subscription. Please try again later.',
        code: 'SUBSCRIPTION_ERROR',
      },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/stripe/subscription
// Get user's subscription details
// ============================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Lazy load Stripe integration
  const {
    getSubscription,
    isStripeConfigured,
  } = await import('@/lib/integrations/stripe');

  // Lazy load database
  const { prisma } = await import('@/lib/db/prisma');

  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: 'Payment processing is not available',
        code: 'STRIPE_NOT_CONFIGURED',
      },
      { status: 503 }
    );
  }

  const auditContext = getAuditContext(request);

  try {
    // Authenticate user
    const userPayload = await getAuthenticatedUser(request);
    
    if (!userPayload) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Get user's subscriptions from database
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: userPayload.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 12, // Last 12 invoices
        },
      },
    });

    if (subscriptions.length === 0) {
      return NextResponse.json({
        subscriptions: [],
        hasActiveSubscription: false,
      });
    }

    // Get the most recent active subscription details from Stripe
    const activeSubscription = subscriptions.find(
      s => s.status === SubscriptionStatus.ACTIVE
    );

    let stripeSubscription = null;
    if (activeSubscription) {
      try {
        stripeSubscription = await getSubscription(activeSubscription.stripeSubscriptionId);
      } catch (error) {
        console.error('[Stripe Subscription] Error fetching Stripe subscription:', error);
        // Continue without Stripe data
      }
    }

    // Log access
    await auditLogger.log({
      eventType: AuditEventType.PATIENT_DATA_VIEWED,
      severity: AuditSeverity.INFO,
      userId: userPayload.userId,
      userRole: userPayload.role,
      resourceType: 'Subscription',
      action: 'Subscription details viewed',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      success: true,
    });

    return NextResponse.json({
      subscriptions: subscriptions.map(sub => ({
        id: sub.id,
        planType: sub.planType,
        status: sub.status,
        amount: sub.amount,
        currency: sub.currency,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        cancelledAt: sub.cancelledAt,
        createdAt: sub.createdAt,
      })),
      hasActiveSubscription: subscriptions.some(
        s => s.status === SubscriptionStatus.ACTIVE
      ),
      stripeDetails: stripeSubscription ? {
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        billingCycleAnchor: stripeSubscription.billing_cycle_anchor,
        defaultPaymentMethod: stripeSubscription.default_payment_method,
      } : null,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[Stripe Subscription] Error fetching subscription:', errorMessage);

    return NextResponse.json(
      {
        error: 'Failed to fetch subscription details',
        code: 'FETCH_ERROR',
      },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/stripe/subscription
// Cancel subscription
// ============================================

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  // Lazy load Stripe integration
  const {
    cancelSubscription,
    resumeSubscription,
    isStripeConfigured,
  } = await import('@/lib/integrations/stripe');

  // Lazy load database
  const { prisma } = await import('@/lib/db/prisma');

  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: 'Payment processing is not available',
        code: 'STRIPE_NOT_CONFIGURED',
      },
      { status: 503 }
    );
  }

  const auditContext = getAuditContext(request);

  try {
    // Authenticate user
    const userPayload = await getAuthenticatedUser(request);
    
    if (!userPayload) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Parse request body
    let immediate = false;
    try {
      const body = await request.json();
      const validationResult = cancelSubscriptionSchema.safeParse(body);
      if (validationResult.success) {
        immediate = validationResult.data.immediate;
      }
    } catch {
      // No body provided, use defaults
    }

    // Get user's active subscription
    const subscription = await getUserSubscription(userPayload.userId, prisma);

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription found', code: 'NO_SUBSCRIPTION' },
        { status: 404 }
      );
    }

    // Cancel in Stripe
    const cancelledStripeSub = await cancelSubscription(
      subscription.stripeSubscriptionId,
      !immediate // cancelAtPeriodEnd = true if not immediate
    );

    // Update database
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: immediate ? SubscriptionStatus.CANCELLED : subscription.status,
        cancelAtPeriodEnd: !immediate,
        cancelledAt: immediate ? new Date() : undefined,
      },
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: userPayload.userId,
        type: 'SUBSCRIPTION_CANCELLED',
        title: 'Subscription Cancelled',
        message: immediate
          ? 'Your subscription has been cancelled immediately.'
          : 'Your subscription will be cancelled at the end of your current billing period.',
        actionUrl: '/dashboard/billing',
      },
    });

    // Log cancellation
    await auditLogger.log({
      eventType: AuditEventType.PATIENT_DATA_UPDATED,
      severity: AuditSeverity.WARNING,
      userId: userPayload.userId,
      userRole: userPayload.role,
      resourceType: 'Subscription',
      resourceId: subscription.id,
      action: immediate ? 'Subscription cancelled immediately' : 'Subscription scheduled for cancellation',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      success: true,
      metadata: {
        immediate,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
      },
    });

    return NextResponse.json({
      message: immediate
        ? 'Subscription cancelled successfully'
        : 'Subscription will be cancelled at the end of the billing period',
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
        currentPeriodEnd: updatedSubscription.currentPeriodEnd,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[Stripe Subscription] Error cancelling subscription:', errorMessage);

    await auditLogger.log({
      eventType: AuditEventType.PATIENT_DATA_UPDATED,
      severity: AuditSeverity.ERROR,
      action: 'Subscription cancellation failed',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      success: false,
      errorMessage,
    });

    return NextResponse.json(
      {
        error: 'Failed to cancel subscription. Please try again later.',
        code: 'CANCEL_ERROR',
      },
      { status: 500 }
    );
  }
}

// ============================================
// PATCH /api/stripe/subscription
// Update subscription (resume, change plan)
// ============================================

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  // Lazy load Stripe integration
  const {
    cancelSubscription,
    resumeSubscription,
    isStripeConfigured,
  } = await import('@/lib/integrations/stripe');

  // Lazy load database
  const { prisma } = await import('@/lib/db/prisma');

  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: 'Payment processing is not available',
        code: 'STRIPE_NOT_CONFIGURED',
      },
      { status: 503 }
    );
  }

  const auditContext = getAuditContext(request);

  try {
    // Authenticate user
    const userPayload = await getAuthenticatedUser(request);
    
    if (!userPayload) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validationResult = updateSubscriptionSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { action, planType } = validationResult.data;

    // Get user's subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: userPayload.userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: 'No active subscription found', code: 'NO_SUBSCRIPTION' },
        { status: 404 }
      );
    }

    if (action === 'resume') {
      // Resume subscription that's set to cancel at period end
      if (!subscription.cancelAtPeriodEnd) {
        return NextResponse.json(
          { error: 'Subscription is not scheduled for cancellation', code: 'NOT_SCHEDULED' },
          { status: 400 }
        );
      }

      await resumeSubscription(subscription.stripeSubscriptionId);

      const updatedSubscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: false,
          cancelledAt: null,
        },
      });

      await auditLogger.log({
        eventType: AuditEventType.PATIENT_DATA_UPDATED,
        severity: AuditSeverity.INFO,
        userId: userPayload.userId,
        userRole: userPayload.role,
        resourceType: 'Subscription',
        resourceId: subscription.id,
        action: 'Subscription resumed',
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        success: true,
      });

      return NextResponse.json({
        message: 'Subscription resumed successfully',
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
        },
      });
    }

    if (action === 'change_plan') {
      // Plan change logic would go here
      // This requires creating a Stripe Schedule or updating the subscription
      return NextResponse.json(
        { error: 'Plan change not yet implemented', code: 'NOT_IMPLEMENTED' },
        { status: 501 }
      );
    }

    return NextResponse.json(
      { error: 'Invalid action', code: 'INVALID_ACTION' },
      { status: 400 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[Stripe Subscription] Error updating subscription:', errorMessage);

    return NextResponse.json(
      {
        error: 'Failed to update subscription. Please try again later.',
        code: 'UPDATE_ERROR',
      },
      { status: 500 }
    );
  }
}

// Stripe types are imported from the integration module
