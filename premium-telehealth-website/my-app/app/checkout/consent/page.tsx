'use client';

/**
 * Consent Page
 *
 * Standalone page displayed before checkout payment.
 * Users must agree to all consent items before proceeding.
 *
 * @module app/checkout/consent/page
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Shield, FileCheck, ArrowLeft, ArrowRight } from 'lucide-react';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

// ============================================
// Consent Items
// ============================================

const CONSENT_ITEMS: { id: string; label: React.ReactNode }[] = [
  { id: 'age', label: 'I confirm that I am at least 18 years of age.' },
  { id: 'california', label: 'I confirm that I am a current resident of the state of California.' },
  {
    id: 'hipaa',
    label: (
      <>
        I have read and agree to the{' '}
        <a
          href="/hipaa"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ocean font-medium underline hover:text-ocean-600"
        >
          HIPAA Notice of Privacy Practices
        </a>
        .
      </>
    ),
  },
  {
    id: 'privacy',
    label: (
      <>
        I have read and agree to the{' '}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ocean font-medium underline hover:text-ocean-600"
        >
          Privacy Policy
        </a>
        {' '}and{' '}
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ocean font-medium underline hover:text-ocean-600"
        >
          Terms of Service
        </a>
        .
      </>
    ),
  },
  {
    id: 'telehealth',
    label:
      'I consent to receive telehealth services, including asynchronous physician communication and medication-assisted treatment.',
  },
];

// ============================================
// Inner Content Component (uses useSearchParams)
// ============================================

function ConsentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [consents, setConsents] = React.useState<Record<string, boolean>>({});

  const allConsentsChecked = CONSENT_ITEMS.every((item) => consents[item.id]);

  const handleConsentToggle = (id: string, checked: boolean): void => {
    setConsents((prev) => ({ ...prev, [id]: checked }));
  };

  const handleContinue = (): void => {
    if (!allConsentsChecked) return;

    // Preserve any query params (e.g., ?plan=active-treatment)
    const plan = searchParams.get('plan');
    const paymentUrl = plan
      ? `/checkout/payment?plan=${encodeURIComponent(plan)}`
      : '/checkout/payment';

    router.push(paymentUrl);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto max-w-2xl py-12 px-4 sm:py-16 sm:px-6">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ocean-50">
            <FileCheck className="h-7 w-7 text-ocean" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">
            Before We Begin
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Please review and agree to the following before proceeding to payment.
          </p>
        </div>

        {/* Consent Card */}
        <Card className="shadow-lg border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-navy">
              <Shield className="h-5 w-5 text-ocean" />
              Consent &amp; Agreements
            </CardTitle>
            <CardDescription>
              All items are required to continue with your treatment.
            </CardDescription>
          </CardHeader>

          <Separator />

          <CardContent className="pt-6 space-y-5">
            {CONSENT_ITEMS.map((item) => (
              <div key={item.id} className="flex items-start gap-3">
                <Checkbox
                  id={`consent-${item.id}`}
                  checked={!!consents[item.id]}
                  onCheckedChange={(checked) =>
                    handleConsentToggle(item.id, checked === true)
                  }
                  className="mt-0.5"
                />
                <Label
                  htmlFor={`consent-${item.id}`}
                  className="text-sm leading-relaxed cursor-pointer text-gray-700"
                >
                  {item.label}
                </Label>
              </div>
            ))}
          </CardContent>

          <Separator />

          <CardFooter className="flex flex-col gap-4 pt-6">
            <Button
              className="w-full"
              size="lg"
              onClick={handleContinue}
              disabled={!allConsentsChecked}
            >
              Continue to Payment
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            <Link
              href="/"
              className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-navy transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </CardFooter>
        </Card>

        {/* Trust Indicators */}
        <div className="mt-10 text-center">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>256-bit Encryption</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Your data is protected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Export with Suspense Wrapper
// ============================================

export default function CheckoutConsentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-center">
            <div className="h-8 w-48 bg-gray-200 rounded mx-auto mb-4" />
            <div className="h-4 w-64 bg-gray-200 rounded mx-auto" />
          </div>
        </div>
      }
    >
      <ConsentContent />
    </Suspense>
  );
}
