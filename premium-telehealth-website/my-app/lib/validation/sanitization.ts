/**
 * Input Sanitization Utilities
 * 
 * Sanitizes user inputs to prevent XSS and other injection attacks.
 * Used before storing or displaying user-provided data.
 * 
 * HIPAA Compliance:
 * - Prevents script injection that could compromise PHI
 * - Maintains data integrity while removing harmful content
 * 
 * @module lib/validation/sanitization
 */

// ============================================================================
// HTML Entity Encoding Map
// ============================================================================

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

// ============================================================================
// String Sanitization
// ============================================================================

/**
 * Escape HTML special characters
 * Prevents XSS by converting characters to HTML entities
 * 
 * @param input - String to escape
 * @returns Escaped string
 */
export function escapeHtml(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Remove all HTML tags from string
 * Used for plain text fields where HTML is not allowed
 * 
 * @param input - String to clean
 * @returns String with HTML tags removed
 */
export function stripHtml(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize text input for storage
 * - Removes control characters
 * - Normalizes whitespace
 * - Trims leading/trailing whitespace
 * 
 * @param input - Raw input string
 * @param maxLength - Maximum allowed length
 * @returns Sanitized string
 */
export function sanitizeText(input: string, maxLength: number = 10000): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    // Normalize multiple spaces
    .replace(/\s+/g, ' ')
    // Trim
    .trim()
    // Limit length
    .slice(0, maxLength);
}

/**
 * Sanitize multi-line text
 * Preserves line breaks while sanitizing
 * 
 * @param input - Raw input string
 * @param maxLength - Maximum allowed length
 * @returns Sanitized multi-line string
 */
export function sanitizeMultilineText(input: string, maxLength: number = 10000): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Trim each line
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    // Trim overall
    .trim()
    // Limit length
    .slice(0, maxLength);
}

// ============================================================================
// Object Sanitization
// ============================================================================

/**
 * Recursively sanitize object values
 * Applies sanitization to all string values in an object
 * 
 * @param obj - Object to sanitize
 * @param maxLength - Maximum string length
 * @returns Sanitized object
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  maxLength: number = 10000
): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sanitized = { ...obj };

  for (const key in sanitized) {
    if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
      const value = sanitized[key];

      if (typeof value === 'string') {
        (sanitized as Record<string, unknown>)[key] = sanitizeText(value, maxLength);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        (sanitized as Record<string, unknown>)[key] = sanitizeObject(
          value as Record<string, unknown>,
          maxLength
        );
      } else if (Array.isArray(value)) {
        (sanitized as Record<string, unknown>)[key] = value.map((item) =>
          typeof item === 'string'
            ? sanitizeText(item, maxLength)
            : typeof item === 'object' && item !== null
            ? sanitizeObject(item as Record<string, unknown>, maxLength)
            : item
        );
      }
    }
  }

  return sanitized;
}

// ============================================================================
// Output Sanitization
// ============================================================================

/**
 * Prepare string for safe HTML display
 * Escapes HTML entities and converts newlines to <br> tags
 * 
 * @param input - Raw input string
 * @returns HTML-safe string
 */
export function toHtmlContent(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return escapeHtml(input)
    .replace(/\n/g, '<br>')
    .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
}

/**
 * Truncate text to a maximum length
 * Adds ellipsis if truncated
 * 
 * @param input - Input string
 * @param maxLength - Maximum length
 * @param suffix - Suffix to add if truncated (default: '...')
 * @returns Truncated string
 */
export function truncateText(input: string, maxLength: number, suffix: string = '...'): string {
  if (typeof input !== 'string' || input.length <= maxLength) {
    return input;
  }

  return input.slice(0, maxLength - suffix.length) + suffix;
}

// ============================================================================
// Specific Field Sanitization
// ============================================================================

/**
 * Sanitize name field
 * Allows letters, spaces, hyphens, and apostrophes
 * 
 * @param name - Raw name input
 * @returns Sanitized name
 */
export function sanitizeName(name: string): string {
  if (typeof name !== 'string') {
    return '';
  }

  return name
    .replace(/[^a-zA-Z\s\-'\.]/g, '') // Allow letters, spaces, hyphens, apostrophes, periods
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
    .slice(0, 100);
}

/**
 * Sanitize phone number
 * Removes all non-numeric characters except +
 * 
 * @param phone - Raw phone input
 * @returns Sanitized phone number
 */
export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') {
    return '';
  }

  return phone.replace(/[^\d+]/g, '').slice(0, 15);
}

/**
 * Sanitize email address
 * Lowercases and trims the email
 * 
 * @param email - Raw email input
 * @returns Normalized email
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') {
    return '';
  }

  return email.toLowerCase().trim().slice(0, 255);
}

// ============================================================================
// Response Sanitization
// ============================================================================

/**
 * Sanitize API response data
 * Removes sensitive fields and sanitizes strings
 * 
 * @param data - Response data object
 * @param sensitiveFields - Fields to remove
 * @returns Sanitized response
 */
export function sanitizeResponse<T extends Record<string, unknown>>(
  data: T,
  sensitiveFields: string[] = []
): Partial<T> {
  const sanitized = { ...data };

  // Remove sensitive fields
  for (const field of sensitiveFields) {
    delete (sanitized as Record<string, unknown>)[field];
  }

  // Sanitize string values
  for (const key in sanitized) {
    if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
      const value = sanitized[key];
      if (typeof value === 'string') {
        (sanitized as Record<string, unknown>)[key] = escapeHtml(value);
      }
    }
  }

  return sanitized;
}
