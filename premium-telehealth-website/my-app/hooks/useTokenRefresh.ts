'use client';

/**
 * useTokenRefresh Hook
 *
 * Proactively refreshes the access token before it expires (every 13 minutes
 * against a 15-minute access token lifetime). Monitors user activity so that
 * refresh calls stop after 30 minutes of inactivity (HIPAA idle timeout).
 *
 * On refresh failure, retries once; if both attempts fail, redirects to the
 * configured login path so the user can re-authenticate.
 *
 * This is a side-effect-only hook -- it returns nothing.
 *
 * @module hooks/useTokenRefresh
 */

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ============================================
// Types
// ============================================

interface UseTokenRefreshProps {
  /** Whether token refresh is enabled */
  enabled: boolean;
  /** Path to redirect to on auth failure (e.g. '/login' or '/physician/login') */
  loginPath: string;
}

// ============================================
// Constants
// ============================================

/** Refresh interval: 13 minutes (before the 15-min access token expires) */
const REFRESH_INTERVAL_MS = 13 * 60 * 1000;

/** HIPAA idle timeout: 30 minutes of inactivity */
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** Activity events to track */
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'keydown',
  'touchstart',
  'scroll',
];

// ============================================
// Hook
// ============================================

export function useTokenRefresh({ enabled, loginPath }: UseTokenRefreshProps): void {
  const router = useRouter();
  const lastActivityRef = useRef<number>(0);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize lastActivityRef on mount
  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Track user activity
  const handleActivity = useCallback((): void => {
    lastActivityRef.current = Date.now();
  }, []);

  // Attempt token refresh
  const refreshToken = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      return response.ok;
    } catch {
      return false;
    }
  }, []);

  // Refresh with retry logic
  const refreshWithRetry = useCallback(async (): Promise<void> => {
    // Check if user has been idle beyond the HIPAA timeout
    const idleTime = Date.now() - lastActivityRef.current;
    if (idleTime > IDLE_TIMEOUT_MS) {
      // User has been idle too long -- redirect to login
      router.push(loginPath);
      return;
    }

    // First attempt
    const success = await refreshToken();
    if (success) return;

    // Retry once
    const retrySuccess = await refreshToken();
    if (retrySuccess) return;

    // Both attempts failed -- redirect to login
    router.push(loginPath);
  }, [refreshToken, router, loginPath]);

  useEffect(() => {
    if (!enabled) return;

    // Register activity listeners
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    // Start refresh interval
    refreshTimerRef.current = setInterval(() => {
      void refreshWithRetry();
    }, REFRESH_INTERVAL_MS);

    return () => {
      // Clean up activity listeners
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }

      // Clear refresh timer
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [enabled, handleActivity, refreshWithRetry]);
}
