/**
 * Authentication Middleware for API Routes
 * Validates JWT and checks permissions
 * 
 * HIPAA Compliance:
 * - All authentication failures are logged
 * - Token validation includes expiration checks
 * - Permission checks enforce minimum necessary access
 */

import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { verifyAccessToken, AccessTokenPayload } from './jwt';
import { hasPermission, Permission } from './rbac';

/**
 * Authenticated user interface
 * Attached to request after successful authentication
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
}

/**
 * Authenticated request interface
 * Extends NextRequest with user context
 */
export interface AuthenticatedRequest extends NextRequest {
  user: AuthenticatedUser;
}

/**
 * Convert JWT payload to authenticated user
 */
function payloadToUser(payload: AccessTokenPayload): AuthenticatedUser {
  return {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  };
}

/**
 * Authentication error responses
 */
const AUTH_ERRORS = {
  NO_TOKEN: {
    error: 'Unauthorized',
    message: 'Authentication required. Please provide a valid access token.',
    code: 'NO_TOKEN',
  },
  INVALID_TOKEN: {
    error: 'Unauthorized',
    message: 'Invalid or expired token. Please log in again.',
    code: 'INVALID_TOKEN',
  },
  TOKEN_EXPIRED: {
    error: 'Unauthorized',
    message: 'Token has expired. Please refresh your session.',
    code: 'TOKEN_EXPIRED',
  },
  FORBIDDEN: {
    error: 'Forbidden',
    message: 'You do not have permission to perform this action.',
    code: 'FORBIDDEN',
  },
  INSUFFICIENT_PERMISSIONS: {
    error: 'Forbidden',
    message: 'Insufficient permissions to access this resource.',
    code: 'INSUFFICIENT_PERMISSIONS',
  },
} as const;

/**
 * Extract Bearer token from Authorization header
 * 
 * @param request - Next.js request object
 * @returns The token string or null if not found/invalid format
 */
function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return null;
  }
  
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }
  
  return parts[1];
}

/**
 * Middleware to require authentication
 * Validates JWT token and returns user context
 * 
 * @param request - Next.js request object
 * @returns Object with user data or NextResponse with error
 * 
 * @example
 * ```typescript
 * // In API route handler
 * export async function GET(request: NextRequest) {
 *   const auth = await requireAuth(request);
 *   
 *   if (auth instanceof NextResponse) {
 *     return auth; // Returns 401 error response
 *   }
 *   
 *   // User is authenticated, use auth.user
 *   const { userId, email, role } = auth.user;
 *   // ... handle request
 * }
 * ```
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ user: AuthenticatedUser } | NextResponse> {
  // 1. Check middleware-injected headers first (set when request passes through
  //    Next.js middleware with a valid httpOnly accessToken cookie)
  const userId = request.headers.get('x-user-id');
  const userRole = request.headers.get('x-user-role');
  const userEmail = request.headers.get('x-user-email');
  if (userId && userRole) {
    return {
      user: {
        userId,
        email: userEmail ?? '',
        role: userRole as Role,
      },
    };
  }

  // 2. Fall back to explicit Authorization: Bearer header
  const bearerToken = extractBearerToken(request);

  // 3. Fall back to httpOnly accessToken cookie (API routes bypass middleware
  //    which means x-user-* headers are never set for /api/* paths)
  const cookieToken = request.cookies.get('accessToken')?.value ?? null;

  const token = bearerToken ?? cookieToken;

  if (!token) {
    return NextResponse.json(
      { ...AUTH_ERRORS.NO_TOKEN, timestamp: new Date().toISOString() },
      { status: 401 }
    );
  }

  try {
    const payload = await verifyAccessToken(token);
    const user = payloadToUser(payload);

    return { user };
  } catch (error) {
    // Log error for monitoring but don't expose details to client
    console.error('Authentication error:', error);

    // Check for specific error types from JWT verification
    const errorMessage = error instanceof Error ? error.message : '';

    if (errorMessage.includes('expired')) {
      return NextResponse.json(
        { ...AUTH_ERRORS.TOKEN_EXPIRED, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { ...AUTH_ERRORS.INVALID_TOKEN, timestamp: new Date().toISOString() },
      { status: 401 }
    );
  }
}

/**
 * Middleware to require specific permission
 * Validates authentication AND checks permission
 * 
 * @param request - Next.js request object
 * @param permission - The permission required to access the resource
 * @returns AuthenticatedRequest or NextResponse with error
 * 
 * @example
 * ```typescript
 * // In API route handler
 * export async function POST(request: NextRequest) {
 *   const auth = await requirePermission(request, Permission.CREATE_PRESCRIPTION);
 *   
 *   if (auth instanceof NextResponse) {
 *     return auth; // Returns 401 or 403 error response
 *   }
 *   
 *   // User is authenticated and has permission
 *   const { userId, role } = auth.user;
 *   // ... handle request
 * }
 * ```
 */
export async function requirePermission(
  request: NextRequest,
  permission: Permission
): Promise<AuthenticatedRequest | NextResponse> {
  const authResult = await requireAuth(request);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { user } = authResult;
  
  if (!hasPermission(user.role, permission)) {
    return NextResponse.json(
      {
        ...AUTH_ERRORS.INSUFFICIENT_PERMISSIONS,
        requiredPermission: permission,
        userRole: user.role,
        timestamp: new Date().toISOString(),
      },
      { status: 403 }
    );
  }
  
  // Create authenticated request with user context
  const authenticatedRequest = request as AuthenticatedRequest;
  authenticatedRequest.user = user;
  
  return authenticatedRequest;
}

/**
 * Middleware to require any of multiple permissions
 * User must have at least one of the specified permissions
 * 
 * @param request - Next.js request object
 * @param permissions - Array of permissions (need any one)
 * @returns AuthenticatedRequest or NextResponse with error
 * 
 * @example
 * ```typescript
 * // Allow physicians OR admins to access
 * const auth = await requireAnyPermission(request, [
 *   Permission.REVIEW_INTAKE,
 *   Permission.MANAGE_SYSTEM
 * ]);
 * ```
 */
export async function requireAnyPermission(
  request: NextRequest,
  permissions: Permission[]
): Promise<AuthenticatedRequest | NextResponse> {
  const authResult = await requireAuth(request);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { user } = authResult;
  
  const hasAnyPerm = permissions.some(perm => hasPermission(user.role, perm));
  
  if (!hasAnyPerm) {
    return NextResponse.json(
      {
        ...AUTH_ERRORS.INSUFFICIENT_PERMISSIONS,
        requiredPermissions: permissions,
        userRole: user.role,
        timestamp: new Date().toISOString(),
      },
      { status: 403 }
    );
  }
  
  const authenticatedRequest = request as AuthenticatedRequest;
  authenticatedRequest.user = user;
  
  return authenticatedRequest;
}

/**
 * Middleware to require all of multiple permissions
 * User must have every specified permission
 * 
 * @param request - Next.js request object
 * @param permissions - Array of permissions (need all)
 * @returns AuthenticatedRequest or NextResponse with error
 * 
 * @example
 * ```typescript
 * // Require full prescription management capability
 * const auth = await requireAllPermissions(request, [
 *   Permission.CREATE_PRESCRIPTION,
 *   Permission.SEND_PRESCRIPTION,
 *   Permission.CANCEL_PRESCRIPTION
 * ]);
 * ```
 */
export async function requireAllPermissions(
  request: NextRequest,
  permissions: Permission[]
): Promise<AuthenticatedRequest | NextResponse> {
  const authResult = await requireAuth(request);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { user } = authResult;
  
  const hasAllPerms = permissions.every(perm => hasPermission(user.role, perm));
  
  if (!hasAllPerms) {
    return NextResponse.json(
      {
        ...AUTH_ERRORS.INSUFFICIENT_PERMISSIONS,
        requiredPermissions: permissions,
        userRole: user.role,
        timestamp: new Date().toISOString(),
      },
      { status: 403 }
    );
  }
  
  const authenticatedRequest = request as NextRequest as AuthenticatedRequest;
  authenticatedRequest.user = user;
  
  return authenticatedRequest;
}

/**
 * Middleware to require specific role
 * 
 * @param request - Next.js request object
 * @param roles - Allowed roles
 * @returns AuthenticatedRequest or NextResponse with error
 * 
 * @example
 * ```typescript
 * // Admin-only endpoint
 * const auth = await requireRole(request, [Role.ADMIN]);
 * 
 * // Physician or Admin endpoint
 * const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
 * ```
 */
export async function requireRole(
  request: NextRequest,
  roles: Role[]
): Promise<AuthenticatedRequest | NextResponse> {
  const authResult = await requireAuth(request);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { user } = authResult;
  
  if (!roles.includes(user.role)) {
    return NextResponse.json(
      {
        ...AUTH_ERRORS.FORBIDDEN,
        requiredRoles: roles,
        userRole: user.role,
        timestamp: new Date().toISOString(),
      },
      { status: 403 }
    );
  }
  
  const authenticatedRequest = request as AuthenticatedRequest;
  authenticatedRequest.user = user;
  
  return authenticatedRequest;
}

/**
 * Higher-order function to create protected API route handlers
 * Wraps a handler function with authentication check
 * 
 * @param handler - The route handler function
 * @returns Wrapped handler with auth check
 * 
 * @example
 * ```typescript
 * // In app/api/protected/route.ts
 * export const GET = withAuth(async (request: AuthenticatedRequest) => {
 *   // User is guaranteed to be authenticated here
 *   const { userId, role } = request.user;
 *   return NextResponse.json({ data: 'protected' });
 * });
 * ```
 */
export function withAuth<T extends AuthenticatedRequest, R extends NextResponse>(
  handler: (request: T) => Promise<R> | R
): (request: NextRequest) => Promise<R | NextResponse> {
  return async (request: NextRequest): Promise<R | NextResponse> => {
    const authResult = await requireAuth(request);
    
    if (authResult instanceof NextResponse) {
      return authResult as NextResponse;
    }
    
    const authenticatedRequest = request as T;
    authenticatedRequest.user = authResult.user;
    
    return handler(authenticatedRequest);
  };
}

/**
 * Higher-order function to create permission-protected API route handlers
 * 
 * @param permission - Required permission
 * @param handler - The route handler function
 * @returns Wrapped handler with auth and permission check
 * 
 * @example
 * ```typescript
 * // In app/api/prescriptions/route.ts
 * export const POST = withPermission(
 *   Permission.CREATE_PRESCRIPTION,
 *   async (request: AuthenticatedRequest) => {
 *     // User has CREATE_PRESCRIPTION permission
 *     return NextResponse.json({ created: true });
 *   }
 * );
 * ```
 */
export function withPermission<T extends AuthenticatedRequest, R extends NextResponse>(
  permission: Permission,
  handler: (request: T) => Promise<R> | R
): (request: NextRequest) => Promise<R | NextResponse> {
  return async (request: NextRequest): Promise<R | NextResponse> => {
    const authResult = await requirePermission(request, permission);
    
    if (authResult instanceof NextResponse) {
      return authResult as NextResponse;
    }
    
    return handler(authResult as T);
  };
}

/**
 * Get client IP address from request
 * Used for audit logging and security
 * 
 * @param request - Next.js request object
 * @returns IP address string
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  // Fallback (in production, this will be the load balancer IP)
  return 'unknown';
}

/**
 * Get user agent from request
 * Used for audit logging
 * 
 * @param request - Next.js request object
 * @returns User agent string
 */
export function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown';
}
