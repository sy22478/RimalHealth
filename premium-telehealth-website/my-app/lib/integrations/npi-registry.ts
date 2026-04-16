/**
 * NPI Registry API Client
 * Searches the CMS National Provider Identifier Registry for pharmacies.
 * Free public API — no API key required.
 *
 * No PHI involved — pharmacy business data only.
 *
 * @see https://npiregistry.cms.hhs.gov/api-page
 * @module lib/integrations/npi-registry
 */

const NPI_REGISTRY_URL = 'https://npiregistry.cms.hhs.gov/api/?version=2.1';
const REQUEST_TIMEOUT_MS = 8_000;

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

/**
 * Search the NPI Registry for pharmacies in California.
 *
 * @param params.city — city name to search
 * @param params.zip — ZIP code to search
 * @param params.limit — max results (default 20, capped at 200 by NPI API)
 */
export async function searchNpiPharmacies(
  params: NpiSearchParams
): Promise<NpiSearchResult> {
  const { city, zip, limit = 20 } = params;

  if (!city && !zip) {
    return { success: false, pharmacies: [], error: 'City or ZIP code is required' };
  }

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
      return { success: true, pharmacies: [] };
    }

    const pharmacies = data.results
      .map(normalizeResult)
      .filter((p): p is NpiPharmacy => p !== null);

    return { success: true, pharmacies };
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
