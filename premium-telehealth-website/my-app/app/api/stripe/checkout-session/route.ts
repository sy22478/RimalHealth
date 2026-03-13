/**
 * POST /api/stripe/checkout-session
 * Creates a Stripe Checkout session for subscription signup
 * 
 * HIPAA Compliance:
 * - Authenticated endpoint only
 * - No PHI in request/response logs
 * - Audit logging for all payment attempts
 * - Uses Stripe Checkout (PCI compliant, hosted by Stripe)
 * 
 * Request Body:
 * ```json
 * {
 *   "planType": "ACTIVE_TREATMENT" | "MAINTENANCE",
 *   "successUrl": "https://example.com/checkout/success?session_id={CHECKOUT_SESSION_ID}",
 *   "cancelUrl": "https://example.com/checkout/cancel"
 * }
 * ```
 * 
 * Response:
 * ```json
 * {
 *   "sessionId": "cs_...",
 *   "url": "https://checkout.stripe.com/..."
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PlanType } from '@prisma/client';

// JWT verification - safe to import at top level (no external deps)
import { verifyAccessToken } from '@/lib/auth/jwt';

// Audit logging - safe to import at top level
import { auditLogger } from '@/lib/audit/logger';
import { AuditEventType, AuditSeverity } from '@/lib/audit/types';

// ============================================
// Validation Schema
// ============================================

const checkoutSessionSchema = z.object({
  planType: z.enum(['ACTIVE_TREATMENT']),
  successUrl: z.string().url('Invalid success URL'),
  cancelUrl: z.string().url('Invalid cancel URL'),
});

type CheckoutSessionInput = z.infer<typeof checkoutSessionSchema>;

// ============================================
// Helper Functions
// ============================================

/**
 * Extract and verify access token from request.
 * Accepts Bearer token (Authorization header) or middleware-injected
 * x-user-id / x-user-role headers (set when the request passes through
 * the Next.js middleware with a valid httpOnly accessToken cookie).
 */
async function getAuthenticatedUser(request: NextRequest) {
  // 1. Try middleware-injected headers (cookie-based auth via middleware)
  const userId = request.headers.get('x-user-id');
  const userRole = request.headers.get('x-user-role');
  const userEmail = request.headers.get('x-user-email');
  if (userId && userRole) {
    return { userId, role: userRole as string, email: userEmail ?? '' };
  }

  // 2. Fall back to explicit Authorization: Bearer header
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  try {
    const payload = await verifyAccessToken(token);
    return payload;
  } catch {
    return null;
  }
}

/**
 * Get audit context from request
 */
function getAuditContext(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  return {
    ipAddress: forwarded?.split(',')[0]?.trim() ?? 'unknown',
    userAgent: request.headers.get('user-agent') ?? 'unknown',
    requestId: crypto.randomUUID(),
  };
}

/**
 * Get user with profile from database
 */
async function getUserWithProfile(userId: string) {
  const { prisma } = await import('@/lib/db/prisma');
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      patientProfile: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

// ============================================
// Route Handler
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Lazy load Stripe integration
  const {
    createCheckoutSession,
    getOrCreateCustomer,
    getPriceId,
    isStripeConfigured,
  } = await import('@/lib/integrations/stripe');

  // Check Stripe configuration
  if (!isStripeConfigured()) {
    console.error('[Stripe Checkout] Stripe is not configured');
    return NextResponse.json(
      {
        error: 'Payment processing is not available. Please try again later.',
        code: 'STRIPE_NOT_CONFIGURED',
      },
      { status: 503 }
    );
  }

  const auditContext = getAuditContext(request);

  try {
    // Authenticate user
    const userPayload = await getAuthenticatedUser(request);
    
    if (!userPayload) {
      await auditLogger.log({
        eventType: AuditEventType.USER_LOGIN_FAILED,
        severity: AuditSeverity.WARNING,
        action: 'Unauthorized checkout attempt',
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        success: false,
        errorMessage: 'Missing or invalid authentication',
      });
      
      return NextResponse.json(
        {
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = checkoutSessionSchema.safeParse(body);

    if (!validationResult.success) {
      await auditLogger.log({
        eventType: AuditEventType.PATIENT_DATA_CREATED,
        severity: AuditSeverity.WARNING,
        userId: userPayload.userId,
        userRole: userPayload.role,
        resourceType: 'CheckoutSession',
        action: 'Invalid checkout request',
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        success: false,
        errorMessage: 'Validation failed',
        metadata: { errors: validationResult.error.flatten().fieldErrors },
      });

      return NextResponse.json(
        {
          error: 'Invalid request',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { planType, successUrl, cancelUrl }: CheckoutSessionInput = validationResult.data;

    // Get user from database
    const user = await getUserWithProfile(userPayload.userId);

    if (!user) {
      await auditLogger.log({
        eventType: AuditEventType.USER_LOGIN_FAILED,
        severity: AuditSeverity.ERROR,
        userId: userPayload.userId,
        userRole: userPayload.role,
        action: 'User not found during checkout',
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        success: false,
        errorMessage: 'User not found',
      });

      return NextResponse.json(
        {
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Get or create Stripe customer
    const customerName = user.patientProfile
      ? `${user.patientProfile.firstName} ${user.patientProfile.lastName}`
      : user.email;

    const customerId = await getOrCreateCustomer(
      user.email,
      customerName,
      { userId: user.id }
    );

    // Get price ID for the plan
    const priceId = getPriceId(planType as PlanType);

    // Create checkout session
    const session = await createCheckoutSession(
      customerId,
      priceId,
      successUrl,
      cancelUrl,
      {
        userId: user.id,
        planType,
      }
    );

    // Log successful checkout session creation
    await auditLogger.log({
      eventType: AuditEventType.PATIENT_DATA_CREATED,
      severity: AuditSeverity.INFO,
      userId: user.id,
      userRole: userPayload.role,
      resourceType: 'CheckoutSession',
      resourceId: session.id,
      action: 'Checkout session created',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      success: true,
      metadata: {
        planType,
        customerId,
        sessionId: session.id,
      },
    });

    // Return session details
    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[Stripe Checkout] Error creating checkout session:', errorMessage);

    // Log error
    await auditLogger.log({
      eventType: AuditEventType.PATIENT_DATA_CREATED,
      severity: AuditSeverity.ERROR,
      action: 'Checkout session creation failed',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      success: false,
      errorMessage,
    });

    // Return generic error to client (don't expose internal details)
    return NextResponse.json(
      {
        error: 'Failed to create checkout session. Please try again later.',
        code: 'CHECKOUT_ERROR',
      },
      { status: 500 }
    );
  }
}

// ============================================
// Additional Methods
// ============================================

/**
 * GET /api/stripe/checkout-session?sessionId=cs_...
 * Retrieves a checkout session by ID
 * Used for verifying payment status after redirect
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Lazy load Stripe integration
  const { getCheckoutSession, isStripeConfigured } = await import('@/lib/integrations/stripe');

  // Check Stripe configuration
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        error: 'Payment processing is not available',
        code: 'STRIPE_NOT_CONFIGURED',
      },
      { status: 503 }
    );
  }

  try {
    // Get session ID from query params
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        {
          error: 'Session ID is required',
          code: 'MISSING_SESSION_ID',
        },
        { status: 400 }
      );
    }
    
    const session = await getCheckoutSession(sessionId);

    const customerEmail = session.customer_email || session.customer_details?.email || '';

    // Try to include the set-password token so the success page doesn't need a separate call
    let setPasswordToken: string | null = null;
    if (customerEmail && session.payment_status === 'paid') {
      try {
        const { prisma } = await import('@/lib/db/prisma');
        const user = await prisma.user.findUnique({
          where: { email: customerEmail.toLowerCase() },
          select: { id: true, emailVerified: true },
        });
        if (user && !user.emailVerified) {
          const resetToken = await prisma.passwordReset.findFirst({
            where: {
              userId: user.id,
              usedAt: null,
              expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
            select: { token: true },
          });
          setPasswordToken = resetToken?.token || null;
        }
      } catch {
        // Token lookup failed — not critical, user can use email link
      }
    }

    // Return session status
    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      paymentStatus: session.payment_status,
      subscriptionId: session.subscription,
      customerId: session.customer,
      customerEmail,
      amount_total: session.amount_total,
      metadata: session.metadata,
      setPasswordToken,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[Stripe Checkout] Error retrieving checkout session:', errorMessage);

    return NextResponse.json(
      {
        error: 'Failed to retrieve checkout session',
        code: 'RETRIEVE_ERROR',
      },
      { status: 500 }
    );
  }
}
