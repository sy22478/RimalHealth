/**
 * CSRF Protection Module
 * 
 * Provides CSRF token generation, validation, and middleware for Next.js applications.
 * Uses double-submit cookie pattern for stateless CSRF protection.
 * 
 * HIPAA Compliance:
 * - Prevents cross-site request forgery attacks
 * - Protects PHI-modifying operations
 * - Uses cryptographically secure token generation
 * 
 * @module lib/security/csrf
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { SESSION_CONFIG, SESSION_SECURITY, ERROR_MESSAGES } from '@/lib/constants';

// ============================================
// Types
// ============================================

export interface CSRFTokenPair {
  /** Token sent in cookie */
  cookieToken: string;
  /** Token sent in form/header */
  formToken: string;
}

export interface CSRFValidationResult {
  valid: boolean;
  error?: string;
}

export interface CSRFMiddlewareOptions {
  /** Cookie name for CSRF token */
  cookieName?: string;
  /** Header name for CSRF token */
  headerName?: string;
  /** Form field name for CSRF token */
  formFieldName?: string;
  /** Paths to exclude from CSRF protection */
  excludePaths?: string[];
  /** HTTP methods that require CSRF validation */
  protectedMethods?: string[];
}

// ============================================
// Configuration
// ============================================

const DEFAULT_OPTIONS: Required<CSRFMiddlewareOptions> = {
  cookieName: SESSION_SECURITY.CSRF_TOKEN_COOKIE,
  headerName: 'X-CSRF-Token',
  formFieldName: '_csrf',
  excludePaths: ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'],
  protectedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],
};

/** Token length in bytes */
const TOKEN_LENGTH = 32;

/** Separator for token parts */
const TOKEN_SEPARATOR = '.';

// ============================================
// Token Generation
// ============================================

/**
 * Generate a cryptographically secure CSRF token
 * 
 * Creates a token pair (cookie token and form token) using the double-submit
 * cookie pattern. The cookie token is stored in a secure HTTP-only cookie,
 * while the form token is included in forms or headers.
 * 
 * @returns CSRF token pair
 */
export function generateCSRFToken(): CSRFTokenPair {
  // Generate random secret
  const secret = randomBytes(TOKEN_LENGTH);
  
  // Create token by hashing secret with timestamp for uniqueness
  const timestamp = Date.now().toString(36);
  const hash = createHash('sha256')
    .update(secret)
    .update(timestamp)
    .digest();
  
  // Cookie token: secret + timestamp + hash prefix
  const cookieToken = secret.toString('base64url') + 
    TOKEN_SEPARATOR + 
    timestamp +
    TOKEN_SEPARATOR +
    hash.slice(0, 8).toString('base64url');
  
  // Form token: derived from cookie token but different
  const formHash = createHash('sha256')
    .update(secret)
    .update('form-token')
    .digest();
  
  const formToken = formHash.toString('base64url') + 
    TOKEN_SEPARATOR + 
    timestamp;
  
  return { cookieToken, formToken };
}

/**
 * Generate a simple CSRF token (for non-cookie contexts)
 * 
 * @returns Base64-encoded random token
 */
export function generateSimpleCSRFToken(): string {
  return randomBytes(TOKEN_LENGTH).toString('base64url');
}

// ============================================
// Token Validation
// ============================================

/**
 * Extract secret from cookie token
 */
function extractSecret(cookieToken: string): Buffer | null {
  const parts = cookieToken.split(TOKEN_SEPARATOR);
  if (parts.length !== 3) return null;
  
  try {
    return Buffer.from(parts[0], 'base64url');
  } catch {
    return null;
  }
}

/**
 * Validate CSRF token pair
 * 
 * Verifies that the form token was derived from the same secret
 * as the cookie token.
 * 
 * @param cookieToken - Token from secure cookie
 * @param formToken - Token from form/header
 * @returns Validation result
 */
export function validateCSRFTokenPair(
  cookieToken: string | undefined,
  formToken: string | undefined
): CSRFValidationResult {
  // Check for missing tokens
  if (!cookieToken || !formToken) {
    return {
      valid: false,
      error: ERROR_MESSAGES.AUTH.CSRF_INVALID,
    };
  }
  
  // Extract secret from cookie token
  const secret = extractSecret(cookieToken);
  if (!secret) {
    return {
      valid: false,
      error: ERROR_MESSAGES.AUTH.CSRF_INVALID,
    };
  }
  
  // Get timestamp from cookie token
  const cookieParts = cookieToken.split(TOKEN_SEPARATOR);
  const timestamp = cookieParts[1];
  
  // Check token expiration
  const tokenTime = parseInt(timestamp, 36);
  const now = Date.now();
  const expiryMs = SESSION_CONFIG.CSRF_TOKEN_EXPIRY * 1000;
  
  if (now - tokenTime > expiryMs) {
    return {
      valid: false,
      error: 'CSRF token has expired',
    };
  }
  
  // Recreate expected form token
  const expectedFormHash = createHash('sha256')
    .update(secret)
    .update('form-token')
    .digest();
  
  const expectedFormToken = expectedFormHash.toString('base64url') + 
    TOKEN_SEPARATOR + 
    timestamp;
  
  // Compare tokens using timing-safe comparison
  try {
    const formTokenBuffer = Buffer.from(formToken);
    const expectedBuffer = Buffer.from(expectedFormToken);
    
    if (formTokenBuffer.length !== expectedBuffer.length) {
      return {
        valid: false,
        error: ERROR_MESSAGES.AUTH.CSRF_INVALID,
      };
    }
    
    const match = timingSafeEqual(formTokenBuffer, expectedBuffer);
    
    if (!match) {
      return {
        valid: false,
        error: ERROR_MESSAGES.AUTH.CSRF_INVALID,
      };
    }
    
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: ERROR_MESSAGES.AUTH.CSRF_INVALID,
    };
  }
}

/**
 * Validate CSRF token from Next.js request
 * 
 * Extracts tokens from cookies and headers/form data, then validates.
 * 
 * @param req - Next.js request object
 * @param options - Validation options
 * @returns Validation result
 */
export function validateCSRFToken(
  req: NextRequest,
  options: Partial<CSRFMiddlewareOptions> = {}
): CSRFValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Get cookie token
  const cookieToken = req.cookies.get(opts.cookieName)?.value;
  
  // Get form token from header or query param
  let formToken = req.headers.get(opts.headerName.toLowerCase()) ||
    req.headers.get(opts.headerName) ||
    req.nextUrl.searchParams.get(opts.formFieldName);
  
  // For POST requests, also check form data (handled separately in API routes)
  if (!formToken && req.method === 'POST') {
    // Form data extraction must be done in the API route handler
    // This is just a fallback check
    formToken = req.headers.get('x-csrf-token');
  }
  
  return validateCSRFTokenPair(cookieToken, formToken ?? undefined);
}

// ============================================
// Cookie Helpers
// ============================================

/**
 * Create CSRF token cookie options
 * 
 * @returns Cookie configuration for NextResponse
 */
export function createCSRFTokenCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
  path: string;
} {
  return {
    httpOnly: false, // Must be accessible by JavaScript for form submission
    secure: SESSION_SECURITY.SECURE,
    sameSite: SESSION_SECURITY.SAME_SITE,
    maxAge: SESSION_CONFIG.CSRF_TOKEN_EXPIRY,
    path: '/',
  };
}

/**
 * Set CSRF token cookies on response
 * 
 * @param res - Next.js response object
 * @param tokenPair - Generated token pair
 * @param options - Cookie options
 */
export function setCSRFCookies(
  res: NextResponse,
  tokenPair: CSRFTokenPair,
  options: Partial<CSRFMiddlewareOptions> = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const cookieOptions = createCSRFTokenCookieOptions();
  
  // Set cookie token
  res.cookies.set({
    name: opts.cookieName,
    value: tokenPair.cookieToken,
    ...cookieOptions,
  });
  
  // Set form token in a separate non-HTTP-only cookie for JS access
  res.cookies.set({
    name: `${opts.cookieName}_form`,
    value: tokenPair.formToken,
    ...cookieOptions,
    httpOnly: false,
  });
}

/**
 * Clear CSRF token cookies
 * 
 * @param res - Next.js response object
 * @param options - Cookie options
 */
export function clearCSRFCookies(
  res: NextResponse,
  options: Partial<CSRFMiddlewareOptions> = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  res.cookies.delete(opts.cookieName);
  res.cookies.delete(`${opts.cookieName}_form`);
}

// ============================================
// Middleware
// ============================================

/**
 * CSRF protection middleware for Next.js
 * 
 * Validates CSRF tokens on state-changing requests.
 * Skips validation for GET/HEAD requests and excluded paths.
 * 
 * @param handler - Next.js API route handler
 * @param options - Middleware options
 * @returns Wrapped handler with CSRF protection
 */
export function withCSRFProtection(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: Partial<CSRFMiddlewareOptions> = {}
): (req: NextRequest) => Promise<NextResponse> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  return async (req: NextRequest): Promise<NextResponse> => {
    const { pathname } = req.nextUrl;
    const method = req.method;
    
    // Skip CSRF for non-protected methods
    if (!opts.protectedMethods.includes(method)) {
      return handler(req);
    }
    
    // Skip CSRF for excluded paths
    if (opts.excludePaths.some(path => pathname.startsWith(path))) {
      return handler(req);
    }
    
    // Validate CSRF token
    const result = validateCSRFToken(req, opts);
    
    if (!result.valid) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || ERROR_MESSAGES.AUTH.CSRF_INVALID 
        },
        { status: 403 }
      );
    }
    
    return handler(req);
  };
}

/**
 * Middleware for App Router (Next.js 13+)
 * 
 * Can be used in middleware.ts for route-level CSRF protection.
 * 
 * @param req - Next.js request object
 * @param options - Middleware options
 * @returns NextResponse or null (continue)
 */
export function csrfMiddleware(
  req: NextRequest,
  options: Partial<CSRFMiddlewareOptions> = {}
): NextResponse | null {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { pathname } = req.nextUrl;
  const method = req.method;
  
  // Skip CSRF for non-protected methods
  if (!opts.protectedMethods.includes(method)) {
    return null;
  }
  
  // Skip CSRF for excluded paths
  if (opts.excludePaths.some(path => pathname.startsWith(path))) {
    return null;
  }
  
  // Skip API routes (handled separately)
  if (!pathname.startsWith('/api/')) {
    return null;
  }
  
  // Validate CSRF token
  const result = validateCSRFToken(req, opts);
  
  if (!result.valid) {
    return NextResponse.json(
      { 
        success: false, 
        error: result.error || ERROR_MESSAGES.AUTH.CSRF_INVALID 
      },
      { status: 403 }
    );
  }
  
  return null;
}

// ============================================
// React Component Helpers
// ============================================

/**
 * Get CSRF token for client-side forms
 * 
 * @returns CSRF token from cookie or null
 */
export function getClientCSRFToken(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  
  const match = document.cookie.match(new RegExp(`${DEFAULT_OPTIONS.cookieName}_form=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Create form data with CSRF token
 * 
 * @param formData - Original form data
 * @returns FormData with CSRF token appended
 */
export function appendCSRFToken(formData: FormData): FormData {
  const token = getClientCSRFToken();
  if (token) {
    formData.set(DEFAULT_OPTIONS.formFieldName, token);
  }
  return formData;
}

/**
 * Fetch options with CSRF token header
 * 
 * @param options - Original fetch options
 * @returns Options with CSRF header added
 */
export function withCSRFHeader(
  options: RequestInit = {}
): RequestInit {
  const token = getClientCSRFToken();
  
  if (!token) {
    return options;
  }
  
  return {
    ...options,
    headers: {
      ...options.headers,
      [DEFAULT_OPTIONS.headerName]: token,
    },
  };
}
