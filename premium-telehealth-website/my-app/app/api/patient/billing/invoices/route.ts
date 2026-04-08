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
import { InvoiceStatus, Role } from '@prisma/client';
import { requireRole } from '@/lib/auth/require-auth';
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
    // Require PATIENT role
    const auth = await requireRole(request, [Role.PATIENT]);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const userId = auth.user.userId;

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
      // Stripe sync: always merge Stripe data to catch invoices the webhook
      // didn't create. Deduplicates by stripeInvoiceId.
      // ====================================================================
      {
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
              limit: 50,
            });

            // Backfill Stripe invoices into the local DB, wrapped in a transaction
            // to ensure atomicity. Deduplicates by stripeInvoiceId.
            const invoiceSubId = subscriptionId;
            if (invoiceSubId && stripeInvoices.data.length > 0) {
              const existingIds = new Set(
                (await prisma.invoice.findMany({
                  where: { userId },
                  select: { stripeInvoiceId: true },
                })).map(i => i.stripeInvoiceId)
              );

              const newInvoices = stripeInvoices.data.filter(si => !existingIds.has(si.id));

              if (newInvoices.length > 0) {
                await prisma.$transaction(
                  newInvoices.map(si =>
                    prisma.invoice.create({
                      data: {
                        subscriptionId: invoiceSubId,
                        userId,
                        amount: si.amount_paid,
                        currency: (si.currency || 'usd').toUpperCase(),
                        status: si.status === 'paid' ? ('PAID' as InvoiceStatus) : ('OPEN' as InvoiceStatus),
                        stripeInvoiceId: si.id,
                        stripeChargeId: typeof (si as unknown as Record<string, unknown>).charge === 'string' ? (si as unknown as Record<string, unknown>).charge as string : null,
                        pdfUrl: si.invoice_pdf || null,
                        paidAt: si.status_transitions?.paid_at
                          ? new Date(si.status_transitions.paid_at * 1000)
                          : (si.status === 'paid' ? new Date() : null),
                      },
                    })
                  )
                );
              }
            }

            // Re-fetch from DB so we return consistent records (always, to merge any new backfill)
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

      // Filter out $0 trial invoices — they're auto-generated by Stripe during
      // the trial period and don't represent real charges
      const response: InvoiceResponse[] = invoices
        .filter(invoice => invoice.amount > 0)
        .map(invoice => ({
          id: invoice.id,
          amount: invoice.amount,
          status: invoice.status,
          stripeInvoiceId: invoice.stripeInvoiceId,
          stripeChargeId: invoice.stripeChargeId,
          pdfUrl: invoice.pdfUrl,
          createdAt: invoice.createdAt.toISOString(),
          paidAt: invoice.paidAt?.toISOString() || null,
        }));

      // If the subscription is TRIALING and there are no real invoices,
      // show a synthetic "pending" invoice so the patient knows the amount
      const subscription = await prisma.subscription.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { status: true, amount: true, createdAt: true },
      });

      if (
        subscription?.status === 'TRIALING' &&
        response.length === 0
      ) {
        response.push({
          id: 'pending-review',
          amount: subscription.amount,
          status: 'OPEN' as InvoiceStatus,
          stripeInvoiceId: 'pending',
          stripeChargeId: null,
          pdfUrl: null,
          createdAt: subscription.createdAt.toISOString(),
          paidAt: null,
        });
      }

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
