/**
 * All Physicians List Page
 *
 * Displays all physicians in a searchable, filterable table
 * with status management and pagination.
 *
 * Data is fetched directly via Prisma (server component).
 *
 * @module app/admin/physicians/page
 */

import * as React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Users,
  Search,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PhysicianStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { PhysicianActionsMenu } from './PhysicianActionsMenu';

// ============================================================================
// Metadata
// ============================================================================

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Physicians | Admin Panel',
  description: 'Manage physicians and their authorization status',
};

// ============================================================================
// Types
// ============================================================================

interface PhysicianListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  npiNumber: string;
  licenseNumber: string;
  specialty: string | null;
  status: PhysicianStatus;
  createdAt: Date;
  authorizedAt: Date | null;
  lastActiveAt: Date | null;
  totalReviews: number;
}

// ============================================================================
// Data Fetching
// ============================================================================

async function fetchPhysicians(params: {
  status?: PhysicianStatus;
  search?: string;
  page: number;
  pageSize: number;
}): Promise<{
  physicians: PhysicianListItem[];
  total: number;
  allPhysicians: { status: PhysicianStatus }[];
}> {
  const where: Record<string, unknown> = {};

  if (params.status) {
    where.status = params.status;
  }

  if (params.search) {
    where.OR = [
      { firstName: { contains: params.search, mode: 'insensitive' } },
      { lastName: { contains: params.search, mode: 'insensitive' } },
      { npiNumber: { contains: params.search } },
      {
        user: {
          email: { contains: params.search, mode: 'insensitive' },
        },
      },
    ];
  }

  const [total, rawPhysicians, allStatuses] = await Promise.all([
    prisma.physician.count({ where }),
    prisma.physician.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            lastLoginAt: true,
          },
        },
        _count: {
          select: {
            reviews: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
    }),
    // Fetch all physicians' statuses for stats (no pagination)
    prisma.physician.findMany({
      select: { status: true },
    }),
  ]);

  const physicians: PhysicianListItem[] = rawPhysicians.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.user.email,
    npiNumber: p.npiNumber,
    licenseNumber: p.licenseNumber,
    specialty: p.specialty,
    status: p.status,
    createdAt: p.createdAt,
    authorizedAt: p.authorizedAt,
    lastActiveAt: p.user.lastLoginAt,
    totalReviews: p._count.reviews,
  }));

  return { physicians, total, allPhysicians: allStatuses };
}

// ============================================================================
// Status Badge Component
// ============================================================================

function PhysicianStatusBadge({ status }: { status: PhysicianStatus }): React.ReactElement {
  const config: Record<PhysicianStatus, { label: string; className: string; dotColor: string }> = {
    [PhysicianStatus.PENDING]: {
      label: 'Pending',
      className: 'bg-amber-100 text-amber-800 border-amber-200',
      dotColor: 'bg-amber-500',
    },
    [PhysicianStatus.INVITED]: {
      label: 'Invited',
      className: 'bg-blue-100 text-blue-800 border-blue-200',
      dotColor: 'bg-blue-500',
    },
    [PhysicianStatus.ACTIVE]: {
      label: 'Active',
      className: 'bg-green-100 text-green-800 border-green-200',
      dotColor: 'bg-green-500',
    },
    [PhysicianStatus.INACTIVE]: {
      label: 'Inactive',
      className: 'bg-red-100 text-red-800 border-red-200',
      dotColor: 'bg-red-500',
    },
  };

  const { label, className, dotColor } = config[status];

  return (
    <Badge variant="outline" className={cn('font-medium inline-flex items-center gap-1.5', className)}>
      <span className={cn('rounded-full w-2 h-2', dotColor)} />
      {label}
    </Badge>
  );
}

// ============================================================================
// Components
// ============================================================================

function PhysicianStats({ allPhysicians }: { allPhysicians: { status: PhysicianStatus }[] }): React.ReactElement {
  const stats = {
    total: allPhysicians.length,
    pending: allPhysicians.filter((p) => p.status === PhysicianStatus.PENDING).length,
    invited: allPhysicians.filter((p) => p.status === PhysicianStatus.INVITED).length,
    active: allPhysicians.filter((p) => p.status === PhysicianStatus.ACTIVE).length,
    inactive: allPhysicians.filter((p) => p.status === PhysicianStatus.INACTIVE).length,
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Total Physicians</p>
          <p className="text-2xl font-bold">{stats.total}</p>
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
          <p className="text-sm text-muted-foreground">Invited</p>
          <p className="text-2xl font-bold text-blue-600">{stats.invited}</p>
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
          <p className="text-sm text-muted-foreground">Inactive</p>
          <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function PhysiciansTable({
  physicians,
  currentPage,
  totalPages,
  total,
}: {
  physicians: PhysicianListItem[];
  currentPage: number;
  totalPages: number;
  total: number;
}): React.ReactElement {
  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>NPI</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {physicians.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No physicians found matching your criteria
                </TableCell>
              </TableRow>
            ) : (
              physicians.map((physician) => (
                <TableRow key={physician.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-ocean-100 text-ocean-700 text-sm">
                          {physician.firstName[0]}{physician.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {physician.firstName} {physician.lastName}
                        </p>
                        {physician.specialty && (
                          <p className="text-xs text-muted-foreground">{physician.specialty}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{physician.email}</TableCell>
                  <TableCell className="font-mono text-sm">{physician.npiNumber}</TableCell>
                  <TableCell>
                    <PhysicianStatusBadge status={physician.status} />
                  </TableCell>
                  <TableCell>
                    {physician.lastActiveAt ? (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        {getTimeAgo(physician.lastActiveAt)}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <PhysicianActionsMenu
                      physicianId={physician.id}
                      status={physician.status}
                      name={`${physician.firstName} ${physician.lastName}`.trim()}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {physicians.length} of {total} physicians
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            asChild={currentPage > 1}
          >
            {currentPage > 1 ? (
              <Link href={`/admin/physicians?page=${currentPage - 1}`}>
                <ChevronLeft className="h-4 w-4" />
              </Link>
            ) : (
              <span><ChevronLeft className="h-4 w-4" /></span>
            )}
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            asChild={currentPage < totalPages}
          >
            {currentPage < totalPages ? (
              <Link href={`/admin/physicians?page=${currentPage + 1}`}>
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span><ChevronRight className="h-4 w-4" /></span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Utilities
// ============================================================================

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// ============================================================================
// Main Page
// ============================================================================

interface PhysiciansPageProps {
  searchParams: Promise<{
    status?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function PhysiciansPage({ searchParams }: PhysiciansPageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const statusFilter = params.status as PhysicianStatus | undefined;
  const searchQuery = params.search || '';
  const currentPage = parseInt(params.page || '1', 10);
  const pageSize = 20;

  const { physicians, total, allPhysicians } = await fetchPhysicians({
    status: statusFilter,
    search: searchQuery || undefined,
    page: currentPage,
    pageSize,
  });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            Physicians
          </h1>
          <p className="text-muted-foreground">
            Manage physician accounts and authorizations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/physicians/pending">
              <Stethoscope className="w-4 h-4 mr-2" />
              View Pending Queue
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <PhysicianStats allPhysicians={allPhysicians} />

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filter Physicians</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Status Tabs */}
            <Tabs defaultValue={statusFilter || 'ALL'} className="w-full sm:w-auto">
              <TabsList>
                <TabsTrigger value="ALL" asChild>
                  <Link href="/admin/physicians">All</Link>
                </TabsTrigger>
                <TabsTrigger value="PENDING" asChild>
                  <Link href="/admin/physicians?status=PENDING">Pending</Link>
                </TabsTrigger>
                <TabsTrigger value="INVITED" asChild>
                  <Link href="/admin/physicians?status=INVITED">Invited</Link>
                </TabsTrigger>
                <TabsTrigger value="ACTIVE" asChild>
                  <Link href="/admin/physicians?status=ACTIVE">Active</Link>
                </TabsTrigger>
                <TabsTrigger value="INACTIVE" asChild>
                  <Link href="/admin/physicians?status=INACTIVE">Inactive</Link>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Search */}
            <form className="flex-1 max-w-md" method="GET">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  name="search"
                  placeholder="Search by name, email, or NPI..."
                  defaultValue={searchQuery}
                  className="pl-10"
                />
              </div>
              {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Physicians Table */}
      <PhysiciansTable
        physicians={physicians}
        currentPage={currentPage}
        totalPages={totalPages}
        total={total}
      />
    </div>
  );
}
