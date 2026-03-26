/**
 * Subscription Service
 * 
 * Business logic layer for subscription management.
 * Provides high-level operations that combine Stripe API calls with database updates.
 * 
 * HIPAA Compliance:
 * - No PHI in Stripe metadata
 * - All operations are audit logged
 * - Database records use encrypted fields for PHI
 * 
 * @module lib/services/subscription-service
 */

import { PlanType, SubscriptionStatus, PrismaClient } from '@prisma/client';
import { getStripe } from '@/lib/stripe/stripe-server';
import type Stripe from 'stripe';

// Lazy load Prisma to avoid build issues
async function getPrisma(): Promise<PrismaClient> {
  const { prisma } = await import('@/lib/db/prisma');
  return prisma;
}

// ============================================
// Types
// ============================================

export interface SubscriptionDetails {
  id: string;
  planType: PlanType;
  status: SubscriptionStatus;
  amount: number;
  currency: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date | null;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
}

export interface CreateSubscriptionResult {
  success: boolean;
  subscription?: SubscriptionDetails;
  stripeSubscriptionId?: string;
  error?: string;
  code?: string;
}

export interface CancelSubscriptionResult {
  success: boolean;
  message: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd?: Date;
  error?: string;
}

export interface ChangePlanResult {
  success: boolean;
  message: string;
  oldPlan?: PlanType;
  newPlan?: PlanType;
  prorationAmount?: number;
  error?: string;
}

// ============================================
// Subscription Queries
// ============================================

/**
 * Get user's active subscription
 * 
 * @param userId - User ID
 * @returns Subscription details or null
 */
export async function getActiveSubscription(
  userId: string
): Promise<SubscriptionDetails | null> {
  const prisma = await getPrisma();

  const subscription = await prisma.subscription.findFirst({
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

  if (!subscription) {
    return null;
  }

  return {
    id: subscription.id,
    planType: subscription.planType,
    status: subscription.status,
    amount: subscription.amount,
    currency: subscription.currency,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    cancelledAt: subscription.cancelledAt,
    stripeSubscriptionId: subscription.stripeSubscriptionId,
    stripeCustomerId: subscription.stripeCustomerId,
  };
}

/**
 * Get all subscriptions for a user
 * 
 * @param userId - User ID
 * @returns Array of subscription details
 */
export async function getUserSubscriptions(
  userId: string
): Promise<SubscriptionDetails[]> {
  const prisma = await getPrisma();

  const subscriptions = await prisma.subscription.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return subscriptions.map(sub => ({
    id: sub.id,
    planType: sub.planType,
    status: sub.status,
    amount: sub.amount,
    currency: sub.currency,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    cancelledAt: sub.cancelledAt,
    stripeSubscriptionId: sub.stripeSubscriptionId,
    stripeCustomerId: sub.stripeCustomerId,
  }));
}

/**
 * Check if user has an active subscription
 * 
 * @param userId - User ID
 * @returns Boolean indicating active subscription
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const subscription = await getActiveSubscription(userId);
  return subscription !== null && subscription.status === SubscriptionStatus.ACTIVE;
}

// ============================================
// Subscription Actions
// ============================================

/**
 * Create a new subscription for a user
 * 
 * @param userId - User ID
 * @param planType - Plan type
 * @param customerId - Stripe customer ID
 * @param stripeSubscriptionId - Stripe subscription ID
 * @returns Create result
 */
export async function createSubscription(
  userId: string,
  planType: PlanType,
  customerId: string,
  stripeSubscriptionId: string
): Promise<CreateSubscriptionResult> {
  const prisma = await getPrisma();

  try {
    // Check if user already has active subscription
    const existing = await getActiveSubscription(userId);
    if (existing) {
      return {
        success: false,
        error: 'User already has an active subscription',
        code: 'SUBSCRIPTION_EXISTS',
      };
    }

    // Get plan amount
    const { getPlanAmount } = await import('@/lib/stripe/stripe-server');
    const amount = getPlanAmount(planType);

    // Calculate period dates
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);

    // Get price ID from Stripe subscription
    const stripe = getStripe();
    const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const priceId = stripeSub.items.data[0]?.price.id || '';

    // Create subscription record
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        planType,
        status: SubscriptionStatus.ACTIVE,
        amount,
        currency: 'USD',
        interval: 'month',
        stripeCustomerId: customerId,
        stripeSubscriptionId,
        stripePriceId: priceId,
        currentPeriodStart,
        currentPeriodEnd,
      },
    });

    return {
      success: true,
      subscription: {
        id: subscription.id,
        planType: subscription.planType,
        status: subscription.status,
        amount: subscription.amount,
        currency: subscription.currency,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        cancelledAt: subscription.cancelledAt,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        stripeCustomerId: subscription.stripeCustomerId,
      },
      stripeSubscriptionId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      code: 'CREATE_ERROR',
    };
  }
}

/**
 * Cancel a user's subscription
 * 
 * @param userId - User ID
 * @param immediate - If true, cancel immediately; otherwise at period end
 * @returns Cancel result
 */
export async function cancelUserSubscription(
  userId: string,
  immediate: boolean = false
): Promise<CancelSubscriptionResult> {
  const prisma = await getPrisma();

  try {
    // Get active subscription
    const subscription = await getActiveSubscription(userId);
    
    if (!subscription) {
      return {
        success: false,
        error: 'No active subscription found',
        message: 'No active subscription',
        cancelAtPeriodEnd: false,
      };
    }

    // Cancel in Stripe
    const { cancelSubscription } = await import('@/lib/stripe/stripe-server');
    await cancelSubscription(subscription.stripeSubscriptionId, !immediate);

    // Update database
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: immediate ? SubscriptionStatus.CANCELLED : subscription.status,
        cancelAtPeriodEnd: !immediate,
        cancelledAt: immediate ? new Date() : undefined,
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId,
        type: 'SUBSCRIPTION_CANCELLED',
        title: 'Subscription Cancelled',
        message: immediate
          ? 'Your subscription has been cancelled immediately.'
          : 'Your subscription will be cancelled at the end of your current billing period.',
        actionUrl: '/patient/billing',
      },
    });

    return {
      success: true,
      message: immediate
        ? 'Subscription cancelled immediately'
        : 'Subscription will cancel at period end',
      cancelAtPeriodEnd: !immediate,
      currentPeriodEnd: subscription.currentPeriodEnd,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      cancelAtPeriodEnd: false,
      message: 'Failed to cancel subscription',
    };
  }
}

/**
 * Resume a subscription scheduled for cancellation
 * 
 * @param userId - User ID
 * @returns Success status
 */
export async function resumeSubscription(userId: string): Promise<boolean> {
  const prisma = await getPrisma();

  try {
    // Get subscription that's scheduled for cancellation
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        cancelAtPeriodEnd: true,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (!subscription) {
      return false;
    }

    // Resume in Stripe
    const { resumeSubscription: resumeStripeSub } = await import('@/lib/stripe/stripe-server');
    await resumeStripeSub(subscription.stripeSubscriptionId);

    // Update database
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
    });

    return true;
  } catch (error) {
    console.error('Error resuming subscription:', error);
    return false;
  }
}

/**
 * Change subscription plan
 * 
 * @param userId - User ID
 * @param newPlanType - New plan type
 * @returns Change result
 */
export async function changeSubscriptionPlan(
  userId: string,
  newPlanType: PlanType
): Promise<ChangePlanResult> {
  const prisma = await getPrisma();

  try {
    // Get current subscription
    const subscription = await getActiveSubscription(userId);
    
    if (!subscription) {
      return {
        success: false,
        error: 'No active subscription found',
        message: 'No active subscription',
      };
    }

    if (subscription.planType === newPlanType) {
      return {
        success: false,
        error: 'Already on selected plan',
        message: 'You are already subscribed to this plan',
      };
    }

    // Get new price ID
    const { getPriceId, getPlanAmount } = await import('@/lib/stripe/stripe-server');
    const newPriceId = getPriceId(newPlanType);
    const newAmount = getPlanAmount(newPlanType);

    // Update in Stripe
    const stripe = getStripe();
    const currentSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    const currentItem = currentSub.items.data[0];

    if (!currentItem) {
      return {
        success: false,
        error: 'Subscription has no items',
        message: 'Invalid subscription',
      };
    }

    const updatedStripeSub = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        items: [
          {
            id: currentItem.id,
            price: newPriceId,
          },
        ],
        proration_behavior: 'create_prorations',
      }
    );

    // Update database
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planType: newPlanType,
        amount: newAmount,
        stripePriceId: newPriceId,
      },
    });

    // Calculate proration (simplified)
    const prorationAmount = updatedStripeSub.latest_invoice && 
      typeof updatedStripeSub.latest_invoice !== 'string'
      ? updatedStripeSub.latest_invoice.amount_due
      : 0;

    return {
      success: true,
      message: `Plan changed to ${newPlanType}`,
      oldPlan: subscription.planType,
      newPlan: newPlanType,
      prorationAmount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      message: 'Failed to change plan',
    };
  }
}

// ============================================
// Invoice Management
// ============================================

/**
 * Get user's invoices
 * 
 * @param userId - User ID
 * @returns Array of invoices
 */
export async function getUserInvoices(userId: string) {
  const prisma = await getPrisma();

  return prisma.invoice.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      subscription: {
        select: {
          planType: true,
        },
      },
    },
  });
}

// ============================================
// Sync Operations
// ============================================

/**
 * Sync subscription with Stripe
 * Updates local record with latest Stripe data
 * 
 * @param stripeSubscriptionId - Stripe subscription ID
 * @returns Success status
 */
export async function syncSubscriptionWithStripe(
  stripeSubscriptionId: string
): Promise<boolean> {
  const prisma = await getPrisma();

  try {
    // Get from Stripe
    const stripe = getStripe();
    const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId) as unknown as {
      status: string;
      current_period_start: number;
      current_period_end: number;
      cancel_at_period_end: boolean;
    };

    // Find local record
    const localSub = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId },
    });

    if (!localSub) {
      console.warn(`Subscription ${stripeSubscriptionId} not found locally`);
      return false;
    }

    // Map status
    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      canceled: SubscriptionStatus.CANCELLED,
      past_due: SubscriptionStatus.PAST_DUE,
      unpaid: SubscriptionStatus.UNPAID,
      paused: SubscriptionStatus.EXPIRED,
      incomplete: SubscriptionStatus.UNPAID,
      incomplete_expired: SubscriptionStatus.EXPIRED,
      trialing: SubscriptionStatus.ACTIVE,
    };

    // Update local record
    await prisma.subscription.update({
      where: { id: localSub.id },
      data: {
        status: statusMap[stripeSub.status] || localSub.status,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      },
    });

    return true;
  } catch (error) {
    console.error('Error syncing subscription:', error);
    return false;
  }
}
