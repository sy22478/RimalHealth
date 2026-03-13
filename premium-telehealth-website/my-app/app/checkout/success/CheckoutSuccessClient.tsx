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
import { CheckCircle, Loader2, AlertCircle, ArrowRight, KeyRound, Mail } from 'lucide-react';

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
  const [setPasswordUrl, setSetPasswordUrl] = React.useState<string>('');
  const [tokenLoading, setTokenLoading] = React.useState(true);

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
          const email = data.customerEmail || '';
          setSessionDetails({
            id: data.sessionId,
            status: data.status,
            paymentStatus: data.paymentStatus,
            planType: data.metadata?.planType || 'ACTIVE_TREATMENT',
            amount: data.amount_total || 5000,
            customerEmail: email,
          });
          setStatus('success');

          // Try to get the set-password token for a direct link.
          // The Stripe webhook may not have fired yet, so retry with backoff.
          if (email) {
            const fetchToken = async (): Promise<void> => {
              const maxRetries = 6;
              const baseDelay = 3000; // 3 seconds
              for (let i = 0; i < maxRetries; i++) {
                // Wait before each attempt (webhook needs time to process)
                if (i > 0) {
                  await new Promise((r) => setTimeout(r, baseDelay * i));
                }
                try {
                  const tokenRes = await fetch('/api/auth/set-password-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email }),
                  });
                  // Stop retrying if rate limited
                  if (tokenRes.status === 429) break;
                  const tokenData = await tokenRes.json();
                  if (tokenData.token) {
                    setSetPasswordUrl(`/set-password?token=${tokenData.token}`);
                    return;
                  }
                } catch {
                  // Network error, will retry
                }
              }
            };
            fetchToken().finally(() => setTokenLoading(false));
          } else {
            setTokenLoading(false);
          }
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
                <KeyRound className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Create Your Password</p>
                  <p className="text-sm text-muted-foreground">
                    Set a password for your account to log in and complete your intake form.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border p-4">
                <Mail className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Physician Review</p>
                  <p className="text-sm text-muted-foreground">
                    After your intake, a CA-licensed physician will review within 24 hours.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {sessionDetails?.customerEmail && (
            <Alert className="bg-primary/5 border-primary/20">
              <Mail className="h-4 w-4 text-primary" />
              <AlertDescription>
                We sent a password setup link to <strong>{sessionDetails.customerEmail}</strong>. Check your inbox (and spam folder).
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          {tokenLoading ? (
            <Button className="w-full" size="lg" disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Preparing your account...
            </Button>
          ) : setPasswordUrl ? (
            <Button asChild className="w-full" size="lg">
              <Link href={setPasswordUrl}>
                Set Your Password
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Alert className="text-left">
              <Mail className="h-4 w-4" />
              <AlertDescription>
                Your account is being set up. Check your email for a password setup link, or refresh this page in a moment.
              </AlertDescription>
            </Alert>
          )}

          <Button variant="outline" asChild className="w-full">
            <Link href="/login">
              Already have a password? Log in
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
