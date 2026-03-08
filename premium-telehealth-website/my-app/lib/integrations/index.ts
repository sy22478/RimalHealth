/**
 * Integrations
 * 
 * Third-party service integrations for the platform:
 * - DoseSpot e-Prescribing
 * - Stripe payments
 * - SendGrid email
 * - Twilio SMS
 * - AWS S3 storage
 * 
 * @module lib/integrations
 */

// DoseSpot e-Prescribing
export {
  DoseSpotClient,
  doseSpotClient,
  searchPharmacies,
  sendPrescription,
  checkPrescriptionStatus,
  searchMedications,
  cancelPrescription,
  clearTokenCache,
  DoseSpotError,
} from './dosespot';

export type {
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
  DoseSpotRxStatus,
  PharmacyType,
  DoseSpotMedication,
  MedicationSearchParams,
  DoseSpotPatient,
  StatusHistoryEntry,
  PrescriptionAuditEntry,
  SendPrescriptionRequest,
  SendPrescriptionApiResponse,
} from './dosespot.types';

// Mock implementation for development
export {
  mockDoseSpotClient,
  mockSearchPharmacies,
  mockSendPrescription,
  mockCheckStatus,
  mockSearchMedications,
  mockCancelPrescription,
  enableErrorSimulation,
  disableErrorSimulation,
  getMockPrescriptions,
  clearMockStore,
  getMockPrescription,
} from './dosespot.mock';

// Other integrations
export { sendEmail, sendMultipleEmails, initializeSendGrid } from './sendgrid';
export type { SendEmailOptions } from './sendgrid';

export { stripe } from './stripe';
