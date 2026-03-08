/**
 * Prescription List Component
 * 
 * Displays a list of patient prescriptions with loading and empty states.
 * 
 * @module components/patient/PrescriptionList
 */

'use client';

import * as React from 'react';
import { Pill, AlertCircle } from 'lucide-react';
import { PrescriptionCard } from './PrescriptionCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PrescriptionSummary } from '@/types/prescriptions';

// ============================================================================
// Types
// ============================================================================

interface PrescriptionListProps {
  prescriptions: PrescriptionSummary[];
  isLoading?: boolean;
  error?: string | null;
  onRequestRefill: (prescription: PrescriptionSummary) => void;
  processingPrescriptionId?: string | null;
}

// ============================================================================
// Loading Skeleton Component
// ============================================================================

function PrescriptionCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      {/* Header Skeleton */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>

      {/* Details Skeleton */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>

      {/* Progress Skeleton */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-2 w-full" />
      </div>

      {/* Button Skeleton */}
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
        <Pill className="h-8 w-8 text-gray-400" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        No Prescriptions
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        You don&apos;t have any active prescriptions. Once your doctor prescribes medication, 
        it will appear here.
      </p>
    </div>
  );
}

// ============================================================================
// Error State Component
// ============================================================================

function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="my-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error loading prescriptions</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PrescriptionList({
  prescriptions,
  isLoading = false,
  error = null,
  onRequestRefill,
  processingPrescriptionId,
}: PrescriptionListProps) {
  // Show loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <PrescriptionCardSkeleton />
        <PrescriptionCardSkeleton />
        <PrescriptionCardSkeleton />
      </div>
    );
  }

  // Show error state
  if (error) {
    return <ErrorState message={error} />;
  }

  // Show empty state
  if (prescriptions.length === 0) {
    return <EmptyState />;
  }

  // Show prescription list
  return (
    <div 
      className="space-y-4"
      role="list"
      aria-label="Your prescriptions"
    >
      {prescriptions.map((prescription) => (
        <div key={prescription.id} role="listitem">
          <PrescriptionCard
            prescription={prescription}
            onRequestRefill={onRequestRefill}
            isLoading={processingPrescriptionId === prescription.id}
          />
        </div>
      ))}
    </div>
  );
}
