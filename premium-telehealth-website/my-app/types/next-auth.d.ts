/**
 * Type Augmentations for Authentication
 * 
 * This file contains TypeScript type declarations and augmentations
 * for the custom JWT-based authentication system.
 * 
 * @module types/next-auth
 */

import { Role } from '@prisma/client';

// ============================================
// JWT Payload Types
// ============================================

/**
 * Access Token JWT Payload
 * 
 * Contains minimal user information for authorization decisions.
 * NO PHI should be included in tokens.
 */
export interface AccessTokenPayload {
  /** User unique identifier (sub claim) */
  userId: string;
  
  /** User email address */
  email: string;
  
  /** User role for RBAC decisions */
  role: Role;
  
  /** Token type identifier */
  type: 'access';
  
  /** Issued at timestamp */
  iat: number;
  
  /** Expiration timestamp (15 minutes from iat) */
  exp: number;
  
  /** Subject claim (same as userId) */
  sub: string;
  
  /** Audience claim */
  aud: string;
  
  /** Issuer claim */
  iss: string;
}

/**
 * Refresh Token JWT Payload
 * 
 * Used to obtain new access tokens without re-authentication.
 * Includes tokenVersion for session invalidation support.
 */
export interface RefreshTokenPayload {
  /** User unique identifier */
  userId: string;
  
  /** Token type identifier */
  type: 'refresh';
  
  /** Token version for invalidation support */
  tokenVersion: number;
  
  /** Issued at timestamp */
  iat: number;
  
  /** Expiration timestamp (7 days from iat) */
  exp: number;
  
  /** Subject claim (same as userId) */
  sub: string;
  
  /** Audience claim */
  aud: string;
  
  /** Issuer claim */
  iss: string;
}

// ============================================
// Session Types
// ============================================

/**
 * Session User (minimal, no PHI)
 * 
 * This is the user object stored in session state.
 */
export interface SessionUser {
  /** User unique identifier */
  id: string;
  
  /** User email address */
  email: string;
  
  /** User role for access control */
  role: Role;
}

/**
 * Session Data Structure
 * 
 * Returned from session validation functions.
 */
export interface Session {
  /** User session data */
  user: SessionUser;
  
  /** Session expiration timestamp */
  expires: string;
}

// ============================================
// API Types
// ============================================

/**
 * Login Request Body
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Login Response
 */
export interface LoginResponse {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  redirectUrl: string;
}

/**
 * Register Request Body
 */
export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  termsAccepted: boolean;
}

/**
 * Register Response
 */
export interface RegisterResponse {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Refresh Token Request
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Refresh Token Response
 */
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Authentication Error Response
 */
export interface AuthErrorResponse {
  error: string;
  code: 
    | 'INVALID_CREDENTIALS'
    | 'VALIDATION_ERROR'
    | 'EMAIL_NOT_VERIFIED'
    | 'ACCOUNT_LOCKED'
    | 'TOKEN_EXPIRED'
    | 'INVALID_TOKEN'
    | 'SESSION_INVALIDATED'
    | 'INTERNAL_ERROR';
  message?: string;
  details?: Record<string, string[]>;
}

// ============================================
// Request Context Types
// ============================================

/**
 * Authenticated Request Headers
 * 
 * Headers added by middleware for downstream use.
 */
export interface AuthRequestHeaders {
  'x-user-id': string;
  'x-user-role': Role;
  'x-user-email': string;
}

/**
 * Authentication Context
 * 
 * Available in API routes after authentication.
 */
export interface AuthContext {
  user: SessionUser;
  token: string;
}

// ============================================
// Role-Based Types
// ============================================

/**
 * Role-specific route configurations
 */
export interface RoleRouteConfig {
  [Role.PATIENT]: string[];
  [Role.PHYSICIAN]: string[];
  [Role.ADMIN]: string[];
}

/**
 * Dashboard URLs by role
 */
export type RoleDashboardUrl = {
  [Role.PATIENT]: '/patient/dashboard';
  [Role.PHYSICIAN]: '/physician/queue';
  [Role.ADMIN]: '/admin/dashboard';
};

// ============================================
// Global Type Augmentations
// ============================================

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /** JWT secret for token signing */
      JWT_SECRET: string;
      
      /** Database connection string */
      DATABASE_URL: string;
      
      /** Redis connection URL */
      REDIS_URL?: string;
      
      /** Require email verification before login */
      REQUIRE_EMAIL_VERIFICATION?: 'true' | 'false';
      
      /** Application base URL */
      NEXT_PUBLIC_APP_URL?: string;
    }
  }
}

// ============================================
// Re-export Prisma Role for convenience
// ============================================

export { Role } from '@prisma/client';
