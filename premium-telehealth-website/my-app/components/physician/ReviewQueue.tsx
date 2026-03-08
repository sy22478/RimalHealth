/**
 * ReviewQueue Component
 * 
 * Displays and manages the intake review queue for physicians.
 * Shows pending reviews with filtering, sorting, and quick actions.
 * 
 * @module components/physician/ReviewQueue
 */

'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Search,
  Clock,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  Filter,
  User,
  FileText,
  ArrowUpDown,
  ClipboardList,
} from 'lucide-react';
import {
  ReviewQueueItem,
  ReviewQueueFilters,
  ReviewQueueStats,
  TREATMENT_TYPE_LABELS,
  formatWaitTime,
  getRiskLevelFromScore,
} from '@/types/physician-dashboard';
import { RiskBadge, ReviewStatusBadge, OverdueBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';

// ============================================================================
// Props Interface
// ============================================================================

interface ReviewQueueProps {
  /** Queue items to display */
  items: ReviewQueueItem[];
  /** Queue statistics */
  stats: ReviewQueueStats;
  /** Callback when an item is clicked */
  onItemClick?: (item: ReviewQueueItem) => void;
  /** Callback when refresh is requested */
  onRefresh?: () => void;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show compact view (for dashboard) */
  compact?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Filter and sort queue items
 */
function filterAndSortItems(
  items: ReviewQueueItem[],
  filters: ReviewQueueFilters
): ReviewQueueItem[] {
  let result = [...items];

  // Filter by treatment type
  if (filters.treatmentType && filters.treatmentType !== 'ALL') {
    result = result.filter((item) => item.treatmentType === filters.treatmentType);
  }

  // Filter by status
  if (filters.status && filters.status !== 'ALL') {
    result = result.filter((item) => item.status === filters.status);
  }

  // Filter by risk level
  if (filters.riskLevel && filters.riskLevel !== 'ALL') {
    result = result.filter((item) => item.riskLevel === filters.riskLevel);
  }

  // Filter by search query
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    result = result.filter((item) =>
      item.patientName.toLowerCase().includes(query)
    );
  }

  // Sort items
  result.sort((a, b) => {
    let comparison = 0;
    switch (filters.sortBy) {
      case 'submittedAt':
        comparison = new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
        break;
      case 'waitTimeHours':
        comparison = a.waitTimeHours - b.waitTimeHours;
        break;
      case 'patientName':
        comparison = a.patientName.localeCompare(b.patientName);
        break;
      case 'riskScore':
        comparison = (a.riskScore || 0) - (b.riskScore || 0);
        break;
    }
    return filters.sortOrder === 'desc' ? -comparison : comparison;
  });

  return result;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ReviewQueue displays the intake review queue with filtering and sorting
 * 
 * @example
 * ```tsx
 * <ReviewQueue
 *   items={queueItems}
 *   stats={queueStats}
 *   onItemClick={(item) => router.push(`/physician/reviews/${item.intakeId}`)}
 *   onRefresh={() => refetch()}
 * />
 * ```
 */
export function ReviewQueue({
  items,
  stats,
  onItemClick,
  onRefresh,
  isLoading = false,
  className,
  compact = false,
}: ReviewQueueProps) {
  const [filters, setFilters] = useState<ReviewQueueFilters>({
    treatmentType: 'ALL',
    status: 'ALL',
    riskLevel: 'ALL',
    sortBy: 'submittedAt',
    sortOrder: 'asc',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Apply search to filters
  const activeFilters = useMemo(
    () => ({ ...filters, searchQuery: searchQuery || undefined }),
    [filters, searchQuery]
  );

  // Filter and sort items
  const filteredItems = useMemo(
    () => filterAndSortItems(items, activeFilters),
    [items, activeFilters]
  );

  // Sort toggle handler
  const toggleSort = (column: ReviewQueueFilters['sortBy']) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  if (compact) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Review Queue
              {stats.totalPending > 0 && (
                <Badge variant="secondary">{stats.totalPending}</Badge>
              )}
            </CardTitle>
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredItems.length === 0 ? (
            <EmptyState
              title="No pending reviews"
              description="All caught up! Check back later for new submissions."
              icon="clipboard"
              compact
              className="py-6"
            />
          ) : (
            <div className="divide-y">
              {filteredItems.slice(0, 5).map((item) => (
                <button
                  key={item.intakeId}
                  onClick={() => onItemClick?.(item)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-ocean-100 flex items-center justify-center">
                      <span className="text-sm font-semibold text-ocean-700">
                        {item.patientName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.patientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {TREATMENT_TYPE_LABELS[item.treatmentType]} • {item.patientAge}y
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <OverdueBadge hours={item.waitTimeHours} />
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
              {filteredItems.length > 5 && (
                <div className="p-3 text-center">
                  <Button variant="ghost" size="sm" className="text-sm">
                    View all {filteredItems.length} reviews
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <ClipboardList className="w-6 h-6" />
              Review Queue
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.totalPending} pending • {stats.overdueCount} overdue • {stats.highRiskCount} high risk
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
                Refresh
              </Button>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {showFilters && (
            <>
              <Select
                value={filters.treatmentType}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, treatmentType: value as ReviewQueueFilters['treatmentType'] }))
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Types</SelectItem>
                  <SelectItem value="ALCOHOL">Alcohol</SelectItem>
                  <SelectItem value="BOTH">Both</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.riskLevel}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, riskLevel: value as ReviewQueueFilters['riskLevel'] }))
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Risk" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Risk</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MODERATE">Moderate</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="SEVERE">Severe</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {filteredItems.length === 0 ? (
          <EmptyState
            title="No reviews found"
            description="Try adjusting your filters or check back later for new submissions."
            icon="search"
            actionLabel={searchQuery ? "Clear search" : undefined}
            onAction={searchQuery ? () => setSearchQuery('') : undefined}
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">
                    <button
                      onClick={() => toggleSort('patientName')}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Patient
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>
                    <button
                      onClick={() => toggleSort('waitTimeHours')}
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      Wait Time
                      <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow
                    key={item.intakeId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onItemClick?.(item)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-ocean-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-ocean-600" />
                        </div>
                        <div>
                          <p className="font-medium">{item.patientName}</p>
                          <p className="text-sm text-muted-foreground">{item.patientAge} years</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TREATMENT_TYPE_LABELS[item.treatmentType]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <RiskBadge level={item.riskLevel} score={item.riskScore} />
                    </TableCell>
                    <TableCell>
                      <OverdueBadge hours={item.waitTimeHours} />
                    </TableCell>
                    <TableCell>
                      <ReviewStatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        Review
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
