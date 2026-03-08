/**
 * Patient Module
 * 
 * Central export point for all patient-related functionality.
 * Includes profile management, onboarding workflows, and utilities.
 * 
 * @module lib/patient
 */

// Profile management
export {
  createPatientProfile,
  getPatientProfileByUserId,
  getPatientProfileById,
  updatePatientProfile,
  deletePatientProfile,
  patientProfileExists,
  extractSafeProfileFields,
  isValidCaliforniaAddress,
  formatPhoneForDisplay,
  getPatientFullName,
} from './profile';

// Onboarding workflow
export {
  storeCheckoutData,
  getCheckoutData,
  clearCheckoutData,
  hasCheckoutData,
  extendCheckoutDataTTL,
  updateOnboardingStatus,
  getOnboardingStatus,
  clearOnboardingData,
  validateCheckoutData,
  checkoutDataToProfileData,
} from './onboarding';

// Types
export type {
  CreatePatientProfileData,
  UpdatePatientProfileData,
  SafePatientProfile,
} from './profile';

export type {
  CheckoutData,
  OnboardingStatus,
} from './onboarding';
