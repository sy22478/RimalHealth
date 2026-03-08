/**
 * Refill Request Modal Component
 * 
 * Modal dialog for confirming and submitting refill requests.
 * 
 * @module components/patient/RefillRequestModal
 */

'use client';

import * as React from 'react';
import { Pill, Clock, MapPin, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { PrescriptionSummary } from '@/types/prescriptions';
import {
  formatPrescriptionStatusText,
  prescriptionStatusVariants,
  getDaysRemaining,
  getDaysRemainingProgress,
  canRequestRefill,
  getRefillEligibilityMessage,
} from '@/types/prescriptions';

// ============================================================================
// Types
// ============================================================================

interface RefillRequestModalProps {
  prescription: PrescriptionSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  submitError: string | null;
  submitSuccess: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function RefillRequestModal({
  prescription,
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  submitError,
  submitSuccess,
}: RefillRequestModalProps) {
  if (!prescription) return null;

  // Calculate prescription stats
  const daysRemaining = getDaysRemaining(prescription);
  const progressPercentage = getDaysRemainingProgress(prescription);
  const isEligible = canRequestRefill(prescription);
  const eligibilityMessage = getRefillEligibilityMessage(prescription);
  const statusClass = prescriptionStatusVariants[prescription.status];

  // Handle close - prevent closing while submitting
  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-ocean-600" />
            Request Prescription Refill
          </DialogTitle>
          <DialogDescription>
            Review your prescription details before submitting your refill request.
          </DialogDescription>
        </DialogHeader>

        {submitSuccess ? (
          // Success State
          <div className="py-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Refill Request Submitted
            </h3>
            <p className="text-sm text-muted-foreground">
              Your refill request for <strong>{prescription.medicationName}</strong> has been 
              submitted. A physician will review it within 24 hours.
            </p>
          </div>
        ) : (
          // Form State
          <div className="space-y-4 py-2">
            {/* Prescription Summary */}
            <div className="rounded-lg border bg-gray-50 p-4 space-y-3">
              {/* Medication */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {prescription.medicationName}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {prescription.genericName}
                  </p>
                </div>
                <Badge variant="outline" className={statusClass}>
                  {formatPrescriptionStatusText(prescription.status)}
                </Badge>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Dosage:</span>
                  <p className="font-medium">{prescription.dosage}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Quantity:</span>
                  <p className="font-medium">{prescription.quantity}</p>
                </div>
              </div>

              {/* Refills */}
              <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                <span className="text-muted-foreground">Refills remaining:</span>
                <span className={cn(
                  "font-medium",
                  prescription.refillsRemaining === 0 ? "text-red-600" : "text-gray-900"
                )}>
                  {prescription.refillsRemaining} of {prescription.refills}
                </span>
              </div>

              {/* Days Remaining */}
              <div className="space-y-2 pt-2">
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
                <Progress value={progressPercentage} className="h-2" />
              </div>

              {/* Pharmacy */}
              <div className="flex items-start gap-2 pt-2 border-t border-gray-200 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span className="font-medium">{prescription.pharmacyName}</span>
              </div>
            </div>

            {/* Eligibility Warning */}
            {!isEligible && (
              <Alert variant="destructive" className="bg-amber-50 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  {eligibilityMessage}
                </AlertDescription>
              </Alert>
            )}

            {/* Success Eligibility Message */}
            {isEligible && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  This prescription is eligible for refill. Your doctor will review 
                  your request within 24 hours.
                </AlertDescription>
              </Alert>
            )}

            {/* Error Message */}
            {submitError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {submitSuccess ? (
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={onConfirm}
                disabled={!isEligible || isSubmitting}
                className="min-w-[120px]"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  'Request Refill'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
