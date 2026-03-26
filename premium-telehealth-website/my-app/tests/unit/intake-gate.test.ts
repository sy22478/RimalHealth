/**
 * Patient Layout Intake Gate Unit Tests
 *
 * Tests the core logic of `app/patient/layout.tsx`:
 *   - No access token cookie -> redirect to /login
 *   - Invalid access token -> redirect to /login
 *   - Valid token but no completed intake -> redirect to /intake
 *   - Valid token with completed intake -> render children
 *
 * Since this is a Next.js server component that uses `cookies()` and
 * `redirect()` (both from `next/navigation` / `next/headers`), we mock
 * those primitives and invoke the layout default export directly.
 *
 * @module tests/unit/intake-gate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock variables
// ---------------------------------------------------------------------------

const {
  mockCookieGet,
  mockRedirect,
  mockVerifyAccessToken,
  mockIntakeFindFirst,
} = vi.hoisted(() => {
  const _mockRedirect = vi.fn().mockImplementation((url: string) => {
    throw new _RedirectError(url);
  });

  class _RedirectError extends Error {
    public url: string;
    constructor(url: string) {
      super(`NEXT_REDIRECT: ${url}`);
      this.url = url;
    }
  }

  return {
    mockCookieGet: vi.fn(),
    mockRedirect: _mockRedirect,
    mockVerifyAccessToken: vi.fn(),
    mockIntakeFindFirst: vi.fn(),
    RedirectError: _RedirectError,
  };
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mockCookieGet,
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccessToken: mockVerifyAccessToken,
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    intake: { findFirst: mockIntakeFindFirst },
  },
}));

vi.mock('@prisma/client', () => ({
  IntakeStatus: {
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    UNDER_REVIEW: 'UNDER_REVIEW',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    NEEDS_INFO: 'NEEDS_INFO',
    EXPIRED: 'EXPIRED',
  },
}));

// Mock the client layout component to avoid React rendering issues
vi.mock('@/app/patient/PatientLayoutClient', () => ({
  default: ({ children }: { children: unknown }) => children,
}));

// ---------------------------------------------------------------------------
// Import the layout (after all mocks are declared)
// ---------------------------------------------------------------------------

import PatientLayout from '@/app/patient/layout';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setCookie(value: string | undefined): void {
  if (value === undefined) {
    mockCookieGet.mockReturnValue(undefined);
  } else {
    mockCookieGet.mockReturnValue({ value });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Patient Layout Intake Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /login when no accessToken cookie is present', async () => {
    setCookie(undefined);

    await expect(
      PatientLayout({ children: 'child' as unknown as React.ReactNode })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith('/login?from=/patient/dashboard');
  });

  it('redirects to /login when accessToken is invalid', async () => {
    setCookie('bad-token');
    mockVerifyAccessToken.mockRejectedValue(new Error('Invalid token'));

    await expect(
      PatientLayout({ children: 'child' as unknown as React.ReactNode })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith('/login?from=/patient/dashboard');
  });

  it('redirects to /intake when user has no completed intake', async () => {
    setCookie('valid-token');
    mockVerifyAccessToken.mockResolvedValue({ userId: 'user-1', role: 'PATIENT' });
    mockIntakeFindFirst.mockResolvedValue(null);

    await expect(
      PatientLayout({ children: 'child' as unknown as React.ReactNode })
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(mockRedirect).toHaveBeenCalledWith('/intake');

    // Verify the Prisma query used the correct statuses
    expect(mockIntakeFindFirst).toHaveBeenCalledTimes(1);
    const queryArg = mockIntakeFindFirst.mock.calls[0][0];
    expect(queryArg.where.patientId).toBe('user-1');
    expect(queryArg.where.status.in).toEqual(
      expect.arrayContaining(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_INFO'])
    );
    // DRAFT and EXPIRED should NOT be in the list
    expect(queryArg.where.status.in).not.toContain('DRAFT');
    expect(queryArg.where.status.in).not.toContain('EXPIRED');
  });

  it('renders children (does not redirect) when a completed intake exists', async () => {
    setCookie('valid-token');
    mockVerifyAccessToken.mockResolvedValue({ userId: 'user-2', role: 'PATIENT' });
    mockIntakeFindFirst.mockResolvedValue({ id: 'intake-1' });

    // Should NOT throw -- layout renders children
    const result = await PatientLayout({
      children: 'child-content' as unknown as React.ReactNode,
    });

    // redirect was never called
    expect(mockRedirect).not.toHaveBeenCalled();

    // The mocked PatientLayoutClient just returns children, so result
    // should be the children value itself
    expect(result).toBeDefined();
  });
});
