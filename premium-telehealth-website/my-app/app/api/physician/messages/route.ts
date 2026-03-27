/**
 * GET /api/physician/messages
 * POST /api/physician/messages
 * Physician messaging endpoints
 * 
 * HIPAA Compliance:
 * - Requires PHYSICIAN or ADMIN role
 * - Logs message access
 * - Notifies patients of new messages
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { NotificationService } from '@/lib/services/notification-service';
import {
  sendPhysicianMessageSchema,
  physicianMessagesQuerySchema,
} from '@/lib/validation/schemas';
import { Role, SenderType, MessageStatus } from '@prisma/client';
import { PHIResourceType } from '@/lib/audit/index';

// ============================================================================
// GET - List Messages/Threads
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Require physician or admin role
  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
  
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const auditContext = AuditService.createAuditContext(
    request,
    userId,
    auth.user.role
  );

  try {
    // Validate query params
    const validation = await ValidationService.validateQueryParams(
      request,
      physicianMessagesQuerySchema
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

    const { patientId, threadId, limit, offset } = validation.data!;

    // If threadId provided, get messages in thread
    if (threadId) {
      const messages = await prisma.message.findMany({
        where: { threadId },
        orderBy: { sentAt: 'asc' },
        take: limit,
        skip: offset,
      });

      // Get patient and physician details for names
      const patientProfile = patientId
        ? await prisma.patientProfile.findUnique({
            where: { userId: patientId },
            select: { firstName: true, lastName: true },
          })
        : null;

      const physicianProfile = await prisma.physician.findUnique({
        where: { userId },
        select: { firstName: true, lastName: true },
      });

      // Patient profile fields are auto-decrypted by Prisma encryption extension
      const patientName = patientProfile
        ? `${patientProfile.firstName} ${patientProfile.lastName}`
        : 'Patient';

      const physicianName = physicianProfile
        ? `Dr. ${physicianProfile.lastName}`
        : 'Physician';

      // Format messages with sender names
      const formattedMessages = messages.map((msg) => ({
        id: msg.id,
        threadId: msg.threadId,
        body: msg.body,
        subject: msg.subject,
        senderType: msg.senderType,
        senderName:
          msg.senderType === 'PHYSICIAN'
            ? physicianName
            : msg.senderType === 'PATIENT'
            ? patientName
            : 'System',
        senderId: msg.senderId,
        recipientId: msg.recipientId,
        sentAt: msg.sentAt.toISOString(),
        readAt: msg.readAt?.toISOString(),
        status: msg.status,
      }));

      // Mark messages as read
      await prisma.message.updateMany({
        where: {
          threadId,
          recipientId: userId,
          readAt: null,
        },
        data: {
          readAt: new Date(),
          status: MessageStatus.READ,
        },
      });

      // Log access
      await AuditService.logMessageAccess(
        userId,
        auth.user.role,
        threadId,
        'VIEW',
        auditContext
      );

      return NextResponse.json({
        messages: formattedMessages,
        threadId,
      });
    }

    // Otherwise, get list of threads with unread counts
    // Get all messages where physician is sender or recipient
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      orderBy: { sentAt: 'desc' },
      take: 200,
    });

    // Group by thread
    const threadsMap = new Map<
      string,
      {
        threadId: string;
        patientId: string;
        lastMessage: {
          body: string;
          sentAt: string;
          senderType: string;
        };
        unreadCount: number;
        totalMessages: number;
      }
    >();

    for (const msg of messages) {
      if (!threadsMap.has(msg.threadId)) {
        // Determine patient ID from thread
        const patientIdInThread =
          msg.senderType === 'PATIENT' ? msg.senderId : msg.recipientId;

        threadsMap.set(msg.threadId, {
          threadId: msg.threadId,
          patientId: patientIdInThread,
          lastMessage: {
            body: msg.body,
            sentAt: msg.sentAt.toISOString(),
            senderType: msg.senderType,
          },
          unreadCount: msg.recipientId === userId && !msg.readAt ? 1 : 0,
          totalMessages: 1,
        });
      } else {
        const thread = threadsMap.get(msg.threadId)!;
        thread.totalMessages++;
        if (msg.recipientId === userId && !msg.readAt) {
          thread.unreadCount++;
        }
      }
    }

    // Batch-load all patient profiles in one query (avoids N+1)
    const threadValues = Array.from(threadsMap.values());
    const uniquePatientIds = [...new Set(threadValues.map(t => t.patientId))];

    const patientProfiles = await prisma.patientProfile.findMany({
      where: { userId: { in: uniquePatientIds } },
      select: { userId: true, firstName: true, lastName: true },
    });

    // Build lookup map (profiles are auto-decrypted by Prisma encryption extension)
    const profileMap = new Map(
      patientProfiles.map(p => [p.userId, p])
    );

    // Build thread responses using the lookup map
    const threads = threadValues.map((thread) => {
      const profile = profileMap.get(thread.patientId);

      return {
        ...thread,
        patientName: profile
          ? `${profile.firstName} ${profile.lastName}`
          : 'Unknown Patient',
      };
    });

    // Log access
    await AuditService.logPHIAccess(
      'VIEW',
      userId,
      auth.user.role,
      PHIResourceType.MESSAGE,
      'thread-list',
      auditContext,
      { recordCount: threads.length }
    );

    return NextResponse.json({ threads, limit, offset });
  } catch (error) {
    console.error('Get messages error:', error instanceof Error ? error.message : 'Unknown error');
    
    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/physician/messages',
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
  // Require physician or admin role
  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
  
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;
  const auditContext = AuditService.createAuditContext(
    request,
    userId,
    auth.user.role
  );

  try {
    // Validate request body
    const validation = await ValidationService.validateRequestBody(
      request,
      sendPhysicianMessageSchema
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

    const { patientId, threadId, body, subject } = validation.data!;

    // Create message
    const message = await prisma.message.create({
      data: {
        threadId,
        body,
        subject,
        senderType: SenderType.PHYSICIAN,
        senderId: userId,
        recipientId: patientId,
        status: MessageStatus.SENT,
      },
    });

    // Log message creation
    await AuditService.logMessageAccess(
      userId,
      auth.user.role,
      threadId,
      'CREATE',
      auditContext
    );

    // Notify patient
    await NotificationService.notifyNewMessage(patientId, threadId);

    return NextResponse.json(
      {
        success: true,
        message: {
          id: message.id,
          threadId: message.threadId,
          body: message.body,
          sentAt: message.sentAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Send message error:', error instanceof Error ? error.message : 'Unknown error');
    
    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/physician/messages',
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to send message', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
