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
import { verifyAccessToken } from '@/lib/auth/jwt';

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
// Authentication Helper
// ============================================================================

async function authenticatePatient(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  try {
    // Check Authorization: Bearer header first, then fall back to cookie
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const cookieToken = request.cookies.get('accessToken')?.value ?? null;
    const token = bearerToken ?? cookieToken;

    if (!token) {
      return null;
    }

    const payload = await verifyAccessToken(token);

    if (!payload || payload.role !== 'PATIENT') {
      return null;
    }

    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}

// ============================================================================
// GET Handler - Fetch Preferences
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';

  try {
    // Authenticate and verify PATIENT role
    const auth = await authenticatePatient(request);
    
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { userId } = auth;

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

    return NextResponse.json({
      success: true,
      preferences,
    });

  } catch (error) {
    console.error('Preferences fetch error:', error);
    
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
    // Authenticate and verify PATIENT role
    const auth = await authenticatePatient(request);
    
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const { userId } = auth;

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
    console.error('Preferences update error:', error);
    
    return NextResponse.json(
      { error: 'Failed to update preferences', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
