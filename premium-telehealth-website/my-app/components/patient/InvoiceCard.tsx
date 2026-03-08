/**
 * Invoice Card Component
 * 
 * Displays individual invoice details with download action.
 * 
 * Pattern: BILLING-002 - Invoice download
 * HIPAA: No PHI logged, only invoice IDs
 * 
 * @module components/patient/InvoiceCard
 */

'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Invoice, InvoiceStatus } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface InvoiceCardProps {
  invoice: Invoice;
  onDownload: (invoiceId: string) => void;
  isDownloading?: boolean;
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

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
function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get status badge variant
 */
function getStatusVariant(status: InvoiceStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: Record<InvoiceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    DRAFT: 'outline',
    OPEN: 'outline',
    PAID: 'default',
    VOID: 'secondary',
    UNCOLLECTIBLE: 'destructive',
  };
  return variants[status] || 'default';
}

/**
 * Format invoice number from ID
 */
function formatInvoiceNumber(id: string, createdAt: Date | string): string {
  const date = new Date(createdAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const shortId = id.slice(-6).toUpperCase();
  return `INV-${year}${month}-${shortId}`;
}

// ============================================================================
// Main Component
// ============================================================================

export function InvoiceCard({
  invoice,
  onDownload,
  isDownloading = false,
  className,
}: InvoiceCardProps): React.ReactElement {
  const handleDownload = React.useCallback(() => {
    onDownload(invoice.id);
  }, [invoice.id, onDownload]);

  const isPaid = invoice.status === 'PAID';
  const isDownloadable = isPaid || invoice.pdfUrl;

  return (
    <Card className={cn('w-full', className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Invoice Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground truncate">
                  {formatDate(invoice.createdAt)}
                </span>
                <Badge 
                  variant={getStatusVariant(invoice.status)}
                  className="text-xs capitalize flex-shrink-0"
                >
                  {invoice.status.toLowerCase().replace('_', ' ')}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {formatInvoiceNumber(invoice.id, invoice.createdAt)}
              </p>
            </div>
          </div>

          {/* Amount & Actions */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <span className="font-semibold text-foreground text-right">
              {formatAmount(invoice.amount)}
            </span>
            
            <Button
              onClick={handleDownload}
              disabled={!isDownloadable || isDownloading}
              variant="ghost"
              size="sm"
              className="flex-shrink-0"
              aria-label={`Download invoice ${formatInvoiceNumber(invoice.id, invoice.createdAt)}`}
            >
              {isDownloading ? (
                <span className="sr-only">Downloading...</span>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only sm:ml-2">Download</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Additional Details */}
        {invoice.paidAt && (
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            {invoice.status === 'PAID' && (
              <p>Paid on {formatDate(invoice.paidAt)}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
