/**
 * Consent API Route Unit Tests
 * Tests POST /api/checkout/consent for validation, rate limiting, and audit logging.
 *
 * Mocks: Prisma (dynamic import inside route), rate-limit, CSRF.
 *
 * @module tests/unit/consent-route
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Hoisted mock variables
// ---------------------------------------------------------------------------

const {
  mockAuditLogCreate,
  mockRateLimit,
  mockRequireCSRF,
} = vi.hoisted(() => ({
  mockAuditLogCreate: vi.fn().mockResolvedValue({ id: 'audit-1' }),
  mockRateLimit: vi.fn(),
  mockRequireCSRF: vi.fn().mockReturnValue(null),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    auditLog: { create: mockAuditLogCreate },
  },
}));

vi.mock('@/lib/middleware/rate-limit', () => ({
  rateLimit: mockRateLimit,
  rateLimitPresets: {
    api: { requests: 100, windowMs: 60000, keyPrefix: 'ratelimit:api' },
    auth: { requests: 5, windowMs: 900000, keyPrefix: 'ratelimit:auth' },
    strict: { requests: 3, windowMs: 3600000, keyPrefix: 'ratelimit:strict' },
  },
}));

vi.mock('@/lib/security/csrf', () => ({
  requireCSRF: mockRequireCSRF,
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { POST as consentPOST } from '@/app/api/checkout/consent/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rateLimitAllow(): void {
  mockRateLimit.mockResolvedValue({
    success: true,
    limit: 100,
    remaining: 99,
    reset: Math.ceil(Date.now() / 1000) + 60,
  });
}

function rateLimitDeny(): void {
  mockRateLimit.mockResolvedValue({
    success: false,
    limit: 100,
    remaining: 0,
    reset: Math.ceil(Date.now() / 1000) + 60,
    retryAfter: 30,
  });
}

/** All 8 consent booleans set to true (includes part2_sud_consent) */
function allConsentsTrue(): Record<string, boolean> {
  return {
    age: true,
    california: true,
    terms: true,
    privacy: true,
    hipaa: true,
    part2_sud_consent: true,
    telehealth: true,
    informed: true,
  };
}

const VALID_PATIENT_NAME = 'Test Patient';

function makeRequest(body: unknown): NextRequest {
  // If caller passed an object with `consents` and `timestamp`, default the
  // patientName so tests written against the old schema still pass when they
  // intentionally exercise other validation paths.
  let payload = body;
  if (
    body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    'consents' in (body as Record<string, unknown>) &&
    !('patientName' in (body as Record<string, unknown>))
  ) {
    payload = { ...(body as Record<string, unknown>), patientName: VALID_PATIENT_NAME };
  }
  return new NextRequest(new URL('http://localhost:3000/api/checkout/consent'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '10.0.0.1',
      'user-agent': 'vitest',
    },
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/checkout/consent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitAllow();
    mockRequireCSRF.mockReturnValue(null);
  });

  // -----------------------------------------------------------------------
  // CSRF
  // -----------------------------------------------------------------------

  it('returns 403 when CSRF validation fails', async () => {
    mockRequireCSRF.mockReturnValue(
      NextResponse.json(
        { success: false, error: 'Invalid CSRF token', code: 'CSRF_INVALID' },
        { status: 403 }
      )
    );

    const req = makeRequest({ consents: allConsentsTrue(), timestamp: new Date().toISOString() });
    const res = await consentPOST(req);

    expect(res.status).toBe(403);
  });

  // -----------------------------------------------------------------------
  // Rate limiting
  // -----------------------------------------------------------------------

  it('returns 429 when rate-limited', async () => {
    rateLimitDeny();

    const req = makeRequest({ consents: allConsentsTrue(), timestamp: new Date().toISOString() });
    const res = await consentPOST(req);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.code).toBe('RATE_LIMITED');
  });

  // -----------------------------------------------------------------------
  // Input validation
  // -----------------------------------------------------------------------

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest(new URL('http://localhost:3000/api/checkout/consent'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '10.0.0.1',
        'user-agent': 'vitest',
      },
      body: '<<<not json>>>',
    });

    const res = await consentPOST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('INVALID_JSON');
  });

  it('returns 400 when consents object is missing', async () => {
    const req = makeRequest({ timestamp: new Date().toISOString() });
    const res = await consentPOST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when timestamp is missing', async () => {
    const req = makeRequest({ consents: allConsentsTrue() });
    const res = await consentPOST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when timestamp is not a valid ISO 8601 string', async () => {
    const req = makeRequest({ consents: allConsentsTrue(), timestamp: 'not-a-date' });
    const res = await consentPOST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  // Test every single consent boolean -- each must be true
  const consentKeys = ['age', 'california', 'terms', 'privacy', 'hipaa', 'part2_sud_consent', 'telehealth', 'informed'];

  for (const key of consentKeys) {
    it(`returns 400 when consents.${key} is false`, async () => {
      const consents = allConsentsTrue();
      consents[key] = false;

      const req = makeRequest({ consents, timestamp: new Date().toISOString() });
      const res = await consentPOST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  }

  for (const key of consentKeys) {
    it(`returns 400 when consents.${key} is missing`, async () => {
      const consents = allConsentsTrue();
      delete consents[key];

      const req = makeRequest({ consents, timestamp: new Date().toISOString() });
      const res = await consentPOST(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  }

  // -----------------------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------------------

  it('returns 200 with consentRecordId when all consents are true', async () => {
    const req = makeRequest({ consents: allConsentsTrue(), timestamp: new Date().toISOString() });
    const res = await consentPOST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.consentRecordId).toBeDefined();
    expect(typeof body.consentRecordId).toBe('string');
  });

  it('creates an AuditLog record on success', async () => {
    const ts = new Date().toISOString();
    const req = makeRequest({ consents: allConsentsTrue(), timestamp: ts });
    await consentPOST(req);

    expect(mockAuditLogCreate).toHaveBeenCalledTimes(1);
    const createArg = mockAuditLogCreate.mock.calls[0][0];
    expect(createArg.data.eventType).toBe('CONSENT_RECORDED');
    expect(createArg.data.severity).toBe('INFO');
    expect(createArg.data.resourceType).toBe('CONSENT');
    expect(createArg.data.success).toBe(true);
    expect(createArg.data.metadata.consentTimestamp).toBe(ts);
    expect(createArg.data.metadata.consentVersion).toBe('2.1');
    // §2.31(a)(8) typed-name signature must be persisted
    expect(createArg.data.metadata.patientName).toBe(VALID_PATIENT_NAME);
    expect(createArg.data.metadata.signature.typedName).toBe(VALID_PATIENT_NAME);
  });

  it('returns 503 when ConsentRecord persistence fails (must surface to client for retry)', async () => {
    mockAuditLogCreate.mockRejectedValue(new Error('DB write failed'));

    const req = makeRequest({ consents: allConsentsTrue(), timestamp: new Date().toISOString() });
    const res = await consentPOST(req);
    const body = await res.json();

    // 42 CFR §2.31 requires a queryable consent of record — DB failures
    // can no longer be silently swallowed.
    expect(res.status).toBe(503);
    expect(body.code).toBe('CONSENT_PERSIST_FAILED');
  });

  it('returns 400 when patientName is missing (typed-name signature required)', async () => {
    const req = new NextRequest(new URL('http://localhost:3000/api/checkout/consent'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '10.0.0.1',
        'user-agent': 'vitest',
      },
      body: JSON.stringify({
        consents: allConsentsTrue(),
        timestamp: new Date().toISOString(),
      }),
    });
    const res = await consentPOST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});
