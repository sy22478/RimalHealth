/**
 * Physician Queue Page (Enhanced)
 * Main page for viewing pending patient intakes with priority indicators
 *
 * Route: /physician/queue
 * Access: PHYSICIAN, ADMIN roles only
 *
 * HIPAA Compliance:
 * - Role verification via middleware (middleware.ts)
 * - All PHI access audited in the library layer
 * - No PHI in URL or logs
 *
 * @module app/physician/queue/page
 */

import * as React from 'react';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { EnhancedQueueClient } from '@/components/physician/EnhancedQueueClient';
import { QueueApiResponse, QueueStats } from '@/types/physician-queue';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Patient Queue | Rimal Health',
  description: 'Review pending patient intakes and assessments with priority indicators',
};

/**
 * Force dynamic rendering to ensure fresh data
 */
export const dynamic = 'force-dynamic';

// ============================================================================
// Empty defaults
// ============================================================================

const emptyStats: QueueStats = {
  totalPending: 0,
  overdueCount: 0,
  underReviewCount: 0,
  newlySubmittedCount: 0,
};

const emptyQueueData: QueueApiResponse = {
  items: [],
  stats: emptyStats,
  lastUpdated: new Date().toISOString(),
};

const emptyEnhancedStats = {
  stats: emptyStats,
  highPriorityCount: 0,
  averageWaitTimeHours: 0,
};

// ============================================================================
// Page Component
// ============================================================================

/**
 * Queue Page Component
 * Fetches real queue data via /api/physician/queue.
 * Returns empty state on any error — no mock fallback.
 */
export default async function QueuePage(): Promise<React.ReactElement> {
  let data: QueueApiResponse = {
    ...emptyQueueData,
    lastUpdated: new Date().toISOString(),
  };

  let enhancedStats = { ...emptyEnhancedStats };

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (token) {
      const authCookie = `accessToken=${token}`;
      const res = await fetch(`${appUrl}/api/physician/queue`, {
        headers: { Cookie: authCookie },
        cache: 'no-store',
      });

      if (res.ok) {
        const json = await res.json();

        const items = Array.isArray(json.queue) ? json.queue : [];
        const stats: QueueStats = json.stats ?? emptyStats;

        data = {
          items,
          stats,
          lastUpdated: new Date().toISOString(),
        };

        // Derive enhanced stats from the items
        const highPriorityCount = items.filter(
          (item: { riskScore?: number }) => (item.riskScore || 0) >= 70
        ).length;

        const averageWaitTimeHours =
          items.length > 0
            ? items.reduce(
                (sum: number, item: { waitTimeHours: number }) => sum + item.waitTimeHours,
                0
              ) / items.length
            : 0;

        enhancedStats = {
          stats,
          highPriorityCount,
          averageWaitTimeHours: Math.round(averageWaitTimeHours * 10) / 10,
        };
      }
    }
  } catch (error) {
    console.error('Queue page data fetch error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Keep empty defaults — no mock fallback
  }

  return (
    <div className="container-custom py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Patient Queue</h1>
        <p className="mt-2 text-muted-foreground">
          Review and manage pending patient intakes. High priority cases are highlighted
          and should be reviewed first. Auto-refreshes every 5 minutes.
        </p>
      </div>

      {/* Enhanced Queue Component with Client-side Features */}
      <EnhancedQueueClient
        initialData={data}
        initialEnhancedStats={enhancedStats}
      />

      {/* HIPAA Notice */}
      <p className="mt-6 text-xs text-muted-foreground">
        All patient information displayed is protected health information (PHI). Access is
        logged for HIPAA compliance. Do not share or print this data.
      </p>
    </div>
  );
}
