/**
 * Stripe Customer Portal API
 * 
 * POST /api/stripe/customer-portal
 * Creates a billing portal session for self-service subscription management
 * 
 * HIPAA Compliance:
 * - Authenticated endpoint only
 * - No PHI in request/response
 * - Audit logging for portal access
 * 
 * Request Body:
 * ```json
 * {
 *   "returnUrl": "https://example.com/dashboard/billing"
 * }
 * ```
 * 
 * Response:
 * ```json
 * {
 *   "url": "https://billing.stripe.com/session/..."
 * }
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// JWT verification - safe to import at top level
import { verifyAccessToken } from '@/lib/auth/jwt';

// Audit logging
import { auditLogger } from '@/lib/audit/logger';
import { AuditEventType, AuditSeverity } from '@/lib/audit/types';

// ============================================
// Validation Schema
// ============================================

const customerPortalSchema = z.object({
  returnUrl: z.string().url('Invalid return URL'),
});

type CustomerPortalInput = z.infer<typeof customerPortalSchema>;

// ============================================
// Helper Functions
// ============================================

/**
 * Extract and verify access token from request.
 * Accepts Bearer token from Authorization header or accessToken cookie.
 */
async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const cookieToken = request.cookies.get('accessToken')?.value ?? null;
  const token = bearerToken ?? cookieToken;
  if (!token) {
    return null;
  }
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

// ============================================
// Route Handler
// ============================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Lazy load Stripe integration
  const {
    createCustomerPortalSession,
    isStripeConfigured,
  } = await import('@/lib/stripe/stripe-server');

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

  const auditContext = getAuditContext(request);

  try {
    // Authenticate user
    const userPayload = await getAuthenticatedUser(request);
    
    if (!userPayload) {
      await auditLogger.log({
        eventType: AuditEventType.USER_LOGIN_FAILED,
        severity: AuditSeverity.WARNING,
        action: 'Unauthorized portal access attempt',
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        success: false,
        errorMessage: 'Missing or invalid authentication',
      });
      
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validationResult = customerPortalSchema.safeParse(body);

    if (!validationResult.success) {
      await auditLogger.log({
        eventType: AuditEventType.PATIENT_DATA_VIEWED,
        severity: AuditSeverity.WARNING,
        userId: userPayload.userId,
        userRole: userPayload.role,
        resourceType: 'CustomerPortal',
        action: 'Invalid portal request',
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

    const { returnUrl }: CustomerPortalInput = validationResult.data;

    // Get user from database
    const { prisma } = await import('@/lib/db/prisma');
    const user = await prisma.user.findUnique({
      where: { id: userPayload.userId },
      include: {
        subscriptions: {
          where: {
            status: {
              in: ['ACTIVE', 'PAST_DUE'],
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found', code: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Check if user has a Stripe customer ID
    const subscription = user.subscriptions[0];
    
    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found', code: 'NO_SUBSCRIPTION' },
        { status: 404 }
      );
    }

    const customerId = subscription.stripeCustomerId;

    // Create customer portal session
    const portalSession = await createCustomerPortalSession(customerId, returnUrl);

    // Log successful portal creation
    await auditLogger.log({
      eventType: AuditEventType.PATIENT_DATA_VIEWED,
      severity: AuditSeverity.INFO,
      userId: user.id,
      userRole: userPayload.role,
      resourceType: 'CustomerPortal',
      resourceId: portalSession.id,
      action: 'Customer portal session created',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      success: true,
      metadata: {
        customerId,
        returnUrl,
      },
    });

    // Return portal URL
    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('[Stripe Portal] Error creating portal session:', errorMessage);

    await auditLogger.log({
      eventType: AuditEventType.PATIENT_DATA_VIEWED,
      severity: AuditSeverity.ERROR,
      action: 'Customer portal creation failed',
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      success: false,
      errorMessage,
    });

    return NextResponse.json(
      {
        error: 'Failed to create customer portal. Please try again later.',
        code: 'PORTAL_ERROR',
      },
      { status: 500 }
    );
  }
}
