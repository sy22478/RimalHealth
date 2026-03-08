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
import { Role } from '@prisma/client';
import { DataModificationAction } from '@/lib/audit';
import { decryptPHI, encryptPHI } from '@/lib/encryption/phi';

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
    // Get profile with user data
    const profile = await prisma.patientProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            email: true,
            createdAt: true,
          },
        },
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

    // Decrypt PHI fields
    // Address fields are returned flat (addressStreet, addressCity, etc.)
    // to match the format expected by PersonalInfoForm and the PUT handler
    const decryptedProfile = {
      id: profile.userId,
      email: profile.user.email,
      firstName: decryptPHI(profile.firstName),
      lastName: decryptPHI(profile.lastName),
      dateOfBirth: decryptPHI(profile.dateOfBirth),
      phone: decryptPHI(profile.phone),
      addressStreet: decryptPHI(profile.addressStreet),
      addressCity: decryptPHI(profile.addressCity),
      addressState: profile.addressState,
      addressZip: decryptPHI(profile.addressZip),
      primaryConcern: profile.primaryConcern,
      treatmentGoal: profile.treatmentGoal,
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

    return NextResponse.json({ profile: decryptedProfile });
  } catch (error) {
    console.error('Get profile error:', error);
    
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

    // Build update object with encryption
    const dataToUpdate: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (updateData.firstName) {
      dataToUpdate.firstName = encryptPHI(updateData.firstName);
      changedFields.push('firstName');
    }

    if (updateData.lastName) {
      dataToUpdate.lastName = encryptPHI(updateData.lastName);
      changedFields.push('lastName');
    }

    if (updateData.phone) {
      dataToUpdate.phone = encryptPHI(updateData.phone);
      changedFields.push('phone');
    }

    if (updateData.addressStreet) {
      dataToUpdate.addressStreet = encryptPHI(updateData.addressStreet);
      changedFields.push('addressStreet');
    }

    if (updateData.addressCity) {
      dataToUpdate.addressCity = encryptPHI(updateData.addressCity);
      changedFields.push('addressCity');
    }

    if (updateData.addressZip) {
      dataToUpdate.addressZip = encryptPHI(updateData.addressZip);
      changedFields.push('addressZip');
    }

    if (updateData.preferredPharmacyId) {
      dataToUpdate.preferredPharmacyId = updateData.preferredPharmacyId;
      changedFields.push('preferredPharmacyId');
    }

    if (updateData.notificationPreferences) {
      dataToUpdate.notificationPreferences = updateData.notificationPreferences;
      changedFields.push('notificationPreferences');
    }

    // Update profile
    const updatedProfile = await prisma.patientProfile.update({
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

    return NextResponse.json({
      success: true,
      profile: {
        id: updatedProfile.userId,
        updatedAt: updatedProfile.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
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
