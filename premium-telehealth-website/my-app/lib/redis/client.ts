/**
 * Redis Client
 * Singleton instance for Redis operations
 * Used for: sessions, caching, rate limiting, queues
 *
 * Includes a circuit breaker that prevents cascading failures when Redis
 * is unavailable. After {@link CIRCUIT_BREAKER_THRESHOLD} consecutive
 * failures the circuit opens and all operations gracefully degrade for
 * {@link CIRCUIT_BREAKER_COOLDOWN_MS} milliseconds.
 *
 * HIPAA Compliance Notes:
 * - No PHI stored in cache keys (use hashed IDs)
 * - Encrypted session data
 * - TLS enabled for production
 */

import { Redis, RedisOptions } from 'ioredis';

// Redis connection configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
// TLS enabled if REDIS_TLS_ENABLED=true OR the URL uses rediss:// protocol
const REDIS_TLS_ENABLED = process.env.REDIS_TLS_ENABLED === 'true' || REDIS_URL.startsWith('rediss://');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

// Redis client singleton
let redis: Redis | null = null;

// ============================================
// Circuit Breaker
// ============================================

/** Number of consecutive failures before the circuit opens */
const CIRCUIT_BREAKER_THRESHOLD = 5;

/** How long the circuit stays open before allowing a probe request (ms) */
const CIRCUIT_BREAKER_COOLDOWN_MS = 30_000;

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreaker {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureTime: number;
}

const circuitBreaker: CircuitBreaker = {
  state: 'closed',
  consecutiveFailures: 0,
  lastFailureTime: 0,
};

/**
 * Get current circuit breaker state (for monitoring / health checks)
 */
export function getCircuitBreakerState(): {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureTime: number;
} {
  // Check if cooldown has expired while in open state
  if (
    circuitBreaker.state === 'open' &&
    Date.now() - circuitBreaker.lastFailureTime >= CIRCUIT_BREAKER_COOLDOWN_MS
  ) {
    circuitBreaker.state = 'half-open';
  }

  return {
    state: circuitBreaker.state,
    consecutiveFailures: circuitBreaker.consecutiveFailures,
    lastFailureTime: circuitBreaker.lastFailureTime,
  };
}

/**
 * Record a successful Redis operation.
 * Resets the circuit breaker to the closed state.
 */
export function recordSuccess(): void {
  if (circuitBreaker.state !== 'closed') {
    console.log('[Redis] Circuit breaker closed — connection recovered');
  }
  circuitBreaker.state = 'closed';
  circuitBreaker.consecutiveFailures = 0;
}

/**
 * Record a failed Redis operation.
 * After enough consecutive failures the circuit opens.
 */
export function recordFailure(): void {
  circuitBreaker.consecutiveFailures += 1;
  circuitBreaker.lastFailureTime = Date.now();

  if (circuitBreaker.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    if (circuitBreaker.state !== 'open') {
      console.error(
        `[Redis] Circuit breaker OPEN after ${circuitBreaker.consecutiveFailures} consecutive failures. ` +
        `Redis operations will be skipped for ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s.`
      );
    }
    circuitBreaker.state = 'open';
  }
}

/**
 * Check whether the circuit allows a request through.
 *
 * - **closed**: always allows
 * - **open**: blocks until cooldown expires, then transitions to half-open
 * - **half-open**: allows exactly one probe request
 *
 * @returns `true` if the operation should proceed, `false` to skip gracefully
 */
export function isCircuitClosed(): boolean {
  if (circuitBreaker.state === 'closed') {
    return true;
  }

  if (circuitBreaker.state === 'open') {
    const elapsed = Date.now() - circuitBreaker.lastFailureTime;
    if (elapsed >= CIRCUIT_BREAKER_COOLDOWN_MS) {
      // Transition to half-open — allow a single probe
      circuitBreaker.state = 'half-open';
      console.log('[Redis] Circuit breaker half-open — attempting probe request');
      return true;
    }
    return false;
  }

  // half-open: allow the probe through
  return true;
}

// ============================================
// Redis Client
// ============================================

/**
 * Get Redis client instance (singleton pattern)
 * Creates connection if doesn't exist, reuses existing otherwise
 */
export function getRedisClient(): Redis {
  if (!redis) {
    const options: RedisOptions = {
      // Retry with exponential backoff
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        console.log(`Redis retry attempt ${times}, delay: ${delay}ms`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      // Connection pool settings
      lazyConnect: false,
      keepAlive: 30000,
      // Timeout settings
      connectTimeout: 10000,
      commandTimeout: 5000,
    };

    // Add TLS configuration for production / Upstash
    if (REDIS_TLS_ENABLED) {
      options.tls = {
        rejectUnauthorized: false, // Required for Upstash and other managed Redis
      };
    }

    // Add password if provided
    if (REDIS_PASSWORD) {
      options.password = REDIS_PASSWORD;
    }

    redis = new Redis(REDIS_URL, options);

    // Event handlers
    redis.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });

    redis.on('ready', () => {
      console.log('[Redis] Client ready');
    });

    redis.on('error', (err) => {
      console.error('[Redis] Error:', err.message);
    });

    redis.on('close', () => {
      console.log('[Redis] Connection closed');
    });

    redis.on('reconnecting', () => {
      console.log('[Redis] Reconnecting...');
    });

    redis.on('end', () => {
      console.log('[Redis] Connection ended');
    });
  }

  return redis;
}

/**
 * Close Redis connection gracefully
 * Use this in cleanup handlers (e.g., process exit)
 */
export async function closeRedisConnection(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
      console.log('[Redis] Connection closed gracefully');
    } catch (error) {
      console.error('[Redis] Error closing connection:', error);
    } finally {
      redis = null;
    }
  }
}

/**
 * Check Redis health
 * Returns true if Redis is responsive, false otherwise
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const pong = await client.ping();
    return pong === 'PONG';
  } catch (error) {
    console.error('[Redis] Health check failed:', error);
    return false;
  }
}

/**
 * Get Redis connection status
 */
export function getRedisStatus(): {
  connected: boolean;
  ready: boolean;
} {
  if (!redis) {
    return { connected: false, ready: false };
  }
  return {
    connected: redis.status === 'connect' || redis.status === 'ready',
    ready: redis.status === 'ready',
  };
}

// Graceful shutdown handlers
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    console.log('[Redis] SIGTERM received, closing connection...');
    closeRedisConnection();
  });

  process.on('SIGINT', () => {
    console.log('[Redis] SIGINT received, closing connection...');
    closeRedisConnection();
  });
}

export default getRedisClient;
