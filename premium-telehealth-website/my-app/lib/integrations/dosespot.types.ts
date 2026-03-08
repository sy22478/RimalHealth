/**
 * DoseSpot e-Prescribing API Types
 * TypeScript interfaces for DoseSpot API integration
 * 
 * HIPAA Compliance:
 * - No PHI in type definitions
 * - All IDs use UUID format
 * - Separate encrypted fields marked explicitly
 * 
 * @module lib/integrations/dosespot.types
 */

// ============================================
// ENUMERATIONS
// ============================================

/**
 * Prescription status as returned by DoseSpot
 */
export enum DoseSpotRxStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  RECEIVED_BY_PHARMACY = 'RECEIVED_BY_PHARMACY',
  FILLED = 'FILLED',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  PICKED_UP = 'PICKED_UP',
  CANCELLED = 'CANCELLED',
  ERROR = 'ERROR',
  REJECTED = 'REJECTED',
}

/**
 * DoseSpot API error codes
 */
export enum DoseSpotErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_PHARMACY = 'INVALID_PHARMACY',
  INVALID_PATIENT = 'INVALID_PATIENT',
  INVALID_MEDICATION = 'INVALID_MEDICATION',
  PHARMACY_NOT_FOUND = 'PHARMACY_NOT_FOUND',
  PATIENT_NOT_FOUND = 'PATIENT_NOT_FOUND',
  PRESCRIPTION_VALIDATION_FAILED = 'PRESCRIPTION_VALIDATION_FAILED',
  SURESCRIPTS_ERROR = 'SURESCRIPTS_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Pharmacy types for search filtering
 */
export enum PharmacyType {
  RETAIL = 'RETAIL',
  MAIL_ORDER = 'MAIL_ORDER',
  SPECIALTY = 'SPECIALTY',
  LONG_TERM_CARE = 'LONG_TERM_CARE',
  HOSPITAL = 'HOSPITAL',
  CLINIC = 'CLINIC',
}

// ============================================
// PHARMACY TYPES
// ============================================

/**
 * DoseSpot Pharmacy representation
 * Minimal PII - only business contact information
 */
export interface DoseSpotPharmacy {
  /** Unique pharmacy ID in DoseSpot system */
  id: string;
  /** Pharmacy business name */
  name: string;
  /** Street address */
  address: string;
  /** City */
  city: string;
  /** State (2-letter code) */
  state: string;
  /** ZIP code */
  zip: string;
  /** Phone number */
  phone: string;
  /** NCPDP ID - National Council for Prescription Drug Programs identifier */
  ncpdpId: string;
  /** NPI if available */
  npi?: string;
  /** Pharmacy type */
  type?: PharmacyType;
  /** Distance from search location in miles */
  distance?: number;
  /** Whether pharmacy supports 24-hour service */
  is24Hour?: boolean;
  /** Whether pharmacy is currently active */
  isActive?: boolean;
}

/**
 * Pharmacy search parameters
 */
export interface PharmacySearchParams {
  /** ZIP code to search near (required) */
  zip: string;
  /** Optional pharmacy name filter */
  name?: string;
  /** Search radius in miles (default: 10) */
  radius?: number;
  /** Maximum results (default: 20, max: 50) */
  limit?: number;
  /** Filter by pharmacy type */
  type?: PharmacyType;
  /** Include inactive pharmacies */
  includeInactive?: boolean;
}

/**
 * Pharmacy search response
 */
export interface PharmacySearchResponse {
  /** Whether search was successful */
  success: boolean;
  /** List of matching pharmacies */
  pharmacies: DoseSpotPharmacy[];
  /** Total count (for pagination) */
  totalCount?: number;
  /** Error message if search failed */
  error?: string;
  /** Error code if search failed */
  errorCode?: DoseSpotErrorCode;
}

// ============================================
// PATIENT TYPES
// ============================================

/**
 * Patient information for DoseSpot
 * Note: Actual patient data comes from our encrypted database
 */
export interface DoseSpotPatient {
  /** Patient ID in our system */
  patientId: string;
  /** First name */
  firstName: string;
  /** Last name */
  lastName: string;
  /** Date of birth (YYYY-MM-DD) */
  dateOfBirth: string;
  /** Gender */
  gender?: 'M' | 'F' | 'U';
  /** Address */
  address?: string;
  /** City */
  city?: string;
  /** State */
  state?: string;
  /** ZIP */
  zip?: string;
  /** Phone */
  phone?: string;
  /** External patient ID in DoseSpot system (if synced) */
  externalId?: string;
}

// ============================================
// PRESCRIPTION TYPES
// ============================================

/**
 * Prescription data to send to DoseSpot
 */
export interface DoseSpotPrescription {
  /** Patient ID in our system */
  patientId: string;
  /** Pharmacy ID */
  pharmacyId: string;
  /** Medication name (brand) */
  medication: string;
  /** Generic name */
  genericName: string;
  /** Dosage/strength (e.g., "50mg") */
  dosage: string;
  /** Quantity to dispense */
  quantity: number;
  /** Number of refills allowed */
  refills: number;
  /** Sig/instructions for patient (PHI - encrypted in transit) */
  instructions: string;
  /** Days supply */
  daysSupply?: number;
  /** DEA schedule (if controlled substance) */
  deaSchedule?: string;
  /** Prescriber NPI */
  prescriberNpi: string;
  /** Prescriber DEA number (if controlled) */
  prescriberDea?: string;
  /** Substitutions allowed (default: true) */
  substitutionsAllowed?: boolean;
  /** Prescription notes to pharmacist */
  pharmacyNotes?: string;
}

/**
 * Response from sending a prescription
 */
export interface DoseSpotPrescriptionResponse {
  /** Whether the prescription was successfully sent */
  success: boolean;
  /** DoseSpot/Surescripts Rx ID */
  rxId?: string;
  /** Status of the prescription */
  status?: DoseSpotRxStatus;
  /** Timestamp when sent */
  sentAt?: string;
  /** Error message if failed */
  error?: string;
  /** Error code if failed */
  errorCode?: DoseSpotErrorCode;
  /** Detailed validation errors */
  validationErrors?: string[];
}

/**
 * Prescription status check response
 */
export interface DoseSpotStatusResponse {
  /** Whether status check was successful */
  success: boolean;
  /** Current status */
  status: DoseSpotRxStatus;
  /** DoseSpot Rx ID */
  rxId: string;
  /** Status history/timeline */
  statusHistory?: StatusHistoryEntry[];
  /** Estimated ready time (if available) */
  estimatedReadyTime?: string;
  /** Error if status check failed */
  error?: string;
  /** Error code */
  errorCode?: DoseSpotErrorCode;
}

/**
 * Status history entry
 */
export interface StatusHistoryEntry {
  /** Status at this point in time */
  status: DoseSpotRxStatus;
  /** When this status was recorded */
  timestamp: string;
  /** Additional details */
  details?: string;
}

// ============================================
// MEDICATION TYPES
// ============================================

/**
 * Medication search result
 */
export interface DoseSpotMedication {
  /** Medication ID */
  id: string;
  /** Brand name */
  name: string;
  /** Generic name */
  genericName: string;
  /** Strength options */
  strengths: string[];
  /** Dosage forms */
  forms: string[];
  /** DEA schedule (if controlled) */
  deaSchedule?: string;
  /** Requires special authorization */
  requiresPriorAuth?: boolean;
}

/**
 * Medication search parameters
 */
export interface MedicationSearchParams {
  /** Search query */
  query: string;
  /** Maximum results */
  limit?: number;
  /** Include discontinued medications */
  includeDiscontinued?: boolean;
}

// ============================================
// AUTHENTICATION TYPES
// ============================================

/**
 * DoseSpot API credentials
 */
export interface DoseSpotCredentials {
  /** Client ID */
  clientId: string;
  /** Client secret */
  clientSecret: string;
  /** Clinic ID */
  clinicId: string;
  /** User ID */
  userId: string;
}

/**
 * Authentication token response
 */
export interface DoseSpotAuthResponse {
  /** Access token */
  accessToken: string;
  /** Token type */
  tokenType: string;
  /** Expiration in seconds */
  expiresIn: number;
  /** Token expiration timestamp */
  expiresAt?: number;
}

// ============================================
// ERROR TYPES
// ============================================

/**
 * DoseSpot API error
 */
export interface DoseSpotApiError {
  /** Error code */
  code: DoseSpotErrorCode;
  /** Human-readable error message */
  message: string;
  /** HTTP status code */
  httpStatus?: number;
  /** Additional error details */
  details?: Record<string, unknown>;
  /** Whether this error is retryable */
  retryable: boolean;
}

/**
 * API response wrapper
 */
export interface DoseSpotApiResponse<T> {
  /** Whether the request was successful */
  success: boolean;
  /** Response data (if successful) */
  data?: T;
  /** Error information (if failed) */
  error?: DoseSpotApiError;
  /** Request ID for debugging */
  requestId?: string;
}

// ============================================
// CONFIGURATION TYPES
// ============================================

/**
 * DoseSpot client configuration
 */
export interface DoseSpotConfig {
  /** API base URL */
  apiUrl: string;
  /** Credentials */
  credentials: DoseSpotCredentials;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Whether to use mock mode */
  mockMode?: boolean;
  /** Maximum retries for failed requests */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelayMs?: number;
}

// ============================================
// AUDIT TYPES
// ============================================

/**
 * Audit log entry for prescription actions
 * No PHI - only IDs and metadata
 */
export interface PrescriptionAuditEntry {
  /** Action type */
  action: 'SEARCH_PHARMACY' | 'SEND_PRESCRIPTION' | 'CHECK_STATUS' | 'CANCEL_PRESCRIPTION';
  /** Physician ID who performed the action */
  physicianId: string;
  /** Patient ID (our internal ID) */
  patientId: string;
  /** Prescription ID (if applicable) */
  prescriptionId?: string;
  /** Pharmacy ID (if applicable) */
  pharmacyId?: string;
  /** DoseSpot Rx ID (if applicable) */
  surescriptsRxId?: string;
  /** Whether the action succeeded */
  success: boolean;
  /** Error message (if failed) */
  errorMessage?: string;
  /** IP address */
  ipAddress: string;
  /** User agent */
  userAgent?: string;
  /** Timestamp */
  timestamp: string;
  /** Additional metadata (non-PHI only) */
  metadata?: Record<string, unknown>;
}

// ============================================
// PRESCRIPTION SEND REQUEST
// ============================================

/**
 * Request body for sending a prescription
 * Used by our API routes
 */
export interface SendPrescriptionRequest {
  /** Intake ID */
  intakeId: string;
  /** Patient ID */
  patientId: string;
  /** Selected pharmacy ID */
  pharmacyId: string;
  /** Medication name */
  medication: string;
  /** Generic name */
  genericName: string;
  /** Dosage/strength */
  dosage: string;
  /** Quantity */
  quantity: number;
  /** Number of refills */
  refills: number;
  /** Patient instructions */
  instructions: string;
  /** Days supply */
  daysSupply?: number;
  /** Notes to pharmacist */
  pharmacyNotes?: string;
}

/**
 * Response from our send prescription API
 */
export interface SendPrescriptionApiResponse {
  /** Whether the prescription was sent successfully */
  success: boolean;
  /** Prescription record ID */
  prescriptionId?: string;
  /** DoseSpot/Surescripts Rx ID */
  surescriptsRxId?: string;
  /** Current status */
  status?: string;
  /** Error message (if failed) */
  error?: string;
  /** Timestamp */
  timestamp: string;
}
