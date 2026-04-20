/**
 * Prescription Card Component
 * 
 * Displays a single prescription with details and refill status.
 * 
 * @module components/patient/PrescriptionCard
 */

'use client';

import * as React from 'react';
import { Pill, MapPin, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { PrescriptionSummary } from '@/types/prescriptions';
import { PrescriptionStatus } from '@prisma/client';
import {
  formatPrescriptionStatusText,
  prescriptionStatusVariants,
  getDaysRemaining,
  getDaysRemainingProgress,
  getDaysUntilRefill,
  canRequestRefill,
  getRefillEligibilityMessage,
  getDaysRemainingColorClass,
} from '@/types/prescriptions';

// ============================================================================
// Types
// ============================================================================

interface PrescriptionCardProps {
  prescription?: PrescriptionSummary;
  onRequestRefill?: (prescription: PrescriptionSummary) => void;
  isLoading?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function PrescriptionCard({
  prescription,
  onRequestRefill,
  isLoading = false,
}: PrescriptionCardProps) {
  // Handle undefined prescription
  if (!prescription) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
              <Pill className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">No Prescription Yet</h3>
              <p className="text-sm text-muted-foreground">
                Your prescription will appear here once your physician completes their review.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Status badge variant
  const statusClass = prescriptionStatusVariants[prescription.status];

  // PENDING means the physician approved treatment but no pharmacy has been
  // assigned yet — the prescription has no fill date, refill window, or
  // pharmacy. Showing refill counts/progress/refill-overdue text in this state
  // is contradictory and confusing, so render a dedicated pending card.
  if (prescription.status === PrescriptionStatus.PENDING) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ocean-100">
                <Pill className="h-5 w-5 text-ocean-600" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">
                  {prescription.medicationName}
                </h3>
                {prescription.genericName && (
                  <p className="text-sm text-muted-foreground truncate">
                    Generic: {prescription.genericName}
                  </p>
                )}
              </div>
            </div>
            <Badge variant="outline" className={cn('shrink-0', statusClass)}>
              {formatPrescriptionStatusText(prescription.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">
                  Prescription pending — awaiting pharmacy assignment
                </p>
                <p className="text-amber-700 mt-1">
                  Your physician has approved your treatment. We&apos;ll send your
                  prescription to your pharmacy shortly.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate days remaining and refill status
  const daysRemaining = getDaysRemaining(prescription);
  const daysUntilRefill = getDaysUntilRefill(prescription.nextRefillAvailable);
  const isEligibleForRefill = canRequestRefill(prescription);
  const eligibilityMessage = getRefillEligibilityMessage(prescription);
  const progressPercentage = getDaysRemainingProgress(prescription);
  const progressColorClass = getDaysRemainingColorClass(daysRemaining, prescription.quantity);

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      {/* Header */}
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ocean-100">
              <Pill className="h-5 w-5 text-ocean-600" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">
                {prescription.medicationName}
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                Generic: {prescription.genericName}
              </p>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={cn("shrink-0", statusClass)}
          >
            {formatPrescriptionStatusText(prescription.status)}
          </Badge>
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="space-y-4">
        {/* Dosage Info */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Dosage:</span>
            <p className="font-medium text-gray-900">{prescription.dosage}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Quantity:</span>
            <p className="font-medium text-gray-900">{prescription.quantity} tablets</p>
          </div>
        </div>

        {/* Refills */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Refills remaining:</span>
          <span className={cn(
            "font-medium",
            prescription.refillsRemaining === 0 ? "text-red-600" : "text-gray-900"
          )}>
            {prescription.refillsRemaining} of {prescription.refills}
          </span>
        </div>

        {/* Days Remaining Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Days remaining
            </span>
            <span className={cn(
              "font-medium",
              daysRemaining <= 7 ? "text-red-600" : "text-gray-900"
            )}>
              {daysRemaining} days
            </span>
          </div>
          <div className="relative">
            <Progress 
              value={progressPercentage} 
              className="h-2"
            />
            {/* Custom colored progress bar overlay */}
            <div 
              className={cn(
                "absolute top-0 left-0 h-2 rounded-full transition-all duration-300",
                progressColorClass
              )}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {daysUntilRefill !== null && daysUntilRefill > 0 
              ? `Refill available in ${daysUntilRefill} day${daysUntilRefill === 1 ? '' : 's'}`
              : daysUntilRefill === 0
                ? 'Refill available now'
                : 'Refill overdue - request now'
            }
          </p>
        </div>

        {/* Pharmacy Info */}
        <div className="flex items-start gap-2 pt-2 border-t border-gray-100">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {prescription.pharmacyName}
            </p>
          </div>
        </div>

        {/* Refill Button */}
        <div className="pt-2">
          {prescription.refillsRemaining > 0 && (
            <Button
              onClick={() => onRequestRefill?.(prescription)}
              disabled={!isEligibleForRefill || isLoading}
              className="w-full"
              variant={isEligibleForRefill ? 'default' : 'outline'}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Processing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {isEligibleForRefill ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Request Refill
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4" />
                      {daysUntilRefill !== null && daysUntilRefill > 7 
                        ? `Available in ${daysUntilRefill} days`
                        : eligibilityMessage
                      }
                    </>
                  )}
                </span>
              )}
            </Button>
          )}
          
          {prescription.refillsRemaining === 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">No refills remaining</p>
                  <p className="text-amber-700">
                    Contact your doctor to request a new prescription.
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
