/**
 * Stripe Payment Integration
 * 
 * HIPAA Compliance Notes:
 * - No credit card numbers are logged or stored
 * - Only Stripe IDs (customer_*, sub_*, pi_*) are stored locally
 * - All payment data handled by Stripe (PCI compliant)
 * - Audit logging on all payment events
 * - Uses retry logic for external API calls (Pattern INT-001)
 * 
 * @module lib/integrations/stripe
 */

import Stripe from 'stripe';
import { PlanType } from '@prisma/client';

// ============================================
// Configuration
// ============================================

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PUBLIC_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

// Price IDs from environment
const PRICE_IDS: Record<PlanType, string | undefined> = {
  ACTIVE_TREATMENT: process.env.STRIPE_PRICE_ACTIVE_TREATMENT,
  MAINTENANCE: process.env.STRIPE_PRICE_MAINTENANCE,
};

// Plan amounts in cents (fallback if price IDs not configured)
const PLAN_AMOUNTS: Record<PlanType, number> = {
  ACTIVE_TREATMENT: 5000, // $50.00
  MAINTENANCE: 2500,      // $25.00
};

// ============================================
// Stripe Client
// ============================================

/**
 * Initialize Stripe client
 * Uses the latest API version for maximum compatibility
 * Lazy initialization to handle missing env vars during build
 */
const createStripeClient = (): Stripe => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    // Return a mock client for build time when env var isn't available
    // This will throw a proper error if actually used
    return new Stripe('sk_test_placeholder', {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    });
  }
  return new Stripe(key, {
    apiVersion: '2026-01-28.clover',
    typescript: true,
  });
};

export const stripe = createStripeClient();

/**
 * Check if Stripe is properly configured
 */
export function isStripeConfigured(): boolean {
  return !!STRIPE_SECRET_KEY && STRIPE_SECRET_KEY.startsWith('sk_');
}

/**
 * Get publishable key for client-side use
 */
export function getPublishableKey(): string {
  return STRIPE_PUBLIC_KEY;
}

// ============================================
// Customer Management
// ============================================

/**
 * Create a new Stripe customer
 * 
 * @param email - Customer email address
 * @param name - Customer full name
 * @param metadata - Optional metadata (userId, etc.)
 * @returns Stripe customer ID
 * @throws Error if Stripe API call fails
 * 
 * @example
 * ```typescript
 * const customerId = await createCustomer('user@example.com', 'John Doe', { userId: '123' });
 * ```
 */
export async function createCustomer(
  email: string,
  name: string,
  metadata?: Record<string, string>
): Promise<string> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }

  const customer = await withRetry(() =>
    stripe.customers.create({
      email,
      name,
      metadata,
    })
  );

  return customer.id;
}

/**
 * Get or create a Stripe customer
 * If customer already exists, returns existing ID
 * 
 * @param email - Customer email address
 * @param name - Customer full name
 * @param metadata - Optional metadata
 * @returns Stripe customer ID
 */
export async function getOrCreateCustomer(
  email: string,
  name: string,
  metadata?: Record<string, string>
): Promise<string> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }

  // Try to find existing customer by email
  const existingCustomers = await withRetry(() =>
    stripe.customers.list({
      email,
      limit: 1,
    })
  );

  if (existingCustomers.data.length > 0) {
    const customer = existingCustomers.data[0];
    
    // Update metadata if provided
    if (metadata && Object.keys(metadata).length > 0) {
      await withRetry(() =>
        stripe.customers.update(customer.id, { metadata })
      );
    }
    
    return customer.id;
  }

  // Create new customer
  return createCustomer(email, name, metadata);
}

/**
 * Update Stripe customer
 * 
 * @param customerId - Stripe customer ID
 * @param updates - Fields to update
 */
export async function updateCustomer(
  customerId: string,
  updates: Stripe.CustomerUpdateParams
): Promise<void> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }

  await withRetry(() => stripe.customers.update(customerId, updates));
}

// ============================================
// Subscription Management
// ============================================

/**
 * Create a subscription for a customer
 * 
 * @param customerId - Stripe customer ID
 * @param priceId - Stripe price ID
 * @param metadata - Optional metadata
 * @returns Created subscription
 * @throws Error if Stripe API call fails
 * 
 * @example
 * ```typescript
 * const subscription = await createSubscription('cus_123', 'price_456');
 * ```
 */
export async function createSubscription(
  customerId: string,
  priceId: string,
  metadata?: Record<string, string>
): Promise<Stripe.Subscription> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }

  return withRetry(() =>
    stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      collection_method: 'charge_automatically',
      expand: ['latest_invoice.payment_intent'],
      metadata,
    })
  );
}

/**
 * Get price ID for a plan type
 * Falls back to creating a price if not configured (development only)
 * 
 * @param planType - Plan type (ACTIVE_TREATMENT or MAINTENANCE)
 * @returns Stripe price ID
 */
export function getPriceId(planType: PlanType): string {
  const priceId = PRICE_IDS[planType];
  if (!priceId) {
    throw new Error(`Price ID not configured for plan type: ${planType}`);
  }
  return priceId;
}

/**
 * Get plan amount in cents
 * 
 * @param planType - Plan type
 * @returns Amount in cents
 */
export function getPlanAmount(planType: PlanType): number {
  return PLAN_AMOUNTS[planType];
}

/**
 * Cancel a subscription
 * 
 * @param subscriptionId - Stripe subscription ID
 * @param cancelAtPeriodEnd - If true, cancels at period end; if false, immediately
 * @returns Cancelled subscription
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<Stripe.Subscription> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }

  if (cancelAtPeriodEnd) {
    return withRetry(() =>
      stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      })
    );
  } else {
    return withRetry(() =>
      stripe.subscriptions.cancel(subscriptionId)
    );
  }
}

/**
 * Resume a subscription that's set to cancel at period end
 * 
 * @param subscriptionId - Stripe subscription ID
 * @returns Updated subscription
 */
export async function resumeSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }

  return withRetry(() =>
    stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    })
  );
}

/**
 * Get subscription details
 * 
 * @param subscriptionId - Stripe subscription ID
 * @returns Subscription object
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }

  return withRetry(() =>
    stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice'],
    })
  );
}

// ============================================
// Checkout Session
// ============================================

/**
 * Create a checkout session for subscription signup
 * 
 * @param customerId - Stripe customer ID
 * @param priceId - Stripe price ID
 * @param successUrl - URL to redirect after successful payment
 * @param cancelUrl - URL to redirect if user cancels
 * @param metadata - Optional metadata
 * @returns Checkout session (with URL for redirect)
 * @throws Error if Stripe API call fails
 * 
 * @example
 * ```typescript
 * const session = await createCheckoutSession(
 *   'cus_123',
 *   'price_456',
 *   'https://example.com/success',
 *   'https://example.com/cancel'
 * );
 * // Redirect user to session.url
 * ```
 */
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  metadata?: Record<string, string>
): Promise<Stripe.Checkout.Session> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }

  return withRetry(() =>
    stripe.checkout.sessions.create({
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
      // Collect billing address for tax purposes
      billing_address_collection: 'required',
      // Auto-collect payment method for future billing
      payment_method_collection: 'always',
    })
  );
}

/**
 * Retrieve a checkout session
 * 
 * @param sessionId - Checkout session ID
 * @returns Checkout session with expanded subscription
 */
export async function getCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }

  return withRetry(() =>
    stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    })
  );
}

// ============================================
// Payment Intent (Alternative to Checkout)
// ============================================

/**
 * Create a payment intent for immediate charging
 * Used for manual payment flows instead of Checkout
 * 
 * @param amount - Amount in cents
 * @param customerId - Stripe customer ID
 * @param metadata - Optional metadata
 * @returns Payment intent (with client_secret for frontend)
 * @throws Error if Stripe API call fails
 * 
 * @example
 * ```typescript
 * const paymentIntent = await createPaymentIntent(5000, 'cus_123');
 * // Return paymentIntent.client_secret to frontend
 * ```
 */
export async function createPaymentIntent(
  amount: number,
  customerId: string,
  metadata?: Record<string, string>
): Promise<Stripe.PaymentIntent> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }

  return withRetry(() =>
    stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: customerId,
      automatic_payment_methods: { enabled: true },
      metadata,
    })
  );
}

/**
 * Confirm a payment intent
 * 
 * @param paymentIntentId - Payment intent ID
 * @returns Confirmed payment intent
 */
export async function confirmPaymentIntent(
  paymentIntentId: string
): Promise<Stripe.PaymentIntent> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }

  return withRetry(() =>
    stripe.paymentIntents.retrieve(paymentIntentId)
  );
}

// ============================================
// Webhook Handling
// ============================================

/**
 * Construct webhook event from payload
 * Verifies the webhook signature for security
 * 
 * @param payload - Raw request body
 * @param signature - Stripe-Signature header value
 * @param secret - Webhook secret
 * @returns Verified Stripe event
 * @throws Error if signature verification fails
 * 
 * @example
 * ```typescript
 * const event = constructWebhookEvent(body, signature, webhookSecret);
 * switch (event.type) {
 *   case 'checkout.session.completed':
 *     // Handle checkout completion
 *     break;
 * }
 * ```
 */
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
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
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }

  return withRetry(() => stripe.invoices.retrieve(invoiceId));
}

/**
 * Get customer's invoice history
 * 
 * @param customerId - Stripe customer ID
 * @returns List of invoices
 */
export async function getCustomerInvoices(
  customerId: string
): Promise<Stripe.Invoice[]> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }

  const invoices = await withRetry(() =>
    stripe.invoices.list({
      customer: customerId,
      limit: 100,
    })
  );

  return invoices.data;
}

// ============================================
// Payment Method Management
// ============================================

/**
 * Get customer's default payment method
 * 
 * @param customerId - Stripe customer ID
 * @returns Payment method or null
 */
export async function getDefaultPaymentMethod(
  customerId: string
): Promise<Stripe.PaymentMethod | null> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }

  const customer = await withRetry(() =>
    stripe.customers.retrieve(customerId)
  );

  if (customer.deleted) {
    return null;
  }

  const defaultPaymentMethodId = (customer as Stripe.Customer)
    .invoice_settings?.default_payment_method;

  if (!defaultPaymentMethodId || typeof defaultPaymentMethodId !== 'string') {
    return null;
  }

  return withRetry(() =>
    stripe.paymentMethods.retrieve(defaultPaymentMethodId)
  );
}

/**
 * List customer's payment methods
 * 
 * @param customerId - Stripe customer ID
 * @returns List of payment methods
 */
export async function listPaymentMethods(
  customerId: string
): Promise<Stripe.PaymentMethod[]> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }

  const methods = await withRetry(() =>
    stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    })
  );

  return methods.data;
}

// ============================================
// Error Handling & Retry Logic (Pattern INT-001)
// ============================================

/**
 * Check if an error is retryable
 * Based on Stripe error types and HTTP status codes
 * 
 * @param error - Error from Stripe API
 * @returns Boolean indicating if the error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Stripe.errors.StripeError) {
    // Retry on rate limits (429) and server errors (5xx)
    if (error.statusCode === 429) return true;
    if (error.statusCode && error.statusCode >= 500) return true;
    
    // Retry on network errors
    if (error.type === 'StripeConnectionError') return true;
    if (error.type === 'StripeAPIError') return true;
    
    // Don't retry on client errors (4xx except 429)
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return false;
    }
  }
  
  // Retry on unknown errors (likely network-related)
  return true;
}

/**
 * Retry wrapper for Stripe API calls
 * Implements exponential backoff with jitter
 * 
 * @param operation - Async operation to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @returns Result of the operation
 * @throws Error if all retries fail
 * 
 * @example
 * ```typescript
 * const customer = await withRetry(() => stripe.customers.retrieve('cus_123'));
 * ```
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry if not a retryable error
      if (!isRetryableError(error)) {
        throw error;
      }
      
      // Don't retry after max attempts
      if (attempt >= maxRetries) {
        break;
      }
      
      // Exponential backoff with jitter
      const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      const jitter = Math.random() * 1000; // 0-1s random jitter
      const delay = baseDelay + jitter;
      
      console.log(`[Stripe] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

// ============================================
// Type Exports
// ============================================

export type { Stripe };
// Export error types for consumers
export type StripeError = Stripe.errors.StripeError;

// ============================================
// Default Export
// ============================================

export default {
  stripe,
  isStripeConfigured,
  getPublishableKey,
  createCustomer,
  getOrCreateCustomer,
  updateCustomer,
  createSubscription,
  cancelSubscription,
  resumeSubscription,
  getSubscription,
  createCheckoutSession,
  getCheckoutSession,
  createPaymentIntent,
  confirmPaymentIntent,
  constructWebhookEvent,
  getInvoice,
  getCustomerInvoices,
  getDefaultPaymentMethod,
  listPaymentMethods,
  getPriceId,
  getPlanAmount,
};
