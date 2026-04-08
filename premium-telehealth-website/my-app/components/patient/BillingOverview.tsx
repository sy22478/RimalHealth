/**
 * Billing Overview Component
 * 
 * Displays subscription details, current plan, billing date,
 * and payment method information with actions to update or cancel.
 * 
 * Pattern: BILLING-001 - Subscription status display
 * HIPAA: No PHI logged, only Stripe IDs stored
 * 
 * @module components/patient/BillingOverview
 */

'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/Skeleton';
import { CreditCard, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

/** Minimal subscription shape used by billing UI — matches both Prisma model and API response */
export interface SubscriptionDisplay {
  id: string;
  planType: string;
  status: string;
  amount: number;
  currentPeriodStart: Date | string;
  currentPeriodEnd: Date | string;
  cancelledAt: Date | string | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

interface BillingOverviewProps {
  subscription: SubscriptionDisplay & {
    paymentMethod?: {
      brand: string;
      last4: string;
      expMonth: number;
      expYear: number;
    } | null;
  };
  isLoading?: boolean;
  onUpdatePayment: () => void;
  onCancel: () => void;
  isUpdatingPayment?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format plan type for display
 */
function formatPlanType(planType: string): string {
  const planNames: Record<string, string> = {
    ACTIVE_TREATMENT: 'Active Treatment',
  };
  return planNames[planType] || planType;
}

/**
 * Format amount in cents to currency string
 */
function formatAmount(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Format date for display
 */
function formatDate(date: Date | string | null): string {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get status badge variant
 */
function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    ACTIVE: 'default',
    TRIALING: 'outline',
    PAST_DUE: 'destructive',
    CANCELLED: 'secondary',
    EXPIRED: 'destructive',
    UNPAID: 'outline',
  };
  return variants[status] || 'default';
}

/**
 * Get human-readable status label
 */
function getStatusLabel(status: string): string {
  if (status === 'TRIALING') return 'Pending Review';
  return status.replace(/_/g, ' ');
}

// ============================================================================
// Loading State
// ============================================================================

function BillingOverviewSkeleton(): React.ReactElement {
  return (
    <Card className="w-full">
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48 mt-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function BillingOverview({
  subscription,
  isLoading = false,
  onUpdatePayment,
  onCancel,
  isUpdatingPayment = false,
}: BillingOverviewProps): React.ReactElement {
  if (isLoading) {
    return <BillingOverviewSkeleton />;
  }

  const isActive = subscription.status === 'ACTIVE';
  const isTrialing = subscription.status === 'TRIALING';
  const isCancelled = subscription.status === 'CANCELLED';
  const isCancelling = subscription.cancelAtPeriodEnd;
  const periodEnd = new Date(subscription.currentPeriodEnd);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Current Plan</CardTitle>
            <CardDescription>
              Manage your subscription and billing
            </CardDescription>
          </div>
          <Badge 
            variant={getStatusVariant(subscription.status)}
            className="capitalize"
          >
            {isCancelling ? 'Cancelling' : getStatusLabel(subscription.status)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Plan Details */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl font-semibold text-foreground">
              {formatPlanType(subscription.planType)}
            </h3>
            <span className="text-xl font-medium text-foreground">
              {formatAmount(subscription.amount)}
              <span className="text-sm text-muted-foreground font-normal">/month</span>
            </span>
          </div>
          
          {isTrialing && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Pending physician review</p>
                <p>
                  Your subscription is pending physician review. You will not be charged
                  until your intake is approved.
                </p>
              </div>
            </div>
          )}

          {isCancelled && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-medium">Intake not approved</p>
                <p>
                  Your intake was not approved. No charges have been applied to your payment method.
                  Your account will remain accessible for 30 days.
                </p>
              </div>
            </div>
          )}

          {isCancelling && !isCancelled && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Subscription ending</p>
                <p>
                  Your subscription will remain active until{' '}
                  <strong>{formatDate(periodEnd)}</strong>. After this date,
                  your access will be limited.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Billing Info */}
        <div className="space-y-3 border-t pt-4">
          <div className={cn('flex items-center gap-3 text-sm', isTrialing && 'opacity-50')}>
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Next billing date:</span>
            <span className="font-medium">
              {isCancelled ? 'No charges applied' : isTrialing ? 'Pending approval' : isCancelling ? 'No further billing' : formatDate(periodEnd)}
            </span>
          </div>

          {subscription.paymentMethod && (
            <div className="flex items-center gap-3 text-sm">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Payment method:</span>
              <span className="font-medium capitalize">
                {subscription.paymentMethod.brand} •••• {subscription.paymentMethod.last4}
              </span>
              <span className="text-xs text-muted-foreground">
                Expires {subscription.paymentMethod.expMonth}/{subscription.paymentMethod.expYear}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          {!isCancelled && <Button
            onClick={onUpdatePayment}
            disabled={isUpdatingPayment}
            className="w-full"
            variant="outline"
          >
            {isUpdatingPayment ? (
              <>Opening...</>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Update Payment Method
              </>
            )}
          </Button>}

          {isActive && !isCancelling && (
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium text-foreground mb-2">
                Cancel Subscription
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Your subscription will remain active until {formatDate(periodEnd)}. 
                You can resume anytime before this date.
              </p>
              <Button
                onClick={onCancel}
                variant="ghost"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                Cancel Subscription
              </Button>
            </div>
          )}

          {isCancelling && (
            <div className="border-t pt-4 mt-4">
              <div className="flex items-start gap-2 mb-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    Cancellation scheduled
                  </p>
                  <p className="text-muted-foreground">
                    Your subscription is set to cancel on {formatDate(periodEnd)}. 
                    Contact support if you&apos;d like to resume.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
