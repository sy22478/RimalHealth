/**
 * Cache Utilities
 * Helper functions for caching data in Redis
 *
 * All read/write operations go through the circuit breaker so that a
 * Redis outage does not cascade into application-level failures.
 *
 * HIPAA Compliance Notes:
 * - Never cache PHI directly; use encrypted or anonymized data
 * - Set appropriate TTLs to limit data exposure window
 * - Use hashed identifiers in cache keys
 */

import { getRedisClient, isCircuitClosed, recordSuccess, recordFailure } from './client';
import { createHash } from 'crypto';

// Default cache TTL: 5 minutes
const DEFAULT_CACHE_TTL = 300;

// Maximum cache key length (Redis limit is 512MB, but we keep it reasonable)
const MAX_KEY_LENGTH = 250;

/**
 * Generate a safe cache key
 * Ensures key length stays within Redis limits
 */
function sanitizeKey(key: string): string {
  // Remove potentially problematic characters
  const sanitized = key.replace(/[\s\n\r\x00]/g, '_');

  // Truncate if too long (use hash for end to maintain uniqueness)
  if (sanitized.length > MAX_KEY_LENGTH) {
    const hash = createHash('sha256')
      .update(sanitized)
      .digest('hex')
      .slice(0, 16);
    return sanitized.slice(0, MAX_KEY_LENGTH - 17) + '_' + hash;
  }

  return sanitized;
}

/**
 * Get cached value
 * Returns parsed JSON value or null if not found/expired.
 * Returns null gracefully when the circuit breaker is open.
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!isCircuitClosed()) {
    return null;
  }

  try {
    const client = getRedisClient();
    const safeKey = sanitizeKey(key);
    const data = await client.get(safeKey);

    recordSuccess();

    if (!data) {
      return null;
    }

    return JSON.parse(data) as T;
  } catch (error) {
    recordFailure();
    console.error('[Cache] Get error:', error);
    return null;
  }
}

/**
 * Set cached value with optional TTL
 * TTL in seconds, defaults to 5 minutes.
 * Silently skips when the circuit breaker is open.
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_CACHE_TTL
): Promise<void> {
  if (!isCircuitClosed()) {
    return;
  }

  try {
    const client = getRedisClient();
    const safeKey = sanitizeKey(key);
    const serialized = JSON.stringify(value);

    await client.setex(safeKey, ttlSeconds, serialized);
    recordSuccess();
  } catch (error) {
    recordFailure();
    console.error('[Cache] Set error:', error);
    // Graceful degradation — don't throw, cache is best-effort
  }
}

/**
 * Set cached value only if key doesn't exist (NX - Not eXists)
 * Useful for distributed locking or one-time initialization.
 * Returns false gracefully when the circuit breaker is open.
 */
export async function setCacheNX<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_CACHE_TTL
): Promise<boolean> {
  if (!isCircuitClosed()) {
    return false;
  }

  try {
    const client = getRedisClient();
    const safeKey = sanitizeKey(key);
    const serialized = JSON.stringify(value);

    const result = await client.set(safeKey, serialized, 'EX', ttlSeconds, 'NX');
    recordSuccess();
    return result === 'OK';
  } catch (error) {
    recordFailure();
    console.error('[Cache] SetNX error:', error);
    return false;
  }
}

/**
 * Delete cached value.
 * Silently skips when the circuit breaker is open.
 */
export async function deleteCache(key: string): Promise<void> {
  if (!isCircuitClosed()) {
    return;
  }

  try {
    const client = getRedisClient();
    const safeKey = sanitizeKey(key);
    await client.del(safeKey);
    recordSuccess();
  } catch (error) {
    recordFailure();
    console.error('[Cache] Delete error:', error);
    // Graceful degradation — don't throw, cache is best-effort
  }
}

/**
 * Clear cache by pattern using Redis SCAN
 * Warning: Can be slow on large datasets, use with caution.
 * Returns 0 gracefully when the circuit breaker is open.
 */
export async function clearCachePattern(pattern: string): Promise<number> {
  if (!isCircuitClosed()) {
    return 0;
  }

  try {
    const client = getRedisClient();
    const safePattern = sanitizeKey(pattern);
    let cursor = '0';
    let deletedCount = 0;
    const BATCH_SIZE = 100;

    // Use SCAN instead of KEYS for production safety
    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        safePattern,
        'COUNT',
        BATCH_SIZE
      );

      cursor = nextCursor;

      if (keys.length > 0) {
        await client.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== '0');

    recordSuccess();
    console.log(`[Cache] Cleared ${deletedCount} keys matching pattern: ${pattern}`);
    return deletedCount;
  } catch (error) {
    recordFailure();
    console.error('[Cache] Clear pattern error:', error);
    return 0;
  }
}

/**
 * Check if key exists in cache.
 * Returns false gracefully when the circuit breaker is open.
 */
export async function existsCache(key: string): Promise<boolean> {
  if (!isCircuitClosed()) {
    return false;
  }

  try {
    const client = getRedisClient();
    const safeKey = sanitizeKey(key);
    const result = await client.exists(safeKey);
    recordSuccess();
    return result === 1;
  } catch (error) {
    recordFailure();
    console.error('[Cache] Exists error:', error);
    return false;
  }
}

/**
 * Get remaining TTL for a key
 * Returns -2 (key doesn't exist) gracefully when the circuit breaker is open.
 */
export async function getCacheTTL(key: string): Promise<number> {
  if (!isCircuitClosed()) {
    return -2;
  }

  try {
    const client = getRedisClient();
    const safeKey = sanitizeKey(key);
    const ttl = await client.ttl(safeKey);
    recordSuccess();
    return ttl;
  } catch (error) {
    recordFailure();
    console.error('[Cache] TTL error:', error);
    return -2;
  }
}

/**
 * Increment a numeric cache value
 * Creates key with value 1 if doesn't exist.
 * Returns 0 gracefully when the circuit breaker is open.
 */
export async function incrementCache(
  key: string,
  amount: number = 1,
  ttlSeconds?: number
): Promise<number> {
  if (!isCircuitClosed()) {
    return 0;
  }

  try {
    const client = getRedisClient();
    const safeKey = sanitizeKey(key);

    const newValue = await client.incrby(safeKey, amount);

    // Set TTL if provided and this is a new key
    if (ttlSeconds !== undefined && newValue === amount) {
      await client.expire(safeKey, ttlSeconds);
    }

    recordSuccess();
    return newValue;
  } catch (error) {
    recordFailure();
    console.error('[Cache] Increment error:', error);
    return -1;
  }
}

/**
 * Cache wrapper for expensive function calls
 * Automatically caches results and returns cached value if available.
 * Falls back to calling fn() directly when the circuit breaker is open.
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = DEFAULT_CACHE_TTL
): Promise<T> {
  // Try to get from cache first
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Execute function and cache result
  const result = await fn();
  await setCache(key, result, ttlSeconds).catch(() => {
    // Swallow cache write errors — the primary result is still valid
  });
  return result;
}

/**
 * Invalidate cache keys by tags
 * Requires setting tags when caching (advanced usage)
 */
export async function invalidateByTag(tag: string): Promise<number> {
  // Store tag -> keys mapping in a Redis set
  const tagKey = `tag:${tag}`;
  return clearCachePattern(`${tagKey}*`);
}
