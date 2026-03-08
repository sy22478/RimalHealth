'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type StatusVariant = 
  | 'default' 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'info' 
  | 'secondary' 
  | 'outline';

interface StatusConfig {
  label: string;
  variant: StatusVariant;
  className?: string;
  dotColor?: string;
}

interface StatusBadgeProps {
  status: string;
  type?: 'intake' | 'prescription' | 'subscription' | 'refill' | 'document' | 'appointment';
  showDot?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

// ============================================================================
// Status Configurations
// ============================================================================

const INTAKE_STATUS_CONFIG: Record<string, StatusConfig> = {
  DRAFT: {
    label: 'Draft',
    variant: 'secondary',
    dotColor: 'bg-gray-400',
  },
  SUBMITTED: {
    label: 'Submitted',
    variant: 'info',
    dotColor: 'bg-blue-500',
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    variant: 'warning',
    dotColor: 'bg-amber-500',
  },
  APPROVED: {
    label: 'Approved',
    variant: 'success',
    dotColor: 'bg-green-500',
  },
  REJECTED: {
    label: 'Rejected',
    variant: 'error',
    dotColor: 'bg-red-500',
  },
  NEEDS_INFO: {
    label: 'Needs Info',
    variant: 'warning',
    dotColor: 'bg-amber-500',
  },
  EXPIRED: {
    label: 'Expired',
    variant: 'secondary',
    dotColor: 'bg-gray-400',
  },
};

const PRESCRIPTION_STATUS_CONFIG: Record<string, StatusConfig> = {
  PENDING: {
    label: 'Pending',
    variant: 'warning',
    dotColor: 'bg-amber-500',
  },
  SENT: {
    label: 'Sent to Pharmacy',
    variant: 'info',
    dotColor: 'bg-blue-500',
  },
  RECEIVED_BY_PHARMACY: {
    label: 'At Pharmacy',
    variant: 'info',
    dotColor: 'bg-blue-500',
  },
  FILLED: {
    label: 'Being Filled',
    variant: 'warning',
    dotColor: 'bg-amber-500',
  },
  READY_FOR_PICKUP: {
    label: 'Ready for Pickup',
    variant: 'success',
    dotColor: 'bg-green-500',
  },
  PICKED_UP: {
    label: 'Picked Up',
    variant: 'success',
    dotColor: 'bg-green-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    variant: 'error',
    dotColor: 'bg-red-500',
  },
  EXPIRED: {
    label: 'Expired',
    variant: 'secondary',
    dotColor: 'bg-gray-400',
  },
};

const SUBSCRIPTION_STATUS_CONFIG: Record<string, StatusConfig> = {
  ACTIVE: {
    label: 'Active',
    variant: 'success',
    dotColor: 'bg-green-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    variant: 'secondary',
    dotColor: 'bg-gray-400',
  },
  PAST_DUE: {
    label: 'Past Due',
    variant: 'error',
    dotColor: 'bg-red-500',
  },
  UNPAID: {
    label: 'Unpaid',
    variant: 'error',
    dotColor: 'bg-red-500',
  },
  EXPIRED: {
    label: 'Expired',
    variant: 'secondary',
    dotColor: 'bg-gray-400',
  },
};

const REFILL_STATUS_CONFIG: Record<string, StatusConfig> = {
  PENDING: {
    label: 'Pending Review',
    variant: 'warning',
    dotColor: 'bg-amber-500',
  },
  APPROVED: {
    label: 'Approved',
    variant: 'success',
    dotColor: 'bg-green-500',
  },
  DENIED: {
    label: 'Denied',
    variant: 'error',
    dotColor: 'bg-red-500',
  },
  SENT: {
    label: 'Sent to Pharmacy',
    variant: 'success',
    dotColor: 'bg-green-500',
  },
};

const DOCUMENT_STATUS_CONFIG: Record<string, StatusConfig> = {
  pending: {
    label: 'Pending Review',
    variant: 'warning',
    dotColor: 'bg-amber-500',
  },
  verified: {
    label: 'Verified',
    variant: 'success',
    dotColor: 'bg-green-500',
  },
  rejected: {
    label: 'Rejected',
    variant: 'error',
    dotColor: 'bg-red-500',
  },
};

const APPOINTMENT_STATUS_CONFIG: Record<string, StatusConfig> = {
  SCHEDULED: {
    label: 'Scheduled',
    variant: 'info',
    dotColor: 'bg-blue-500',
  },
  CONFIRMED: {
    label: 'Confirmed',
    variant: 'success',
    dotColor: 'bg-green-500',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    variant: 'warning',
    dotColor: 'bg-amber-500',
  },
  COMPLETED: {
    label: 'Completed',
    variant: 'success',
    dotColor: 'bg-green-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    variant: 'secondary',
    dotColor: 'bg-gray-400',
  },
  NO_SHOW: {
    label: 'No Show',
    variant: 'error',
    dotColor: 'bg-red-500',
  },
};

const STATUS_CONFIGS: Record<string, Record<string, StatusConfig>> = {
  intake: INTAKE_STATUS_CONFIG,
  prescription: PRESCRIPTION_STATUS_CONFIG,
  subscription: SUBSCRIPTION_STATUS_CONFIG,
  refill: REFILL_STATUS_CONFIG,
  document: DOCUMENT_STATUS_CONFIG,
  appointment: APPOINTMENT_STATUS_CONFIG,
};

const VARIANT_CLASSES: Record<StatusVariant, string> = {
  default: 'bg-ocean-100 text-ocean-800 border-ocean-200',
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  secondary: 'bg-gray-100 text-gray-800 border-gray-200',
  outline: 'bg-transparent border-gray-300 text-gray-700',
};

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-0.5',
  lg: 'text-base px-3 py-1',
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * Main StatusBadge component
 */
export function StatusBadge({
  status,
  type = 'intake',
  showDot = true,
  className,
  size = 'md',
}: StatusBadgeProps) {
  const config = STATUS_CONFIGS[type]?.[status] || {
    label: status,
    variant: 'secondary',
    dotColor: 'bg-gray-400',
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium inline-flex items-center gap-1.5',
        VARIANT_CLASSES[config.variant],
        SIZE_CLASSES[size],
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            'rounded-full',
            size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2',
            config.dotColor || 'bg-gray-400'
          )}
        />
      )}
      {config.label}
    </Badge>
  );
}

// ============================================================================
// Specialized Badge Components
// ============================================================================

export function IntakeStatusBadge(props: Omit<StatusBadgeProps, 'type'>) {
  return <StatusBadge {...props} type="intake" />;
}

export function PrescriptionStatusBadge(props: Omit<StatusBadgeProps, 'type'>) {
  return <StatusBadge {...props} type="prescription" />;
}

export function SubscriptionStatusBadge(props: Omit<StatusBadgeProps, 'type'>) {
  return <StatusBadge {...props} type="subscription" />;
}

export function RefillStatusBadge(props: Omit<StatusBadgeProps, 'type'>) {
  return <StatusBadge {...props} type="refill" />;
}

export function DocumentStatusBadge(props: Omit<StatusBadgeProps, 'type'>) {
  return <StatusBadge {...props} type="document" />;
}

// ============================================================================
// Physician Portal Badge Components
// ============================================================================

/**
 * Risk level badge with color coding
 */
export function RiskBadge({
  level,
  score,
  className,
  size = 'md',
}: {
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' | string;
  score?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const config: Record<string, { label: string; variant: StatusVariant }> = {
    LOW: { label: 'Low Risk', variant: 'success' },
    MODERATE: { label: 'Moderate', variant: 'warning' },
    HIGH: { label: 'High Risk', variant: 'error' },
    SEVERE: { label: 'Severe', variant: 'error' },
  };

  const { label, variant } = config[level] || { label: level, variant: 'secondary' };
  const displayLabel = score !== undefined ? `${label} (${score})` : label;

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium inline-flex items-center gap-1.5',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
    >
      <span className={cn('rounded-full w-2 h-2', VARIANT_CLASSES[variant].includes('green') ? 'bg-green-500' : VARIANT_CLASSES[variant].includes('amber') ? 'bg-amber-500' : 'bg-red-500')} />
      {displayLabel}
    </Badge>
  );
}

/**
 * Review status badge
 */
export function ReviewStatusBadge({
  status,
  className,
  size = 'md',
}: {
  status: 'PENDING' | 'IN_REVIEW' | 'COMPLETED' | 'NEEDS_INFO' | string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const config: Record<string, { label: string; variant: StatusVariant }> = {
    PENDING: { label: 'Pending', variant: 'warning' },
    IN_REVIEW: { label: 'In Review', variant: 'info' },
    COMPLETED: { label: 'Completed', variant: 'success' },
    NEEDS_INFO: { label: 'Needs Info', variant: 'warning' },
  };

  const { label, variant } = config[status] || { label: status, variant: 'secondary' };

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium inline-flex items-center gap-1.5',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
    >
      <span className={cn('rounded-full w-2 h-2', VARIANT_CLASSES[variant].includes('green') ? 'bg-green-500' : VARIANT_CLASSES[variant].includes('blue') ? 'bg-blue-500' : VARIANT_CLASSES[variant].includes('amber') ? 'bg-amber-500' : 'bg-gray-400')} />
      {label}
    </Badge>
  );
}

/**
 * Patient status badge
 */
export function PatientStatusBadge({
  status,
  className,
  size = 'md',
}: {
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'COMPLETED' | string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const config: Record<string, { label: string; variant: StatusVariant }> = {
    ACTIVE: { label: 'Active', variant: 'success' },
    INACTIVE: { label: 'Inactive', variant: 'secondary' },
    PENDING: { label: 'Pending', variant: 'warning' },
    COMPLETED: { label: 'Completed', variant: 'info' },
  };

  const { label, variant } = config[status] || { label: status, variant: 'secondary' };

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
    >
      {label}
    </Badge>
  );
}

/**
 * Overdue badge for SLA indicators
 */
export function OverdueBadge({
  hours,
  className,
}: {
  hours: number;
  className?: string;
}) {
  const isOverdue = hours >= 24;

  if (!isOverdue) {
    return (
      <span className="text-sm text-muted-foreground">
        {hours < 1 ? `${Math.round(hours * 60)}m` : `${Math.round(hours)}h`}
      </span>
    );
  }

  const days = Math.floor(hours / 24);

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium inline-flex items-center gap-1.5 bg-red-100 text-red-800 border-red-200',
        className
      )}
    >
      <span className="rounded-full w-2 h-2 bg-red-500" />
      {days}d overdue
    </Badge>
  );
}

export default StatusBadge;
