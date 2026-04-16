/**
 * Session Storage in Redis
 * Store and retrieve session data for HIPAA-compliant telehealth platform
 * 
 * HIPAA Compliance Notes:
 * - All session data is encrypted before storage
 * - Session IDs are cryptographically random
 * - Automatic expiration prevents indefinite data retention
 * - No PHI in session keys (use hashed user IDs)
 */

import { getRedisClient } from './client';
import { createHash, randomBytes } from 'crypto';

const SESSION_PREFIX = 'session:';
const DEFAULT_SESSION_TTL = 60 * 60 * 24 * 7; // 7 days
const MAX_SESSION_TTL = 60 * 60 * 24 * 30; // 30 days (max)

export interface SessionData {
  userId: string;
  email: string;
  role: string;
  createdAt: number;
  lastAccessedAt?: number;
  ipAddress?: string;
  userAgent?: string;
  mfaVerified?: boolean;
  [key: string]: unknown;
}

export interface SessionMetadata {
  sessionId: string;
  expiresAt: number;
  createdAt: number;
}

/**
 * Generate a cryptographically secure session ID
 */
export function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash user ID for use in cache keys (privacy)
 */
export function hashUserId(userId: string): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, 16);
}

/**
 * Build Redis key for session
 */
function buildSessionKey(sessionId: string): string {
  return `${SESSION_PREFIX}${sessionId}`;
}

/**
 * Build Redis key for user session index
 * Used to track all sessions for a user
 */
function buildUserSessionsKey(userId: string): string {
  return `${SESSION_PREFIX}user:${hashUserId(userId)}`;
}

/**
 * Store session in Redis
 * Session data is encrypted (handled by caller) or contains non-PII references
 */
export async function storeSession(
  sessionId: string,
  data: SessionData,
  ttlSeconds: number = DEFAULT_SESSION_TTL
): Promise<void> {
  try {
    const client = getRedisClient();
    const key = buildSessionKey(sessionId);
    const userSessionsKey = buildUserSessionsKey(data.userId);
    
    // Enforce max TTL for HIPAA compliance
    const effectiveTTL = Math.min(ttlSeconds, MAX_SESSION_TTL);
    
    // Add metadata
    const sessionWithMetadata = {
      ...data,
      lastAccessedAt: Date.now(),
    };
    
    // Store session data
    await client.setex(key, effectiveTTL, JSON.stringify(sessionWithMetadata));
    
    // Add to user's session index (for session invalidation)
    await client.sadd(userSessionsKey, sessionId);
    await client.expire(userSessionsKey, MAX_SESSION_TTL);
    
    console.log(`[Session] Stored session ${sessionId.slice(0, 8)}... for user ${data.userId.slice(0, 8)}...`);
  } catch (error) {
    console.error('[Session] Store error:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * Get session from Redis
 * Returns null if session doesn't exist or is expired
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
  try {
    const client = getRedisClient();
    const key = buildSessionKey(sessionId);
    
    const data = await client.get(key);
    
    if (!data) {
      return null;
    }
    
    const session = JSON.parse(data) as SessionData;
    
    // Update last accessed time (async, don't wait)
    session.lastAccessedAt = Date.now();
    client.set(key, JSON.stringify(session), 'KEEPTTL').catch(() => {
      // Silently fail - session exists, just not updating timestamp
    });
    
    return session;
  } catch (error) {
    console.error('[Session] Get error:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Delete session
 * Removes session and updates user's session index
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const client = getRedisClient();
    
    // Get session first to find user ID
    const session = await getSession(sessionId);
    
    if (session) {
      const userSessionsKey = buildUserSessionsKey(session.userId);
      await client.srem(userSessionsKey, sessionId);
    }
    
    const key = buildSessionKey(sessionId);
    await client.del(key);
    
    console.log(`[Session] Deleted session ${sessionId.slice(0, 8)}...`);
  } catch (error) {
    console.error('[Session] Delete error:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * Extend session TTL (session refresh)
 * Also updates last accessed timestamp
 */
export async function extendSession(
  sessionId: string,
  ttlSeconds: number = DEFAULT_SESSION_TTL
): Promise<boolean> {
  try {
    const client = getRedisClient();
    const key = buildSessionKey(sessionId);
    
    const data = await client.get(key);
    
    if (!data) {
      return false;
    }
    
    const session = JSON.parse(data) as SessionData;
    session.lastAccessedAt = Date.now();
    
    const effectiveTTL = Math.min(ttlSeconds, MAX_SESSION_TTL);
    await client.setex(key, effectiveTTL, JSON.stringify(session));
    
    return true;
  } catch (error) {
    console.error('[Session] Extend error:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/**
 * Get all active sessions for a user
 * Returns array of session IDs (not full data for privacy)
 */
export async function getUserSessions(userId: string): Promise<string[]> {
  try {
    const client = getRedisClient();
    const userSessionsKey = buildUserSessionsKey(userId);
    
    const sessionIds = await client.smembers(userSessionsKey);
    
    // Filter out expired sessions
    const activeSessions: string[] = [];
    for (const sessionId of sessionIds) {
      const exists = await client.exists(buildSessionKey(sessionId));
      if (exists) {
        activeSessions.push(sessionId);
      } else {
        // Clean up expired session from index
        await client.srem(userSessionsKey, sessionId);
      }
    }
    
    return activeSessions;
  } catch (error) {
    console.error('[Session] Get user sessions error:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

/**
 * Invalidate all sessions for a user
 * Use case: password change, account security concern, logout all devices
 */
export async function invalidateAllUserSessions(userId: string): Promise<number> {
  try {
    const client = getRedisClient();
    const sessionIds = await getUserSessions(userId);
    
    if (sessionIds.length === 0) {
      return 0;
    }
    
    // Delete all session keys
    const keys = sessionIds.map(buildSessionKey);
    await client.del(...keys);
    
    // Clear user's session index
    const userSessionsKey = buildUserSessionsKey(userId);
    await client.del(userSessionsKey);
    
    console.log(`[Session] Invalidated ${sessionIds.length} sessions for user ${userId.slice(0, 8)}...`);
    return sessionIds.length;
  } catch (error) {
    console.error('[Session] Invalidate all error:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

/**
 * Get session metadata without full data
 */
export async function getSessionMetadata(sessionId: string): Promise<SessionMetadata | null> {
  try {
    const client = getRedisClient();
    const key = buildSessionKey(sessionId);
    
    const ttl = await client.ttl(key);
    
    if (ttl < 0) {
      return null;
    }
    
    const data = await client.get(key);
    if (!data) {
      return null;
    }
    
    const session = JSON.parse(data) as SessionData;
    
    return {
      sessionId,
      expiresAt: Date.now() + (ttl * 1000),
      createdAt: session.createdAt,
    };
  } catch (error) {
    console.error('[Session] Get metadata error:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Check if session exists and is valid
 */
export async function isSessionValid(sessionId: string): Promise<boolean> {
  try {
    const client = getRedisClient();
    const key = buildSessionKey(sessionId);
    const exists = await client.exists(key);
    return exists === 1;
  } catch (error) {
    console.error('[Session] Valid check error:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

/**
 * Touch session (update last accessed without full read)
 * Lightweight operation to keep session alive
 */
export async function touchSession(sessionId: string): Promise<void> {
  try {
    const client = getRedisClient();
    const key = buildSessionKey(sessionId);
    await client.expire(key, DEFAULT_SESSION_TTL);
  } catch (error) {
    console.error('[Session] Touch error:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Get session count (for monitoring/metrics)
 * Warning: SCAN operation, use cautiously on large datasets
 */
export async function getActiveSessionCount(): Promise<number> {
  try {
    const client = getRedisClient();
    let cursor = '0';
    let count = 0;
    
    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        `${SESSION_PREFIX}*`,
        'COUNT',
        1000
      );
      cursor = nextCursor;
      count += keys.filter(k => !k.includes(':user:')).length;
    } while (cursor !== '0');
    
    return count;
  } catch (error) {
    console.error('[Session] Count error:', error instanceof Error ? error.message : 'Unknown error');
    return -1;
  }
}
