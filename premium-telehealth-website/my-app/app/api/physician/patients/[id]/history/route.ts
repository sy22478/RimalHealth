/**
 * Physician Patient History API
 * GET /api/physician/patients/[id]/history
 * 
 * Returns comprehensive patient history for timeline view
 * 
 * HIPAA Compliance:
 * - PHYSICIAN role required
 * - All access is audit logged
 * - PHI encrypted at rest via Prisma extension
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db/prisma';
import { auditLogger, PHIResourceType, AuditEventType } from '@/lib/audit/index';
import { getClientIP } from '@/lib/audit/utils';

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
 * Verify physician access
 */
async function verifyPhysicianAccess(
  request: NextRequest
): Promise<{ authorized: boolean; userId?: string }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { authorized: false };
  }

  const token = authHeader.substring(7);
  
  try {
    const payload = await verifyAccessToken(token);
    
    if (payload.role !== 'PHYSICIAN' && payload.role !== 'ADMIN') {
      return { authorized: false };
    }

    return {
      authorized: true,
      userId: payload.userId,
    };
  } catch {
    return { authorized: false };
  }
}

/**
 * Build comprehensive patient history
 */
async function buildPatientHistory(patientId: string): Promise<HistoryEvent[]> {
  const events: HistoryEvent[] = [];

  // Fetch all relevant data in parallel
  const [intakes, prescriptions, messages, notes, refillRequests] = await Promise.all([
    // Get intakes with review (singular relation)
    prisma.intake.findMany({
      where: { patientId: patientId },
      orderBy: { createdAt: 'desc' },
      include: {
        review: true,
      },
    }),
    // Get prescriptions
    prisma.prescription.findMany({
      where: { patientId: patientId },
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
      orderBy: { sentAt: 'desc' },
    }),
    // Get clinical notes (using raw query to handle model extension issues)
    prisma.$queryRaw<Array<{
      id: string;
      patientId: string;
      physicianId: string;
      content: string;
      createdAt: Date;
      physicianFirstName: string;
      physicianLastName: string;
    }>>`
      SELECT 
        pn.id,
        pn.patient_id as "patientId",
        pn.physician_id as "physicianId",
        pn.content,
        pn.created_at as "createdAt",
        p.first_name as "physicianFirstName",
        p.last_name as "physicianLastName"
      FROM physician_notes pn
      JOIN physicians p ON p.id = pn.physician_id
      WHERE pn.patient_id = ${patientId}
      ORDER BY pn.created_at DESC
    `.catch(() => []),
    // Get refill requests (if model exists)
    prisma.$queryRaw<Array<{
      id: string;
      prescriptionId: string;
      status: string;
      createdAt: Date;
    }>>`
      SELECT id, prescription_id as "prescriptionId", status, created_at as "createdAt"
      FROM refill_requests
      WHERE patient_id = ${patientId}
      ORDER BY created_at DESC
    `.catch(() => []), // Gracefully handle if table doesn't exist yet
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
      description: `By Dr. ${note.physicianLastName}`,
      metadata: {
        noteId: note.id,
        physicianId: note.physicianId,
        physicianName: `${note.physicianFirstName} ${note.physicianLastName}`,
        contentLength: note.content.length,
      },
    });
  }

  // Add refill request events
  for (const refill of refillRequests) {
    events.push({
      type: 'refill',
      date: refill.createdAt.toISOString(),
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
  const requestId = crypto.randomUUID();
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';

  try {
    const { id: patientId } = await context.params;

    // Verify physician access
    const access = await verifyPhysicianAccess(request);
    
    if (!access.authorized || !access.userId) {
      await auditLogger.log({
        eventType: AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
        userId: access.userId || 'anonymous',
        action: 'Attempted to access patient history without authorization',
        ipAddress,
        userAgent,
        resourceType: 'PatientHistory',
        resourceId: patientId,
        success: false,
        metadata: { requestId },
      });

      return NextResponse.json(
        { error: 'Unauthorized. Physician access required.' },
        { status: 403 }
      );
    }

    // Audit log the access
    await auditLogger.logPHIAccess(
      'VIEW',
      access.userId,
      'PHYSICIAN',
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
