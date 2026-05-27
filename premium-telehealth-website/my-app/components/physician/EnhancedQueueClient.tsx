'use client';

/**
 * Enhanced Queue Client Component
 * Client-side queue with filtering, sorting, and auto-refresh
 * 
 * @module components/physician/EnhancedQueueClient
 */

import * as React from 'react';
import {
  Filter,
  AlertCircle,
  Clock,
  Users,
  TrendingUp,
  RefreshCw,
  Wine,
  Scale,
  LayoutGrid,
  List,
  ArrowUpDown,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  QueueItemEnhanced,
  QueueItemEnhancedSkeleton,
} from './QueueItemEnhanced';
import {
  QueueItem,
  QueueStats,
  QueueFilters,
  DEFAULT_QUEUE_FILTERS,
  formatWaitTime,
} from '@/types/physician-queue';

// ============================================================================
// Types
// ============================================================================

interface EnhancedQueueStats {
  stats: QueueStats;
  highPriorityCount: number;
  averageWaitTimeHours: number;
}

interface EnhancedQueueClientProps {
  /** Initial queue data from SSR */
  initialData: {
    items: QueueItem[];
    stats: QueueStats;
    lastUpdated: string;
  };
  /** Initial enhanced statistics */
  initialEnhancedStats: EnhancedQueueStats;
}

type FilterType = 'ALL' | 'HIGH_PRIORITY' | 'ALCOHOL' | 'WEIGHT_MANAGEMENT';
type SortType = 'PRIORITY' | 'WAIT_TIME';
type ViewMode = 'GRID' | 'LIST';

interface ActiveFilters {
  type: FilterType;
  sort: SortType;
  viewMode: ViewMode;
}

// ============================================================================
// Constants
// ============================================================================

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const COUNTDOWN_INTERVAL = 1000; // 1 second

const FILTER_OPTIONS: { type: FilterType; label: string; icon: React.ReactNode }[] = [
  { type: 'ALL', label: 'All Intakes', icon: <Filter className="size-4" /> },
  { type: 'HIGH_PRIORITY', label: 'High Priority', icon: <AlertCircle className="size-4" /> },
  { type: 'ALCOHOL', label: 'Alcohol', icon: <Wine className="size-4" /> },
  { type: 'WEIGHT_MANAGEMENT', label: 'Weight Management', icon: <Scale className="size-4" /> },
];

const SORT_OPTIONS: { type: SortType; label: string; description: string }[] = [
  { type: 'PRIORITY', label: 'Priority', description: 'Highest risk first' },
  { type: 'WAIT_TIME', label: 'Wait Time', description: 'Oldest first' },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Filter queue items based on active filter
 */
function filterItems(items: QueueItem[], filter: FilterType): QueueItem[] {
  switch (filter) {
    case 'HIGH_PRIORITY':
      return items.filter(item => (item.riskScore || 0) >= 70);
    case 'ALCOHOL':
      return items.filter(item => item.concernType === 'ALCOHOL');
    case 'WEIGHT_MANAGEMENT':
      return items.filter(item => item.concernType === 'WEIGHT_MANAGEMENT');
    case 'ALL':
    default:
      return items;
  }
}

/**
 * Sort queue items based on active sort
 */
function sortItems(items: QueueItem[], sort: SortType): QueueItem[] {
  const sorted = [...items];
  
  switch (sort) {
    case 'PRIORITY':
      // Sort by risk score descending, then by wait time descending
      sorted.sort((a, b) => {
        const riskDiff = (b.riskScore || 0) - (a.riskScore || 0);
        if (riskDiff !== 0) return riskDiff;
        return b.waitTimeHours - a.waitTimeHours;
      });
      break;
    case 'WAIT_TIME':
      // Sort by wait time descending (oldest first)
      sorted.sort((a, b) => b.waitTimeHours - a.waitTimeHours);
      break;
  }

  return sorted;
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * EnhancedQueueClient Component
 * Client-side queue with filtering, sorting, and auto-refresh
 */
export function EnhancedQueueClient({
  initialData,
  initialEnhancedStats,
}: EnhancedQueueClientProps): React.ReactElement {
  // State
  const [items, setItems] = React.useState<QueueItem[]>(initialData.items);
  const [stats, setStats] = React.useState<QueueStats>(initialData.stats);
  const [enhancedStats, setEnhancedStats] = React.useState<EnhancedQueueStats>(initialEnhancedStats);
  const [filters, setFilters] = React.useState<ActiveFilters>({
    type: 'ALL',
    sort: 'PRIORITY',
    viewMode: 'GRID',
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = React.useState(AUTO_REFRESH_INTERVAL / 1000);
  const [lastUpdated, setLastUpdated] = React.useState<Date>(new Date(initialData.lastUpdated));
  const [lastUpdatedText, setLastUpdatedText] = React.useState('');

  React.useEffect(() => {
    setLastUpdatedText(lastUpdated.toLocaleTimeString());
  }, [lastUpdated]);

  // Apply filters and sorting
  const filteredItems = React.useMemo(() => {
    const filtered = filterItems(items, filters.type);
    return sortItems(filtered, filters.sort);
  }, [items, filters.type, filters.sort]);

  // Fetch queue data
  const fetchQueueData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (filters.type !== 'ALL') {
        if (filters.type === 'HIGH_PRIORITY') {
          params.set('minRiskScore', '70');
        } else {
          params.set('concernType', filters.type);
        }
      }
      params.set('sortBy', filters.sort === 'WAIT_TIME' ? 'waitTimeHours' : 'riskScore');
      params.set('sortOrder', 'desc');

      const response = await fetch(`/api/physician/queue?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch queue data');
      }

      const data = await response.json();
      const fetchedItems: QueueItem[] = Array.isArray(data.queue) ? data.queue : Array.isArray(data.items) ? data.items : [];
      setItems(fetchedItems);
      setStats(data.stats ?? stats);

      // Update enhanced stats
      const highPriorityCount = fetchedItems.filter(
        (item: QueueItem) => (item.riskScore || 0) >= 70
      ).length;
      const averageWaitTimeHours = fetchedItems.length > 0
        ? fetchedItems.reduce((sum: number, item: QueueItem) => sum + (item.waitTimeHours || 0), 0) / fetchedItems.length
        : 0;
      
      setEnhancedStats({
        stats: data.stats,
        highPriorityCount,
        averageWaitTimeHours: Math.round(averageWaitTimeHours * 10) / 10,
      });
      
      setLastUpdated(new Date());
      setSecondsUntilRefresh(AUTO_REFRESH_INTERVAL / 1000);
    } catch (err) {
      console.error('Queue fetch error:', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      setError('Failed to load queue data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [filters.type, filters.sort]);

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

  // Handle filter change
  const handleFilterChange = (type: FilterType) => {
    setFilters(prev => ({ ...prev, type }));
  };

  // Handle sort change
  const handleSortChange = (sort: SortType) => {
    setFilters(prev => ({ ...prev, sort }));
  };

  // Handle view mode toggle
  const handleViewModeChange = (viewMode: ViewMode) => {
    setFilters(prev => ({ ...prev, viewMode }));
  };

  // Format average wait time for display
  const formattedAvgWaitTime = React.useMemo(() => {
    return formatWaitTime(enhancedStats.averageWaitTimeHours);
  }, [enhancedStats.averageWaitTimeHours]);

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total in Queue"
          value={stats.totalPending}
          icon={<Users className="size-5 text-navy-600" />}
          description="Pending intakes"
          isLoading={isLoading}
          trend={stats.newlySubmittedCount > 0 ? `+${stats.newlySubmittedCount} new` : undefined}
        />
        <StatCard
          label="High Priority"
          value={enhancedStats.highPriorityCount}
          icon={<AlertCircle className="size-5 text-destructive" />}
          description="Risk score ≥ 70"
          isLoading={isLoading}
          variant={enhancedStats.highPriorityCount > 0 ? 'destructive' : 'default'}
        />
        <StatCard
          label="Overdue (>24h)"
          value={stats.overdueCount}
          icon={<Clock className="size-5 text-warning-600" />}
          description="SLA breach"
          isLoading={isLoading}
          variant={stats.overdueCount > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Avg. Wait Time"
          value={formattedAvgWaitTime}
          icon={<TrendingUp className="size-5 text-ocean-600" />}
          description="Since submission"
          isLoading={isLoading}
          isTextValue
        />
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground mr-1">
              Filter:
            </span>
            {FILTER_OPTIONS.map((option) => (
              <Button
                key={option.type}
                variant={filters.type === option.type ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilterChange(option.type)}
                className={cn(
                  'gap-1.5 h-8 text-xs',
                  filters.type === option.type && 'shadow-sm'
                )}
              >
                {option.icon}
                {option.label}
                {option.type === 'ALL' && items.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {items.length}
                  </Badge>
                )}
                {option.type === 'HIGH_PRIORITY' && enhancedStats.highPriorityCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">
                    {enhancedStats.highPriorityCount}
                  </Badge>
                )}
              </Button>
            ))}
          </div>

          {/* Sort and View Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Sort by:
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 h-8">
                    <ArrowUpDown className="size-3.5" />
                    {SORT_OPTIONS.find(s => s.type === filters.sort)?.label}
                    <ChevronDown className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {SORT_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.type}
                      onClick={() => handleSortChange(option.type)}
                      className={cn(
                        'flex flex-col items-start gap-0.5',
                        filters.sort === option.type && 'bg-accent'
                      )}
                    >
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* View Mode and Refresh */}
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center rounded-md border bg-muted p-0.5">
                <Button
                  variant={filters.viewMode === 'GRID' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handleViewModeChange('GRID')}
                  className="h-7 px-2"
                >
                  <LayoutGrid className="size-4" />
                </Button>
                <Button
                  variant={filters.viewMode === 'LIST' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handleViewModeChange('LIST')}
                  className="h-7 px-2"
                >
                  <List className="size-4" />
                </Button>
              </div>

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={fetchQueueData}
                disabled={isLoading}
                className="gap-1.5 h-8"
              >
                <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
                Refresh
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {secondsUntilRefresh}s
                </Badge>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filteredItems.length}</span> of{' '}
          <span className="font-medium text-foreground">{items.length}</span> intakes
          {filters.type !== 'ALL' && (
            <span className="ml-1">
              (filtered by {FILTER_OPTIONS.find(f => f.type === filters.type)?.label.toLowerCase()})
            </span>
          )}
        </p>
        {lastUpdatedText && (
          <p className="text-xs text-muted-foreground">
            Last updated: {lastUpdatedText}
          </p>
        )}
      </div>

      {/* Queue Items */}
      {error ? (
        <ErrorState message={error} onRetry={fetchQueueData} />
      ) : filteredItems.length === 0 && !isLoading ? (
        <EmptyState filterType={filters.type} />
      ) : (
        <div
          className={cn(
            'grid gap-4',
            filters.viewMode === 'GRID'
              ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
              : 'grid-cols-1'
          )}
        >
          {isLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <QueueItemEnhancedSkeleton key={`skeleton-${index}`} />
              ))
            : filteredItems.map((item) => (
                <QueueItemEnhanced key={item.intakeId} item={item} />
              ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  isLoading: boolean;
  variant?: 'default' | 'destructive' | 'warning';
  trend?: string;
  isTextValue?: boolean;
}

function StatCard({
  label,
  value,
  icon,
  description,
  isLoading,
  variant = 'default',
  trend,
  isTextValue = false,
}: StatCardProps): React.ReactElement {
  return (
    <Card
      className={cn(
        'transition-all duration-200 hover:shadow-md',
        variant === 'destructive' && 'border-destructive/20 bg-destructive/5',
        variant === 'warning' && 'border-warning-200 bg-warning-50/50'
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <div className="flex items-baseline gap-2">
                <p
                  className={cn(
                    'font-semibold tracking-tight',
                    isTextValue ? 'text-lg' : 'text-2xl'
                  )}
                >
                  {value}
                </p>
                {trend && (
                  <Badge variant="secondary" className="text-[10px] h-4">
                    {trend}
                  </Badge>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div
            className={cn(
              'rounded-lg p-2.5',
              variant === 'default' && 'bg-navy-50',
              variant === 'destructive' && 'bg-destructive/10',
              variant === 'warning' && 'bg-warning-100'
            )}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  filterType: FilterType;
}

function EmptyState({ filterType }: EmptyStateProps): React.ReactElement {
  const filterLabel = FILTER_OPTIONS.find(f => f.type === filterType)?.label.toLowerCase();
  
  return (
    <Card className="py-16">
      <CardContent className="flex flex-col items-center justify-center text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <Filter className="size-8 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-lg font-medium">No intakes found</h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          {filterType === 'ALL' 
            ? 'The queue is currently empty. New patient submissions will appear here automatically.'
            : `No intakes match the "${filterLabel}" filter. Try selecting a different filter.`
          }
        </p>
      </CardContent>
    </Card>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps): React.ReactElement {
  return (
    <Card className="py-16 border-destructive/20 bg-destructive/5">
      <CardContent className="flex flex-col items-center justify-center text-center">
        <div className="mb-4 rounded-full bg-destructive/10 p-4">
          <AlertCircle className="size-8 text-destructive" />
        </div>
        <h3 className="mb-2 text-lg font-medium">Error loading queue</h3>
        <p className="mb-4 max-w-sm text-sm text-muted-foreground">{message}</p>
        <Button onClick={onRetry} variant="outline">
          <RefreshCw className="size-4 mr-2" />
          Try Again
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Export Types
// ============================================================================

export type { EnhancedQueueClientProps, EnhancedQueueStats, FilterType, SortType, ViewMode };
