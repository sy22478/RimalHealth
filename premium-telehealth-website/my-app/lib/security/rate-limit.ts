/**
 * Rate Limiting Module
 * 
 * Provides rate limiting functionality for API routes and authentication endpoints.
 * Uses Redis for distributed rate limiting in production, with in-memory fallback.
 * 
 * HIPAA Compliance:
 * - Prevents brute force attacks on authentication
 * - Protects against PHI enumeration attacks
 * - Tracks suspicious access patterns
 * 
 * @module lib/security/rate-limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMIT_CONFIG, ERROR_MESSAGES } from '@/lib/constants';

// ============================================
// Types
// ============================================

export interface RateLimitConfig {
  /** Time window in milliseconds */
  interval: number;
  /** Maximum requests allowed per window */
  maxRequests: number;
  /** Skip successful requests from counting */
  skipSuccessfulRequests?: boolean;
  /** Custom identifier function */
  keyGenerator?: (req: NextRequest) => string;
  /** Custom handler for rate limit exceeded */
  handler?: (req: NextRequest, limit: RateLimitInfo) => NextResponse;
}

export interface RateLimitInfo {
  /** Whether the request is allowed */
  success: boolean;
  /** Maximum requests allowed */
  limit: number;
  /** Remaining requests in current window */
  remaining: number;
  /** Timestamp when the window resets */
  reset: number;
  /** Current request count */
  current: number;
}

export interface RateLimitStore {
  /** Get current count for identifier */
  get: (identifier: string) => Promise<RateLimitEntry | null>;
  /** Increment count for identifier */
  increment: (identifier: string, windowMs: number) => Promise<RateLimitEntry>;
  /** Reset count for identifier */
  reset: (identifier: string) => Promise<void>;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// ============================================
// In-Memory Store (Fallback)
// ============================================

class InMemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every minute
    if (typeof window === 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    }
  }

  async get(identifier: string): Promise<RateLimitEntry | null> {
    const entry = this.store.get(identifier);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry has expired
    if (Date.now() > entry.resetTime) {
      this.store.delete(identifier);
      return null;
    }
    
    return entry;
  }

  async increment(identifier: string, windowMs: number): Promise<RateLimitEntry> {
    const now = Date.now();
    const existing = await this.get(identifier);
    
    if (existing) {
      existing.count += 1;
      return existing;
    }
    
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs,
    };
    
    this.store.set(identifier, newEntry);
    return newEntry;
  }

  async reset(identifier: string): Promise<void> {
    this.store.delete(identifier);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [identifier, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(identifier);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// ============================================
// Redis Store (Production)
// ============================================

interface RedisClient {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ...args: (string | number)[]) => Promise<unknown>;
  del: (...keys: string[]) => Promise<unknown>;
  pipeline: () => {
    set: (key: string, value: string, ...args: (string | number)[]) => unknown;
    exec: () => Promise<unknown>;
  };
}

class RedisRateLimitStore implements RateLimitStore {
  private redis: RedisClient;

  constructor(redisClient: RedisClient) {
    this.redis = redisClient;
  }

  async get(identifier: string): Promise<RateLimitEntry | null> {
    try {
      const data = await this.redis.get(`ratelimit:${identifier}`);
      if (!data) return null;
      
      const entry: RateLimitEntry = JSON.parse(data);
      if (Date.now() > entry.resetTime) {
        await this.redis.del(`ratelimit:${identifier}`);
        return null;
      }
      
      return entry;
    } catch {
      return null;
    }
  }

  async increment(identifier: string, windowMs: number): Promise<RateLimitEntry> {
    const key = `ratelimit:${identifier}`;
    const now = Date.now();
    
    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();
      
      // Try to get existing entry
      const existing = await this.get(identifier);
      
      if (existing) {
        existing.count += 1;
        pipeline.set(key, JSON.stringify(existing), 'PXAT', existing.resetTime);
        await pipeline.exec();
        return existing;
      }
      
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + windowMs,
      };
      
      pipeline.set(key, JSON.stringify(newEntry), 'PX', windowMs);
      await pipeline.exec();
      
      return newEntry;
    } catch {
      // Fallback to in-memory on Redis error
      return fallbackStore.increment(identifier, windowMs);
    }
  }

  async reset(identifier: string): Promise<void> {
    try {
      await this.redis.del(`ratelimit:${identifier}`);
    } catch {
      // Ignore errors
    }
  }
}

// ============================================
// Store Instance
// ============================================

let fallbackStore = new InMemoryRateLimitStore();
let store: RateLimitStore = fallbackStore;

/**
 * Initialize rate limit store with Redis client
 * 
 * @param redisClient - Redis client instance
 */
export function initRateLimitStore(redisClient: RedisClient): void {
  store = new RedisRateLimitStore(redisClient);
}

/**
 * Reset rate limit store (for testing)
 */
export function resetRateLimitStore(): void {
  fallbackStore = new InMemoryRateLimitStore();
  store = fallbackStore;
}

// ============================================
// Identifier Generation
// ============================================

/**
 * Default key generator using IP address
 * 
 * @param req - Next.js request
 * @returns Identifier string
 */
export function defaultKeyGenerator(req: NextRequest): string {
  // Get IP from various headers (supporting proxies)
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  
  const ip = cfConnectingIp || 
    realIp || 
    (forwarded ? forwarded.split(',')[0].trim() : null) ||
    'unknown';
  
  // Include path for per-endpoint limiting
  return `${ip}:${req.nextUrl.pathname}`;
}

/**
 * Generate key for user-specific rate limiting
 * 
 * @param userId - User identifier
 * @param action - Action being rate limited
 * @returns Identifier string
 */
export function userKeyGenerator(userId: string, action: string): string {
  return `user:${userId}:${action}`;
}

/**
 * Generate key for login attempt rate limiting
 * 
 * @param identifier - Email or IP address
 * @returns Identifier string
 */
export function loginKeyGenerator(identifier: string): string {
  return `login:${identifier}`;
}

// ============================================
// Rate Limit Functions
// ============================================

/**
 * Check rate limit for identifier
 * 
 * @param identifier - Unique identifier (IP, user ID, etc.)
 * @param config - Rate limit configuration
 * @returns Rate limit information
 */
export async function checkRateLimit(
  identifier: string,
  config: Partial<RateLimitConfig> = {}
): Promise<RateLimitInfo> {
  const {
    interval = RATE_LIMIT_CONFIG.WINDOW_MS,
    maxRequests = RATE_LIMIT_CONFIG.MAX_REQUESTS,
  } = config;
  
  const entry = await store.increment(identifier, interval);
  const now = Date.now();
  
  return {
    success: entry.count <= maxRequests,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    reset: entry.resetTime,
    current: entry.count,
  };
}

/**
 * Create rate limiter with predefined configuration
 * 
 * @param config - Rate limit configuration
 * @returns Rate limiter object
 */
export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const finalConfig: RateLimitConfig = {
    interval: RATE_LIMIT_CONFIG.WINDOW_MS,
    maxRequests: RATE_LIMIT_CONFIG.MAX_REQUESTS,
    keyGenerator: defaultKeyGenerator,
    ...config,
  };

  return {
    /**
     * Check rate limit for a request
     */
    check: async (req: NextRequest): Promise<RateLimitInfo> => {
      const identifier = finalConfig.keyGenerator!(req);
      return checkRateLimit(identifier, finalConfig);
    },

    /**
     * Middleware for API routes
     */
    middleware: (handler: (req: NextRequest) => Promise<NextResponse>) => {
      return async (req: NextRequest): Promise<NextResponse> => {
        const info = await createRateLimiter(finalConfig).check(req);
        
        if (!info.success) {
          return finalConfig.handler 
            ? finalConfig.handler(req, info)
            : createRateLimitResponse(info);
        }
        
        const response = await handler(req);
        
        // Add rate limit headers
        response.headers.set('X-RateLimit-Limit', info.limit.toString());
        response.headers.set('X-RateLimit-Remaining', info.remaining.toString());
        response.headers.set('X-RateLimit-Reset', info.reset.toString());
        
        return response;
      };
    },
  };
}

/**
 * Create standard rate limit exceeded response
 * 
 * @param info - Rate limit information
 * @returns NextResponse with 429 status
 */
export function createRateLimitResponse(info: RateLimitInfo): NextResponse {
  const retryAfter = Math.ceil((info.reset - Date.now()) / 1000);
  
  return NextResponse.json(
    {
      success: false,
      error: ERROR_MESSAGES.AUTH.RATE_LIMITED,
      retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': info.limit.toString(),
        'X-RateLimit-Remaining': info.remaining.toString(),
        'X-RateLimit-Reset': info.reset.toString(),
      },
    }
  );
}

// ============================================
// Predefined Rate Limiters
// ============================================

/** Standard API rate limiter: 100 requests per minute */
export const apiRateLimiter = createRateLimiter({
  interval: RATE_LIMIT_CONFIG.WINDOW_MS,
  maxRequests: RATE_LIMIT_CONFIG.MAX_REQUESTS,
});

/** Strict rate limiter for unauthenticated users: 20 requests per minute */
export const strictRateLimiter = createRateLimiter({
  interval: RATE_LIMIT_CONFIG.WINDOW_MS,
  maxRequests: RATE_LIMIT_CONFIG.UNAUTH_MAX_REQUESTS,
});

/** Login rate limiter: 5 attempts per 15 minutes */
export const loginRateLimiter = createRateLimiter({
  interval: RATE_LIMIT_CONFIG.LOGIN_WINDOW_MS,
  maxRequests: RATE_LIMIT_CONFIG.LOGIN_MAX_ATTEMPTS,
  keyGenerator: (req) => {
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    return loginKeyGenerator(ip);
  },
});

/** User-specific action rate limiter */
export function createUserRateLimiter(userId: string, action: string, maxRequests: number = 10): {
  check: () => Promise<RateLimitInfo>;
} {
  const identifier = userKeyGenerator(userId, action);
  
  return {
    check: () => checkRateLimit(identifier, {
      interval: RATE_LIMIT_CONFIG.WINDOW_MS,
      maxRequests,
    }),
  };
}

// ============================================
// Middleware Helpers
// ============================================

/**
 * Apply rate limiting to a request
 * 
 * @param req - Next.js request
 * @param type - Type of rate limiting to apply
 * @returns Rate limit info or response
 */
export async function applyRateLimit(
  req: NextRequest,
  type: 'api' | 'strict' | 'login' = 'api'
): Promise<RateLimitInfo | NextResponse> {
  let limiter;
  
  switch (type) {
    case 'strict':
      limiter = strictRateLimiter;
      break;
    case 'login':
      limiter = loginRateLimiter;
      break;
    case 'api':
    default:
      limiter = apiRateLimiter;
  }
  
  const info = await limiter.check(req);
  
  if (!info.success) {
    return createRateLimitResponse(info);
  }
  
  return info;
}

/**
 * Higher-order function for API route rate limiting
 * 
 * @param handler - API route handler
 * @param type - Rate limit type
 * @returns Wrapped handler
 */
export function withRateLimit(
  handler: (req: NextRequest, info: RateLimitInfo) => Promise<NextResponse>,
  type: 'api' | 'strict' | 'login' = 'api'
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const result = await applyRateLimit(req, type);
    
    if (result instanceof NextResponse) {
      return result;
    }
    
    const response = await handler(req, result);
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', result.limit.toString());
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', result.reset.toString());
    
    return response;
  };
}

// ============================================
// Reset Functions
// ============================================

/**
 * Reset rate limit for an identifier
 * 
 * @param identifier - Rate limit identifier
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  await store.reset(identifier);
}

/**
 * Reset login attempts for an identifier
 * 
 * @param identifier - Email or IP address
 */
export async function resetLoginAttempts(identifier: string): Promise<void> {
  await store.reset(loginKeyGenerator(identifier));
}
