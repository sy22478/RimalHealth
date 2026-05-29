/**
 * Physician Dashboard Page
 *
 * Main dashboard for physicians showing key metrics
 * and quick links to full Queue and Prescriptions pages.
 *
 * @module app/physician/dashboard/page
 */

import * as React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { DashboardStats } from '@/components/physician/DashboardStats';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, ClipboardList, Pill } from 'lucide-react';
import type { PhysicianDashboardStats } from '@/types/physician-dashboard';

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
// Main Page
// ============================================================================

export default async function PhysicianDashboardPage() {
  let stats: PhysicianDashboardStats = defaultStats;
  let queueApiStats: { totalPending?: number; overdueCount?: number } | null = null;
  let queueItemCount: number | null = null;
  let allFetchesFailed = false;
  let queueFetchFailed = false;
  let statsFetchFailed = false;
  let monitoring = {
    checkInsAwaitingReview: 0,
    refillsPendingReview: 0,
    titrationStepsReady: 0,
  };

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (token) {
      const authCookie = `accessToken=${token}`;
      const [queueRes, statsRes] = await Promise.allSettled([
        fetch(`${appUrl}/api/physician/queue`, {
          headers: { Cookie: authCookie },
          cache: 'no-store',
        }),
        fetch(`${appUrl}/api/physician/stats`, {
          headers: { Cookie: authCookie },
          cache: 'no-store',
        }),
      ]);

      if (queueRes.status === 'fulfilled' && queueRes.value.ok) {
        const queueData = await queueRes.value.json();
        if (queueData.stats) {
          queueApiStats = queueData.stats;
        }
        // Capture actual queue item count so the dashboard "Pending Reviews"
        // card matches the number of rows on the queue page. Using the count
        // alone can drift from the rendered list (missing relations, filters).
        if (Array.isArray(queueData.queue)) {
          queueItemCount = queueData.queue.length;
        }
      } else {
        queueFetchFailed = true;
      }

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const statsData = await statsRes.value.json();
        if (statsData.stats) {
          stats = statsData.stats;
        }
        if (statsData.monitoring) {
          monitoring = statsData.monitoring;
        }
      } else {
        statsFetchFailed = true;
        // Fallback: use queue API stats if stats API failed
        if (queueApiStats) {
          stats = {
            ...defaultStats,
            pendingReviews: queueApiStats.totalPending ?? 0,
            overdueReviews: queueApiStats.overdueCount ?? 0,
          };
        }
      }

      // Always prefer the real queue-items count for pendingReviews so the
      // dashboard stat and the queue page agree on the same number.
      if (queueItemCount !== null) {
        stats = { ...stats, pendingReviews: queueItemCount };
      }

      allFetchesFailed = queueFetchFailed && statsFetchFailed;
    }
  } catch {
    // API unavailable — keep empty/zero defaults
    allFetchesFailed = true;
    queueFetchFailed = true;
    statsFetchFailed = true;
  }

  const hasPartialFailure = !allFetchesFailed && (queueFetchFailed || statsFetchFailed);

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

      {/* GLP-1 weight-management monitoring queue (Phase 4) */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Weight-management monitoring</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: 'Check-ins awaiting review',
              value: monitoring.checkInsAwaitingReview,
              href: '/physician/check-ins',
            },
            {
              label: 'GLP-1 refills pending',
              value: monitoring.refillsPendingReview,
              href: '/physician/prescriptions',
            },
            {
              label: 'Titration steps ready',
              value: monitoring.titrationStepsReady,
              href: '/physician/titration',
            },
          ].map((card) => (
            <Link key={card.label} href={card.href} className="group">
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold">{card.value}</span>
                    {card.value > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        Action needed
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 group-hover:underline">
                    {card.label}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/physician/queue" className="group">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="rounded-lg bg-navy-50 p-3">
                <ClipboardList className="size-5 text-navy-600" />
              </div>
              <div>
                <h3 className="font-semibold group-hover:underline">Patient Queue</h3>
                <p className="text-sm text-muted-foreground">Review pending intakes</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/physician/prescriptions" className="group">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="rounded-lg bg-ocean-50 p-3">
                <Pill className="size-5 text-ocean-600" />
              </div>
              <div>
                <h3 className="font-semibold group-hover:underline">Prescriptions</h3>
                <p className="text-sm text-muted-foreground">Manage active prescriptions</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
