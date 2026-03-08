/**
 * Physician Detail Page
 *
 * Detailed view of a single physician including credentials,
 * authorization history, activity statistics, and recent activity.
 *
 * Fetches data directly from the database via Prisma (server component).
 *
 * @module app/admin/physicians/[id]/page
 */

import * as React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  RefreshCw,
  Key,
  Users,
  Clock,
  FileText,
  Activity,
  AlertCircle,
  Mail,
  Calendar,
  Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PhysicianStatus, ReviewDecision, AuthorizationAction } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// ============================================================================
// Metadata
// ============================================================================

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const physician = await getPhysician(id);

  if (!physician) {
    return {
      title: 'Physician Not Found | Admin Panel',
    };
  }

  return {
    title: `${physician.firstName} ${physician.lastName} | Admin Panel`,
    description: `Physician details for ${physician.firstName} ${physician.lastName}`,
  };
}

// ============================================================================
// Types
// ============================================================================

interface PhysicianDetail {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  npiNumber: string;
  licenseNumber: string;
  licenseState: string;
  deaNumber: string | null;
  specialty: string | null;
  status: PhysicianStatus;
  isActive: boolean;
  maxDailyReviews: number;
  totalReviews: number;
  avgReviewTimeMin: number | null;
  createdAt: Date;
  authorizedAt: Date | null;
  secretKeyUsedAt: Date | null;
  lastActiveAt: Date | null;
}

interface AuthorizationLogEntry {
  id: string;
  action: AuthorizationAction;
  adminId: string;
  reason: string | null;
  createdAt: Date;
  ipAddress: string | null;
}

interface ReviewActivity {
  id: string;
  intakeId: string;
  decision: ReviewDecision | null;
  completedAt: Date | null;
  startedAt: Date | null;
  reviewDurationMin: number | null;
}

// ============================================================================
// Data Fetching
// ============================================================================

async function getPhysician(id: string): Promise<PhysicianDetail | null> {
  const physician = await prisma.physician.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          email: true,
          lastLoginAt: true,
        },
      },
    },
  });

  if (!physician) return null;

  return {
    id: physician.id,
    userId: physician.userId,
    firstName: physician.firstName,
    lastName: physician.lastName,
    email: physician.user.email,
    npiNumber: physician.npiNumber,
    licenseNumber: physician.licenseNumber,
    licenseState: physician.licenseState,
    deaNumber: physician.deaNumber,
    specialty: physician.specialty,
    status: physician.status,
    isActive: physician.isActive,
    maxDailyReviews: physician.maxDailyReviews,
    totalReviews: physician.totalReviews,
    avgReviewTimeMin: physician.avgReviewTimeMin,
    createdAt: physician.createdAt,
    authorizedAt: physician.authorizedAt,
    secretKeyUsedAt: physician.secretKeyUsedAt,
    lastActiveAt: physician.user.lastLoginAt,
  };
}

async function getAuthorizationLogs(physicianId: string): Promise<AuthorizationLogEntry[]> {
  const logs = await prisma.physicianAuthorizationLog.findMany({
    where: { physicianId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    adminId: log.adminId,
    reason: log.reason,
    createdAt: log.createdAt,
    ipAddress: log.ipAddress,
  }));
}

async function getReviewActivity(physicianId: string): Promise<ReviewActivity[]> {
  const reviews = await prisma.review.findMany({
    where: { physicianId },
    orderBy: { assignedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      intakeId: true,
      decision: true,
      completedAt: true,
      startedAt: true,
    },
  });

  return reviews.map((review) => {
    let reviewDurationMin: number | null = null;
    if (review.startedAt && review.completedAt) {
      reviewDurationMin = Math.round(
        (review.completedAt.getTime() - review.startedAt.getTime()) / 60000
      );
    }

    return {
      id: review.id,
      intakeId: review.intakeId,
      decision: review.decision,
      completedAt: review.completedAt,
      startedAt: review.startedAt,
      reviewDurationMin,
    };
  });
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

function CredentialsCard({ physician }: { physician: PhysicianDetail }): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Award className="w-5 h-5" />
          Credentials
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">NPI Number</p>
            <p className="font-medium font-mono">{physician.npiNumber}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">License Number</p>
            <p className="font-medium font-mono">{physician.licenseNumber}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">License State</p>
            <p className="font-medium">{physician.licenseState}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">DEA Number</p>
            <p className="font-medium font-mono">{physician.deaNumber || 'N/A'}</p>
          </div>
        </div>

        {physician.specialty && (
          <>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Specialty</p>
              <p className="font-medium">{physician.specialty}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AuthorizationTimeline({ logs }: { logs: AuthorizationLogEntry[] }): React.ReactElement {
  const actionConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    INVITED: { icon: Mail, color: 'bg-blue-100 text-blue-600', label: 'Invited' },
    AUTHORIZED: { icon: CheckCircle, color: 'bg-green-100 text-green-600', label: 'Authorized' },
    REJECTED: { icon: XCircle, color: 'bg-red-100 text-red-600', label: 'Rejected' },
    SUSPENDED: { icon: AlertCircle, color: 'bg-amber-100 text-amber-600', label: 'Suspended' },
    REACTIVATED: { icon: RefreshCw, color: 'bg-green-100 text-green-600', label: 'Reactivated' },
    SECRET_KEY_RESET: { icon: Key, color: 'bg-purple-100 text-purple-600', label: 'Secret Key Reset' },
  };

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Authorization History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No authorization history available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Authorization History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {logs.map((log, index) => {
            const config = actionConfig[log.action] || {
              icon: Activity,
              color: 'bg-gray-100 text-gray-600',
              label: log.action,
            };
            const Icon = config.icon;
            const isLast = index === logs.length - 1;

            return (
              <div key={log.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={cn('p-2 rounded-full', config.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {!isLast && <div className="w-0.5 flex-1 bg-gray-200 my-2" />}
                </div>
                <div className={cn('flex-1', !isLast && 'pb-6')}>
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{config.label}</p>
                    <span className="text-sm text-muted-foreground">
                      {log.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Admin: {log.adminId.slice(0, 8)}...
                    {log.ipAddress && ` \u2022 IP: ${log.ipAddress}`}
                  </p>
                  {log.reason && (
                    <p className="text-sm text-muted-foreground mt-1 italic">Reason: {log.reason}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityStats({ physician }: { physician: PhysicianDetail }): React.ReactElement {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Total Reviews</p>
          <p className="text-2xl font-bold">{physician.totalReviews}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Avg Review Time</p>
          <p className="text-2xl font-bold">
            {physician.avgReviewTimeMin ? `${physician.avgReviewTimeMin}m` : 'N/A'}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Daily Limit</p>
          <p className="text-2xl font-bold">{physician.maxDailyReviews}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Last Active</p>
          <p className="text-2xl font-bold text-sm">
            {physician.lastActiveAt ? physician.lastActiveAt.toLocaleDateString() : 'Never'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function RecentReviews({ reviews }: { reviews: ReviewActivity[] }): React.ReactElement {
  const decisionConfig: Record<ReviewDecision, { label: string; className: string }> = {
    [ReviewDecision.APPROVE]: { label: 'Approved', className: 'bg-green-100 text-green-800' },
    [ReviewDecision.REJECT]: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
    [ReviewDecision.NEEDS_INFO]: { label: 'Needs Info', className: 'bg-amber-100 text-amber-800' },
  };

  if (reviews.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No reviews completed yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Recent Reviews
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Intake ID</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.map((review) => (
              <TableRow key={review.id}>
                <TableCell className="font-mono text-sm">
                  {review.intakeId.slice(0, 8)}...
                </TableCell>
                <TableCell>
                  {review.decision ? (
                    <Badge variant="outline" className={decisionConfig[review.decision].className}>
                      {decisionConfig[review.decision].label}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-100 text-gray-800">
                      In Progress
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {review.completedAt
                    ? review.completedAt.toLocaleDateString()
                    : 'Pending'}
                </TableCell>
                <TableCell className="text-right">
                  {review.reviewDurationMin ? `${review.reviewDurationMin}m` : 'N/A'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default async function PhysicianDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactElement> {
  const { id } = await params;
  const physician = await getPhysician(id);

  if (!physician) {
    notFound();
  }

  const initials = `${physician.firstName[0]}${physician.lastName[0]}`.toUpperCase();
  const [authorizationLogs, recentReviews] = await Promise.all([
    getAuthorizationLogs(id),
    getReviewActivity(id),
  ]);

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/admin/physicians"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to Physicians
      </Link>

      {/* Profile Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg bg-ocean-100 text-ocean-700">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">
                {physician.firstName} {physician.lastName}
              </h1>
              <PhysicianStatusBadge status={physician.status} />
            </div>
            <p className="text-muted-foreground">
              {physician.specialty || 'General Practice'} &bull; Physician ID: {physician.id.slice(0, 12)}...
            </p>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Mail className="w-4 h-4" />
                {physician.email}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                Joined {physician.createdAt.toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {physician.status === PhysicianStatus.PENDING && (
            <>
              <Button className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4 mr-2" />
                Authorize
              </Button>
              <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </>
          )}
          {physician.status === PhysicianStatus.ACTIVE && (
            <Button variant="outline" className="border-amber-200 text-amber-600 hover:bg-amber-50">
              <XCircle className="w-4 h-4 mr-2" />
              Suspend
            </Button>
          )}
          {physician.status === PhysicianStatus.INACTIVE && (
            <Button variant="outline" className="border-green-200 text-green-600 hover:bg-green-50">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reactivate
            </Button>
          )}
          {(physician.status === PhysicianStatus.ACTIVE || physician.status === PhysicianStatus.INACTIVE) && (
            <Button variant="outline">
              <Key className="w-4 h-4 mr-2" />
              Reset Secret Key
            </Button>
          )}
        </div>
      </div>

      {/* Activity Stats */}
      <ActivityStats physician={physician} />

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <CredentialsCard physician={physician} />
            <AuthorizationTimeline logs={authorizationLogs} />
          </div>
        </TabsContent>

        {/* Reviews Tab */}
        <TabsContent value="reviews">
          <RecentReviews reviews={recentReviews} />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <AuthorizationTimeline logs={authorizationLogs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
