/**
 * POST /api/physician/prescriptions/[id]/refill/[requestId]
 * Physician approves or denies a pending refill request.
 *
 * Physician-in-the-loop: refills are NEVER auto-approved. For GLP-1
 * (weight-management) prescriptions the lab gate is RE-CHECKED server-side at
 * approval time — a stale client cannot bypass it. Refill dates are updated only
 * on approval.
 *
 * HIPAA / 42 CFR Part 2:
 * - Requires PHYSICIAN role + CSRF.
 * - Audit-logged with prescription ID only (no PHI).
 * - Patient notified (no PHI in notification).
 *
 * @module app/api/physician/prescriptions/[id]/refill/[requestId]
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireRole } from '@/lib/auth/require-auth';
import { AuditService } from '@/lib/services/audit-service';
import { NotificationService } from '@/lib/services/notification-service';
import { requireCSRF } from '@/lib/security/csrf';
import { getLabGateStatus } from '@/lib/titration/lab-gate';
import { computeSupplyEnd, computeNextRefillAvailable } from '@/lib/titration/engine';
import { Role, RefillStatus } from '@prisma/client';

const paramsSchema = z.object({
  id: z.string().uuid('Invalid prescription ID'),
  requestId: z.string().uuid('Invalid refill request ID'),
});

const bodySchema = z.object({
  decision: z.enum(['APPROVE', 'DENY'], {
    message: 'decision must be APPROVE or DENY',
  }),
  notes: z.string().max(2000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
): Promise<NextResponse> {
  // CSRF guard before any state change
  const csrfError = requireCSRF(request);
  if (csrfError) return csrfError;

  const auth = await requireRole(request, [Role.PHYSICIAN]);
  if (auth instanceof NextResponse) return auth;

  const { userId } = auth.user;
  const auditContext = AuditService.createAuditContext(request, userId, auth.user.role);

  try {
    const pathParams = await params;
    const paramsValidation = paramsSchema.safeParse(pathParams);
    if (!paramsValidation.success) {
      return NextResponse.json(
        { error: 'Invalid path parameters', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }
    const { id: prescriptionId, requestId } = paramsValidation.data;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }
    const bodyValidation = bodySchema.safeParse(body);
    if (!bodyValidation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: bodyValidation.error.issues,
        },
        { status: 400 }
      );
    }
    const { decision } = bodyValidation.data;

    // Load the refill request together with its prescription (+ product concern).
    const refillRequest = await prisma.refillRequest.findUnique({
      where: { id: requestId },
      include: {
        prescription: {
          select: {
            id: true,
            patientId: true,
            quantity: true,
            refills: true,
            refillsRemaining: true,
            status: true,
            supplyEndDate: true,
            product: { select: { concernType: true } },
          },
        },
      },
    });

    if (!refillRequest || refillRequest.prescriptionId !== prescriptionId) {
      return NextResponse.json(
        { error: 'Refill request not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    if (refillRequest.status !== RefillStatus.PENDING) {
      return NextResponse.json(
        {
          error: 'Only pending refill requests can be acted on',
          code: 'NOT_PENDING',
          status: refillRequest.status,
        },
        { status: 409 }
      );
    }

    const prescription = refillRequest.prescription;
    const patientId = prescription.patientId;
    const isGlp1 = prescription.product?.concernType === 'WEIGHT_MANAGEMENT';

    // ---- DENY ----
    if (decision === 'DENY') {
      await prisma.refillRequest.update({
        where: { id: requestId },
        data: { status: RefillStatus.DENIED, respondedAt: new Date() },
      });
      await AuditService.logPrescriptionAccess(
        userId,
        auth.user.role,
        prescriptionId,
        'UPDATE',
        auditContext
      );
      return NextResponse.json({ success: true, status: RefillStatus.DENIED });
    }

    // ---- APPROVE ----
    if (prescription.refillsRemaining <= 0) {
      return NextResponse.json(
        { error: 'No refills remaining on this prescription', code: 'NO_REFILLS' },
        { status: 409 }
      );
    }

    // Re-check the GLP-1 lab gate server-side — never trust an earlier client check.
    if (isGlp1) {
      const gate = await getLabGateStatus(patientId);
      if (!gate.gatePassed) {
        return NextResponse.json(
          {
            error:
              'A recent lab result is required before approving this GLP-1 refill.',
            code: 'LAB_REQUIRED',
          },
          { status: 409 }
        );
      }
    }

    const now = new Date();
    // Days supply: GLP-1 pens are weekly (1 pen = 7 days); daily meds = quantity days.
    const daysSupply = isGlp1 ? prescription.quantity * 7 : prescription.quantity;
    const supplyEnd = computeSupplyEnd({ durationDays: daysSupply }, now);
    const nextRefillAvailable = computeNextRefillAvailable(supplyEnd);

    await prisma.$transaction([
      prisma.refillRequest.update({
        where: { id: requestId },
        data: { status: RefillStatus.APPROVED, respondedAt: now },
      }),
      prisma.prescription.update({
        where: { id: prescriptionId },
        data: {
          refillsRemaining: Math.max(0, prescription.refillsRemaining - 1),
          lastRefillDate: now,
          nextRefillAvailable,
          // Only weight-management prescriptions track a supply window.
          ...(isGlp1 ? { supplyEndDate: supplyEnd } : {}),
        },
      }),
    ]);

    await AuditService.logPrescriptionAccess(
      userId,
      auth.user.role,
      prescriptionId,
      'UPDATE',
      auditContext
    );

    // Notify patient — graceful degradation: don't fail if notification errors.
    try {
      await NotificationService.notifyRefillApproved(patientId, prescriptionId);
    } catch (notifyError) {
      console.error(
        'Failed to notify patient of refill approval:',
        notifyError instanceof Error ? notifyError.message : 'Unknown error'
      );
    }

    return NextResponse.json({
      success: true,
      status: RefillStatus.APPROVED,
      nextRefillAvailable: nextRefillAvailable.toISOString(),
    });
  } catch (error) {
    console.error(
      'Refill approval error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return NextResponse.json(
      { error: 'Failed to process refill request', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
