/**
 * usePatientUnreadCount Hook
 *
 * Fetches unread message count for patients from /api/patient/messages.
 * Uses httpOnly cookie auth (no localStorage token needed).
 * Polls every 60 seconds and refreshes on tab visibility change.
 *
 * @module hooks/usePatientUnreadCount
 */

'use client';

import * as React from 'react';

interface PatientThread {
  id: string;
  unreadCount: number;
}

interface UsePatientUnreadCountReturn {
  /** Total number of unread messages */
  unreadCount: number;
  /** Whether data is currently being fetched */
  isLoading: boolean;
  /** Manually trigger a refresh */
  refresh: () => void;
}

/**
 * Hook for tracking unread message count in the patient portal.
 *
 * @example
 * ```typescript
 * const { unreadCount } = usePatientUnreadCount();
 * ```
 */
export function usePatientUnreadCount(): UsePatientUnreadCountReturn {
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);

  const fetchUnreadCount = React.useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const response = await fetch('/api/patient/messages', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          setUnreadCount(0);
          return;
        }
        throw new Error(`Failed to fetch messages: ${response.statusText}`);
      }

      const data = (await response.json()) as { threads: PatientThread[] };

      const count = (data.threads ?? []).reduce(
        (sum: number, thread: PatientThread) => sum + (thread.unreadCount ?? 0),
        0
      );

      setUnreadCount(count);
    } catch {
      // Don't reset count on error to avoid UI flicker
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  const refresh = React.useCallback(() => {
    void fetchUnreadCount(true);
  }, [fetchUnreadCount]);

  // Initial fetch
  React.useEffect(() => {
    void fetchUnreadCount(true);
  }, [fetchUnreadCount]);

  // Poll every 60 seconds
  React.useEffect(() => {
    const interval = setInterval(() => {
      void fetchUnreadCount(false);
    }, 60_000);

    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Refresh on tab visibility change
  React.useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        void fetchUnreadCount(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchUnreadCount]);

  return {
    unreadCount,
    isLoading,
    refresh,
  };
}
