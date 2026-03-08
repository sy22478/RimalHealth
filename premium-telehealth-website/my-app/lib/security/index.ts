/**
 * Security Module
 * 
 * Centralized security utilities for the Rimal Health application.
 * Includes CSRF protection, rate limiting, input sanitization, and password policies.
 * 
 * @module lib/security
 */

// CSRF Protection
export {
  generateCSRFToken,
  generateSimpleCSRFToken,
  validateCSRFToken,
  validateCSRFTokenPair,
  setCSRFCookies,
  clearCSRFCookies,
  withCSRFProtection,
  csrfMiddleware,
  getClientCSRFToken,
  appendCSRFToken,
  withCSRFHeader,
  type CSRFTokenPair,
  type CSRFValidationResult,
  type CSRFMiddlewareOptions,
} from './csrf';

// Rate Limiting
export {
  checkRateLimit,
  createRateLimiter,
  createRateLimitResponse,
  apiRateLimiter,
  strictRateLimiter,
  loginRateLimiter,
  createUserRateLimiter,
  applyRateLimit,
  withRateLimit,
  resetRateLimit,
  resetLoginAttempts,
  initRateLimitStore,
  resetRateLimitStore,
  defaultKeyGenerator,
  userKeyGenerator,
  loginKeyGenerator,
  type RateLimitConfig,
  type RateLimitInfo,
  type RateLimitStore,
} from './rate-limit';

// Security Headers
export {
  getSecurityHeaders,
  getApiSecurityHeaders,
  getStaticAssetHeaders,
  generateNextConfigHeaders,
  addSecurityHeaders,
  removeDangerousHeaders,
  generateNonce,
  validateSecurityHeaders,
  buildCSPWithNonce,
  buildCSPReportOnly,
  getReportOnlyHeaders,
  type SecurityHeaderConfig,
  type RouteHeaderConfig,
} from './headers';

// Input Sanitization
export {
  escapeHtml,
  unescapeHtml,
  stripHtml,
  sanitizeHtml,
  sanitizeInput,
  sanitizeObject,
  detectSqlInjection,
  sanitizeForSql,
  sanitizeForNoSQL,
  sanitizeFilePath,
  isValidFilePath,
  sanitizeForShell,
  withSanitization,
  sanitizeEmail,
  sanitizeUrl,
  type SanitizationOptions,
  type ValidationError,
} from './sanitization';

// Password Policy
export {
  validatePassword,
  prehashPassword,
  generateSecurePassword,
  isPasswordInHistory,
  getPasswordRequirements,
  getPasswordStrengthFeedback,
  validatePasswordAsync,
  validatePasswordClient,
  type PasswordValidationResult,
  type PasswordPolicyConfig,
} from './password-policy';
