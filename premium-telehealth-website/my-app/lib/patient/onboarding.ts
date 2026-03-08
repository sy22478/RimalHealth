/**
 * Patient Onboarding Workflow
 * 
 * Manages the onboarding process from checkout to profile creation.
 * Handles temporary storage of checkout data before payment completion.
 * 
 * HIPAA Compliance:
 * - Temporary data stored in Redis expires quickly (1 hour)
 * - No PHI in Redis keys (uses userId hash)
 * - Data cleared immediately after profile creation
 * 
 * @module lib/patient/onboarding
 */

import { getRedisClient } from '@/lib/redis/client';
import { ConcernType, TreatmentGoal } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

/**
 * Checkout data structure stored temporarily during payment
 * Mirrors the CheckoutData from the frontend
 */
export interface CheckoutData {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // MM/DD/YYYY
  phone: string;
  addressStreet: string;
  addressCity: string;
  addressState: string; // CA only
  addressZip: string;
  billingSameAsHome: boolean;
  billingStreet?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  primaryConcern: ConcernType;
  treatmentGoal: TreatmentGoal;
  privacyConsentGiven: boolean;
  termsAccepted: boolean;
}

/**
 * Onboarding status for tracking progress
 */
export interface OnboardingStatus {
  step: 'CHECKOUT' | 'PAYMENT_PENDING' | 'PAYMENT_COMPLETED' | 'PROFILE_CREATED' | 'INTAKE_PENDING' | 'COMPLETED';
  userId: string;
  checkoutDataStoredAt?: string;
  paymentCompletedAt?: string;
  profileCreatedAt?: string;
  intakeSubmittedAt?: string;
}

// ============================================================================
// Constants
// ============================================================================

const REDIS_KEY_PREFIX = 'checkout:';
const ONBOARDING_STATUS_PREFIX = 'onboarding:';
const CHECKOUT_TTL = 60 * 60; // 1 hour in seconds
const ONBOARDING_STATUS_TTL = 60 * 60 * 24; // 24 hours

// ============================================================================
// Checkout Data Storage (Temporary)
// ============================================================================

/**
 * Store checkout data temporarily in Redis
 * Called when user submits checkout form before payment
 * 
 * HIPAA Compliance:
 * - Data expires after 1 hour (CHECKOUT_TTL)
 * - Uses userId in key (not email or PHI)
 * - Cleared immediately after successful payment
 * 
 * @param userId - User ID (not PHI)
 * @param data - Checkout form data (contains PHI)
 */
export async function storeCheckoutData(
  userId: string,
  data: CheckoutData
): Promise<void> {
  const redis = getRedisClient();
  const key = `${REDIS_KEY_PREFIX}${userId}`;
  
  await redis.setex(
    key,
    CHECKOUT_TTL,
    JSON.stringify(data)
  );
  
  // Also store onboarding status
  const statusKey = `${ONBOARDING_STATUS_PREFIX}${userId}`;
  const status: OnboardingStatus = {
    step: 'PAYMENT_PENDING',
    userId,
    checkoutDataStoredAt: new Date().toISOString(),
  };
  await redis.setex(statusKey, ONBOARDING_STATUS_TTL, JSON.stringify(status));
}

/**
 * Retrieve checkout data from Redis
 * Called by Stripe webhook after payment success
 * 
 * @param userId - User ID
 * @returns Checkout data or null if not found/expired
 */
export async function getCheckoutData(userId: string): Promise<CheckoutData | null> {
  const redis = getRedisClient();
  const key = `${REDIS_KEY_PREFIX}${userId}`;
  
  const data = await redis.get(key);
  
  if (!data) {
    return null;
  }
  
  try {
    return JSON.parse(data) as CheckoutData;
  } catch {
    // If parsing fails, delete the corrupted data
    await redis.del(key);
    return null;
  }
}

/**
 * Clear checkout data from Redis
 * Called after successful profile creation
 * 
 * @param userId - User ID
 */
export async function clearCheckoutData(userId: string): Promise<void> {
  const redis = getRedisClient();
  const key = `${REDIS_KEY_PREFIX}${userId}`;
  await redis.del(key);
}

/**
 * Check if checkout data exists for user
 * 
 * @param userId - User ID
 * @returns True if checkout data exists
 */
export async function hasCheckoutData(userId: string): Promise<boolean> {
  const redis = getRedisClient();
  const key = `${REDIS_KEY_PREFIX}${userId}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Extend checkout data TTL
 * Called if payment is taking longer than expected
 * 
 * @param userId - User ID
 * @param additionalSeconds - Additional TTL in seconds
 */
export async function extendCheckoutDataTTL(
  userId: string,
  additionalSeconds: number = 1800 // 30 minutes default
): Promise<void> {
  const redis = getRedisClient();
  const key = `${REDIS_KEY_PREFIX}${userId}`;
  await redis.expire(key, CHECKOUT_TTL + additionalSeconds);
}

// ============================================================================
// Onboarding Status Management
// ============================================================================

/**
 * Update onboarding status
 * Tracks progress through the onboarding flow
 * 
 * @param userId - User ID
 * @param step - Current onboarding step
 */
export async function updateOnboardingStatus(
  userId: string,
  step: OnboardingStatus['step']
): Promise<void> {
  const redis = getRedisClient();
  const statusKey = `${ONBOARDING_STATUS_PREFIX}${userId}`;
  
  const existingData = await redis.get(statusKey);
  const existing: Partial<OnboardingStatus> = existingData 
    ? JSON.parse(existingData) 
    : {};
  
  const status: OnboardingStatus = {
    ...existing,
    step,
    userId,
  };
  
  // Add timestamps for specific steps
  const now = new Date().toISOString();
  switch (step) {
    case 'PAYMENT_COMPLETED':
      status.paymentCompletedAt = now;
      break;
    case 'PROFILE_CREATED':
      status.profileCreatedAt = now;
      break;
    case 'COMPLETED':
      status.intakeSubmittedAt = now;
      break;
  }
  
  await redis.setex(statusKey, ONBOARDING_STATUS_TTL, JSON.stringify(status));
}

/**
 * Get onboarding status
 * 
 * @param userId - User ID
 * @returns Onboarding status or null
 */
export async function getOnboardingStatus(userId: string): Promise<OnboardingStatus | null> {
  const redis = getRedisClient();
  const statusKey = `${ONBOARDING_STATUS_PREFIX}${userId}`;
  
  const data = await redis.get(statusKey);
  
  if (!data) {
    return null;
  }
  
  try {
    return JSON.parse(data) as OnboardingStatus;
  } catch {
    return null;
  }
}

/**
 * Clear all onboarding data for a user
 * Called after onboarding is complete
 * 
 * @param userId - User ID
 */
export async function clearOnboardingData(userId: string): Promise<void> {
  const redis = getRedisClient();
  
  await Promise.all([
    redis.del(`${REDIS_KEY_PREFIX}${userId}`),
    redis.del(`${ONBOARDING_STATUS_PREFIX}${userId}`),
  ]);
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate checkout data structure
 * Ensures all required fields are present before creating profile
 * 
 * @param data - Checkout data to validate
 * @returns Validation result
 */
export function validateCheckoutData(data: unknown): { 
  valid: boolean; 
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid data format'] };
  }
  
  const d = data as Record<string, unknown>;
  
  // Required personal info fields
  const requiredFields = [
    'firstName',
    'lastName',
    'dateOfBirth',
    'phone',
    'addressStreet',
    'addressCity',
    'addressState',
    'addressZip',
    'primaryConcern',
    'treatmentGoal',
    'privacyConsentGiven',
    'termsAccepted',
  ];
  
  for (const field of requiredFields) {
    if (!(field in d) || d[field] === undefined || d[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Validate consent is given
  if (d.privacyConsentGiven !== true) {
    errors.push('Privacy consent must be given');
  }
  
  if (d.termsAccepted !== true) {
    errors.push('Terms must be accepted');
  }
  
  // Validate California only
  if (d.addressState !== 'CA') {
    errors.push('Address must be in California');
  }
  
  // Validate billing address if different from home
  if (d.billingSameAsHome === false) {
    if (!d.billingStreet || !d.billingCity || !d.billingState || !d.billingZip) {
      errors.push('Billing address is required when different from home');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Convert checkout data to profile creation format
 * Prepares checkout data for PatientProfile.create
 * 
 * @param userId - User ID
 * @param checkoutData - Raw checkout data
 * @returns Formatted data for profile creation
 */
export function checkoutDataToProfileData(
  userId: string,
  checkoutData: CheckoutData
) {
  const now = new Date();
  
  return {
    userId,
    firstName: checkoutData.firstName,
    lastName: checkoutData.lastName,
    dateOfBirth: checkoutData.dateOfBirth,
    phone: checkoutData.phone,
    addressStreet: checkoutData.addressStreet,
    addressCity: checkoutData.addressCity,
    addressState: checkoutData.addressState,
    addressZip: checkoutData.addressZip,
    billingSameAsHome: checkoutData.billingSameAsHome,
    billingStreet: checkoutData.billingStreet || null,
    billingCity: checkoutData.billingCity || null,
    billingState: checkoutData.billingState || null,
    billingZip: checkoutData.billingZip || null,
    primaryConcern: checkoutData.primaryConcern,
    treatmentGoal: checkoutData.treatmentGoal,
    privacyConsentGiven: true,
    privacyConsentDate: now,
    privacyConsentVersion: '1.0',
    termsAccepted: true,
    termsAcceptedDate: now,
  };
}
