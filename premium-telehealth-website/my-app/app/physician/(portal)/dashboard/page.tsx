/**
 * Physician Dashboard Page
 *
 * Main dashboard for physicians showing key metrics,
 * pending reviews, and quick actions.
 *
 * @module app/physician/dashboard/page
 */

import * as React from 'react';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { DashboardStats } from '@/components/physician/DashboardStats';
import { ReviewQueue } from '@/components/physician/ReviewQueue';
import { PrescriptionList } from '@/components/physician/PrescriptionList';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  AlertCircle,
  Users,
  Pill,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  PhysicianDashboardStats,
  ReviewQueueItem,
  PhysicianPrescriptionListItem,
} from '@/types/physician-dashboard';
import { getRiskLevelFromScore } from '@/types/physician-dashboard';

// ============================================================================
// Metadata
// ============================================================================

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard | Physician Portal',
  description: 'Overview of your patients, reviews, and prescriptions.',
};

// ============================================================================
// Default (empty) values — used when API is unavailable or returns no data
// ============================================================================

const defaultStats: PhysicianDashboardStats = {
  pendingReviews: 0,
  patientsToday: 0,
  unreadMessages: 0,
  prescriptionsThisMonth: 0,
  overdueReviews: 0,
  averageReviewTime: 0,
};

// ============================================================================
// Components
// ============================================================================

/**
 * Quick Action Card
 */
function QuickActionCard({
  title,
  description,
  icon: Icon,
  href,
  badge,
  colorClass,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  badge?: number;
  colorClass: string;
}) {
  return (
    <Link href={href}>
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
          <h3 className="font-semibold mt-3 group-hover:text-ocean-600 transition-colors">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default async function PhysicianDashboardPage() {
  let stats: PhysicianDashboardStats = defaultStats;
  let queueItems: ReviewQueueItem[] = [];
  let prescriptions: PhysicianPrescriptionListItem[] = [];
  let allFetchesFailed = false;
  let queueFetchFailed = false;
  let statsFetchFailed = false;
  let prescriptionsFetchFailed = false;

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (token) {
      const authCookie = `accessToken=${token}`;
      const [queueRes, statsRes, prescriptionsRes] = await Promise.allSettled([
        fetch(`${appUrl}/api/physician/queue`, {
          headers: { Cookie: authCookie },
          cache: 'no-store',
        }),
        fetch(`${appUrl}/api/physician/stats`, {
          headers: { Cookie: authCookie },
          cache: 'no-store',
        }),
        fetch(`${appUrl}/api/physician/prescriptions`, {
          headers: { Cookie: authCookie },
          cache: 'no-store',
        }),
      ]);

      if (queueRes.status === 'fulfilled' && queueRes.value.ok) {
        const queueData = await queueRes.value.json();
        const rawItems = Array.isArray(queueData.items) ? queueData.items
          : Array.isArray(queueData.queue) ? queueData.queue : [];
        // Map queue API items (QueueItem shape) to ReviewQueueItem shape
        queueItems = rawItems.map((item: Record<string, unknown>) => {
          const status = item.status === 'SUBMITTED' ? 'PENDING'
            : item.status === 'UNDER_REVIEW' ? 'IN_REVIEW'
            : (item.status as string) || 'PENDING';
          return {
            ...item,
            status,
            treatmentType: (item.treatmentType as string) || (item.concernType as string) || 'ALCOHOL',
            riskLevel: (item.riskLevel as string) || getRiskLevelFromScore(item.riskScore as number | undefined),
          } as ReviewQueueItem;
        });
      } else {
        queueFetchFailed = true;
      }

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const statsData = await statsRes.value.json();
        if (statsData.stats) {
          stats = statsData.stats;
        } else if (statsData.queue) {
          // Map the stats API response shape to PhysicianDashboardStats
          stats = {
            pendingReviews: statsData.queue?.pendingIntakes ?? 0,
            patientsToday: statsData.patients?.new ?? 0,
            unreadMessages: statsData.messages?.unread ?? 0,
            prescriptionsThisMonth: statsData.prescriptions?.sent ?? 0,
            overdueReviews: statsData.queue?.overdueIntakes ?? 0,
            averageReviewTime: statsData.queue?.averageWaitHours ?? 0,
          };
        }
      } else {
        statsFetchFailed = true;
      }

      if (prescriptionsRes.status === 'fulfilled' && prescriptionsRes.value.ok) {
        const prescriptionsData = await prescriptionsRes.value.json();
        if (Array.isArray(prescriptionsData.prescriptions)) {
          prescriptions = prescriptionsData.prescriptions;
        }
      } else {
        prescriptionsFetchFailed = true;
      }

      allFetchesFailed = queueFetchFailed && statsFetchFailed && prescriptionsFetchFailed;
    }
  } catch {
    // API unavailable — keep empty/zero defaults
    allFetchesFailed = true;
    queueFetchFailed = true;
    statsFetchFailed = true;
    prescriptionsFetchFailed = true;
  }

  const queueStats = {
    totalPending: stats.pendingReviews,
    overdueCount: stats.overdueReviews,
    inReviewCount: queueItems.filter((i) => i.status === 'IN_REVIEW').length,
    newlySubmittedCount: queueItems.filter((i) => i.waitTimeHours < 4).length,
    highRiskCount: queueItems.filter((i) => i.riskLevel === 'HIGH' || i.riskLevel === 'SEVERE').length,
  };

  const hasPartialFailure = !allFetchesFailed && (queueFetchFailed || statsFetchFailed || prescriptionsFetchFailed);

  return (
    <div className="space-y-8">
      {/* Error Banner — all fetches failed */}
      {allFetchesFailed && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800">Unable to load dashboard data</p>
          <p className="text-sm text-red-600 mt-1">Some services may be unavailable. Please refresh the page.</p>
        </div>
      )}

      {/* Warning Banner — some fetches failed */}
      {hasPartialFailure && (
        <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-medium text-amber-800">Some dashboard data could not be loaded</p>
          <p className="text-sm text-amber-600 mt-1">
            {[
              statsFetchFailed && 'statistics',
              queueFetchFailed && 'review queue',
              prescriptionsFetchFailed && 'prescriptions',
            ]
              .filter(Boolean)
              .join(', ')}{' '}
            could not be retrieved. Please refresh to try again.
          </p>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s what&apos;s happening today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.overdueReviews > 0 && (
            <Badge variant="destructive" className="px-3 py-1">
              <AlertCircle className="w-4 h-4 mr-1" />
              {stats.overdueReviews} overdue reviews
            </Badge>
          )}
        </div>
      </div>

      {/* Stats */}
      <DashboardStats stats={stats} />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickActionCard
          title="Pending Reviews"
          description={`Review ${stats.pendingReviews} pending intake${stats.pendingReviews !== 1 ? 's' : ''}`}
          icon={Clock}
          href="/physician/reviews"
          badge={stats.pendingReviews}
          colorClass="bg-amber-100 text-amber-600"
        />
        <QuickActionCard
          title="My Patients"
          description="View and manage patient list"
          icon={Users}
          href="/physician/patients"
          colorClass="bg-blue-100 text-blue-600"
        />
        <QuickActionCard
          title="Prescriptions"
          description="Manage active prescriptions"
          icon={Pill}
          href="/physician/prescriptions"
          colorClass="bg-green-100 text-green-600"
        />
        <QuickActionCard
          title="Messages"
          description={`${stats.unreadMessages} unread message${stats.unreadMessages !== 1 ? 's' : ''}`}
          icon={MessageSquare}
          href="/physician/messages"
          badge={stats.unreadMessages}
          colorClass="bg-purple-100 text-purple-600"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Review Queue — takes up 2 columns */}
        <div className="lg:col-span-2">
          <ReviewQueue
            items={queueItems}
            stats={queueStats}
            compact
          />
        </div>

        {/* Right Column — Recent Prescriptions */}
        <div className="space-y-6">
          <PrescriptionList
            prescriptions={prescriptions}
            compact
          />
        </div>
      </div>
    </div>
  );
}
