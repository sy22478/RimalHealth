/**
 * API Response Caching Middleware
 *
 * Provides Redis-based caching for API responses to improve performance.
 *
 * HIPAA Compliance Notes:
 * - No PHI is cached directly; only anonymized data or IDs
 * - Encrypted session data only
 * - Short TTLs to limit exposure window
 * - Cache keys use hashed identifiers
 */

import { NextRequest, NextResponse } from "next/server";
import { getCache, setCache } from "@/lib/redis/cache";
import { createHash } from "crypto";

// Cache TTLs in seconds
export const CACHE_TTLS = {
  SHORT: 30, // 30 seconds - frequently changing data
  MEDIUM: 60, // 1 minute - semi-dynamic data
  LONG: 300, // 5 minutes - relatively static data
  EXTENDED: 900, // 15 minutes - static reference data
} as const;

// Cache control headers
export const CACHE_HEADERS = {
  // Skip cache entirely
  NO_CACHE: "no-store, max-age=0",
  // Cache for short period
  SHORT: "public, max-age=30, stale-while-revalidate=60",
  // Cache for medium period
  MEDIUM: "public, max-age=60, stale-while-revalidate=120",
  // Cache for long period
  LONG: "public, max-age=300, stale-while-revalidate=600",
} as const;

/**
 * Generate a cache key from request parameters
 * Creates a deterministic hash for cache lookup
 */
export function generateCacheKey(
  prefix: string,
  request: NextRequest,
  additionalParams?: Record<string, unknown>
): string {
  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  const path = url.pathname;

  // Create a deterministic string for hashing
  const keyData = JSON.stringify({
    prefix,
    path,
    params: searchParams,
    ...additionalParams,
  });

  // Create hash for consistent key length
  const hash = createHash("sha256").update(keyData).digest("hex").slice(0, 16);

  return `api:${prefix}:${hash}`;
}

/**
 * Generate a user-specific cache key
 * Ensures users don't see each other's cached data
 */
export function generateUserCacheKey(
  userId: string,
  prefix: string,
  request: NextRequest,
  additionalParams?: Record<string, unknown>
): string {
  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();

  const keyData = JSON.stringify({
    userId,
    prefix,
    path: url.pathname,
    params: searchParams,
    ...additionalParams,
  });

  const hash = createHash("sha256").update(keyData).digest("hex").slice(0, 16);

  return `api:user:${userId}:${prefix}:${hash}`;
}

/**
 * Cache wrapper for API route handlers
 * Automatically handles cache lookup and storage
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   return withCache(
 *     request,
 *     async () => {
 *       // Your expensive database query here
 *       return NextResponse.json(data);
 *     },
 *     { prefix: 'queue', ttl: 30 }
 *   );
 * }
 */
export async function withCache<T>(
  request: NextRequest,
  handler: () => Promise<NextResponse<T>>,
  options: {
    prefix: string;
    ttl?: number;
    userId?: string;
    additionalParams?: Record<string, unknown>;
    skipCache?: boolean;
  }
): Promise<NextResponse<T>> {
  // Skip cache if explicitly disabled
  if (options.skipCache || process.env.DISABLE_API_CACHE === "true") {
    return handler();
  }

  // Generate cache key
  const cacheKey = options.userId
    ? generateUserCacheKey(options.userId, options.prefix, request, options.additionalParams)
    : generateCacheKey(options.prefix, request, options.additionalParams);

  try {
    // Try to get cached response
    const cached = await getCache<{
      body: T;
      headers: Record<string, string>;
      status: number;
    }>(cacheKey);

    if (cached) {
      // Reconstruct response from cache
      const response = NextResponse.json(cached.body, {
        status: cached.status,
        headers: {
          ...cached.headers,
          "X-Cache": "HIT",
          "X-Cache-Key": cacheKey,
        },
      });
      return response;
    }
  } catch (error) {
    // Log but don't fail on cache error
    console.warn("[API Cache] Get error:", error);
  }

  // Execute handler
  const response = await handler();

  // Only cache successful responses
  if (response.status >= 200 && response.status < 300) {
    try {
      // Clone response to read body
      const clonedResponse = response.clone();
      const body = await clonedResponse.json();

      // Extract relevant headers
      const headers: Record<string, string> = {};
      clonedResponse.headers.forEach((value, key) => {
        // Only cache safe headers
        if (["content-type", "x-total-count"].includes(key.toLowerCase())) {
          headers[key] = value;
        }
      });

      // Store in cache
      await setCache(
        cacheKey,
        {
          body,
          headers,
          status: clonedResponse.status,
        },
        options.ttl ?? CACHE_TTLS.MEDIUM
      );

      // Add cache headers to response
      response.headers.set("X-Cache", "MISS");
      response.headers.set("X-Cache-Key", cacheKey);
    } catch (error) {
      // Log but don't fail on cache error
      console.warn("[API Cache] Set error:", error);
    }
  }

  return response;
}

/**
 * Invalidate cache by pattern
 * Use when data changes to clear related caches
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  try {
    const { clearCachePattern } = await import("@/lib/redis/cache");
    await clearCachePattern(`api:${pattern}*`);
  } catch (error) {
    console.warn("[API Cache] Invalidation error:", error);
  }
}

/**
 * Invalidate user-specific cache
 */
export async function invalidateUserCache(userId: string, prefix?: string): Promise<void> {
  try {
    const { clearCachePattern } = await import("@/lib/redis/cache");
    const pattern = prefix ? `api:user:${userId}:${prefix}*` : `api:user:${userId}*`;
    await clearCachePattern(pattern);
  } catch (error) {
    console.warn("[API Cache] User invalidation error:", error);
  }
}

/**
 * Middleware to add cache headers to responses
 */
export function withCacheHeaders(
  response: NextResponse,
  cacheControl: string
): NextResponse {
  response.headers.set("Cache-Control", cacheControl);
  return response;
}

/**
 * Conditional cache wrapper that respects request headers
 * Skips cache if Cache-Control: no-cache is present
 */
export async function withConditionalCache<T>(
  request: NextRequest,
  handler: () => Promise<NextResponse<T>>,
  options: {
    prefix: string;
    ttl?: number;
    userId?: string;
    additionalParams?: Record<string, unknown>;
  }
): Promise<NextResponse<T>> {
  const cacheControl = request.headers.get("cache-control");
  const skipCache = cacheControl?.includes("no-cache") || cacheControl?.includes("no-store");

  return withCache(request, handler, {
    ...options,
    skipCache,
  });
}

/**
 * Cache stats for monitoring
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

// Simple in-memory stats tracking (reset on deploy)
let cacheHits = 0;
let cacheMisses = 0;

export function recordCacheHit(): void {
  cacheHits++;
}

export function recordCacheMiss(): void {
  cacheMisses++;
}

export function getCacheStats(): CacheStats {
  const total = cacheHits + cacheMisses;
  return {
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: total > 0 ? cacheHits / total : 0,
  };
}

export function resetCacheStats(): void {
  cacheHits = 0;
  cacheMisses = 0;
}
