/**
 * Prescription Types
 * 
 * Type definitions for prescription management and refill requests.
 * 
 * @module types/prescriptions
 */

import { PrescriptionStatus, RefillStatus } from '@prisma/client';
import { computeNextRefillAvailable } from '@/lib/titration/engine';

/**
 * GLP-1 lab gate input for refill eligibility. `required` is true only for
 * weight-management prescriptions; AUD callers omit it entirely (no gate).
 */
export interface RefillLabGate {
  required: boolean;
  passed: boolean;
}

// ============================================================================
// Prescription Types
// ============================================================================

/**
 * Full prescription data for patient view
 */
export interface Prescription {
  id: string;
  medicationName: string;
  genericName: string;
  dosage: string;
  quantity: number;
  refills: number;
  refillsRemaining: number;
  instructions: string;
  pharmacyName: string;
  pharmacyNcpdpId: string;
  pharmacyPhone?: string;
  pharmacyAddress?: string;
  status: PrescriptionStatus;
  lastRefillDate: Date | null;
  nextRefillAvailable: Date | null;
  sentAt: Date | null;
  createdAt: Date;
}

/**
 * Prescription summary for list view
 */
export interface PrescriptionSummary {
  id: string;
  medicationName: string;
  genericName: string;
  dosage: string;
  quantity: number;
  refills: number;
  refillsRemaining: number;
  /** Patient-facing instructions (e.g., "Take once daily with food"). */
  instructions?: string | null;
  pharmacyName: string;
  pharmacyAddress?: string | null;
  status: PrescriptionStatus;
  sentAt?: Date | null;
  lastRefillDate: Date | null;
  nextRefillAvailable: Date | null;
}

/**
 * Refill request data
 */
export interface RefillRequest {
  id: string;
  prescriptionId: string;
  status: RefillStatus;
  requestedAt: Date;
  respondedAt: Date | null;
}

/**
 * Refill request with prescription details
 */
export interface RefillRequestWithDetails extends RefillRequest {
  prescription: {
    medicationName: string;
    genericName: string;
    dosage: string;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Response from list prescriptions API
 */
export interface ListPrescriptionsResponse {
  prescriptions: PrescriptionSummary[];
}

/**
 * Response from get prescription details API
 */
export interface GetPrescriptionResponse {
  prescription: Prescription;
  recentRefillRequests: RefillRequest[];
}

/**
 * Response from request refill API
 */
export interface RequestRefillResponse {
  success: boolean;
  refillRequest?: RefillRequest;
  message?: string;
  error?: string;
}

// ============================================================================
// Status Badge Variants
// ============================================================================

/**
 * Tailwind CSS classes for prescription status badges
 */
export const prescriptionStatusVariants: Record<PrescriptionStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  SENT: 'bg-blue-100 text-blue-800 border-blue-200',
  RECEIVED_BY_PHARMACY: 'bg-purple-100 text-purple-800 border-purple-200',
  FILLED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  READY_FOR_PICKUP: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  PICKED_UP: 'bg-green-100 text-green-800 border-green-200',
  ACTIVE: 'bg-green-100 text-green-800 border-green-200',
  COMPLETED: 'bg-gray-100 text-gray-800 border-gray-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
  DENIED: 'bg-red-100 text-red-800 border-red-200',
  EXPIRED: 'bg-gray-100 text-gray-800 border-gray-200',
};

/**
 * Tailwind CSS classes for refill status badges
 */
export const refillStatusVariants: Record<RefillStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  APPROVED: 'bg-blue-100 text-blue-800 border-blue-200',
  DENIED: 'bg-red-100 text-red-800 border-red-200',
  SENT: 'bg-green-100 text-green-800 border-green-200',
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format prescription status for display (prescriptions-specific version)
 * Note: A general version is available from dashboard types
 */
export function formatPrescriptionStatusText(status: PrescriptionStatus): string {
  const statusMap: Record<PrescriptionStatus, string> = {
    PENDING: 'Pending',
    SENT: 'Sent to Pharmacy',
    RECEIVED_BY_PHARMACY: 'At Pharmacy',
    FILLED: 'Being Filled',
    READY_FOR_PICKUP: 'Ready for Pickup',
    PICKED_UP: 'Picked Up',
    ACTIVE: 'Active',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    DENIED: 'Denied',
    EXPIRED: 'Expired',
  };
  return statusMap[status] || status;
}

/**
 * Format refill status for display
 */
export function formatRefillStatus(status: RefillStatus): string {
  const statusMap: Record<RefillStatus, string> = {
    PENDING: 'Pending Review',
    APPROVED: 'Approved',
    DENIED: 'Denied',
    SENT: 'Sent to Pharmacy',
  };
  return statusMap[status] || status;
}

/**
 * Shared prescription status display for patient-facing UI.
 * Used by both the dashboard and prescriptions page for consistency.
 */
export function getPrescriptionStatusDisplay(status: PrescriptionStatus): {
  label: string;
  color: string;
  description: string;
} {
  const map: Record<PrescriptionStatus, { label: string; color: string; description: string }> = {
    PENDING: {
      label: 'Prescription Pending',
      color: 'text-amber-700 bg-amber-50 border-amber-200',
      description: 'Your physician has approved your treatment. Your prescription will be sent to your pharmacy shortly.',
    },
    SENT: {
      label: 'Sent to Pharmacy',
      color: 'text-blue-700 bg-blue-50 border-blue-200',
      description: 'Your prescription has been sent to your pharmacy. Please allow 1-2 business days for processing.',
    },
    RECEIVED_BY_PHARMACY: {
      label: 'At Pharmacy',
      color: 'text-purple-700 bg-purple-50 border-purple-200',
      description: 'Your pharmacy has received your prescription and is processing it.',
    },
    FILLED: {
      label: 'Being Filled',
      color: 'text-indigo-700 bg-indigo-50 border-indigo-200',
      description: 'Your prescription is being filled by the pharmacy.',
    },
    READY_FOR_PICKUP: {
      label: 'Ready for Pickup',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      description: 'Your prescription is ready. Please visit your pharmacy to pick it up.',
    },
    PICKED_UP: {
      label: 'Picked Up',
      color: 'text-green-700 bg-green-50 border-green-200',
      description: 'You have picked up your medication. Take it as directed by your physician.',
    },
    ACTIVE: {
      label: 'Active',
      color: 'text-green-700 bg-green-50 border-green-200',
      description: 'Your prescription is active. Continue taking your medication as prescribed.',
    },
    COMPLETED: {
      label: 'Completed',
      color: 'text-gray-700 bg-gray-50 border-gray-200',
      description: 'Your treatment course is complete.',
    },
    CANCELLED: {
      label: 'Cancelled',
      color: 'text-red-700 bg-red-50 border-red-200',
      description: 'Your prescription has been cancelled. Please message your physician if you have questions.',
    },
    DENIED: {
      label: 'Denied by Pharmacy',
      color: 'text-red-700 bg-red-50 border-red-200',
      description: 'The pharmacy was unable to fill your prescription. Your physician has been notified.',
    },
    EXPIRED: {
      label: 'Expired',
      color: 'text-gray-700 bg-gray-50 border-gray-200',
      description: 'This prescription has expired. Contact your physician for a new prescription.',
    },
  };
  return map[status] || { label: status, color: 'text-gray-700 bg-gray-50 border-gray-200', description: '' };
}

/**
 * Calculate days remaining for a prescription
 * Based on quantity and last refill date
 */
export function getDaysRemaining(prescription: {
  quantity: number;
  lastRefillDate: Date | null;
}): number {
  const daysSupply = prescription.quantity;
  const daysSinceLastFill = prescription.lastRefillDate
    ? Math.floor((Date.now() - new Date(prescription.lastRefillDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  return Math.max(0, daysSupply - daysSinceLastFill);
}

/**
 * Calculate days until refill is available
 */
export function getDaysUntilRefill(nextRefillAvailable: Date | null): number | null {
  if (!nextRefillAvailable) return null;
  const daysUntil = Math.ceil(
    (new Date(nextRefillAvailable).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  return daysUntil;
}

/**
 * Check if a prescription is eligible for refill
 * Refills can be requested 7 days before running out
 */
export function canRequestRefill(prescription: {
  nextRefillAvailable: Date | null;
  refillsRemaining: number;
  status: PrescriptionStatus;
  /** GLP-1: end of current supply. When present, the refill window is derived
   *  from it (supplyEndDate - 7d) in preference to `nextRefillAvailable`. */
  supplyEndDate?: Date | null;
  /** GLP-1 lab gate. Omitted/undefined for AUD → no gating. */
  labGate?: RefillLabGate;
}): boolean {
  // Check if prescription has refills remaining
  if (prescription.refillsRemaining <= 0) return false;

  // Check if prescription is in an active state
  if (['CANCELLED', 'EXPIRED', 'COMPLETED', 'DENIED'].includes(prescription.status)) return false;

  // GLP-1 lab gate: block until a qualifying recent lab is on file. Additive —
  // AUD callers don't pass labGate, so this never affects them.
  if (prescription.labGate?.required && !prescription.labGate.passed) return false;

  // Prefer the GLP-1 supply window when present; else the stored refill date.
  const refillDate = prescription.supplyEndDate
    ? computeNextRefillAvailable(prescription.supplyEndDate)
    : prescription.nextRefillAvailable;
  if (!refillDate) return false;

  const daysUntilRefill = getDaysUntilRefill(refillDate);
  if (daysUntilRefill === null) return false;

  // Eligible if within 7 days of refill date or overdue (negative means past due)
  return daysUntilRefill <= 7;
}

/**
 * Get refill eligibility message
 */
export function getRefillEligibilityMessage(prescription: {
  nextRefillAvailable: Date | null;
  refillsRemaining: number;
  status: PrescriptionStatus;
  supplyEndDate?: Date | null;
  labGate?: RefillLabGate;
}): string {
  if (prescription.refillsRemaining <= 0) {
    return 'No refills remaining. Contact your doctor for a new prescription.';
  }

  if (prescription.status === 'CANCELLED') {
    return 'This prescription has been cancelled.';
  }

  if (prescription.status === 'COMPLETED') {
    return 'This treatment course is complete.';
  }

  if (prescription.status === 'DENIED') {
    return 'This prescription was denied by the pharmacy.';
  }

  if (prescription.status === 'EXPIRED') {
    return 'This prescription has expired. Contact your doctor for a new prescription.';
  }

  // GLP-1 lab gate takes precedence over the date message.
  if (prescription.labGate?.required && !prescription.labGate.passed) {
    return 'A recent lab result is required before this refill. Please upload your latest labs for physician review.';
  }

  const refillDate = prescription.supplyEndDate
    ? computeNextRefillAvailable(prescription.supplyEndDate)
    : prescription.nextRefillAvailable;
  const daysUntilRefill = getDaysUntilRefill(refillDate);
  
  if (daysUntilRefill === null) {
    return 'Refill information not available.';
  }
  
  if (daysUntilRefill > 7) {
    return `Refill available in ${daysUntilRefill} days`;
  }
  
  if (daysUntilRefill > 0) {
    return `Refill available in ${daysUntilRefill} day${daysUntilRefill === 1 ? '' : 's'}`;
  }
  
  return 'Refill available now';
}

/**
 * Calculate progress percentage for days remaining
 */
export function getDaysRemainingProgress(prescription: {
  quantity: number;
  lastRefillDate: Date | null;
}): number {
  const daysRemaining = getDaysRemaining(prescription);
  const percentage = (daysRemaining / prescription.quantity) * 100;
  return Math.min(Math.max(percentage, 0), 100);
}

/**
 * Get color class for days remaining progress bar
 */
export function getDaysRemainingColorClass(daysRemaining: number, totalDays: number): string {
  const percentage = (daysRemaining / totalDays) * 100;
  
  if (percentage <= 20) {
    return 'bg-red-500';
  }
  if (percentage <= 40) {
    return 'bg-amber-500';
  }
  return 'bg-ocean-500';
}
