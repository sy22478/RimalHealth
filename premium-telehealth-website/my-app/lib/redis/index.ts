/**
 * Redis Module
 * Centralized exports for Redis client, cache, and session utilities
 * 
 * Usage:
 *   import { getRedisClient, getCache, setCache, storeSession, getSession } from '@/lib/redis';
 */

// Client
export {
  getRedisClient,
  closeRedisConnection,
  checkRedisHealth,
  getRedisStatus,
} from './client';

// Cache
export {
  getCache,
  setCache,
  setCacheNX,
  deleteCache,
  clearCachePattern,
  existsCache,
  getCacheTTL,
  incrementCache,
  withCache,
  invalidateByTag,
} from './cache';

// Session
export {
  storeSession,
  getSession,
  deleteSession,
  extendSession,
  getUserSessions,
  invalidateAllUserSessions,
  getSessionMetadata,
  isSessionValid,
  touchSession,
  getActiveSessionCount,
  generateSessionId,
  hashUserId,
} from './session';

// Types
export type { SessionData, SessionMetadata } from './session';
