/**
 * Security Headers Configuration
 * 
 * Defines security headers for HIPAA compliance and general security.
 * These headers are applied via Next.js config and middleware.
 * 
 * HIPAA Compliance:
 * - HSTS for secure transport
 * - CSP to prevent XSS
 * - X-Frame-Options to prevent clickjacking
 * - Referrer-Policy for privacy
 * 
 * @module lib/security/headers
 */

import { SECURITY_HEADERS, CSP_DIRECTIVES, buildCSPHeader } from '@/lib/constants';

// Re-export from constants for convenience
export { SECURITY_HEADERS, CSP_DIRECTIVES, buildCSPHeader };

// ============================================
// Header Types
// ============================================

export interface SecurityHeaderConfig {
  key: string;
  value: string;
}

export interface RouteHeaderConfig {
  source: string;
  headers: SecurityHeaderConfig[];
}

// ============================================
// Header Builders
// ============================================

/**
 * Build CSP header with nonce support
 * 
 * @param nonce - Optional nonce for inline scripts
 * @returns CSP header value
 */
export function buildCSPWithNonce(nonce?: string): string {
  const directives: Record<string, string[]> = {};
  
  // Convert readonly arrays to mutable
  for (const [key, values] of Object.entries(CSP_DIRECTIVES)) {
    directives[key] = [...values];
  }
  
  if (nonce) {
    // Add nonce to script-src
    directives['script-src'] = [...directives['script-src'], `'nonce-${nonce}'`];
  }
  
  return Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) return key;
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
}

/**
 * Get all security headers
 * 
 * @param nonce - Optional nonce for CSP
 * @returns Array of security headers
 */
export function getSecurityHeaders(nonce?: string): SecurityHeaderConfig[] {
  const csp = nonce ? buildCSPWithNonce(nonce) : SECURITY_HEADERS['Content-Security-Policy'];
  
  return [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Frame-Options', value: SECURITY_HEADERS['X-Frame-Options'] },
    { key: 'X-Content-Type-Options', value: SECURITY_HEADERS['X-Content-Type-Options'] },
    { key: 'X-XSS-Protection', value: SECURITY_HEADERS['X-XSS-Protection'] },
    { key: 'Referrer-Policy', value: SECURITY_HEADERS['Referrer-Policy'] },
    { key: 'Permissions-Policy', value: SECURITY_HEADERS['Permissions-Policy'] },
    { key: 'Strict-Transport-Security', value: SECURITY_HEADERS['Strict-Transport-Security'] },
    { key: 'X-DNS-Prefetch-Control', value: SECURITY_HEADERS['X-DNS-Prefetch-Control'] },
    { key: 'Cross-Origin-Embedder-Policy', value: SECURITY_HEADERS['Cross-Origin-Embedder-Policy'] },
    { key: 'Cross-Origin-Opener-Policy', value: SECURITY_HEADERS['Cross-Origin-Opener-Policy'] },
    { key: 'Cross-Origin-Resource-Policy', value: SECURITY_HEADERS['Cross-Origin-Resource-Policy'] },
  ];
}

/**
 * Get API-specific security headers
 * 
 * API routes need different CSP since they return JSON
 * 
 * @returns API security headers
 */
export function getApiSecurityHeaders(): SecurityHeaderConfig[] {
  return [
    { key: 'Content-Type', value: 'application/json; charset=utf-8' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Strict-Transport-Security', value: SECURITY_HEADERS['Strict-Transport-Security'] },
    // API routes don't need CSP as they return JSON
    { key: 'Content-Security-Policy', value: "default-src 'none'; frame-ancestors 'none';" },
  ];
}

/**
 * Get static asset headers
 * 
 * Static assets can have more permissive CSP and longer cache times
 * 
 * @returns Static asset headers
 */
export function getStaticAssetHeaders(): SecurityHeaderConfig[] {
  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ];
}

// ============================================
// Next.js Config Helpers
// ============================================

/**
 * Generate headers configuration for next.config.ts
 * 
 * @returns Headers configuration array
 */
export function generateNextConfigHeaders(): RouteHeaderConfig[] {
  return [
    // Apply security headers to all routes
    {
      source: '/:path*',
      headers: getSecurityHeaders(),
    },
    // API routes
    {
      source: '/api/:path*',
      headers: getApiSecurityHeaders(),
    },
    // Static assets
    {
      source: '/static/:path*',
      headers: getStaticAssetHeaders(),
    },
    // Images
    {
      source: '/images/:path*',
      headers: [
        ...getStaticAssetHeaders(),
        { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
      ],
    },
  ];
}

// ============================================
// Middleware Helpers
// ============================================

/**
 * Add security headers to response
 * 
 * @param headers - Headers object to modify
 * @param nonce - Optional nonce for CSP
 */
export function addSecurityHeaders(
  headers: Headers,
  nonce?: string
): void {
  const securityHeaders = getSecurityHeaders(nonce);
  
  for (const { key, value } of securityHeaders) {
    headers.set(key, value);
  }
}

/**
 * Remove potentially dangerous headers
 * 
 * @param headers - Headers object to modify
 */
export function removeDangerousHeaders(headers: Headers): void {
  // Remove headers that might leak server information
  headers.delete('X-Powered-By');
  headers.delete('Server');
  headers.delete('X-AspNet-Version');
  headers.delete('X-AspNetMvc-Version');
}

// ============================================
// CSP Nonce Generation
// ============================================

/**
 * Generate CSP nonce
 * 
 * @returns Base64-encoded random nonce
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

// ============================================
// Header Validation
// ============================================

/**
 * Validate security headers are present
 * 
 * @param headers - Headers to check
 * @returns Validation result
 */
export function validateSecurityHeaders(headers: Headers): {
  valid: boolean;
  missing: string[];
} {
  const requiredHeaders = [
    'Content-Security-Policy',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Strict-Transport-Security',
  ];
  
  const missing: string[] = [];
  
  for (const header of requiredHeaders) {
    if (!headers.get(header)) {
      missing.push(header);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

// ============================================
// Report-Only Mode
// ============================================

/**
 * Build CSP report-only header
 * 
 * Use this during CSP rollout to test without blocking
 * 
 * @param reportUri - URI to send violation reports
 * @returns CSP report-only header value
 */
export function buildCSPReportOnly(reportUri?: string): string {
  const csp = SECURITY_HEADERS['Content-Security-Policy'];
  
  if (reportUri) {
    return `${csp}; report-uri ${reportUri};`;
  }
  
  return csp;
}

/**
 * Get report-only security headers
 * 
 * For testing security headers without enforcing
 * 
 * @param reportUri - URI for CSP reports
 * @returns Report-only headers
 */
export function getReportOnlyHeaders(reportUri?: string): SecurityHeaderConfig[] {
  return [
    { key: 'Content-Security-Policy-Report-Only', value: buildCSPReportOnly(reportUri) },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' }, // Less strict for testing
    { key: 'X-Content-Type-Options', value: SECURITY_HEADERS['X-Content-Type-Options'] },
    { key: 'Referrer-Policy', value: SECURITY_HEADERS['Referrer-Policy'] },
  ];
}
