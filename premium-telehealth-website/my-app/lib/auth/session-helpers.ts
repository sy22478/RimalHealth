/**
 * Session Helpers for Server Components
 * 
 * Provides utilities for accessing session data in React Server Components.
 * These functions are designed to work with the custom JWT authentication system.
 * 
 * HIPAA Compliance:
 * - No PHI stored in session cookies
 * - Tokens are httpOnly and secure in production
 * - Short-lived access tokens (15 minutes)
 * 
 * @module lib/auth/session-helpers
 */

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { Role } from '@prisma/client';
import { verifyAccessToken, type AccessTokenPayload } from './jwt';

// ============================================
// Types
// ============================================

/**
 * Session user data (minimal, no PHI)
 */
export interface SessionUser {
  id: string;
  email: string;
  role: Role;
}

/**
 * Session data returned from auth functions
 */
export interface SessionData {
  user: SessionUser;
  expires: Date;
}

/**
 * Authentication result
 */
export type AuthResult = 
  | { success: true; user: SessionUser; error?: never }
  | { success: false; user?: never; error: string; code: string };

// ============================================
// Token Extraction
// ============================================

/**
 * Extract access token from cookies or headers
 * 
 * Priority:
 * 1. Authorization header (Bearer token)
 * 2. accessToken cookie
 * 
 * @returns The token string or null if not found
 */
export async function getToken(): Promise<string | null> {
  // Try Authorization header first
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Try cookies
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get('accessToken');
  if (tokenCookie?.value) {
    return tokenCookie.value;
  }
  
  return null;
}

// ============================================
// Session Validation
// ============================================

/**
 * Validate the current session and return user data
 * 
 * Cached to prevent multiple verifications in the same request
 * 
 * @returns Session data or null if invalid
 */
export const getSession = cache(async (): Promise<SessionData | null> => {
  const token = await getToken();
  
  if (!token) {
    return null;
  }
  
  try {
    const payload = await verifyAccessToken(token);
    
    return {
      user: {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
      },
      expires: new Date((payload.exp as number) * 1000),
    };
  } catch {
    return null;
  }
});

/**
 * Get the current authenticated user
 * 
 * @returns Session user or null if not authenticated
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

/**
 * Require authentication - throws redirect if not authenticated
 * 
 * Use in server components that require authentication
 * 
 * @example
 * ```tsx
 * // app/patient/dashboard/page.tsx
 * export default async function DashboardPage() {
 *   const user = await requireAuth();
 *   
 *   return (
 *     <div>
 *       <h1>Welcome, {user.email}</h1>
 *       {/* dashboard content *\/}
 *     </div>
 *   );
 * }
 * ```
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }
  
  return user;
}

/**
 * Require specific role - throws redirect if not authorized
 * 
 * @param allowedRoles - Array of roles that can access this resource
 * @returns Session user if authorized
 * @throws Redirects to /unauthorized if not authorized, /login if not authenticated
 * 
 * @example
 * ```tsx
 * // app/admin/dashboard/page.tsx
 * export default async function AdminPage() {
 *   const user = await requireRole([Role.ADMIN]);
 *   
 *   return (
 *     <div>
 *       <h1>Admin Dashboard</h1>
 *       {/* admin content *\/}
 *     </div>
 *   );
 * }
 * ```
 */
export async function requireRole(allowedRoles: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }
  
  if (!allowedRoles.includes(user.role)) {
    redirect('/unauthorized');
  }
  
  return user;
}

/**
 * Check if user has a specific role
 * 
 * @param role - Role to check
 * @returns true if user has the role, false otherwise
 */
export async function hasRole(role: Role): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === role;
}

/**
 * Check if user has any of the specified roles
 * 
 * @param roles - Array of roles to check
 * @returns true if user has any of the roles, false otherwise
 */
export async function hasAnyRole(roles: Role[]): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return roles.includes(user.role);
}

// ============================================
// Server Actions Helpers
// ============================================

/**
 * Authenticate server action
 * 
 * Returns user if authenticated, otherwise returns error result
 * Use this pattern for server actions that require authentication
 * 
 * @example
 * ```tsx
 * 'use server';
 * 
 * export async function updateProfile(formData: FormData) {
 *   const auth = await authenticateAction();
 *   
 *   if (!auth.success) {
 *     return auth; // Return error to client
 *   }
 *   
 *   const { user } = auth;
 *   // ... perform action
 * }
 * ```
 */
export async function authenticateAction(): Promise<AuthResult> {
  const user = await getCurrentUser();
  
  if (!user) {
    return {
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
    };
  }
  
  return { success: true, user };
}

/**
 * Authorize server action by role
 * 
 * @param allowedRoles - Roles that can perform this action
 * @returns User if authorized, error otherwise
 * 
 * @example
 * ```tsx
 * 'use server';
 * 
 * export async function deleteUser(userId: string) {
 *   const auth = await authorizeAction([Role.ADMIN]);
 *   
 *   if (!auth.success) {
 *     return auth;
 *   }
 *   
 *   // ... perform admin action
 * }
 * ```
 */
export async function authorizeAction(allowedRoles: Role[]): Promise<AuthResult> {
  const user = await getCurrentUser();
  
  if (!user) {
    return {
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
    };
  }
  
  if (!allowedRoles.includes(user.role)) {
    return {
      success: false,
      error: 'Insufficient permissions',
      code: 'FORBIDDEN',
    };
  }
  
  return { success: true, user };
}

// ============================================
// Cookie Management
// ============================================

/**
 * Set authentication cookies
 * 
 * @param accessToken - JWT access token
 * @param refreshToken - JWT refresh token
 */
export async function setAuthCookies(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const cookieStore = await cookies();
  
  // Access token - short lived, httpOnly
  cookieStore.set({
    name: 'accessToken',
    value: accessToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60, // 15 minutes
    path: '/',
  });
  
  // Refresh token - longer lived, httpOnly
  cookieStore.set({
    name: 'refreshToken',
    value: refreshToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });
}

/**
 * Clear authentication cookies (logout)
 */
export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  
  cookieStore.delete('accessToken');
  cookieStore.delete('refreshToken');
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if the current request is authenticated
 * 
 * @returns true if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}

/**
 * Get user ID from session
 * 
 * @returns User ID or null if not authenticated
 */
export async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

/**
 * Get user role from session
 * 
 * @returns User role or null if not authenticated
 */
export async function getUserRole(): Promise<Role | null> {
  const user = await getCurrentUser();
  return user?.role ?? null;
}

/**
 * Redirect to login if not authenticated
 * 
 * @param returnTo - URL to return to after login (defaults to current path)
 */
export async function redirectToLogin(returnTo?: string): Promise<never> {
  const url = returnTo ? `/login?from=${encodeURIComponent(returnTo)}` : '/login';
  redirect(url);
}

/**
 * Redirect to user's dashboard based on role
 */
export async function redirectToDashboard(): Promise<never> {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }
  
  switch (user.role) {
    case Role.ADMIN:
      redirect('/admin/dashboard');
    case Role.PHYSICIAN:
      redirect('/physician/queue');
    case Role.PATIENT:
    default:
      redirect('/patient/dashboard');
  }
}
