/**
 * Invoice Download API Route
 * 
 * GET /api/patient/billing/invoices/[id]/download
 * Generates or retrieves a PDF download URL for the invoice.
 * 
 * Pattern: BILLING-002 - Invoice download
 * Pattern: API-001 - Route handler template
 * Pattern: PHI-001 - Audit logging
 * HIPAA: Only invoice IDs logged, PDF content not logged
 * 
 * @module app/api/patient/billing/invoices/[id]/download
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getStripe } from '@/lib/stripe/stripe-server';
import { auditLogger, createAuditContext } from '@/lib/audit/index';
import { verifyAccessToken } from '@/lib/auth/jwt';

// ============================================================================
// Types
// ============================================================================

interface DownloadResponse {
  downloadUrl: string;
  filename: string;
  expiresAt: string;
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

/**
 * Format invoice number for filename
 */
function formatInvoiceNumber(invoiceId: string, createdAt: Date): string {
  const date = new Date(createdAt);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const shortId = invoiceId.slice(-6).toUpperCase();
  return `INV-${year}${month}-${shortId}`;
}

/**
 * Get invoice PDF URL from Stripe
 * Returns the Stripe-hosted invoice PDF URL
 */
async function getStripeInvoicePdfUrl(stripeInvoiceId: string): Promise<string | null> {
  try {
    const invoice = await getStripe().invoices.retrieve(stripeInvoiceId);
    
    // Stripe invoice object has invoice_pdf property
    if (invoice.invoice_pdf) {
      return invoice.invoice_pdf;
    }
    
    return null;
  } catch (error) {
    console.error('[Invoice Download] Failed to fetch from Stripe:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// ============================================================================
// Route Handler
// ============================================================================

/**
 * GET handler - Generate invoice download URL
 * 
 * Returns:
 * - Presigned URL for PDF download
 * - Filename for the invoice
 * - Expiration timestamp
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: invoiceId } = await params;

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
      // Fetch invoice from database
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: {
          id: true,
          userId: true,
          stripeInvoiceId: true,
          pdfUrl: true,
          createdAt: true,
        },
      });

      if (!invoice) {
        return NextResponse.json(
          { error: 'Invoice not found' },
          { status: 404 }
        );
      }

      // Verify ownership
      if (invoice.userId !== userId) {
        // Log attempted access to another user's invoice
        const auditContext = createAuditContext(request, userId, 'PATIENT');
        await auditLogger.logPHIAccess(
          'VIEW',
          userId,
          'PATIENT',
          'invoice_pdf',
          invoiceId,
          auditContext,
          { 
            accessReason: 'Unauthorized invoice access attempt',
          } as Record<string, unknown>
        );

        return NextResponse.json(
          { error: 'Forbidden' },
          { status: 403 }
        );
      }

      let downloadUrl: string | null = null;

      // Try to get PDF URL from existing source
      if (invoice.pdfUrl) {
        downloadUrl = invoice.pdfUrl;
      } else if (invoice.stripeInvoiceId) {
        // Fetch from Stripe
        downloadUrl = await getStripeInvoicePdfUrl(invoice.stripeInvoiceId);
      }

      // If no URL available, return error
      if (!downloadUrl) {
        return NextResponse.json(
          { error: 'Invoice PDF not available' },
          { status: 404 }
        );
      }

      // Audit log the download request
      const auditContext = createAuditContext(request, userId, 'PATIENT');
      await auditLogger.logPHIAccess(
        'VIEW',
        userId,
        'PATIENT',
        'invoice_pdf',
        invoiceId,
        auditContext,
        { 
          accessReason: 'Downloading invoice PDF',
        } as Record<string, unknown>
      );

      const response: DownloadResponse = {
        downloadUrl,
        filename: `${formatInvoiceNumber(invoice.id, invoice.createdAt)}.pdf`,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      };

      return NextResponse.json(response);

    } catch (dbError) {
      console.error('[Invoice Download] Database error:', dbError instanceof Error ? dbError.message : 'Unknown error');
      return NextResponse.json(
        { error: 'Failed to generate invoice download' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[Invoice Download] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
