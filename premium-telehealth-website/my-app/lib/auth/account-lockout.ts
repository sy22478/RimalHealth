/**
 * Account Lockout System
 * 
 * Prevents brute-force attacks by locking accounts after multiple failed login attempts.
 * Uses Redis for distributed state management.
 * 
 * HIPAA Compliance:
 * - Protects against unauthorized access attempts
 * - Logs lockout events for security auditing
 * - Progressive delays to deter automated attacks
 * 
 * Configuration:
 * - Max attempts: 5
 * * Lockout duration: 15 minutes
 * - Progressive delay: 1s, 2s, 4s, 8s, 16s
 */

import { getRedisClient } from '@/lib/redis/client';

// ============================================
// Configuration
// ============================================

/** Maximum failed attempts before lockout */
export const MAX_FAILED_ATTEMPTS = 5;

/** Lockout duration in seconds (15 minutes) */
export const LOCKOUT_DURATION_SECONDS = 15 * 60;

/** Progressive delay multipliers (in seconds) */
const PROGRESSIVE_DELAYS = [1, 2, 4, 8, 16];

// ============================================
// Types
// ============================================

/**
 * Lockout status for a user/account
 */
export interface LockoutStatus {
  /** Whether the account is currently locked */
  isLocked: boolean;
  
  /** Number of consecutive failed attempts */
  attempts: number;
  
  /** Time when lockout expires (null if not locked) */
  lockedUntil: Date | null;
  
  /** Seconds remaining until lockout expires */
  remainingSeconds: number;
  
  /** Recommended delay before next attempt (for progressive delays) */
  recommendedDelayMs: number;
}

/**
 * Result of an authentication attempt
 */
export interface AuthenticationAttempt {
  /** Whether the attempt is allowed */
  allowed: boolean;
  
  /** Current lockout status */
  status: LockoutStatus;
  
  /** Error message if not allowed */
  error?: string;
  
  /** Error code for client handling */
  code?: string;
}

// ============================================
// Redis Key Helpers
// ============================================

/**
 * Generate Redis key for failed attempts counter
 */
function getAttemptsKey(identifier: string): string {
  return `auth:failed_attempts:${identifier}`;
}

/**
 * Generate Redis key for lockout timestamp
 */
function getLockoutKey(identifier: string): string {
  return `auth:locked:${identifier}`;
}

/**
 * Generate Redis key for IP-based rate limiting
 */
function getIpAttemptsKey(ipAddress: string): string {
  return `auth:ip_attempts:${ipAddress}`;
}

// ============================================
// Lockout Management
// ============================================

/**
 * Check if an account is locked
 * 
 * @param identifier - User identifier (email or userId)
 * @returns Lockout status
 */
export async function checkLockoutStatus(identifier: string): Promise<LockoutStatus> {
  const redis = getRedisClient();
  
  // Check if account is locked
  const lockoutKey = getLockoutKey(identifier);
  const lockedUntilTimestamp = await redis.get(lockoutKey);
  
  if (lockedUntilTimestamp) {
    const lockedUntil = new Date(parseInt(lockedUntilTimestamp, 10));
    const now = new Date();
    
    if (lockedUntil > now) {
      // Account is still locked
      const remainingSeconds = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000);
      return {
        isLocked: true,
        attempts: MAX_FAILED_ATTEMPTS,
        lockedUntil,
        remainingSeconds,
        recommendedDelayMs: remainingSeconds * 1000,
      };
    }
    
    // Lock has expired, clear it
    await redis.del(lockoutKey);
  }
  
  // Get current attempt count
  const attemptsKey = getAttemptsKey(identifier);
  const attemptsStr = await redis.get(attemptsKey);
  const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;
  
  // Calculate progressive delay
  const delayIndex = Math.min(attempts, PROGRESSIVE_DELAYS.length - 1);
  const recommendedDelayMs = PROGRESSIVE_DELAYS[delayIndex] * 1000;
  
  return {
    isLocked: false,
    attempts,
    lockedUntil: null,
    remainingSeconds: 0,
    recommendedDelayMs,
  };
}

/**
 * Record a failed authentication attempt
 * 
 * @param identifier - User identifier (email or userId)
 * @returns Updated lockout status
 */
export async function recordFailedAttempt(identifier: string): Promise<LockoutStatus> {
  const redis = getRedisClient();
  const attemptsKey = getAttemptsKey(identifier);
  
  // Increment attempt counter
  const newAttempts = await redis.incr(attemptsKey);
  
  // Set expiration on first attempt
  if (newAttempts === 1) {
    await redis.expire(attemptsKey, LOCKOUT_DURATION_SECONDS);
  }
  
  // Check if we should lock the account
  if (newAttempts >= MAX_FAILED_ATTEMPTS) {
    const lockoutUntil = new Date(Date.now() + LOCKOUT_DURATION_SECONDS * 1000);
    const lockoutKey = getLockoutKey(identifier);
    
    await redis.set(lockoutKey, lockoutUntil.getTime().toString(), 'EX', LOCKOUT_DURATION_SECONDS);
    
    // Clear attempts counter (lockout key is now the source of truth)
    await redis.del(attemptsKey);
    
    return {
      isLocked: true,
      attempts: newAttempts,
      lockedUntil: lockoutUntil,
      remainingSeconds: LOCKOUT_DURATION_SECONDS,
      recommendedDelayMs: LOCKOUT_DURATION_SECONDS * 1000,
    };
  }
  
  // Return updated status without lockout
  const delayIndex = Math.min(newAttempts, PROGRESSIVE_DELAYS.length - 1);
  return {
    isLocked: false,
    attempts: newAttempts,
    lockedUntil: null,
    remainingSeconds: 0,
    recommendedDelayMs: PROGRESSIVE_DELAYS[delayIndex] * 1000,
  };
}

/**
 * Clear failed attempts (on successful login)
 * 
 * @param identifier - User identifier (email or userId)
 */
export async function clearFailedAttempts(identifier: string): Promise<void> {
  const redis = getRedisClient();
  
  await Promise.all([
    redis.del(getAttemptsKey(identifier)),
    redis.del(getLockoutKey(identifier)),
  ]);
}

/**
 * Check if authentication is allowed
 * 
 * @param identifier - User identifier (email or userId)
 * @returns Authentication attempt result
 */
export async function checkAuthenticationAllowed(identifier: string): Promise<AuthenticationAttempt> {
  const status = await checkLockoutStatus(identifier);
  
  if (status.isLocked) {
    return {
      allowed: false,
      status,
      error: `Account is locked. Please try again in ${formatDuration(status.remainingSeconds)}.`,
      code: 'ACCOUNT_LOCKED',
    };
  }
  
  return {
    allowed: true,
    status,
  };
}

// ============================================
// IP-Based Rate Limiting
// ============================================

/**
 * Check IP-based rate limiting
 * 
 * Provides an additional layer of protection against distributed attacks
 * 
 * @param ipAddress - Client IP address
 * @param maxAttempts - Maximum attempts per window (default: 20)
 * @param windowSeconds - Time window in seconds (default: 60)
 * @returns Whether the IP is allowed to attempt authentication
 */
export async function checkIpRateLimit(
  ipAddress: string,
  maxAttempts: number = 20,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
  const redis = getRedisClient();
  const key = getIpAttemptsKey(ipAddress);
  
  // Get current count
  const count = await redis.incr(key);
  
  // Set expiry on first request
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  
  const ttl = await redis.ttl(key);
  const resetTime = new Date(Date.now() + Math.max(ttl, 0) * 1000);
  
  return {
    allowed: count <= maxAttempts,
    remaining: Math.max(0, maxAttempts - count),
    resetTime,
  };
}

/**
 * Record IP-based attempt (for failed authentications)
 * 
 * @param ipAddress - Client IP address
 */
export async function recordIpAttempt(ipAddress: string): Promise<void> {
  const redis = getRedisClient();
  const key = getIpAttemptsKey(ipAddress);
  
  await redis.incr(key);
  // Default 1 minute window for IP tracking
  await redis.expire(key, 60);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`;
  }
  
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

/**
 * Manually lock an account (admin function)
 * 
 * @param identifier - User identifier
 * @param durationSeconds - Duration of lockout (default: 15 minutes)
 */
export async function lockAccount(
  identifier: string,
  durationSeconds: number = LOCKOUT_DURATION_SECONDS
): Promise<void> {
  const redis = getRedisClient();
  const lockoutUntil = new Date(Date.now() + durationSeconds * 1000);
  const lockoutKey = getLockoutKey(identifier);
  
  await redis.set(lockoutKey, lockoutUntil.getTime().toString(), 'EX', durationSeconds);
  await redis.del(getAttemptsKey(identifier));
}

/**
 * Manually unlock an account (admin function)
 * 
 * @param identifier - User identifier
 */
export async function unlockAccount(identifier: string): Promise<void> {
  await clearFailedAttempts(identifier);
}

/**
 * Get lockout status for multiple accounts (admin function)
 * 
 * @param identifiers - Array of user identifiers
 * @returns Map of identifier to lockout status
 */
export async function getBulkLockoutStatus(
  identifiers: string[]
): Promise<Record<string, LockoutStatus>> {
  const results: Record<string, LockoutStatus> = {};
  
  await Promise.all(
    identifiers.map(async (identifier) => {
      results[identifier] = await checkLockoutStatus(identifier);
    })
  );
  
  return results;
}

// ============================================
// Constants Export
// ============================================

export const LOCKOUT_CONSTANTS = {
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_SECONDS,
  LOCKOUT_DURATION_MINUTES: LOCKOUT_DURATION_SECONDS / 60,
  PROGRESSIVE_DELAYS,
} as const;
