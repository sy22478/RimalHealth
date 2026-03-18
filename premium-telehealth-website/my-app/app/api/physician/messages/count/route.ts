/**
 * GET /api/physician/messages/count
 * Lightweight endpoint returning only the unread message count.
 * Designed for frequent polling (every 30-60 seconds) by the navigation badge.
 *
 * HIPAA Compliance:
 * - Requires PHYSICIAN or ADMIN role
 * - Returns only a numeric count, no PHI
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PHYSICIAN, Role.ADMIN]);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const userId = auth.user.userId;

    const unreadCount = await prisma.message.count({
      where: {
        recipientId: userId,
        readAt: null,
      },
    });

    return NextResponse.json({ unreadCount });
  } catch (error) {
    console.error('Unread message count error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unread count', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
