'use client';

import * as React from 'react';
import { Search, MapPin, Phone, Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface SelectedPharmacy {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
}

export interface PatientPharmacySearchProps {
  onSelect: (pharmacy: SelectedPharmacy) => void;
  currentPharmacyId?: string | null;
  currentPharmacyName?: string | null;
  disabled?: boolean;
}

interface NpiSearchResult {
  npiNumber: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  id?: string;
  source?: 'npi' | 'local';
}

// ============================================================================
// Component
// ============================================================================

export function PatientPharmacySearch({
  onSelect,
  currentPharmacyId,
  currentPharmacyName,
  disabled = false,
}: PatientPharmacySearchProps): React.ReactElement {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<NpiSearchResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedNpi, setSelectedNpi] = React.useState<string | null>(null);
  const [selectingNpi, setSelectingNpi] = React.useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent | React.MouseEvent): Promise<void> => {
    e?.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const params = new URLSearchParams();
      // Detect ZIP vs city
      if (/^\d/.test(trimmed)) {
        params.set('zip', trimmed);
      } else {
        params.set('q', trimmed);
      }

      const res = await fetch(`/api/patient/pharmacies/search?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Search failed');
      }

      const data = await res.json();
      const pharmacies = Array.isArray(data.pharmacies) ? data.pharmacies : [];
      setResults(pharmacies);
    } catch {
      setError('Failed to search pharmacies. Please try again.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = async (pharmacy: NpiSearchResult): Promise<void> => {
    const npiKey = pharmacy.npiNumber || pharmacy.id || '';
    setSelectingNpi(npiKey);

    try {
      // If the pharmacy came from NPI, persist it via the select endpoint
      if (pharmacy.npiNumber) {
        const res = await fetch('/api/patient/pharmacies/select', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            npiNumber: pharmacy.npiNumber,
            name: pharmacy.name,
            address: pharmacy.address,
            city: pharmacy.city,
            state: pharmacy.state,
            zipCode: pharmacy.zipCode,
            phone: pharmacy.phone || '',
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to select pharmacy');
        }

        const data = await res.json();
        setSelectedNpi(npiKey);
        onSelect(data.pharmacy);
      } else {
        // Local DB pharmacy — already persisted
        setSelectedNpi(npiKey);
        onSelect({
          id: pharmacy.id ?? '',
          name: pharmacy.name,
          address: pharmacy.address,
          city: pharmacy.city,
          state: pharmacy.state,
          zipCode: pharmacy.zipCode,
          phone: pharmacy.phone || '',
        });
      }
    } catch {
      setError('Failed to select pharmacy. Please try again.');
    } finally {
      setSelectingNpi(null);
    }
  };

  const formatPhone = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-ocean-500" />
          Find a Pharmacy
        </CardTitle>
        <CardDescription>
          Search by city name or ZIP code to find California pharmacies.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Currently selected pharmacy */}
        {currentPharmacyName && !hasSearched && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600 shrink-0" />
            <span className="text-sm text-green-800">
              Current pharmacy: <span className="font-medium">{currentPharmacyName}</span>
            </span>
          </div>
        )}

        {/* Search controls — use a div + button click instead of a nested <form>.
            The intake page wraps every step in a React Hook Form <form>, and the
            browser strips any inner <form>, so a nested form submit never fired
            the search handler. */}
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter city name or ZIP code..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleSearch();
              }
            }}
            disabled={disabled || isLoading}
            className="flex-1"
          />
          <Button
            type="button"
            onClick={() => void handleSearch()}
            disabled={disabled || isLoading || query.trim().length < 2}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Search</span>
          </Button>
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error} Try a different city or ZIP code.
            </AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {hasSearched && !isLoading && results.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Found {results.length} pharmac{results.length !== 1 ? 'ies' : 'y'}
            </p>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {results.map((pharmacy) => {
                const key = pharmacy.npiNumber || pharmacy.id || pharmacy.name;
                const isSelected =
                  selectedNpi === key ||
                  (currentPharmacyId && pharmacy.id === currentPharmacyId);
                const isSelecting = selectingNpi === key;

                return (
                  <div
                    key={key}
                    className={cn(
                      'relative p-4 rounded-lg border transition-all cursor-pointer',
                      isSelected
                        ? 'border-green-400 bg-green-50'
                        : 'border-border hover:border-ocean-300 hover:bg-accent'
                    )}
                    onClick={() => !isSelecting && handleSelect(pharmacy)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !isSelecting) {
                        handleSelect(pharmacy);
                      }
                    }}
                  >
                    {/* Selected indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <Check className="h-5 w-5 text-green-600" />
                      </div>
                    )}

                    {/* Selecting spinner */}
                    {isSelecting && (
                      <div className="absolute top-2 right-2">
                        <Loader2 className="h-5 w-5 animate-spin text-ocean-500" />
                      </div>
                    )}

                    <div className="space-y-1.5 pr-8">
                      <h3 className="font-semibold text-sm">{pharmacy.name}</h3>

                      <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>
                          {pharmacy.address}, {pharmacy.city}, {pharmacy.state} {pharmacy.zipCode}
                        </span>
                      </div>

                      {pharmacy.phone && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{formatPhone(pharmacy.phone)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {hasSearched && !isLoading && results.length === 0 && !error && (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p>No pharmacies found for this search.</p>
            <p className="mt-1">Try a different city name or ZIP code.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PatientPharmacySearch;
