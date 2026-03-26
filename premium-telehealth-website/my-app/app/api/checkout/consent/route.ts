/**
 * POST /api/checkout/consent
 *
 * Records consent agreements before payment. This is a public endpoint
 * (no auth required) since users consent before paying/creating an account.
 *
 * The consent record is stored in the AuditLog for compliance purposes.
 * If the database is unavailable, the endpoint still returns success
 * (consent is also stored client-side in sessionStorage as a fallback
 * reference ID for the Stripe checkout flow).
 *
 * @module app/api/checkout/consent/route
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit, rateLimitPresets } from '@/lib/middleware/rate-limit';
import { requireCSRF } from '@/lib/security/csrf';
import { AuditEventType } from '@/lib/audit/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const consentSchema = z.object({
  consents: z.object({
    age: z.boolean().refine((v) => v === true, { message: 'Age confirmation is required' }),
    california: z.boolean().refine((v) => v === true, { message: 'California residency confirmation is required' }),
    terms: z.boolean().refine((v) => v === true, { message: 'Terms of Service agreement is required' }),
    privacy: z.boolean().refine((v) => v === true, { message: 'Privacy Policy agreement is required' }),
    hipaa: z.boolean().refine((v) => v === true, { message: 'HIPAA Notice agreement is required' }),
    telehealth: z.boolean().refine((v) => v === true, { message: 'Telehealth consent is required' }),
    informed: z.boolean().refine((v) => v === true, { message: 'Informed consent is required' }),
  }),
  timestamp: z.string().datetime({ message: 'Valid ISO 8601 timestamp is required' }),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // CSRF validation (double-submit cookie pattern)
  const csrfError = requireCSRF(request);
  if (csrfError) return csrfError;

  // Rate limit by IP
  const clientIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const rateLimitResult = await rateLimit(clientIp, rateLimitPresets.api);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter ?? 60) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_JSON' },
      { status: 400 }
    );
  }

  const parsed = consentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { consents, timestamp } = parsed.data;

  // Generate a consent record ID for tracking through the checkout flow
  const consentRecordId = crypto.randomUUID();

  // Store consent in AuditLog for compliance (no PHI involved)
  try {
    const { prisma } = await import('@/lib/db/prisma');

    await prisma.auditLog.create({
      data: {
        eventType: AuditEventType.CONSENT_RECORDED,
        severity: 'INFO',
        ipAddress: clientIp,
        userAgent: request.headers.get('user-agent') ?? 'unknown',
        resourceType: 'CONSENT',
        resourceId: consentRecordId,
        metadata: {
          consents,
          consentTimestamp: timestamp,
          consentItems: [
            'age_confirmation',
            'california_residency',
            'terms_of_service',
            'privacy_policy',
            'hipaa_notice',
            'telehealth_consent',
            'informed_consent',
          ],
          consentVersion: '2.0',
        },
        success: true,
      },
    });
  } catch (error) {
    // Log the failure but do not block the user -- consent is also tracked
    // client-side via the consentRecordId returned below
    console.error('[consent] Failed to persist consent record to database:', error instanceof Error ? error.message : 'Unknown error');
  }

  return NextResponse.json({
    success: true,
    consentRecordId,
  });
}
