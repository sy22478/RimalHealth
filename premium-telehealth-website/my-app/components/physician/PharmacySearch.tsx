/**
 * PharmacySearch Component
 * Allows physicians to search for pharmacies by ZIP code and name
 * 
 * Features:
 * - ZIP code search with radius
 * - Optional pharmacy name filter
 * - Distance-based sorting
 * - 24-hour filter
 * - Pharmacy selection
 * 
 * HIPAA Compliance:
 * - No PHI displayed (pharmacy business info only)
 * - Search parameters logged without patient association
 * 
 * @module components/physician/PharmacySearch
 */

'use client';

import * as React from 'react';
import { Search, MapPin, Phone, Clock, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  ncpdpId: string;
  distance?: number;
  is24Hour?: boolean;
  isActive?: boolean;
}

interface PharmacySearchProps {
  /** Callback when a pharmacy is selected */
  onSelect: (pharmacy: Pharmacy) => void;
  /** Currently selected pharmacy ID */
  selectedId?: string;
  /** Default ZIP code */
  defaultZip?: string;
  /** Additional class names */
  className?: string;
}

interface SearchState {
  zip: string;
  name: string;
  radius: number;
  only24Hour: boolean;
}

// ============================================
// COMPONENT
// ============================================

export function PharmacySearch({
  onSelect,
  selectedId,
  defaultZip = '',
  className,
}: PharmacySearchProps): React.ReactElement {
  // Form state
  const [searchState, setSearchState] = React.useState<SearchState>({
    zip: defaultZip,
    name: '',
    radius: 10,
    only24Hour: false,
  });

  // Results state
  const [pharmacies, setPharmacies] = React.useState<Pharmacy[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasSearched, setHasSearched] = React.useState(false);

  // ============================================
  // SEARCH HANDLER
  // ============================================

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();

    // Validate ZIP code
    if (!/^\d{5}(-\d{4})?$/.test(searchState.zip)) {
      setError('Please enter a valid ZIP code');
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({
        zip: searchState.zip,
        radius: searchState.radius.toString(),
        limit: '20',
      });

      if (searchState.name.trim()) {
        params.append('name', searchState.name.trim());
      }

      const response = await fetch(`/api/physician/pharmacies/search?${params}`, {
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search pharmacies');
      }

      let results = data.pharmacies as Pharmacy[];

      // Filter 24-hour pharmacies if requested
      if (searchState.only24Hour) {
        results = results.filter((p) => p.is24Hour);
      }

      setPharmacies(results);

      if (results.length === 0) {
        setError('No pharmacies found. Try expanding your search radius.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search pharmacies');
      setPharmacies([]);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const formatDistance = (distance?: number): string => {
    if (distance === undefined) return '';
    return `${distance.toFixed(1)} mi`;
  };

  const formatPhone = (phone: string): string => {
    // Simple phone formatting
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-ocean-500" />
          Find a Pharmacy
        </CardTitle>
        <CardDescription>
          Search for pharmacies near your patient&apos;s location
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search Form */}
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* ZIP Code */}
            <div className="space-y-2">
              <label htmlFor="zip" className="text-sm font-medium">
                ZIP Code <span className="text-red-500">*</span>
              </label>
              <Input
                id="zip"
                type="text"
                placeholder="90210"
                value={searchState.zip}
                onChange={(e) =>
                  setSearchState((prev) => ({ ...prev, zip: e.target.value }))
                }
                maxLength={10}
                disabled={isLoading}
              />
            </div>

            {/* Radius */}
            <div className="space-y-2">
              <label htmlFor="radius" className="text-sm font-medium">
                Search Radius
              </label>
              <select
                id="radius"
                value={searchState.radius}
                onChange={(e) =>
                  setSearchState((prev) => ({
                    ...prev,
                    radius: parseInt(e.target.value, 10),
                  }))
                }
                disabled={isLoading}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ocean-500"
              >
                <option value={5}>5 miles</option>
                <option value={10}>10 miles</option>
                <option value={20}>20 miles</option>
                <option value={50}>50 miles</option>
              </select>
            </div>
          </div>

          {/* Name Filter */}
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Pharmacy Name (optional)
            </label>
            <Input
              id="name"
              type="text"
              placeholder="e.g., Walgreens, CVS..."
              value={searchState.name}
              onChange={(e) =>
                setSearchState((prev) => ({ ...prev, name: e.target.value }))
              }
              disabled={isLoading}
            />
          </div>

          {/* 24-Hour Filter */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="24hour"
              checked={searchState.only24Hour}
              onChange={(e) =>
                setSearchState((prev) => ({
                  ...prev,
                  only24Hour: e.target.checked,
                }))
              }
              disabled={isLoading}
              className="rounded border-input text-ocean-500 focus:ring-ocean-500"
            />
            <label htmlFor="24hour" className="text-sm">
              24-hour pharmacies only
            </label>
          </div>

          {/* Search Button */}
          <Button
            type="submit"
            disabled={isLoading || !searchState.zip}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search Pharmacies
              </>
            )}
          </Button>
        </form>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Results */}
        {hasSearched && pharmacies.length > 0 && (
          <div className="space-y-3 mt-4">
            <div className="text-sm text-muted-foreground">
              Found {pharmacies.length} pharmac{pharmacies.length !== 1 ? 'ies' : 'y'}
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {pharmacies.map((pharmacy) => (
                <div
                  key={pharmacy.id}
                  className={cn(
                    'relative p-4 rounded-lg border transition-all cursor-pointer',
                    selectedId === pharmacy.id
                      ? 'border-ocean-500 bg-ocean-50'
                      : 'border-border hover:border-ocean-300 hover:bg-accent',
                    !pharmacy.isActive && 'opacity-60'
                  )}
                  onClick={() => onSelect(pharmacy)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onSelect(pharmacy);
                    }
                  }}
                >
                  {/* Selected Indicator */}
                  {selectedId === pharmacy.id && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-5 w-5 text-ocean-500" />
                    </div>
                  )}

                  <div className="space-y-2">
                    {/* Name & Distance */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-sm">{pharmacy.name}</h3>
                        {pharmacy.distance !== undefined && (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            {formatDistance(pharmacy.distance)}
                          </Badge>
                        )}
                      </div>
                      {pharmacy.is24Hour && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="mr-1 h-3 w-3" />
                          24hr
                        </Badge>
                      )}
                    </div>

                    {/* Address */}
                    <div className="text-sm text-muted-foreground">
                      <p>{pharmacy.address}</p>
                      <p>
                        {pharmacy.city}, {pharmacy.state} {pharmacy.zip}
                      </p>
                    </div>

                    {/* Phone */}
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`tel:${pharmacy.phone}`}
                        className="text-ocean-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {formatPhone(pharmacy.phone)}
                      </a>
                    </div>

                    {/* NCPDP ID (for reference) */}
                    <p className="text-xs text-muted-foreground">
                      NCPDP: {pharmacy.ncpdpId}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PharmacySearch;
