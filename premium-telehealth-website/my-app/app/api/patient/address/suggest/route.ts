/**
 * POST /api/patient/address/suggest
 * Typeahead address suggestions via Amazon Location Service.
 * Returns up to 5 California-filtered suggestions for a partial query.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { getSuggestions } from '@/lib/integrations/location';
import { rateLimit } from '@/lib/middleware/rate-limit';

const suggestSchema = z.object({
  query: z.string().min(1, { message: 'Query is required' }).max(200),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  // Cap geocoder calls at 20 per minute per user so a single patient can't
  // burn the shared Amazon Location Service quota.
  const rl = await rateLimit(`address-suggest:${auth.user.userId}`, {
    requests: 20,
    windowMs: 60 * 1000,
    keyPrefix: 'ratelimit:address-suggest',
    useMemoryFallback: true,
  });
  if (!rl.success) {
    return NextResponse.json(
      {
        error: 'Too many address lookups. Please wait before trying again.',
        code: 'RATE_LIMITED',
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.retryAfter ?? 60),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': String(rl.remaining),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const parsed = suggestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Short queries return an empty list without calling out to AWS.
    if (parsed.data.query.trim().length < 3) {
      return NextResponse.json({ suggestions: [] });
    }

    const result = await getSuggestions(parsed.data.query);

    // Distinguish "no results" (200, empty array) from "service broken" (502).
    // When getSuggestions returns an error, the upstream AWS call failed —
    // typically because the ECS task role is missing geo:SearchPlaceIndexForSuggestions
    // or geo:GetPlace permissions. Surface that as 502 so the UI can render
    // an "unavailable" message instead of "no matches".
    if (result.error) {
      return NextResponse.json(
        { suggestions: [], error: 'Address service temporarily unavailable' },
        { status: 502 }
      );
    }

    return NextResponse.json({ suggestions: result.suggestions });
  } catch (error) {
    console.error(
      'Address suggest route error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return NextResponse.json(
      { error: 'Address suggestions failed', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
