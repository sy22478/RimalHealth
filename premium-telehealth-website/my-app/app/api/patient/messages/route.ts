/**
 * GET /api/patient/messages
 * POST /api/patient/messages
 * Patient messaging endpoints
 * 
 * HIPAA Compliance:
 * - Returns only messages in patient's threads
 * - Encrypts message content
 * - Logs all message access
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { NotificationService } from '@/lib/services/notification-service';
import { sendMessageSchema, getMessagesQuerySchema } from '@/lib/validation/schemas';
import { Role, SenderType } from '@prisma/client';
import { PHIResourceType } from '@/lib/audit/index';
import {
  getPatientMessagingThreads,
  getPatientThreadMessages,
  sendMessageToPhysician,
  markThreadAsReadForPatient,
} from '@/lib/patient/messaging';

// ============================================================================
// GET - List Messages/Threads
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Require patient role
  const auth = await requireRole(request, [Role.PATIENT]);
  
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const auditContext = AuditService.createAuditContext(request, userId, 'PATIENT');

  try {
    // Validate query params
    const validation = await ValidationService.validateQueryParams(
      request,
      getMessagesQuerySchema
    );

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    const { threadId, limit, offset } = validation.data!;

    // If threadId provided, get messages in thread
    if (threadId) {
      // Verify thread access
      const hasAccess = threadId.includes(userId);
      if (!hasAccess) {
        await AuditService.logUnauthorizedAccess(
          userId,
          `/api/patient/messages?threadId=${threadId}`,
          auditContext,
          'Thread does not belong to patient'
        );
        return NextResponse.json(
          { error: 'Access denied', code: 'ACCESS_DENIED' },
          { status: 403 }
        );
      }

      const thread = await getPatientThreadMessages(threadId, userId);

      if (!thread) {
        return NextResponse.json(
          { error: 'Thread not found', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }

      // Mark messages as read
      await markThreadAsReadForPatient(threadId, userId);

      // Log access
      await AuditService.logMessageAccess(userId, 'PATIENT', threadId, 'VIEW', auditContext);

      return NextResponse.json({ thread });
    }

    // Otherwise, get list of threads
    const threads = await getPatientMessagingThreads(userId);

    // Log access
    await AuditService.logPHIAccess(
      'VIEW',
      userId,
      'PATIENT',
      PHIResourceType.MESSAGE,
      'thread-list',
      auditContext,
      { recordCount: threads.length }
    );

    return NextResponse.json({ threads, limit, offset });
  } catch (error) {
    console.error('Get messages error:', error);
    
    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/patient/messages',
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to retrieve messages', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Send Message
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Require patient role
  const auth = await requireRole(request, [Role.PATIENT]);
  
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const auditContext = AuditService.createAuditContext(request, userId, 'PATIENT');

  try {
    // Validate request body
    const validation = await ValidationService.validateRequestBody(
      request,
      sendMessageSchema
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

    const { threadId, body, subject } = validation.data!;

    // Verify thread access
    const hasAccess = threadId.includes(userId);
    if (!hasAccess) {
      await AuditService.logUnauthorizedAccess(
        userId,
        '/api/patient/messages',
        auditContext,
        'Thread does not belong to patient'
      );
      return NextResponse.json(
        { error: 'Access denied', code: 'ACCESS_DENIED' },
        { status: 403 }
      );
    }

    // Get physician ID from thread ID (format: thread-{patientUUID}-{physicianUUID})
    // Can't use split('-') since UUIDs contain hyphens — strip the known prefix
    const physicianId = threadId.replace(`thread-${userId}-`, '');

    if (!physicianId || physicianId === threadId) {
      return NextResponse.json(
        { error: 'Invalid thread ID', code: 'INVALID_THREAD' },
        { status: 400 }
      );
    }

    // Get patient profile for name
    const profile = await prisma.patientProfile.findUnique({
      where: { userId },
      select: { firstName: true, lastName: true },
    });

    const patientName = profile
      ? `${profile.firstName} ${profile.lastName}`
      : 'Patient';

    // Send message
    const message = await sendMessageToPhysician({
      threadId,
      patientId: userId,
      recipientId: physicianId,
      body,
      subject,
      patientName,
    });

    // Non-critical: audit + notification (don't block response)
    AuditService.logMessageAccess(userId, 'PATIENT', threadId, 'CREATE', auditContext).catch(() => {});
    NotificationService.notifyPhysicianNewMessage(physicianId, userId, threadId).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        message: {
          id: message.id,
          threadId: message.threadId,
          body,
          sentAt: message.sentAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Send message error:', error);
    
    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/patient/messages',
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to send message', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
