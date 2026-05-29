/**
 * Stripe Plan Constants — client-safe
 *
 * Plan display names, amounts, and descriptions keyed by `PlanType`. These live
 * in their own module (with NO `stripe` SDK import) so client components can
 * render product-aware copy without bundling the server-only Stripe client.
 *
 * `stripe-server.ts` re-exports these for existing server-side import sites.
 *
 * @module lib/stripe/plan-constants
 */

// Type-only import — erased at build time, so this module pulls in no
// `@prisma/client` runtime code into the client bundle.
import type { PlanType } from '@prisma/client';

/**
 * Plan amounts in cents (fallback values).
 * ACTIVE_TREATMENT: $50.00/month
 * WEIGHT_MANAGEMENT: $50.00/month — TODO(business): confirm GLP-1 platform fee
 */
export const PLAN_AMOUNTS: Record<PlanType, number> = {
  ACTIVE_TREATMENT: 5000,
  WEIGHT_MANAGEMENT: 5000,
};

/** Plan display names. */
export const PLAN_NAMES: Record<PlanType, string> = {
  ACTIVE_TREATMENT: 'Active Treatment',
  WEIGHT_MANAGEMENT: 'Weight Management',
};

/** Plan descriptions for checkout. */
export const PLAN_DESCRIPTIONS: Record<PlanType, string> = {
  ACTIVE_TREATMENT: 'Full access to medication-assisted treatment with physician monitoring',
  WEIGHT_MANAGEMENT: 'Physician-managed GLP-1 weight management with ongoing monitoring',
};

/**
 * Format a plan amount (in cents) as a USD string, e.g. 5000 → "$50".
 * Drops the cents when the amount is a whole dollar value.
 */
export function formatPlanAmount(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}
