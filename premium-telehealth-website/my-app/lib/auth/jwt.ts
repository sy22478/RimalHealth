/**
 * JWT Authentication Utilities
 * Uses jose library for JWT operations (Edge-compatible)
 * 
 * HIPAA Compliance:
 * - Access tokens: 15 minutes expiry (short-lived)
 * - Refresh tokens: 7 days expiry with versioning
 * - Tokens include minimal claims (no PHI)
 * - Secure token validation with proper error handling
 */

import { SignJWT, jwtVerify, JWTPayload } from 'jose';
import { Role } from '@prisma/client';

// ============================================
// Token Payload Types
// ============================================

/**
 * Access Token Payload
 * Contains minimal user info for authorization decisions
 * NO PHI should be included in tokens
 */
export interface AccessTokenPayload extends JWTPayload {
  /** User unique identifier */
  userId: string;
  /** User email for display purposes */
  email: string;
  /** User role for RBAC decisions */
  role: Role;
  /** Token type identifier */
  type: 'access';
}

/**
 * Refresh Token Payload
 * Used to obtain new access tokens
 * Includes tokenVersion for session invalidation
 */
export interface RefreshTokenPayload extends JWTPayload {
  /** User unique identifier */
  userId: string;
  /** Token type identifier */
  type: 'refresh';
  /** Token version for invalidation support */
  tokenVersion: number;
}

// ============================================
// Configuration
// ============================================

/** Access token expiry: 15 minutes */
const ACCESS_TOKEN_EXPIRY = '15m';

/** Refresh token expiry: 7 days */
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Get JWT secret from environment
 * @throws Error if JWT_SECRET is not configured
 */
function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return new TextEncoder().encode(secret);
}

// ============================================
// Token Generation
// ============================================

/**
 * Generate access token (15 minutes)
 * 
 * Used for authenticating API requests. Short-lived for security.
 * Contains user role for RBAC middleware decisions.
 * 
 * @param userId - User unique identifier
 * @param email - User email address
 * @param role - User role (PATIENT, PHYSICIAN, ADMIN)
 * @returns JWT access token string
 * 
 * @example
 * ```typescript
 * const accessToken = await generateAccessToken(user.id, user.email, user.role);
 * ```
 */
export async function generateAccessToken(
  userId: string,
  email: string,
  role: Role
): Promise<string> {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    userId,
    email,
    role,
    type: 'access',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setSubject(userId)
    .setAudience('telehealth-api')
    .setIssuer('telehealth-platform')
    .sign(secret);

  return token;
}

/**
 * Generate refresh token (7 days)
 * 
 * Used to obtain new access tokens without re-authentication.
 * Includes tokenVersion for session invalidation support.
 * 
 * @param userId - User unique identifier
 * @param tokenVersion - Current token version from User model
 * @returns JWT refresh token string
 * 
 * @example
 * ```typescript
 * const refreshToken = await generateRefreshToken(user.id, user.tokenVersion);
 * ```
 */
export async function generateRefreshToken(
  userId: string,
  tokenVersion: number
): Promise<string> {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    userId,
    type: 'refresh',
    tokenVersion,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .setSubject(userId)
    .setAudience('telehealth-api')
    .setIssuer('telehealth-platform')
    .sign(secret);

  return token;
}

// ============================================
// Token Verification
// ============================================

/**
 * Verify access token
 * 
 * Validates the token signature, expiration, and type claim.
 * Returns the decoded payload for use in request handlers.
 * 
 * @param token - JWT access token string
 * @returns Decoded AccessTokenPayload
 * @throws Error if token is invalid, expired, or wrong type
 * 
 * @example
 * ```typescript
 * try {
 *   const payload = await verifyAccessToken(token);
 *   // Use payload.userId, payload.role for authorization
 * } catch (error) {
 *   // Handle invalid token
 * }
 * ```
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const secret = getSecret();

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      audience: 'telehealth-api',
      issuer: 'telehealth-platform',
    });

    // Validate token type
    if (payload.type !== 'access') {
      throw new Error('Invalid token type: expected access token');
    }

    // Validate required claims
    if (!payload.userId || !payload.email || !payload.role) {
      throw new Error('Invalid token: missing required claims');
    }

    return payload as AccessTokenPayload;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'JWTExpired') {
        throw new Error('Token expired');
      }
      throw new Error(`Token verification failed: ${error.message}`);
    }
    throw new Error('Token verification failed');
  }
}

/**
 * Verify refresh token
 * 
 * Validates the token signature, expiration, and type claim.
 * Returns the decoded payload for token rotation.
 * 
 * @param token - JWT refresh token string
 * @returns Decoded RefreshTokenPayload
 * @throws Error if token is invalid, expired, or wrong type
 * 
 * @example
 * ```typescript
 * try {
 *   const payload = await verifyRefreshToken(refreshToken);
 *   // Check tokenVersion against database
 *   // Issue new token pair
 * } catch (error) {
 *   // Handle invalid refresh token
 * }
 * ```
 */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const secret = getSecret();

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      audience: 'telehealth-api',
      issuer: 'telehealth-platform',
    });

    // Validate token type
    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type: expected refresh token');
    }

    // Validate required claims
    if (!payload.userId || typeof payload.tokenVersion !== 'number') {
      throw new Error('Invalid token: missing required claims');
    }

    return payload as RefreshTokenPayload;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'JWTExpired') {
        throw new Error('Refresh token expired');
      }
      throw new Error(`Refresh token verification failed: ${error.message}`);
    }
    throw new Error('Refresh token verification failed');
  }
}

// ============================================
// Token Pair Generation
// ============================================

/**
 * Generate token pair
 * 
 * Creates both access and refresh tokens in a single call.
 * Used during login and token refresh operations.
 * 
 * @param userId - User unique identifier
 * @param email - User email address
 * @param role - User role (PATIENT, PHYSICIAN, ADMIN)
 * @param tokenVersion - Current token version from User model
 * @returns Object containing both accessToken and refreshToken
 * 
 * @example
 * ```typescript
 * // During login
 * const tokens = await generateTokenPair(
 *   user.id,
 *   user.email,
 *   user.role,
 *   user.tokenVersion
 * );
 * 
 * // Return tokens to client
 * res.json({
 *   accessToken: tokens.accessToken,
 *   refreshToken: tokens.refreshToken,
 *   expiresIn: 900 // 15 minutes in seconds
 * });
 * ```
 */
export async function generateTokenPair(
  userId: string,
  email: string,
  role: Role,
  tokenVersion: number
): Promise<{ accessToken: string; refreshToken: string }> {
  // Generate both tokens in parallel
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(userId, email, role),
    generateRefreshToken(userId, tokenVersion),
  ]);

  return { accessToken, refreshToken };
}

// ============================================
// Token Decoding (without verification)
// ============================================

/**
 * Decode token payload without verification
 * 
 * WARNING: This does NOT verify the token signature.
 * Only use this for non-security purposes like logging or debugging.
 * For authentication, always use verifyAccessToken or verifyRefreshToken.
 * 
 * @param token - JWT token string
 * @returns Decoded payload or null if invalid format
 */
export function decodeTokenUnsafe(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(parts[1]), (c) => c.charCodeAt(0))
      )
    );

    return payload as JWTPayload;
  } catch {
    return null;
  }
}

// ============================================
// Constants for External Use
// ============================================

/** Access token expiry in seconds (15 minutes) */
export const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60;

/** Refresh token expiry in seconds (7 days) */
export const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

/** Token expiry strings for jose library */
export const TOKEN_EXPIRIES = {
  access: ACCESS_TOKEN_EXPIRY,
  refresh: REFRESH_TOKEN_EXPIRY,
} as const;
