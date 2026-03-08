/**
 * GET /api/physician/intake/[id]
 * Get intake details for review
 * 
 * HIPAA Compliance:
 * - Requires PHYSICIAN or ADMIN role
 * - Logs PHI access
 * - Returns decrypted intake data
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { Role, IntakeStatus } from '@prisma/client';
import { decryptPHI } from '@/lib/encryption/phi';

// ============================================================================
// GET - Get Intake for Review
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // Require physician or admin role
  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
  
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const { id: intakeId } = await params;
  const auditContext = AuditService.createAuditContext(
    request,
    userId,
    auth.user.role
  );

  try {
    // Validate UUID
    const uuidValidation = ValidationService.validateUUID(intakeId);
    if (!uuidValidation.success) {
      return NextResponse.json(
        { error: 'Invalid intake ID', code: 'INVALID_ID' },
        { status: 400 }
      );
    }

    // Get intake with patient profile
    const intake = await prisma.intake.findUnique({
      where: { id: intakeId },
      include: {
        patient: {
          include: {
            patientProfile: true,
          },
        },
        prescription: true,
      },
    });

    if (!intake) {
      return NextResponse.json(
        { error: 'Intake not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if intake is available for review
    if (
      intake.status !== IntakeStatus.SUBMITTED &&
      intake.status !== IntakeStatus.UNDER_REVIEW
    ) {
      return NextResponse.json(
        {
          error: 'Intake not available for review',
          code: 'INTAKE_NOT_AVAILABLE',
          status: intake.status,
        },
        { status: 409 }
      );
    }

    // Update status to UNDER_REVIEW if not already
    if (intake.status === IntakeStatus.SUBMITTED) {
      await prisma.intake.update({
        where: { id: intakeId },
        data: { status: IntakeStatus.UNDER_REVIEW },
      });
    }

    // Log access
    await AuditService.logIntakeAccess(
      userId,
      auth.user.role,
      intakeId,
      'VIEW',
      auditContext
    );

    // Decrypt form data
    let formData = {};
    try {
      if (intake.formData && typeof intake.formData === 'object') {
        const formDataStr = JSON.stringify(intake.formData);
        formData = JSON.parse(decryptPHI(formDataStr));
      }
    } catch (error) {
      console.error('Failed to decrypt form data:', error);
      formData = {};
    }

    // Decrypt patient profile
    const profile = intake.patient.patientProfile;
    const patientInfo = profile
      ? {
          firstName: decryptPHI(profile.firstName),
          lastName: decryptPHI(profile.lastName),
          dateOfBirth: decryptPHI(profile.dateOfBirth),
          phone: decryptPHI(profile.phone),
          email: intake.patient.email,
          address: {
            street: decryptPHI(profile.addressStreet),
            city: decryptPHI(profile.addressCity),
            state: profile.addressState,
            zip: decryptPHI(profile.addressZip),
          },
          primaryConcern: profile.primaryConcern,
          treatmentGoal: profile.treatmentGoal,
        }
      : null;

    // Parse medical history
    let medicalHistory = null;
    try {
      if (profile?.medicalHistory) {
        medicalHistory = JSON.parse(decryptPHI(JSON.stringify(profile.medicalHistory)));
      }
    } catch {
      medicalHistory = null;
    }

    return NextResponse.json({
      intake: {
        id: intake.id,
        status: IntakeStatus.UNDER_REVIEW,
        formData,
        patient: patientInfo,
        medicalHistory,
        riskScore: intake.riskScore,
        complexityScore: intake.complexityScore,
        submittedAt: intake.submittedAt?.toISOString(),
        createdAt: intake.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Get intake error:', error);
    
    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      `/api/physician/intake/${intakeId}`,
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to retrieve intake', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
