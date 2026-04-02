/**
 * Patient Billing Page
 *
 * Main billing interface for patients to view subscription details,
 * invoice history, update payment methods, and cancel subscription.
 *
 * Pattern: BILLING-001 - Subscription status display
 * Pattern: BILLING-002 - Invoice download
 * Pattern: PHI-001 - Audit logging
 * HIPAA: No PHI logged, only Stripe IDs
 *
 * @module app/patient/billing/page
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { BillingOverview } from '@/components/patient/BillingOverview';
import { InvoiceList } from '@/components/patient/InvoiceList';
import { PaymentMethodForm } from '@/components/patient/PaymentMethodForm';
import { CancelSubscriptionModal } from '@/components/patient/CancelSubscriptionModal';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { AlertCircle, CreditCard, FileText, Settings } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Subscription {
  id: string;
  planType: string;
  status: string;
  amount: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt: string | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  paymentMethod: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
  // Additional fields from Prisma model
  createdAt?: string;
  updatedAt?: string;
  userId?: string;
}

interface Invoice {
  id: string;
  amount: number;
  status: string;
  stripeInvoiceId: string;
  stripeChargeId: string | null;
  pdfUrl: string | null;
  createdAt: string;
  paidAt: string | null;
  // Additional fields from Prisma model
  subscriptionId?: string;
  userId?: string;
}

interface BillingData {
  subscription: Subscription | null;
  summary: {
    totalPaid: number;
    nextBillingDate: string | null;
  };
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
    MAINTENANCE: 'Maintenance',
  };
  return planNames[planType] || planType;
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function BillingPage(): React.ReactElement {
  const router = useRouter();

  // Data state
  const [billingData, setBillingData] = React.useState<BillingData | null>(null);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [invoiceError, setInvoiceError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // UI state
  const [isPortalLoading, setIsPortalLoading] = React.useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  // Fetch billing data on mount
  React.useEffect(() => {
    async function fetchBillingData(): Promise<void> {
      try {
        setIsLoading(true);
        setError(null);
        setInvoiceError(null);

        // Fetch subscription and billing info
        const billingResponse = await fetch('/api/patient/billing');
        if (!billingResponse.ok) {
          throw new Error('Failed to fetch billing information');
        }
        const billingResult = await billingResponse.json();
        setBillingData(billingResult);

        // Fetch invoices separately — failure is non-blocking
        try {
          const invoicesResponse = await fetch('/api/patient/billing/invoices');
          if (!invoicesResponse.ok) {
            throw new Error('Failed to fetch invoices');
          }
          const invoicesResult = await invoicesResponse.json();
          setInvoices(invoicesResult.invoices || []);
        } catch (invoiceErr) {
          console.error('Error fetching invoices:', invoiceErr instanceof Error ? invoiceErr.message : 'Unknown error');
          setInvoiceError('Unable to load invoice history. Please try again later.');
          // Don't set the main error — subscription overview still shows
        }
      } catch (err) {
        console.error('Error fetching billing data:', err instanceof Error ? err.message : 'Unknown error');
        setError(err instanceof Error ? err.message : 'Failed to load billing information');
      } finally {
        setIsLoading(false);
      }
    }

    fetchBillingData();
  }, []);

  // Handle payment method update
  const handleUpdatePayment = React.useCallback(async () => {
    try {
      setIsPortalLoading(true);

      const response = await fetch('/api/patient/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const { portalUrl } = await response.json();

      // Redirect to Stripe Customer Portal
      window.location.href = portalUrl;
    } catch (err) {
      console.error('Error opening portal:', err instanceof Error ? err.message : 'Unknown error');
      setError(err instanceof Error ? err.message : 'Failed to open payment portal');
      setIsPortalLoading(false);
    }
  }, []);

  // Handle subscription cancellation
  const handleCancelClick = React.useCallback(() => {
    setIsCancelModalOpen(true);
  }, []);

  const handleCancelConfirm = React.useCallback(async () => {
    if (!billingData?.subscription) return;

    try {
      setIsCancelling(true);

      const response = await fetch('/api/patient/billing/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel subscription');
      }

      const result = await response.json();

      // Update local state to reflect cancellation
      setBillingData((prev) => {
        if (!prev?.subscription) return prev;
        return {
          ...prev,
          subscription: {
            ...prev.subscription,
            cancelAtPeriodEnd: true,
            currentPeriodEnd: result.periodEnd,
          },
        };
      });

      setIsCancelModalOpen(false);
    } catch (err) {
      console.error('Error cancelling subscription:', err instanceof Error ? err.message : 'Unknown error');
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setIsCancelling(false);
    }
  }, [billingData?.subscription]);

  const handleCancelModalClose = React.useCallback(() => {
    if (!isCancelling) {
      setIsCancelModalOpen(false);
    }
  }, [isCancelling]);

  // Handle invoice download
  const handleDownloadInvoice = React.useCallback(async (invoiceId: string) => {
    try {
      setDownloadingId(invoiceId);

      const response = await fetch(`/api/patient/billing/invoices/${invoiceId}/download`);

      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const { downloadUrl, filename } = await response.json();

      // Create temporary link to download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading invoice:', err instanceof Error ? err.message : 'Unknown error');
      setError(err instanceof Error ? err.message : 'Failed to download invoice');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  // Calculate prorated refund (for modal display)
  const proratedRefund = React.useMemo(() => {
    if (!billingData?.subscription) return null;

    const sub = billingData.subscription;
    const now = new Date();
    const periodEnd = new Date(sub.currentPeriodEnd);
    const periodStart = new Date(sub.currentPeriodStart);

    const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (remainingDays <= 7) return null; // No refund if less than 7 days

    const dailyRate = sub.amount / totalDays;
    return Math.round(dailyRate * remainingDays);
  }, [billingData?.subscription]);

  // Loading state
  if (isLoading) {
    return (
      <div className="container max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-80 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
            <div>
              <Skeleton className="h-96 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Trialing / Pending Review state
  const isTrialing = billingData?.subscription?.status === 'TRIALING';

  // No subscription state
  if (!billingData?.subscription && !isLoading) {
    return (
      <div className="container max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Billing & Subscription</h1>
          <p className="text-muted-foreground mt-2">Manage your subscription and view billing history</p>
        </div>

        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don&apos;t have an active subscription.{' '}
            <a href="/patient/checkout" className="font-medium underline">
              Subscribe now
            </a>{' '}
            to access treatment.
          </AlertDescription>
        </Alert>

        {invoices.length > 0 && (
          <InvoiceList
            invoices={invoices}
            onDownload={handleDownloadInvoice}
            downloadingId={downloadingId}
          />
        )}
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          Billing & Subscription
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your subscription, payment methods, and view your billing history
        </p>
      </div>

      {/* Pending Review Banner */}
      {isTrialing && (
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Pending Review</strong> — Your subscription will activate once your intake is
            approved by a physician. You will not be charged until approval.
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Subscription & Invoices */}
        <div className="lg:col-span-2 space-y-6">
          {/* Subscription Overview */}
          {billingData?.subscription && (
            <BillingOverview
              subscription={billingData.subscription}
              onUpdatePayment={handleUpdatePayment}
              onCancel={handleCancelClick}
              isUpdatingPayment={isPortalLoading}
            />
          )}

          {/* Invoice History */}
          {invoiceError ? (
            <div className="bg-muted/50 rounded-lg p-6 border text-center">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-3">{invoiceError}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-primary hover:underline"
              >
                Retry
              </button>
            </div>
          ) : (
            <InvoiceList
              invoices={invoices}
              onDownload={handleDownloadInvoice}
              downloadingId={downloadingId}
              onRetry={() => window.location.reload()}
            />
          )}
        </div>

        {/* Right Column - Payment Method */}
        <div className="space-y-6">
          {billingData?.subscription?.paymentMethod ? (
            <PaymentMethodForm
              onOpenPortal={handleUpdatePayment}
              isLoading={isPortalLoading}
              last4={billingData.subscription.paymentMethod.last4}
              brand={billingData.subscription.paymentMethod.brand}
              expMonth={billingData.subscription.paymentMethod.expMonth}
              expYear={billingData.subscription.paymentMethod.expYear}
            />
          ) : (
            <PaymentMethodForm onOpenPortal={handleUpdatePayment} isLoading={isPortalLoading} />
          )}

          {/* Summary Card */}
          <div className="bg-muted/50 rounded-lg p-4 border">
            <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Quick Links
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="/patient/dashboard"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  &larr; Back to Dashboard
                </a>
              </li>
              <li>
                <a href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
                  Contact Billing Support
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Cancel Subscription Modal */}
      {billingData?.subscription && (
        <CancelSubscriptionModal
          isOpen={isCancelModalOpen}
          onClose={handleCancelModalClose}
          onConfirm={handleCancelConfirm}
          isLoading={isCancelling}
          planName={formatPlanType(billingData.subscription.planType)}
          periodEnd={billingData.subscription.currentPeriodEnd}
          refundAmount={proratedRefund}
        />
      )}
    </div>
  );
}
