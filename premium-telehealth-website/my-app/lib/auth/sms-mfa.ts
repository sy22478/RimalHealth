/**
 * SMS-based MFA for patients
 *
 * Generates, stores, and verifies 6-digit codes sent via Twilio SMS.
 * Codes are stored in Redis with a 5-minute TTL.
 * Rate limited to 5 codes per hour per phone number.
 * Failed verification locked after 5 attempts for 15 minutes.
 *
 * @module lib/auth/sms-mfa
 */

import type { Redis } from 'ioredis';

const SMS_CODE_PREFIX = 'sms_mfa:';
const SMS_CODE_TTL = 300; // 5 minutes
const SMS_RATE_LIMIT_PREFIX = 'sms_mfa_rate:';
const SMS_RATE_LIMIT_MAX = 5; // max 5 codes per hour
const SMS_RATE_LIMIT_TTL = 3600; // 1 hour
const SMS_FAIL_PREFIX = 'sms_mfa_fail:';
const SMS_FAIL_MAX = 5; // max 5 wrong codes
const SMS_FAIL_LOCKOUT_TTL = 900; // 15 minutes

/**
 * Generate a random 6-digit code
 */
export function generateSMSCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Store SMS code in Redis with TTL
 */
export async function storeSMSCode(redis: Redis, userId: string, code: string): Promise<void> {
  const key = `${SMS_CODE_PREFIX}${userId}`;
  await redis.set(key, code, 'EX', SMS_CODE_TTL);
}

/**
 * Verify SMS code from Redis
 * Returns true if code matches, false otherwise.
 * Deletes code after successful verification (one-time use).
 */
export async function verifySMSCode(redis: Redis, userId: string, code: string): Promise<boolean> {
  const key = `${SMS_CODE_PREFIX}${userId}`;
  const storedCode = await redis.get(key);
  if (!storedCode || storedCode !== code) {
    return false;
  }
  await redis.del(key); // One-time use
  return true;
}

/**
 * Check rate limit for SMS sends
 * Returns true if allowed, false if rate limited.
 */
export async function checkSMSRateLimit(redis: Redis, phoneNumber: string): Promise<boolean> {
  const key = `${SMS_RATE_LIMIT_PREFIX}${phoneNumber}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, SMS_RATE_LIMIT_TTL);
  }
  return count <= SMS_RATE_LIMIT_MAX;
}

/**
 * Record a failed SMS verification attempt.
 * Returns the current attempt count.
 */
export async function recordSMSFailedAttempt(redis: Redis, userId: string): Promise<number> {
  const key = `${SMS_FAIL_PREFIX}${userId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, SMS_FAIL_LOCKOUT_TTL);
  }
  return count;
}

/**
 * Check if user is locked out from SMS verification.
 * Returns true if locked out.
 */
export async function isSMSVerificationLocked(redis: Redis, userId: string): Promise<boolean> {
  const key = `${SMS_FAIL_PREFIX}${userId}`;
  const count = await redis.get(key);
  return count !== null && parseInt(count, 10) >= SMS_FAIL_MAX;
}

/**
 * Clear SMS verification failure count (on successful verify).
 */
export async function clearSMSFailedAttempts(redis: Redis, userId: string): Promise<void> {
  const key = `${SMS_FAIL_PREFIX}${userId}`;
  await redis.del(key);
}

/**
 * Mask a phone number for display (e.g. "***-***-1234")
 */
export function maskPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  const last4 = digits.slice(-4);
  return `***-***-${last4}`;
}
