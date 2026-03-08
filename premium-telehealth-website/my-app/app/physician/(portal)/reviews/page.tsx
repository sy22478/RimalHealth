/**
 * Reviews Queue Page
 *
 * Full review queue management page for physicians.
 * Shows all pending and in-review intakes with filtering.
 * Fetches data from /api/physician/queue on the server.
 *
 * @module app/physician/reviews/page
 */

import * as React from 'react';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Card, CardContent } from '@/components/ui/card';
import { ReviewQueue } from '@/components/physician/ReviewQueue';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, AlertCircle } from 'lucide-react';
import type { ReviewQueueItem, ReviewQueueStats } from '@/types/physician-dashboard';
import { cn } from '@/lib/utils';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Review Queue | Physician Portal',
  description: 'Review and approve patient intakes.',
};

// ============================================================================
// Stats Cards Component
// ============================================================================

function QueueStatsCards({ stats }: { stats: ReviewQueueStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Total Pending</p>
          <p className="text-2xl font-bold">{stats.totalPending}</p>
        </CardContent>
      </Card>
      <Card className={stats.overdueCount > 0 ? 'border-red-200' : ''}>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Overdue (&gt;24h)</p>
          <p className={cn('text-2xl font-bold', stats.overdueCount > 0 && 'text-red-600')}>
            {stats.overdueCount}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">In Review</p>
          <p className="text-2xl font-bold text-blue-600">{stats.inReviewCount}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">New (&lt;4h)</p>
          <p className="text-2xl font-bold text-green-600">{stats.newlySubmittedCount}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">High Risk</p>
          <p className="text-2xl font-bold text-amber-600">{stats.highRiskCount}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default async function ReviewsPage() {
  let queueItems: ReviewQueueItem[] = [];

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (token) {
      const res = await fetch(`${appUrl}/api/physician/queue`, {
        headers: { Cookie: `accessToken=${token}` },
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.queue)) queueItems = data.queue;
        else if (Array.isArray(data.items)) queueItems = data.items;
      }
    }
  } catch {
    // API unavailable — keep empty array
  }

  const queueStats: ReviewQueueStats = {
    totalPending: queueItems.filter((i) => i.status === 'PENDING').length,
    overdueCount: queueItems.filter((i) => i.isOverdue).length,
    inReviewCount: queueItems.filter((i) => i.status === 'IN_REVIEW').length,
    newlySubmittedCount: queueItems.filter((i) => i.waitTimeHours < 4).length,
    highRiskCount: queueItems.filter(
      (i) => i.riskLevel === 'HIGH' || i.riskLevel === 'SEVERE'
    ).length,
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6" />
            Review Queue
          </h1>
          <p className="text-muted-foreground">
            Review and approve patient intakes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {queueStats.overdueCount > 0 && (
            <Badge variant="destructive" className="px-3 py-1">
              <AlertCircle className="w-4 h-4 mr-1" />
              {queueStats.overdueCount} overdue
            </Badge>
          )}
        </div>
      </div>

      {/* Stats */}
      <QueueStatsCards stats={queueStats} />

      {/* SLA Alert */}
      {queueStats.overdueCount > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">SLA Alert</h3>
              <p className="text-sm text-red-700">
                You have {queueStats.overdueCount} intake
                {queueStats.overdueCount > 1 ? 's' : ''} that{' '}
                {queueStats.overdueCount > 1 ? 'are' : 'is'} past the 24-hour review window.
                Please prioritize these reviews.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Queue */}
      <ReviewQueue items={queueItems} stats={queueStats} />
    </div>
  );
}
