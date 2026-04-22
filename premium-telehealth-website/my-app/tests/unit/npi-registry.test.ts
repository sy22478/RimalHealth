/**
 * NPI Registry unit tests
 * Covers name param support and Valkey caching.
 *
 * @module tests/unit/npi-registry
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — need to intercept Valkey cache module before import
// ---------------------------------------------------------------------------
const { mockGetCache, mockSetCache } = vi.hoisted(() => ({
  mockGetCache: vi.fn(),
  mockSetCache: vi.fn(),
}));

vi.mock('@/lib/redis', () => ({
  getCache: mockGetCache,
  setCache: mockSetCache,
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import { searchNpiPharmacies } from '@/lib/integrations/npi-registry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FetchMockOptions {
  ok?: boolean;
  status?: number;
  body?: unknown;
}

function mockFetch(opts: FetchMockOptions = {}): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    json: async () => opts.body ?? { result_count: 0, results: [] },
  });
  globalThis.fetch = fn as unknown as typeof globalThis.fetch;
  return fn;
}

function npiResult(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    number: 1234567890,
    basic: { organization_name: 'CVS PHARMACY #1001' },
    addresses: [
      {
        address_1: '123 Main St',
        address_purpose: 'LOCATION',
        city: 'LOS ANGELES',
        state: 'CA',
        postal_code: '90210',
        telephone_number: '555-123-4567',
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('searchNpiPharmacies - name search', () => {
  beforeEach(() => {
    mockGetCache.mockReset();
    mockSetCache.mockReset();
    // Default: cache miss
    mockGetCache.mockResolvedValue(null);
    mockSetCache.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts a name parameter and sends organization_name with wildcard to NPI API', async () => {
    const fetchMock = mockFetch({ body: { result_count: 1, results: [npiResult()] } });

    const result = await searchNpiPharmacies({ name: 'CVS' });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    // Trailing * is appended so "CVS" matches legal names like "CVS PHARMACY".
    expect(url.searchParams.get('organization_name')).toBe('CVS*');
    expect(url.searchParams.get('state')).toBe('CA');
    expect(url.searchParams.get('taxonomy_description')).toBe('pharmacy');
  });

  it('combines name + zip in a single NPI query', async () => {
    const fetchMock = mockFetch({ body: { result_count: 1, results: [npiResult()] } });

    await searchNpiPharmacies({ name: 'CVS', zip: '90210' });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('organization_name')).toBe('CVS*');
    expect(url.searchParams.get('postal_code')).toBe('90210');
  });

  it('does not double up the wildcard if the caller already supplied one', async () => {
    const fetchMock = mockFetch({ body: { result_count: 0, results: [] } });

    await searchNpiPharmacies({ name: 'WALGREENS*' });

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('organization_name')).toBe('WALGREENS*');
  });

  it('returns error when no search params are provided', async () => {
    const fetchMock = mockFetch();

    const result = await searchNpiPharmacies({});

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('searchNpiPharmacies - Valkey cache', () => {
  beforeEach(() => {
    mockGetCache.mockReset();
    mockSetCache.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns cached result without calling NPI API when cache hit', async () => {
    const cached = {
      success: true,
      pharmacies: [
        {
          npiNumber: '9999999999',
          name: 'CACHED PHARMACY',
          address: '1 Cached Way',
          city: 'CACHED CITY',
          state: 'CA',
          zipCode: '90000',
          phone: '',
        },
      ],
    };
    mockGetCache.mockResolvedValue(cached);
    const fetchMock = mockFetch();

    const result = await searchNpiPharmacies({ name: 'CVS', zip: '90210' });

    expect(result).toEqual(cached);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockSetCache).not.toHaveBeenCalled();
  });

  it('calls NPI API and caches result for 24 hours on cache miss', async () => {
    mockGetCache.mockResolvedValue(null);
    mockSetCache.mockResolvedValue(undefined);
    const fetchMock = mockFetch({ body: { result_count: 1, results: [npiResult()] } });

    const result = await searchNpiPharmacies({ name: 'CVS', zip: '90210' });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockSetCache).toHaveBeenCalledTimes(1);
    const [, , ttl] = mockSetCache.mock.calls[0];
    expect(ttl).toBe(86400);
  });

  it('uses the same cache key for identical queries regardless of case', async () => {
    mockGetCache.mockResolvedValue(null);
    mockSetCache.mockResolvedValue(undefined);
    mockFetch({ body: { result_count: 0, results: [] } });

    await searchNpiPharmacies({ name: 'CVS', zip: '90210' });
    await searchNpiPharmacies({ name: 'cvs', zip: '90210' });

    const firstKey = mockGetCache.mock.calls[0][0];
    const secondKey = mockGetCache.mock.calls[1][0];
    expect(firstKey).toBe(secondKey);
  });

  it('falls back to NPI API when cache throws', async () => {
    mockGetCache.mockRejectedValue(new Error('valkey down'));
    mockSetCache.mockResolvedValue(undefined);
    const fetchMock = mockFetch({ body: { result_count: 1, results: [npiResult()] } });

    const result = await searchNpiPharmacies({ name: 'CVS' });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not cache API error responses', async () => {
    mockGetCache.mockResolvedValue(null);
    mockSetCache.mockResolvedValue(undefined);
    mockFetch({ ok: false, status: 500 });

    const result = await searchNpiPharmacies({ name: 'CVS' });

    expect(result.success).toBe(false);
    expect(mockSetCache).not.toHaveBeenCalled();
  });
});
