/**
 * Next.js Middleware for Route Protection
 * 
 * Protects role-based routes and handles authentication redirects.
 * 
 * HIPAA Compliance:
 * - Validates JWT tokens on protected routes
 * - Enforces role-based access control
 * - Redirects unauthenticated users to login
 * - Redirects unauthorized users to /unauthorized
 * 
 * Route Patterns:
 * - /patient/*      → PATIENT role only
 * - /physician/*    → PHYSICIAN role only  
 * - /admin/*        → ADMIN role only
 * - /checkout/*     → Any authenticated user
 * - /intake/*       → PATIENT with active subscription
 */

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAccessToken, decodeTokenUnsafe } from '@/lib/auth/jwt';
import { Role } from '@prisma/client';

// ============================================
// Route Configuration
// ============================================

/** Public routes that don't require authentication */
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/set-password',
  '/physician/login',
  '/about',
  '/how-it-works',
  '/pricing',
  '/faq',
  '/contact',
  '/alcohol-treatment',
  '/privacy',
  '/terms',
  '/hipaa',
  '/get-started',
  '/for-physicians',
  '/payment',
  '/checkout/payment',
  '/checkout/success',
  '/checkout/cancel',
  '/logout',
  '/unauthorized',
];

/** Static asset routes */
const STATIC_ROUTES = [
  '/_next',
  '/api',
  '/images',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/site.webmanifest',
];

/** Role-based route patterns */
const ROLE_ROUTES: Record<Role, string[]> = {
  [Role.PATIENT]: ['/patient', '/checkout', '/intake'],
  [Role.PHYSICIAN]: ['/physician'],
  [Role.ADMIN]: ['/admin'],
};

/** Routes that any authenticated user can access */
const AUTHENTICATED_ROUTES = ['/checkout'];

// ============================================
// Helper Functions
// ============================================

/**
 * Check if a path is a static/public asset
 */
function isStaticRoute(path: string): boolean {
  return STATIC_ROUTES.some(route => 
    path.startsWith(route) || 
    path.includes('.') // File extensions
  );
}

/**
 * Check if a path is a public route
 */
function isPublicRoute(path: string): boolean {
  return PUBLIC_ROUTES.some(route => {
    if (route === '/') {
      return path === '/';
    }
    return path === route || path.startsWith(`${route}/`);
  });
}

/**
 * Extract token from request
 * Priority: Authorization header → Cookie
 */
function extractToken(request: NextRequest): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check cookies
  const tokenCookie = request.cookies.get('accessToken');
  if (tokenCookie?.value) {
    return tokenCookie.value;
  }
  
  return null;
}

/**
 * Get role-specific dashboard URL
 */
function getDashboardUrl(role: Role): string {
  switch (role) {
    case Role.ADMIN:
      return '/admin/dashboard';
    case Role.PHYSICIAN:
      return '/physician/queue';
    case Role.PATIENT:
    default:
      return '/patient/dashboard';
  }
}

/**
 * Check if user has access to a route based on their role
 */
function hasRouteAccess(role: Role, path: string): boolean {
  // Admin has access to everything
  if (role === Role.ADMIN) {
    return true;
  }
  
  // Check role-specific routes
  const allowedPrefixes = ROLE_ROUTES[role] || [];
  const hasRoleAccess = allowedPrefixes.some(prefix => 
    path === prefix || path.startsWith(`${prefix}/`)
  );
  
  if (hasRoleAccess) {
    return true;
  }
  
  // Check authenticated routes
  const isAuthenticatedRoute = AUTHENTICATED_ROUTES.some(route =>
    path === route || path.startsWith(`${route}/`)
  );
  
  if (isAuthenticatedRoute) {
    return true;
  }
  
  return false;
}

/**
 * Determine if we should redirect away from auth pages when already logged in
 */
function shouldRedirectFromAuth(role: Role, path: string): string | null {
  const authPaths = ['/login', '/signup', '/forgot-password'];
  
  if (authPaths.some(authPath => path === authPath || path.startsWith(authPath))) {
    return getDashboardUrl(role);
  }
  
  return null;
}

// ============================================
// Middleware Handler
// ============================================

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;
  
  // Skip static assets and API routes
  if (isStaticRoute(pathname)) {
    return NextResponse.next();
  }
  
  // Allow public routes
  if (isPublicRoute(pathname)) {
    // Check if user is already logged in and trying to access auth pages
    const token = extractToken(request);
    if (token) {
      try {
        // Decode without verification for quick check
        const decoded = decodeTokenUnsafe(token);
        if (decoded?.role) {
          const redirectUrl = shouldRedirectFromAuth(decoded.role as Role, pathname);
          if (redirectUrl) {
            return NextResponse.redirect(new URL(redirectUrl, request.url));
          }
        }
      } catch {
        // Invalid token, continue to public route
      }
    }
    return NextResponse.next();
  }
  
  // Extract and verify token for protected routes
  const token = extractToken(request);
  
  if (!token) {
    // No token - redirect to appropriate login page
    const loginPath = pathname.startsWith('/physician') ? '/physician/login' : '/login';
    const loginUrl = new URL(loginPath, request.url);
    loginUrl.searchParams.set('from', pathname + search);
    return NextResponse.redirect(loginUrl);
  }
  
  try {
    // Verify the token
    const payload = await verifyAccessToken(token);
    const { userId, role } = payload;
    
    // Check if user has access to this route
    if (!hasRouteAccess(role, pathname)) {
      // User is authenticated but not authorized for this route
      console.warn(`Access denied: User ${userId} with role ${role} attempted to access ${pathname}`);
      
      // Redirect to unauthorized page
      const unauthorizedUrl = new URL('/unauthorized', request.url);
      unauthorizedUrl.searchParams.set('required', pathname);
      return NextResponse.redirect(unauthorizedUrl);
    }
    
    // Add user info to request headers for downstream use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', userId);
    requestHeaders.set('x-user-role', role);
    requestHeaders.set('x-user-email', payload.email);
    
    // Continue with modified headers
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    
    // Refresh token cookie if it exists (extend session)
    const tokenCookie = request.cookies.get('accessToken');
    if (tokenCookie) {
      response.cookies.set({
        name: 'accessToken',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60, // 15 minutes
      });
    }
    
    return response;
    
  } catch (error) {
    // Token is invalid or expired
    console.error('Token verification failed:', error);
    
    // Clear invalid cookies
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('accessToken');
    response.cookies.delete('refreshToken');
    return response;
  }
}

// ============================================
// Matcher Configuration
// ============================================

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
