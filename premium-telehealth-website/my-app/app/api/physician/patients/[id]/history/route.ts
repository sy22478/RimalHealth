/**
 * Physician Patient History API
 * GET /api/physician/patients/[id]/history
 *
 * Returns comprehensive patient history for timeline view
 *
 * HIPAA Compliance:
 * - PHYSICIAN role required (via requireRole)
 * - All access is audit logged
 * - PHI encrypted at rest via Prisma extension
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { auditLogger, PHIResourceType, AuditEventType } from '@/lib/audit/index';
import { getClientIP } from '@/lib/audit/utils';
import { Role } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface HistoryEvent {
  type: 'intake' | 'prescription' | 'message' | 'note' | 'review' | 'refill';
  date: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Build comprehensive patient history using Prisma queries
 * (not $queryRaw, to ensure encryption extension decrypts PHI fields)
 */
async function buildPatientHistory(patientId: string): Promise<HistoryEvent[]> {
  const events: HistoryEvent[] = [];

  // Fetch all relevant data in parallel
  const [intakes, prescriptions, messages, notes, refillRequests] = await Promise.all([
    // Get intakes with review (singular relation)
    prisma.intake.findMany({
      where: { patientId },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        review: true,
      },
    }),
    // Get prescriptions
    prisma.prescription.findMany({
      where: { patientId },
      take: 50,
      orderBy: { createdAt: 'desc' },
    }),
    // Get messages (using recipientId or senderId)
    prisma.message.findMany({
      where: {
        OR: [
          { recipientId: patientId },
          { senderId: patientId },
        ],
      },
      take: 50,
      orderBy: { sentAt: 'desc' },
    }),
    // Get clinical notes via Prisma (not raw SQL) so encryption extension decrypts content
    prisma.physicianNote.findMany({
      where: { patientId },
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        physicianId: true,
        createdAt: true,
        physician: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }).catch((error) => {
      console.error('Physician notes query error:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }),
    // Get refill requests
    prisma.refillRequest.findMany({
      where: { patientId },
      take: 50,
      orderBy: { requestedAt: 'desc' },
      select: {
        id: true,
        prescriptionId: true,
        status: true,
        requestedAt: true,
      },
    }).catch((error) => {
      console.error('Refill requests query error:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }),
  ]);

  // Add intake events
  for (const intake of intakes) {
    events.push({
      type: 'intake',
      date: intake.createdAt.toISOString(),
      title: 'Intake Submitted',
      description: `Status: ${intake.status}`,
      metadata: {
        intakeId: intake.id,
        status: intake.status,
        complexityScore: intake.complexityScore,
      },
    });

    // Add review event for each intake (review is singular)
    if (intake.review) {
      const review = intake.review;
      events.push({
        type: 'review',
        date: review.assignedAt.toISOString(),
        title: 'Intake Reviewed',
        description: `Decision: ${review.decision || 'PENDING'}`,
        metadata: {
          reviewId: review.id,
          intakeId: intake.id,
          status: review.decision || 'PENDING',
          physicianId: review.physicianId,
        },
      });
    }
  }

  // Add prescription events
  for (const prescription of prescriptions) {
    events.push({
      type: 'prescription',
      date: prescription.createdAt.toISOString(),
      title: 'Prescription Sent',
      description: `${prescription.medicationName} ${prescription.dosage}`,
      metadata: {
        prescriptionId: prescription.id,
        status: prescription.status,
        medication: prescription.medicationName,
        dosage: prescription.dosage,
        pharmacy: prescription.pharmacyName,
        refillsRemaining: prescription.refillsRemaining,
      },
    });
  }

  // Add message events
  for (const message of messages) {
    events.push({
      type: 'message',
      date: message.sentAt.toISOString(),
      title: `Message ${message.senderType === 'PATIENT' ? 'from Patient' : 'from Physician'}`,
      description: message.subject || 'No subject',
      metadata: {
        messageId: message.id,
        senderType: message.senderType,
        subject: message.subject,
      },
    });
  }

  // Add clinical note events
  for (const note of notes) {
    events.push({
      type: 'note',
      date: note.createdAt.toISOString(),
      title: 'Clinical Note Added',
      description: `By Dr. ${note.physician.lastName}`,
      metadata: {
        noteId: note.id,
        physicianId: note.physicianId,
        physicianName: `${note.physician.firstName} ${note.physician.lastName}`,
      },
    });
  }

  // Add refill request events
  for (const refill of refillRequests) {
    events.push({
      type: 'refill',
      date: refill.requestedAt.toISOString(),
      title: 'Refill Request',
      description: `Status: ${refill.status}`,
      metadata: {
        refillId: refill.id,
        prescriptionId: refill.prescriptionId,
        status: refill.status,
      },
    });
  }

  // Sort by date descending
  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * GET /api/physician/patients/[id]/history
 * Get comprehensive patient history
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
  if (auth instanceof NextResponse) return auth;

  const { userId } = auth.user;
  const requestId = crypto.randomUUID();
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';

  try {
    const { id: patientId } = await context.params;

    // Audit log the access
    await auditLogger.logPHIAccess(
      'VIEW',
      userId,
      auth.user.role,
      PHIResourceType.PATIENT_PROFILE,
      patientId,
      { ipAddress, userAgent, requestId },
      { accessReason: 'View patient history/timeline' }
    );

    // Build history
    const history = await buildPatientHistory(patientId);

    return NextResponse.json({
      success: true,
      data: {
        patientId,
        totalEvents: history.length,
        events: history,
        summary: {
          intakes: history.filter(e => e.type === 'intake').length,
          prescriptions: history.filter(e => e.type === 'prescription').length,
          messages: history.filter(e => e.type === 'message').length,
          notes: history.filter(e => e.type === 'note').length,
          reviews: history.filter(e => e.type === 'review').length,
          refills: history.filter(e => e.type === 'refill').length,
        },
      },
    });

  } catch (error) {
    console.error('[Physician Patient History] Error:', error instanceof Error ? error.message : 'Unknown error');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
