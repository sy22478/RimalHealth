/**
 * Checkout Success Client Component
 *
 * Shown after successful payment through Stripe Checkout.
 * Displays a static confirmation page directing users to check their email
 * for account setup instructions.
 *
 * Security:
 * - Does NOT call authenticated API endpoints (user has no account yet)
 * - Does NOT display customer email, tokens, or any PHI
 * - The Stripe webhook handles user creation and sends the set-password email
 *
 * @module app/checkout/success/CheckoutSuccessClient
 */

'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, AlertCircle, ArrowRight, KeyRound, Mail } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

// ============================================
// Main Page Component
// ============================================

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  // If no session_id in URL, Stripe didn't redirect here properly
  if (!sessionId) {
    return (
      <div className="container mx-auto max-w-lg py-16 px-4">
        <Card className="text-center">
          <CardContent className="pt-12 pb-8">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <h2 className="mt-6 text-2xl font-semibold">Something went wrong</h2>
            <p className="mt-2 text-muted-foreground">
              No session ID found. Please contact support.
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

  // Success state — Stripe redirected here after successful payment.
  // The webhook will handle user creation and send the set-password email.
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
              Payment successful! A receipt has been sent to your email.
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
                  $50.00/month
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
                <Mail className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Check Your Email</p>
                  <p className="text-sm text-muted-foreground">
                    We sent you a link to set your password and activate your account.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border p-4">
                <KeyRound className="mt-0.5 h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Complete Your Intake</p>
                  <p className="text-sm text-muted-foreground">
                    After setting your password, log in and complete your intake form.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Alert className="text-left">
            <Mail className="h-4 w-4" />
            <AlertDescription>
              Check your email (including spam/junk folder) for a link to set your password. If you do not receive it within a few minutes, use the &quot;Forgot Password&quot; link on the login page.
            </AlertDescription>
          </Alert>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button asChild className="w-full" size="lg">
            <Link href="/set-password">
              Set Your Password
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

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
