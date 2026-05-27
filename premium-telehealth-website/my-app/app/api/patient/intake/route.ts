/**
 * POST /api/patient/intake
 * Create a new intake draft
 *
 * HIPAA Compliance:
 * - Validates patient authentication
 * - Logs intake creation
 * - Creates encrypted draft record
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { createIntakeSchema } from '@/lib/validation/schemas';
import { Role, IntakeStatus, PaymentStatus, Prisma } from '@prisma/client';
import { calculateAge } from '@/lib/utils/date-helpers';
import { resolveProductId } from '@/lib/products/product';

// ============================================================================
// POST - Create Intake Draft
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PATIENT]);

  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const auditContext = AuditService.createAuditContext(request, userId, 'PATIENT');

  try {
    const validation = await ValidationService.validateRequestBody(
      request,
      createIntakeSchema
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

    const { primaryConcern, formData } = validation.data!;

    // Resolve which treatment this intake belongs to. Defaults to the AUD
    // product when no slug is given, so the existing AUD flow is unchanged.
    // Resolves to null on un-migrated databases (behavior-neutral).
    const productSlug = request.nextUrl.searchParams.get('product');
    const productId = await resolveProductId(productSlug);

    // Reject minors before the draft is stored — prevents a minor from entering
    // SUD and medical PHI into the 33-question form before /submit rejects them.
    if (formData && typeof formData === 'object') {
      const fd = formData as Record<string, unknown>;
      const dob = typeof fd.dateOfBirth === 'string' && fd.dateOfBirth.length > 0
        ? fd.dateOfBirth
        : null;
      if (dob) {
        const age = calculateAge(dob);
        if (age !== null && age < 18) {
          return NextResponse.json(
            {
              error: 'You must be 18 or older to use this service.',
              code: 'AGE_REQUIREMENT_NOT_MET',
            },
            { status: 403 }
          );
        }
      }
    }

    // Check + create atomically inside a transaction to prevent race conditions
    // (concurrent requests from multiple tabs creating duplicate intakes)
    const result = await prisma.$transaction(async (tx) => {
      const existingIntake = await tx.intake.findFirst({
        where: {
          patientId: userId,
          status: {
            in: [IntakeStatus.DRAFT, IntakeStatus.SUBMITTED, IntakeStatus.UNDER_REVIEW],
          },
          // Per-(patient, product) gate: an active intake for one treatment
          // doesn't block starting an intake for a different treatment.
          productId,
        },
      });

      if (existingIntake) {
        if (existingIntake.status === IntakeStatus.DRAFT) {
          const updated = await tx.intake.update({
            where: { id: existingIntake.id },
            data: { formData: (formData ?? {}) as Prisma.InputJsonValue },
          });

          await tx.patientProfile.update({
            where: { userId },
            data: { primaryConcern },
          });

          return { type: 'updated' as const, intake: updated };
        }

        // SUBMITTED or UNDER_REVIEW — can't create a new one
        return { type: 'conflict' as const, intakeId: existingIntake.id };
      }

      // formData is auto-encrypted by the Prisma encryption extension
      const newIntake = await tx.intake.create({
        data: {
          patientId: userId,
          status: IntakeStatus.DRAFT,
          formData: (formData ?? {}) as Prisma.InputJsonValue,
          paymentStatus: PaymentStatus.PENDING,
          productId,
        },
      });

      await tx.patientProfile.update({
        where: { userId },
        data: { primaryConcern },
      });

      return { type: 'created' as const, intake: newIntake };
    });

    if (result.type === 'updated') {
      return NextResponse.json({
        success: true,
        intake: {
          id: result.intake.id,
          status: result.intake.status,
          createdAt: result.intake.createdAt.toISOString(),
        },
      });
    }

    if (result.type === 'conflict') {
      return NextResponse.json(
        {
          error: 'Active intake already exists',
          code: 'ACTIVE_INTAKE_EXISTS',
          intakeId: result.intakeId,
        },
        { status: 409 }
      );
    }

    const intake = result.intake;

    await AuditService.logIntakeAccess(userId, 'PATIENT', intake.id, 'CREATE', auditContext);

    // Note: physician notification happens on intake SUBMIT, not draft creation
    // (see /api/patient/intake/[id]/submit/route.ts)

    return NextResponse.json(
      {
        success: true,
        intake: {
          id: intake.id,
          status: intake.status,
          createdAt: intake.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create intake error:', error instanceof Error ? error.message : 'Unknown error');

    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/patient/intake',
      auditContext,
      userId
    );

    return NextResponse.json(
      {
        error: 'Failed to create intake',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
