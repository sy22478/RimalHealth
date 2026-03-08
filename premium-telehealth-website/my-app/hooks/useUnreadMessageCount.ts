/**
 * useUnreadMessageCount Hook
 * 
 * Simplified hook for tracking unread message count.
 * Optimized for navigation badge display.
 * 
 * @module hooks/useUnreadMessageCount
 */

'use client';

import * as React from 'react';

/**
 * Message thread from API response
 */
interface MessageThread {
  id: string;
  patientId: string;
  patientName: string;
  lastMessage: {
    body: string;
    sentAt: string;
    senderType: 'PATIENT' | 'PHYSICIAN';
  };
  unreadCount: number;
  totalMessages: number;
}

/**
 * Return value from useUnreadMessageCount hook
 */
interface UseUnreadMessageCountReturn {
  /** Total number of unread messages */
  unreadCount: number;
  /** Whether data is currently being fetched */
  isLoading: boolean;
  /** Manually trigger a refresh */
  refresh: () => void;
}

/**
 * Hook for tracking unread message count
 * 
 * Lightweight hook optimized for navigation badge display.
 * Polls every 60 seconds by default for efficiency.
 * 
 * @example
 * ```typescript
 * const { unreadCount, isLoading, refresh } = useUnreadMessageCount();
 * 
 * // In navigation:
 * {unreadCount > 0 && (
 *   <Badge variant="destructive">{unreadCount}</Badge>
 * )}
 * ```
 */
export function useUnreadMessageCount(): UseUnreadMessageCountReturn {
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);

  /**
   * Fetch unread count from API
   */
  const fetchUnreadCount = React.useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }

    try {
      const response = await fetch('/api/physician/messages', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Auth error - reset count
          setUnreadCount(0);
          return;
        }
        throw new Error(`Failed to fetch messages: ${response.statusText}`);
      }

      const data = await response.json() as { threads: MessageThread[] };
      
      // Calculate total unread count
      const count = data.threads.reduce(
        (sum, thread) => sum + thread.unreadCount,
        0
      );

      setUnreadCount(count);
    } catch (err) {
      console.error('Unread count fetch error:', err);
      // Don't reset count on error to avoid UI flicker
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  /**
   * Manual refresh function
   */
  const refresh = React.useCallback(() => {
    void fetchUnreadCount(true);
  }, [fetchUnreadCount]);

  // Initial fetch
  React.useEffect(() => {
    void fetchUnreadCount(true);
  }, [fetchUnreadCount]);

  // Polling interval - less frequent for badge-only (60 seconds)
  React.useEffect(() => {
    const interval = setInterval(() => {
      void fetchUnreadCount(false);
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Handle visibility change - refresh when tab becomes visible
  React.useEffect(() => {
    const handleVisibilityChange = () => {
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

export type { UseUnreadMessageCountReturn };
