'use client';

/**
 * Patient Queue Component
 * Main queue list with table view
 * 
 * @module components/physician/PatientQueue
 */

import * as React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QueueItem, QueueItemSkeleton } from './QueueItem';
import { QueueFilters } from './QueueFilters';
import {
  QueueItem as QueueItemType,
  QueueFilters as QueueFiltersType,
  QueueApiResponse,
  DEFAULT_QUEUE_FILTERS,
} from '@/types/physician-queue';

/**
 * Auto-refresh interval in milliseconds
 */
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Countdown update interval in milliseconds
 */
const COUNTDOWN_INTERVAL = 1000; // 1 second

interface PatientQueueProps {
  /** Initial data for SSR */
  initialData?: QueueApiResponse;
  /** Class name for styling */
  className?: string;
}

/**
 * PatientQueue Component
 * Displays the patient intake queue with filtering and sorting
 */
export function PatientQueue({
  initialData,
  className,
}: PatientQueueProps): React.ReactElement {
  // State
  const [items, setItems] = React.useState<QueueItemType[]>(
    initialData?.items || []
  );
  const [stats, setStats] = React.useState(
    initialData?.stats || {
      totalPending: 0,
      overdueCount: 0,
      underReviewCount: 0,
      newlySubmittedCount: 0,
    }
  );
  const [filters, setFilters] = React.useState<QueueFiltersType>(
    DEFAULT_QUEUE_FILTERS
  );
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = React.useState(
    AUTO_REFRESH_INTERVAL / 1000
  );
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(
    initialData?.lastUpdated ? new Date(initialData.lastUpdated) : null
  );

  // Fetch queue data
  const fetchQueueData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (filters.concernType && filters.concernType !== 'ALL') {
        params.set('concernType', filters.concernType);
      }
      if (filters.status && filters.status !== 'ALL') {
        params.set('status', filters.status);
      }
      if (filters.searchQuery) {
        params.set('search', filters.searchQuery);
      }
      params.set('sortBy', filters.sortBy);
      params.set('sortOrder', filters.sortOrder);

      const response = await fetch(`/api/physician/queue?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch queue data');
      }

      const data: QueueApiResponse = await response.json();
      setItems(data.items);
      setStats(data.stats);
      setLastUpdated(new Date(data.lastUpdated));
      setSecondsUntilRefresh(AUTO_REFRESH_INTERVAL / 1000);
    } catch (err) {
      // Log error without PHI
      console.error('Queue fetch error:', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      setError('Failed to load queue data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Initial fetch if no initial data
  React.useEffect(() => {
    if (!initialData) {
      fetchQueueData();
    }
  }, [initialData, fetchQueueData]);

  // Auto-refresh countdown
  React.useEffect(() => {
    const countdownInterval = setInterval(() => {
      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          // Trigger refresh when countdown reaches 0
          fetchQueueData();
          return AUTO_REFRESH_INTERVAL / 1000;
        }
        return prev - 1;
      });
    }, COUNTDOWN_INTERVAL);

    return () => clearInterval(countdownInterval);
  }, [fetchQueueData]);

  // Handle filter changes
  const handleFiltersChange = React.useCallback(
    (newFilters: QueueFiltersType) => {
      setFilters(newFilters);
    },
    []
  );

  // Handle sort column click
  const handleSortColumn = (column: QueueFiltersType['sortBy']) => {
    const newFilters: QueueFiltersType = { ...filters };

    if (filters.sortBy === column) {
      newFilters.sortOrder = filters.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      newFilters.sortBy = column;
      newFilters.sortOrder = 'asc';
    }

    setFilters(newFilters);
  };

  // Get sort icon for column
  const getSortIcon = (column: QueueFiltersType['sortBy']) => {
    if (filters.sortBy !== column) {
      return <ArrowUpDown className="size-3 text-muted-foreground" />;
    }
    return filters.sortOrder === 'asc' ? (
      <ArrowUp className="size-3" />
    ) : (
      <ArrowDown className="size-3" />
    );
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle>Patient Queue</CardTitle>
        <QueueFilters
          filters={filters}
          stats={stats}
          onFiltersChange={handleFiltersChange}
          onRefresh={fetchQueueData}
          isLoading={isLoading}
          secondsUntilRefresh={secondsUntilRefresh}
        />
      </CardHeader>

      <CardContent>
        {error ? (
          <ErrorState message={error} onRetry={fetchQueueData} />
        ) : items.length === 0 && !isLoading ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      onClick={() => handleSortColumn('patientName')}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Patient
                      {getSortIcon('patientName')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Concern</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      onClick={() => handleSortColumn('waitTimeHours')}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Wait Time
                      {getSortIcon('waitTimeHours')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium">
                    <button
                      onClick={() => handleSortColumn('riskScore')}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Risk Score
                      {getSortIcon('riskScore')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading
                  ? // Loading skeletons
                    Array.from({ length: 5 }).map((_, index) => (
                      <QueueItemSkeleton key={`skeleton-${index}`} />
                    ))
                  : // Queue items
                    items.map((item) => (
                      <QueueItem key={item.intakeId} item={item} />
                    ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Last Updated */}
        {lastUpdated && !error && (
          <p className="mt-4 text-xs text-muted-foreground" suppressHydrationWarning>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Empty State Component
 * Displayed when no items in queue
 */
function EmptyState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <Inbox className="size-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-lg font-medium">No pending intakes</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        The queue is currently empty. New patient submissions will appear here
        automatically.
      </p>
    </div>
  );
}

/**
 * Error State Component
 * Displayed when there's an error loading data
 */
interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 rounded-full bg-destructive/10 p-4">
        <Inbox className="size-8 text-destructive" />
      </div>
      <h3 className="mb-2 text-lg font-medium">Error loading queue</h3>
      <p className="mb-4 max-w-sm text-sm text-muted-foreground">{message}</p>
      <Button onClick={onRetry} variant="outline">
        Try Again
      </Button>
    </div>
  );
}
