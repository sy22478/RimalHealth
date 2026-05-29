'use client';

/**
 * Checkout Payment Page
 * 
 * Allows users to select a plan and proceed to Stripe Checkout.
 * Requires authentication.
 * 
 * @module app/checkout/payment/CheckoutPaymentClient
 */

import * as React from 'react';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Loader2, Shield, AlertCircle, Scale, Pill } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/Skeleton';

import { getPlans, PlanInfo, isStripeConfigured } from '@/lib/stripe/stripe-client';

// ============================================
// Types
// ============================================

type CheckoutStatus = 'idle' | 'loading' | 'redirecting' | 'error';

interface CheckoutState {
  status: CheckoutStatus;
  error?: string;
  selectedPlan?: string;
}

// ============================================
// Plan Card Component
// ============================================

interface PlanCardProps {
  plan: PlanInfo;
  isSelected: boolean;
  onSelect: () => void;
  disabled: boolean;
  showPopularBadge: boolean;
}

function PlanCard({ plan, isSelected, onSelect, disabled, showPopularBadge }: PlanCardProps) {
  const isPopular = showPopularBadge && plan.id === 'ACTIVE_TREATMENT';

  // Per-treatment icon so the AUD and weight-management plan cards are
  // visually distinguishable at a glance.
  const PlanIcon = plan.id === 'WEIGHT_MANAGEMENT' ? Scale : Pill;

  return (
    <Card
      className={`relative cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'border-2 border-primary shadow-lg'
          : 'border border-border hover:border-primary/50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={disabled ? undefined : onSelect}
      role="radio"
      aria-checked={isSelected}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {isPopular && (
        <Badge className="absolute -top-2 left-4 bg-primary text-primary-foreground">
          Most Popular
        </Badge>
      )}
      
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlanIcon className="h-5 w-5 text-primary" aria-hidden />
            <CardTitle className="text-lg">{plan.name}</CardTitle>
          </div>
          {isSelected && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-4 w-4" />
            </div>
          )}
        </div>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>
      
      <CardContent className="pb-4">
        <div className="mb-4">
          <span className="text-3xl font-bold">{plan.formattedAmount}</span>
          <span className="text-muted-foreground">/{plan.interval}</span>
        </div>
        
        <ul className="space-y-2">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      
      <CardFooter>
        <Button
          variant={isSelected ? 'default' : 'outline'}
          className="w-full"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {isSelected ? 'Selected' : 'Select Plan'}
        </Button>
      </CardFooter>
    </Card>
  );
}

// ============================================
// Inner Content Component (uses useSearchParams)
// ============================================

/**
 * Normalize a `?plan=` value to a PlanType enum id. Accepts both URL slugs
 * (`active-treatment`, `weight-management`) and enum values. Unknown values
 * default to ACTIVE_TREATMENT (AUD) — backward compatible.
 */
function normalizePlanId(raw: string | null): string {
  const v = (raw ?? '').trim().toLowerCase().replace(/_/g, '-');
  if (v === 'weight-management') return 'WEIGHT_MANAGEMENT';
  return 'ACTIVE_TREATMENT';
}

function CheckoutPaymentContent({ priceConfigured }: { priceConfigured: boolean }) {
  const searchParams = useSearchParams();

  const [state, setState] = React.useState<CheckoutState>({
    status: 'idle',
  });

  const [plans] = React.useState<PlanInfo[]>(getPlans());

  // Get pre-selected plan and consent ID from URL. Normalize the `plan` slug to
  // a PlanType enum id so the value sent to the checkout API is always valid.
  const preselectedPlan = normalizePlanId(searchParams.get('plan'));
  const consentId = searchParams.get('consentId');

  const [selectedPlanId, setSelectedPlanId] = React.useState<string>(preselectedPlan);

  // Stripe is usable only if the publishable key is set (client check) AND the
  // selected plan's price is configured server-side (priceConfigured prop). The
  // latter is resolved on the server because price IDs are not exposed to the
  // client — this surfaces the warning for a GLP-1 selection when only the
  // GLP-1 price is missing.
  const stripeConfigured = React.useMemo(
    () => isStripeConfigured() && priceConfigured,
    [priceConfigured]
  );

  const handlePlanSelect = (planId: string) => {
    if (state.status !== 'idle' && state.status !== 'error') return;
    setSelectedPlanId(planId);
  };

  const handleCheckout = async () => {
    if (!selectedPlanId) return;

    setState({ status: 'loading' });

    try {
      const baseUrl = window.location.origin;
      const successUrl = `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/checkout/cancel`;

      const response = await fetch('/api/stripe/public-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planType: selectedPlanId,
          successUrl,
          cancelUrl,
          ...(consentId ? { consentId } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      setState({ status: 'redirecting' });

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setState({
        status: 'error',
        error: errorMessage,
        selectedPlan: selectedPlanId,
      });
    }
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  // Show only the plan the patient chose (at pricing/consent). This keeps the
  // AUD payment page a single AUD card (unchanged) and prevents a GLP-1 patient
  // from switching to the AUD plan after signing the GLP-1 consent.
  const visiblePlans = plans.filter(p => p.id === selectedPlanId);

  return (
    <div className="container mx-auto max-w-5xl py-12 px-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Choose Your Plan</h1>
        <p className="mt-2 text-muted-foreground">
          Select the plan that works best for your treatment journey
        </p>
      </div>

      {/* Stripe Not Configured Warning */}
      {!stripeConfigured && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Payment processing is not available. Please contact support.
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {state.status === 'error' && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {state.error || 'An error occurred. Please try again.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Plan Selection (hidden during loading/redirecting) */}
      {(state.status === 'idle' || state.status === 'error') && (
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {visiblePlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isSelected={selectedPlanId === plan.id}
              onSelect={() => handlePlanSelect(plan.id)}
              disabled={state.status !== 'idle' && state.status !== 'error'}
              showPopularBadge={visiblePlans.length > 1}
            />
          ))}
        </div>
      )}

      {/* Order Summary & Checkout */}
      {selectedPlan && (
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle className="text-lg">Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{selectedPlan.name}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">Billing</span>
              <span className="font-medium">Monthly</span>
            </div>
            <Separator className="my-4" />
            <div className="flex justify-between py-2">
              <span className="font-medium">Total</span>
              <span className="text-xl font-bold">{selectedPlan.formattedAmount}/month</span>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              className="w-full"
              size="lg"
              onClick={handleCheckout}
              disabled={(state.status !== 'idle' && state.status !== 'error') || !stripeConfigured}
            >
              {state.status === 'loading' && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {state.status === 'redirecting' && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {(state.status === 'idle' || state.status === 'error') && 'Proceed to Checkout'}
              {state.status === 'loading' && 'Creating checkout...'}
              {state.status === 'redirecting' && 'Redirecting to Stripe...'}
            </Button>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" />
              <span>Secure payment powered by Stripe</span>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Trust Indicators */}
      <div className="mt-12 text-center">
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>PCI Compliant</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            <span>Cancel anytime</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            <span>24-hour physician review</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Export with Suspense Wrapper
// ============================================

export default function CheckoutPaymentClient({ priceConfigured }: { priceConfigured: boolean }) {
  return (
    <Suspense fallback={
      <div className="container mx-auto max-w-4xl py-12 px-4">
        <div className="mb-8 space-y-2 text-center">
          <Skeleton className="mx-auto h-8 w-64" />
          <Skeleton className="mx-auto h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[500px]" />
          <Skeleton className="h-[500px]" />
        </div>
      </div>
    }>
      <CheckoutPaymentContent priceConfigured={priceConfigured} />
    </Suspense>
  );
}
