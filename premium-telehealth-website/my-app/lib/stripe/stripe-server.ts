/**
 * Stripe Server-Side Client
 * 
 * HIPAA Compliance:
 * - No credit card data stored or logged
 * - Only Stripe IDs stored (customer_*, sub_*, etc.)
 * - All payment data handled by Stripe (PCI compliant)
 * - Lazy initialization for build safety
 * 
 * @module lib/stripe/stripe-server
 */

import Stripe from 'stripe';
import { PlanType } from '@prisma/client';
import { PLAN_AMOUNTS, PLAN_NAMES, PLAN_DESCRIPTIONS } from './plan-constants';

// ============================================
// Configuration
// ============================================

/**
 * Stripe Price IDs from environment variables
 * These correspond to products created in Stripe Dashboard
 */
export const STRIPE_PRICE_IDS: Record<PlanType, string | undefined> = {
  ACTIVE_TREATMENT: process.env.STRIPE_PRICE_ACTIVE_TREATMENT,
  WEIGHT_MANAGEMENT: process.env.STRIPE_PRICE_WEIGHT_MANAGEMENT,
};

/**
 * Plan display names, amounts, and descriptions live in a client-safe module
 * (no `stripe` SDK import) so client components can render product-aware copy.
 * Re-exported here to keep existing server-side import sites working.
 */
export { PLAN_AMOUNTS, PLAN_NAMES, PLAN_DESCRIPTIONS };

// ============================================
// Lazy Stripe Client Initialization
// ============================================

let stripeInstance: Stripe | null = null;

/**
 * Get or create Stripe client instance
 * Uses lazy initialization for build-time safety
 * 
 * @returns Stripe client instance
 * @throws Error if STRIPE_SECRET_KEY is not configured
 */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not configured');
    }
    stripeInstance = new Stripe(key, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    });
  }
  return stripeInstance;
}

/**
 * Check if Stripe is properly configured.
 *
 * Used to conditionally enable/disable payment features and to fail fast on a
 * misconfigured price BEFORE a patient hits checkout.
 *
 * @param planType - When provided, also require that plan's price ID to be set.
 *   This lets a GLP-1 checkout report "not available" when only the GLP-1 price
 *   is missing, without affecting AUD checkout (and vice versa). Omit to check
 *   reachability only (secret key present) — preserves existing callers.
 */
export function isStripeConfigured(planType?: PlanType): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !key.startsWith('sk_')) return false;
  if (planType) return !!STRIPE_PRICE_IDS[planType];
  return true;
}

/**
 * Check if Stripe price IDs are configured
 */
export function arePriceIdsConfigured(): boolean {
  return !!STRIPE_PRICE_IDS.ACTIVE_TREATMENT;
}

// ============================================
// Customer Management
// ============================================

/**
 * Create a new Stripe customer
 * 
 * @param email - Customer email
 * @param name - Customer full name
 * @param metadata - Optional metadata (userId, etc.)
 * @returns Stripe customer ID
 */
export async function createCustomer(
  email: string,
  name: string,
  metadata?: Record<string, string>
): Promise<string> {
  const stripe = getStripe();

  const customer = await stripe.customers.create({
    email,
    name,
    metadata,
  });

  return customer.id;
}

/**
 * Get or create a Stripe customer by email
 * 
 * @param email - Customer email
 * @param name - Customer full name
 * @param metadata - Optional metadata
 * @returns Stripe customer ID
 */
export async function getOrCreateCustomer(
  email: string,
  name: string,
  metadata?: Record<string, string>
): Promise<string> {
  const stripe = getStripe();

  // Check for existing customer
  const existing = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existing.data.length > 0) {
    const customer = existing.data[0];
    
    // Update metadata if provided
    if (metadata && Object.keys(metadata).length > 0) {
      await stripe.customers.update(customer.id, { metadata });
    }
    
    return customer.id;
  }

  // Create new customer
  return createCustomer(email, name, metadata);
}

/**
 * Retrieve a Stripe customer
 * 
 * @param customerId - Stripe customer ID
 * @returns Stripe customer object
 */
export async function getCustomer(customerId: string): Promise<Stripe.Customer> {
  const stripe = getStripe();
  const customer = await stripe.customers.retrieve(customerId);
  
  if (customer.deleted) {
    throw new Error(`Customer ${customerId} has been deleted`);
  }
  
  return customer as Stripe.Customer;
}

// ============================================
// Subscription Management
// ============================================

/**
 * Get price ID for a plan type
 * 
 * @param planType - Plan type enum
 * @returns Stripe price ID
 * @throws Error if price ID not configured
 */
export function getPriceId(planType: PlanType): string {
  const priceId = STRIPE_PRICE_IDS[planType];
  if (!priceId) {
    throw new Error(`Price ID not configured for plan type: ${planType}`);
  }
  return priceId;
}

/**
 * Get plan amount in cents
 * 
 * @param planType - Plan type enum
 * @returns Amount in cents
 */
export function getPlanAmount(planType: PlanType): number {
  return PLAN_AMOUNTS[planType];
}

/**
 * Create a Stripe subscription
 * 
 * @param customerId - Stripe customer ID
 * @param priceId - Stripe price ID
 * @param metadata - Optional metadata
 * @returns Created subscription
 */
export async function createSubscription(
  customerId: string,
  priceId: string,
  metadata?: Record<string, string>
): Promise<Stripe.Subscription> {
  const stripe = getStripe();

  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    collection_method: 'charge_automatically',
    expand: ['latest_invoice.payment_intent'],
    metadata,
  });
}

/**
 * Retrieve a subscription
 * 
 * @param subscriptionId - Stripe subscription ID
 * @returns Subscription object
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripe();

  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['latest_invoice'],
  });
}

/**
 * Cancel a subscription
 * 
 * @param subscriptionId - Stripe subscription ID
 * @param cancelAtPeriodEnd - If true, cancels at period end
 * @returns Updated subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<Stripe.Subscription> {
  const stripe = getStripe();

  if (cancelAtPeriodEnd) {
    return stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    return stripe.subscriptions.cancel(subscriptionId);
  }
}

/**
 * Resume a subscription scheduled for cancellation
 * 
 * @param subscriptionId - Stripe subscription ID
 * @returns Updated subscription
 */
export async function resumeSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripe();

  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * Update subscription to different price/plan
 * 
 * @param subscriptionId - Stripe subscription ID
 * @param newPriceId - New Stripe price ID
 * @returns Updated subscription
 */
export async function updateSubscriptionPrice(
  subscriptionId: string,
  newPriceId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripe();

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const currentItem = subscription.items.data[0];

  if (!currentItem) {
    throw new Error('Subscription has no items');
  }

  return stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: currentItem.id,
        price: newPriceId,
      },
    ],
    proration_behavior: 'create_prorations',
  });
}

// ============================================
// Checkout Sessions
// ============================================

/**
 * Create a checkout session for subscription signup
 * 
 * @param customerId - Stripe customer ID
 * @param priceId - Stripe price ID
 * @param successUrl - Success redirect URL
 * @param cancelUrl - Cancel redirect URL
 * @param metadata - Optional metadata
 * @returns Checkout session
 */
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  metadata?: Record<string, string>
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  return stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata,
    },
    metadata,
    billing_address_collection: 'required',
    payment_method_collection: 'always',
    allow_promotion_codes: true,
  });
}

/**
 * Retrieve a checkout session
 * 
 * @param sessionId - Checkout session ID
 * @returns Checkout session with expanded data
 */
export async function getCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();

  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription', 'customer'],
  });
}

// ============================================
// Customer Portal
// ============================================

/**
 * Create a customer portal session
 * 
 * @param customerId - Stripe customer ID
 * @param returnUrl - URL to return to after portal
 * @returns Portal session with URL
 */
export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();

  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

/**
 * Configure customer portal settings
 * Call this once to set up the portal configuration
 * 
 * @returns Portal configuration
 */
export async function configureCustomerPortal(): Promise<Stripe.BillingPortal.Configuration> {
  const stripe = getStripe();

  // Build the portal product list from configured products only. The GLP-1
  // (weight-management) product is included when its env vars are set.
  const portalProducts: Array<{ product: string; prices: string[] }> = [
    {
      product: process.env.STRIPE_PRODUCT_ACTIVE_TREATMENT || '',
      prices: [process.env.STRIPE_PRICE_ACTIVE_TREATMENT || ''],
    },
  ];
  if (process.env.STRIPE_PRODUCT_WEIGHT_MANAGEMENT && process.env.STRIPE_PRICE_WEIGHT_MANAGEMENT) {
    portalProducts.push({
      product: process.env.STRIPE_PRODUCT_WEIGHT_MANAGEMENT,
      prices: [process.env.STRIPE_PRICE_WEIGHT_MANAGEMENT],
    });
  }

  return stripe.billingPortal.configurations.create({
    features: {
      payment_method_update: { enabled: true },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price', 'quantity', 'promotion_code'],
        proration_behavior: 'create_prorations',
        products: portalProducts,
      },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        cancellation_reason: {
          enabled: true,
          options: [
            'too_expensive',
            'missing_features',
            'switched_service',
            'unused',
            'other',
          ],
        },
      },
      invoice_history: { enabled: true },
    },
    business_profile: {
      headline: 'Manage your Rimal Health subscription',
      privacy_policy_url: `${process.env.NEXT_PUBLIC_APP_URL}/privacy`,
      terms_of_service_url: `${process.env.NEXT_PUBLIC_APP_URL}/terms`,
    },
  });
}

// ============================================
// Payment Method Management
// ============================================

/**
 * Get customer's payment method, cascading through multiple sources:
 * 1. Customer's invoice_settings.default_payment_method
 * 2. Subscription's default_payment_method (covers trial subscriptions)
 * 3. First card payment method attached to the customer
 *
 * @param customerId - Stripe customer ID
 * @param subscriptionId - Optional Stripe subscription ID for fallback lookup
 * @returns Payment method or null
 */
export async function getDefaultPaymentMethod(
  customerId: string,
  subscriptionId?: string
): Promise<Stripe.PaymentMethod | null> {
  const stripe = getStripe();

  const customer = await stripe.customers.retrieve(customerId);

  if (customer.deleted) {
    return null;
  }

  // 1. Try customer's default payment method
  const defaultPaymentMethodId = (customer as Stripe.Customer)
    .invoice_settings?.default_payment_method;

  if (defaultPaymentMethodId && typeof defaultPaymentMethodId === 'string') {
    return stripe.paymentMethods.retrieve(defaultPaymentMethodId);
  }

  // 2. Try subscription's default payment method (e.g. during trial)
  if (subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['default_payment_method'],
      });
      const subPm = subscription.default_payment_method;
      if (subPm && typeof subPm === 'object' && 'id' in subPm) {
        return subPm as Stripe.PaymentMethod;
      }
      if (typeof subPm === 'string') {
        return stripe.paymentMethods.retrieve(subPm);
      }
    } catch {
      // Subscription may not exist or be inaccessible; continue to fallback
    }
  }

  // 3. List customer's card payment methods as last resort
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: 'card',
    limit: 1,
  });

  if (paymentMethods.data.length > 0) {
    return paymentMethods.data[0];
  }

  return null;
}

// ============================================
// Invoice Management
// ============================================

/**
 * Get invoice details
 * 
 * @param invoiceId - Stripe invoice ID
 * @returns Invoice object
 */
export async function getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
  const stripe = getStripe();
  return stripe.invoices.retrieve(invoiceId);
}

/**
 * List customer invoices
 * 
 * @param customerId - Stripe customer ID
 * @param limit - Maximum number of invoices
 * @returns Array of invoices
 */
export async function listInvoices(
  customerId: string,
  limit: number = 100
): Promise<Stripe.Invoice[]> {
  const stripe = getStripe();

  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
  });

  return invoices.data;
}

// ============================================
// Webhook Handling
// ============================================

/**
 * Construct and verify webhook event
 * 
 * @param payload - Raw request body
 * @param signature - Stripe-Signature header
 * @returns Verified Stripe event
 * @throws Error if signature verification fails
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not configured');
  }

  return stripe.webhooks.constructEvent(payload, signature, secret);
}

// ============================================
// Type Exports
// ============================================

export type { Stripe };
export type StripeSubscription = Stripe.Subscription;
export type StripeCustomer = Stripe.Customer;
export type StripeInvoice = Stripe.Invoice;
export type StripeCheckoutSession = Stripe.Checkout.Session;
export type StripeEvent = Stripe.Event;
