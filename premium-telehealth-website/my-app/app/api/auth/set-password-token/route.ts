/**
 * POST /api/auth/set-password-token
 * Looks up the latest unused password reset token for a given email.
 * Used by the checkout success page to generate a direct set-password link.
 *
 * Rate limited to prevent enumeration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { rateLimit, rateLimitPresets } from '@/lib/middleware/rate-limit';

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateLimitResult = await rateLimit(clientIp, {
    requests: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
    keyPrefix: 'ratelimit:set-password-token',
  });
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const validation = schema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: validation.data.email.toLowerCase() },
      select: { id: true, emailVerified: true },
    });

    if (!user) {
      // Don't reveal whether email exists
      return NextResponse.json({ token: null });
    }

    // Only return token for users who haven't set their password yet
    if (user.emailVerified) {
      return NextResponse.json({ token: null });
    }

    const resetToken = await prisma.passwordReset.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: { token: true },
    });

    return NextResponse.json({ token: resetToken?.token || null });
  } catch (error) {
    console.error('[set-password-token] Error:', error);
    return NextResponse.json({ token: null });
  }
}
