/**
 * PrescriptionList Component
 * 
 * Displays and manages prescriptions for physicians.
 * Includes filtering, status tracking, and refill management.
 * 
 * @module components/physician/PrescriptionList
 */

'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  Filter,
  RefreshCw,
  Pill,
  ChevronRight,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  MoreHorizontal,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import { PhysicianPrescriptionListItem } from '@/types/physician-dashboard';
import { PrescriptionStatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { PrescriptionStatus } from '@prisma/client';

// ============================================================================
// Props Interface
// ============================================================================

interface PrescriptionListProps {
  /** List of prescriptions to display */
  prescriptions: PhysicianPrescriptionListItem[];
  /** Callback when a prescription is clicked */
  onPrescriptionClick?: (prescription: PhysicianPrescriptionListItem) => void;
  /** Callback when refresh is requested */
  onRefresh?: () => void;
  /** Callback to send prescription to pharmacy */
  onSendToPharmacy?: (prescriptionId: string) => void | Promise<void>;
  /** Callback to set/update the pharmacy on a prescription that has none */
  onSetPharmacy?: (prescriptionId: string) => void;
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

interface PrescriptionFilters {
  status?: PrescriptionStatus | 'ALL';
  searchQuery?: string;
  sortBy: 'prescribedAt' | 'patientName' | 'status';
  sortOrder: 'asc' | 'desc';
}

/**
 * Filter and sort prescriptions
 */
function filterAndSortPrescriptions(
  prescriptions: PhysicianPrescriptionListItem[],
  filters: PrescriptionFilters
): PhysicianPrescriptionListItem[] {
  let result = [...prescriptions];

  // Filter by status
  if (filters.status && filters.status !== 'ALL') {
    result = result.filter((p) => p.status === filters.status);
  }

  // Filter by search query
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    result = result.filter(
      (p) =>
        (p.patientName || '').toLowerCase().includes(query) ||
        (p.medicationName || '').toLowerCase().includes(query) ||
        (p.genericName || '').toLowerCase().includes(query)
    );
  }

  // Sort prescriptions
  result.sort((a, b) => {
    let comparison = 0;
    switch (filters.sortBy) {
      case 'prescribedAt':
        comparison = new Date(b.prescribedAt).getTime() - new Date(a.prescribedAt).getTime();
        break;
      case 'patientName':
        comparison = (a.patientName || '').localeCompare(b.patientName || '');
        break;
      case 'status':
        comparison = (a.status || '').localeCompare(b.status || '');
        break;
    }
    return filters.sortOrder === 'asc' ? comparison : -comparison;
  });

  return result;
}

/**
 * Format date relative to now
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================================================
// Component
// ============================================================================

/**
 * PrescriptionList displays prescriptions with filtering and sorting
 * 
 * @example
 * ```tsx
 * <PrescriptionList
 *   prescriptions={prescriptions}
 *   onPrescriptionClick={(rx) => router.push(`/physician/prescriptions/${rx.id}`)}
 *   onSendToPharmacy={async (id) => await sendToPharmacy(id)}
 * />
 * ```
 */
export function PrescriptionList({
  prescriptions,
  onPrescriptionClick,
  onRefresh,
  onSendToPharmacy,
  onSetPharmacy,
  isLoading = false,
  className,
  compact = false,
}: PrescriptionListProps) {
  const [filters, setFilters] = useState<PrescriptionFilters>({
    status: 'ALL',
    sortBy: 'prescribedAt',
    sortOrder: 'desc',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());

  // Apply search to filters
  const activeFilters = useMemo(
    () => ({ ...filters, searchQuery: searchQuery || undefined }),
    [filters, searchQuery]
  );

  // Filter and sort prescriptions
  const filteredPrescriptions = useMemo(
    () => filterAndSortPrescriptions(prescriptions, activeFilters),
    [prescriptions, activeFilters]
  );

  // Stats
  const stats = useMemo(() => {
    return {
      total: prescriptions.length,
      pending: prescriptions.filter((p) => p.status === 'PENDING').length,
      sent: prescriptions.filter((p) => p.status === 'SENT').length,
      ready: prescriptions.filter((p) => p.status === 'READY_FOR_PICKUP').length,
    };
  }, [prescriptions]);

  // Handle send to pharmacy
  const handleSendToPharmacy = async (prescriptionId: string) => {
    if (!onSendToPharmacy) return;
    setSendingIds((prev) => new Set(prev).add(prescriptionId));
    try {
      await onSendToPharmacy(prescriptionId);
    } finally {
      setSendingIds((prev) => {
        const next = new Set(prev);
        next.delete(prescriptionId);
        return next;
      });
    }
  };

  // Sort toggle handler
  const toggleSort = (column: PrescriptionFilters['sortBy']) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'desc' ? 'asc' : 'desc',
    }));
  };

  if (compact) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Pill className="w-5 h-5" />
              Recent Prescriptions
              {stats.total > 0 && (
                <Badge variant="secondary">{stats.total}</Badge>
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
          {filteredPrescriptions.length === 0 ? (
            <EmptyState
              title="No prescriptions"
              description="No prescriptions have been written yet."
              icon="pill"
              compact
              className="py-6"
            />
          ) : (
            <div className="divide-y">
              {filteredPrescriptions.slice(0, 5).map((rx) => (
                <button
                  key={rx.id}
                  onClick={() => onPrescriptionClick?.(rx)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Pill className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{rx.medicationName}</p>
                      <p className="text-xs text-muted-foreground">
                        {rx.dosage} • {rx.patientName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <PrescriptionStatusBadge status={rx.status} size="sm" />
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
              {filteredPrescriptions.length > 5 && (
                <div className="p-3 text-center">
                  <Button variant="ghost" size="sm" className="text-sm">
                    View all {filteredPrescriptions.length} prescriptions
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
    <div className={className}>
      {/* Stats are rendered by PhysicianPrescriptionsClient — don't duplicate here. */}

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Pill className="w-6 h-6" />
                Prescriptions
              </CardTitle>
              <CardDescription>
                Manage and track patient prescriptions
              </CardDescription>
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

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="prescription-search"
                name="prescription-search"
                placeholder="Search by patient or medication..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {showFilters && (
              <Select
                name="prescription-status-filter"
                value={filters.status}
                onValueChange={(value) =>
                  setFilters((prev) => ({ ...prev, status: value as PrescriptionFilters['status'] }))
                }
              >
                <SelectTrigger id="prescription-status-filter" className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="SENT">Sent</SelectItem>
                  <SelectItem value="RECEIVED_BY_PHARMACY">At Pharmacy</SelectItem>
                  <SelectItem value="FILLED">Filled</SelectItem>
                  <SelectItem value="READY_FOR_PICKUP">Ready</SelectItem>
                  <SelectItem value="PICKED_UP">Picked Up</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Prescriptions Table */}
      {filteredPrescriptions.length === 0 ? (
        <EmptyState
          title="No prescriptions found"
          description={
            searchQuery
              ? `No prescriptions match "${searchQuery}"`
              : "There are no prescriptions to display."
          }
          icon="search"
          actionLabel={searchQuery ? 'Clear search' : undefined}
          onAction={searchQuery ? () => setSearchQuery('') : undefined}
          className="py-12"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">
                      <button
                        onClick={() => toggleSort('patientName')}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        Patient
                      </button>
                    </TableHead>
                    <TableHead>Medication</TableHead>
                    <TableHead className="hidden lg:table-cell">Pharmacy</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Refills</TableHead>
                    <TableHead>
                      <button
                        onClick={() => toggleSort('prescribedAt')}
                        className="flex items-center gap-1 hover:text-foreground"
                      >
                        Date
                      </button>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrescriptions.map((rx) => (
                    <TableRow
                      key={rx.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onPrescriptionClick?.(rx)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3 max-w-[250px]">
                          <div className="w-8 h-8 rounded-full bg-ocean-100 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-ocean-600" />
                          </div>
                          <span className="font-medium truncate">{rx.patientName}</span>
                          <Link
                            href={`/physician/patients/${rx.patientId}`}
                            className="text-sm text-ocean-500 hover:underline ml-auto shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View Profile
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px]">
                          <p className="font-medium truncate">{rx.medicationName}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {rx.dosage}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {rx.pharmacyName && rx.pharmacyName !== 'Pending' ? (
                          <div className="max-w-[220px]">
                            <p className="text-sm font-medium truncate" title={rx.pharmacyName}>
                              {rx.pharmacyName}
                            </p>
                            {rx.pharmacyAddress && (
                              <p className="text-xs text-muted-foreground truncate" title={rx.pharmacyAddress}>
                                {rx.pharmacyAddress}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <PrescriptionStatusBadge status={rx.status} />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {rx.refillsRemaining} / {rx.refillsRemaining + 1}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(rx.prescribedAt)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {rx.status === 'PENDING' && rx.pharmacyName === 'Pending' && onSetPharmacy && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSetPharmacy(rx.id);
                            }}
                          >
                            Set Pharmacy
                          </Button>
                        )}
                        {rx.status === 'PENDING' && rx.pharmacyName !== 'Pending' && onSendToPharmacy && (
                          <Button
                            size="sm"
                            disabled={sendingIds.has(rx.id)}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendToPharmacy(rx.id);
                            }}
                          >
                            <Send className="w-4 h-4 mr-1" />
                            {sendingIds.has(rx.id) ? 'Sending...' : 'Send'}
                          </Button>
                        )}
                        {rx.status !== 'PENDING' && (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
