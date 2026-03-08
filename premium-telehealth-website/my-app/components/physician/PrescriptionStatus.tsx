/**
 * PrescriptionStatus Component
 * Displays prescription status with timeline and error handling
 * 
 * Features:
 * - Status badge with color coding
 * - Timeline of status changes
 * - Auto-refresh capability
 * - Error display
 * - Manual refresh button
 * 
 * HIPAA Compliance:
 * - Only displays status (no PHI)
 * - Prescription ID only, no patient data
 * 
 * @module components/physician/PrescriptionStatus
 */

'use client';

import * as React from 'react';
import {
  Clock,
  Check,
  AlertCircle,
  RefreshCw,
  Package,
  Store,
  Home,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

export type PrescriptionStatus =
  | 'PENDING'
  | 'SENT'
  | 'RECEIVED_BY_PHARMACY'
  | 'FILLED'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'CANCELLED'
  | 'EXPIRED';

export interface StatusHistoryEntry {
  status: PrescriptionStatus;
  timestamp: string;
  details?: string;
}

export interface PrescriptionStatusData {
  prescriptionId: string;
  status: PrescriptionStatus;
  surescriptsRxId?: string | null;
  history: StatusHistoryEntry[];
  estimatedReadyTime?: string | null;
  lastUpdated: string;
  error?: string;
}

interface PrescriptionStatusProps {
  /** Prescription ID to check status for */
  prescriptionId: string;
  /** Initial status data (optional) */
  initialData?: PrescriptionStatusData;
  /** Auto-refresh interval in seconds (0 to disable) */
  refreshInterval?: number;
  /** Callback when status changes */
  onStatusChange?: (status: PrescriptionStatus) => void;
  /** Additional class names */
  className?: string;
}

// ============================================
// STATUS CONFIGURATION
// ============================================

interface StatusConfig {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: React.ElementType;
  color: string;
  description: string;
}

const STATUS_CONFIG: Record<PrescriptionStatus, StatusConfig> = {
  PENDING: {
    label: 'Pending',
    variant: 'secondary',
    icon: Clock,
    color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    description: 'Prescription is being prepared',
  },
  SENT: {
    label: 'Sent',
    variant: 'default',
    icon: Check,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    description: 'Sent to pharmacy via Surescripts',
  },
  RECEIVED_BY_PHARMACY: {
    label: 'Received',
    variant: 'default',
    icon: Store,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    description: 'Pharmacy has received the prescription',
  },
  FILLED: {
    label: 'Filled',
    variant: 'default' as const,
    icon: Package,
    color: 'text-green-600 bg-green-50 border-green-200',
    description: 'Prescription has been filled',
  },
  READY_FOR_PICKUP: {
    label: 'Ready for Pickup',
    variant: 'default' as const,
    icon: Package,
    color: 'text-green-600 bg-green-50 border-green-200',
    description: 'Ready for patient pickup',
  },
  PICKED_UP: {
    label: 'Picked Up',
    variant: 'default' as const,
    icon: Home,
    color: 'text-green-600 bg-green-50 border-green-200',
    description: 'Patient has picked up prescription',
  },
  CANCELLED: {
    label: 'Cancelled',
    variant: 'destructive',
    icon: X,
    color: 'text-red-600 bg-red-50 border-red-200',
    description: 'Prescription was cancelled',
  },
  EXPIRED: {
    label: 'Expired',
    variant: 'destructive',
    icon: AlertCircle,
    color: 'text-red-600 bg-red-50 border-red-200',
    description: 'Prescription has expired',
  },
};

// ============================================
// COMPONENT
// ============================================

export function PrescriptionStatus({
  prescriptionId,
  initialData,
  refreshInterval = 30,
  onStatusChange,
  className,
}: PrescriptionStatusProps): React.ReactElement {
  // State
  const [statusData, setStatusData] = React.useState<PrescriptionStatusData | null>(
    initialData || null
  );
  const [isLoading, setIsLoading] = React.useState(!initialData);
  const [error, setError] = React.useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = React.useState<Date>(new Date());

  // Refs
  const previousStatus = React.useRef<PrescriptionStatus | null>(
    initialData?.status || null
  );

  // ============================================
  // FETCH STATUS
  // ============================================

  const fetchStatus = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/physician/prescriptions/${prescriptionId}/status`,
        {
          credentials: 'include',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch status');
      }

      const newStatusData: PrescriptionStatusData = {
        prescriptionId: data.prescriptionId,
        status: data.status,
        surescriptsRxId: data.surescriptsRxId,
        history: data.history || [],
        estimatedReadyTime: data.estimatedReadyTime,
        lastUpdated: data.lastUpdated,
      };

      setStatusData(newStatusData);
      setLastRefreshed(new Date());

      // Check for status change
      if (
        previousStatus.current &&
        previousStatus.current !== newStatusData.status
      ) {
        onStatusChange?.(newStatusData.status);
      }
      previousStatus.current = newStatusData.status;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setIsLoading(false);
    }
  }, [prescriptionId, onStatusChange]);

  // ============================================
  // EFFECTS
  // ============================================

  // Initial fetch
  React.useEffect(() => {
    if (!initialData) {
      fetchStatus();
    }
  }, [fetchStatus, initialData]);

  // Auto-refresh
  React.useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(fetchStatus, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [fetchStatus, refreshInterval]);

  // ============================================
  // RENDER HELPERS
  // ============================================

  const getStatusConfig = (status: PrescriptionStatus): StatusConfig => {
    return STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  // ============================================
  // RENDER
  // ============================================

  if (!statusData && isLoading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-ocean-500" />
        </CardContent>
      </Card>
    );
  }

  if (error && !statusData) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="py-6">
          <div className="flex items-start gap-3 text-red-600">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <div className="space-y-2">
              <p className="text-sm font-medium">Failed to load status</p>
              <p className="text-sm text-red-600/80">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStatus}
                className="mt-2"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!statusData) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">No status data available</p>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = getStatusConfig(statusData.status);
  const StatusIcon = statusConfig.icon;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">Prescription Status</CardTitle>
            <CardDescription>
              Surescripts ID: {statusData.surescriptsRxId || 'N/A'}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchStatus}
            disabled={isLoading}
          >
            <RefreshCw
              className={cn('h-4 w-4', isLoading && 'animate-spin')}
            />
            <span className="sr-only">Refresh</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Current Status */}
        <div
          className={cn(
            'p-4 rounded-lg border',
            statusConfig.color
          )}
        >
          <div className="flex items-center gap-3">
            <StatusIcon className="h-6 w-6" />
            <div>
              <Badge variant={statusConfig.variant} className="mb-1">
                {statusConfig.label}
              </Badge>
              <p className="text-sm">{statusConfig.description}</p>
            </div>
          </div>
        </div>

        {/* Estimated Ready Time */}
        {statusData.estimatedReadyTime && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              Estimated ready: {formatTimestamp(statusData.estimatedReadyTime)}
            </span>
          </div>
        )}

        {/* Status History Timeline */}
        {statusData.history.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Status History</h4>
            <div className="relative space-y-4">
              {/* Timeline line */}
              <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />

              {statusData.history.map((entry, index) => {
                const entryConfig = getStatusConfig(entry.status);
                const EntryIcon = entryConfig.icon;
                const isLast = index === statusData.history.length - 1;

                return (
                  <div
                    key={`${entry.status}-${entry.timestamp}`}
                    className="relative flex items-start gap-3 pl-6"
                  >
                    {/* Timeline dot */}
                    <div
                      className={cn(
                        'absolute left-0 w-4 h-4 rounded-full border-2',
                        isLast
                          ? 'bg-ocean-500 border-ocean-500'
                          : 'bg-background border-muted-foreground'
                      )}
                    />

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <EntryIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {entryConfig.label}
                        </span>
                      </div>
                      {entry.details && (
                        <p className="text-sm text-muted-foreground">
                          {entry.details}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatTimestamp(entry.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Last Updated */}
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>Last updated: {formatRelativeTime(lastRefreshed)}</span>
          {isLoading && (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Updating...
            </span>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PrescriptionStatus;
