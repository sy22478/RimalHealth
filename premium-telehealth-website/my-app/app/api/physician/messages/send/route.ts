/**
 * POST /api/physician/messages/send
 * 
 * Sends a reply message to a patient.
 * Creates new message and updates thread.
 * 
 * HIPAA Compliance:
 * - Requires PHYSICIAN role
 * - Body is encrypted before storage
 * - All sends are audit logged
 * - Validates recipient is a patient
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireRole, AuthenticatedRequest, getClientIp, getUserAgent } from '@/lib/auth/require-auth';
import { auditLogger } from '@/lib/audit/index';
import { AuditEventType, PHIResourceType } from '@/lib/audit/types';
import { sendMessageToPatient } from '@/lib/physician/messaging';

/**
 * Send message validation schema
 */
const sendMessageSchema = z.object({
  threadId: z.string().uuid('Invalid thread ID'),
  patientId: z.string().uuid('Invalid patient ID'),
  body: z.string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message too long (max 2000 characters)'),
  subject: z.string().max(200, 'Subject too long').optional(),
});

type SendMessageInput = z.infer<typeof sendMessageSchema>;

/**
 * POST handler for sending messages
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  // Require PHYSICIAN role
  const authResult = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult as AuthenticatedRequest;
  const ipAddress = getClientIp(request);
  const userAgent = getUserAgent(request);
  const requestId = crypto.randomUUID();

  try {
    // Parse and validate request body
    const body = await request.json();
    const validation = sendMessageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validation.error.flatten().fieldErrors 
        },
        { status: 400 }
      );
    }

    const data: SendMessageInput = validation.data;

    // Verify patient exists
    const patient = await prisma.user.findFirst({
      where: {
        id: data.patientId,
        role: Role.PATIENT,
      },
      include: {
        patientProfile: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!patient) {
      return NextResponse.json(
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    // Get physician details
    const physician = await prisma.physician.findUnique({
      where: { userId: user.userId },
      select: {
        firstName: true,
        lastName: true,
      },
    });

    const senderName = physician 
      ? `Dr. ${physician.lastName}`
      : 'Physician';

    // Send the message
    const message = await sendMessageToPatient({
      threadId: data.threadId,
      senderId: user.userId,
      recipientId: data.patientId,
      body: data.body,
      subject: data.subject,
      senderName,
    });

    // Audit log - sending message
    await auditLogger.logPHIAccess(
      'CREATE',
      user.userId,
      user.role,
      PHIResourceType.MESSAGE,
      message.id,
      { ipAddress, userAgent, requestId },
      { 
        accessReason: `Send reply to patient ${data.patientId} in thread ${data.threadId}`,
      }
    );

    // Create notification for patient
    await prisma.notification.create({
      data: {
        userId: data.patientId,
        type: 'MESSAGE_RECEIVED',
        title: 'New message from your physician',
        message: `Dr. ${physician?.lastName ?? 'Physician'} sent you a message`,
        actionUrl: `/patient/messages?thread=${data.threadId}`,
      },
    });

    return NextResponse.json({ 
      success: true,
      message: {
        id: message.id,
        threadId: message.threadId,
        body: message.body,
        senderType: message.senderType,
        senderId: message.senderId,
        senderName,
        sentAt: message.sentAt.toISOString(),
        readAt: null,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Error sending message:', error instanceof Error ? error.message : 'Unknown error');

    // Log error
    await auditLogger.log({
      eventType: AuditEventType.API_ERROR,
      userId: user.userId,
      userRole: user.role,
      action: 'Failed to send message',
      ipAddress,
      userAgent,
      resourceType: PHIResourceType.MESSAGE,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      metadata: { requestId },
    });

    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
