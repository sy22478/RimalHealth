/**
 * Patient Invoices API Route
 * 
 * GET /api/patient/billing/invoices
 * Returns list of invoices for the authenticated patient.
 * 
 * Pattern: API-001 - Route handler template
 * Pattern: PHI-001 - Audit logging
 * HIPAA: No PHI logged, only invoice IDs
 * 
 * @module app/api/patient/billing/invoices
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { auditLogger, createAuditContext } from '@/lib/audit/index';
import { InvoiceStatus } from '@prisma/client';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getStripe } from '@/lib/stripe/stripe-server';

// ============================================================================
// Types
// ============================================================================

interface InvoiceResponse {
  id: string;
  amount: number;
  status: InvoiceStatus;
  stripeInvoiceId: string;
  stripeChargeId: string | null;
  pdfUrl: string | null;
  createdAt: string;
  paidAt: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Authenticate request and get user ID
 * Accepts Bearer token from Authorization header or accessToken cookie.
 */
async function authenticateRequest(request: NextRequest): Promise<{ userId: string; role: string } | null> {
  const authHeader = request.headers.get('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const cookieToken = request.cookies.get('accessToken')?.value ?? null;
  const token = bearerToken ?? cookieToken;
  if (!token) {
    return null;
  }
  const payload = await verifyAccessToken(token);
  if (!payload) {
    return null;
  }
  return { userId: payload.userId, role: payload.role };
}

// ============================================================================
// Route Handler
// ============================================================================

/**
 * GET handler - Fetch invoice list
 * 
 * Returns:
 * - List of invoices sorted by date (newest first)
 * - Invoice details (amount, status, dates)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (auth.role !== 'PATIENT') {
      return NextResponse.json(
        { error: 'Forbidden - Patient access only' },
        { status: 403 }
      );
    }

    const userId = auth.userId;

    try {
      // Fetch invoices from database
      let invoices = await prisma.invoice.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          status: true,
          stripeInvoiceId: true,
          stripeChargeId: true,
          pdfUrl: true,
          createdAt: true,
          paidAt: true,
        },
      });

      // ====================================================================
      // Stripe fallback: if DB has zero invoices, backfill from Stripe.
      // Strategy:
      //   1. Try to find stripeCustomerId from the user's Subscription record
      //   2. If no Subscription, look up Stripe customer by the user's email
      // This handles accounts where the webhook didn't create Invoice records,
      // or where the Subscription record was never created properly.
      // ====================================================================
      if (invoices.length === 0) {
        try {
          const stripe = getStripe();
          let stripeCustomerId: string | null = null;
          let subscriptionId: string | null = null;

          // Strategy 1: Get stripeCustomerId from Subscription record
          const subscription = await prisma.subscription.findFirst({
            where: { userId },
            select: { id: true, stripeCustomerId: true },
          });

          if (subscription?.stripeCustomerId) {
            stripeCustomerId = subscription.stripeCustomerId;
            subscriptionId = subscription.id;
          }

          // Strategy 2: If no Subscription, look up Stripe customer by email
          if (!stripeCustomerId) {
            const user = await prisma.user.findUnique({
              where: { id: userId },
              select: { email: true },
            });

            if (user?.email) {
              const customers = await stripe.customers.list({
                email: user.email,
                limit: 1,
              });

              if (customers.data.length > 0) {
                stripeCustomerId = customers.data[0].id;
              }
            }
          }

          if (stripeCustomerId) {
            const stripeInvoices = await stripe.invoices.list({
              customer: stripeCustomerId,
              status: 'paid',
              limit: 50,
            });

            // Backfill each paid Stripe invoice into the local DB
            for (const si of stripeInvoices.data) {
              // Skip if already exists (race-condition guard)
              const exists = await prisma.invoice.findFirst({
                where: { stripeInvoiceId: si.id },
              });
              if (exists) continue;

              // Use the Subscription id if we have one; otherwise create without it
              // by finding or creating a minimal subscription reference
              const invoiceSubId = subscriptionId;

              if (invoiceSubId) {
                await prisma.invoice.create({
                  data: {
                    subscriptionId: invoiceSubId,
                    userId,
                    amount: si.amount_paid,
                    currency: (si.currency || 'usd').toUpperCase(),
                    status: 'PAID' as InvoiceStatus,
                    stripeInvoiceId: si.id,
                    stripeChargeId: typeof (si as unknown as Record<string, unknown>).charge === 'string' ? (si as unknown as Record<string, unknown>).charge as string : null,
                    pdfUrl: si.invoice_pdf || null,
                    paidAt: si.status_transitions?.paid_at
                      ? new Date(si.status_transitions.paid_at * 1000)
                      : new Date(),
                  },
                });
              }
            }

            // Re-fetch from DB so we return consistent records
            if (stripeInvoices.data.length > 0 && subscriptionId) {
              invoices = await prisma.invoice.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                select: {
                  id: true,
                  amount: true,
                  status: true,
                  stripeInvoiceId: true,
                  stripeChargeId: true,
                  pdfUrl: true,
                  createdAt: true,
                  paidAt: true,
                },
              });
            }

            // If we have Stripe invoices but no Subscription record to persist them,
            // return them directly without persisting to DB
            if (invoices.length === 0 && stripeInvoices.data.length > 0) {
              const directInvoices: InvoiceResponse[] = stripeInvoices.data.map((si) => ({
                id: si.id,
                amount: si.amount_paid,
                status: 'PAID' as InvoiceStatus,
                stripeInvoiceId: si.id,
                stripeChargeId: typeof (si as unknown as Record<string, unknown>).charge === 'string' ? (si as unknown as Record<string, unknown>).charge as string : null,
                pdfUrl: si.invoice_pdf || null,
                createdAt: si.created ? new Date(si.created * 1000).toISOString() : new Date().toISOString(),
                paidAt: si.status_transitions?.paid_at
                  ? new Date(si.status_transitions.paid_at * 1000).toISOString()
                  : null,
              }));

              // Audit log
              const auditContext = createAuditContext(request, userId, 'PATIENT');
              await auditLogger.logPHIAccess(
                'VIEW',
                userId,
                'PATIENT',
                'invoice_list',
                userId,
                auditContext,
                { accessReason: 'Viewing invoice list (Stripe direct)', source: 'stripe_fallback' } as Record<string, unknown>
              );

              return NextResponse.json({ invoices: directInvoices });
            }
          }
        } catch (stripeError) {
          // Log but don't fail — return empty list rather than error
          console.error('[Invoices API] Stripe fallback error:', stripeError instanceof Error ? stripeError.message : 'Unknown error');
        }
      }

      // Audit log the access
      const auditContext = createAuditContext(request, userId, 'PATIENT');
      await auditLogger.logPHIAccess(
        'VIEW',
        userId,
        'PATIENT',
        'invoice_list',
        userId,
        auditContext,
        {
          accessReason: 'Viewing invoice list',
        } as Record<string, unknown>
      );

      const response: InvoiceResponse[] = invoices.map(invoice => ({
        id: invoice.id,
        amount: invoice.amount,
        status: invoice.status,
        stripeInvoiceId: invoice.stripeInvoiceId,
        stripeChargeId: invoice.stripeChargeId,
        pdfUrl: invoice.pdfUrl,
        createdAt: invoice.createdAt.toISOString(),
        paidAt: invoice.paidAt?.toISOString() || null,
      }));

      return NextResponse.json({ invoices: response });

    } catch (dbError) {
      console.error('[Invoices API] Database error:', dbError instanceof Error ? dbError.message : 'Unknown error');
      return NextResponse.json(
        { error: 'Failed to fetch invoices' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[Invoices API] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
