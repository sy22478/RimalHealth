/**
 * Cache Utilities
 * Helper functions for caching data in Redis
 * 
 * HIPAA Compliance Notes:
 * - Never cache PHI directly; use encrypted or anonymized data
 * - Set appropriate TTLs to limit data exposure window
 * - Use hashed identifiers in cache keys
 */

import { getRedisClient } from './client';
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
 * Returns parsed JSON value or null if not found/expired
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    const safeKey = sanitizeKey(key);
    const data = await client.get(safeKey);
    
    if (!data) {
      return null;
    }
    
    return JSON.parse(data) as T;
  } catch (error) {
    console.error('[Cache] Get error:', error);
    return null;
  }
}

/**
 * Set cached value with optional TTL
 * TTL in seconds, defaults to 5 minutes
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_CACHE_TTL
): Promise<void> {
  try {
    const client = getRedisClient();
    const safeKey = sanitizeKey(key);
    const serialized = JSON.stringify(value);
    
    await client.setex(safeKey, ttlSeconds, serialized);
  } catch (error) {
    console.error('[Cache] Set error:', error);
    throw error;
  }
}

/**
 * Set cached value only if key doesn't exist (NX - Not eXists)
 * Useful for distributed locking or one-time initialization
 */
export async function setCacheNX<T>(
  key: string,
  value: T,
  ttlSeconds: number = DEFAULT_CACHE_TTL
): Promise<boolean> {
  try {
    const client = getRedisClient();
    const safeKey = sanitizeKey(key);
    const serialized = JSON.stringify(value);
    
    const result = await client.set(safeKey, serialized, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch (error) {
    console.error('[Cache] SetNX error:', error);
    return false;
  }
}

/**
 * Delete cached value
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    const client = getRedisClient();
    const safeKey = sanitizeKey(key);
    await client.del(safeKey);
  } catch (error) {
    console.error('[Cache] Delete error:', error);
    throw error;
  }
}

/**
 * Clear cache by pattern using Redis SCAN
 * Warning: Can be slow on large datasets, use with caution
 */
export async function clearCachePattern(pattern: string): Promise<number> {
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

    console.log(`[Cache] Cleared ${deletedCount} keys matching pattern: ${pattern}`);
    return deletedCount;
  } catch (error) {
    console.error('[Cache] Clear pattern error:', error);
    throw error;
  }
}

/**
 * Check if key exists in cache
 */
export async function existsCache(key: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    const safeKey = sanitizeKey(key);
    const result = await client.exists(safeKey);
    return result === 1;
  } catch (error) {
    console.error('[Cache] Exists error:', error);
    return false;
  }
}

/**
 * Get remaining TTL for a key
 * Returns -1 if key exists but has no TTL, -2 if key doesn't exist
 */
export async function getCacheTTL(key: string): Promise<number> {
  try {
    const client = getRedisClient();
    const safeKey = sanitizeKey(key);
    return await client.ttl(safeKey);
  } catch (error) {
    console.error('[Cache] TTL error:', error);
    return -2;
  }
}

/**
 * Increment a numeric cache value
 * Creates key with value 1 if doesn't exist
 */
export async function incrementCache(
  key: string,
  amount: number = 1,
  ttlSeconds?: number
): Promise<number> {
  try {
    const client = getRedisClient();
    const safeKey = sanitizeKey(key);
    
    const newValue = await client.incrby(safeKey, amount);
    
    // Set TTL if provided and this is a new key
    if (ttlSeconds !== undefined && newValue === amount) {
      await client.expire(safeKey, ttlSeconds);
    }
    
    return newValue;
  } catch (error) {
    console.error('[Cache] Increment error:', error);
    throw error;
  }
}

/**
 * Cache wrapper for expensive function calls
 * Automatically caches results and returns cached value if available
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
  await setCache(key, result, ttlSeconds);
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
