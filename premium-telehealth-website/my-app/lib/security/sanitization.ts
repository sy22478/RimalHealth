/**
 * Input Sanitization Module
 * 
 * Provides XSS protection and input sanitization for user-generated content.
 * Prevents injection attacks and ensures data integrity.
 * 
 * HIPAA Compliance:
 * - Prevents XSS attacks that could expose PHI
 * - Sanitizes user input before storage/display
 * - Protects against injection in medical data fields
 * 
 * @module lib/security/sanitization
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================
// Types
// ============================================

export interface SanitizationOptions {
  /** Allow specific HTML tags */
  allowedTags?: string[];
  /** Allow specific HTML attributes */
  allowedAttributes?: Record<string, string[]>;
  /** Remove all HTML tags */
  stripTags?: boolean;
  /** Maximum string length */
  maxLength?: number;
  /** Trim whitespace */
  trim?: boolean;
  /** Normalize whitespace */
  normalizeWhitespace?: boolean;
  /** Escape special characters */
  escape?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

// ============================================
// HTML Entity Encoding
// ============================================

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

const HTML_ENTITY_PATTERN = /[&<>"'`=/]/g;

/**
 * Escape HTML special characters
 * 
 * @param input - String to escape
 * @returns Escaped string
 */
export function escapeHtml(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input.replace(HTML_ENTITY_PATTERN, char => HTML_ENTITIES[char] || char);
}

/**
 * Decode HTML entities
 * 
 * @param input - String with HTML entities
 * @returns Decoded string
 */
export function unescapeHtml(input: string): string {
  if (typeof input !== 'string') return '';
  
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '=',
    '&#39;': "'",
  };
  
  return input.replace(/&[#a-zA-Z0-9]+;/g, entity => entities[entity] || entity);
}

// ============================================
// Tag Stripping
// ============================================

/** Dangerous HTML tags that should always be removed */
const DANGEROUS_TAGS = [
  'script', 'style', 'iframe', 'object', 'embed', 'form', 'input',
  'textarea', 'button', 'select', 'option', 'link', 'meta', 'base',
  'applet', 'blink', 'marquee', 'frame', 'frameset', 'xml',
];

/** Event attributes that should be removed */
const DANGEROUS_ATTRIBUTES = /^on/i;

/** JavaScript protocol pattern */
const JS_PROTOCOL = /^javascript:/i;

/**
 * Remove all HTML tags from string
 * 
 * @param input - String containing HTML
 * @returns Plain text string
 */
export function stripHtml(input: string): string {
  if (typeof input !== 'string') return '';
  
  // First remove dangerous tags with their content
  let sanitized = input;
  
  for (const tag of DANGEROUS_TAGS) {
    // Remove tag with content
    const tagRegex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    sanitized = sanitized.replace(tagRegex, '');
    // Remove self-closing tag
    const selfClosingRegex = new RegExp(`<${tag}[^>]*\\/?>`, 'gi');
    sanitized = sanitized.replace(selfClosingRegex, '');
  }
  
  // Remove remaining HTML tags
  sanitized = sanitized.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  sanitized = unescapeHtml(sanitized);
  
  return sanitized;
}

/**
 * Sanitize HTML by allowing only specific tags and attributes
 * 
 * @param input - String containing HTML
 * @param options - Sanitization options
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(
  input: string,
  options: SanitizationOptions = {}
): string {
  if (typeof input !== 'string') return '';
  
  const {
    allowedTags = ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li'],
    allowedAttributes = {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title'],
    },
  } = options;
  
  let sanitized = input;
  
  // Remove dangerous tags with content
  for (const tag of DANGEROUS_TAGS) {
    const tagRegex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
    sanitized = sanitized.replace(tagRegex, '');
    const selfClosingRegex = new RegExp(`<${tag}[^>]*\\/?>`, 'gi');
    sanitized = sanitized.replace(selfClosingRegex, '');
  }
  
  // Process allowed tags
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
  
  sanitized = sanitized.replace(tagRegex, (match, tagName) => {
    const lowerTagName = tagName.toLowerCase();
    
    // If tag not allowed, remove it
    if (!allowedTags.includes(lowerTagName)) {
      return '';
    }
    
    // For allowed tags, process attributes
    const attrRegex = /([a-zA-Z-:]+)(?:=(?:(?:"([^"]*)")|(?:'([^']*)')|([^\s>]+)))?/g;
    let attrs = '';
    let attrMatch;
    
    const allowedAttrs = allowedAttributes[lowerTagName] || [];
    
    // Skip the tag name in attribute matching
    const attrString = match.replace(/<\/?[a-zA-Z][a-zA-Z0-9]*/, '');
    
    while ((attrMatch = attrRegex.exec(attrString)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrValue = attrMatch[2] || attrMatch[3] || attrMatch[4] || '';
      
      // Skip dangerous attributes
      if (DANGEROUS_ATTRIBUTES.test(attrName)) {
        continue;
      }
      
      // Skip if attribute not allowed for this tag
      if (!allowedAttrs.includes(attrName)) {
        continue;
      }
      
      // Sanitize href/src attributes
      if ((attrName === 'href' || attrName === 'src') && JS_PROTOCOL.test(attrValue)) {
        continue;
      }
      
      // Escape attribute value
      const escapedValue = escapeHtml(attrValue);
      attrs += ` ${attrName}="${escapedValue}"`;
    }
    
    const isClosing = match.startsWith('</');
    return isClosing ? `</${lowerTagName}>` : `<${lowerTagName}${attrs}>`;
  });
  
  return sanitized;
}

// ============================================
// General Input Sanitization
// ============================================

/**
 * Sanitize general input string
 * 
 * @param input - Input string
 * @param options - Sanitization options
 * @returns Sanitized string
 */
export function sanitizeInput(
  input: string,
  options: SanitizationOptions = {}
): string {
  if (typeof input !== 'string') return '';
  
  const {
    stripTags: shouldStripTags = true,
    maxLength = 10000,
    trim = true,
    normalizeWhitespace = true,
    escape: shouldEscape = false,
  } = options;
  
  let sanitized = input;
  
  // Trim whitespace
  if (trim) {
    sanitized = sanitized.trim();
  }
  
  // Normalize whitespace (collapse multiple spaces, normalize newlines)
  if (normalizeWhitespace) {
    sanitized = sanitized
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/ +/g, ' ');
  }
  
  // Strip HTML tags
  if (shouldStripTags) {
    sanitized = stripHtml(sanitized);
  }
  
  // Limit length
  if (maxLength > 0 && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  // Escape HTML entities
  if (shouldEscape) {
    sanitized = escapeHtml(sanitized);
  }
  
  return sanitized;
}

/**
 * Sanitize object values recursively
 * 
 * @param obj - Object to sanitize
 * @param options - Sanitization options
 * @returns Sanitized object
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: SanitizationOptions = {}
): T {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = { ...obj };
  
  for (const key of Object.keys(sanitized)) {
    const value = sanitized[key];
    
    if (typeof value === 'string') {
      (sanitized as Record<string, unknown>)[key] = sanitizeInput(value, options);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      (sanitized as Record<string, unknown>)[key] = sanitizeObject(
        value as Record<string, unknown>,
        options
      );
    } else if (Array.isArray(value)) {
      (sanitized as Record<string, unknown>)[key] = value.map(item =>
        typeof item === 'string'
          ? sanitizeInput(item, options)
          : typeof item === 'object' && item !== null
            ? sanitizeObject(item as Record<string, unknown>, options)
            : item
      );
    }
  }
  
  return sanitized;
}

// ============================================
// SQL Injection Prevention
// ============================================

/** SQL keywords to detect */
const SQL_KEYWORDS = [
  'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE',
  'ALTER', 'EXEC', 'EXECUTE', 'UNION', 'FETCH', 'DECLARE',
  'TRUNCATE', 'TABLE', 'FROM', 'WHERE', 'OR', 'AND',
];

/** SQL injection patterns */
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION)\b)/i,
  /(\-\-|\#|\/\*|\*\/)/, // SQL comments
  /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/i, // OR 1=1 patterns
  /(\bWAITFOR\b|\bDELAY\b|\bSHUTDOWN\b)/i,
  /(\bCAST\b|\bCONVERT\b)\s*\(/i,
  /(\bCHAR\s*\(|\bNCHAR\s*\(|\bVARCHAR\s*\()/i,
];

/**
 * Detect potential SQL injection
 * 
 * @param input - Input string to check
 * @returns True if potential SQL injection detected
 */
export function detectSqlInjection(input: string): boolean {
  if (typeof input !== 'string') return false;
  
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Sanitize input for SQL queries (parameterized queries preferred)
 * 
 * NOTE: This is a fallback. Always use parameterized queries or ORM.
 * 
 * @param input - Input string
 * @returns Sanitized string
 */
export function sanitizeForSql(input: string): string {
  if (typeof input !== 'string') return '';
  
  // Remove null bytes
  let sanitized = input.replace(/\x00/g, '');
  
  // Escape single quotes (for databases that require it)
  sanitized = sanitized.replace(/'/g, "''");
  
  // Remove dangerous characters
  sanitized = sanitized.replace(/[;\x00\x1a\x22\x27\\]/g, '');
  
  return sanitized;
}

// ============================================
// NoSQL Injection Prevention
// ============================================

/**
 * Sanitize input for NoSQL queries
 * 
 * Prevents MongoDB operator injection.
 * 
 * @param input - Input object or string
 * @returns Sanitized input
 */
export function sanitizeForNoSQL<T>(input: T): T {
  if (typeof input === 'string') {
    // Remove MongoDB operators
    return input.replace(/^\$/, '\uFF04') as unknown as T; // Replace $ with fullwidth $
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeForNoSQL) as unknown as T;
  }
  
  if (input && typeof input === 'object') {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(input)) {
      // Remove keys starting with $ (MongoDB operators)
      const safeKey = key.startsWith('$') ? key.replace(/^\$/, '\uFF04') : key;
      sanitized[safeKey] = sanitizeForNoSQL(value);
    }
    
    return sanitized as T;
  }
  
  return input;
}

// ============================================
// Path Traversal Prevention
// ============================================

/** Path traversal patterns */
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.[\\/]/, // ../ or ..\
  /\.\.\\/,     // ..\ (Windows)
  /%2e%2e[\\/]/i, // URL encoded ../
  /\\.\\./,      // ..\
  /^\//,        // Absolute path
  /^[a-z]:/i,   // Windows drive letter
];

/**
 * Sanitize file path to prevent directory traversal
 * 
 * @param path - File path to sanitize
 * @returns Sanitized path
 */
export function sanitizeFilePath(path: string): string {
  if (typeof path !== 'string') return '';
  
  // Decode URL encoding
  let sanitized = decodeURIComponent(path);
  
  // Normalize path separators
  sanitized = sanitized.replace(/\\/g, '/');
  
  // Remove null bytes
  sanitized = sanitized.replace(/\x00/g, '');
  
  // Remove path traversal attempts
  while (sanitized.includes('../')) {
    sanitized = sanitized.replace(/\.\.\//g, '');
  }
  
  // Remove leading slashes
  sanitized = sanitized.replace(/^\/+/, '');
  
  // Remove drive letters (Windows)
  sanitized = sanitized.replace(/^[a-zA-Z]:/, '');
  
  return sanitized;
}

/**
 * Validate file path
 * 
 * @param path - File path to validate
 * @returns True if path is valid
 */
export function isValidFilePath(path: string): boolean {
  if (typeof path !== 'string') return false;
  
  return !PATH_TRAVERSAL_PATTERNS.some(pattern => pattern.test(path));
}

// ============================================
// Command Injection Prevention
// ============================================

/** Dangerous shell characters */
const DANGEROUS_SHELL_CHARS = /[;&|`$(){}[\]\\\n\r*?~<>]/g;

/**
 * Sanitize input for shell commands
 * 
 * NOTE: Avoid shell execution when possible. Use execFile or spawn with arrays.
 * 
 * @param input - Input string
 * @returns Sanitized string
 */
export function sanitizeForShell(input: string): string {
  if (typeof input !== 'string') return '';
  
  // Remove dangerous characters
  return input.replace(DANGEROUS_SHELL_CHARS, '');
}

// ============================================
// Request/Response Middleware
// ============================================

/**
 * Middleware to sanitize request body
 * 
 * @param handler - API route handler
 * @param options - Sanitization options
 * @returns Wrapped handler
 */
export function withSanitization(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: SanitizationOptions = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // Clone request with sanitized body if it's JSON
    if (req.headers.get('content-type')?.includes('application/json')) {
      try {
        const body = await req.json();
        const sanitizedBody = sanitizeObject(body, options);
        
        // Create new request with sanitized body
        const sanitizedReq = new NextRequest(req.url, {
          method: req.method,
          headers: req.headers,
          body: JSON.stringify(sanitizedBody),
        });
        
        return handler(sanitizedReq);
      } catch {
        // If JSON parsing fails, continue with original request
        return handler(req);
      }
    }
    
    return handler(req);
  };
}

// ============================================
// Email Sanitization
// ============================================

/**
 * Sanitize email address
 * 
 * @param email - Email address
 * @returns Sanitized email or empty string if invalid
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') return '';
  
  // Remove whitespace and common injection characters
  let sanitized = email.trim().toLowerCase();
  sanitized = sanitized.replace(/[\s\x00\x0a\x0d]/g, '');
  
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(sanitized)) {
    return '';
  }
  
  return sanitized;
}

// ============================================
// URL Sanitization
// ============================================

/**
 * Sanitize URL
 * 
 * @param url - URL string
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') return '';
  
  try {
    const parsed = new URL(url);
    
    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    
    // Rebuild URL with encoded components
    return parsed.toString();
  } catch {
    return '';
  }
}
