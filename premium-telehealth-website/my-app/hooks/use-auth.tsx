/**
 * Authentication Hook
 *
 * Provides authentication state and methods for the application.
 * Uses httpOnly cookies exclusively -- no localStorage token storage.
 *
 * @module hooks/use-auth
 */

'use client';

import * as React from 'react';

interface User {
  id: string;
  email: string;
  role: 'PATIENT' | 'PHYSICIAN' | 'ADMIN';
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider component
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  /**
   * Check current auth state by calling /api/auth/me.
   * The accessToken httpOnly cookie is sent automatically.
   */
  const checkAuth = React.useCallback(async (): Promise<User | null> => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const user: User = data.user;
        setState({
          user,
          isLoading: false,
          isAuthenticated: true,
        });
        return user;
      }

      setState({ user: null, isLoading: false, isAuthenticated: false });
      return null;
    } catch {
      setState({ user: null, isLoading: false, isAuthenticated: false });
      return null;
    }
  }, []);

  // Check for existing session on mount
  React.useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  const login = React.useCallback(async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    // The login API sets httpOnly cookies; fetch user data from /api/auth/me
    await checkAuth();
  }, [checkAuth]);

  const logout = React.useCallback(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  const refreshToken = React.useCallback(async () => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });

      if (response.ok) {
        // Refresh succeeded; cookies updated server-side. Re-check auth state.
        await checkAuth();
      } else {
        throw new Error('Token refresh failed');
      }
    } catch {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, [checkAuth]);

  const value = React.useMemo(
    () => ({
      ...state,
      login,
      logout,
      refreshToken,
    }),
    [state, login, logout, refreshToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth hook
 *
 * @returns AuthContextType
 * @throws Error if used outside AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
