/**
 * Authentication Module
 * 
 * Central export point for all authentication utilities.
 * 
 * @module lib/auth
 * 
 * @example
 * ```typescript
 * import { 
 *   generateTokenPair, 
 *   verifyAccessToken,
 *   hashPassword,
 *   requireAuth,
 *   hasPermission 
 * } from '@/lib/auth';
 * ```
 */

// ============================================
// JWT Utilities
// ============================================

export {
  // Token Generation
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  
  // Token Verification
  verifyAccessToken,
  verifyRefreshToken,
  
  // Token Decoding
  decodeTokenUnsafe,
  
  // Types
  type AccessTokenPayload,
  type RefreshTokenPayload,
  
  // Constants
  ACCESS_TOKEN_EXPIRY_SECONDS,
  REFRESH_TOKEN_EXPIRY_SECONDS,
  TOKEN_EXPIRIES,
} from './jwt';

// ============================================
// Password Utilities
// ============================================

export {
  // Hashing
  hashPassword,
  verifyPassword,
  
  // Validation
  validatePasswordStrength,
  generateSecurePassword,
  
  // Constants
  BCRYPT_SALT_ROUNDS,
  MIN_PASSWORD_LENGTH,
} from './password';

// ============================================
// RBAC (Role-Based Access Control)
// ============================================

export {
  // Permission Enum
  Permission,
  
  // Permission Checking
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getRolePermissions,
  
  // Access Control
  canAccessPatientData,
  canAccessPatient,
  canAccessPhysician,
  canSendMessage,
  
  // Display Helpers
  getPermissionDescription,
  getRoleDisplayName,
  getRoleDescription,
  
  // Constants
  ROLE_PERMISSIONS,
  ALL_PERMISSIONS,
} from './rbac';

// ============================================
// Session Management
// ============================================

export {
  // Session Operations
  createSession,
  invalidateSession,
  invalidateUserSessions,
  resetTokenVersion,
  validateTokenVersion,
  getCurrentTokenVersion,
  getUserSessionInfo,
  invalidateMultipleUserSessions,
  
  // Constants
  SESSION_ERROR_CODES,
} from './session';

// ============================================
// Authentication Middleware
// ============================================

export {
  // Authentication
  requireAuth,
  
  // Authorization
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireRole,
  
  // Higher-order Functions
  withAuth,
  withPermission,
  
  // Request Helpers
  getClientIp,
  getUserAgent,
  
  // Types
  type AuthenticatedUser,
  type AuthenticatedRequest,
} from './require-auth';

// ============================================
// Session Helpers (Server Components)
// ============================================

export {
  // Session Retrieval
  getToken,
  getSession,
  getCurrentUser,
  
  // Server Component Guards
  requireAuth as requireAuthServer,
  requireRole as requireRoleServer,
  hasRole,
  hasAnyRole,
  
  // Server Actions
  authenticateAction,
  authorizeAction,
  
  // Cookie Management
  setAuthCookies,
  clearAuthCookies,
  
  // Utilities
  isAuthenticated,
  getUserId,
  getUserRole,
  redirectToLogin,
  redirectToDashboard,
  
  // Types
  type SessionUser,
  type SessionData,
  type AuthResult,
} from './session-helpers';

// ============================================
// Account Lockout
// ============================================

export {
  // Lockout Management
  checkLockoutStatus,
  recordFailedAttempt,
  clearFailedAttempts,
  checkAuthenticationAllowed,
  lockAccount,
  unlockAccount,
  getBulkLockoutStatus,
  
  // IP Rate Limiting
  checkIpRateLimit,
  recordIpAttempt,
  
  // Constants
  LOCKOUT_CONSTANTS,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_SECONDS,
  
  // Types
  type LockoutStatus,
  type AuthenticationAttempt,
} from './account-lockout';
