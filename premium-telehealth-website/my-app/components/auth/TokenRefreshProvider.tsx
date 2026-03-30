'use client';

/**
 * TokenRefreshProvider
 *
 * Client component wrapper that enables automatic token refresh for portals
 * whose layout is a server component (and therefore cannot call hooks directly).
 *
 * Usage:
 *   <TokenRefreshProvider loginPath="/physician/login">
 *     {children}
 *   </TokenRefreshProvider>
 *
 * @module components/auth/TokenRefreshProvider
 */

import * as React from 'react';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';

// ============================================
// Types
// ============================================

interface TokenRefreshProviderProps {
  children: React.ReactNode;
  /** Path to redirect to on auth failure */
  loginPath: string;
}

// ============================================
// Component
// ============================================

export function TokenRefreshProvider({
  children,
  loginPath,
}: TokenRefreshProviderProps): React.ReactElement {
  useTokenRefresh({ enabled: true, loginPath });

  return <>{children}</>;
}
