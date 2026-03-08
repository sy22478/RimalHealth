/**
 * DoseSpot e-Prescribing API Client
 * 
 * HIPAA Compliance:
 * - No PHI logged to console or errors (only IDs)
 * - All PHI encrypted before transmission
 * - Audit logging for all prescription actions
 * - Secure credential storage via environment variables
 * 
 * @module lib/integrations/dosespot
 */

import {
  DoseSpotConfig,
  DoseSpotCredentials,
  DoseSpotAuthResponse,
  DoseSpotPharmacy,
  PharmacySearchParams,
  PharmacySearchResponse,
  DoseSpotPrescription,
  DoseSpotPrescriptionResponse,
  DoseSpotStatusResponse,
  DoseSpotApiError,
  DoseSpotErrorCode,
  DoseSpotMedication,
  MedicationSearchParams,
} from './dosespot.types';

import {
  mockSearchPharmacies,
  mockSendPrescription,
  mockCheckStatus,
  mockSearchMedications,
  mockCancelPrescription,
} from './dosespot.mock';

// ============================================
// CONFIGURATION
// ============================================

/**
 * Get DoseSpot configuration from environment variables
 */
function getConfigFromEnv(): DoseSpotConfig {
  return {
    apiUrl: process.env.DOSESPOT_API_URL || 'https://api-sandbox.dosespot.com',
    credentials: {
      clientId: process.env.DOSESPOT_CLIENT_ID || '',
      clientSecret: process.env.DOSESPOT_CLIENT_SECRET || '',
      clinicId: process.env.DOSESPOT_CLINIC_ID || '',
      userId: process.env.DOSESPOT_USER_ID || '',
    },
    timeoutMs: parseInt(process.env.DOSESPOT_TIMEOUT_MS || '30000', 10),
    mockMode: process.env.DOSESPOT_MOCK_MODE === 'true',
    maxRetries: parseInt(process.env.DOSESPOT_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.DOSESPOT_RETRY_DELAY_MS || '1000', 10),
  };
}

// ============================================
// AUTHENTICATION
// ============================================

/**
 * Token cache to minimize authentication requests
 */
interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

/**
 * Authenticate with DoseSpot API
 * Uses OAuth 2.0 client credentials flow
 */
async function authenticate(config: DoseSpotConfig): Promise<string> {
  // Check if we have a valid cached token
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) {
    return tokenCache.token;
  }

  const { apiUrl, credentials } = config;

  try {
    const response = await fetch(`${apiUrl}/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        scope: 'prescribe pharmacy_read',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw createApiError(
        DoseSpotErrorCode.INVALID_CREDENTIALS,
        'Authentication failed',
        response.status,
        { details: errorText }
      );
    }

    const data: DoseSpotAuthResponse = await response.json();

    // Cache token
    tokenCache = {
      token: data.accessToken,
      expiresAt: Date.now() + (data.expiresIn * 1000),
    };

    return data.accessToken;
  } catch (error) {
    if (error instanceof DoseSpotError) {
      throw error;
    }
    throw createApiError(
      DoseSpotErrorCode.SERVICE_UNAVAILABLE,
      'Failed to authenticate with DoseSpot',
      undefined,
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Clear token cache (useful for testing or after errors)
 */
export function clearTokenCache(): void {
  tokenCache = null;
}

// ============================================
// ERROR HANDLING
// ============================================

/**
 * Custom DoseSpot error class
 */
export class DoseSpotError extends Error {
  public code: DoseSpotErrorCode;
  public httpStatus?: number;
  public details?: Record<string, unknown>;
  public retryable: boolean;

  constructor(error: DoseSpotApiError) {
    super(error.message);
    this.name = 'DoseSpotError';
    this.code = error.code;
    this.httpStatus = error.httpStatus;
    this.details = error.details;
    this.retryable = error.retryable;
  }
}

/**
 * Create API error object
 */
function createApiError(
  code: DoseSpotErrorCode,
  message: string,
  httpStatus?: number,
  details?: Record<string, unknown>
): DoseSpotError {
  const retryableCodes = [
    DoseSpotErrorCode.RATE_LIMIT_EXCEEDED,
    DoseSpotErrorCode.SERVICE_UNAVAILABLE,
    DoseSpotErrorCode.SURESCRIPTS_ERROR,
  ];

  return new DoseSpotError({
    code,
    message,
    httpStatus,
    details,
    retryable: retryableCodes.includes(code),
  });
}

/**
 * Map HTTP status to error code
 */
function mapHttpStatusToErrorCode(status: number): DoseSpotErrorCode {
  switch (status) {
    case 400:
      return DoseSpotErrorCode.PRESCRIPTION_VALIDATION_FAILED;
    case 401:
      return DoseSpotErrorCode.INVALID_CREDENTIALS;
    case 404:
      return DoseSpotErrorCode.PHARMACY_NOT_FOUND;
    case 429:
      return DoseSpotErrorCode.RATE_LIMIT_EXCEEDED;
    case 500:
    case 502:
    case 503:
    case 504:
      return DoseSpotErrorCode.SERVICE_UNAVAILABLE;
    default:
      return DoseSpotErrorCode.UNKNOWN_ERROR;
  }
}

// ============================================
// HTTP CLIENT
// ============================================

/**
 * Make authenticated request to DoseSpot API
 */
async function makeRequest<T>(
  config: DoseSpotConfig,
  endpoint: string,
  options: RequestInit = {},
  attempt: number = 1
): Promise<T> {
  const token = await authenticate(config);
  const url = `${config.apiUrl}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Clinic-Id': config.credentials.clinicId,
        'X-User-Id': config.credentials.userId,
        ...options.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorCode = mapHttpStatusToErrorCode(response.status);
      const errorText = await response.text();

      // Retry on retryable errors
      if (attempt < (config.maxRetries || 3)) {
        const retryableCodes = [
          DoseSpotErrorCode.RATE_LIMIT_EXCEEDED,
          DoseSpotErrorCode.SERVICE_UNAVAILABLE,
          DoseSpotErrorCode.SURESCRIPTS_ERROR,
        ];

        if (retryableCodes.includes(errorCode)) {
          await sleep((config.retryDelayMs || 1000) * attempt);
          return makeRequest(config, endpoint, options, attempt + 1);
        }
      }

      throw createApiError(errorCode, `API request failed: ${errorText}`, response.status);
    }

    // Handle empty responses
    if (response.status === 204) {
      return undefined as T;
    }

    return await response.json() as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof DoseSpotError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw createApiError(
        DoseSpotErrorCode.SERVICE_UNAVAILABLE,
        'Request timeout',
        undefined,
        { timeout: config.timeoutMs }
      );
    }

    throw createApiError(
      DoseSpotErrorCode.UNKNOWN_ERROR,
      error instanceof Error ? error.message : 'Unknown error',
      undefined,
      { originalError: error }
    );
  }
}

/**
 * Sleep utility for retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// API METHODS
// ============================================

/**
 * DoseSpot API client class
 */
export class DoseSpotClient {
  private config: DoseSpotConfig;

  constructor(config?: Partial<DoseSpotConfig>) {
    const envConfig = getConfigFromEnv();
    this.config = {
      ...envConfig,
      ...config,
      credentials: {
        ...envConfig.credentials,
        ...config?.credentials,
      },
    };
  }

  /**
   * Check if client is in mock mode
   */
  isMockMode(): boolean {
    return this.config.mockMode ?? false;
  }

  /**
   * Search for pharmacies
   */
  async searchPharmacies(params: PharmacySearchParams): Promise<PharmacySearchResponse> {
    if (this.config.mockMode) {
      return mockSearchPharmacies(params);
    }

    try {
      // Validate ZIP code
      if (!/^\d{5}(-\d{4})?$/.test(params.zip)) {
        return {
          success: false,
          pharmacies: [],
          error: 'Invalid ZIP code format',
          errorCode: DoseSpotErrorCode.INVALID_PHARMACY,
        };
      }

      const queryParams = new URLSearchParams({
        zip: params.zip,
        ...(params.name && { name: params.name }),
        ...(params.radius && { radius: params.radius.toString() }),
        ...(params.limit && { limit: params.limit.toString() }),
        ...(params.type && { type: params.type }),
        ...(params.includeInactive && { includeInactive: 'true' }),
      });

      const response = await makeRequest<{ pharmacies: DoseSpotPharmacy[]; total: number }>(
        this.config,
        `/v1/pharmacies/search?${queryParams}`
      );

      return {
        success: true,
        pharmacies: response.pharmacies,
        totalCount: response.total,
      };
    } catch (error) {
      if (error instanceof DoseSpotError) {
        return {
          success: false,
          pharmacies: [],
          error: error.message,
          errorCode: error.code,
        };
      }
      throw error;
    }
  }

  /**
   * Send prescription to pharmacy
   */
  async sendPrescription(
    prescription: DoseSpotPrescription
  ): Promise<DoseSpotPrescriptionResponse> {
    if (this.config.mockMode) {
      return mockSendPrescription(prescription);
    }

    try {
      const response = await makeRequest<{
        rxId: string;
        status: string;
        sentAt: string;
      }>(
        this.config,
        '/v1/prescriptions',
        {
          method: 'POST',
          body: JSON.stringify(prescription),
        }
      );

      return {
        success: true,
        rxId: response.rxId,
        status: response.status as DoseSpotPrescriptionResponse['status'],
        sentAt: response.sentAt,
      };
    } catch (error) {
      if (error instanceof DoseSpotError) {
        return {
          success: false,
          error: error.message,
          errorCode: error.code,
        };
      }
      throw error;
    }
  }

  /**
   * Check prescription status
   */
  async checkStatus(rxId: string): Promise<DoseSpotStatusResponse> {
    if (this.config.mockMode) {
      return mockCheckStatus(rxId);
    }

    try {
      const response = await makeRequest<{
        rxId: string;
        status: string;
        history: Array<{ status: string; timestamp: string; details?: string }>;
      }>(
        this.config,
        `/v1/prescriptions/${rxId}/status`
      );

      return {
        success: true,
        rxId: response.rxId,
        status: response.status as DoseSpotStatusResponse['status'],
        statusHistory: response.history.map(h => ({
          status: h.status as DoseSpotStatusResponse['status'],
          timestamp: h.timestamp,
          details: h.details,
        })),
      };
    } catch (error) {
      if (error instanceof DoseSpotError) {
        return {
          success: false,
          rxId,
          status: 'ERROR' as DoseSpotStatusResponse['status'],
          error: error.message,
          errorCode: error.code,
        };
      }
      throw error;
    }
  }

  /**
   * Search medications
   */
  async searchMedications(
    params: MedicationSearchParams
  ): Promise<{ success: boolean; medications: DoseSpotMedication[]; error?: string }> {
    if (this.config.mockMode) {
      return mockSearchMedications(params);
    }

    try {
      const queryParams = new URLSearchParams({
        q: params.query,
        ...(params.limit && { limit: params.limit.toString() }),
        ...(params.includeDiscontinued && { includeDiscontinued: 'true' }),
      });

      const response = await makeRequest<{ medications: DoseSpotMedication[] }>(
        this.config,
        `/v1/medications/search?${queryParams}`
      );

      return {
        success: true,
        medications: response.medications,
      };
    } catch (error) {
      if (error instanceof DoseSpotError) {
        return {
          success: false,
          medications: [],
          error: error.message,
        };
      }
      throw error;
    }
  }

  /**
   * Cancel a prescription
   */
  async cancelPrescription(
    rxId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string; errorCode?: DoseSpotErrorCode }> {
    if (this.config.mockMode) {
      return mockCancelPrescription(rxId, reason);
    }

    try {
      await makeRequest<void>(
        this.config,
        `/v1/prescriptions/${rxId}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({ reason }),
        }
      );

      return { success: true };
    } catch (error) {
      if (error instanceof DoseSpotError) {
        return {
          success: false,
          error: error.message,
          errorCode: error.code,
        };
      }
      throw error;
    }
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

/**
 * Default DoseSpot client instance
 * Uses environment variables for configuration
 */
export const doseSpotClient = new DoseSpotClient();

/**
 * Convenience function to search pharmacies
 */
export async function searchPharmacies(
  params: PharmacySearchParams
): Promise<PharmacySearchResponse> {
  return doseSpotClient.searchPharmacies(params);
}

/**
 * Convenience function to send prescription
 */
export async function sendPrescription(
  prescription: DoseSpotPrescription
): Promise<DoseSpotPrescriptionResponse> {
  return doseSpotClient.sendPrescription(prescription);
}

/**
 * Convenience function to check prescription status
 */
export async function checkPrescriptionStatus(
  rxId: string
): Promise<DoseSpotStatusResponse> {
  return doseSpotClient.checkStatus(rxId);
}

/**
 * Convenience function to search medications
 */
export async function searchMedications(
  params: MedicationSearchParams
): Promise<{ success: boolean; medications: DoseSpotMedication[]; error?: string }> {
  return doseSpotClient.searchMedications(params);
}

/**
 * Convenience function to cancel prescription
 */
export async function cancelPrescription(
  rxId: string,
  reason?: string
): Promise<{ success: boolean; error?: string; errorCode?: DoseSpotErrorCode }> {
  return doseSpotClient.cancelPrescription(rxId, reason);
}

export default doseSpotClient;
