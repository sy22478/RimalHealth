/**
 * Redis Client
 * Singleton instance for Redis operations
 * Used for: sessions, caching, rate limiting, queues
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
