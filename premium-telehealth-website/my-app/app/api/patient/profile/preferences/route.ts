/**
 * Patient Preferences API
 * 
 * HIPAA Compliance:
 * - Audit logging for all preference changes
 * - PATIENT role verification required
 * - User can only modify own preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { auditLogger, AuditEventType } from '@/lib/audit/index';
import { getClientIP } from '@/lib/audit/utils';
import { requireRole } from '@/lib/auth/require-auth';
import { Role } from '@prisma/client';

// ============================================================================
// Validation Schema
// ============================================================================

const preferencesSchema = z.object({
  emailNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(false),
  marketingEmails: z.boolean().default(false),
  appointmentReminders: z.boolean().default(true),
  prescriptionAlerts: z.boolean().default(true),
  messageAlerts: z.boolean().default(true),
  profileVisibility: z.enum(['PRIVATE', 'PROVIDERS_ONLY']).default('PROVIDERS_ONLY'),
  shareDataForResearch: z.boolean().default(false),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;

// ============================================================================
// GET Handler - Fetch Preferences
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';

  try {
    // Require PATIENT role
    const auth = await requireRole(request, [Role.PATIENT]);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { userId } = auth.user;

    // Get profile to find preferences
    const profile = await prisma.patientProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Return preferences or defaults
    const prefs = profile.notificationPreferences;
    const preferences = prefs || {
      emailNotifications: true,
      smsNotifications: false,
      marketingEmails: false,
      appointmentReminders: true,
      prescriptionAlerts: true,
      messageAlerts: true,
      profileVisibility: 'PROVIDERS_ONLY',
      shareDataForResearch: false,
    };

    await auditLogger.logPHIAccess(
      'VIEW',
      userId,
      Role.PATIENT,
      'PATIENT_PROFILE',
      userId,
      { ipAddress, userAgent, requestId: crypto.randomUUID() },
    );

    return NextResponse.json({
      success: true,
      preferences,
    });

  } catch (error) {
    console.error('Preferences fetch error:', error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json(
      { error: 'Failed to fetch preferences', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT Handler - Update Preferences
// ============================================================================

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';

  try {
    // Require PATIENT role
    const auth = await requireRole(request, [Role.PATIENT]);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { userId } = auth.user;

    // Parse and validate request body
    const body = await request.json();
    const validation = preferencesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          code: 'VALIDATION_ERROR',
          details: validation.error.flatten().fieldErrors 
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Get profile
    const profile = await prisma.patientProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Update notification preferences as JSON field
    const updatedProfile = await prisma.patientProfile.update({
      where: { userId },
      data: {
        notificationPreferences: {
          emailNotifications: data.emailNotifications,
          smsNotifications: data.smsNotifications,
          marketingEmails: data.marketingEmails,
          appointmentReminders: data.appointmentReminders,
          prescriptionAlerts: data.prescriptionAlerts,
          messageAlerts: data.messageAlerts,
          profileVisibility: data.profileVisibility,
          shareDataForResearch: data.shareDataForResearch,
        },
      },
    });

    const preferences = updatedProfile.notificationPreferences;

    // Audit log - preferences update
    await auditLogger.log({
      eventType: AuditEventType.PREFERENCES_UPDATED,
      userId,
      action: 'Notification and privacy preferences updated',
      ipAddress,
      userAgent,
      resourceType: 'PatientProfile',
      resourceId: profile.id,
      success: true,
      metadata: {
        changedFields: Object.keys(data),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences,
    });

  } catch (error) {
    console.error('Preferences update error:', error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json(
      { error: 'Failed to update preferences', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
