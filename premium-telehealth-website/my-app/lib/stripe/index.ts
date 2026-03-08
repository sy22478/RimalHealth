/**
 * Stripe Integration Module
 * 
 * Central export point for all Stripe-related functionality.
 * 
 * @module lib/stripe
 */

// Server-side exports
export {
  // Client
  getStripe,
  isStripeConfigured,
  arePriceIdsConfigured,
  
  // Customers
  createCustomer,
  getOrCreateCustomer,
  getCustomer,
  
  // Subscriptions
  getPriceId,
  getPlanAmount,
  createSubscription,
  getSubscription,
  cancelSubscription,
  resumeSubscription,
  updateSubscriptionPrice,
  
  // Checkout
  createCheckoutSession,
  getCheckoutSession,
  
  // Customer Portal
  createCustomerPortalSession,
  configureCustomerPortal,
  
  // Invoices
  getInvoice,
  listInvoices,
  
  // Webhooks
  constructWebhookEvent,
  
  // Constants
  STRIPE_PRICE_IDS,
  PLAN_AMOUNTS,
  PLAN_NAMES,
  PLAN_DESCRIPTIONS,
  
  // Types
  type Stripe,
  type StripeSubscription,
  type StripeCustomer,
  type StripeInvoice,
  type StripeCheckoutSession,
  type StripeEvent,
} from './stripe-server';

// Client-side exports
export {
  getPublishableKey,
  isStripeConfigured as isStripeClientConfigured,
  getPlans,
  getPlan,
  buildSuccessUrl,
  buildCancelUrl,
  buildCheckoutApiUrl,
  parseCheckoutResult,
  formatAmount,
  formatInterval,
  type PlanInfo,
  type PlanType,
  type PaymentStatus,
  type CheckoutState,
} from './stripe-client';

// Webhook handlers
export {
  handleCheckoutCompleted,
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  type WebhookResult,
} from './stripe-webhooks';
