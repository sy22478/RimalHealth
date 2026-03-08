/**
 * Admin Dashboard Page
 * 
 * Main dashboard for administrators showing key metrics,
 * physician management overview, and recent admin activity.
 * 
 * @module app/admin/dashboard/page
 */

import * as React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { prisma } from '@/lib/db/prisma';
import { cn } from '@/lib/utils';
import type { AdminAction } from '@prisma/client';

import {
  Users,
  UserCheck,
  UserPlus,
  UserX,
  Stethoscope,
  ClipboardCheck,
  MessageSquare,
  Clock,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Mail,
  Ban,
  RefreshCw,
  Activity,
  ChevronRight,
} from 'lucide-react';

// ============================================================================
// Metadata
// ============================================================================

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard | Admin Portal',
  description: 'Administrative overview of the telehealth platform.',
};

// ============================================================================
// Types
// ============================================================================

interface AdminMetrics {
  pendingPhysicians: number;
  activePhysicians: number;
  invitedPhysicians: number;
  totalPatients: number;
  todaysReviews: number;
  unreadMessages: number;
}

interface AdminActivity {
  id: string;
  action: AdminAction;
  entityType: string;
  entityId: string | null;
  description: string;
  createdAt: Date;
  admin: {
    email: string;
  };
}

// ============================================================================
// Data Fetching
// ============================================================================

async function getAdminMetrics(): Promise<AdminMetrics> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      pendingPhysicians,
      activePhysicians,
      invitedPhysicians,
      totalPatients,
      todaysReviews,
      unreadMessages,
    ] = await Promise.all([
      // Pending Physicians
      prisma.physician.count({
        where: { status: 'PENDING' },
      }),
      // Active Physicians
      prisma.physician.count({
        where: { status: 'ACTIVE' },
      }),
      // Invited Physicians
      prisma.physician.count({
        where: { status: 'INVITED' },
      }),
      // Total Patients (users with PATIENT role)
      prisma.user.count({
        where: { role: 'PATIENT' },
      }),
      // Today's Reviews (completed today)
      prisma.review.count({
        where: {
          completedAt: {
            gte: today,
          },
        },
      }),
      // Unread Messages (physician-to-physician messages that are unread)
      prisma.physicianMessage.count({
        where: {
          isRead: false,
        },
      }),
    ]);

    return {
      pendingPhysicians,
      activePhysicians,
      invitedPhysicians,
      totalPatients,
      todaysReviews,
      unreadMessages,
    };
  } catch {
    // Return default values during build or if database is unavailable
    return {
      pendingPhysicians: 0,
      activePhysicians: 0,
      invitedPhysicians: 0,
      totalPatients: 0,
      todaysReviews: 0,
      unreadMessages: 0,
    };
  }
}

async function getRecentActivity(): Promise<AdminActivity[]> {
  try {
    const activities = await prisma.adminActivityLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    if (!Array.isArray(activities)) {
      return [];
    }

    // Fetch admin emails separately
    const adminIds = [...new Set(activities.map(a => a.adminId))];
    const admins = await prisma.user.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, email: true },
    });
    const adminEmailMap = new Map(admins.map(a => [a.id, a.email]));

    return activities.map((activity) => ({
      id: activity.id,
      action: activity.action,
      entityType: activity.entityType,
      entityId: activity.entityId,
      description: activity.description,
      createdAt: activity.createdAt,
      admin: { email: adminEmailMap.get(activity.adminId) || 'Unknown' },
    }));
  } catch {
    // Return empty array during build or if database is unavailable
    return [];
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getActivityIcon(action: AdminAction) {
  switch (action) {
    case 'PHYSICIAN_INVITE':
      return Mail;
    case 'PHYSICIAN_AUTHORIZE':
      return ShieldCheck;
    case 'PHYSICIAN_REJECT':
      return Ban;
    case 'PHYSICIAN_SUSPEND':
      return UserX;
    case 'PHYSICIAN_REACTIVATE':
      return RefreshCw;
    case 'SECRET_KEY_GENERATE':
      return Activity;
    case 'PATIENT_ACCESS':
      return Users;
    case 'SETTINGS_UPDATE':
      return CheckCircle2;
    case 'EXPORT_DATA':
      return ClipboardCheck;
    default:
      return Activity;
  }
}

function getActivityColor(action: AdminAction): string {
  switch (action) {
    case 'PHYSICIAN_AUTHORIZE':
    case 'PHYSICIAN_REACTIVATE':
      return 'bg-green-100 text-green-600';
    case 'PHYSICIAN_REJECT':
    case 'PHYSICIAN_SUSPEND':
      return 'bg-red-100 text-red-600';
    case 'PHYSICIAN_INVITE':
      return 'bg-blue-100 text-blue-600';
    case 'SECRET_KEY_GENERATE':
      return 'bg-amber-100 text-amber-600';
    case 'PATIENT_ACCESS':
      return 'bg-purple-100 text-purple-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function getActionLabel(action: AdminAction): string {
  switch (action) {
    case 'PHYSICIAN_INVITE':
      return 'Invited';
    case 'PHYSICIAN_AUTHORIZE':
      return 'Authorized';
    case 'PHYSICIAN_REJECT':
      return 'Rejected';
    case 'PHYSICIAN_SUSPEND':
      return 'Suspended';
    case 'PHYSICIAN_REACTIVATE':
      return 'Reactivated';
    case 'SECRET_KEY_GENERATE':
      return 'Reset Key';
    case 'PATIENT_ACCESS':
      return 'Accessed';
    case 'SETTINGS_UPDATE':
      return 'Updated';
    case 'EXPORT_DATA':
      return 'Exported';
    default:
      return action;
  }
}

// ============================================================================
// Components
// ============================================================================

/**
 * Metric Card Component
 */
function MetricCard({
  title,
  value,
  icon: Icon,
  href,
  badge,
  colorClass,
  description,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  href?: string;
  badge?: number;
  colorClass: string;
  description?: string;
}) {
  const content = (
    <Card className="h-full hover:shadow-md transition-shadow group">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={cn('p-3 rounded-lg', colorClass)}>
            <Icon className="w-5 h-5" />
          </div>
          {badge !== undefined && badge > 0 && (
            <Badge variant="destructive">{badge}</Badge>
          )}
        </div>
        <div className="mt-3">
          <h3 className="text-2xl font-bold">{value.toLocaleString()}</h3>
          <p className={cn(
            "text-sm font-medium mt-1 group-hover:text-ocean-600 transition-colors",
            href ? "text-foreground" : "text-muted-foreground"
          )}>
            {title}
          </p>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

/**
 * Quick Action Button Component
 */
function QuickActionButton({
  title,
  description,
  icon: Icon,
  href,
  variant = 'default',
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  variant?: 'default' | 'secondary' | 'outline';
}) {
  return (
    <Link href={href} className="block">
      <Button variant={variant} className="w-full h-auto py-4 justify-start gap-4">
        <div className="p-2 rounded-lg bg-background/10">
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-left">
          <p className="font-medium">{title}</p>
          <p className="text-xs opacity-80">{description}</p>
        </div>
        <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
      </Button>
    </Link>
  );
}

/**
 * Recent Activity Card Component
 */
function RecentActivityCard({ activities }: { activities: AdminActivity[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Recent Activity
        </CardTitle>
        <CardDescription>
          Latest administrative actions across the platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = getActivityIcon(activity.action);
              const colorClass = getActivityColor(activity.action);
              const actionLabel = getActionLabel(activity.action);
              
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={cn('p-2 rounded-lg shrink-0', colorClass)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{actionLabel}</span>{' '}
                      <span className="text-muted-foreground">
                        {activity.entityType.toLowerCase()}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatTimeAgo(activity.createdAt)} • {activity.admin.email.split('@')[0]}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Status Overview Card Component
 */
function StatusOverviewCard({ metrics }: { metrics: AdminMetrics }) {
  const totalPhysicians =
    metrics.pendingPhysicians +
    metrics.activePhysicians +
    metrics.invitedPhysicians;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Stethoscope className="w-5 h-5" />
          Physician Status Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Active */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm">Active</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{metrics.activePhysicians}</span>
              <span className="text-xs text-muted-foreground">
                {totalPhysicians > 0
                  ? Math.round((metrics.activePhysicians / totalPhysicians) * 100)
                  : 0}
                %
              </span>
            </div>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{
                width: `${
                  totalPhysicians > 0
                    ? (metrics.activePhysicians / totalPhysicians) * 100
                    : 0
                }%`,
              }}
            />
          </div>

          {/* Pending */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-sm">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{metrics.pendingPhysicians}</span>
              <span className="text-xs text-muted-foreground">
                {totalPhysicians > 0
                  ? Math.round((metrics.pendingPhysicians / totalPhysicians) * 100)
                  : 0}
                %
              </span>
            </div>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{
                width: `${
                  totalPhysicians > 0
                    ? (metrics.pendingPhysicians / totalPhysicians) * 100
                    : 0
                }%`,
              }}
            />
          </div>

          {/* Invited */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-sm">Invited</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{metrics.invitedPhysicians}</span>
              <span className="text-xs text-muted-foreground">
                {totalPhysicians > 0
                  ? Math.round((metrics.invitedPhysicians / totalPhysicians) * 100)
                  : 0}
                %
              </span>
            </div>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{
                width: `${
                  totalPhysicians > 0
                    ? (metrics.invitedPhysicians / totalPhysicians) * 100
                    : 0
                }%`,
              }}
            />
          </div>

          {/* Total */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total Physicians</span>
              <span className="font-semibold">{totalPhysicians}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default async function AdminDashboardPage() {
  const [metrics, recentActivity] = await Promise.all([
    getAdminMetrics(),
    getRecentActivity(),
  ]);

  const hasPendingPhysicians = metrics.pendingPhysicians > 0;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Platform overview and administrative controls
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasPendingPhysicians && (
            <Badge variant="destructive" className="px-3 py-1">
              <AlertCircle className="w-4 h-4 mr-1" />
              {metrics.pendingPhysicians} pending authorization
              {metrics.pendingPhysicians > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          title="Pending Physicians"
          value={metrics.pendingPhysicians}
          icon={UserPlus}
          href="/admin/physicians/pending"
          badge={hasPendingPhysicians ? metrics.pendingPhysicians : undefined}
          colorClass="bg-amber-100 text-amber-600"
          description="Awaiting authorization"
        />
        <MetricCard
          title="Active Physicians"
          value={metrics.activePhysicians}
          icon={UserCheck}
          colorClass="bg-green-100 text-green-600"
          description="Currently authorized"
        />
        <MetricCard
          title="Invited Physicians"
          value={metrics.invitedPhysicians}
          icon={Mail}
          colorClass="bg-blue-100 text-blue-600"
          description="Awaiting first login"
        />
        <MetricCard
          title="Total Patients"
          value={metrics.totalPatients}
          icon={Users}
          colorClass="bg-purple-100 text-purple-600"
          description="Registered users"
        />
        <MetricCard
          title="Today's Reviews"
          value={metrics.todaysReviews}
          icon={ClipboardCheck}
          colorClass="bg-ocean-100 text-ocean-600"
          description="Completed today"
        />
        <MetricCard
          title="Unread Messages"
          value={metrics.unreadMessages}
          icon={MessageSquare}
          colorClass="bg-rose-100 text-rose-600"
          description="Physician messages"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QuickActionButton
          title="Authorize New Physician"
          description="Review and approve pending physician applications"
          icon={ShieldCheck}
          href="/admin/physicians/pending"
          variant="default"
        />
        <QuickActionButton
          title="View All Physicians"
          description="Manage physician accounts and permissions"
          icon={Stethoscope}
          href="/admin/physicians"
          variant="secondary"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity - Takes up 2 columns */}
        <div className="lg:col-span-2">
          <RecentActivityCard activities={recentActivity} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <StatusOverviewCard metrics={metrics} />
          
          {/* Quick Stats Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Platform Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Physician Coverage</span>
                  <span className={cn(
                    "font-medium",
                    metrics.activePhysicians >= 3 ? "text-green-600" : "text-amber-600"
                  )}>
                    {metrics.activePhysicians >= 3 ? 'Adequate' : 'Low'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Review Capacity</span>
                  <span className="font-medium text-green-600">
                    {metrics.activePhysicians * 20} / day
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pending Actions</span>
                  <span className={cn(
                    "font-medium",
                    metrics.pendingPhysicians > 0 ? "text-amber-600" : "text-green-600"
                  )}>
                    {metrics.pendingPhysicians + (metrics.unreadMessages > 0 ? 1 : 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
