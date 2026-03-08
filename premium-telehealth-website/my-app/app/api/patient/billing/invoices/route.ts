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
import { auditLogger, createAuditContext } from '@/lib/audit';
import { InvoiceStatus } from '@prisma/client';
import { verifyAccessToken } from '@/lib/auth/jwt';

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
      const invoices = await prisma.invoice.findMany({
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
      console.error('[Invoices API] Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to fetch invoices' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[Invoices API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
