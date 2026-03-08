/**
 * Cancel Subscription Modal Component
 * 
 * Confirmation modal for subscription cancellation with prorated refund info.
 * 
 * Pattern: BILLING-001 - Subscription status display
 * HIPAA: No PHI logged
 * 
 * @module components/patient/CancelSubscriptionModal
 */

'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

import { AlertCircle, Calendar, CheckCircle2, XCircle } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  planName: string;
  periodEnd: Date | string;
  refundAmount?: number | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format date for display
 */
function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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
 * Calculate days remaining in period
 */
function getDaysRemaining(endDate: Date | string): number {
  const end = new Date(endDate);
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ============================================================================
// Main Component
// ============================================================================

export function CancelSubscriptionModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  planName,
  periodEnd,
  refundAmount,
}: CancelSubscriptionModalProps): React.ReactElement {
  const daysRemaining = getDaysRemaining(periodEnd);
  const hasRefund = refundAmount && refundAmount > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <DialogTitle className="text-center text-xl">
            Cancel Your Subscription?
          </DialogTitle>
          <DialogDescription className="text-center">
            We&apos;re sorry to see you go. Please review the details below before confirming.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Plan Info */}
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Current Plan</p>
            <p className="font-medium text-foreground">{planName}</p>
          </div>

          {/* Access Until */}
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Calendar className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Your access continues</p>
              <p className="text-blue-700">
                You&apos;ll continue to have full access until{' '}
                <strong>{formatDate(periodEnd)}</strong> ({daysRemaining} days from now).
              </p>
            </div>
          </div>

          {/* Refund Info */}
          {hasRefund ? (
            <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-green-800">
                <p className="font-medium">Prorated refund available</p>
                <p className="text-green-700">
                  You&apos;ll receive a refund of{' '}
                  <strong>{formatAmount(refundAmount!)}</strong> for the unused portion of your subscription.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <XCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">No refund due</p>
                <p className="text-amber-700">
                  You&apos;ve used most of your billing period. No refund will be issued, 
                  but you&apos;ll keep access until {formatDate(periodEnd)}.
                </p>
              </div>
            </div>
          )}

          {/* Service Interruption Warning */}
          <div className="text-sm text-muted-foreground border-t pt-4">
            <p className="font-medium text-foreground mb-1">What happens next:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Your subscription will be set to cancel at period end</li>
              <li>You can resume anytime before {formatDate(periodEnd)}</li>
              <li>No further charges will be made</li>
              <li>After {formatDate(periodEnd)}, your treatment access will be limited</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="secondary"
            onClick={onClose}
            className="w-full sm:w-auto"
            disabled={isLoading}
          >
            Keep Subscription
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            variant="destructive"
            className="w-full sm:w-auto"
          >
            {isLoading ? 'Cancelling...' : 'Cancel Anyway'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
