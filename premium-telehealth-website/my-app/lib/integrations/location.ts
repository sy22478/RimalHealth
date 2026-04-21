/**
 * Amazon Location Service — Address Validation
 *
 * Uses the ECS task role for authentication — no explicit credentials needed.
 * Place index `rimalhealth-address-validation` (Esri provider) in us-east-1.
 *
 * No PHI involved — address validation data only.
 *
 * @module lib/integrations/location
 */

import {
  LocationClient,
  SearchPlaceIndexForTextCommand,
  SearchPlaceIndexForSuggestionsCommand,
  GetPlaceCommand,
} from '@aws-sdk/client-location';

// ============================================================================
// Client (singleton)
// ============================================================================

const LOCATION_TIMEOUT_MS = 8_000;

const locationClient = new LocationClient({
  region: process.env.AWS_REGION || 'us-east-1',
  requestHandler: { requestTimeout: LOCATION_TIMEOUT_MS },
  // No credentials needed — ECS task role provides them automatically
});

const PLACE_INDEX =
  process.env.AWS_LOCATION_PLACE_INDEX || 'rimalhealth-address-validation';

// ============================================================================
// Types
// ============================================================================

export interface AddressSuggestion {
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
}

interface ValidateAddressParams {
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface ValidateAddressResult {
  valid: boolean;
  suggestions: AddressSuggestion[];
  error?: string;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Validate an address using Amazon Location Service.
 * Enforces California-only: rejects results outside CA.
 */
export async function validateAddress(
  params: ValidateAddressParams
): Promise<ValidateAddressResult> {
  const { street, city, state, zip } = params;
  const searchText = `${street}, ${city}, ${state} ${zip}`;

  try {
    const command = new SearchPlaceIndexForTextCommand({
      IndexName: PLACE_INDEX,
      Text: searchText,
      FilterCountries: ['USA'],
      MaxResults: 5,
    });

    const response = await locationClient.send(command);
    const results = response.Results ?? [];

    if (results.length === 0) {
      return { valid: false, suggestions: [] };
    }

    const suggestions: AddressSuggestion[] = results
      .filter((r) => {
        const place = r.Place;
        if (!place) return false;
        // Enforce California-only
        const region = place.Region ?? '';
        return region === 'California' || region === 'CA';
      })
      .map((r) => {
        const place = r.Place!;
        const [lng, lat] = place.Geometry?.Point ?? [0, 0];
        const addressParts = [place.AddressNumber, place.Street].filter(Boolean);
        return {
          label: place.Label ?? '',
          street: addressParts.join(' '),
          city: place.Municipality ?? '',
          state: 'CA',
          zipCode: place.PostalCode ?? '',
          latitude: lat,
          longitude: lng,
        };
      });

    // An address is valid if the top result is in California
    const topResult = results[0]?.Place;
    const topRegion = topResult?.Region ?? '';
    const isValid = topRegion === 'California' || topRegion === 'CA';

    return { valid: isValid, suggestions };
  } catch (error) {
    console.error(
      'Address validation error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return {
      valid: false,
      suggestions: [],
      error: error instanceof Error ? error.message : 'Address validation failed',
    };
  }
}

// ============================================================================
// Typeahead suggestions
// ============================================================================

export interface AddressSuggestionResult {
  text: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
}

export interface GetSuggestionsResult {
  suggestions: AddressSuggestionResult[];
  error?: string;
}

const MAX_SUGGESTIONS = 5;

/**
 * Return typeahead address suggestions from Amazon Location Service.
 * Uses SearchPlaceIndexForSuggestions (cheap) then GetPlace per candidate to
 * hydrate structured components. Filtered to California results only.
 */
export async function getSuggestions(query: string): Promise<GetSuggestionsResult> {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return { suggestions: [] };
  }

  try {
    const suggestCmd = new SearchPlaceIndexForSuggestionsCommand({
      IndexName: PLACE_INDEX,
      Text: trimmed,
      FilterCountries: ['USA'],
      MaxResults: MAX_SUGGESTIONS,
    });

    const suggestResponse = await locationClient.send(suggestCmd);
    const candidates = (suggestResponse.Results ?? []).filter((r) => r.PlaceId);

    if (candidates.length === 0) {
      return { suggestions: [] };
    }

    const places = await Promise.all(
      candidates.map(async (candidate) => {
        try {
          const placeResponse = await locationClient.send(
            new GetPlaceCommand({
              IndexName: PLACE_INDEX,
              PlaceId: candidate.PlaceId!,
            })
          );
          return { candidate, place: placeResponse.Place };
        } catch (err) {
          console.error(
            'GetPlace failed:',
            err instanceof Error ? err.message : 'Unknown error'
          );
          return { candidate, place: undefined };
        }
      })
    );

    const suggestions: AddressSuggestionResult[] = places
      .filter(({ place }) => {
        if (!place) return false;
        const region = place.Region ?? '';
        return region === 'California' || region === 'CA';
      })
      .map(({ candidate, place }) => {
        const p = place!;
        const [lng, lat] = p.Geometry?.Point ?? [undefined, undefined];
        const addressParts = [p.AddressNumber, p.Street].filter(Boolean);
        return {
          text: p.Label ?? candidate.Text ?? '',
          street: addressParts.join(' '),
          city: p.Municipality ?? '',
          state: 'CA',
          zipCode: p.PostalCode ?? '',
          latitude: typeof lat === 'number' ? lat : undefined,
          longitude: typeof lng === 'number' ? lng : undefined,
        };
      });

    return { suggestions };
  } catch (error) {
    console.error(
      'Address suggestions error:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return {
      suggestions: [],
      error: error instanceof Error ? error.message : 'Address suggestions failed',
    };
  }
}
