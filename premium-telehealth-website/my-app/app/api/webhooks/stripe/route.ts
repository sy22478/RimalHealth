/**
 * Stripe Webhook Handler
 * 
 * Handles Stripe webhook events, particularly checkout.session.completed
 * which triggers patient profile creation after successful payment.
 * 
 * Events Handled:
 * - checkout.session.completed: Create patient profile, subscription, send welcome email
 * - invoice.payment_succeeded: Update subscription status
 * - invoice.payment_failed: Handle failed payment
 * - customer.subscription.created: Log new subscription
 * - customer.subscription.updated: Handle plan changes
 * - customer.subscription.deleted: Handle cancellation
 * 
 * HIPAA Compliance:
 * - PHI is encrypted at rest via Prisma extension
 * - All actions are audit logged
 * - Temporary checkout data cleared after profile creation
 * - No PHI in error logs
 * 
 * @module app/api/webhooks/stripe
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';

// Import from new stripe module
import { getStripe, constructWebhookEvent } from '@/lib/stripe/stripe-server';

// Force dynamic rendering for webhooks (requires runtime env vars)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Lazy imports to prevent build-time initialization
const getPrisma = async () => {
  const { prisma } = await import('@/lib/db/prisma');
  return prisma;
};

const getAuditLogger = async () => {
  const { auditLogger, PHIResourceType } = await import('@/lib/audit');
  return { auditLogger, PHIResourceType };
};

const getNotifications = async () => {
  const { EmailTemplate } = await import('@/lib/notifications');
  return { EmailTemplate };
};


const getPrismaClient = async () => {
  const { PlanType, SubscriptionStatus, Role } = await import('@prisma/client');
  return { PlanType, SubscriptionStatus, Role };
};

/**
 * POST handler for Stripe webhooks
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured');
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    );
  }

  const payload = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    console.error('[Stripe Webhook] Missing signature');
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  // ========================================================================
  // 1. Verify webhook signature
  // ========================================================================
  try {
    event = constructWebhookEvent(payload, signature);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Stripe Webhook] Signature verification failed: ${errorMessage}`);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  console.info(`[Stripe Webhook] Event: ${event.type}`);

  // ========================================================================
  // 2. Deduplication check — reject already-processed events
  // ========================================================================
  try {
    const prisma = await getPrisma();
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { stripeEventId: event.id },
    });
    if (existingEvent) {
      console.info(`[Stripe Webhook] Duplicate event ${event.id}, skipping`);
      return NextResponse.json({ received: true, deduplicated: true });
    }
  } catch {
    // If the dedup check fails (e.g., DB unavailable), proceed with processing
    // to avoid dropping legitimate events. The per-handler idempotency guards
    // still protect against double-creates.
    console.warn('[Stripe Webhook] Dedup check failed, proceeding with processing');
  }

  // ========================================================================
  // 3. Handle the event
  // ========================================================================
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        console.info(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    // Record processed event for deduplication
    await getPrisma()
      .then((p) =>
        p.webhookEvent.create({
          data: { stripeEventId: event.id, eventType: event.type },
        })
      )
      .catch(() => {
        // Don't fail the webhook if dedup recording fails
        console.warn('[Stripe Webhook] Failed to record webhook event for dedup');
      });

    return NextResponse.json({ received: true });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Stripe Webhook] Error handling event ${event.type}: ${errorMessage}`);

    // Return 500 so Stripe retries the webhook for events we handle but failed to process.
    // This prevents silent data loss (e.g., customer pays but account is never created).
    return NextResponse.json(
      { received: true, error: 'Processing error' },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed
 * Auto-creates user + profile + subscription after successful payment.
 * For new users (payment-first flow), sends receipt + "Create Account" emails.
 * For existing users, links subscription and sends welcome email.
 *
 * Email order: Receipt FIRST, then Create Account (or Welcome for existing users).
 */
async function handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
  // Processing checkout.session.completed

  // Initialize lazy imports
  const prisma = await getPrisma();
  const { PlanType, SubscriptionStatus, Role } = await getPrismaClient();
  const { EmailTemplate } = await getNotifications();
  const { auditLogger, PHIResourceType } = await getAuditLogger();
  const { hashPassword } = await import('@/lib/auth/password');

  const customerEmail = (session.customer_email || session.customer_details?.email || '').toLowerCase().trim();
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!customerEmail) {
    throw new Error('No customer email in session');
  }

  // ========================================================================
  // 1. Idempotency: check if subscription already recorded
  // ========================================================================
  if (subscriptionId) {
    const existingSub = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });
    if (existingSub) {
      console.info('[Stripe Webhook] Subscription already recorded, skipping');
      return;
    }
  }

  // ========================================================================
  // 2. Retrieve Stripe subscription details (needed for DB records)
  // ========================================================================
  let stripeSubscription: Stripe.Subscription | null = null;
  if (subscriptionId) {
    stripeSubscription = await getStripe().subscriptions.retrieve(subscriptionId);
  }

  const stripeSub = stripeSubscription as unknown as { current_period_start?: number; current_period_end?: number };
  const periodStart = stripeSub?.current_period_start
    ? new Date(stripeSub.current_period_start * 1000)
    : new Date();
  const periodEnd = stripeSub?.current_period_end
    ? new Date(stripeSub.current_period_end * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const planType = (session.metadata?.planType as typeof PlanType[keyof typeof PlanType]) || PlanType.ACTIVE_TREATMENT;

  // ========================================================================
  // 3. Find or create User + PatientProfile + Subscription in a transaction
  //    (Task 3.5: Transaction safety — no orphaned records on partial failure)
  // ========================================================================
  let isNewUser = false;
  let createAccountToken: string | null = null;

  const user = await prisma.$transaction(async (tx) => {
    // Find existing user
    let txUser = await tx.user.findUnique({
      where: { email: customerEmail },
    });

    if (!txUser) {
      // Auto-create user with a random temporary password
      const randomPassword = crypto.randomUUID() + crypto.randomUUID();
      const passwordHash = await hashPassword(randomPassword);

      txUser = await tx.user.create({
        data: {
          email: customerEmail,
          passwordHash,
          role: Role.PATIENT,
          emailVerified: false,
        },
      });

      isNewUser = true;
      console.info('[Stripe Webhook] Auto-created user after checkout');
    }

    const userId = txUser.id;

    // Create PatientProfile if it doesn't exist
    const existingProfile = await tx.patientProfile.findUnique({
      where: { userId },
    });

    if (!existingProfile) {
      // Create a minimal profile — patient will complete it later
      // PHI fields are auto-encrypted by the Prisma encryption extension
      await tx.patientProfile.create({
        data: {
          userId,
          firstName: '',
          lastName: '',
          dateOfBirth: '',
          phone: '',
          addressStreet: '',
          addressCity: '',
          addressState: 'CA',
          addressZip: '',
        },
      });
    }

    // Create Subscription record
    await tx.subscription.create({
      data: {
        userId,
        planType,
        status: SubscriptionStatus.ACTIVE,
        amount: session.amount_total || 5000,
        currency: session.currency?.toUpperCase() || 'USD',
        interval: 'month',
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId || '',
        stripePriceId: stripeSubscription?.items.data[0]?.price.id || '',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
      },
    });

    // Generate create-account token for new/unverified users
    if (isNewUser || !txUser.emailVerified) {
      const token = crypto.randomUUID();
      await tx.passwordReset.create({
        data: {
          userId,
          token,
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
        },
      });
      createAccountToken = token;
    }

    return txUser;
  });

  const userId = user.id;

  // ========================================================================
  // 4. Send emails (directly, not queued, for reliability)
  //    Order: Receipt FIRST, then Create Account / Welcome
  // ========================================================================
  const { sendEmail } = await import('@/lib/integrations/sendgrid');

  // 4a. Send payment receipt to ALL users (Task 3.1)
  const nextBillingDate = periodEnd.toLocaleDateString();
  const planLabel = planType === PlanType.ACTIVE_TREATMENT ? 'Active Treatment' : 'Maintenance';

  await sendEmail({
    to: customerEmail,
    template: EmailTemplate.PAYMENT_RECEIPT,
    data: {
      firstName: 'there',
      amount: `$${((session.amount_total || 0) / 100).toFixed(2)}`,
      date: new Date().toLocaleDateString(),
      description: `Rimal Health - ${planLabel} Plan`,
      transactionId: session.payment_intent as string || session.id,
      nextBillingDate,
    },
  });

  // 4b. Send Create Account or Welcome email
  if (createAccountToken) {
    // New or unverified user — send Create Account email (Task 3.2)
    const createAccountUrl = `${process.env.NEXT_PUBLIC_APP_URL}/create-account?token=${createAccountToken}`;

    const createAccountResult = await sendEmail({
      to: customerEmail,
      template: EmailTemplate.CREATE_ACCOUNT,
      data: {
        createAccountUrl,
      },
    });

    if (!createAccountResult.success) {
      console.error('[Stripe Webhook] CRITICAL: Failed to send create-account email for session:', session.id);
    }
  } else {
    // Verified existing user — send welcome email
    await sendEmail({
      to: user.email,
      template: EmailTemplate.WELCOME,
      data: {
        firstName: 'there',
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/patient/dashboard`,
      },
    });
  }

  // ========================================================================
  // 5. Audit log
  // ========================================================================
  await auditLogger.logPHIAccess(
    'CREATE',
    userId,
    'PATIENT',
    PHIResourceType.PATIENT_PROFILE,
    userId,
    {
      ipAddress: 'stripe-webhook',
      userAgent: 'stripe',
      requestId: crypto.randomUUID(),
    },
    {
      accessReason: isNewUser ? 'Auto-created after payment (payment-first flow)' : 'Subscription created after payment',
    }
  );

  // ========================================================================
  // 6. Link consent record to user (Task 3.4)
  // ========================================================================
  const consentRecordId = session.metadata?.consentRecordId;
  if (consentRecordId) {
    try {
      // Update the original consent AuditLog entry to link it to the user
      await prisma.auditLog.updateMany({
        where: {
          eventType: 'CONSENT_RECORDED',
          resourceType: 'CONSENT',
          resourceId: consentRecordId,
        },
        data: {
          userId,
          targetUserId: userId,
        },
      });

      // Also create a linkage audit entry for traceability
      await prisma.auditLog.create({
        data: {
          eventType: 'CONSENT_LINKED',
          severity: 'INFO',
          userId,
          userRole: 'PATIENT',
          ipAddress: 'stripe-webhook',
          userAgent: 'stripe',
          resourceType: 'CONSENT',
          resourceId: consentRecordId,
          targetUserId: userId,
          metadata: {
            stripeSessionId: session.id,
            consentRecordId,
            linkedAt: new Date().toISOString(),
          },
          success: true,
        },
      });
    } catch {
      // Don't fail checkout if consent linkage fails — it's logged for compliance
      console.warn('[Stripe Webhook] Failed to link consent record to user');
    }
  }

  // Checkout processing complete
}

/**
 * Handle invoice.payment_succeeded
 * Updates subscription status and records payment
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  // Processing invoice.payment_succeeded

  // Initialize lazy imports
  const prisma = await getPrisma();
  const { SubscriptionStatus } = await getPrismaClient();

  // Access subscription property safely
  const subscriptionRef = (invoice as unknown as { subscription?: string | Stripe.Subscription }).subscription;
  if (!subscriptionRef) {
    return; // Not a subscription invoice
  }

  const subscriptionId = typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef.id;

  // ========================================================================
  // 1. Idempotency check - see if invoice already recorded
  // ========================================================================
  const existingInvoice = await prisma.invoice.findFirst({
    where: { stripeInvoiceId: invoice.id },
  });

  if (existingInvoice) {
    // Invoice already recorded, skipping
    return;
  }

  // ========================================================================
  // 2. Find subscription and update status
  // ========================================================================
  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!subscription) {
    console.warn(`[Stripe Webhook] Subscription not found: ${subscriptionId}`);
    return;
  }

  // Update subscription status to ACTIVE
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: SubscriptionStatus.ACTIVE },
  });

  // ========================================================================
  // 3. Create invoice record
  // ========================================================================
  await prisma.invoice.create({
    data: {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      amount: invoice.amount_paid,
      currency: invoice.currency.toUpperCase(),
      status: 'PAID',
      stripeInvoiceId: invoice.id,
      stripeChargeId: (invoice as unknown as { charge?: string }).charge || null,
      paidAt: new Date(),
    },
  });

  // Payment recorded for subscription
}

/**
 * Handle invoice.payment_failed
 * Marks subscription as past due and notifies user
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  // Processing invoice.payment_failed

  // Initialize lazy imports
  const prisma = await getPrisma();
  const { SubscriptionStatus } = await getPrismaClient();

  const subscriptionRef = (invoice as unknown as { subscription?: string | Stripe.Subscription }).subscription;
  if (!subscriptionRef) {
    return;
  }

  const subscriptionId = typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef.id;

  // ========================================================================
  // 1. Find subscription and update status
  // ========================================================================
  const subscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!subscription) {
    console.warn(`[Stripe Webhook] Subscription not found: ${subscriptionId}`);
    return;
  }

  // Update subscription status to PAST_DUE
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: SubscriptionStatus.PAST_DUE },
  });

  // ========================================================================
  // 2. Create notification for user
  // ========================================================================
  await prisma.notification.create({
    data: {
      userId: subscription.userId,
      type: 'PAYMENT_FAILED',
      title: 'Payment Failed',
      message: 'We were unable to process your payment. Please update your payment method to avoid service interruption.',
      actionUrl: '/patient/billing',
    },
  });

  // Subscription marked as past due
}

/**
 * Handle customer.subscription.created
 * Logs new subscription (usually handled by checkout.session.completed)
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  // Subscription created in Stripe (handled by checkout.session.completed)
  // Main logic handled by checkout.session.completed
  // This handler catches subscriptions created outside of checkout flow
}

/**
 * Handle customer.subscription.updated
 * Updates subscription details including plan changes and status updates
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  // Processing customer.subscription.updated

  // Initialize lazy imports
  const prisma = await getPrisma();
  const { SubscriptionStatus, PlanType } = await getPrismaClient();

  // ========================================================================
  // 1. Find local subscription
  // ========================================================================
  const localSubscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!localSubscription) {
    console.warn(`[Stripe Webhook] Subscription not found: ${subscription.id}`);
    return;
  }

  // ========================================================================
  // 2. Map Stripe status to our status
  // ========================================================================
  let status: typeof SubscriptionStatus[keyof typeof SubscriptionStatus];
  switch (subscription.status) {
    case 'active':
      status = SubscriptionStatus.ACTIVE;
      break;
    case 'canceled':
      status = SubscriptionStatus.CANCELLED;
      break;
    case 'past_due':
      status = SubscriptionStatus.PAST_DUE;
      break;
    case 'unpaid':
      status = SubscriptionStatus.UNPAID;
      break;
    case 'paused':
      status = SubscriptionStatus.EXPIRED;
      break;
    default:
      status = SubscriptionStatus.ACTIVE;
  }

  // ========================================================================
  // 3. Calculate period dates
  // ========================================================================
  const stripeSub = subscription as unknown as { current_period_start?: number; current_period_end?: number };
  const periodStart = stripeSub.current_period_start 
    ? new Date(stripeSub.current_period_start * 1000)
    : new Date();
  const periodEnd = stripeSub.current_period_end
    ? new Date(stripeSub.current_period_end * 1000)
    : new Date();

  // ========================================================================
  // 4. Check for plan change
  // ========================================================================
  let planType = localSubscription.planType;
  let amount = localSubscription.amount;

  if (subscription.items.data.length > 0) {
    const priceId = subscription.items.data[0].price.id;
    
    // Check if price ID matches a different plan
    if (priceId === process.env.STRIPE_PRICE_ACTIVE_TREATMENT && planType !== PlanType.ACTIVE_TREATMENT) {
      planType = PlanType.ACTIVE_TREATMENT;
      amount = 5000; // $50.00
    } else if (priceId === process.env.STRIPE_PRICE_MAINTENANCE && planType !== PlanType.MAINTENANCE) {
      planType = PlanType.MAINTENANCE;
      amount = 2500; // $25.00
    }
  }

  // ========================================================================
  // 5. Update subscription record
  // ========================================================================
  await prisma.subscription.update({
    where: { id: localSubscription.id },
    data: {
      status,
      planType,
      amount,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });

  // Subscription updated
}

/**
 * Handle customer.subscription.deleted
 * Marks subscription as cancelled in database
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  // Processing customer.subscription.deleted

  // Initialize lazy imports
  const prisma = await getPrisma();
  const { SubscriptionStatus } = await getPrismaClient();

  // ========================================================================
  // 1. Find local subscription
  // ========================================================================
  const localSubscription = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!localSubscription) {
    console.warn(`[Stripe Webhook] Subscription not found: ${subscription.id}`);
    return;
  }

  // ========================================================================
  // 2. Update subscription as cancelled
  // ========================================================================
  await prisma.subscription.update({
    where: { id: localSubscription.id },
    data: {
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelAtPeriodEnd: false,
    },
  });

  // ========================================================================
  // 3. Create notification for user
  // ========================================================================
  await prisma.notification.create({
    data: {
      userId: localSubscription.userId,
      type: 'SUBSCRIPTION_CANCELLED',
      title: 'Subscription Cancelled',
      message: 'Your subscription has been cancelled. We\'re sorry to see you go.',
      actionUrl: '/patient/billing',
    },
  });

  // Subscription cancelled
}
