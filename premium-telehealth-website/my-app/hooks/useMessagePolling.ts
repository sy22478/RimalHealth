/**
 * useMessagePolling Hook
 * 
 * Custom hook for polling physician messages and tracking unread counts.
 * Provides real-time updates for new messages with configurable interval.
 * 
 * @module hooks/useMessagePolling
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
 * Last message info for notifications
 */
interface LastMessageInfo {
  id: string;
  senderName: string;
  subject: string;
  threadId: string;
}

/**
 * Options for useMessagePolling hook
 */
interface UseMessagePollingOptions {
  /** Polling interval in milliseconds (default: 30000) */
  interval?: number;
  /** Whether polling is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Return value from useMessagePolling hook
 */
interface UseMessagePollingReturn {
  /** Total number of unread messages across all threads */
  unreadCount: number;
  /** Information about the most recent message for notifications */
  lastMessage?: LastMessageInfo;
  /** Whether data is currently being fetched */
  isLoading: boolean;
  /** Error object if fetch failed */
  error: Error | null;
  /** Manually trigger a refresh */
  refresh: () => void;
}

/**
 * Hook for polling physician messages
 * 
 * Polls the /api/physician/messages endpoint at configurable intervals
 * to track unread message counts and detect new messages for notifications.
 * 
 * @example
 * ```typescript
 * const { unreadCount, lastMessage, isLoading, error, refresh } = useMessagePolling({
 *   interval: 30000,
 *   enabled: true
 * });
 * ```
 */
export function useMessagePolling(
  options: UseMessagePollingOptions = {}
): UseMessagePollingReturn {
  const { interval = 30000, enabled = true } = options;

  const [unreadCount, setUnreadCount] = React.useState(0);
  const [lastMessage, setLastMessage] = React.useState<LastMessageInfo | undefined>();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [threads, setThreads] = React.useState<MessageThread[]>([]);

  /**
   * Fetch messages from API
   */
  const fetchMessages = React.useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await fetch('/api/physician/messages', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Auth error - don't throw, just stop polling
          return;
        }
        throw new Error(`Failed to fetch messages: ${response.statusText}`);
      }

      const data = await response.json() as { threads: MessageThread[] };
      
      // Calculate total unread count
      const newUnreadCount = data.threads.reduce(
        (sum, thread) => sum + thread.unreadCount,
        0
      );

      // Find the most recent message from a patient
      const patientThreads = data.threads.filter(
        (t) => t.lastMessage?.senderType === 'PATIENT' && t.unreadCount > 0
      );

      // Sort by sentAt to get the most recent
      const sortedThreads = patientThreads.sort(
        (a, b) => new Date(b.lastMessage.sentAt).getTime() - new Date(a.lastMessage.sentAt).getTime()
      );

      const mostRecentThread = sortedThreads[0];

      // Only update lastMessage if we have new unread messages
      if (mostRecentThread && newUnreadCount > unreadCount) {
        setLastMessage({
          id: mostRecentThread.id,
          senderName: mostRecentThread.patientName,
          subject: mostRecentThread.lastMessage.body.slice(0, 100),
          threadId: mostRecentThread.id,
        });
      }

      setThreads(data.threads);
      setUnreadCount(newUnreadCount);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch messages');
      setError(error);
      console.error('Message polling error:', error);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [unreadCount]);

  /**
   * Manual refresh function
   */
  const refresh = React.useCallback(() => {
    void fetchMessages(true);
  }, [fetchMessages]);

  // Initial fetch
  React.useEffect(() => {
    if (enabled) {
      void fetchMessages(true);
    }
  }, [enabled, fetchMessages]);

  // Polling interval
  React.useEffect(() => {
    if (!enabled) return;

    const pollInterval = setInterval(() => {
      void fetchMessages(false);
    }, interval);

    return () => clearInterval(pollInterval);
  }, [enabled, interval, fetchMessages]);

  // Handle visibility change - refresh when tab becomes visible
  React.useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchMessages(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [enabled, fetchMessages]);

  return {
    unreadCount,
    lastMessage,
    isLoading,
    error,
    refresh,
  };
}

export type { UseMessagePollingOptions, UseMessagePollingReturn, LastMessageInfo };
