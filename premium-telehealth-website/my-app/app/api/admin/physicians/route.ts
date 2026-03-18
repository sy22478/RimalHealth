/**
 * GET /api/admin/physicians
 * List physicians with filtering, search, and pagination
 * 
 * HIPAA Compliance:
 * - Requires ADMIN role
 * - Logs all access
 * - No PHI in responses
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { Role, PhysicianStatus } from '@prisma/client';
import { PHIResourceType, DataModificationAction } from '@/lib/audit/index';

// ============================================================================
// Validation Schema
// ============================================================================

const querySchema = z.object({
  status: z.enum(['PENDING', 'INVITED', 'ACTIVE', 'INACTIVE', 'ALL']).optional().default('ALL'),
  search: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
});

// ============================================================================
// GET - List Physicians
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Require ADMIN role
  const auth = await requireRole(request, [Role.ADMIN]);

  if (auth instanceof NextResponse) {
    return auth;
  }

  const { user } = auth;
  const auditContext = AuditService.createAuditContext(
    request,
    user.userId,
    user.role
  );

  try {
    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const rawParams = {
      status: searchParams.get('status') || 'ALL',
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
    };

    const validation = querySchema.safeParse(rawParams);

    if (!validation.success) {
      await AuditService.logApiError(
        new Error('Invalid query parameters'),
        '/api/admin/physicians',
        auditContext,
        user.userId
      );

      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          code: 'VALIDATION_ERROR',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { status, search, page, limit } = validation.data;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status !== 'ALL') {
      where.status = status as PhysicianStatus;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { npiNumber: { contains: search } },
        { licenseNumber: { contains: search } },
        {
          user: {
            email: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    // Get total count
    const total = await prisma.physician.count({ where });

    // Fetch physicians with pagination
    const physicians = await prisma.physician.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            emailVerified: true,
            createdAt: true,
            lastLoginAt: true,
          },
        },
        _count: {
          select: {
            reviews: true,
            notes: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    });

    // Format response
    const formattedPhysicians = physicians.map((physician) => ({
      id: physician.id,
      userId: physician.userId,
      email: physician.user.email,
      emailVerified: physician.user.emailVerified,
      firstName: physician.firstName,
      lastName: physician.lastName,
      npiNumber: physician.npiNumber,
      licenseNumber: physician.licenseNumber,
      deaNumber: physician.deaNumber,
      specialty: physician.specialty,
      status: physician.status,
      authorizedBy: physician.authorizedBy,
      authorizedAt: physician.authorizedAt?.toISOString() || null,
      secretKeyExpiry: physician.secretKeyExpiry?.toISOString() || null,
      secretKeyUsedAt: physician.secretKeyUsedAt?.toISOString() || null,
      isActive: physician.isActive,
      maxDailyReviews: physician.maxDailyReviews,
      totalReviews: physician.totalReviews,
      avgReviewTimeMin: physician.avgReviewTimeMin,
      stats: {
        reviewCount: physician._count.reviews,
        noteCount: physician._count.notes,
      },
      createdAt: physician.createdAt.toISOString(),
      updatedAt: physician.updatedAt.toISOString(),
      lastLoginAt: physician.user.lastLoginAt?.toISOString() || null,
    }));

    // Calculate pagination
    const totalPages = Math.ceil(total / limit);

    // Log access
    await AuditService.logPHIAccess(
      'VIEW',
      user.userId,
      user.role,
      PHIResourceType.PHYSICIAN_NOTE,
      'list',
      auditContext,
      { recordCount: physicians.length, filterStatus: status }
    );

    return NextResponse.json({
      physicians: formattedPhysicians,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('List physicians error:', error);

    await AuditService.logApiError(
      error instanceof Error ? error : new Error('Unknown error'),
      '/api/admin/physicians',
      auditContext,
      user.userId
    );

    return NextResponse.json(
      {
        error: 'Failed to list physicians',
        code: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
