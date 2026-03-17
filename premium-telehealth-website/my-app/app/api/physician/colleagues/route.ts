/**
 * GET /api/physician/colleagues
 * Returns list of other physicians for physician-to-physician messaging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { Role } from '@prisma/client';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);

  if (auth instanceof NextResponse) {
    return auth;
  }

  const { userId } = auth.user;

  try {
    const physicians = await prisma.physician.findMany({
      where: {
        status: 'ACTIVE',
        userId: { not: userId },
      },
      select: {
        userId: true,
        firstName: true,
        lastName: true,
        specialty: true,
      },
    });

    return NextResponse.json({
      physicians: physicians.map((p) => ({
        id: p.userId,
        name: `Dr. ${p.firstName} ${p.lastName}`,
        specialty: p.specialty,
      })),
    });
  } catch (error) {
    console.error('Error fetching colleagues:', error);
    return NextResponse.json(
      { error: 'Failed to fetch colleagues' },
      { status: 500 }
    );
  }
}
