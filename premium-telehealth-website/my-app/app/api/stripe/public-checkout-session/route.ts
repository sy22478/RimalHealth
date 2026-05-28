/**
 * POST /api/stripe/public-checkout-session
 * Creates a Stripe Checkout session for new patients (no auth required).
 * Stripe collects the customer's email during checkout.
 * After payment, the webhook auto-creates the user account.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PlanType } from '@prisma/client';
import { rateLimit, rateLimitPresets } from '@/lib/middleware/rate-limit';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const publicCheckoutSchema = z.object({
  planType: z.enum(['ACTIVE_TREATMENT', 'WEIGHT_MANAGEMENT']),
  successUrl: z.string().url('Invalid success URL'),
  cancelUrl: z.string().url('Invalid cancel URL'),
  consentId: z.string().uuid('Invalid consent ID').optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Rate limit by IP to prevent abuse
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateLimitResult = await rateLimit(clientIp, rateLimitPresets.api);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter ?? 60) } }
    );
  }

  const {
    createCheckoutSession,
    getOrCreateCustomer,
    getPriceId,
    isStripeConfigured,
    getStripe,
  } = await import('@/lib/stripe/stripe-server');

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Payment processing is not available.', code: 'STRIPE_NOT_CONFIGURED' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const validationResult = publicCheckoutSchema.safeParse(body);

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

    const { planType, successUrl, cancelUrl, consentId } = validationResult.data;

    // Validate redirect URLs start with the app URL to prevent open redirect
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) {
      if (!successUrl.startsWith(appUrl) || !cancelUrl.startsWith(appUrl)) {
        return NextResponse.json(
          {
            error: 'Invalid redirect URL',
            code: 'INVALID_REDIRECT',
          },
          { status: 400 }
        );
      }
    }

    const priceId = getPriceId(planType as PlanType);

    // Create a Stripe Checkout session without a pre-existing customer.
    // Stripe collects the customer email and creates the customer automatically
    // when no `customer` param is provided in subscription mode.
    const stripe = getStripe();

    // Product-type identifier (no PHI) so the webhook can branch consent text,
    // plan label, and patient product context. Derived from the plan.
    const productType = planType === 'WEIGHT_MANAGEMENT' ? 'WEIGHT_MANAGEMENT' : 'ALCOHOL';

    const sessionMetadata: Record<string, string> = { planType, productType };
    if (consentId) {
      sessionMetadata.consentRecordId = consentId;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      billing_address_collection: 'required',
      payment_method_collection: 'always',
      metadata: sessionMetadata,
      subscription_data: {
        metadata: { planType, productType },
        trial_period_days: 30,
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    // Payment-creation failure — report for alerting.
    Sentry.captureException(error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Public Checkout] Error:', errorMessage);

    return NextResponse.json(
      { error: 'Failed to create checkout session. Please try again later.', code: 'CHECKOUT_ERROR' },
      { status: 500 }
    );
  }
}
