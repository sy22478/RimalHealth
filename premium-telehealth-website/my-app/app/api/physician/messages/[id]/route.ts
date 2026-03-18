/**
 * GET /api/physician/messages/[id]
 * 
 * Returns full message thread with all messages.
 * Marks unread messages as read on access.
 * 
 * HIPAA Compliance:
 * - Requires PHYSICIAN role
 * - Can only access threads where they are the recipient
 * - All PHI access is audit logged
 * - Messages marked as read with timestamp
 */

import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireRole, AuthenticatedRequest, getClientIp, getUserAgent } from '@/lib/auth/require-auth';
import { auditLogger } from '@/lib/audit/index';
import { AuditEventType, PHIResourceType } from '@/lib/audit/types';
import { getThreadMessages, markThreadAsRead } from '@/lib/physician/messaging';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET handler for thread details
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
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

  const { id: threadId } = await params;

  try {
    // Get thread messages
    const thread = await getThreadMessages(threadId, user.userId);

    if (!thread) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      );
    }

    // Verify physician has access to this thread
    // Thread is accessible if physician is recipient of any message
    const hasAccess = thread.messages.some(
      msg => msg.recipientId === user.userId || 
             (msg.senderId === user.userId && msg.senderType === 'PHYSICIAN')
    );

    if (!hasAccess && user.role !== Role.ADMIN) {
      // Audit log - unauthorized access attempt
      await auditLogger.log({
        eventType: AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
        userId: user.userId,
        userRole: user.role,
        action: 'Attempted to access unauthorized thread',
        ipAddress,
        userAgent,
        resourceType: PHIResourceType.MESSAGE,
        resourceId: threadId,
        success: false,
        metadata: { requestId },
      });

      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Mark unread messages as read
    const readCount = await markThreadAsRead(threadId, user.userId);

    // Audit log - viewing thread messages
    await auditLogger.logPHIAccess(
      'VIEW',
      user.userId,
      user.role,
      PHIResourceType.MESSAGE,
      threadId,
      { ipAddress, userAgent, requestId },
      { 
        accessReason: 'View message thread',
        recordCount: thread.messages.length,
      }
    );

    return NextResponse.json({ thread });

  } catch (error) {
    console.error('Error fetching thread:', error);

    // Log error
    await auditLogger.log({
      eventType: AuditEventType.API_ERROR,
      userId: user.userId,
      userRole: user.role,
      action: 'Failed to fetch message thread',
      ipAddress,
      userAgent,
      resourceType: PHIResourceType.MESSAGE,
      resourceId: threadId,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to fetch thread' },
      { status: 500 }
    );
  }
}
