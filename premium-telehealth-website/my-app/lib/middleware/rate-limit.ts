/**
 * Rate Limiting Middleware
 * Redis-based sliding window rate limiting for Next.js
 * 
 * HIPAA Compliance Notes:
 * - No PHI stored in rate limit keys (use hashed identifiers)
 * - IP addresses are transient and not logged with PHI
 * - General endpoints fail open (allow requests) if Redis is unavailable
 * - Auth-critical endpoints use an in-memory fallback (`useMemoryFallback`)
 *   to prevent brute-force attacks when Redis is down
 * 
 * @module lib/middleware/rate-limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis/client';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Configuration options for rate limiting
 */
export interface RateLimitConfig {
  /** Maximum requests allowed in the time window (default: 5) */
  requests: number;
  /** Window duration in milliseconds (default: 15 minutes) */
  windowMs: number;
  /** Redis key prefix for rate limit entries (default: 'ratelimit') */
  keyPrefix?: string;
  /**
   * When true, an in-memory Map-based rate limiter kicks in if Redis is
   * unavailable. This prevents brute-force attacks on auth-critical
   * endpoints even when Redis is down.
   *
   * Should ONLY be enabled for auth endpoints (login, password reset,
   * send-verification, verify-token, verify-email, MFA verify).
   * General API rate limiting can still fail open.
   *
   * @default false
   */
  useMemoryFallback?: boolean;
}

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Maximum requests allowed in the window */
  limit: number;
  /** Remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (seconds) when the current window resets */
  reset: number;
  /** Seconds to wait before retry (only present when rate limited) */
  retryAfter?: number;
}

/**
 * Rate limit presets for common use cases
 */
export interface RateLimitPresets {
  /** Auth endpoints: 5 requests per 15 minutes */
  auth: RateLimitConfig;
  /** General API: 100 requests per minute */
  api: RateLimitConfig;
  /** Strict: 3 requests per hour (for sensitive operations) */
  strict: RateLimitConfig;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: Required<RateLimitConfig> = {
  requests: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'ratelimit',
  useMemoryFallback: false,
};

// ============================================================================
// Preset Configurations
// ============================================================================

/**
 * Pre-configured rate limiting presets for common scenarios
 * 
 * @example
 * ```typescript
 * // Use auth preset for login endpoints
 * rateLimit(identifier, rateLimitPresets.auth);
 * 
 * // Use api preset for general API routes
 * rateLimit(identifier, rateLimitPresets.api);
 * ```
 */
export const rateLimitPresets: RateLimitPresets = {
  /**
   * Authentication endpoints preset
   * - 5 requests per 15 minutes
   * - In-memory fallback enabled (auth-critical)
   * - Use for: login, password reset, registration
   */
  auth: {
    requests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    keyPrefix: 'ratelimit:auth',
    useMemoryFallback: true,
  },

  /**
   * General API endpoints preset
   * - 100 requests per minute
   * - No memory fallback (fails open if Redis is down)
   * - Use for: general API consumption
   */
  api: {
    requests: 100,
    windowMs: 60 * 1000, // 1 minute
    keyPrefix: 'ratelimit:api',
  },

  /**
   * Strict rate limiting preset
   * - 3 requests per hour
   * - In-memory fallback enabled (auth-critical)
   * - Use for: sensitive operations, password changes, 2FA
   */
  strict: {
    requests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    keyPrefix: 'ratelimit:strict',
    useMemoryFallback: true,
  },
};

// ============================================================================
// In-Memory Fallback Rate Limiter
// ============================================================================

/**
 * Simple in-memory rate limiter used as a fallback when Redis is unavailable.
 * Only activated for auth-critical endpoints via `useMemoryFallback: true`.
 *
 * Uses a Map<string, { count, resetAt }> with periodic cleanup.
 * Not shared across server instances — acceptable for a last-resort
 * brute-force guard, not a substitute for Redis.
 */
interface MemoryBucket {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryBucket>();

/** Cleanup interval handle (lazy-initialized) */
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/** Cleanup every 60 seconds to avoid unbounded memory growth */
const CLEANUP_INTERVAL_MS = 60_000;

function ensureCleanupScheduled(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of memoryStore) {
      if (now >= bucket.resetAt) {
        memoryStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow the process to exit even if the interval is still running
  if (typeof cleanupInterval === 'object' && 'unref' in cleanupInterval) {
    cleanupInterval.unref();
  }
}

/**
 * Check rate limit using the in-memory store.
 * Returns same shape as the Redis-based rateLimit().
 */
function memoryRateLimit(
  identifier: string,
  config: Required<RateLimitConfig>
): RateLimitResult {
  ensureCleanupScheduled();

  const { requests: limit, windowMs, keyPrefix } = config;
  const key = `${keyPrefix}:${identifier}`;
  const now = Date.now();

  let bucket = memoryStore.get(key);

  // Expired or new — start a fresh window
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    memoryStore.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return {
      success: false,
      limit,
      remaining: 0,
      reset: Math.ceil(bucket.resetAt / 1000),
      retryAfter,
    };
  }

  return {
    success: true,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    reset: Math.ceil(bucket.resetAt / 1000),
  };
}

// Exported for testing
export { memoryStore as _memoryStoreForTesting };

// ============================================================================
// Core Rate Limit Function
// ============================================================================

/**
 * Check rate limit for a given identifier using sliding window algorithm
 * 
 * Uses Redis sorted sets (ZADD/ZREMRANGEBYSCORE) for efficient sliding window
 * tracking. Removes old entries outside the current window and counts
 * remaining entries to determine if the request should be allowed.
 * 
 * @param identifier - IP address or user ID to rate limit
 * @param config - Optional partial configuration (defaults merged)
 * @returns Promise<RateLimitResult> - Rate limit check result
 * 
 * @example
 * ```typescript
 * // Basic usage with defaults
 * const result = await rateLimit('192.168.1.1');
 * 
 * // With custom config
 * const result = await rateLimit('user-123', {
 *   requests: 10,
 *   windowMs: 60 * 1000,
 *   keyPrefix: 'custom'
 * });
 * 
 * // Using presets
 * const result = await rateLimit('192.168.1.1', rateLimitPresets.auth);
 * 
 * if (!result.success) {
 *   return new Response('Too Many Requests', {
 *     status: 429,
 *     headers: { 'Retry-After': String(result.retryAfter) }
 *   });
 * }
 * ```
 */
export async function rateLimit(
  identifier: string,
  config?: Partial<RateLimitConfig>
): Promise<RateLimitResult> {
  // Merge provided config with defaults
  const mergedConfig: Required<RateLimitConfig> = {
    requests: config?.requests ?? DEFAULT_CONFIG.requests,
    windowMs: config?.windowMs ?? DEFAULT_CONFIG.windowMs,
    keyPrefix: config?.keyPrefix ?? DEFAULT_CONFIG.keyPrefix,
    useMemoryFallback: config?.useMemoryFallback ?? false,
  };

  const { requests: limit, windowMs, keyPrefix } = mergedConfig;

  try {
    const redis = getRedisClient();
    const now = Date.now();
    const windowStart = now - windowMs;
    const key = `${keyPrefix}:${identifier}`;

    // Generate unique member for this request (timestamp + random suffix for uniqueness)
    const member = `${now}-${Math.random().toString(36).substring(2, 11)}`;

    // Start pipeline for atomic operations
    const pipeline = redis.pipeline();

    // Step 1: Remove entries outside the current window (older than windowStart)
    // ZREMRANGEBYSCORE removes all elements with score between 0 and windowStart
    pipeline.zremrangebyscore(key, 0, windowStart);

    // Step 2: Count current entries in the window
    // ZCARD returns the number of elements in the sorted set
    pipeline.zcard(key);

    // Execute the pipeline
    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Redis pipeline returned null');
    }

    // Extract count from pipeline results
    // results is an array of [error, result] tuples
    const countResult = results[1]; // Second command (zcard)
    if (countResult[0]) {
      throw countResult[0];
    }

    const currentCount = countResult[1] as number;

    // Step 3: Check if rate limit exceeded
    if (currentCount >= limit) {
      // Rate limited - get the oldest entry to calculate reset time
      const oldestEntries = await redis.zrange(key, 0, 0, 'WITHSCORES');
      
      let resetTime: number;
      if (oldestEntries.length >= 2) {
        // oldestEntries is [member, score, ...]
        const oldestTimestamp = parseInt(oldestEntries[1], 10);
        resetTime = Math.ceil((oldestTimestamp + windowMs) / 1000); // Convert to Unix seconds
      } else {
        // Fallback: reset based on current time + window
        resetTime = Math.ceil((now + windowMs) / 1000);
      }

      // Calculate retry after in seconds
      const retryAfter = Math.max(1, resetTime - Math.ceil(now / 1000));

      return {
        success: false,
        limit,
        remaining: 0,
        reset: resetTime,
        retryAfter,
      };
    }

    // Step 4: Add current request to the window
    // ZADD with current timestamp as score for sliding window
    await redis.zadd(key, now, member);

    // Step 5: Set expiration on the key to auto-cleanup
    // PEXPIRE sets TTL in milliseconds
    await redis.pexpire(key, windowMs);

    // Calculate reset time (when the current window will fully expire)
    // This is based on when the oldest entry in the window will expire
    const windowEntries = await redis.zrange(key, 0, 0, 'WITHSCORES');
    let resetTime: number;
    
    if (windowEntries.length >= 2) {
      const oldestTimestamp = parseInt(windowEntries[1], 10);
      resetTime = Math.ceil((oldestTimestamp + windowMs) / 1000);
    } else {
      resetTime = Math.ceil((now + windowMs) / 1000);
    }

    return {
      success: true,
      limit,
      remaining: Math.max(0, limit - currentCount - 1),
      reset: resetTime,
    };

  } catch (error) {
    // If useMemoryFallback is enabled (auth-critical endpoints), use the
    // in-memory rate limiter instead of failing open. This prevents
    // brute-force attacks when Redis is unavailable.
    if (mergedConfig.useMemoryFallback) {
      console.error('[RateLimit] Redis error, using in-memory fallback:', error instanceof Error ? error.message : 'Unknown error');
      return memoryRateLimit(identifier, mergedConfig);
    }

    // For non-critical endpoints: fail open (allow requests)
    // This ensures availability even if Redis is down
    console.error('[RateLimit] Redis error, allowing request:', error instanceof Error ? error.message : 'Unknown error');

    // Return success with conservative remaining count
    return {
      success: true,
      limit,
      remaining: 1, // Conservative: suggest only 1 request left
      reset: Math.ceil((Date.now() + windowMs) / 1000),
    };
  }
}

// ============================================================================
// Next.js Middleware Integration
// ============================================================================

/**
 * Extract client IP from NextRequest
 * 
 * Checks multiple headers to find the real client IP behind proxies:
 * 1. x-forwarded-for (standard proxy header)
 * 2. x-real-ip (NGINX, some proxies)
 * 3. request.ip (Vercel/Next.js built-in)
 * 
 * @param request - NextRequest object
 * @returns IP address string or 'unknown' if not found
 */
function getClientIP(request: NextRequest): string {
  // Check X-Forwarded-For header (may contain multiple IPs, take first)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    if (ips.length > 0 && ips[0]) {
      return ips[0];
    }
  }

  // Check X-Real-Ip header (NGINX, some proxies)
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback to request.ip (Vercel/Next.js)
  // Note: request.ip is available in Next.js middleware
  const requestIp = (request as NextRequest & { ip?: string }).ip;
  if (requestIp) {
    return requestIp;
  }

  // Final fallback - use 'unknown' as identifier
  // This will rate limit all requests with unknown IP together
  return 'unknown';
}

/**
 * Create rate limiting headers object from rate limit result
 */
function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
  };

  if (result.retryAfter !== undefined) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  return headers;
}

/**
 * Next.js middleware factory for rate limiting
 * 
 * Creates a middleware function that can be used in middleware.ts to
 * apply rate limiting to specific routes. Returns null if the request
 * is allowed, or a 429 NextResponse if rate limited.
 * 
 * @param config - Optional partial configuration
 * @returns Middleware function for NextRequest
 * 
 * @example
 * ```typescript
 * // middleware.ts
 * import { NextResponse } from 'next/server';
 * import { rateLimitMiddleware, rateLimitPresets } from '@/lib/middleware/rate-limit';
 * 
 * export async function middleware(request: NextRequest) {
 *   // Apply rate limiting to auth routes
 *   if (request.nextUrl.pathname.startsWith('/api/auth/')) {
 *     const rateLimitResponse = await rateLimitMiddleware(rateLimitPresets.auth)(request);
 *     if (rateLimitResponse) {
 *       return rateLimitResponse; // Request was rate limited
 *     }
 *   }
 *   
 *   return NextResponse.next();
 * }
 * 
 * export const config = {
 *   matcher: ['/api/:path*']
 * };
 * ```
 */
export function rateLimitMiddleware(
  config?: Partial<RateLimitConfig>
): (request: NextRequest) => Promise<NextResponse | null> {
  return async function(request: NextRequest): Promise<NextResponse | null> {
    const identifier = getClientIP(request);
    const result = await rateLimit(identifier, config);

    if (!result.success) {
      // Request is rate limited
      const headers = createRateLimitHeaders(result);
      
      return new NextResponse(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: result.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
        }
      );
    }

    // Request is allowed - return null to continue
    return null;
  };
}

/**
 * Next.js middleware with response header injection
 * 
 * Similar to rateLimitMiddleware but injects rate limit headers
 * into successful responses instead of returning null.
 * 
 * @param config - Optional partial configuration
 * @returns Middleware function that always returns a response
 * 
 * @example
 * ```typescript
 * // middleware.ts - with headers on all responses
 * import { rateLimitMiddlewareWithHeaders, rateLimitPresets } from '@/lib/middleware/rate-limit';
 * 
 * export async function middleware(request: NextRequest) {
 *   const response = await rateLimitMiddlewareWithHeaders(rateLimitPresets.api)(request);
 *   return response;
 * }
 * ```
 */
export function rateLimitMiddlewareWithHeaders(
  config?: Partial<RateLimitConfig>
): (request: NextRequest) => Promise<NextResponse> {
  return async function(request: NextRequest): Promise<NextResponse> {
    const identifier = getClientIP(request);
    const result = await rateLimit(identifier, config);

    const headers = createRateLimitHeaders(result);

    if (!result.success) {
      // Request is rate limited
      return new NextResponse(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: result.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
        }
      );
    }

    // Request is allowed - continue with headers
    const response = NextResponse.next();
    
    // Add rate limit headers to response
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  };
}

// ============================================================================
// Route Handler Wrapper
// ============================================================================

/**
 * Higher-order function to wrap API route handlers with rate limiting
 * 
 * Wraps a Next.js API route handler to apply rate limiting before
 * executing the handler logic. Returns 429 response if rate limited.
 * 
 * @param handler - API route handler function
 * @param config - Optional partial configuration
 * @returns Wrapped handler with rate limiting
 * 
 * @example
 * ```typescript
 * // app/api/auth/login/route.ts
 * import { withRateLimit, rateLimitPresets } from '@/lib/middleware/rate-limit';
 * import { getClientIP } from '@/lib/utils/ip'; // Your IP utility
 * 
 * async function loginHandler(request: Request) {
 *   // Your login logic here
 *   const body = await request.json();
 *   // ... authenticate user
 *   return Response.json({ success: true });
 * }
 * 
 * export const POST = withRateLimit(loginHandler, rateLimitPresets.auth);
 * ```
 * 
 * @example
 * ```typescript
 * // With custom identifier extraction
 * import { withRateLimit, rateLimitPresets } from '@/lib/middleware/rate-limit';
 * 
 * async function handler(request: Request) {
 *   return Response.json({ data: 'sensitive data' });
 * }
 * 
 * // Wrap with rate limiting
 * export const GET = withRateLimit(handler, {
 *   ...rateLimitPresets.api,
 *   keyPrefix: 'api:sensitive'
 * });
 * ```
 */
export function withRateLimit<T extends (...args: unknown[]) => Promise<Response>>(
  handler: T,
  config?: Partial<RateLimitConfig>
): T {
  return (async (...args: Parameters<T>): Promise<Response> => {
    const request = args[0] as Request;
    
    // Extract identifier from request
    let identifier: string;
    
    // Try to get IP from various sources
    if (request instanceof Request) {
      // Check headers for IP
      const forwardedFor = request.headers.get('x-forwarded-for');
      if (forwardedFor) {
        identifier = forwardedFor.split(',')[0].trim();
      } else {
        const realIp = request.headers.get('x-real-ip');
        identifier = realIp || 'unknown';
      }
    } else {
      identifier = 'unknown';
    }

    // Apply rate limiting
    const result = await rateLimit(identifier, config);

    if (!result.success) {
      // Rate limited - return 429 response
      const headers: Record<string, string> = createRateLimitHeaders(result);
      
      return new Response(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: result.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
        }
      );
    }

    // Execute the original handler
    const response = await handler(...args);
    
    // Add rate limit headers to successful response
    const headers = createRateLimitHeaders(result);
    if (response.headers) {
      Object.entries(headers).forEach(([key, value]) => {
        (response.headers as Headers).set(key, value);
      });
    }

    return response;
  }) as T;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Reset rate limit for a specific identifier
 * 
 * Deletes the rate limit entry from Redis, effectively resetting
 * the counter for the given identifier.
 * 
 * @param identifier - IP address or user ID
 * @param config - Optional partial configuration (for key prefix)
 * @returns Promise<boolean> - True if reset successful
 * 
 * @example
 * ```typescript
 * // Reset rate limit for a user after successful payment
 * await resetRateLimit('user-123', { keyPrefix: 'ratelimit:strict' });
 * ```
 */
export async function resetRateLimit(
  identifier: string,
  config?: Partial<Pick<RateLimitConfig, 'keyPrefix'>>
): Promise<boolean> {
  const keyPrefix = config?.keyPrefix ?? DEFAULT_CONFIG.keyPrefix;
  const key = `${keyPrefix}:${identifier}`;

  try {
    const redis = getRedisClient();
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('[RateLimit] Error resetting rate limit:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/**
 * Get current rate limit status for an identifier
 * 
 * Returns the current rate limit status without incrementing the counter.
 * Useful for displaying rate limit info to users.
 * 
 * @param identifier - IP address or user ID
 * @param config - Optional partial configuration
 * @returns Promise<Pick<RateLimitResult, 'limit' | 'remaining' | 'reset'> | null>
 * 
 * @example
 * ```typescript
 * // Check remaining quota before making a request
 * const status = await getRateLimitStatus('user-123', rateLimitPresets.api);
 * if (status && status.remaining === 0) {
 *   console.log('Rate limit reached, try again at:', new Date(status.reset * 1000));
 * }
 * ```
 */
export async function getRateLimitStatus(
  identifier: string,
  config?: Partial<RateLimitConfig>
): Promise<Pick<RateLimitResult, 'limit' | 'remaining' | 'reset'> | null> {
  const mergedConfig: Required<RateLimitConfig> = {
    requests: config?.requests ?? DEFAULT_CONFIG.requests,
    windowMs: config?.windowMs ?? DEFAULT_CONFIG.windowMs,
    keyPrefix: config?.keyPrefix ?? DEFAULT_CONFIG.keyPrefix,
    useMemoryFallback: config?.useMemoryFallback ?? false,
  };

  const { requests: limit, windowMs, keyPrefix } = mergedConfig;
  const key = `${keyPrefix}:${identifier}`;

  try {
    const redis = getRedisClient();
    const now = Date.now();
    const windowStart = now - windowMs;

    // Remove old entries
    await redis.zremrangebyscore(key, 0, windowStart);

    // Count current entries
    const currentCount = await redis.zcard(key);

    // Get reset time from oldest entry
    const windowEntries = await redis.zrange(key, 0, 0, 'WITHSCORES');
    let resetTime: number;
    
    if (windowEntries.length >= 2) {
      const oldestTimestamp = parseInt(windowEntries[1], 10);
      resetTime = Math.ceil((oldestTimestamp + windowMs) / 1000);
    } else {
      resetTime = Math.ceil((now + windowMs) / 1000);
    }

    return {
      limit,
      remaining: Math.max(0, limit - currentCount),
      reset: resetTime,
    };
  } catch (error) {
    console.error('[RateLimit] Error getting rate limit status:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  rateLimit,
  rateLimitMiddleware,
  rateLimitMiddlewareWithHeaders,
  withRateLimit,
  rateLimitPresets,
  resetRateLimit,
  getRateLimitStatus,
};
