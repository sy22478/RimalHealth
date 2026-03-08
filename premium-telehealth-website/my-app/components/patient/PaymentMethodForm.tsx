/**
 * Payment Method Form Component
 * 
 * Provides a button to redirect to Stripe Customer Portal for payment method updates.
 * 
 * Pattern: INTEGRATION-001 - Stripe Customer Portal integration
 * HIPAA: No PHI logged, only Stripe customer ID
 * PCI: All payment data handled by Stripe
 * 
 * @module components/patient/PaymentMethodForm
 */

'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Shield, Lock } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface PaymentMethodFormProps {
  onOpenPortal: () => void;
  isLoading?: boolean;
  last4?: string | null;
  brand?: string | null;
  expMonth?: number | null;
  expYear?: number | null;
}

// ============================================================================
// Main Component
// ============================================================================

export function PaymentMethodForm({
  onOpenPortal,
  isLoading = false,
  last4,
  brand,
  expMonth,
  expYear,
}: PaymentMethodFormProps): React.ReactElement {
  const hasPaymentMethod = !!last4 && !!brand;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Method
        </CardTitle>
        <CardDescription>
          Manage your payment method securely through Stripe
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Payment Method */}
        {hasPaymentMethod ? (
          <div className="p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded flex items-center justify-center">
                  <span className="text-[8px] text-white font-bold tracking-wider">
                    {brand?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-foreground capitalize">
                    {brand} •••• {last4}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Expires {expMonth}/{expYear}
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1 text-xs text-green-600">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                Active
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 border rounded-lg border-dashed border-muted-foreground/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">No payment method</p>
                <p className="text-sm text-muted-foreground">
                  Add a payment method to continue your subscription
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Security Notice */}
        <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <Shield className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-green-800">
            <p className="font-medium flex items-center gap-1">
              <Lock className="h-3 w-3" />
              PCI Compliant & Secure
            </p>
            <p className="text-green-700">
              Your payment information is stored securely by Stripe. We never 
              store your full card details on our servers.
            </p>
          </div>
        </div>

        {/* Update Button */}
        <Button
          onClick={onOpenPortal}
          disabled={isLoading}
          className="w-full"
          variant={hasPaymentMethod ? 'outline' : 'default'}
        >
          {isLoading ? (
            'Opening secure portal...'
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              {hasPaymentMethod ? 'Update Payment Method' : 'Add Payment Method'}
            </>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          You will be redirected to Stripe&apos;s secure customer portal to manage your payment methods.
        </p>
      </CardContent>
    </Card>
  );
}
