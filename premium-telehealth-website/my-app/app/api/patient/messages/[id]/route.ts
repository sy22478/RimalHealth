/**
 * GET /api/patient/messages/[id]
 * 
 * Returns full message thread with all messages for a patient.
 * Marks unread messages as read on access.
 * 
 * HIPAA Compliance:
 * - Requires PATIENT role
 * - Can only access own threads
 * - All PHI access is audit logged
 * - Messages marked as read with timestamp
 */

import { NextRequest, NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { requireRole, AuthenticatedRequest, getClientIp, getUserAgent } from '@/lib/auth/require-auth';
import { auditLogger } from '@/lib/audit/index';
import { PHIResourceType, AuditEventType } from '@/lib/audit/types';
import { 
  getPatientThreadMessages, 
  markThreadAsReadForPatient,
  verifyThreadAccess 
} from '@/lib/patient/messaging';

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
  // Require PATIENT role
  const authResult = await requireRole(request, [Role.PATIENT]);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult as AuthenticatedRequest;
  const ipAddress = getClientIp(request);
  const userAgent = getUserAgent(request);

  const { id: threadId } = await params;

  try {
    // Verify patient has access to this thread
    const hasAccess = await verifyThreadAccess(threadId, user.userId);

    if (!hasAccess) {
      // Audit log - unauthorized access attempt
      await auditLogger.log({
        eventType: AuditEventType.USER_LOGIN_FAILED,
        userId: user.userId,
        userRole: user.role,
        action: 'Patient attempted to access unauthorized thread',
        ipAddress,
        userAgent,
        resourceType: PHIResourceType.MESSAGE,
        resourceId: threadId,
        success: false,
      });

      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get thread messages
    const thread = await getPatientThreadMessages(threadId, user.userId);

    if (!thread) {
      return NextResponse.json(
        { error: 'Thread not found' },
        { status: 404 }
      );
    }

    // Mark unread messages as read
    const readCount = await markThreadAsReadForPatient(threadId, user.userId);

    // Audit log - viewing thread messages
    await auditLogger.logPHIAccess(
      'VIEW',
      user.userId,
      user.role,
      PHIResourceType.MESSAGE,
      threadId,
      { ipAddress, userAgent, requestId: crypto.randomUUID() },
      { accessReason: 'Patient viewed message thread' }
    );

    return NextResponse.json({ thread });

  } catch (error) {
    console.error('Error fetching patient thread:', error);

    // Log error
    await auditLogger.log({
      eventType: AuditEventType.MESSAGE_VIEWED,
      userId: user.userId,
      userRole: user.role,
      action: 'Failed to fetch patient message thread',
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
