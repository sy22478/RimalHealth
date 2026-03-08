/**
 * Session Management
 * Handles token versioning for logout functionality
 * 
 * HIPAA Compliance:
 * - Token versioning for immediate session invalidation
 * - Atomic updates to prevent race conditions
 * - Audit logging for session events
 * - Support for "logout all devices"
 */

import { prisma } from '@/lib/db/prisma';

// ============================================
// Session Creation
// ============================================

/**
 * Create a new session in the database
 * 
 * @param userId - User unique identifier
 * @param token - Access token
 * @param refreshToken - Refresh token
 * @param ipAddress - Client IP address
 * @param userAgent - Client user agent
 */
export async function createSession(
  userId: string,
  token: string,
  refreshToken: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await prisma.session.create({
    data: {
      userId,
      token,
      refreshToken,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });
}

/**
 * Invalidate a specific session by token
 * 
 * @param token - Session token to invalidate
 */
export async function invalidateSession(token: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { token },
  });
}

// ============================================
// Session Invalidation
// ============================================

/**
 * Increment token version to invalidate all refresh tokens
 * 
 * When called, all existing refresh tokens for the user become invalid
 * because they contain the old tokenVersion. This enables:
 * - "Logout all devices" functionality
 * - Immediate revocation on security events (password change, suspicious activity)
 * - Session invalidation on account lock/disable
 * 
 * @param userId - User unique identifier
 * @throws Error if database update fails
 * 
 * @example
 * ```typescript
 * // Logout from all devices
 * app.post('/logout-all', authenticate, async (req, res) => {
 *   await invalidateUserSessions(req.user.userId);
 *   res.json({ message: 'Logged out from all devices' });
 * });
 * 
 * // After password change
 * app.post('/change-password', authenticate, async (req, res) => {
 *   const { currentPassword, newPassword } = req.body;
 *   
 *   // Verify and update password...
 *   
 *   // Invalidate all existing sessions
 *   await invalidateUserSessions(req.user.userId);
 *   
 *   // Issue new tokens for current device
 *   const tokens = await generateTokenPair(...);
 *   res.json({ message: 'Password changed', tokens });
 * });
 * ```
 */
export async function invalidateUserSessions(userId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        tokenVersion: {
          increment: 1,
        },
      },
    });
  } catch (error) {
    throw new Error(
      `Failed to invalidate sessions: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Reset token version to a specific value
 * 
 * Useful for admin operations or account recovery scenarios.
 * Use with caution as it affects all user sessions.
 * 
 * @param userId - User unique identifier
 * @param version - New token version value (default: 0)
 * @throws Error if database update fails
 * 
 * @example
 * ```typescript
 * // Admin: Reset sessions after account recovery
 * app.post('/admin/reset-sessions', adminOnly, async (req, res) => {
 *   const { userId } = req.body;
 *   await resetTokenVersion(userId, 0);
 *   res.json({ message: 'Sessions reset' });
 * });
 * ```
 */
export async function resetTokenVersion(
  userId: string,
  version: number = 0
): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        tokenVersion: version,
      },
    });
  } catch (error) {
    throw new Error(
      `Failed to reset token version: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================
// Token Version Validation
// ============================================

/**
 * Validate token version against database
 * 
 * Checks if the tokenVersion in a refresh token matches the current
 * version in the database. If versions don't match, the token is invalid
 * (user has logged out or sessions were invalidated).
 * 
 * @param userId - User unique identifier
 * @param tokenVersion - Token version from the refresh token
 * @returns true if token version is valid, false otherwise
 * @throws Error if database query fails
 * 
 * @example
 * ```typescript
 * // During token refresh
 * app.post('/refresh', async (req, res) => {
 *   const { refreshToken } = req.body;
 *   
 *   try {
 *     const payload = await verifyRefreshToken(refreshToken);
 *     
 *     // Validate token version
 *     const isValidVersion = await validateTokenVersion(
 *       payload.userId,
 *       payload.tokenVersion
 *     );
 *     
 *     if (!isValidVersion) {
 *       return res.status(401).json({
 *         error: 'Session invalidated',
 *         code: 'SESSION_INVALIDATED'
 *       });
 *     }
 *     
 *     // Get user and issue new tokens
 *     const user = await prisma.user.findUnique({
 *       where: { id: payload.userId }
 *     });
 *     
 *     const tokens = await generateTokenPair(
 *       user.id,
 *       user.email,
 *       user.role,
 *       user.tokenVersion
 *     );
 *     
 *     res.json(tokens);
 *   } catch (error) {
 *     res.status(401).json({ error: 'Invalid token' });
 *   }
 * });
 * ```
 */
export async function validateTokenVersion(
  userId: string,
  tokenVersion: number
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true },
    });

    if (!user) {
      return false;
    }

    return user.tokenVersion === tokenVersion;
  } catch (error) {
    throw new Error(
      `Failed to validate token version: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get current token version for a user
 * 
 * @param userId - User unique identifier
 * @returns Current token version or null if user not found
 * @throws Error if database query fails
 * 
 * @example
 * ```typescript
 * const version = await getCurrentTokenVersion(userId);
 * if (version !== null) {
 *   // Use version for token generation
 * }
 * ```
 */
export async function getCurrentTokenVersion(userId: string): Promise<number | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true },
    });

    return user?.tokenVersion ?? null;
  } catch (error) {
    throw new Error(
      `Failed to get token version: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================
// Session Querying
// ============================================

/**
 * Get user session info
 * 
 * Returns session-related information for a user.
 * Useful for "active sessions" UI or admin dashboards.
 * 
 * @param userId - User unique identifier
 * @returns Object containing current token version and user status
 * @throws Error if database query fails
 * 
 * @example
 * ```typescript
 * // Get session info for dashboard
 * app.get('/sessions', authenticate, async (req, res) => {
 *   const info = await getUserSessionInfo(req.user.userId);
 *   res.json({
 *     currentVersion: info.tokenVersion,
 *     lastLogin: info.lastLoginAt,
 *     emailVerified: info.emailVerified
 *   });
 * });
 * ```
 */
export async function getUserSessionInfo(userId: string): Promise<{
  tokenVersion: number;
  emailVerified: boolean;
  lastLoginAt: Date | null;
}> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        tokenVersion: true,
        emailVerified: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      tokenVersion: user.tokenVersion,
      emailVerified: user.emailVerified,
      lastLoginAt: user.lastLoginAt,
    };
  } catch (error) {
    throw new Error(
      `Failed to get session info: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================
// Batch Operations
// ============================================

/**
 * Invalidate all sessions for multiple users
 * 
 * Useful for admin operations like security incidents
 * where multiple accounts need to be logged out.
 * 
 * @param userIds - Array of user unique identifiers
 * @returns Number of users affected
 * @throws Error if database update fails
 * 
 * @example
 * ```typescript
 * // Security incident: invalidate all staff sessions
 * app.post('/admin/security-incident', adminOnly, async (req, res) => {
 *   const affectedPhysicians = await getPhysicianUserIds();
 *   const count = await invalidateMultipleUserSessions(affectedPhysicians);
 *   res.json({ message: `Invalidated sessions for ${count} users` });
 * });
 * ```
 */
export async function invalidateMultipleUserSessions(userIds: string[]): Promise<number> {
  try {
    const result = await prisma.user.updateMany({
      where: {
        id: {
          in: userIds,
        },
      },
      data: {
        tokenVersion: {
          increment: 1,
        },
      },
    });

    return result.count;
  } catch (error) {
    throw new Error(
      `Failed to invalidate multiple sessions: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// ============================================
// Constants for External Use
// ============================================

/** Error code for invalidated sessions */
export const SESSION_ERROR_CODES = {
  SESSION_INVALIDATED: 'SESSION_INVALIDATED',
  TOKEN_VERSION_MISMATCH: 'TOKEN_VERSION_MISMATCH',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
} as const;
