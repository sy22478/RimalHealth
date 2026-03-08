/**
 * Individual Patient Profile API Routes
 * 
 * GET /api/patient/profile/[id] - Get specific profile
 * PUT /api/patient/profile/[id] - Update specific profile
 * 
 * HIPAA Compliance:
 * - Users can only access their own profile
 * - Admin/Physicians can access any profile
 * - All PHI access is audit logged
 * - Updates only allowed for certain fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { auditLogger, PHIResourceType, DataModificationAction } from '@/lib/audit';
import { getClientIP } from '@/lib/audit/utils';
import {
  getPatientProfileById,
  getPatientProfileByUserId,
  updatePatientProfile,
  extractSafeProfileFields,
} from '@/lib/patient/profile';

// Schema for updating a profile
const updateProfileSchema = z.object({
  phone: z.string().optional(),
  addressStreet: z.string().optional(),
  addressCity: z.string().optional(),
  addressZip: z.string().optional(),
  billingSameAsHome: z.boolean().optional(),
  billingStreet: z.string().nullable().optional(),
  billingCity: z.string().nullable().optional(),
  billingState: z.string().nullable().optional(),
  billingZip: z.string().nullable().optional(),
  medicalHistory: z.record(z.string(), z.unknown()).optional(),
  currentMedications: z.record(z.string(), z.unknown()).optional(),
  allergies: z.record(z.string(), z.unknown()).optional(),
  insuranceProvider: z.string().nullable().optional(),
  insuranceMemberId: z.string().nullable().optional(),
  insuranceGroupNumber: z.string().nullable().optional(),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Verify user has access to the profile
 * - Patients can only access their own profile
 * - Physicians and admins can access any profile
 */
async function verifyProfileAccess(
  request: NextRequest,
  profileId: string
): Promise<{ authorized: boolean; userId?: string; role?: string; profileUserId?: string }> {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const cookieToken = request.cookies.get('accessToken')?.value ?? null;
  const token = bearerToken ?? cookieToken;
  if (!token) {
    return { authorized: false };
  }
  const payload = await verifyAccessToken(token);
  
  if (!payload) {
    return { authorized: false };
  }

  // Admins and physicians can access any profile
  if (payload.role === 'ADMIN' || payload.role === 'PHYSICIAN') {
    const profile = await getPatientProfileById(profileId);
    return {
      authorized: true,
      userId: payload.userId,
      role: payload.role,
      profileUserId: profile?.userId,
    };
  }

  // Patients can only access their own profile
  const profile = await getPatientProfileById(profileId);
  if (!profile) {
    return { authorized: false };
  }

  // Check if the profile belongs to the current user
  const userProfile = await getPatientProfileByUserId(payload.userId);
  if (!userProfile || userProfile.id !== profileId) {
    return { authorized: false };
  }

  return {
    authorized: true,
    userId: payload.userId,
    role: payload.role,
    profileUserId: profile.userId,
  };
}

/**
 * GET /api/patient/profile/[id]
 * Get a specific patient profile
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { id: profileId } = await context.params;

    // ========================================================================
    // 1. Verify access
    // ========================================================================
    const access = await verifyProfileAccess(request, profileId);
    
    if (!access.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // ========================================================================
    // 2. Fetch profile
    // ========================================================================
    const profile = await getPatientProfileById(profileId);

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // ========================================================================
    // 3. Audit log the access
    // ========================================================================
    await auditLogger.logPHIAccess(
      'VIEW',
      access.userId!,
      access.role!,
      PHIResourceType.PATIENT_PROFILE,
      profileId,
      {
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent') || '',
        requestId: crypto.randomUUID(),
      },
      {
        accessReason: access.role === 'PHYSICIAN' ? 'Clinical review' : 'Patient access',
      }
    );

    // ========================================================================
    // 4. Return profile
    // ========================================================================
    return NextResponse.json({
      success: true,
      profile,
    });

  } catch (error) {
    console.error('[Profile GET by ID] Error:', error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/patient/profile/[id]
 * Update a specific patient profile
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { id: profileId } = await context.params;

    // ========================================================================
    // 1. Verify access
    // ========================================================================
    const access = await verifyProfileAccess(request, profileId);
    
    if (!access.authorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Only patients can update their own profile
    // Physicians and admins should use different endpoints for clinical updates
    if (access.role === 'PHYSICIAN' || access.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'Use admin endpoints for staff updates' },
        { status: 403 }
      );
    }

    // ========================================================================
    // 2. Parse and validate request body
    // ========================================================================
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validationResult = updateProfileSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      
      return NextResponse.json(
        { error: 'Validation failed', errors },
        { status: 400 }
      );
    }

    const updateData = validationResult.data;

    // ========================================================================
    // 3. Get current profile for change tracking
    // ========================================================================
    const currentProfile = await getPatientProfileById(profileId);
    if (!currentProfile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Track which fields changed
    const fieldsChanged: string[] = [];
    for (const key of Object.keys(updateData)) {
      const field = key as keyof typeof updateData;
      if (updateData[field] !== undefined) {
        fieldsChanged.push(field);
      }
    }

    // ========================================================================
    // 4. Update profile
    // ========================================================================
    const updatedProfile = await updatePatientProfile(profileId, {
      phone: updateData.phone,
      addressStreet: updateData.addressStreet,
      addressCity: updateData.addressCity,
      addressZip: updateData.addressZip,
      billingSameAsHome: updateData.billingSameAsHome,
      billingStreet: updateData.billingStreet,
      billingCity: updateData.billingCity,
      billingState: updateData.billingState,
      billingZip: updateData.billingZip,
      medicalHistory: updateData.medicalHistory,
      currentMedications: updateData.currentMedications,
      allergies: updateData.allergies,
      insuranceProvider: updateData.insuranceProvider,
      insuranceMemberId: updateData.insuranceMemberId,
      insuranceGroupNumber: updateData.insuranceGroupNumber,
    });

    // ========================================================================
    // 5. Audit log the update
    // ========================================================================
    await auditLogger.logDataModification(
      DataModificationAction.UPDATE,
      access.userId!,
      PHIResourceType.PATIENT_PROFILE,
      profileId,
      {
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent') || '',
        requestId: crypto.randomUUID(),
      },
      {
        action: DataModificationAction.UPDATE,
        fieldsChanged,
      }
    );

    // ========================================================================
    // 6. Return updated profile
    // ========================================================================
    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      profile: updatedProfile,
    });

  } catch (error) {
    console.error('[Profile PUT] Error:', error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
