/**
 * PatientList Component
 * 
 * Displays a searchable, filterable list of patients for physicians.
 * Includes patient cards with quick actions and status indicators.
 * 
 * @module components/physician/PatientList
 */

'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Users,
  ArrowUpDown,
  Mail,
  Pill,
  FileText,
  MoreHorizontal,
} from 'lucide-react';
import {
  PhysicianPatientListItem,
  PatientFilters,
  TREATMENT_TYPE_LABELS,
} from '@/types/physician-dashboard';
import { PatientStatusBadge, RiskBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { PatientCard } from './PatientCard';

// ============================================================================
// Props Interface
// ============================================================================

interface PatientListProps {
  /** List of patients to display */
  patients: PhysicianPatientListItem[];
  /** Callback when a patient is clicked */
  onPatientClick?: (patient: PhysicianPatientListItem) => void;
  /** Callback when refresh is requested */
  onRefresh?: () => void;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** View mode */
  viewMode?: 'grid' | 'list';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Filter and sort patients
 */
function filterAndSortPatients(
  patients: PhysicianPatientListItem[],
  filters: PatientFilters
): PhysicianPatientListItem[] {
  let result = [...patients];

  // Filter by treatment type
  if (filters.treatmentType && filters.treatmentType !== 'ALL') {
    result = result.filter((p) => p.treatmentType === filters.treatmentType);
  }

  // Filter by status
  if (filters.status && filters.status !== 'ALL') {
    result = result.filter((p) => p.status === filters.status);
  }

  // Filter by risk level
  if (filters.riskLevel && filters.riskLevel !== 'ALL') {
    result = result.filter((p) => p.riskLevel === filters.riskLevel);
  }

  // Filter by search query
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    result = result.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(query) ||
        (p.emailMasked || '').toLowerCase().includes(query)
    );
  }

  // Sort patients
  result.sort((a, b) => {
    let comparison = 0;
    switch (filters.sortBy) {
      case 'name':
        comparison = (a.name || '').localeCompare(b.name || '');
        break;
      case 'enrolledAt':
        comparison = new Date(a.enrolledAt).getTime() - new Date(b.enrolledAt).getTime();
        break;
      case 'lastVisitAt':
        const aDate = a.lastVisitAt ? new Date(a.lastVisitAt).getTime() : 0;
        const bDate = b.lastVisitAt ? new Date(b.lastVisitAt).getTime() : 0;
        comparison = aDate - bDate;
        break;
      case 'riskScore':
        const riskOrder = { SEVERE: 4, HIGH: 3, MODERATE: 2, LOW: 1 };
        comparison = riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
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
 * PatientList displays a filterable list of patients
 * 
 * @example
 * ```tsx
 * <PatientList
 *   patients={patients}
 *   onPatientClick={(patient) => router.push(`/physician/patients/${patient.id}`)}
 *   onRefresh={() => refetch()}
 *   viewMode="grid"
 * />
 * ```
 */
export function PatientList({
  patients,
  onPatientClick,
  onRefresh,
  isLoading = false,
  className,
  viewMode = 'grid',
}: PatientListProps) {
  const [filters, setFilters] = useState<PatientFilters>({
    treatmentType: 'ALL',
    status: 'ALL',
    riskLevel: 'ALL',
    sortBy: 'name',
    sortOrder: 'asc',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Apply search to filters
  const activeFilters = useMemo(
    () => ({ ...filters, searchQuery: searchQuery || undefined }),
    [filters, searchQuery]
  );

  // Filter and sort patients
  const filteredPatients = useMemo(
    () => filterAndSortPatients(patients, activeFilters),
    [patients, activeFilters]
  );

  // Stats
  const stats = useMemo(() => {
    return {
      total: patients.length,
      active: patients.filter((p) => p.status === 'ACTIVE').length,
      pending: patients.filter((p) => p.status === 'PENDING').length,
      highRisk: patients.filter((p) => p.riskLevel === 'HIGH' || p.riskLevel === 'SEVERE').length,
    };
  }, [patients]);

  // Sort toggle handler
  const toggleSort = (column: PatientFilters['sortBy']) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  if (filteredPatients.length === 0) {
    return (
      <div className={className}>
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
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

        <EmptyState
          title="No patients found"
          description={
            searchQuery
              ? `No patients match "${searchQuery}". Try a different search term.`
              : "There are no patients matching your current filters."
          }
          icon="search"
          actionLabel={searchQuery ? 'Clear search' : undefined}
          onAction={searchQuery ? () => setSearchQuery('') : undefined}
          className="py-16"
        />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">High Risk</p>
            <p className="text-2xl font-bold text-red-600">{stats.highRisk}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search patients by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleSort('name')}
          >
            <ArrowUpDown className="w-4 h-4 mr-2" />
            Sort
          </Button>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
            </Button>
          )}
        </div>
      </div>

      {/* Filter Options */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-6 p-4 bg-muted/50 rounded-lg">
          <Select
            value={filters.treatmentType}
            onValueChange={(value) =>
              setFilters((prev) => ({ ...prev, treatmentType: value as PatientFilters['treatmentType'] }))
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Treatment Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="ALCOHOL">Alcohol</SelectItem>
              <SelectItem value="BOTH">Both</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.status}
            onValueChange={(value) =>
              setFilters((prev) => ({ ...prev, status: value }))
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.riskLevel}
            onValueChange={(value) =>
              setFilters((prev) => ({ ...prev, riskLevel: value as PatientFilters['riskLevel'] }))
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Risk Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Risk Levels</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MODERATE">Moderate</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="SEVERE">Severe</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilters({
                treatmentType: 'ALL',
                status: 'ALL',
                riskLevel: 'ALL',
                sortBy: 'name',
                sortOrder: 'asc',
              });
              setSearchQuery('');
            }}
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Results Count */}
      <p className="text-sm text-muted-foreground mb-4">
        Showing {filteredPatients.length} of {patients.length} patients
      </p>

      {/* Patient Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredPatients.map((patient) => (
          <PatientCard
            key={patient.id}
            patient={patient}
            onClick={() => onPatientClick?.(patient)}
          />
        ))}
      </div>
    </div>
  );
}
