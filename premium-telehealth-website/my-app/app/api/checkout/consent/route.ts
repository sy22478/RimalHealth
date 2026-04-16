/**
 * POST /api/checkout/consent
 *
 * Records consent agreements before payment. This is a public endpoint
 * (no auth required) since users consent before paying/creating an account.
 *
 * Consent is persisted to the AuditLog (immutable trail) with the typed-name
 * signature and full consent payload in `metadata`. The Stripe webhook
 * reconciles this entry into a ConsentRecord row once the User exists
 * (see app/api/webhooks/stripe/route.ts handleCheckoutComplete).
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
    age: z.literal(true, { message: 'Age confirmation is required' }),
    california: z.literal(true, { message: 'California residency confirmation is required' }),
    terms: z.literal(true, { message: 'Terms of Service agreement is required' }),
    privacy: z.literal(true, { message: 'Privacy Policy agreement is required' }),
    hipaa: z.literal(true, { message: 'HIPAA Notice agreement is required' }),
    part2_sud_consent: z.literal(true, { message: '42 CFR Part 2 SUD consent is required' }),
    telehealth: z.literal(true, { message: 'Telehealth consent is required' }),
    informed: z.literal(true, { message: 'Informed consent is required' }),
  }),
  // §2.31(a)(8) typed-name electronic signature
  patientName: z
    .string()
    .trim()
    .min(2, { message: 'Please type your full legal name (minimum 2 characters)' })
    .max(120, { message: 'Name is too long' }),
  timestamp: z.string().datetime({ message: 'Valid ISO 8601 timestamp is required' }),
});

const CONSENT_VERSION = '2.1';
const CONSENT_ITEMS = [
  'age_confirmation',
  'california_residency',
  'terms_of_service',
  'privacy_policy',
  'hipaa_notice',
  'part2_sud_consent',
  'telehealth_consent',
  'informed_consent',
];

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

  const { consents, patientName, timestamp } = parsed.data;

  // Generate a consent record ID for tracking through the checkout flow
  const consentRecordId = crypto.randomUUID();

  const userAgent = request.headers.get('user-agent') ?? 'unknown';

  // Persist consent to AuditLog. The Stripe webhook reconciles this entry
  // into a ConsentRecord row after the User is created.
  try {
    const { prisma } = await import('@/lib/db/prisma');

    await prisma.auditLog.create({
      data: {
        eventType: AuditEventType.CONSENT_RECORDED,
        severity: 'INFO',
        ipAddress: clientIp,
        userAgent,
        resourceType: 'CONSENT',
        resourceId: consentRecordId,
        metadata: {
          consents,
          patientName,
          consentTimestamp: timestamp,
          consentItems: CONSENT_ITEMS,
          consentVersion: CONSENT_VERSION,
          // §2.31(a)(8) electronic-signature attestation
          signature: {
            typedName: patientName,
            signedAt: timestamp,
            ipAddress: clientIp,
            userAgent,
          },
        },
        success: true,
      },
    });
  } catch (error) {
    // Surface DB failures so the client can retry; without persistence we
    // cannot reconcile a ConsentRecord later (42 CFR §2.31 requires the
    // consent of record).
    console.error(
      '[consent] Failed to persist consent record to database:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return NextResponse.json(
      { error: 'Unable to record consent. Please try again.', code: 'CONSENT_PERSIST_FAILED' },
      { status: 503 }
    );
  }

  return NextResponse.json({
    success: true,
    consentRecordId,
  });
}
