export const siteConfig = {
  name: "Rimal Health",
  description:
    "California-licensed physician-prescribed treatment for alcohol addiction.",
  url: "https://rimalhealth.com",
  supportEmail: "support@rimalhealth.com",
  license: "California Medical License",
};

/**
 * US states in which the service is currently available. Used to normalize
 * patient address state and to gate California-only business rules.
 * Single-source-of-truth for state expansion.
 */
export const ALLOWED_STATES = ['CA'] as const;
export type AllowedState = (typeof ALLOWED_STATES)[number];
/** Default state when a patient state needs to be forced to the allowed set. */
export const DEFAULT_ALLOWED_STATE: AllowedState = ALLOWED_STATES[0];

export const navLinks = [
  { href: "/about", label: "About" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
] as const;

export const footerLinks = {
  product: [
    { href: "/how-it-works", label: "How It Works" },
    { href: "/alcohol-treatment", label: "Alcohol Treatment" },
    { href: "/pricing", label: "Pricing" },
  ],
  company: [
    { href: "/about", label: "About" },
    { href: "/faq", label: "FAQ" },
    { href: "/contact", label: "Contact" },
    { href: "/for-physicians", label: "For Physicians" },
  ],
  legal: [
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms of Service" },
    { href: "/hipaa", label: "HIPAA Notice" },
  ],
} as const;

// ============================================
// Security Constants
// ============================================

/** Session and token expiration times (in seconds) */
export const SESSION_CONFIG = {
  /** Access token expiration: 15 minutes */
  ACCESS_TOKEN_EXPIRY: 15 * 60,
  /** Refresh token expiration: 7 days */
  REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60,
  /** CSRF token expiration: 1 hour */
  CSRF_TOKEN_EXPIRY: 60 * 60,
  /** Session idle timeout: 30 minutes */
  IDLE_TIMEOUT: 30 * 60,
  /** Absolute session max duration: 8 hours */
  ABSOLUTE_TIMEOUT: 8 * 60 * 60,
} as const;

/** Rate limiting configuration */
export const RATE_LIMIT_CONFIG = {
  /** Time window in milliseconds */
  WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  /** Max requests per window for authenticated users */
  MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  /** Max requests per window for unauthenticated users */
  UNAUTH_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_UNAUTH_MAX_REQUESTS || '20', 10),
  /** Max login attempts per window */
  LOGIN_MAX_ATTEMPTS: parseInt(process.env.RATE_LIMIT_LOGIN_MAX_ATTEMPTS || '5', 10),
  /** Login attempt window in milliseconds (15 minutes) */
  LOGIN_WINDOW_MS: 15 * 60 * 1000,
} as const;

/** Password policy requirements */
export const PASSWORD_POLICY = {
  /** Minimum password length */
  MIN_LENGTH: 12,
  /** Maximum password length */
  MAX_LENGTH: 128,
  /** Require at least one uppercase letter */
  REQUIRE_UPPERCASE: true,
  /** Require at least one lowercase letter */
  REQUIRE_LOWERCASE: true,
  /** Require at least one digit */
  REQUIRE_DIGIT: true,
  /** Require at least one special character */
  REQUIRE_SPECIAL: true,
  /** Special characters allowed */
  SPECIAL_CHARS: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  /** Prevent common passwords */
  PREVENT_COMMON: true,
  /** Maximum consecutive identical characters */
  MAX_CONSECUTIVE_IDENTICAL: 3,
} as const;

/** Common passwords to reject */
export const COMMON_PASSWORDS = [
  'password', '123456', '12345678', 'qwerty', 'abc123',
  'monkey', 'letmein', 'dragon', '111111', 'baseball',
  'iloveyou', 'trustno1', 'sunshine', 'princess', 'admin',
  'welcome', 'shadow', 'ashley', 'football', 'jesus',
  'michael', 'ninja', 'mustang', 'password1', '123456789',
  '1234567', '1234567890', 'qwertyuiop', 'superman', 'harley',
] as const;

// ============================================
// HIPAA Compliance Constants
// ============================================

/** PHI encryption configuration */
export const ENCRYPTION_CONFIG = {
  /** Encryption algorithm */
  ALGORITHM: 'aes-256-gcm' as const,
  /** Key length in bytes (256 bits) */
  KEY_LENGTH: 32,
  /** IV length in bytes */
  IV_LENGTH: 16,
  /** Auth tag length in bytes */
  AUTH_TAG_LENGTH: 16,
  /** Salt length for key derivation */
  SALT_LENGTH: 32,
  /** PBKDF2 iterations */
  PBKDF2_ITERATIONS: 100000,
} as const;

/** Audit logging configuration */
export const AUDIT_CONFIG = {
  /** Enable audit logging */
  ENABLED: process.env.AUDIT_LOGGING_ENABLED !== 'false',
  /** Log retention period in days (7 years for HIPAA) */
  RETENTION_DAYS: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '2555', 10),
  /** Actions to audit */
  AUDITED_ACTIONS: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'PRINT', 'LOGIN', 'LOGOUT', 'FAILED_LOGIN'] as const,
  /** PHI resource types */
  PHI_RESOURCE_TYPES: [
    'PATIENT',
    'INTAKE',
    'PRESCRIPTION',
    'MESSAGE',
    'DOCUMENT',
    'BILLING',
    'APPOINTMENT',
    'MEDICAL_RECORD',
  ] as const,
} as const;

/** Data retention policies (in days) */
export const DATA_RETENTION = {
  /** Patient data retention after account closure (7 years) */
  AFTER_CLOSURE: parseInt(process.env.DATA_RETENTION_DAYS_AFTER_CLOSURE || '2555', 10),
  /** Soft delete grace period before permanent deletion */
  SOFT_DELETE_GRACE_PERIOD: parseInt(process.env.SOFT_DELETE_GRACE_PERIOD_DAYS || '30', 10),
  /** Audit log retention */
  AUDIT_LOGS: 2555,
  /** Session logs retention */
  SESSION_LOGS: 90,
  /** Failed login attempts retention */
  FAILED_LOGINS: 365,
} as const;

/** PHI field identifiers - fields that contain protected health information */
export const PHI_FIELDS = {
  /** Patient identifying information */
  IDENTIFIERS: [
    'firstName',
    'lastName',
    'dateOfBirth',
    'ssn',
    'mrn', // Medical Record Number
    'email',
    'phone',
    'address',
    'city',
    'state',
    'zipCode',
  ] as const,
  /** Medical information */
  MEDICAL: [
    'medicalHistory',
    'currentMedications',
    'allergies',
    'diagnosis',
    'symptoms',
    'treatmentPlan',
    'notes',
    'labResults',
  ] as const,
  /** Insurance and billing */
  BILLING: [
    'insuranceProvider',
    'insurancePolicyNumber',
    'insuranceGroupNumber',
    'paymentMethod',
    'billingAddress',
  ] as const,
  /** All PHI fields combined */
  get ALL(): string[] {
    return [
      ...this.IDENTIFIERS,
      ...this.MEDICAL,
      ...this.BILLING,
    ];
  },
} as const;

/** Session security settings */
export const SESSION_SECURITY = {
  /** Cookie name for access token */
  ACCESS_TOKEN_COOKIE: 'accessToken',
  /** Cookie name for refresh token */
  REFRESH_TOKEN_COOKIE: 'refreshToken',
  /** Cookie name for CSRF token */
  CSRF_TOKEN_COOKIE: 'csrfToken',
  /** Cookie name for session ID */
  SESSION_ID_COOKIE: 'sessionId',
  /** Secure cookie flag (always true in production) */
  SECURE: process.env.NODE_ENV === 'production',
  /** SameSite cookie attribute */
  SAME_SITE: 'strict' as const,
  /** HTTP-only cookie flag */
  HTTP_ONLY: true,
} as const;

// ============================================
// Security Headers
// ============================================

/** Content Security Policy directives */
/** Base CSP script-src directives */
const CSP_SCRIPT_SRC = [
  "'self'",
  "'unsafe-inline'", // Required for Next.js
  'https://js.stripe.com',
  'https://checkout.stripe.com',
  'https://www.googletagmanager.com',
  'https://www.google-analytics.com',
];

/** Content Security Policy directives */
export const CSP_DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': [...CSP_SCRIPT_SRC, "'unsafe-eval'"],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for Tailwind/styled-components
    'https://fonts.googleapis.com',
  ],
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https:',
    'https://*.s3.amazonaws.com',
    'https://www.google-analytics.com',
  ],
  'font-src': [
    "'self'",
    'data:',
    'https://fonts.gstatic.com',
  ],
  'connect-src': [
    "'self'",
    'https://api.stripe.com',
    'https://checkout.stripe.com',
    'https://www.google-analytics.com',
    'https://*.s3.amazonaws.com',
  ],
  'frame-src': [
    "'self'",
    'https://js.stripe.com',
    'https://checkout.stripe.com',
    'https://hooks.stripe.com',
  ],
  'object-src': ["'none'"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'upgrade-insecure-requests': [],
};

/** Build CSP header string from directives */
export function buildCSPHeader(directives: typeof CSP_DIRECTIVES): string {
  return Object.entries(directives)
    .map(([key, values]) => {
      if (values.length === 0) return key;
      return `${key} ${values.join(' ')}`;
    })
    .join('; ');
}

/** Security headers configuration */
export const SECURITY_HEADERS = {
  'Content-Security-Policy': buildCSPHeader(CSP_DIRECTIVES),
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self), usb=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-DNS-Prefetch-Control': 'on',
  'Cross-Origin-Embedder-Policy': 'unsafe-none',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Cross-Origin-Resource-Policy': 'cross-origin',
} as const;

// ============================================
// Validation Constants
// ============================================

/** Phone number validation (US format) */
export const PHONE_REGEX = /^\+1\d{10}$|^\d{10}$|^(\(\d{3}\)\s?|\d{3}[-.\s])?\d{3}[-.\s]\d{4}$/;

/** Email validation regex (RFC 5322 compliant) */
export const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** ZIP code validation (US) */
export const ZIP_REGEX = /^\d{5}(-\d{4})?$/;

/** California ZIP codes start with 90-96 or 908-908 */
export const CA_ZIP_PREFIXES = ['900', '901', '902', '903', '904', '905', '906', '907', '908', '909', '910', '911', '912', '913', '914', '915', '916', '917', '918', '919', '920', '921', '922', '923', '924', '925', '926', '927', '928', '930', '931', '932', '933', '934', '935', '936', '937', '938', '939', '940', '941', '942', '943', '944', '945', '946', '947', '948', '949', '950', '951', '952', '953', '954', '955', '956', '957', '958', '959', '960', '961'];

/** SSN validation (format: XXX-XX-XXXX or XXXXXXXXX) */
export const SSN_REGEX = /^(?!000|666|9\d{2})\d{3}(?!00)\d{2}(?!0000)\d{4}$|^\d{3}-\d{2}-\d{4}$/;

// ============================================
// Error Messages
// ============================================

export const ERROR_MESSAGES = {
  AUTH: {
    INVALID_CREDENTIALS: 'Invalid email or password',
    SESSION_EXPIRED: 'Your session has expired. Please log in again.',
    UNAUTHORIZED: 'You are not authorized to access this resource',
    FORBIDDEN: 'Access denied',
    RATE_LIMITED: 'Too many attempts. Please try again later.',
    CSRF_INVALID: 'Invalid or missing security token',
  },
  VALIDATION: {
    REQUIRED: 'This field is required',
    INVALID_EMAIL: 'Please enter a valid email address',
    INVALID_PHONE: 'Please enter a valid phone number',
    INVALID_ZIP: 'Please enter a valid ZIP code',
    INVALID_SSN: 'Please enter a valid SSN',
    PASSWORD_TOO_SHORT: `Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters`,
    PASSWORD_TOO_LONG: `Password must not exceed ${PASSWORD_POLICY.MAX_LENGTH} characters`,
    PASSWORD_REQUIREMENTS: 'Password does not meet security requirements',
    CALIFORNIA_ONLY: 'Service is only available for California residents',
  },
  HIPAA: {
    PHI_ACCESS_DENIED: 'You do not have permission to access this information',
    ENCRYPTION_ERROR: 'An error occurred while securing your data',
    AUDIT_REQUIRED: 'This action requires audit logging',
  },
  SERVER: {
    INTERNAL_ERROR: 'An unexpected error occurred. Please try again later.',
    SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
    TIMEOUT: 'Request timed out. Please try again.',
  },
} as const;

// ============================================
// Utility Types
// ============================================

/** Audit action types */
export type AuditAction = typeof AUDIT_CONFIG.AUDITED_ACTIONS[number];

/** PHI resource types */
export type PHIResourceType = typeof AUDIT_CONFIG.PHI_RESOURCE_TYPES[number];

/** User roles */
export type UserRole = 'PATIENT' | 'PHYSICIAN' | 'ADMIN';

/** HTTP methods */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
