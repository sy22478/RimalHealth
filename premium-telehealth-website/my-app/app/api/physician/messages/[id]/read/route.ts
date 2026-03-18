/**
 * POST /api/physician/messages/[id]/read
 * 
 * Marks all messages in a thread as read for the physician.
 * 
 * HIPAA Compliance:
 * - Requires PHYSICIAN role
 * - Can only mark messages where they are the recipient
 * - Action is audit logged
 */

import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requireRole, AuthenticatedRequest, getClientIp, getUserAgent } from '@/lib/auth/require-auth';
import { auditLogger } from '@/lib/audit/index';
import { AuditEventType, PHIResourceType } from '@/lib/audit/types';
import { markThreadAsRead } from '@/lib/physician/messaging';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST handler for marking thread as read
 */
export async function POST(
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
    // Mark messages as read
    const readCount = await markThreadAsRead(threadId, user.userId);

    // Audit log - marking as read
    if (readCount > 0) {
      await auditLogger.logPHIAccess(
        'UPDATE',
        user.userId,
        user.role,
        PHIResourceType.MESSAGE,
        threadId,
        { ipAddress, userAgent, requestId },
        { 
          accessReason: 'Mark thread messages as read',
          recordCount: readCount,
        }
      );
    }

    return NextResponse.json({ 
      success: true,
      markedAsRead: readCount,
    });

  } catch (error) {
    console.error('Error marking thread as read:', error);

    // Log error
    await auditLogger.log({
      eventType: AuditEventType.API_ERROR,
      userId: user.userId,
      userRole: user.role,
      action: 'Failed to mark thread as read',
      ipAddress,
      userAgent,
      resourceType: PHIResourceType.MESSAGE,
      resourceId: threadId,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      metadata: { requestId },
    });

    return NextResponse.json(
      { error: 'Failed to mark messages as read' },
      { status: 500 }
    );
  }
}
