'use client';

/**
 * Queue Filters Component
 * Filter and sort controls for the patient queue
 * 
 * @module components/physician/QueueFilters
 */

import * as React from 'react';
import { Search, Filter, ArrowUpDown, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  QueueFilters as QueueFiltersType,
  ConcernType,
  QueueIntakeStatus,
  CONCERN_TYPE_LABELS,
  QUEUE_STATUS_LABELS,
  QueueStats,
} from '@/types/physician-queue';

interface QueueFiltersProps {
  /** Current filter values */
  filters: QueueFiltersType;
  /** Queue statistics for display */
  stats: QueueStats;
  /** Callback when filters change */
  onFiltersChange: (filters: QueueFiltersType) => void;
  /** Callback to refresh data */
  onRefresh: () => void;
  /** Whether data is loading */
  isLoading: boolean;
  /** Time until next auto-refresh */
  secondsUntilRefresh: number;
  /** Class name for styling */
  className?: string;
}

/**
 * QueueFilters Component
 * Provides filtering, sorting, and search for the patient queue
 */
export function QueueFilters({
  filters,
  stats,
  onFiltersChange,
  onRefresh,
  isLoading,
  secondsUntilRefresh,
  className,
}: QueueFiltersProps): React.ReactElement {
  // Local state for search input (debounced)
  const [searchInput, setSearchInput] = React.useState(
    filters.searchQuery || ''
  );

  // Debounce search input
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchInput !== (filters.searchQuery || '')) {
        onFiltersChange({
          ...filters,
          searchQuery: searchInput.trim() || undefined,
        });
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchInput, filters, onFiltersChange]);

  // Update local search when filters change externally
  React.useEffect(() => {
    if (filters.searchQuery !== searchInput) {
      setSearchInput(filters.searchQuery || '');
    }
  }, [filters.searchQuery]);

  // Handle sort toggle
  const handleSort = (column: QueueFiltersType['sortBy']) => {
    const newFilters: QueueFiltersType = { ...filters };
    
    if (filters.sortBy === column) {
      // Toggle sort order
      newFilters.sortOrder = filters.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      // New sort column, default to ascending
      newFilters.sortBy = column;
      newFilters.sortOrder = 'asc';
    }
    
    onFiltersChange(newFilters);
  };

  // Handle concern type filter
  const handleConcernTypeChange = (type: ConcernType | 'ALL') => {
    onFiltersChange({
      ...filters,
      concernType: type,
    });
  };

  // Handle status filter
  const handleStatusChange = (status: QueueIntakeStatus | 'ALL') => {
    onFiltersChange({
      ...filters,
      status,
    });
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchInput('');
    onFiltersChange({
      concernType: 'ALL',
      status: 'ALL',
      searchQuery: undefined,
      sortBy: 'submittedAt',
      sortOrder: 'asc',
    });
  };

  // Check if any filters are active
  const hasActiveFilters =
    filters.concernType !== 'ALL' ||
    filters.status !== 'ALL' ||
    !!filters.searchQuery;

  const concernTypes: (ConcernType | 'ALL')[] = [
    'ALL',
    'ALCOHOL',
    'WEIGHT_MANAGEMENT',
  ];
  const statuses: (QueueIntakeStatus | 'ALL')[] = [
    'ALL',
    'SUBMITTED',
    'UNDER_REVIEW',
  ];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Stats Header */}
      <div className="flex flex-wrap gap-3">
        <StatCard
          label="Total Pending"
          value={stats.totalPending}
          icon={<Filter className="size-4 text-primary" />}
          isLoading={isLoading}
        />
        <StatCard
          label="Overdue (>24h)"
          value={stats.overdueCount}
          icon={<AlertCircle className="size-4 text-destructive" />}
          isLoading={isLoading}
          variant={stats.overdueCount > 0 ? 'destructive' : 'default'}
        />
        <StatCard
          label="Under Review"
          value={stats.underReviewCount}
          icon={<Clock className="size-4 text-ocean-500" />}
          isLoading={isLoading}
        />
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by patient name..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
            aria-label="Search patients"
          />
        </div>

        {/* Refresh Button with Countdown */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Auto-refresh in {secondsUntilRefresh}s
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="gap-2"
          >
            <ArrowUpDown
              className={cn('size-4', isLoading && 'animate-spin')}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-4">
        {/* Concern Type Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Concern:
          </span>
          {concernTypes.map((type) => (
            <Button
              key={type}
              variant={filters.concernType === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleConcernTypeChange(type)}
              className="h-7 text-xs"
            >
              {CONCERN_TYPE_LABELS[type] || 'All'}
            </Button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Status:
          </span>
          {statuses.map((status) => (
            <Button
              key={status}
              variant={filters.status === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusChange(status)}
              className="h-7 text-xs"
            >
              {QUEUE_STATUS_LABELS[status]}
            </Button>
          ))}
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-7 text-xs"
          >
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Stat Card Component
 * Displays a statistic with icon
 */
interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  isLoading: boolean;
  variant?: 'default' | 'destructive';
}

function StatCard({
  label,
  value,
  icon,
  isLoading,
  variant = 'default',
}: StatCardProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-4 py-2',
        variant === 'destructive' && value > 0
          ? 'border-destructive/20 bg-destructive/5'
          : 'border-border bg-card'
      )}
    >
      {icon}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold leading-none">
          {isLoading ? '-' : value}
        </p>
      </div>
    </div>
  );
}
