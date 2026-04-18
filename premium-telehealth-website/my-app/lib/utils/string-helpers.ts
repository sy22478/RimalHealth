/**
 * String Helper Utilities
 * 
 * Provides common string manipulation, formatting, and sanitization functions.
 * HIPAA-aware string handling for medical data.
 * 
 * @module lib/utils/string-helpers
 */

// ============================================
// Types
// ============================================

export interface TruncateOptions {
  length: number;
  suffix?: string;
  wordBoundary?: boolean;
}

export interface SlugifyOptions {
  lowercase?: boolean;
  separator?: string;
  strict?: boolean;
}

// ============================================
// Basic Manipulation
// ============================================

/**
 * Truncate string to specified length
 * 
 * @param str - String to truncate
 * @param options - Truncate options
 * @returns Truncated string
 */
export function truncate(
  str: string | null | undefined,
  options: TruncateOptions
): string {
  if (!str) return '';
  
  const { length, suffix = '...', wordBoundary = false } = options;
  
  if (str.length <= length) return str;
  
  let truncated = str.substring(0, length - suffix.length);
  
  if (wordBoundary) {
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 0) {
      truncated = truncated.substring(0, lastSpace);
    }
  }
  
  return truncated + suffix;
}

/**
 * Capitalize first letter
 * 
 * @param str - String to capitalize
 * @returns Capitalized string
 */
export function capitalize(str: string | null | undefined): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Capitalize each word
 * 
 * @param str - String to capitalize
 * @returns Title case string
 */
export function capitalizeWords(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .split(' ')
    .map(word => capitalize(word))
    .join(' ');
}

/**
 * Convert to camelCase
 * 
 * @param str - String to convert
 * @returns camelCase string
 */
export function toCamelCase(str: string | null | undefined): string {
  if (!str) return '';
  
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
      index === 0 ? word.toLowerCase() : word.toUpperCase()
    )
    .replace(/\s+/g, '')
    .replace(/[-_]/g, '');
}

/**
 * Convert to PascalCase
 * 
 * @param str - String to convert
 * @returns PascalCase string
 */
export function toPascalCase(str: string | null | undefined): string {
  if (!str) return '';
  
  return str
    .replace(new RegExp(/[-_]+/, 'g'), ' ')
    .replace(new RegExp(/[^\w\s]/, 'g'), '')
    .replace(
      /\s+(.)(\w*)/g,
      (_, first, rest) => `${first.toUpperCase()}${rest.toLowerCase()}`
    )
    .replace(/^./, first => first.toUpperCase());
}

/**
 * Convert to snake_case
 * 
 * @param str - String to convert
 * @returns snake_case string
 */
export function toSnakeCase(str: string | null | undefined): string {
  if (!str) return '';
  
  return str
    .replace(/\W+/g, ' ')
    .split(/ |\B(?=[A-Z])/)
    .map(word => word.toLowerCase())
    .join('_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Convert to kebab-case
 * 
 * @param str - String to convert
 * @returns kebab-case string
 */
export function toKebabCase(str: string | null | undefined): string {
  if (!str) return '';
  
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

// ============================================
// Slug and URL
// ============================================

/**
 * Create URL-friendly slug
 * 
 * @param str - String to slugify
 * @param options - Slugify options
 * @returns URL slug
 */
export function slugify(
  str: string | null | undefined,
  options: SlugifyOptions = {}
): string {
  if (!str) return '';
  
  const { lowercase = true, separator = '-', strict = false } = options;
  
  let slug = str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s-]/g, strict ? '' : ' ') // Remove non-word chars (or replace with space)
    .trim()
    .replace(/\s+/g, separator)
    .replace(/-+/g, separator);
  
  if (lowercase) {
    slug = slug.toLowerCase();
  }
  
  return slug;
}

/**
 * Generate random string
 * 
 * @param length - String length
 * @returns Random string
 */
export function randomString(length: number = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * Generate random ID
 * 
 * @param prefix - ID prefix
 * @returns Random ID
 */
export function generateId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  const id = `${timestamp}-${random}`;
  
  return prefix ? `${prefix}_${id}` : id;
}

// ============================================
// Formatting
// ============================================

/**
 * Format phone number
 * 
 * @param phone - Phone number to format
 * @returns Formatted phone number
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Format as (XXX) XXX-XXXX
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // Format as +X (XXX) XXX-XXXX for international
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  // Return as-is if doesn't match expected formats
  return phone;
}

/**
 * Format SSN (masking all but last 4)
 * 
 * @param ssn - SSN to format
 * @returns Masked SSN
 */
export function formatSSN(ssn: string | null | undefined): string {
  if (!ssn) return '';
  
  const cleaned = ssn.replace(/\D/g, '');
  
  if (cleaned.length !== 9) return ssn;
  
  // Return masked: ***-**-XXXX
  return `***-**-${cleaned.slice(-4)}`;
}

/**
 * Format ZIP code
 * 
 * @param zip - ZIP code to format
 * @returns Formatted ZIP code
 */
export function formatZipCode(zip: string | null | undefined): string {
  if (!zip) return '';
  
  const cleaned = zip.replace(/\D/g, '');
  
  // Format as XXXXX-XXXX for ZIP+4
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
  }
  
  return cleaned;
}

/**
 * Format number with commas
 * 
 * @param num - Number to format
 * @returns Formatted number string
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '';
  return num.toLocaleString('en-US');
}

/**
 * Format currency
 * 
 * @param amount - Amount to format
 * @param decimals - Number of decimal places
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number | null | undefined,
  decimals: number = 2
): string {
  if (amount === null || amount === undefined) return '';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

// ============================================
// Masking and Redaction
// ============================================

/**
 * Mask string with asterisks
 * 
 * @param str - String to mask
 * @param visibleChars - Number of characters to show at end
 * @returns Masked string
 */
export function maskString(
  str: string | null | undefined,
  visibleChars: number = 4
): string {
  if (!str) return '';
  
  if (str.length <= visibleChars) {
    return '*'.repeat(str.length);
  }
  
  return '*'.repeat(str.length - visibleChars) + str.slice(-visibleChars);
}

/**
 * Mask phone number — show last 4 digits only, e.g. (•••) •••-1234
 *
 * @param phone - Phone number to mask
 * @returns Masked phone number, or "No phone" when empty
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return 'No phone';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '(•••) •••-••••';
  return `(•••) •••-${digits.slice(-4)}`;
}

/**
 * Mask email address
 *
 * @param email - Email to mask
 * @returns Masked email
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  
  const [local, domain] = email.split('@');
  if (!domain) return maskString(email);
  
  const maskedLocal = local.charAt(0) + '*'.repeat(Math.max(0, local.length - 1));
  return `${maskedLocal}@${domain}`;
}

/**
 * Redact sensitive information
 * 
 * @param str - String to redact
 * @returns Redacted string
 */
export function redact(str: string | null | undefined): string {
  if (!str) return '';
  return '[REDACTED]';
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Check if string is empty or whitespace only
 * 
 * @param str - String to check
 * @returns True if empty
 */
export function isEmpty(str: string | null | undefined): boolean {
  return !str || str.trim().length === 0;
}

/**
 * Check if string contains only digits
 * 
 * @param str - String to check
 * @returns True if numeric
 */
export function isNumeric(str: string | null | undefined): boolean {
  if (!str) return false;
  return /^\d+$/.test(str);
}

/**
 * Check if string is valid email
 * 
 * @param str - String to check
 * @returns True if valid email
 */
export function isValidEmail(str: string | null | undefined): boolean {
  if (!str) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

/**
 * Check if string contains any of the search terms
 * 
 * @param str - String to search
 * @param terms - Terms to look for
 * @returns True if any term found
 */
export function containsAny(str: string, terms: string[]): boolean {
  const lowerStr = str.toLowerCase();
  return terms.some(term => lowerStr.includes(term.toLowerCase()));
}

// ============================================
// Parsing
// ============================================

/**
 * Parse boolean from string
 * 
 * @param str - String to parse
 * @returns Boolean value
 */
export function parseBoolean(str: string | null | undefined): boolean {
  if (!str) return false;
  return ['true', '1', 'yes', 'on'].includes(str.toLowerCase());
}

/**
 * Safely parse integer
 * 
 * @param str - String to parse
 * @param defaultValue - Default if parsing fails
 * @returns Parsed integer
 */
export function parseIntSafe(
  str: string | null | undefined,
  defaultValue: number = 0
): number {
  if (!str) return defaultValue;
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Safely parse float
 * 
 * @param str - String to parse
 * @param defaultValue - Default if parsing fails
 * @returns Parsed float
 */
export function parseFloatSafe(
  str: string | null | undefined,
  defaultValue: number = 0
): number {
  if (!str) return defaultValue;
  const parsed = parseFloat(str);
  return isNaN(parsed) ? defaultValue : parsed;
}

// ============================================
// Multi-line and Whitespace
// ============================================

/**
 * Remove extra whitespace
 * 
 * @param str - String to clean
 * @returns Cleaned string
 */
export function removeExtraWhitespace(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Remove all whitespace
 * 
 * @param str - String to clean
 * @returns String without whitespace
 */
export function removeAllWhitespace(str: string | null | undefined): string {
  if (!str) return '';
  return str.replace(/\s+/g, '');
}

/**
 * Remove line breaks
 * 
 * @param str - String to clean
 * @param replacement - Replacement for line breaks
 * @returns Single line string
 */
export function removeLineBreaks(
  str: string | null | undefined,
  replacement: string = ' '
): string {
  if (!str) return '';
  return str.replace(/[\r\n]+/g, replacement).trim();
}

// ============================================
// Medical String Helpers
// ============================================

/**
 * Format patient name
 * 
 * @param firstName - First name
 * @param lastName - Last name
 * @param middleName - Optional middle name
 * @returns Formatted full name
 */
export function formatPatientName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  middleName?: string | null
): string {
  const parts = [firstName, middleName, lastName].filter(Boolean);
  return parts.join(' ');
}

/**
 * Format medical record number
 * 
 * @param mrn - Medical record number
 * @returns Formatted MRN
 */
export function formatMRN(mrn: string | null | undefined): string {
  if (!mrn) return '';
  
  // Remove non-alphanumeric
  const cleaned = mrn.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  // Format as MRN-XXXXXXX if numeric
  if (/^\d+$/.test(cleaned) && cleaned.length <= 10) {
    return `MRN-${cleaned.padStart(7, '0')}`;
  }
  
  return cleaned;
}

/**
 * Abbreviate text for medical summaries
 * 
 * @param text - Text to abbreviate
 * @param maxLength - Maximum length
 * @returns Abbreviated text
 */
export function abbreviateMedical(
  text: string | null | undefined,
  maxLength: number = 100
): string {
  if (!text) return '';
  
  return truncate(text, {
    length: maxLength,
    suffix: '...',
    wordBoundary: true,
  });
}
