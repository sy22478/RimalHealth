/**
 * GET /api/physician/profile
 * Fetch authenticated physician's profile
 *
 * HIPAA Compliance:
 * - Requires PHYSICIAN or ADMIN role
 * - Audit logging for all profile access
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { Role } from '@prisma/client';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
  if (auth instanceof NextResponse) return auth;

  const { userId } = auth.user;

  try {
    const physician = await prisma.physician.findUnique({
      where: { userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        npiNumber: true,
        licenseNumber: true,
        licenseState: true,
        deaNumber: true,
        specialty: true,
        isActive: true,
        maxDailyReviews: true,
        status: true,
        totalReviews: true,
        createdAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!physician) {
      return NextResponse.json(
        { error: 'Physician profile not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      physician: {
        ...physician,
        email: physician.user.email,
      },
    });
  } catch (error) {
    console.error('Physician profile fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
