/**
 * GET /api/patient/profile
 * PUT /api/patient/profile
 * Manage patient profile
 * 
 * HIPAA Compliance:
 * - Returns only own profile
 * - Decrypts PHI for authorized access
 * - Logs all access
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { updateProfileSchema } from '@/lib/validation/schemas';
import { Role, IntakeStatus } from '@prisma/client';
import { validateCaliforniaZip, validateCaliforniaState } from '@/lib/utils/validation-helpers';
import { DataModificationAction } from '@/lib/audit/index';
import { validateAddress } from '@/lib/integrations/location';
import { requireCSRF } from '@/lib/security/csrf';
import { DEFAULT_ALLOWED_STATE } from '@/lib/constants';
import { humanizeValue } from '@/lib/utils/labels';
// PHI encryption/decryption is handled automatically by the Prisma encryption extension
// in lib/db/encryption-extension.ts. Do NOT manually call encryptPHI/decryptPHI on fields
// that are listed in PHI_FIELDS — doing so causes double-encryption (data corruption).

/**
 * Safely process a PHI-derived field. Catches unexpected errors (e.g. decryption
 * edge cases, malformed JSON after decrypt) and returns null so one bad field
 * never 500s the whole profile. The field name is logged; the value is NOT
 * (it is PHI).
 */
function safeField<T>(fieldName: string, compute: () => T): T | null {
  try {
    return compute();
  } catch (error) {
    console.error(`[profile] failed to process field ${fieldName}:`, error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Coerce a single array item to a display string. Items may be strings or
 * objects like { name: 'Adderall' } / { label: '...' } / { value: '...' };
 * naive String() coercion on objects yields literal '[object Object]'.
 */
function itemToString(item: unknown): string | null {
  if (item == null) return null;
  if (typeof item === 'string') return item.trim() || null;
  if (typeof item === 'number' || typeof item === 'boolean') return String(item);
  if (typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    const candidate = obj.name ?? obj.label ?? obj.value ?? obj.title ?? obj.text;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (typeof candidate === 'number') return String(candidate);
    return null;
  }
  return null;
}

/**
 * Safely serialize a PHI field that may be a string, array, or object after decryption.
 * Returns a comma-separated string or null. Prevents [object Object] display issues.
 */
function serializePHIField(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const parts = value.map(itemToString).filter((s): s is string => !!s);
    return parts.length > 0 ? parts.join(', ') : null;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Handle common nested structures like { conditions: [...] }
    const inner = obj.conditions || obj.medications || obj.items || Object.values(obj)[0];
    if (Array.isArray(inner)) {
      const parts = inner.map(itemToString).filter((s): s is string => !!s);
      return parts.length > 0 ? parts.join(', ') : null;
    }
    if (typeof inner === 'string') return inner;
    const single = itemToString(value);
    if (single) return single;
    return null;
  }
  return String(value);
}

/**
 * Sanitize a comma-separated multi-value PHI string before persisting.
 * Strips "[object Object]" literals left behind by prior client-side object-to-string
 * coercion, drops empty tokens, and collapses whitespace. Returns null when nothing
 * remains, so the DB clears the field instead of storing a dangling separator.
 */
function sanitizeMultiValueField(value: string): string | null {
  const cleaned = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item !== '[object Object]')
    .join(', ');
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Extract human-readable medical conditions from intake formData.
 * The intake stores medical history as an object with boolean flags and arrays;
 * this function returns only the meaningful conditions as a comma-separated string.
 */
function extractMedicalConditions(data: unknown): string | null {
  if (data == null) return null;
  if (typeof data === 'string') return data || null;
  if (Array.isArray(data)) {
    const parts = data.map(itemToString).filter((s): s is string => !!s);
    return parts.length > 0 ? parts.join(', ') : null;
  }
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const conditions: string[] = [];

    // Extract array-based condition lists. Items may be strings OR objects
    // like { name: 'High Cholesterol' } — itemToString handles both.
    // Raw intake keys (e.g., "depression-anxiety") are mapped to labels so older
    // rows render cleanly even though new submissions store labels directly.
    if (Array.isArray(obj.medicalHistoryItems)) {
      conditions.push(
        ...obj.medicalHistoryItems
          .map(itemToString)
          .filter((s): s is string => !!s)
          .map((s) => humanizeValue(s)),
      );
    }
    if (Array.isArray(obj.conditions)) {
      conditions.push(
        ...obj.conditions
          .map(itemToString)
          .filter((s): s is string => !!s)
          .map((s) => humanizeValue(s)),
      );
    }

    // Extract free-text conditions
    if (typeof obj.otherConditions === 'string' && obj.otherConditions.trim()) {
      conditions.push(obj.otherConditions.trim());
    }
    if (typeof obj.medicalHistory === 'string' && obj.medicalHistory.trim()) {
      conditions.push(obj.medicalHistory.trim());
    }

    // Add conditions indicated by true boolean flags
    if (obj.hasLiverDisease === true || obj.hasLiverDisease === 'true') conditions.push('Liver Disease');
    if (obj.hasKidneyDisease === true || obj.hasKidneyDisease === 'true') conditions.push('Kidney Disease');
    if (obj.hasHeartCondition === true || obj.hasHeartCondition === 'true') conditions.push('Heart Condition');
    if (obj.hasSeizureHistory === true || obj.hasSeizureHistory === 'true') conditions.push('Seizure History');
    if (obj.hasPsychiatricHistory === true || obj.hasPsychiatricHistory === 'true') conditions.push('Psychiatric History');
    if (obj.isPregnant === true || obj.isPregnant === 'true') conditions.push('Pregnant');
    if (obj.liverCondition === true || obj.liverCondition === 'true') conditions.push('Liver Condition');

    // De-duplicate (e.g., if "Liver Disease" came from both the array and the flag)
    const deduped = Array.from(new Set(conditions.filter(Boolean)));
    return deduped.join(', ') || null;
  }
  return String(data);
}

/**
 * Extract human-readable medication list from intake formData.
 * Returns the medication list string, or null if patient isn't taking medications.
 */
function extractMedications(data: unknown): string | null {
  if (data == null) return null;
  if (typeof data === 'string') return data || null;
  if (Array.isArray(data)) {
    const parts = data.map(itemToString).filter((s): s is string => !!s);
    return parts.length > 0 ? parts.join(', ') : null;
  }
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;

    // Direct medication list string
    if (typeof obj.medicationList === 'string' && obj.medicationList.trim()) {
      return obj.medicationList.trim();
    }
    // Array of medications. Items may be strings OR objects like
    // { name: 'Adderall', dosage: '...' } — itemToString handles both.
    if (Array.isArray(obj.medications) && obj.medications.length > 0) {
      const parts = obj.medications.map(itemToString).filter((s): s is string => !!s);
      return parts.length > 0 ? parts.join(', ') : null;
    }
    // If not taking medications, return null
    if (obj.takingMedications === 'false' || obj.takingMedications === false ||
        obj.currentMedications === 'false' || obj.currentMedications === false) {
      return null;
    }

    return null;
  }
  return String(data);
}

// ============================================================================
// GET - Retrieve Profile
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Require patient role
  const auth = await requireRole(request, [Role.PATIENT]);
  
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const auditContext = AuditService.createAuditContext(request, userId, 'PATIENT');

  try {
    // Get profile with user data and preferred pharmacy
    const profile = await prisma.patientProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            emailVerified: true,
            createdAt: true,
          },
        },
        preferredPharmacy: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Log access
    await AuditService.logPatientProfileAccess(userId, 'PATIENT', userId, 'VIEW', auditContext);

    // PHI fields are already decrypted by the Prisma encryption extension on read.
    // Address fields are returned flat (addressStreet, addressCity, etc.)
    // to match the format expected by PersonalInfoForm and the PUT handler.

    // Build pharmacy info: prefer linked Pharmacy record, fall back to intake formData
    let pharmacy: {
      name: string;
      address: string;
      city: string;
      zip: string;
      phone?: string;
      source: 'pharmacy_record' | 'intake';
    } | null = null;

    if (profile.preferredPharmacy) {
      pharmacy = {
        name: profile.preferredPharmacy.name,
        address: profile.preferredPharmacy.address,
        city: profile.preferredPharmacy.city,
        zip: profile.preferredPharmacy.zipCode,
        phone: profile.preferredPharmacy.phone || undefined,
        source: 'pharmacy_record',
      };
    } else {
      // Fall back to pharmacy info stored in the latest submitted intake formData
      const latestIntake = await prisma.intake.findFirst({
        where: { patientId: userId, status: { not: IntakeStatus.DRAFT } },
        orderBy: { submittedAt: 'desc' },
        select: { formData: true },
      });

      if (latestIntake?.formData && typeof latestIntake.formData === 'object') {
        const fd = latestIntake.formData as Record<string, unknown>;
        if (fd.pharmacyName && typeof fd.pharmacyName === 'string') {
          pharmacy = {
            name: fd.pharmacyName,
            address: typeof fd.pharmacyAddress === 'string' ? fd.pharmacyAddress : '',
            city: typeof fd.pharmacyCity === 'string' ? fd.pharmacyCity : '',
            zip: typeof fd.pharmacyZip === 'string' ? fd.pharmacyZip : '',
            phone: typeof fd.pharmacyPhone === 'string' ? fd.pharmacyPhone : undefined,
            source: 'intake',
          };
        }
      }
    }

    const formattedProfile = {
      id: profile.userId,
      email: profile.user.email,
      emailVerified: profile.user.emailVerified,
      firstName: safeField('firstName', () => profile.firstName),
      lastName: safeField('lastName', () => profile.lastName),
      dateOfBirth: safeField('dateOfBirth', () => profile.dateOfBirth),
      phone: safeField('phone', () => profile.phone),
      addressStreet: safeField('addressStreet', () => profile.addressStreet),
      addressCity: safeField('addressCity', () => profile.addressCity),
      addressState: profile.addressState,
      addressZip: safeField('addressZip', () => profile.addressZip),
      primaryConcern: profile.primaryConcern,
      primaryConcernLabel: profile.primaryConcern ? humanizeValue(profile.primaryConcern) : null,
      treatmentGoal: profile.treatmentGoal,
      treatmentGoalLabel: profile.treatmentGoal ? humanizeValue(profile.treatmentGoal) : null,
      biologicalSex: profile.biologicalSex ?? null,
      biologicalSexLabel: profile.biologicalSex ? humanizeValue(profile.biologicalSex) : null,
      medicalHistory: safeField('medicalHistory', () => extractMedicalConditions(profile.medicalHistory)),
      currentMedications: safeField('currentMedications', () => extractMedications(profile.currentMedications)),
      allergies: safeField('allergies', () => serializePHIField(profile.allergies)),
      pharmacy,
      notificationPreferences: profile.notificationPreferences,
      privacyConsent: {
        given: profile.privacyConsentGiven,
        date: safeField('privacyConsentDate', () => profile.privacyConsentDate?.toISOString()),
        version: profile.privacyConsentVersion,
      },
      termsAccepted: {
        accepted: profile.termsAccepted,
        date: safeField('termsAcceptedDate', () => profile.termsAcceptedDate?.toISOString()),
      },
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };

    return NextResponse.json({ profile: formattedProfile });
  } catch (error) {
    console.error('Get profile error:', error instanceof Error ? error.message : 'Unknown error');
    
    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/patient/profile',
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to retrieve profile', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Update Profile
// ============================================================================

export async function PUT(request: NextRequest): Promise<NextResponse> {
  // CSRF guard before any state change
  const csrfError = requireCSRF(request);
  if (csrfError) return csrfError;

  // Require patient role
  const auth = await requireRole(request, [Role.PATIENT]);

  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const auditContext = AuditService.createAuditContext(request, userId, 'PATIENT');

  try {
    // Validate request body
    const validation = await ValidationService.validateRequestBody(
      request,
      updateProfileSchema
    );

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const updateData = validation.data!;

    // Build update object — PHI encryption is handled automatically by the Prisma
    // encryption extension on write. Do NOT manually call encryptPHI here.
    // Empty strings are treated as "not provided" and skipped.
    const dataToUpdate: Record<string, unknown> = {};
    const changedFields: string[] = [];

    // Helper: returns true for non-empty, non-undefined string values
    const hasValue = (val: unknown): val is string =>
      typeof val === 'string' && val.length > 0;

    if (hasValue(updateData.firstName)) {
      dataToUpdate.firstName = updateData.firstName;
      changedFields.push('firstName');
    }

    if (hasValue(updateData.lastName)) {
      dataToUpdate.lastName = updateData.lastName;
      changedFields.push('lastName');
    }

    if (hasValue(updateData.dateOfBirth)) {
      dataToUpdate.dateOfBirth = updateData.dateOfBirth;
      changedFields.push('dateOfBirth');
    }

    if (hasValue(updateData.phone)) {
      dataToUpdate.phone = updateData.phone;
      changedFields.push('phone');
    }

    if (hasValue(updateData.addressStreet)) {
      dataToUpdate.addressStreet = updateData.addressStreet;
      changedFields.push('addressStreet');
    }

    if (hasValue(updateData.addressCity)) {
      dataToUpdate.addressCity = updateData.addressCity;
      changedFields.push('addressCity');
    }

    if (hasValue(updateData.addressZip)) {
      const zipValidation = validateCaliforniaZip(updateData.addressZip);
      if (!zipValidation.valid) {
        return NextResponse.json({ error: zipValidation.error }, { status: 400 });
      }
      dataToUpdate.addressZip = updateData.addressZip;
      changedFields.push('addressZip');
    }

    if (hasValue(updateData.addressState)) {
      const stateValidation = validateCaliforniaState(updateData.addressState);
      if (!stateValidation.valid) {
        return NextResponse.json({ error: stateValidation.error }, { status: 400 });
      }
      dataToUpdate.addressState = DEFAULT_ALLOWED_STATE;
      changedFields.push('addressState');
    }

    // Amazon Location Service address validation (graceful degradation)
    const addrStreet = (dataToUpdate.addressStreet as string) || updateData.addressStreet;
    const addrCity = (dataToUpdate.addressCity as string) || updateData.addressCity;
    const addrZip = (dataToUpdate.addressZip as string) || updateData.addressZip;
    if (
      hasValue(addrStreet) &&
      hasValue(addrCity) &&
      hasValue(addrZip)
    ) {
      try {
        const addrResult = await validateAddress({
          street: addrStreet,
          city: addrCity,
          state: DEFAULT_ALLOWED_STATE,
          zip: addrZip,
        });

        if (!addrResult.error && !addrResult.valid) {
          if (addrResult.suggestions.length > 0) {
            return NextResponse.json(
              {
                error: 'Address could not be verified',
                code: 'ADDRESS_INVALID',
                suggestions: addrResult.suggestions,
              },
              { status: 400 }
            );
          }
          return NextResponse.json(
            {
              error: 'Address could not be verified. Please check and try again.',
              code: 'ADDRESS_INVALID',
            },
            { status: 400 }
          );
        }

        // Persist geocoded coordinates so pharmacy search can sort by proximity.
        const topSuggestion = addrResult.suggestions[0];
        if (
          addrResult.valid &&
          topSuggestion &&
          typeof topSuggestion.latitude === 'number' &&
          typeof topSuggestion.longitude === 'number'
        ) {
          dataToUpdate.latitude = topSuggestion.latitude;
          dataToUpdate.longitude = topSuggestion.longitude;
          changedFields.push('latitude', 'longitude');
        }
        // If addrResult.error (Location Service failure), proceed — graceful degradation
      } catch (addrError) {
        // Location Service is down — log and proceed, don't block profile saves
        console.error('Address validation service unavailable:', addrError instanceof Error ? addrError.message : 'Unknown error');
      }
    }

    // JSON fields: pass raw values — the Prisma encryption extension serializes
    // and encrypts before write. Don't double-serialize with JSON.parse(JSON.stringify()).
    if (updateData.medicalHistory !== undefined && updateData.medicalHistory !== '') {
      dataToUpdate.medicalHistory = sanitizeMultiValueField(updateData.medicalHistory);
      changedFields.push('medicalHistory');
    }

    if (updateData.currentMedications !== undefined && updateData.currentMedications !== '') {
      dataToUpdate.currentMedications = sanitizeMultiValueField(updateData.currentMedications);
      changedFields.push('currentMedications');
    }

    if (updateData.allergies !== undefined && updateData.allergies !== '') {
      dataToUpdate.allergies = sanitizeMultiValueField(updateData.allergies);
      changedFields.push('allergies');
    }

    // Allow clearing optional string fields by sending explicit null
    const clearableStringFields = [
      'phone', 'addressStreet', 'addressCity', 'addressZip', 'addressState',
      'primaryConcern', 'treatmentGoal',
    ] as const;
    for (const field of clearableStringFields) {
      if (field in updateData && (updateData as Record<string, unknown>)[field] === null) {
        dataToUpdate[field] = null;
        changedFields.push(field);
      }
    }

    // Handle preferredPharmacyId: only update when a new pharmacy is explicitly selected.
    // Sending null or empty string does NOT clear the existing pharmacy —
    // pharmacy is required for prescription delivery.
    if (hasValue(updateData.preferredPharmacyId)) {
      // Validate pharmacy exists before setting
      const pharmacyExists = await prisma.pharmacy.findUnique({
        where: { id: updateData.preferredPharmacyId },
        select: { id: true },
      });
      if (!pharmacyExists) {
        return NextResponse.json(
          { error: 'Pharmacy not found', code: 'INVALID_PHARMACY' },
          { status: 400 }
        );
      }
      dataToUpdate.preferredPharmacyId = updateData.preferredPharmacyId;
      changedFields.push('preferredPharmacyId');
    }

    if (updateData.notificationPreferences) {
      dataToUpdate.notificationPreferences = updateData.notificationPreferences;
      changedFields.push('notificationPreferences');
    }

    // Update profile
    await prisma.patientProfile.update({
      where: { userId },
      data: dataToUpdate,
    });

    // Log update
    await AuditService.logPatientProfileAccess(userId, 'PATIENT', userId, 'UPDATE', auditContext);
    await AuditService.logDataModification(
      DataModificationAction.UPDATE,
      userId,
      'PatientProfile',
      userId,
      auditContext,
      changedFields,
      'Profile update'
    );

    // Re-query the full profile (same shape as GET) to avoid stale data on the client
    const refreshedProfile = await prisma.patientProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            emailVerified: true,
            createdAt: true,
          },
        },
        preferredPharmacy: true,
      },
    });

    if (!refreshedProfile) {
      return NextResponse.json(
        { error: 'Profile not found after update', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Build pharmacy info for response
    let updatedPharmacy: {
      name: string;
      address: string;
      city: string;
      zip: string;
      phone?: string;
      source: 'pharmacy_record' | 'intake';
    } | null = null;

    if (refreshedProfile.preferredPharmacy) {
      updatedPharmacy = {
        name: refreshedProfile.preferredPharmacy.name,
        address: refreshedProfile.preferredPharmacy.address,
        city: refreshedProfile.preferredPharmacy.city,
        zip: refreshedProfile.preferredPharmacy.zipCode,
        phone: refreshedProfile.preferredPharmacy.phone || undefined,
        source: 'pharmacy_record',
      };
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: refreshedProfile.userId,
        email: refreshedProfile.user.email,
        emailVerified: refreshedProfile.user.emailVerified,
        firstName: safeField('firstName', () => refreshedProfile.firstName),
        lastName: safeField('lastName', () => refreshedProfile.lastName),
        dateOfBirth: safeField('dateOfBirth', () => refreshedProfile.dateOfBirth),
        phone: safeField('phone', () => refreshedProfile.phone),
        addressStreet: safeField('addressStreet', () => refreshedProfile.addressStreet),
        addressCity: safeField('addressCity', () => refreshedProfile.addressCity),
        addressState: refreshedProfile.addressState,
        addressZip: safeField('addressZip', () => refreshedProfile.addressZip),
        primaryConcern: refreshedProfile.primaryConcern,
        primaryConcernLabel: refreshedProfile.primaryConcern ? humanizeValue(refreshedProfile.primaryConcern) : null,
        treatmentGoal: refreshedProfile.treatmentGoal,
        treatmentGoalLabel: refreshedProfile.treatmentGoal ? humanizeValue(refreshedProfile.treatmentGoal) : null,
        biologicalSex: refreshedProfile.biologicalSex ?? null,
        biologicalSexLabel: refreshedProfile.biologicalSex ? humanizeValue(refreshedProfile.biologicalSex) : null,
        medicalHistory: safeField('medicalHistory', () => extractMedicalConditions(refreshedProfile.medicalHistory)),
        currentMedications: safeField('currentMedications', () => extractMedications(refreshedProfile.currentMedications)),
        allergies: safeField('allergies', () => serializePHIField(refreshedProfile.allergies)),
        pharmacy: updatedPharmacy,
        notificationPreferences: refreshedProfile.notificationPreferences,
        privacyConsent: {
          given: refreshedProfile.privacyConsentGiven,
          date: safeField('privacyConsentDate', () => refreshedProfile.privacyConsentDate?.toISOString()),
          version: refreshedProfile.privacyConsentVersion,
        },
        termsAccepted: {
          accepted: refreshedProfile.termsAccepted,
          date: safeField('termsAcceptedDate', () => refreshedProfile.termsAcceptedDate?.toISOString()),
        },
        createdAt: refreshedProfile.createdAt.toISOString(),
        updatedAt: refreshedProfile.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Update profile error:', error instanceof Error ? error.message : 'Unknown error');
    
    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/patient/profile',
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to update profile', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
