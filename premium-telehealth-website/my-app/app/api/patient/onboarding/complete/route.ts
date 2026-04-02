/**
 * POST /api/patient/onboarding/complete
 * 
 * Marks onboarding as complete after intake form submission.
 * Called after patient submits the medical intake form.
 * 
 * This endpoint:
 * 1. Verifies the user has a profile
 * 2. Updates onboarding status to COMPLETED
 * 3. Clears temporary onboarding data
 * 4. Sends confirmation notification
 * 
 * HIPAA Compliance:
 * - All PHI access is audit logged
 * - Intake form data is stored separately (via /api/intake)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { auditLogger, PHIResourceType } from '@/lib/audit/index';
import { getClientIP } from '@/lib/audit/utils';
import { notificationQueue, EmailTemplate } from '@/lib/notifications';
import {
  clearOnboardingData,
  updateOnboardingStatus,
} from '@/lib/patient/onboarding';
import { getPatientProfileByUserId } from '@/lib/patient/profile';
import { Role } from '@prisma/client';

/**
 * POST handler for completing onboarding
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ========================================================================
    // 1. Verify authentication — require PATIENT role
    // ========================================================================
    const auth = await requireRole(request, [Role.PATIENT]);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const userId = auth.user.userId;

    // ========================================================================
    // 2. Verify patient profile exists
    // ========================================================================
    const profile = await getPatientProfileByUserId(userId);

    if (!profile) {
      return NextResponse.json(
        { error: 'Patient profile not found. Please complete payment first.' },
        { status: 404 }
      );
    }

    // ========================================================================
    // 3. Update onboarding status
    // ========================================================================
    await updateOnboardingStatus(userId, 'COMPLETED');

    // ========================================================================
    // 4. Clear temporary onboarding data
    // ========================================================================
    await clearOnboardingData(userId);

    // ========================================================================
    // 5. Send intake submitted confirmation email
    // ========================================================================
    await notificationQueue.add({
      type: 'email',
      priority: 'normal',
      payload: {
        to: auth.user.email,
        template: EmailTemplate.INTAKE_SUBMITTED,
        data: {
          firstName: profile.firstName,
          dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
        },
      },
    });

    // ========================================================================
    // 6. Audit log
    // ========================================================================
    await auditLogger.logPHIAccess(
      'UPDATE',
      userId,
      auth.user.role,
      PHIResourceType.PATIENT_PROFILE,
      profile.id,
      {
        ipAddress: getClientIP(request),
        userAgent: request.headers.get('user-agent') || '',
        requestId: crypto.randomUUID(),
      },
      {
        accessReason: 'Onboarding completed - intake submitted',
      }
    );

    // ========================================================================
    // 7. Return success
    // ========================================================================
    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
      redirectUrl: '/dashboard',
    });

  } catch (error) {
    console.error('[Onboarding Complete] Error:', error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
