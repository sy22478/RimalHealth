import { createHash } from 'crypto';

/**
 * Hash a single-use auth token (password-reset, email-verification, and
 * create-account tokens — all stored in the `PasswordReset` model) for storage
 * and lookup.
 *
 * Security: these tokens are stored hashed at rest so that a database read
 * (backup leak, SQL injection, insider access) cannot yield live tokens usable
 * for account takeover. The RAW token is only ever delivered to the user via
 * the emailed link; the database stores `hashToken(raw)`. On the confirm flow
 * we hash the incoming raw token and look it up by its hash.
 *
 * SHA-256 (unsalted) is appropriate here because these tokens are high-entropy
 * (>=128 bits of cryptographic randomness), so — unlike passwords — they are
 * not brute-forceable and need no per-record salt or slow KDF.
 *
 * MIGRATION NOTE: PasswordReset rows created before this change hold PLAINTEXT
 * tokens. After deploy, those rows will not match hashed lookups and will
 * effectively expire — affected users simply request a new link. No data
 * migration is performed: we cannot re-hash existing rows without the raw value,
 * and hashing an already-hashed value would corrupt it.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
