/**
 * POST /api/patient/address/validate
 * Validate a patient address using Amazon Location Service.
 * Returns validation result with suggested corrections.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/require-auth';
import { validateAddress } from '@/lib/integrations/location';

const validateAddressSchema = z.object({
  street: z.string().min(1, { message: 'Street address is required' }),
  city: z.string().min(1, { message: 'City is required' }),
  state: z.string().min(1, { message: 'State is required' }),
  zip: z.string().min(1, { message: 'ZIP code is required' }),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = validateAddressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid address data', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await validateAddress(parsed.data);

    return NextResponse.json({
      valid: result.valid,
      suggestions: result.suggestions,
      error: result.error,
    });
  } catch (error) {
    console.error('Address validate route error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Address validation failed', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
