/**
 * Auth API Routes Unit Tests
 * Tests for verify-token, verify-email, and send-verification endpoints.
 *
 * Mocks: Prisma, rate-limit, audit logger, sendEmail.
 *
 * @module tests/unit/auth-routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Hoisted mock variables (vi.hoisted runs before vi.mock factories)
// ---------------------------------------------------------------------------

const {
  mockPrismaPasswordReset,
  mockPrismaUser,
  mockPrismaTransaction,
  mockRateLimit,
  mockAuditPasswordEvent,
  mockSendEmail,
} = vi.hoisted(() => ({
  mockPrismaPasswordReset: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mockPrismaUser: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  mockPrismaTransaction: vi.fn(),
  mockRateLimit: vi.fn(),
  mockAuditPasswordEvent: vi.fn().mockResolvedValue(undefined),
  mockSendEmail: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    passwordReset: mockPrismaPasswordReset,
    user: mockPrismaUser,
    $transaction: mockPrismaTransaction,
  },
}));

vi.mock('@/lib/middleware/rate-limit', () => ({
  rateLimit: mockRateLimit,
  rateLimitPresets: {
    strict: { requests: 3, windowMs: 3600000, keyPrefix: 'ratelimit:strict' },
    auth: { requests: 5, windowMs: 900000, keyPrefix: 'ratelimit:auth' },
    api: { requests: 100, windowMs: 60000, keyPrefix: 'ratelimit:api' },
  },
}));

vi.mock('@/lib/audit/logger', () => ({
  auditPasswordEvent: mockAuditPasswordEvent,
}));

vi.mock('@/lib/audit/types', () => ({
  AuditEventType: {
    PASSWORD_RESET_REQUESTED: 'password_reset_requested',
    EMAIL_VERIFIED: 'email_verified',
  },
}));

vi.mock('@/lib/integrations/sendgrid', () => ({
  sendEmail: mockSendEmail,
}));

vi.mock('@/lib/notifications/templates', () => ({
  EmailTemplate: {
    EMAIL_VERIFICATION: 'email_verification',
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET as verifyTokenGET } from '@/app/api/auth/verify-token/route';
import { GET as verifyEmailGET } from '@/app/api/auth/verify-email/route';
import { POST as sendVerificationPOST } from '@/app/api/auth/send-verification/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGETRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'GET',
    headers: { 'x-forwarded-for': '127.0.0.1', 'user-agent': 'vitest' },
  });
}

function makePOSTRequest(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost:3000/api/auth/send-verification'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
      'user-agent': 'vitest',
    },
    body: JSON.stringify(body),
  });
}

function rateLimitAllow(): void {
  mockRateLimit.mockResolvedValue({
    success: true,
    limit: 5,
    remaining: 4,
    reset: Math.ceil(Date.now() / 1000) + 900,
  });
}

function rateLimitDeny(): void {
  mockRateLimit.mockResolvedValue({
    success: false,
    limit: 5,
    remaining: 0,
    reset: Math.ceil(Date.now() / 1000) + 900,
    retryAfter: 60,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/auth/verify-token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitAllow();
  });

  it('returns 400 when token query param is missing', async () => {
    const req = makeGETRequest('http://localhost:3000/api/auth/verify-token');
    const res = await verifyTokenGET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('MISSING_TOKEN');
  });

  it('returns 429 when rate-limited', async () => {
    rateLimitDeny();
    const req = makeGETRequest('http://localhost:3000/api/auth/verify-token?token=abc');
    const res = await verifyTokenGET(req);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.code).toBe('RATE_LIMITED');
  });

  it('returns 400 for an invalid (non-existent) token', async () => {
    mockPrismaPasswordReset.findUnique.mockResolvedValue(null);

    const req = makeGETRequest('http://localhost:3000/api/auth/verify-token?token=bad-token');
    const res = await verifyTokenGET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('INVALID_TOKEN');
    expect(mockAuditPasswordEvent).toHaveBeenCalled();
  });

  it('returns 400 for an expired token', async () => {
    mockPrismaPasswordReset.findUnique.mockResolvedValue({
      id: 'pr-1',
      token: 'expired-token',
      userId: 'user-1',
      expiresAt: new Date(Date.now() - 60_000),
      usedAt: null,
      user: { id: 'user-1', email: 'test@example.com' },
    });

    const req = makeGETRequest('http://localhost:3000/api/auth/verify-token?token=expired-token');
    const res = await verifyTokenGET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('TOKEN_EXPIRED');
  });

  it('returns 400 for an already-used token', async () => {
    mockPrismaPasswordReset.findUnique.mockResolvedValue({
      id: 'pr-1',
      token: 'used-token',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 86_400_000),
      usedAt: new Date(),
      user: { id: 'user-1', email: 'test@example.com' },
    });

    const req = makeGETRequest('http://localhost:3000/api/auth/verify-token?token=used-token');
    const res = await verifyTokenGET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('TOKEN_USED');
  });

  it('returns 200 with email for a valid token', async () => {
    mockPrismaPasswordReset.findUnique.mockResolvedValue({
      id: 'pr-1',
      token: 'valid-token',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 86_400_000),
      usedAt: null,
      user: { id: 'user-1', email: 'test@example.com' },
    });

    const req = makeGETRequest('http://localhost:3000/api/auth/verify-token?token=valid-token');
    const res = await verifyTokenGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.email).toBe('test@example.com');
  });

  it('returns 500 when Prisma throws', async () => {
    mockPrismaPasswordReset.findUnique.mockRejectedValue(new Error('DB down'));

    const req = makeGETRequest('http://localhost:3000/api/auth/verify-token?token=any');
    const res = await verifyTokenGET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});

// ============================================================================

describe('GET /api/auth/verify-email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitAllow();
  });

  it('returns 400 when token query param is missing', async () => {
    const req = makeGETRequest('http://localhost:3000/api/auth/verify-email');
    const res = await verifyEmailGET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('MISSING_TOKEN');
  });

  it('returns 400 when token does not start with verify- prefix', async () => {
    const req = makeGETRequest('http://localhost:3000/api/auth/verify-email?token=not-a-verify-token');
    const res = await verifyEmailGET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('INVALID_TOKEN');
  });

  it('returns 429 when rate-limited', async () => {
    rateLimitDeny();
    const req = makeGETRequest('http://localhost:3000/api/auth/verify-email?token=verify-abc');
    const res = await verifyEmailGET(req);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.code).toBe('RATE_LIMITED');
  });

  it('returns 400 for a non-existent verification token', async () => {
    mockPrismaPasswordReset.findUnique.mockResolvedValue(null);

    const req = makeGETRequest('http://localhost:3000/api/auth/verify-email?token=verify-bad');
    const res = await verifyEmailGET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('INVALID_TOKEN');
  });

  it('returns 400 for an expired verification token', async () => {
    mockPrismaPasswordReset.findUnique.mockResolvedValue({
      id: 'pr-2',
      token: 'verify-expired',
      userId: 'user-2',
      expiresAt: new Date(Date.now() - 60_000),
      usedAt: null,
      user: { id: 'user-2', email: 'user@example.com', emailVerified: false },
    });

    const req = makeGETRequest('http://localhost:3000/api/auth/verify-email?token=verify-expired');
    const res = await verifyEmailGET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('TOKEN_EXPIRED');
  });

  it('returns success when token is used but email is already verified', async () => {
    mockPrismaPasswordReset.findUnique.mockResolvedValue({
      id: 'pr-3',
      token: 'verify-already',
      userId: 'user-3',
      expiresAt: new Date(Date.now() + 86_400_000),
      usedAt: new Date(),
      user: { id: 'user-3', email: 'user@example.com', emailVerified: true },
    });

    const req = makeGETRequest('http://localhost:3000/api/auth/verify-email?token=verify-already');
    const res = await verifyEmailGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.alreadyVerified).toBe(true);
  });

  it('returns 400 when token is used and email is NOT verified', async () => {
    mockPrismaPasswordReset.findUnique.mockResolvedValue({
      id: 'pr-4',
      token: 'verify-used',
      userId: 'user-4',
      expiresAt: new Date(Date.now() + 86_400_000),
      usedAt: new Date(),
      user: { id: 'user-4', email: 'user@example.com', emailVerified: false },
    });

    const req = makeGETRequest('http://localhost:3000/api/auth/verify-email?token=verify-used');
    const res = await verifyEmailGET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('TOKEN_USED');
  });

  it('returns 200 and verifies email for a valid token', async () => {
    mockPrismaPasswordReset.findUnique.mockResolvedValue({
      id: 'pr-5',
      token: 'verify-valid',
      userId: 'user-5',
      expiresAt: new Date(Date.now() + 86_400_000),
      usedAt: null,
      user: { id: 'user-5', email: 'user@example.com', emailVerified: false },
    });

    mockPrismaTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      await cb({
        user: { update: vi.fn().mockResolvedValue({}) },
        passwordReset: { update: vi.fn().mockResolvedValue({}) },
      });
    });

    const req = makeGETRequest('http://localhost:3000/api/auth/verify-email?token=verify-valid');
    const res = await verifyEmailGET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('verified successfully');
    expect(mockPrismaTransaction).toHaveBeenCalled();
  });

  it('returns 500 when Prisma throws', async () => {
    mockPrismaPasswordReset.findUnique.mockRejectedValue(new Error('DB fail'));

    const req = makeGETRequest('http://localhost:3000/api/auth/verify-email?token=verify-x');
    const res = await verifyEmailGET(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});

// ============================================================================

describe('POST /api/auth/send-verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitAllow();
  });

  it('returns 429 when rate-limited', async () => {
    rateLimitDeny();
    const req = makePOSTRequest({ email: 'test@example.com' });
    const res = await sendVerificationPOST(req);
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.code).toBe('RATE_LIMITED');
  });

  it('returns 400 for invalid email', async () => {
    const req = makePOSTRequest({ email: 'not-an-email' });
    const res = await sendVerificationPOST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for missing email field', async () => {
    const req = makePOSTRequest({});
    const res = await sendVerificationPOST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns success even when user does not exist (prevents enumeration)', async () => {
    mockPrismaUser.findUnique.mockResolvedValue(null);

    const req = makePOSTRequest({ email: 'nonexistent@example.com' });
    const res = await sendVerificationPOST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('returns success without sending email when already verified', async () => {
    mockPrismaUser.findUnique.mockResolvedValue({
      id: 'user-10',
      emailVerified: true,
    });

    const req = makePOSTRequest({ email: 'verified@example.com' });
    const res = await sendVerificationPOST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('creates token and sends email for unverified user', async () => {
    mockPrismaUser.findUnique.mockResolvedValue({
      id: 'user-11',
      emailVerified: false,
    });
    mockPrismaPasswordReset.create.mockResolvedValue({ id: 'pr-new' });
    mockSendEmail.mockResolvedValue(undefined);

    const req = makePOSTRequest({ email: 'unverified@example.com' });
    const res = await sendVerificationPOST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Verify Prisma was called to create a token with verify- prefix
    expect(mockPrismaPasswordReset.create).toHaveBeenCalledTimes(1);
    const createArg = mockPrismaPasswordReset.create.mock.calls[0][0];
    expect(createArg.data.token).toMatch(/^verify-/);
    expect(createArg.data.userId).toBe('user-11');

    // Verify sendEmail was called
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][0].to).toBe('unverified@example.com');
  });

  it('returns 500 when an unexpected error occurs', async () => {
    // Force request.json() to throw by sending invalid JSON
    const req = new NextRequest(new URL('http://localhost:3000/api/auth/send-verification'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
        'user-agent': 'vitest',
      },
      body: 'not json at all {{{',
    });

    const res = await sendVerificationPOST(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});
