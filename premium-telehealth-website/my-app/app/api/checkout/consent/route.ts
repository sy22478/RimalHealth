/**
 * POST /api/checkout/consent
 *
 * Records consent agreements before payment. This is a public endpoint
 * (no auth required) since users consent before paying/creating an account.
 *
 * Product-aware: the default (AUD / Naltrexone) flow validates the 8-item
 * consent set including 42 CFR Part 2 SUD consent. The weight-management
 * (GLP-1) flow — selected via `productType: 'WEIGHT_MANAGEMENT'` — validates
 * its own 9-item set and OMITS the 42 CFR Part 2 item (Part 2 applies to SUD
 * records only). The product type and accepted consent version are recorded in
 * the AuditLog metadata.
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
import { AuditEventType } from '@/lib/audit/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// §2.31(a)(8) typed-name electronic signature + timestamp shared across products.
const signatureSchema = {
  patientName: z
    .string()
    .trim()
    .min(2, { message: 'Please type your full legal name (minimum 2 characters)' })
    .max(120, { message: 'Name is too long' }),
  timestamp: z.string().datetime({ message: 'Valid ISO 8601 timestamp is required' }),
};

// AUD / Naltrexone consent schema (8 items, includes 42 CFR Part 2) — DEFAULT.
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
  ...signatureSchema,
});

// GLP-1 weight-management consent schema (9 items, NO 42 CFR Part 2).
const glp1ConsentSchema = z.object({
  consents: z.object({
    telehealth: z.literal(true, { message: 'Telehealth consent is required' }),
    glp1_side_effects: z.literal(true, { message: 'GLP-1 side-effect acknowledgement is required' }),
    retinopathy_monitoring: z.literal(true, { message: 'Retinopathy monitoring commitment is required' }),
    emergency_situations: z.literal(true, { message: 'Emergency situations acknowledgement is required' }),
    mental_health_warning: z.literal(true, { message: 'Mental-health warning acknowledgement is required' }),
    surgery_notification: z.literal(true, { message: 'Surgery/procedure notification consent is required' }),
    long_term_therapy: z.literal(true, { message: 'Long-term therapy acknowledgement is required' }),
    pharmacy_prescribing: z.literal(true, { message: 'Pharmacy and prescribing consent is required' }),
    california: z.literal(true, { message: 'California residency confirmation is required' }),
  }),
  ...signatureSchema,
});

// AUD consent version + canonical item keys (recorded in AuditLog metadata).
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

// GLP-1 weight-management consent version + canonical item keys.
const GLP1_CONSENT_VERSION = 'GLP1-1.0';
const GLP1_CONSENT_ITEMS = [
  'telehealth_consent',
  'glp1_side_effects',
  'retinopathy_monitoring',
  'emergency_situations',
  'mental_health_warning',
  'surgery_notification',
  'long_term_therapy',
  'pharmacy_prescribing',
  'california_residency',
];

// Accepted product types. Absent / 'ALCOHOL' => default AUD flow.
const productTypeSchema = z.enum(['ALCOHOL', 'WEIGHT_MANAGEMENT']).optional();

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Note: No CSRF on this route — it's a public endpoint (pre-auth).
  // Rate limiting by IP provides sufficient abuse protection.

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

  // Determine the product type up front so we validate against the correct
  // consent set. An invalid/unknown productType is rejected before we pick a
  // schema; absent => default AUD flow.
  const productTypeParsed = productTypeSchema.safeParse(
    (body as { productType?: unknown } | null)?.productType
  );
  if (!productTypeParsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR', details: productTypeParsed.error.issues },
      { status: 400 }
    );
  }
  const productType = productTypeParsed.data ?? 'ALCOHOL';
  const isGlp1 = productType === 'WEIGHT_MANAGEMENT';

  // Select the consent schema, version, and canonical item keys per product.
  const schema = isGlp1 ? glp1ConsentSchema : consentSchema;
  const consentVersion = isGlp1 ? GLP1_CONSENT_VERSION : CONSENT_VERSION;
  const consentItems = isGlp1 ? GLP1_CONSENT_ITEMS : CONSENT_ITEMS;

  const parsed = schema.safeParse(body);
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
          consentItems,
          consentVersion,
          productType,
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
