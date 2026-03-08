/**
 * Stripe Client-Side Utilities
 * 
 * This module provides client-side Stripe utilities for the browser.
 * Only exposes what's safe to use on the client (publishable key, etc.)
 * 
 * @module lib/stripe/stripe-client
 */

// ============================================
// Configuration
// ============================================

/**
 * Get Stripe publishable key for client-side use
 * @returns Publishable key or empty string if not configured
 */
export function getPublishableKey(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
}

/**
 * Check if Stripe is configured for client-side use
 */
export function isStripeConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  return !!key && key.startsWith('pk_');
}

// ============================================
// Plan Information (Client-Safe)
// ============================================

export type PlanType = 'ACTIVE_TREATMENT';

export interface PlanInfo {
  id: PlanType;
  name: string;
  description: string;
  amount: number; // in cents
  formattedAmount: string;
  interval: string;
  features: string[];
}

/**
 * Get information about available plans
 * This is safe to use on the client as it doesn't expose sensitive IDs
 */
export function getPlans(): PlanInfo[] {
  return [
    {
      id: 'ACTIVE_TREATMENT',
      name: 'Active Treatment',
      description: 'Full access to medication-assisted treatment with physician monitoring',
      amount: 5000,
      formattedAmount: '$50',
      interval: 'month',
      features: [
        'Unlimited messaging with your physician',
        'Monthly medication prescriptions',
        '24-hour physician review guarantee',
        'Treatment progress tracking',
        'Medication adjustment support',
        'California-licensed physicians only',
      ],
    },
  ];
}

/**
 * Get a specific plan by ID
 */
export function getPlan(planType: PlanType): PlanInfo | undefined {
  return getPlans().find(plan => plan.id === planType);
}

// ============================================
// Checkout URL Helpers
// ============================================

/**
 * Build success URL for checkout redirect
 */
export function buildSuccessUrl(baseUrl: string, sessionId?: string): string {
  const url = new URL('/checkout/success', baseUrl);
  if (sessionId) {
    url.searchParams.set('session_id', sessionId);
  }
  return url.toString();
}

/**
 * Build cancel URL for checkout redirect
 */
export function buildCancelUrl(baseUrl: string): string {
  return new URL('/checkout/cancel', baseUrl).toString();
}

/**
 * Build checkout API URL
 */
export function buildCheckoutApiUrl(baseUrl: string): string {
  return new URL('/api/stripe/checkout-session', baseUrl).toString();
}

// ============================================
// Payment Status Helpers
// ============================================

export type PaymentStatus = 
  | 'idle'
  | 'redirecting'
  | 'processing'
  | 'success'
  | 'cancelled'
  | 'error';

export interface CheckoutState {
  status: PaymentStatus;
  error?: string;
  sessionId?: string;
}

/**
 * Parse checkout result from URL params
 * Used on success/cancel pages to determine payment status
 */
export function parseCheckoutResult(
  searchParams: URLSearchParams
): { status: PaymentStatus; sessionId?: string; error?: string } {
  const sessionId = searchParams.get('session_id') || undefined;
  
  if (searchParams.get('canceled')) {
    return { status: 'cancelled', sessionId };
  }
  
  if (searchParams.get('error')) {
    return { 
      status: 'error', 
      sessionId,
      error: searchParams.get('error') || undefined 
    };
  }
  
  if (sessionId) {
    return { status: 'success', sessionId };
  }
  
  return { status: 'idle' };
}

// ============================================
// Formatting Helpers
// ============================================

/**
 * Format amount in cents to currency string
 */
export function formatAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Format interval for display
 */
export function formatInterval(interval: string): string {
  return interval === 'month' ? '/month' : `/${interval}`;
}
