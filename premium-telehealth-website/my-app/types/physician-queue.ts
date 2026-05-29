/**
 * Physician Queue Types
 * Type definitions for the patient queue view
 * 
 * HIPAA Compliance: No PHI in type names, only references
 * @module types/physician-queue
 */

/**
 * Concern type for intake filtering
 * Note: ALCOHOL and WEIGHT_MANAGEMENT are active treatments. SMOKING and BOTH
 * remain for backward compatibility.
 */
export type ConcernType = 'ALCOHOL' | 'SMOKING' | 'BOTH' | 'WEIGHT_MANAGEMENT';

/**
 * Intake status for queue filtering
 */
export type QueueIntakeStatus = 'SUBMITTED' | 'UNDER_REVIEW';

/**
 * Risk level for patient prioritization
 * Re-exported from physician-dashboard for consistency
 */
export type { RiskLevel } from './physician-dashboard';

/**
 * Queue item representing a pending intake for physician review
 * Contains minimal patient information needed for queue display
 */
export interface QueueItem {
  /** Unique intake ID */
  intakeId: string;
  /** Patient user ID */
  patientId: string;
  /** Patient full name (decrypted PHI) */
  patientName: string;
  /** Patient age in years */
  patientAge: number;
  /** Primary concern type */
  concernType: ConcernType;
  /** Current intake status */
  status: QueueIntakeStatus;
  /** When intake was submitted */
  submittedAt: string;
  /** Hours since submission */
  waitTimeHours: number;
  /** True if waiting over 24 hours (SLA breach) */
  isOverdue: boolean;
  /** Risk assessment score (0-100) */
  riskScore?: number;
  /** Whether the patient's account has been deactivated */
  isDeactivated?: boolean;
  /** Whether the patient has uploaded a government-issued ID */
  hasGovernmentId: boolean;
}

/**
 * Queue statistics for dashboard header
 */
export interface QueueStats {
  /** Total pending intakes */
  totalPending: number;
  /** Number of overdue items (>24h) */
  overdueCount: number;
  /** Number under review */
  underReviewCount: number;
  /** Number newly submitted */
  newlySubmittedCount: number;
}

/**
 * Filter options for queue
 */
export interface QueueFilters {
  /** Filter by concern type */
  concernType?: ConcernType | 'ALL';
  /** Filter by status */
  status?: QueueIntakeStatus | 'ALL';
  /** Search by patient name */
  searchQuery?: string;
  /** Sort column */
  sortBy: 'submittedAt' | 'waitTimeHours' | 'patientName' | 'riskScore';
  /** Sort direction */
  sortOrder: 'asc' | 'desc';
}

/**
 * API response for queue endpoint
 */
export interface QueueApiResponse {
  /** Queue items */
  items: QueueItem[];
  /** Queue statistics */
  stats: QueueStats;
  /** Last updated timestamp */
  lastUpdated: string;
}

/**
 * Risk score configuration for display
 */
export interface RiskScoreConfig {
  /** Risk level */
  level: import('./physician-dashboard').RiskLevel;
  /** Badge variant */
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  /** Display label */
  label: string;
  /** Color class */
  colorClass: string;
}

/**
 * Queue refresh state
 */
export interface QueueRefreshState {
  /** Whether auto-refresh is enabled */
  isAutoRefresh: boolean;
  /** Last refresh timestamp */
  lastRefresh: Date | null;
  /** Seconds until next refresh */
  secondsUntilRefresh: number;
  /** Whether refresh is in progress */
  isRefreshing: boolean;
}

/**
 * Patient initials from name
 * Returns 1-2 uppercase initials
 */
export function getPatientInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Format wait time for display
 * Shows hours or days as appropriate
 */
export function formatWaitTime(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}m`;
  }
  if (hours < 24) {
    return `${Math.round(hours)}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  if (remainingHours === 0) {
    return `${days}d`;
  }
  return `${days}d ${remainingHours}h`;
}

/**
 * Get risk score configuration for display
 */
export function getRiskScoreConfig(score?: number): RiskScoreConfig {
  if (score === undefined) {
    return {
      level: 'LOW',
      variant: 'secondary',
      label: 'Not assessed',
      colorClass: 'text-muted-foreground',
    };
  }

  if (score >= 70) {
    return {
      level: 'SEVERE',
      variant: 'destructive',
      label: 'Severe Risk',
      colorClass: 'text-destructive',
    };
  }

  if (score >= 50) {
    return {
      level: 'HIGH',
      variant: 'outline',
      label: 'High Risk',
      colorClass: 'text-orange-600 bg-orange-50 border-orange-200',
    };
  }

  if (score >= 30) {
    return {
      level: 'MODERATE',
      variant: 'secondary',
      label: 'Moderate Risk',
      colorClass: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    };
  }

  return {
    level: 'LOW',
    variant: 'default',
    label: 'Low Risk',
    colorClass: 'text-green-600 bg-green-50 border-green-200',
  };
}

/**
 * Concern type labels for display
 */
export const CONCERN_TYPE_LABELS: Record<ConcernType | 'ALL', string> = {
  ALL: 'All Types',
  ALCOHOL: 'Alcohol Use',
  SMOKING: 'Discontinued',
  BOTH: 'Discontinued',
  WEIGHT_MANAGEMENT: 'Weight Management',
};

/**
 * Queue status labels for display
 */
export const QUEUE_STATUS_LABELS: Record<QueueIntakeStatus | 'ALL', string> = {
  SUBMITTED: 'New Submission',
  UNDER_REVIEW: 'Under Review',
  ALL: 'All Statuses',
};

/**
 * Default queue filters
 */
export const DEFAULT_QUEUE_FILTERS: QueueFilters = {
  concernType: 'ALL',
  status: 'ALL',
  sortBy: 'submittedAt',
  sortOrder: 'asc',
};
