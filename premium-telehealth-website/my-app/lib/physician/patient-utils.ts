/**
 * Physician Patient Utility Functions
 * 
 * Pure helper functions that can be used on both client and server
 */

/**
 * Parse a date-only string (YYYY-MM-DD) as local date to avoid timezone shift.
 * "1999-04-03" stays April 3 in any timezone instead of becoming April 2 in PST.
 */
function parseDateOnly(date: Date | string): Date {
  if (date instanceof Date) return date;
  // If it's a date-only string (YYYY-MM-DD), parse as local time
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(date);
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  return parseDateOnly(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format date and time for display
 */
export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Calculate patient age from DOB
 */
export function calculateAge(dateOfBirth: string): number {
  const dob = parseDateOnly(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return age;
}

/**
 * Format patient name with initials for avatar
 */
export function getPatientInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/**
 * Get status badge variant based on status
 */
export function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status.toUpperCase()) {
    case 'APPROVED':
    case 'ACTIVE':
      return 'default';
    case 'PENDING':
    case 'SUBMITTED':
      return 'secondary';
    case 'REJECTED':
    case 'CANCELLED':
    case 'EXPIRED':
      return 'destructive';
    default:
      return 'outline';
  }
}

/**
 * Get priority badge variant
 */
export function getPriorityVariant(priority: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (priority.toUpperCase()) {
    case 'HIGH':
    case 'URGENT':
      return 'destructive';
    case 'MEDIUM':
      return 'secondary';
    case 'LOW':
      return 'outline';
    default:
      return 'default';
  }
}
