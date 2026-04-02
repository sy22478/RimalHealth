/**
 * Invoice List Component
 * 
 * Displays a list of invoices with loading states and empty states.
 * 
 * Pattern: BILLING-002 - Invoice download
 * HIPAA: No PHI logged, only invoice IDs
 * 
 * @module components/patient/InvoiceList
 */

'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { InvoiceCard } from './InvoiceCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { FileText, AlertCircle } from 'lucide-react';
import type { InvoiceDisplay } from './InvoiceCard';

// ============================================================================
// Types
// ============================================================================

interface InvoiceListProps {
  invoices: InvoiceDisplay[];
  isLoading?: boolean;
  error?: string | null;
  onDownload: (invoiceId: string) => void;
  downloadingId?: string | null;
  onRetry?: () => void;
}

// ============================================================================
// Loading State
// ============================================================================

function InvoiceListSkeleton(): React.ReactElement {
  return (
    <Card className="w-full">
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48 mt-2" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32 mt-1" />
                </div>
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function InvoiceListEmpty(): React.ReactElement {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Invoice History</CardTitle>
        <CardDescription>View and download your billing history</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            No invoices yet
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Your billing history will appear here once you have an active subscription.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Error State
// ============================================================================

function InvoiceListError({ 
  message, 
  onRetry 
}: { 
  message: string; 
  onRetry?: () => void;
}): React.ReactElement {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Invoice History</CardTitle>
        <CardDescription>View and download your billing history</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            Failed to load invoices
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
            {message}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-sm text-primary hover:underline"
            >
              Try again
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function InvoiceList({
  invoices,
  isLoading = false,
  error = null,
  onDownload,
  downloadingId = null,
  onRetry,
}: InvoiceListProps): React.ReactElement {
  if (isLoading) {
    return <InvoiceListSkeleton />;
  }

  if (error) {
    return <InvoiceListError message={error} onRetry={onRetry} />;
  }

  if (invoices.length === 0) {
    return <InvoiceListEmpty />;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Invoice History</CardTitle>
        <CardDescription>
          View and download your billing history ({invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {invoices.map((invoice) => (
          <InvoiceCard
            key={invoice.id}
            invoice={invoice}
            onDownload={onDownload}
            isDownloading={downloadingId === invoice.id}
          />
        ))}
      </CardContent>
    </Card>
  );
}
