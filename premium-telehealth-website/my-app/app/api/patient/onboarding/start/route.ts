/**
 * POST /api/patient/onboarding/start
 * 
 * Stores checkout data temporarily during the payment process.
 * Called by the checkout form when user proceeds to payment.
 * 
 * Flow:
 * 1. Validate user is authenticated
 * 2. Validate checkout data
 * 3. Store in Redis (expires in 1 hour)
 * 4. Return success - frontend redirects to Stripe payment
 * 
 * HIPAA Compliance:
 * - PHI stored temporarily in Redis with TTL
 * - No PHI in logs
 * - User ID extracted from JWT (not from request body)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/require-auth';
import { storeCheckoutData, validateCheckoutData } from '@/lib/patient/onboarding';
import { ConcernType, TreatmentGoal, Role } from '@prisma/client';

// Validation schema for request body
const onboardingStartSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().regex(/^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/, 'Use MM/DD/YYYY format'),
  phone: z.string().regex(/^\+?1?\d{10,14}$/, 'Enter a valid phone number'),
  addressStreet: z.string().min(1, 'Street address is required'),
  addressCity: z.string().min(1, 'City is required'),
  addressState: z.literal('CA'),
  addressZip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Enter a valid ZIP code'),
  billingSameAsHome: z.boolean(),
  billingStreet: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingZip: z.string().optional(),
  primaryConcern: z.literal('ALCOHOL'),
  treatmentGoal: z.enum(['QUIT', 'REDUCE', 'EXPLORE']),
  privacyConsentGiven: z.literal(true),
  termsAccepted: z.literal(true),
});

export type OnboardingStartRequest = z.infer<typeof onboardingStartSchema>;

/**
 * POST handler for starting onboarding
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ========================================================================
    // 1. Verify authentication — require PATIENT role
    // ========================================================================
    const auth = await requireRole(request, [Role.PATIENT]);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const userId = auth.user.userId;

    // ========================================================================
    // 2. Parse and validate request body
    // ========================================================================
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const validationResult = onboardingStartSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      
      return NextResponse.json(
        { error: 'Validation failed', errors },
        { status: 400 }
      );
    }

    const checkoutData = validationResult.data;

    // Additional validation
    const dataValidation = validateCheckoutData(checkoutData);
    if (!dataValidation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', errors: dataValidation.errors },
        { status: 400 }
      );
    }

    // ========================================================================
    // 3. Store checkout data temporarily
    // ========================================================================
    await storeCheckoutData(userId, {
      ...checkoutData,
      primaryConcern: checkoutData.primaryConcern as ConcernType,
      treatmentGoal: checkoutData.treatmentGoal as TreatmentGoal,
    });

    // ========================================================================
    // 4. Return success
    // ========================================================================
    return NextResponse.json({
      success: true,
      message: 'Checkout data stored successfully',
      redirectUrl: '/checkout/payment',
    });

  } catch (error) {
    // Log error without PHI
    console.error('[Onboarding Start] Error:', error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
