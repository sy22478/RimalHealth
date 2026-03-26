/**
 * GET /api/physician/queue
 * Get pending intake queue
 * 
 * HIPAA Compliance:
 * - Requires PHYSICIAN or ADMIN role
 * - Logs PHI access for queue viewing
 * - Returns decrypted patient names for queue display
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { AuditService } from '@/lib/services/audit-service';
import { ValidationService } from '@/lib/services/validation-service';
import { queueQuerySchema } from '@/lib/validation/schemas';
import { Role } from '@prisma/client';
import { getPendingIntakes, getQueueStats } from '@/lib/physician/queue';

// ============================================================================
// GET - Get Queue
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
      queueQuerySchema
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

    const filters = validation.data!;

    // Get queue items
    const queueItems = await getPendingIntakes(userId, auditContext, filters);

    // Get stats
    const stats = await getQueueStats(userId, auditContext);

    return NextResponse.json({
      queue: queueItems,
      stats,
      filters: {
        status: filters.status,
        concernType: filters.concernType,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      },
    });
  } catch (error) {
    console.error('Get queue error:', error instanceof Error ? error.message : 'Unknown error');
    
    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/physician/queue',
      auditContext,
      userId
    );

    return NextResponse.json(
      { error: 'Failed to retrieve queue', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
