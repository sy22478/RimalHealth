/**
 * Prescription Types
 * 
 * Type definitions for prescription management and refill requests.
 * 
 * @module types/prescriptions
 */

import { PrescriptionStatus, RefillStatus } from '@prisma/client';

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
  pharmacyName: string;
  status: PrescriptionStatus;
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
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
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
    CANCELLED: 'Cancelled',
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
}): boolean {
  // Check if prescription has refills remaining
  if (prescription.refillsRemaining <= 0) return false;
  
  // Check if prescription is active
  if (prescription.status === 'CANCELLED' || prescription.status === 'EXPIRED') return false;
  
  // Check refill availability date
  if (!prescription.nextRefillAvailable) return false;
  
  const daysUntilRefill = getDaysUntilRefill(prescription.nextRefillAvailable);
  if (daysUntilRefill === null) return false;
  
  // Eligible if within 7 days of refill date
  return daysUntilRefill <= 7 && daysUntilRefill >= 0;
}

/**
 * Get refill eligibility message
 */
export function getRefillEligibilityMessage(prescription: {
  nextRefillAvailable: Date | null;
  refillsRemaining: number;
  status: PrescriptionStatus;
}): string {
  if (prescription.refillsRemaining <= 0) {
    return 'No refills remaining. Contact your doctor for a new prescription.';
  }
  
  if (prescription.status === 'CANCELLED') {
    return 'This prescription has been cancelled.';
  }
  
  if (prescription.status === 'EXPIRED') {
    return 'This prescription has expired. Contact your doctor for a new prescription.';
  }
  
  const daysUntilRefill = getDaysUntilRefill(prescription.nextRefillAvailable);
  
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
