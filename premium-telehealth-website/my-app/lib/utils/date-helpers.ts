/**
 * Date/Time Helper Utilities
 * 
 * Provides timezone-aware date handling, formatting, and calculations.
 * HIPAA-compliant date handling for medical records.
 * 
 * @module lib/utils/date-helpers
 */

import { format, parseISO, isValid, differenceInYears, differenceInDays, addDays, subDays, startOfDay, endOfDay, isBefore, isAfter, isEqual } from 'date-fns';

// ============================================
// Types
// ============================================

export interface DateRange {
  start: Date;
  end: Date;
}

export interface TimeZoneOptions {
  timeZone?: string;
  locale?: string;
}

// ============================================
// Constants
// ============================================

/** Default timezone (California) */
export const DEFAULT_TIMEZONE = 'America/Los_Angeles';

/** Date formats */
export const DATE_FORMATS = {
  /** ISO date: 2024-01-15 */
  ISO: 'yyyy-MM-dd',
  /** ISO datetime: 2024-01-15T14:30:00 */
  ISO_DATETIME: "yyyy-MM-dd'T'HH:mm:ss",
  /** Display date: Jan 15, 2024 */
  DISPLAY: 'MMM d, yyyy',
  /** Display with time: Jan 15, 2024 at 2:30 PM */
  DISPLAY_WITH_TIME: "MMM d, yyyy 'at' h:mm a",
  /** Short date: 01/15/2024 */
  SHORT: 'MM/dd/yyyy',
  /** Full date: January 15, 2024 */
  FULL: 'MMMM d, yyyy',
  /** Time only: 2:30 PM */
  TIME: 'h:mm a',
  /** 24-hour time: 14:30 */
  TIME_24: 'HH:mm',
  /** Medical record date: 15-Jan-2024 */
  MEDICAL: 'dd-MMM-yyyy',
  /** Timestamp for filenames: 20240115_143000 */
  FILENAME: 'yyyyMMdd_HHmmss',
} as const;

// ============================================
// Parsing
// ============================================

/**
 * Parse a date string safely
 * 
 * @param date - Date string or Date object
 * @returns Parsed Date or null if invalid
 */
export function parseDate(date: string | Date | null | undefined): Date | null {
  if (!date) return null;
  
  if (date instanceof Date) {
    return isValid(date) ? date : null;
  }
  
  // Try parsing ISO string
  const parsed = parseISO(date);
  return isValid(parsed) ? parsed : null;
}

/**
 * Parse a date string, returning current date as fallback
 * 
 * @param date - Date string or Date object
 * @returns Parsed Date or current date
 */
export function parseDateOrNow(date: string | Date | null | undefined): Date {
  return parseDate(date) || new Date();
}

/**
 * Parse date from multiple formats
 * 
 * @param date - Date string
 * @returns Parsed Date or null
 */
export function parseDateFlexible(date: string): Date | null {
  // Try ISO format first
  const parsed = parseDate(date);
  if (parsed) return parsed;
  
  // Try common formats
  const formats = [
    'MM/dd/yyyy',
    'MM-dd-yyyy',
    'yyyy/MM/dd',
    'dd/MM/yyyy',
    'dd-MM-yyyy',
    'MMMM d, yyyy',
    'MMM d, yyyy',
  ];
  
  for (const fmt of formats) {
    try {
      // Simple parsing attempt
      const parts = date.split(/[\/\-\s,]+/);
      if (parts.length >= 3) {
        // Try as MM/DD/YYYY
        const month = parseInt(parts[0], 10) - 1;
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        
        const candidate = new Date(year, month, day);
        if (isValid(candidate)) {
          return candidate;
        }
      }
    } catch {
      // Continue to next format
    }
  }
  
  return null;
}

// ============================================
// Formatting
// ============================================

/**
 * Format a date for display
 * 
 * @param date - Date to format
 * @param formatStr - Format string (from DATE_FORMATS)
 * @param options - Timezone options
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string | null | undefined,
  formatStr: string = DATE_FORMATS.DISPLAY,
  options?: TimeZoneOptions
): string {
  const parsed = parseDate(date);
  if (!parsed) return '';
  
  try {
    return format(parsed, formatStr);
  } catch {
    return '';
  }
}

/**
 * Format date for medical records
 * 
 * @param date - Date to format
 * @returns Formatted date (15-Jan-2024)
 */
export function formatMedicalDate(date: Date | string | null | undefined): string {
  return formatDate(date, DATE_FORMATS.MEDICAL);
}

/**
 * Format date for API/storage
 * 
 * @param date - Date to format
 * @returns ISO date string
 */
export function formatISODate(date: Date | string | null | undefined): string {
  return formatDate(date, DATE_FORMATS.ISO);
}

/**
 * Format date and time for display
 * 
 * @param date - Date to format
 * @returns Formatted date with time
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  return formatDate(date, DATE_FORMATS.DISPLAY_WITH_TIME);
}

/**
 * Format time only
 * 
 * @param date - Date to format
 * @param use24Hour - Use 24-hour format
 * @returns Formatted time string
 */
export function formatTime(
  date: Date | string | null | undefined,
  use24Hour: boolean = false
): string {
  return formatDate(date, use24Hour ? DATE_FORMATS.TIME_24 : DATE_FORMATS.TIME);
}

/**
 * Format date for filename (safe characters only)
 * 
 * @param date - Date to format
 * @returns Filename-safe date string
 */
export function formatDateForFilename(date: Date | string | null | undefined): string {
  return formatDate(date, DATE_FORMATS.FILENAME);
}

/**
 * Format relative time (e.g., "2 hours ago")
 * 
 * @param date - Date to format
 * @returns Relative time string
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  const parsed = parseDate(date);
  if (!parsed) return '';
  
  const now = new Date();
  const diffMs = now.getTime() - parsed.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;

  return formatDate(parsed);
}

/**
 * Format a timestamp in the clinic's timezone (America/Los_Angeles) for the
 * physician portal.
 *
 * Pinning the timezone serves two purposes: (1) SSR and client renders compute
 * the same string, avoiding React hydration mismatches; (2) every physician
 * sees the same wall-clock time regardless of their own browser timezone, which
 * is what the runtime-QA "timezone inconsistency" finding (PORTAL-02) flagged.
 *
 * Use for true timestamps (submittedAt, reviewedAt, completedAt). Do NOT use for
 * date-only values like DOB — those are timezone-agnostic calendar dates and are
 * parsed locally elsewhere to avoid a day-boundary shift.
 */
export function formatClinicDateTime(date: Date | string | null | undefined): string {
  const parsed = parseDate(date);
  if (!parsed) return '';

  return parsed.toLocaleString('en-US', {
    timeZone: DEFAULT_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Format a timestamp as a clinic-timezone date (no time component) for the
 * physician portal. Same timezone-pinning rationale as formatClinicDateTime.
 *
 * Use for timestamps that are displayed as a date (e.g. review date, last
 * visit). Do NOT use for DOB.
 */
export function formatClinicDate(date: Date | string | null | undefined): string {
  const parsed = parseDate(date);
  if (!parsed) return '';

  return parsed.toLocaleDateString('en-US', {
    timeZone: DEFAULT_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ============================================
// Calculations
// ============================================

/**
 * Calculate age from date of birth
 * 
 * @param dateOfBirth - Date of birth
 * @returns Age in years
 */
export function calculateAge(dateOfBirth: Date | string | null | undefined): number | null {
  const dob = parseDate(dateOfBirth);
  if (!dob) return null;
  
  return differenceInYears(new Date(), dob);
}

/**
 * Check if patient is adult (18+)
 * 
 * @param dateOfBirth - Date of birth
 * @returns True if 18 or older
 */
export function isAdult(dateOfBirth: Date | string | null | undefined): boolean | null {
  const age = calculateAge(dateOfBirth);
  return age !== null ? age >= 18 : null;
}

/**
 * Calculate days between two dates
 * 
 * @param start - Start date
 * @param end - End date
 * @returns Number of days
 */
export function daysBetween(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined
): number | null {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  
  if (!startDate || !endDate) return null;
  
  return differenceInDays(endDate, startDate);
}

/**
 * Check if date is in the past
 * 
 * @param date - Date to check
 * @returns True if in the past
 */
export function isPast(date: Date | string | null | undefined): boolean {
  const parsed = parseDate(date);
  if (!parsed) return false;
  
  return isBefore(parsed, new Date());
}

/**
 * Check if date is in the future
 * 
 * @param date - Date to check
 * @returns True if in the future
 */
export function isFuture(date: Date | string | null | undefined): boolean {
  const parsed = parseDate(date);
  if (!parsed) return false;
  
  return isAfter(parsed, new Date());
}

/**
 * Check if date is today
 * 
 * @param date - Date to check
 * @returns True if today
 */
export function isToday(date: Date | string | null | undefined): boolean {
  const parsed = parseDate(date);
  if (!parsed) return false;
  
  const today = new Date();
  return (
    parsed.getDate() === today.getDate() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getFullYear() === today.getFullYear()
  );
}

// ============================================
// Date Manipulation
// ============================================

/**
 * Add days to a date
 * 
 * @param date - Starting date
 * @param days - Days to add
 * @returns New date
 */
export function addDaysToDate(
  date: Date | string | null | undefined,
  days: number
): Date | null {
  const parsed = parseDate(date);
  if (!parsed) return null;
  
  return addDays(parsed, days);
}

/**
 * Subtract days from a date
 * 
 * @param date - Starting date
 * @param days - Days to subtract
 * @returns New date
 */
export function subtractDaysFromDate(
  date: Date | string | null | undefined,
  days: number
): Date | null {
  const parsed = parseDate(date);
  if (!parsed) return null;
  
  return subDays(parsed, days);
}

/**
 * Get start of day
 * 
 * @param date - Date
 * @returns Start of day
 */
export function getStartOfDay(date: Date | string | null | undefined): Date | null {
  const parsed = parseDate(date);
  if (!parsed) return null;
  
  return startOfDay(parsed);
}

/**
 * Get end of day
 * 
 * @param date - Date
 * @returns End of day
 */
export function getEndOfDay(date: Date | string | null | undefined): Date | null {
  const parsed = parseDate(date);
  if (!parsed) return null;
  
  return endOfDay(parsed);
}

/**
 * Get date range for a day
 * 
 * @param date - Date
 * @returns Start and end of day
 */
export function getDayRange(date: Date | string | null | undefined): DateRange | null {
  const parsed = parseDate(date);
  if (!parsed) return null;
  
  return {
    start: startOfDay(parsed),
    end: endOfDay(parsed),
  };
}

// ============================================
// Validation
// ============================================

/**
 * Validate date is in valid range
 * 
 * @param date - Date to validate
 * @param minDate - Minimum allowed date
 * @param maxDate - Maximum allowed date
 * @returns Validation result
 */
export function validateDateRange(
  date: Date | string | null | undefined,
  minDate?: Date | string,
  maxDate?: Date | string
): { valid: boolean; error?: string } {
  const parsed = parseDate(date);
  if (!parsed) {
    return { valid: false, error: 'Invalid date' };
  }
  
  if (minDate) {
    const min = parseDate(minDate);
    if (min && isBefore(parsed, min)) {
      return { valid: false, error: `Date must be after ${formatDate(min)}` };
    }
  }
  
  if (maxDate) {
    const max = parseDate(maxDate);
    if (max && isAfter(parsed, max)) {
      return { valid: false, error: `Date must be before ${formatDate(max)}` };
    }
  }
  
  return { valid: true };
}

/**
 * Check if date is within last N days
 * 
 * @param date - Date to check
 * @param days - Number of days
 * @returns True if within range
 */
export function isWithinLastDays(
  date: Date | string | null | undefined,
  days: number
): boolean {
  const parsed = parseDate(date);
  if (!parsed) return false;
  
  const cutoff = subDays(new Date(), days);
  return isAfter(parsed, cutoff) || isEqual(parsed, cutoff);
}

/**
 * Check if date is within next N days
 * 
 * @param date - Date to check
 * @param days - Number of days
 * @returns True if within range
 */
export function isWithinNextDays(
  date: Date | string | null | undefined,
  days: number
): boolean {
  const parsed = parseDate(date);
  if (!parsed) return false;
  
  const cutoff = addDays(new Date(), days);
  return isBefore(parsed, cutoff) || isEqual(parsed, cutoff);
}

// ============================================
// HIPAA-Specific Functions
// ============================================

/**
 * Format date for HIPAA de-identification (month/year only)
 * 
 * For dates that need to be de-identified, keep only month and year
 * if the patient is over 89 years old.
 * 
 * @param date - Date to de-identify
 * @returns De-identified date string
 */
export function deidentifyDate(date: Date | string | null | undefined): string {
  const parsed = parseDate(date);
  if (!parsed) return '';
  
  const age = calculateAge(parsed);
  
  // If person is over 89, only show year
  if (age && age > 89) {
    return parsed.getFullYear().toString();
  }
  
  // Otherwise show month and year
  return format(parsed, 'MM/yyyy');
}

/**
 * Check if date is valid for medical record
 * 
 * Ensures date is not in the future and within reasonable range.
 * 
 * @param date - Date to validate
 * @returns Validation result
 */
export function isValidMedicalDate(date: Date | string | null | undefined): {
  valid: boolean;
  error?: string;
} {
  const parsed = parseDate(date);
  if (!parsed) {
    return { valid: false, error: 'Invalid date format' };
  }
  
  // Check not in future
  if (isFuture(parsed)) {
    return { valid: false, error: 'Date cannot be in the future' };
  }
  
  // Check not too far in past (150 years)
  const maxAge = new Date();
  maxAge.setFullYear(maxAge.getFullYear() - 150);
  
  if (isBefore(parsed, maxAge)) {
    return { valid: false, error: 'Date is too far in the past' };
  }
  
  return { valid: true };
}

/**
 * Calculate retention date for medical records
 * 
 * HIPAA requires 7-year retention from date of service.
 * 
 * @param serviceDate - Date of service
 * @returns Date when record can be deleted
 */
export function calculateRetentionDate(
  serviceDate: Date | string | null | undefined
): Date | null {
  const parsed = parseDate(serviceDate);
  if (!parsed) return null;
  
  // Add 7 years (2555 days) per HIPAA
  return addDays(parsed, 2555);
}

// ============================================
// Timezone Handling
// ============================================

/**
 * Convert date to timezone string
 * 
 * @param date - Date to convert
 * @param timeZone - Target timezone
 * @returns Localized date string
 */
export function toTimeZone(
  date: Date | string | null | undefined,
  timeZone: string = DEFAULT_TIMEZONE
): string {
  const parsed = parseDate(date);
  if (!parsed) return '';
  
  return parsed.toLocaleString('en-US', { timeZone });
}

/**
 * Get current date in default timezone
 * 
 * @returns Current date string in default timezone
 */
export function getCurrentDateInTimeZone(): string {
  return new Date().toLocaleString('en-US', { timeZone: DEFAULT_TIMEZONE });
}

/**
 * Create date object for specific time in timezone
 * 
 * @param year - Year
 * @param month - Month (1-12)
 * @param day - Day
 * @param hour - Hour (0-23)
 * @param minute - Minute
 * @param timeZone - Timezone
 * @returns Date object
 */
export function createDateInTimeZone(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  timeZone: string = DEFAULT_TIMEZONE
): Date {
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  
  return new Date(dateStr);
}
