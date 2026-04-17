/**
 * usePhysicianQueueCount Hook
 *
 * Lightweight hook for the sidebar badge on "Patient Queue".
 * Polls /api/physician/stats every 60 seconds and exposes pending + overdue counts.
 *
 * @module hooks/usePhysicianQueueCount
 */

'use client';

import * as React from 'react';

interface QueueCountResponse {
  stats?: {
    pendingReviews?: number;
    overdueReviews?: number;
  };
}

export interface UsePhysicianQueueCountReturn {
  pending: number;
  overdue: number;
  isLoading: boolean;
}

export function usePhysicianQueueCount(): UsePhysicianQueueCountReturn {
  const [pending, setPending] = React.useState(0);
  const [overdue, setOverdue] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);

  const fetchCount = React.useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const res = await fetch('/api/physician/stats?period=today', {
        credentials: 'include',
      });
      if (!res.ok) {
        if (res.status === 401) {
          setPending(0);
          setOverdue(0);
        }
        return;
      }
      const data = (await res.json()) as QueueCountResponse;
      setPending(data.stats?.pendingReviews ?? 0);
      setOverdue(data.stats?.overdueReviews ?? 0);
    } catch (err) {
      console.error('Queue count fetch error:', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchCount(true);
  }, [fetchCount]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      void fetchCount(false);
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void fetchCount(false);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchCount]);

  return { pending, overdue, isLoading };
}
