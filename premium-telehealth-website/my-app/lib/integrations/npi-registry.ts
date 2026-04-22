/**
 * NPI Registry API Client
 * Searches the CMS National Provider Identifier Registry for pharmacies.
 * Free public API — no API key required.
 *
 * No PHI involved — pharmacy business data only.
 *
 * Results are cached in Valkey for 24 hours to reduce API load. Cache
 * failures fall back to direct API calls (best-effort caching).
 *
 * @see https://npiregistry.cms.hhs.gov/api-page
 * @module lib/integrations/npi-registry
 */

import { createHash } from 'crypto';
import { getCache, setCache } from '@/lib/redis';

const NPI_REGISTRY_URL = 'https://npiregistry.cms.hhs.gov/api/?version=2.1';
const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_TTL_SECONDS = 86_400; // 24 hours

// ============================================================================
// Types
// ============================================================================

export interface NpiPharmacy {
  npiNumber: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
}

interface NpiSearchParams {
  city?: string;
  zip?: string;
  name?: string;
  limit?: number;
}

interface NpiSearchResult {
  success: boolean;
  pharmacies: NpiPharmacy[];
  error?: string;
}

interface NpiAddress {
  address_1: string;
  address_2?: string;
  city: string;
  state: string;
  postal_code: string;
  telephone_number?: string;
  address_purpose: string;
}

interface NpiResult {
  number: number;
  basic?: {
    organization_name?: string;
    name?: string;
  };
  addresses?: NpiAddress[];
}

interface NpiApiResponse {
  result_count: number;
  results?: NpiResult[];
}

// ============================================================================
// Implementation
// ============================================================================

function findLocationAddress(addresses: NpiAddress[]): NpiAddress {
  return (
    addresses.find((a) => a.address_purpose === 'LOCATION') ?? addresses[0]
  );
}

function formatPhone(raw?: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function normalizeResult(result: NpiResult): NpiPharmacy | null {
  const name = result.basic?.organization_name;
  if (!name) return null;

  const addresses = result.addresses;
  if (!Array.isArray(addresses) || addresses.length === 0) return null;

  const addr = findLocationAddress(addresses);

  return {
    npiNumber: String(result.number),
    name,
    address: [addr.address_1, addr.address_2].filter(Boolean).join(', '),
    city: addr.city,
    state: addr.state,
    zipCode: addr.postal_code?.substring(0, 5) ?? '',
    phone: formatPhone(addr.telephone_number),
  };
}

function buildCacheKey(params: Pick<NpiSearchParams, 'city' | 'zip' | 'name' | 'limit'>): string {
  const normalized = [
    (params.city ?? '').trim().toLowerCase(),
    (params.zip ?? '').trim().toLowerCase(),
    (params.name ?? '').trim().toLowerCase(),
    String(params.limit ?? 20),
  ].join('|');
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  return `npi:search:${hash}`;
}

async function readCache(key: string): Promise<NpiSearchResult | null> {
  try {
    return await getCache<NpiSearchResult>(key);
  } catch (error) {
    console.debug(
      '[npi-registry] cache read failed, falling back to API:',
      error instanceof Error ? error.message : 'unknown'
    );
    return null;
  }
}

async function writeCache(key: string, value: NpiSearchResult): Promise<void> {
  try {
    await setCache(key, value, CACHE_TTL_SECONDS);
  } catch (error) {
    console.debug(
      '[npi-registry] cache write failed:',
      error instanceof Error ? error.message : 'unknown'
    );
  }
}

/**
 * Search the NPI Registry for pharmacies in California.
 *
 * Results are cached in Valkey for 24 hours by normalized query. Cache
 * failures are swallowed; the live API is always the source of truth.
 *
 * @param params.city — city name to search
 * @param params.zip — ZIP code to search
 * @param params.name — pharmacy organization name (e.g., "CVS")
 * @param params.limit — max results (default 20, capped at 200 by NPI API)
 */
export async function searchNpiPharmacies(
  params: NpiSearchParams
): Promise<NpiSearchResult> {
  const { city, zip, name, limit = 20 } = params;

  if (!city && !zip && !name) {
    return {
      success: false,
      pharmacies: [],
      error: 'City, ZIP code, or pharmacy name is required',
    };
  }

  const cacheKey = buildCacheKey({ city, zip, name, limit });
  const cached = await readCache(cacheKey);
  if (cached) {
    console.debug('[npi-registry] cache hit', cacheKey);
    return cached;
  }
  console.debug('[npi-registry] cache miss', cacheKey);

  const url = new URL(NPI_REGISTRY_URL);
  url.searchParams.set('taxonomy_description', 'pharmacy');
  url.searchParams.set('enumeration_type', 'NPI-2');
  url.searchParams.set('state', 'CA');
  url.searchParams.set('limit', String(Math.min(limit, 200)));

  if (zip) {
    url.searchParams.set('postal_code', zip.substring(0, 5));
  }
  if (city) {
    url.searchParams.set('city', city);
  }
  if (name) {
    // Pharmacies register under legal names ("CVS PHARMACY", "WALGREENS #1234"),
    // not the brand word alone. Append a trailing * so "CVS" matches "CVS PHARMACY",
    // "CVS/PHARMACY", etc. The NPI Registry API treats `*` as a wildcard.
    const query = name.endsWith('*') ? name : `${name}*`;
    url.searchParams.set('organization_name', query);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return {
        success: false,
        pharmacies: [],
        error: `NPI Registry returned status ${response.status}`,
      };
    }

    const data: NpiApiResponse = await response.json();

    if (!data.results || !Array.isArray(data.results)) {
      const empty: NpiSearchResult = { success: true, pharmacies: [] };
      await writeCache(cacheKey, empty);
      return empty;
    }

    const pharmacies = data.results
      .map(normalizeResult)
      .filter((p): p is NpiPharmacy => p !== null);

    const result: NpiSearchResult = { success: true, pharmacies };
    await writeCache(cacheKey, result);
    return result;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { success: false, pharmacies: [], error: 'NPI Registry request timed out' };
    }
    return {
      success: false,
      pharmacies: [],
      error: error instanceof Error ? error.message : 'Unknown NPI Registry error',
    };
  } finally {
    clearTimeout(timeout);
  }
}
