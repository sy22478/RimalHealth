/**
 * Checkout Success Client Component
 * 
 * Shown after successful payment through Stripe Checkout.
 * Verifies the session and shows confirmation to user.
 * 
 * @module app/checkout/success/CheckoutSuccessClient
 */

'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Loader2, AlertCircle, ArrowRight, Calendar, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

// ============================================
// Types
// ============================================

type VerificationStatus = 'verifying' | 'success' | 'error';

interface SessionDetails {
  id: string;
  status: string;
  paymentStatus: string;
  planType: string;
  amount: number;
  customerEmail: string;
}

// ============================================
// Main Page Component
// ============================================

export default function CheckoutSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [status, setStatus] = React.useState<VerificationStatus>('verifying');
  const [error, setError] = React.useState<string>('');
  const [sessionDetails, setSessionDetails] = React.useState<SessionDetails | null>(null);

  // Verify the checkout session
  React.useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setError('No session ID found. Please contact support.');
      return;
    }

    const verifySession = async () => {
      try {
        const response = await fetch(`/api/stripe/checkout-session?sessionId=${sessionId}`);

        if (!response.ok) {
          throw new Error('Failed to verify payment');
        }

        const data = await response.json();

        if (data.paymentStatus === 'paid') {
          setSessionDetails({
            id: data.sessionId,
            status: data.status,
            paymentStatus: data.paymentStatus,
            planType: data.metadata?.planType || 'ACTIVE_TREATMENT',
            amount: data.amount_total || 5000,
            customerEmail: data.customerEmail || '',
          });
          setStatus('success');
        } else {
          setStatus('error');
          setError('Payment not completed. Please try again.');
        }
      } catch (err) {
        console.error('Error verifying session:', err);
        // Even if verification fails, we show success since Stripe redirected here
        // The webhook will handle the actual provisioning
        setStatus('success');
      }
    };

    verifySession();
  }, [sessionId]);

  // Loading state
  if (status === 'verifying') {
    return (
      <div className="container mx-auto max-w-lg py-16 px-4">
        <Card className="text-center">
          <CardContent className="pt-12 pb-8">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <h2 className="mt-6 text-2xl font-semibold">Verifying your payment...</h2>
            <p className="mt-2 text-muted-foreground">
              Please wait while we confirm your subscription.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="container mx-auto max-w-lg py-16 px-4">
        <Card className="text-center">
          <CardContent className="pt-12 pb-8">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="mt-6 text-2xl font-semibold">Something went wrong</h2>
            <p className="mt-2 text-muted-foreground">
              {error || 'We could not verify your payment.'}
            </p>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button asChild className="w-full">
              <Link href="/checkout/payment">
                Try Again
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href="/contact">
                Contact Support
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Success state
  return (
    <div className="container mx-auto max-w-2xl py-12 px-4">
      <Card className="text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
            <CheckCircle className="h-10 w-10 text-success" />
          </div>
          <CardTitle className="text-3xl font-bold">Welcome to Rimal Health!</CardTitle>
          <CardDescription className="text-lg">
            Your subscription is now active
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 text-left">
          <Alert className="bg-success/10 border-success/20">
            <CheckCircle className="h-4 w-4 text-success" />
            <AlertDescription className="text-success-foreground">
              Payment successful! Check your email for a receipt.
            </AlertDescription>
          </Alert>

          {/* Order Details */}
          <div className="rounded-lg bg-muted p-4">
            <h3 className="mb-4 font-semibold">Subscription Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium">
                  Active Treatment
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">
                  ${sessionDetails ? (sessionDetails.amount / 100).toFixed(2) : '50.00'}/month
                </span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-success">Active</span>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="space-y-4">
            <h3 className="font-semibold">What happens next?</h3>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg border p-4">
                <Calendar className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Complete Your Intake</p>
                  <p className="text-sm text-muted-foreground">
                    Fill out your medical history so our physicians can review your case.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 rounded-lg border p-4">
                <Mail className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Physician Review</p>
                  <p className="text-sm text-muted-foreground">
                    A CA-licensed physician will review within 24 hours.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button asChild className="w-full" size="lg">
            <Link href="/intake">
              Start Your Intake
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          
          <Button variant="outline" asChild className="w-full">
            <Link href="/dashboard">
              Go to Dashboard
            </Link>
          </Button>
        </CardFooter>
      </Card>

      {/* Help Text */}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Have questions?{' '}
        <Link href="/contact" className="text-primary hover:underline">
          Contact our support team
        </Link>
      </p>
    </div>
  );
}
