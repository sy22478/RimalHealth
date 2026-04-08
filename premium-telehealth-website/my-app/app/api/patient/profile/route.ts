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
// PHI encryption/decryption is handled automatically by the Prisma encryption extension
// in lib/db/encryption-extension.ts. Do NOT manually call encryptPHI/decryptPHI on fields
// that are listed in PHI_FIELDS — doing so causes double-encryption (data corruption).

/**
 * Safely serialize a PHI field that may be a string, array, or object after decryption.
 * Returns a comma-separated string or null. Prevents [object Object] display issues.
 */
function serializePHIField(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(String).join(', ');
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Handle common nested structures like { conditions: [...] }
    const inner = obj.conditions || obj.medications || obj.items || Object.values(obj)[0];
    if (Array.isArray(inner)) return inner.map(String).join(', ');
    if (typeof inner === 'string') return inner;
    // Last resort: JSON stringify, but don't return [object Object]
    try { return JSON.stringify(value); } catch { return null; }
  }
  return String(value);
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
      firstName: profile.firstName,
      lastName: profile.lastName,
      dateOfBirth: profile.dateOfBirth,
      phone: profile.phone,
      addressStreet: profile.addressStreet,
      addressCity: profile.addressCity,
      addressState: profile.addressState,
      addressZip: profile.addressZip,
      primaryConcern: profile.primaryConcern,
      treatmentGoal: profile.treatmentGoal,
      medicalHistory: serializePHIField(profile.medicalHistory),
      currentMedications: serializePHIField(profile.currentMedications),
      allergies: serializePHIField(profile.allergies),
      pharmacy,
      notificationPreferences: profile.notificationPreferences,
      privacyConsent: {
        given: profile.privacyConsentGiven,
        date: profile.privacyConsentDate?.toISOString(),
        version: profile.privacyConsentVersion,
      },
      termsAccepted: {
        accepted: profile.termsAccepted,
        date: profile.termsAcceptedDate?.toISOString(),
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
      dataToUpdate.addressState = 'CA';
      changedFields.push('addressState');
    }

    if (updateData.medicalHistory !== undefined && updateData.medicalHistory !== '') {
      dataToUpdate.medicalHistory = updateData.medicalHistory ? JSON.parse(JSON.stringify(updateData.medicalHistory)) : null;
      changedFields.push('medicalHistory');
    }

    if (updateData.currentMedications !== undefined && updateData.currentMedications !== '') {
      dataToUpdate.currentMedications = updateData.currentMedications ? JSON.parse(JSON.stringify(updateData.currentMedications)) : null;
      changedFields.push('currentMedications');
    }

    if (updateData.allergies !== undefined && updateData.allergies !== '') {
      dataToUpdate.allergies = updateData.allergies ? JSON.parse(JSON.stringify(updateData.allergies)) : null;
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
        firstName: refreshedProfile.firstName,
        lastName: refreshedProfile.lastName,
        dateOfBirth: refreshedProfile.dateOfBirth,
        phone: refreshedProfile.phone,
        addressStreet: refreshedProfile.addressStreet,
        addressCity: refreshedProfile.addressCity,
        addressState: refreshedProfile.addressState,
        addressZip: refreshedProfile.addressZip,
        primaryConcern: refreshedProfile.primaryConcern,
        treatmentGoal: refreshedProfile.treatmentGoal,
        medicalHistory: refreshedProfile.medicalHistory,
        currentMedications: refreshedProfile.currentMedications,
        allergies: refreshedProfile.allergies,
        pharmacy: updatedPharmacy,
        notificationPreferences: refreshedProfile.notificationPreferences,
        privacyConsent: {
          given: refreshedProfile.privacyConsentGiven,
          date: refreshedProfile.privacyConsentDate?.toISOString(),
          version: refreshedProfile.privacyConsentVersion,
        },
        termsAccepted: {
          accepted: refreshedProfile.termsAccepted,
          date: refreshedProfile.termsAcceptedDate?.toISOString(),
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
