import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PlanType } from '@prisma/client';
import { isStripeConfigured } from '@/lib/stripe/stripe-server';
import CheckoutPaymentClient from './CheckoutPaymentClient';

export const metadata: Metadata = {
  title: 'Checkout | Rimal Health',
  description: 'Complete your payment.',
};

// Reading searchParams to resolve the selected plan opts this route into
// dynamic rendering, which checkout already requires.
export const dynamic = 'force-dynamic';

/**
 * Normalize a `?plan=` value to a PlanType. Accepts URL slugs
 * (`weight-management`) and enum values; unknown values default to AUD.
 * Mirrors normalizePlanId() in CheckoutPaymentClient.
 */
function normalizePlanType(raw: string | string[] | undefined): PlanType {
  const v = (Array.isArray(raw) ? raw[0] : raw ?? '').trim().toLowerCase().replace(/_/g, '-');
  return v === 'weight-management' ? 'WEIGHT_MANAGEMENT' : 'ACTIVE_TREATMENT';
}

export default async function CheckoutPaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const planType = normalizePlanType(params.plan);

  // Server-side price check: the client can't read server-only STRIPE_PRICE_*
  // env vars, so resolve whether the selected plan is purchasable here and pass
  // it down. A GLP-1 selection reports false when only the GLP-1 price is unset.
  const priceConfigured = isStripeConfigured(planType);

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-8 w-48 bg-gray-200 rounded mx-auto mb-4"></div>
          <div className="h-4 w-32 bg-gray-200 rounded mx-auto"></div>
        </div>
      </div>
    }>
      <CheckoutPaymentClient priceConfigured={priceConfigured} />
    </Suspense>
  );
}
