/**
 * PatientTable Component
 * 
 * Displays patients in a searchable, sortable table with pagination.
 * 
 * @module components/physician/PatientTable
 */

'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/Skeleton';
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Filter,
  Download,
} from 'lucide-react';
import type { PhysicianPatientListItem, PatientFilters } from '@/types/physician-dashboard';
import { PatientStatusBadge, RiskBadge } from '@/components/shared/StatusBadge';
import { TREATMENT_TYPE_LABELS } from '@/types/physician-dashboard';

// ============================================================================
// Types
// ============================================================================

interface PatientTableProps {
  patients: PhysicianPatientListItem[];
  pageSize?: number;
  isLoading?: boolean;
  className?: string;
}

type SortColumn = 'name' | 'age' | 'lastVisitAt' | 'status';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  column: SortColumn;
  direction: SortDirection;
}

// ============================================================================
// Sort Indicator Component (defined outside to avoid recreating during render)
// ============================================================================

interface SortIndicatorProps {
  column: SortColumn;
  currentColumn: SortColumn;
  direction: SortDirection;
}

function SortIndicator({ column, currentColumn, direction }: SortIndicatorProps) {
  if (currentColumn !== column) {
    return <ArrowUpDown className="w-3 h-3 text-muted-foreground ml-1" />;
  }
  return direction === 'asc' ? (
    <ArrowUp className="w-3 h-3 text-foreground ml-1" />
  ) : (
    <ArrowDown className="w-3 h-3 text-foreground ml-1" />
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get concern badge for treatment type
 */
function ConcernBadge({ type }: { type: string }) {
  const labels: Record<string, { label: string; className: string }> = {
    ALCOHOL: { label: 'Alcohol', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    SMOKING: { label: 'Discontinued', className: 'bg-gray-100 text-gray-600 border-gray-200' },
    BOTH: { label: 'Both', className: 'bg-purple-100 text-purple-800 border-purple-200' },
  };

  const config = labels[type] || { label: type, className: 'bg-gray-100 text-gray-800' };

  return (
    <Badge variant="outline" className={cn('text-xs font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}

/**
 * Format date for display
 */
function formatDate(date: Date | undefined): string {
  if (!date) return 'Never';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get initials from name
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function TableSkeleton({ pageSize = 20 }: { pageSize?: number }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Search bar skeleton */}
          <div className="flex gap-3">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-32" />
          </div>
          
          {/* Table skeleton */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/50 p-3 grid grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-4" />
              ))}
            </div>
            <div className="divide-y">
              {[...Array(Math.min(5, pageSize))].map((_, i) => (
                <div key={i} className="p-3 grid grid-cols-6 gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * PatientTable displays patients in a searchable, sortable table with pagination
 * 
 * Features:
 * - Search by name or email
 * - Sort by name, age, or last visit
 * - Pagination (20 per page)
 * - Click row to view patient detail
 * - Loading state with skeleton
 */
export function PatientTable({
  patients,
  pageSize = 20,
  isLoading = false,
  className,
}: PatientTableProps): React.ReactElement {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sort, setSort] = useState<SortConfig>({ column: 'name', direction: 'asc' });
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Filter and sort patients
  const filteredPatients = useMemo(() => {
    let result = [...patients];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.emailMasked.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter && statusFilter !== 'ALL') {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sort.column) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'age':
          comparison = a.age - b.age;
          break;
        case 'lastVisitAt':
          const aDate = a.lastVisitAt ? new Date(a.lastVisitAt).getTime() : 0;
          const bDate = b.lastVisitAt ? new Date(b.lastVisitAt).getTime() : 0;
          comparison = aDate - bDate;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sort.direction === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [patients, searchQuery, statusFilter, sort]);

  // Pagination
  const totalPages = Math.ceil(filteredPatients.length / pageSize);
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPatients.slice(start, start + pageSize);
  }, [filteredPatients, currentPage, pageSize]);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sort.column, sort.direction]);

  // Handle sort toggle
  const handleSort = (column: SortColumn) => {
    setSort((prev) => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };



  if (isLoading) {
    return <TableSkeleton pageSize={pageSize} />;
  }

  return (
    <Card className={className}>
      <CardContent className="p-6">
        {/* Header with search and filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">
            Showing {paginatedPatients.length} of {filteredPatients.length} patients
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                  <div className="flex items-center">
                    Name
                    <SortIndicator column="name" currentColumn={sort.column} direction={sort.direction} />
                  </div>
                </TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('age')}>
                  <div className="flex items-center">
                    Age
                    <SortIndicator column="age" currentColumn={sort.column} direction={sort.direction} />
                  </div>
                </TableHead>
                <TableHead>Concern</TableHead>
                <TableHead className="cursor-pointer" onClick={() => handleSort('lastVisitAt')}>
                  <div className="flex items-center">
                    Last Visit
                    <SortIndicator column="lastVisitAt" currentColumn={sort.column} direction={sort.direction} />
                  </div>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPatients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">No patients found</p>
                    <p className="text-sm mt-1">
                      {searchQuery
                        ? `No patients match "${searchQuery}"`
                        : 'Try adjusting your filters'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPatients.map((patient) => (
                  <TableRow
                    key={patient.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/physician/patients/${patient.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-ocean-100 flex items-center justify-center text-sm font-medium text-ocean-700">
                          {getInitials(patient.name)}
                        </div>
                        <div>
                          <p className="font-medium">{patient.name}</p>
                          <p className="text-xs text-muted-foreground">{patient.gender}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {patient.emailMasked}
                    </TableCell>
                    <TableCell>{patient.age}</TableCell>
                    <TableCell>
                      <ConcernBadge type={patient.treatmentType} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(patient.lastVisitAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/physician/patients/${patient.id}`);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PatientTable;
