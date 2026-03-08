/**
 * Patient Profile Utilities
 * 
 * Core functions for managing PatientProfile entities with HIPAA compliance.
 * All PHI is automatically encrypted via the Prisma extension.
 * 
 * @module lib/patient/profile
 */

import { prisma } from '@/lib/db/prisma';
import { ConcernType, TreatmentGoal, Prisma } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

/**
 * Patient profile creation data
 * Mirrors the CheckoutData but with explicit typing for the database
 */
export interface CreatePatientProfileData {
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // MM/DD/YYYY
  phone: string;
  addressStreet: string;
  addressCity: string;
  addressState: string; // CA only
  addressZip: string;
  billingSameAsHome?: boolean;
  billingStreet?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  billingZip?: string | null;
  primaryConcern?: ConcernType;
  treatmentGoal?: TreatmentGoal;
  privacyConsentGiven: boolean;
  privacyConsentDate: Date;
  privacyConsentVersion: string;
  termsAccepted: boolean;
  termsAcceptedDate: Date;
}

/**
 * Patient profile update data
 * Partial fields that can be updated after creation
 */
export interface UpdatePatientProfileData {
  phone?: string;
  addressStreet?: string;
  addressCity?: string;
  addressZip?: string;
  billingSameAsHome?: boolean;
  billingStreet?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  billingZip?: string | null;
  medicalHistory?: Record<string, unknown>;
  currentMedications?: Record<string, unknown>;
  allergies?: Record<string, unknown>;
  insuranceProvider?: string | null;
  insuranceMemberId?: string | null;
  insuranceGroupNumber?: string | null;
}

/**
 * Patient profile with safe (non-PHI) fields only
 * Use this for logging or public display
 */
export interface SafePatientProfile {
  id: string;
  userId: string;
  primaryConcern: ConcernType | null;
  treatmentGoal: TreatmentGoal | null;
  privacyConsentGiven: boolean;
  privacyConsentDate: Date | null;
  termsAccepted: boolean;
  termsAcceptedDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new patient profile
 * Called after successful payment via Stripe webhook
 * 
 * HIPAA Compliance:
 * - All PHI fields are automatically encrypted by Prisma extension
 * - Audit log is created by the calling function (webhook handler)
 * 
 * @param data - Patient profile creation data
 * @returns The created patient profile
 */
export async function createPatientProfile(data: CreatePatientProfileData) {
  const profile = await prisma.patientProfile.create({
    data: {
      userId: data.userId,
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth,
      phone: data.phone,
      addressStreet: data.addressStreet,
      addressCity: data.addressCity,
      addressState: data.addressState,
      addressZip: data.addressZip,
      billingSameAsHome: data.billingSameAsHome ?? true,
      billingStreet: data.billingStreet,
      billingCity: data.billingCity,
      billingState: data.billingState,
      billingZip: data.billingZip,
      primaryConcern: data.primaryConcern,
      treatmentGoal: data.treatmentGoal,
      privacyConsentGiven: data.privacyConsentGiven,
      privacyConsentDate: data.privacyConsentDate,
      privacyConsentVersion: data.privacyConsentVersion,
      termsAccepted: data.termsAccepted,
      termsAcceptedDate: data.termsAcceptedDate,
    },
  });

  return profile;
}

/**
 * Get patient profile by user ID
 * Returns null if not found
 * 
 * @param userId - The user's ID
 * @returns Patient profile or null
 */
export async function getPatientProfileByUserId(userId: string) {
  return prisma.patientProfile.findUnique({
    where: { userId },
  });
}

/**
 * Get patient profile by profile ID
 * Returns null if not found
 * 
 * @param profileId - The profile ID
 * @returns Patient profile or null
 */
export async function getPatientProfileById(profileId: string) {
  return prisma.patientProfile.findUnique({
    where: { id: profileId },
  });
}

/**
 * Update patient profile
 * Only allows updating certain fields (not personal info like name/DOB)
 * 
 * HIPAA Compliance:
 * - All PHI fields are automatically encrypted by Prisma extension
 * - Calling function should audit log the changes
 * 
 * @param profileId - The profile ID to update
 * @param data - Update data
 * @returns The updated patient profile
 */
export async function updatePatientProfile(
  profileId: string,
  data: UpdatePatientProfileData
) {
  return prisma.patientProfile.update({
    where: { id: profileId },
    data: {
      ...(data.phone && { phone: data.phone }),
      ...(data.addressStreet && { addressStreet: data.addressStreet }),
      ...(data.addressCity && { addressCity: data.addressCity }),
      ...(data.addressZip && { addressZip: data.addressZip }),
      ...(data.billingSameAsHome !== undefined && { billingSameAsHome: data.billingSameAsHome }),
      ...(data.billingStreet !== undefined && { billingStreet: data.billingStreet }),
      ...(data.billingCity !== undefined && { billingCity: data.billingCity }),
      ...(data.billingState !== undefined && { billingState: data.billingState }),
      ...(data.billingZip !== undefined && { billingZip: data.billingZip }),
      ...(data.medicalHistory && { medicalHistory: data.medicalHistory as Prisma.InputJsonValue }),
      ...(data.currentMedications && { currentMedications: data.currentMedications as Prisma.InputJsonValue }),
      ...(data.allergies && { allergies: data.allergies as Prisma.InputJsonValue }),
      ...(data.insuranceProvider !== undefined && { insuranceProvider: data.insuranceProvider }),
      ...(data.insuranceMemberId !== undefined && { insuranceMemberId: data.insuranceMemberId }),
      ...(data.insuranceGroupNumber !== undefined && { insuranceGroupNumber: data.insuranceGroupNumber }),
    },
  });
}

/**
 * Delete patient profile
 * Use with caution - should only be called for data retention compliance
 * 
 * @param profileId - The profile ID to delete
 */
export async function deletePatientProfile(profileId: string): Promise<void> {
  await prisma.patientProfile.delete({
    where: { id: profileId },
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a patient profile exists for a user
 * 
 * @param userId - The user's ID
 * @returns True if profile exists
 */
export async function patientProfileExists(userId: string): Promise<boolean> {
  const count = await prisma.patientProfile.count({
    where: { userId },
  });
  return count > 0;
}

/**
 * Extract safe (non-PHI) profile fields for logging
 * Use this to avoid logging PHI
 * 
 * @param profile - Full patient profile
 * @returns Safe profile with no PHI
 */
export function extractSafeProfileFields(profile: {
  id: string;
  userId: string;
  primaryConcern: ConcernType | null;
  treatmentGoal: TreatmentGoal | null;
  privacyConsentGiven: boolean;
  privacyConsentDate: Date | null;
  termsAccepted: boolean;
  termsAcceptedDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): SafePatientProfile {
  return {
    id: profile.id,
    userId: profile.userId,
    primaryConcern: profile.primaryConcern,
    treatmentGoal: profile.treatmentGoal,
    privacyConsentGiven: profile.privacyConsentGiven,
    privacyConsentDate: profile.privacyConsentDate,
    termsAccepted: profile.termsAccepted,
    termsAcceptedDate: profile.termsAcceptedDate,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

/**
 * Validate California address
 * Rimal Health only serves California residents
 * 
 * @param state - State code to validate
 * @returns True if valid CA address
 */
export function isValidCaliforniaAddress(state: string): boolean {
  return state === 'CA';
}

/**
 * Format phone number for display
 * Converts +14155551234 to (415) 555-1234
 * 
 * @param phone - Raw phone number
 * @returns Formatted phone number
 */
export function formatPhoneForDisplay(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Handle US numbers
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // Handle US numbers with country code
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  // Return as-is if not a standard US format
  return phone;
}

/**
 * Get patient's full name (for display purposes only)
 * Note: This returns PHI - ensure caller handles appropriately
 * 
 * @param profile - Patient profile with first and last name
 * @returns Full name string
 */
export function getPatientFullName(profile: {
  firstName: string;
  lastName: string;
}): string {
  return `${profile.firstName} ${profile.lastName}`;
}
