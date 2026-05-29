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

    // SECURITY: PasswordReset tokens are now stored hashed at rest (see
    // lib/auth/token-utils.ts), so the raw token is unrecoverable from the DB
    // and this endpoint can no longer hand back a usable set-password token.
    // The raw token is delivered only via the create-account / set-password
    // email link. This endpoint is unused (the checkout success page relies on
    // the webhook email) and is retained only for backward compatibility — it
    // now always returns null rather than exposing a stored token value.
    return NextResponse.json({ token: null });
  } catch (error) {
    console.error('[set-password-token] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ token: null });
  }
}
