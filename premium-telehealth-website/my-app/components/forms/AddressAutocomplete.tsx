'use client';

import * as React from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface AddressAutocompleteSuggestion {
  text: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
}

export interface AddressAutocompleteProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: AddressAutocompleteSuggestion) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-label'?: string;
  autoComplete?: string;
  minLength?: number;
  debounceMs?: number;
}

const DEFAULT_MIN_LENGTH = 3;
const DEFAULT_DEBOUNCE_MS = 300;

export function AddressAutocomplete({
  id,
  value,
  onChange,
  onSelect,
  placeholder,
  disabled = false,
  className,
  inputClassName,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel,
  autoComplete = 'off',
  minLength = DEFAULT_MIN_LENGTH,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: AddressAutocompleteProps): React.ReactElement {
  const [suggestions, setSuggestions] = React.useState<AddressAutocompleteSuggestion[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [highlightIndex, setHighlightIndex] = React.useState(-1);
  const [suppressNextFetch, setSuppressNextFetch] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const listboxId = React.useId();

  // Fetch suggestions (debounced).
  React.useEffect(() => {
    if (suppressNextFetch) {
      // The user just picked a suggestion — skip this value change.
      setSuppressNextFetch(false);
      return;
    }

    const query = value.trim();
    if (query.length < minLength) {
      setSuggestions([]);
      setLoading(false);
      setErrorMsg(null);
      return;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setErrorMsg(null);

      try {
        const res = await fetch('/api/patient/address/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ query }),
          signal: controller.signal,
        });

        if (res.status === 429) {
          setSuggestions([]);
          setErrorMsg('Too many lookups. Please wait and try again.');
          setOpen(true);
          return;
        }

        if (res.status === 502) {
          // Upstream Amazon Location Service call failed (likely missing IAM perms).
          // Show a clear "unavailable" message so users don't think their address
          // is simply unknown.
          setSuggestions([]);
          setErrorMsg('Address suggestions unavailable');
          setOpen(true);
          return;
        }

        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }

        const data = await res.json();
        const list: AddressAutocompleteSuggestion[] = Array.isArray(data.suggestions)
          ? data.suggestions
          : [];
        setSuggestions(list);
        setHighlightIndex(list.length > 0 ? 0 : -1);
        setOpen(true);
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        console.error(
          'AddressAutocomplete fetch failed:',
          err instanceof Error ? err.message : 'Unknown error'
        );
        setSuggestions([]);
        setErrorMsg('Could not load suggestions.');
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, minLength, debounceMs, suppressNextFetch]);

  // Close on outside click.
  React.useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent): void => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const handleSelect = (suggestion: AddressAutocompleteSuggestion): void => {
    setSuppressNextFetch(true);
    onChange(suggestion.street || suggestion.text);
    onSelect(suggestion);
    setSuggestions([]);
    setHighlightIndex(-1);
    setOpen(false);
    setErrorMsg(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      if (suggestions.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setHighlightIndex((prev) => (prev + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      if (suggestions.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setHighlightIndex((prev) =>
        prev <= 0 ? suggestions.length - 1 : prev - 1
      );
    } else if (event.key === 'Enter') {
      if (!open || highlightIndex < 0 || !suggestions[highlightIndex]) return;
      event.preventDefault();
      handleSelect(suggestions[highlightIndex]);
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
    }
  };

  const hasDropdown =
    open && (loading || errorMsg !== null || suggestions.length > 0);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={hasDropdown}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={
          highlightIndex >= 0 && suggestions[highlightIndex]
            ? `${listboxId}-option-${highlightIndex}`
            : undefined
        }
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        onChange={(e) => {
          onChange(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          if (suggestions.length > 0 || errorMsg) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className={inputClassName}
      />

      {loading && (
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        </div>
      )}

      {hasDropdown && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md"
        >
          {suggestions.length === 0 && !loading && errorMsg && (
            <div className="px-3 py-2 text-sm text-muted-foreground" role="alert">
              {errorMsg}
            </div>
          )}
          {suggestions.length === 0 && !loading && !errorMsg && value.trim().length >= minLength && (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No matching California addresses.
            </div>
          )}
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.text}-${index}`}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === highlightIndex}
              className={cn(
                'flex cursor-pointer items-start gap-2 px-3 py-2 text-sm',
                index === highlightIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground'
              )}
              onMouseDown={(e) => {
                // Prevent input blur from closing the dropdown before the click lands.
                e.preventDefault();
                handleSelect(suggestion);
              }}
              onMouseEnter={() => setHighlightIndex(index)}
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{suggestion.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AddressAutocomplete;
