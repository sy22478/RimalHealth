/**
 * Patient Dashboard Types
 * 
 * Type definitions for the patient dashboard and related components.
 * 
 * @module types/dashboard
 */

import { IntakeStatus, PrescriptionStatus, SubscriptionStatus, ConcernType, TreatmentGoal, MessageStatus, SenderType } from '@prisma/client';

// ============================================================================
// Dashboard Status
// ============================================================================

/**
 * Derived dashboard status based on intake, subscription, and prescription states
 */
export type DashboardStatus =
  | 'intake_incomplete'
  | 'intake_pending_review'
  | 'under_review'
  | 'approved_awaiting_rx'
  | 'rx_sent'
  | 'active_treatment'
  | 'intake_rejected'
  | 'intake_needs_info'
  | 'unknown';

/**
 * Get dashboard status from underlying data states
 */
export function getDashboardStatus(
  intakeStatus: IntakeStatus,
  subscriptionStatus: SubscriptionStatus,
  prescriptionStatus?: PrescriptionStatus
): DashboardStatus {
  if (intakeStatus === 'DRAFT') return 'intake_incomplete';
  if (intakeStatus === 'SUBMITTED') return 'intake_pending_review';
  if (intakeStatus === 'UNDER_REVIEW') return 'under_review';
  if (intakeStatus === 'REJECTED') return 'intake_rejected';
  if (intakeStatus === 'NEEDS_INFO') return 'intake_needs_info';
  if (intakeStatus === 'APPROVED' && !prescriptionStatus) return 'approved_awaiting_rx';
  if (prescriptionStatus === 'ACTIVE' || prescriptionStatus === 'PICKED_UP') return 'active_treatment';
  if (prescriptionStatus === 'SENT' || prescriptionStatus === 'RECEIVED_BY_PHARMACY' || prescriptionStatus === 'FILLED' || prescriptionStatus === 'READY_FOR_PICKUP') return 'rx_sent';
  if (prescriptionStatus === 'PENDING') return 'approved_awaiting_rx';
  if (subscriptionStatus === 'ACTIVE') return 'active_treatment';
  return 'unknown';
}

// ============================================================================
// Dashboard Data
// ============================================================================

/**
 * Patient profile data for dashboard (non-PHI fields only)
 */
export interface DashboardPatientProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  primaryConcern: ConcernType | null;
  treatmentGoal: TreatmentGoal | null;
  createdAt: Date;
  updatedAt: Date;
  phone?: string | null;
  addressStreet?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZip?: string | null;
  preferredPharmacyId?: string | null;
}

/**
 * Intake data for dashboard
 */
export interface DashboardIntake {
  id: string;
  status: IntakeStatus;
  submittedAt: Date | null;
  riskScore: number | null;
  paymentStatus: string;
}

/**
 * Subscription data for dashboard
 */
export interface DashboardSubscription {
  id: string;
  status: SubscriptionStatus;
  currentPeriodEnd: Date;
  planType: string;
  amount: number;
}

/**
 * Prescription data for dashboard
 */
export interface DashboardPrescription {
  id: string;
  medicationName: string;
  genericName: string;
  dosage: string;
  quantity: number;
  refills: number;
  refillsRemaining: number;
  status: PrescriptionStatus;
  nextRefillAvailable: Date | null;
  pharmacyName: string;
  sentAt: Date | null;
}

/**
 * Message data for dashboard preview
 */
export interface DashboardMessage {
  id: string;
  subject: string | null;
  body: string;
  senderType: SenderType;
  senderId: string;
  senderName: string;
  sentAt: Date;
  read: boolean;
  preview: string;
}

/**
 * Complete dashboard data structure
 */
export interface DashboardData {
  profile: DashboardPatientProfile | null;
  intake: DashboardIntake | null;
  subscription: DashboardSubscription | null;
  prescriptions: DashboardPrescription[];
  messages: DashboardMessage[];
  unreadCount: number;
}

// ============================================================================
// Status Configuration
// ============================================================================

/**
 * Status icon types
 */
export type StatusIconType =
  | 'clipboard'
  | 'clock'
  | 'search'
  | 'check'
  | 'pill'
  | 'activity'
  | 'alert';

/**
 * Status configuration for visual display
 */
export interface StatusConfig {
  icon: StatusIconType;
  title: string;
  description: string;
  colorClass: string;
  badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline';
}

/**
 * Status configuration mapping
 */
export const statusConfig: Record<DashboardStatus, StatusConfig> = {
  intake_incomplete: {
    icon: 'clipboard',
    title: 'Complete Your Intake',
    description: 'We need more information to proceed with your treatment. Please complete your medical intake form.',
    colorClass: 'border-amber-200 bg-amber-50',
    badgeVariant: 'secondary',
  },
  intake_pending_review: {
    icon: 'clock',
    title: 'Intake Submitted',
    description: 'Your intake form has been submitted and is waiting for a physician to review.',
    colorClass: 'border-blue-200 bg-blue-50',
    badgeVariant: 'secondary',
  },
  under_review: {
    icon: 'search',
    title: 'Being Reviewed',
    description: 'A California-licensed physician is currently reviewing your case.',
    colorClass: 'border-ocean-200 bg-ocean-50',
    badgeVariant: 'default',
  },
  approved_awaiting_rx: {
    icon: 'check',
    title: 'Approved - Preparing Prescription',
    description: 'Your treatment has been approved. We are preparing your prescription.',
    colorClass: 'border-green-200 bg-green-50',
    badgeVariant: 'default',
  },
  rx_sent: {
    icon: 'pill',
    title: 'Prescription Sent',
    description: 'Your prescription has been sent to your pharmacy and is being processed.',
    colorClass: 'border-purple-200 bg-purple-50',
    badgeVariant: 'default',
  },
  active_treatment: {
    icon: 'activity',
    title: 'Active Treatment',
    description: 'Your treatment is active. Continue taking your medication as prescribed.',
    colorClass: 'border-success-200 bg-success-50',
    badgeVariant: 'default',
  },
  intake_rejected: {
    icon: 'alert',
    title: 'Intake Not Approved',
    description: 'After careful review, our medical team has determined that our telehealth service may not be the best fit for your current needs. Please see the details below for next steps.',
    colorClass: 'border-red-200 bg-red-50',
    badgeVariant: 'destructive',
  },
  intake_needs_info: {
    icon: 'clipboard',
    title: 'Additional Information Needed',
    description: 'Your physician needs more information to complete your intake review. Please check your messages and respond promptly.',
    colorClass: 'border-amber-200 bg-amber-50',
    badgeVariant: 'secondary',
  },
  unknown: {
    icon: 'alert',
    title: 'Status Unknown',
    description: 'Unable to determine your current treatment status. Please contact support.',
    colorClass: 'border-gray-200 bg-gray-50',
    badgeVariant: 'outline',
  },
};

// ============================================================================
// Next Steps
// ============================================================================

/**
 * Get next steps based on dashboard status
 */
export function getNextSteps(status: DashboardStatus): string[] {
  switch (status) {
    case 'intake_incomplete':
      return [
        'Complete your medical intake form with accurate information',
        'Answer all screening questions honestly for your safety',
        'Submit the form for physician review'
      ];
    case 'intake_pending_review':
      return [
        'A California-licensed physician will review your intake within 24 hours',
        'Check your email for updates on your application',
        'You\'ll be notified once the review is complete'
      ];
    case 'under_review':
      return [
        'Your case is being carefully reviewed by our medical team',
        'The physician may contact you if additional information is needed',
        'You will receive a decision within 24 hours of submission'
      ];
    case 'approved_awaiting_rx':
      return [
        'Your prescription is being prepared',
        'We will send it to your preferred pharmacy shortly',
        'You\'ll receive a notification when it\'s sent'
      ];
    case 'rx_sent':
      return [
        'Your prescription has been sent to the pharmacy',
        'Contact your pharmacy to confirm receipt and pickup time',
        'Begin taking your medication as directed'
      ];
    case 'active_treatment':
      return [
        'Take your medication exactly as prescribed',
        'Message your doctor if you have any questions or concerns',
        'Request refills 7 days before running out'
      ];
    case 'intake_rejected':
      return [
        'Review the details in your dashboard for specific guidance',
        'Consider consulting with your primary care physician',
        'Contact our support team if you have questions about this decision',
        'You may be eligible for a refund -- check your billing page'
      ];
    case 'intake_needs_info':
      return [
        'Check your messages for details on what information is needed',
        'Respond to your physician\'s request as soon as possible',
        'Your review will continue once the information is received',
        'Message your doctor if you have questions'
      ];
    default:
      return [
        'Contact support if you have any questions',
        'Check your email for updates'
      ];
  }
}

// ============================================================================
// Quick Actions
// ============================================================================

/**
 * Quick action item definition
 */
export interface QuickAction {
  icon: string;
  label: string;
  href: string;
  primary: boolean;
  description?: string;
}

/**
 * Default quick actions for patient dashboard
 */
export const defaultQuickActions: QuickAction[] = [
  { 
    icon: 'MessageSquare', 
    label: 'Message Doctor', 
    href: '/patient/messages', 
    primary: true,
    description: 'Ask questions or report side effects'
  },
  { 
    icon: 'Pill', 
    label: 'Prescriptions', 
    href: '/patient/prescriptions', 
    primary: false,
    description: 'View current medications and refills'
  },
  { 
    icon: 'FileText', 
    label: 'Documents', 
    href: '/patient/documents', 
    primary: false,
    description: 'Access medical records and forms'
  },
  { 
    icon: 'User', 
    label: 'Profile', 
    href: '/patient/profile', 
    primary: false,
    description: 'Update your information'
  },
];

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format date to relative time (e.g., "2 hours ago")
 */
export function formatDistanceToNow(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - new Date(date).getTime();
  const diffInSecs = Math.floor(diffInMs / 1000);
  const diffInMins = Math.floor(diffInSecs / 60);
  const diffInHours = Math.floor(diffInMins / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInSecs < 60) return 'just now';
  if (diffInMins < 60) return `${diffInMins} minute${diffInMins > 1 ? 's' : ''} ago`;
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  if (diffInDays < 30) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Format prescription status for display
 */
export function formatPrescriptionStatus(status: PrescriptionStatus): string {
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
 * Format intake status for display
 */
export function formatIntakeStatus(status: IntakeStatus): string {
  const statusMap: Record<IntakeStatus, string> = {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    UNDER_REVIEW: 'Under Review',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    NEEDS_INFO: 'Needs Information',
    EXPIRED: 'Expired',
  };
  return statusMap[status] || status;
}

/**
 * Format subscription status for display
 */
export function formatSubscriptionStatus(status: SubscriptionStatus): string {
  const statusMap: Record<SubscriptionStatus, string> = {
    ACTIVE: 'Active',
    TRIALING: 'Pending Review',
    CANCELLED: 'Cancelled',
    PAST_DUE: 'Past Due',
    UNPAID: 'Unpaid',
    EXPIRED: 'Expired',
  };
  return statusMap[status] || status;
}

/**
 * Format concern type for display
 */
export function formatConcernType(concern: ConcernType | null): string {
  if (!concern) return 'Not specified';
  // Note: SMOKING and BOTH concern types were removed from the platform (2026-02-28)
  const concernMap: Record<ConcernType, string> = {
    ALCOHOL: 'Alcohol Use',
    SMOKING: 'Discontinued',
    BOTH: 'Discontinued',
  };
  return concernMap[concern];
}

/**
 * Format treatment goal for display
 */
export function formatTreatmentGoal(goal: TreatmentGoal | null): string {
  if (!goal) return 'Not specified';
  const goalMap: Record<TreatmentGoal, string> = {
    QUIT: 'Quit Completely',
    REDUCE: 'Reduce Use',
    EXPLORE: 'Explore Options',
  };
  return goalMap[goal];
}

/**
 * Check if a patient profile is complete enough for optimal care.
 * Returns a list of missing fields that should be filled.
 *
 * @param profile - The patient profile data
 * @param hasIntakePharmacy - Whether the patient has pharmacy info from their intake form
 *   (some patients entered pharmacy info during intake but don't have a preferredPharmacyId FK set)
 */
export function getProfileCompletionStatus(
  profile: DashboardPatientProfile | null,
  hasIntakePharmacy: boolean = false,
): {
  isComplete: boolean;
  missingFields: string[];
  completionPercentage: number;
} {
  if (!profile) {
    return { isComplete: false, missingFields: ['Profile not created'], completionPercentage: 0 };
  }

  const checks: { field: string; label: string; isFilled: boolean }[] = [
    { field: 'phone', label: 'Phone number', isFilled: !!profile.phone && profile.phone.length > 0 },
    { field: 'addressStreet', label: 'Street address', isFilled: !!profile.addressStreet && profile.addressStreet.length > 0 },
    { field: 'addressCity', label: 'City', isFilled: !!profile.addressCity && profile.addressCity.length > 0 },
    { field: 'addressZip', label: 'ZIP code', isFilled: !!profile.addressZip && profile.addressZip.length > 0 },
    { field: 'preferredPharmacyId', label: 'Preferred pharmacy', isFilled: !!profile.preferredPharmacyId || hasIntakePharmacy },
  ];

  const missingFields = checks.filter(c => !c.isFilled).map(c => c.label);
  const filledCount = checks.filter(c => c.isFilled).length;
  const completionPercentage = Math.round((filledCount / checks.length) * 100);

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    completionPercentage,
  };
}

/**
 * Format currency amount
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}
