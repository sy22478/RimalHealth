'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  AlertCircle,
  User,
  MapPin,
  FileText,
  Pill,
  AlertTriangle,
  Building2,
  X,
  ChevronDown,
  Lock,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { Button } from '@/components/ui/button';
import { PatientPharmacySearch, SelectedPharmacy } from '@/components/patient/PharmacySearch';

// ============================================================================
// Preset Options
// ============================================================================

const MEDICAL_CONDITIONS_PRESETS = [
  'Hypertension',
  'Diabetes Type 2',
  'Asthma',
  'Depression',
  'Anxiety',
  'Heart Disease',
  'Liver Disease',
  'Kidney Disease',
  'Seizure Disorder',
  'Thyroid Disorder',
];

const MEDICATIONS_PRESETS = [
  'Lisinopril',
  'Metformin',
  'Amlodipine',
  'Omeprazole',
  'Sertraline',
  'Escitalopram',
  'Gabapentin',
  'Ibuprofen',
  'Acetaminophen',
  'Aspirin',
];

const ALLERGIES_PRESETS = [
  'Penicillin',
  'Sulfa',
  'Aspirin',
  'NSAIDs',
  'Codeine',
  'Latex',
  'Shellfish',
  'Peanuts',
  'None',
];

// ============================================================================
// Validation Schema
// ============================================================================

const personalInfoSchema = z.object({
  firstName: z.string()
    .max(100, 'First name must be under 100 characters')
    .optional().or(z.literal('')),
  lastName: z.string()
    .max(100, 'Last name must be under 100 characters')
    .optional().or(z.literal('')),
  dateOfBirth: z.string()
    .max(50, 'Date is too long')
    .optional().or(z.literal('')),
  phone: z.string()
    .max(30, 'Phone number is too long')
    .optional().or(z.literal('')),
  addressStreet: z.string()
    .max(200, 'Address must be under 200 characters')
    .optional().or(z.literal('')),
  addressCity: z.string()
    .max(100, 'City must be under 100 characters')
    .regex(/^[a-zA-Z\s\-'.]*$/, { message: 'City name contains invalid characters' })
    .optional().or(z.literal('')),
  addressState: z.enum(['CA', '']).optional().or(z.literal('CA')),
  addressZip: z.string()
    .max(10, 'ZIP code is too long')
    .refine((val) => {
      if (!val) return true; // optional field
      const n = parseInt(val.substring(0, 5), 10);
      return n >= 90001 && n <= 96162;
    }, { message: 'Must be a valid California ZIP code (90001-96162)' })
    .optional().or(z.literal('')),
  medicalHistory: z.string()
    .max(2000, 'Medical history must be under 2000 characters')
    .optional(),
  currentMedications: z.string()
    .max(1000, 'Medications must be under 1000 characters')
    .optional(),
  allergies: z.string()
    .max(500, 'Allergies must be under 500 characters')
    .optional(),
  preferredPharmacyId: z.string().optional().or(z.literal('')),
});

type PersonalInfoFormValues = z.infer<typeof personalInfoSchema>;

// ============================================================================
// Types
// ============================================================================

interface ProfileData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  dateOfBirth: string;
  phone: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  medicalHistory: string | null;
  currentMedications: string | null;
  allergies: string | null;
  primaryConcern: string | null;
  treatmentGoal: string | null;
  pharmacy: {
    name: string;
    address: string;
    city: string;
    zip: string;
    phone?: string;
    source: 'pharmacy_record' | 'intake';
  } | null;
}

interface PersonalInfoFormProps {
  profile: ProfileData;
  onUpdate: (updatedData: Partial<ProfileData>) => void;
}

// ============================================================================
// Multi-Select Combobox Component
// ============================================================================

interface MultiSelectComboboxProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  presets: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
}

function MultiSelectCombobox({
  id,
  label,
  icon,
  presets,
  value,
  onChange,
  placeholder,
  error,
}: MultiSelectComboboxProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Parse comma-separated string into array of items
  const selectedItems = React.useMemo((): string[] => {
    const str = typeof value === 'string' ? value : '';
    if (!str || str.trim() === '') return [];
    return str.split(',').map((item) => item.trim()).filter(Boolean);
  }, [value]);

  // Filter presets based on search query, excluding already-selected items
  const filteredPresets = React.useMemo((): string[] => {
    const lowerQuery = searchQuery.toLowerCase();
    return presets.filter(
      (preset) =>
        !selectedItems.some((s) => s.toLowerCase() === preset.toLowerCase()) &&
        (lowerQuery === '' || preset.toLowerCase().includes(lowerQuery))
    );
  }, [presets, selectedItems, searchQuery]);

  // Check if search query is a new custom value (not matching any preset or existing selection)
  const canAddCustom = React.useMemo((): boolean => {
    const trimmed = searchQuery.trim();
    if (trimmed.length === 0) return false;
    const lowerTrimmed = trimmed.toLowerCase();
    // Not already selected
    if (selectedItems.some((s) => s.toLowerCase() === lowerTrimmed)) return false;
    // Not matching an existing preset exactly
    if (presets.some((p) => p.toLowerCase() === lowerTrimmed)) return false;
    return true;
  }, [searchQuery, selectedItems, presets]);

  // Add an item
  const addItem = React.useCallback(
    (item: string): void => {
      const trimmed = item.trim();
      if (!trimmed) return;
      // Prevent duplicates (case-insensitive)
      if (selectedItems.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return;
      const newItems = [...selectedItems, trimmed];
      onChange(newItems.join(', '));
      setSearchQuery('');
      inputRef.current?.focus();
    },
    [selectedItems, onChange]
  );

  // Remove an item
  const removeItem = React.useCallback(
    (item: string): void => {
      const newItems = selectedItems.filter(
        (s) => s.toLowerCase() !== item.toLowerCase()
      );
      onChange(newItems.join(', '));
    },
    [selectedItems, onChange]
  );

  // Handle keyboard events
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const trimmed = searchQuery.trim();
        if (trimmed) {
          // If the search query matches a filtered preset, add that
          const matchingPreset = filteredPresets.find(
            (p) => p.toLowerCase() === trimmed.toLowerCase()
          );
          addItem(matchingPreset || trimmed);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchQuery('');
      } else if (
        e.key === 'Backspace' &&
        searchQuery === '' &&
        selectedItems.length > 0
      ) {
        // Remove last item on backspace when input is empty
        removeItem(selectedItems[selectedItems.length - 1]);
      }
    },
    [searchQuery, filteredPresets, addItem, removeItem, selectedItems]
  );

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent): void {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Label htmlFor={id} className="flex items-center gap-2">
        {icon}
        {label}
      </Label>

      {/* Selected tags + input area */}
      <div
        className={`mt-1.5 flex flex-wrap items-center gap-1.5 min-h-[42px] rounded-md border px-3 py-2 cursor-text transition-colors ${
          isOpen
            ? 'border-ocean-400 ring-2 ring-ocean-100'
            : error
              ? 'border-red-300'
              : 'border-input hover:border-ocean-300'
        } bg-background`}
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
      >
        {selectedItems.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 bg-ocean-50 text-ocean-700 text-sm px-2 py-0.5 rounded-md border border-ocean-200"
          >
            {item}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeItem(item);
              }}
              className="text-ocean-400 hover:text-ocean-700 transition-colors"
              aria-label={`Remove ${item}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="flex-1 min-w-[120px] flex items-center gap-1">
          <input
            ref={inputRef}
            id={id}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={selectedItems.length === 0 ? placeholder : 'Type to add...'}
            className="flex-1 outline-none bg-transparent text-sm placeholder:text-muted-foreground"
            autoComplete="off"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
          />
          <ChevronDown
            className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (filteredPresets.length > 0 || canAddCustom) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
            role="listbox"
            aria-label={`${label} options`}
          >
            {filteredPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => addItem(preset)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-ocean-50 hover:text-ocean-700 transition-colors"
              >
                {preset}
              </button>
            ))}
            {canAddCustom && (
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => addItem(searchQuery.trim())}
                className="w-full text-left px-3 py-2 text-sm hover:bg-ocean-50 hover:text-ocean-700 transition-colors border-t border-gray-100"
              >
                <span className="text-gray-500">Add custom:</span>{' '}
                <span className="font-medium">{searchQuery.trim()}</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.p
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-red-500 mt-1.5"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function PersonalInfoForm({ profile, onUpdate }: PersonalInfoFormProps): React.ReactElement {
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);

  // Pharmacy state
  const [selectedPharmacy, setSelectedPharmacy] = React.useState<SelectedPharmacy | null>(null);
  const [showPharmacySearch, setShowPharmacySearch] = React.useState(!profile.pharmacy);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<PersonalInfoFormValues>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      dateOfBirth: profile.dateOfBirth || '',
      phone: profile.phone || '',
      addressStreet: profile.addressStreet || '',
      addressCity: profile.addressCity || '',
      addressState: 'CA' as const,
      addressZip: profile.addressZip || '',
      medicalHistory: profile.medicalHistory || '',
      currentMedications: profile.currentMedications || '',
      allergies: profile.allergies || '',
      preferredPharmacyId: '',
    },
  });

  // Watch medical fields for the combobox components
  const medicalHistoryValue = watch('medicalHistory') || '';
  const currentMedicationsValue = watch('currentMedications') || '';
  const allergiesValue = watch('allergies') || '';

  // Reset form when profile changes
  React.useEffect(() => {
    reset({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      dateOfBirth: profile.dateOfBirth || '',
      phone: profile.phone || '',
      addressStreet: profile.addressStreet || '',
      addressCity: profile.addressCity || '',
      addressState: 'CA' as const,
      addressZip: profile.addressZip || '',
      medicalHistory: profile.medicalHistory || '',
      currentMedications: profile.currentMedications || '',
      allergies: profile.allergies || '',
      preferredPharmacyId: '',
    });
    setSelectedPharmacy(null);
    setShowPharmacySearch(!profile.pharmacy);
  }, [profile, reset]);

  // Derive display pharmacy for the current pharmacy section
  const displayPharmacy = selectedPharmacy
    ? { name: selectedPharmacy.name, address: `${selectedPharmacy.address}, ${selectedPharmacy.city}, ${selectedPharmacy.state} ${selectedPharmacy.zipCode}`, phone: selectedPharmacy.phone }
    : profile.pharmacy
      ? { name: profile.pharmacy.name, address: [profile.pharmacy.address, profile.pharmacy.city, 'CA', profile.pharmacy.zip].filter(Boolean).join(', '), phone: profile.pharmacy.phone ?? null }
      : null;

  // Handle pharmacy selection from search component
  const handlePharmacySelect = React.useCallback((pharmacy: SelectedPharmacy): void => {
    setSelectedPharmacy(pharmacy);
    setValue('preferredPharmacyId', pharmacy.id);
    setShowPharmacySearch(false);
  }, [setValue]);

  // Address validation state
  const [addressValidating, setAddressValidating] = React.useState(false);
  const [addressValid, setAddressValid] = React.useState<boolean | null>(null);
  const [addressSuggestions, setAddressSuggestions] = React.useState<Array<{
    label: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
  }>>([]);

  const handleVerifyAddress = async (): Promise<void> => {
    const street = watch('addressStreet');
    const city = watch('addressCity');
    const zip = watch('addressZip');

    if (!street || !city || !zip) return;

    setAddressValidating(true);
    setAddressValid(null);
    setAddressSuggestions([]);

    try {
      const res = await fetch('/api/patient/address/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ street, city, state: 'CA', zip }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          setAddressValid(false);
          setAddressSuggestions(data.suggestions);
        } else {
          setAddressValid(false);
        }
        return;
      }

      const data = await res.json();
      setAddressValid(data.valid);
      if (!data.valid && Array.isArray(data.suggestions)) {
        setAddressSuggestions(data.suggestions);
      }
    } catch {
      // API failure — silently skip, don't block the user
      setAddressValid(null);
    } finally {
      setAddressValidating(false);
    }
  };

  const applySuggestion = (suggestion: { street: string; city: string; zipCode: string }): void => {
    setValue('addressStreet', suggestion.street, { shouldDirty: true });
    setValue('addressCity', suggestion.city, { shouldDirty: true });
    setValue('addressZip', suggestion.zipCode, { shouldDirty: true });
    setAddressValid(true);
    setAddressSuggestions([]);
  };

  const onSubmit = async (data: PersonalInfoFormValues): Promise<void> => {
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const res = await fetch('/api/patient/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update profile');
      }

      const result = await res.json();

      // Update parent component
      onUpdate(result.profile);
      setSubmitSuccess(true);

      // If a new pharmacy was selected, update the display
      if (selectedPharmacy) {
        setShowPharmacySearch(false);
        setSelectedPharmacy(null);
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-6">
        {/* Personal Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-ocean-500" />
              Personal Information
            </CardTitle>
            <CardDescription>
              Your basic personal details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Read-only fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <p className="font-medium text-gray-900">{profile.email}</p>
                {!profile.emailVerified && (
                  <span className="text-xs text-amber-600">Not verified</span>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  Treatment Type
                </Label>
                <p className="font-medium text-gray-900 capitalize">
                  {profile.primaryConcern?.toLowerCase().replace('_', ' ') || 'Not specified'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Treatment type cannot be changed.
                </p>
              </div>
            </div>

            {/* Treatment Goal (read-only) */}
            {profile.treatmentGoal && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <Label className="text-muted-foreground">Treatment Goal</Label>
                <p className="font-medium text-gray-900 capitalize">
                  {profile.treatmentGoal.toLowerCase().replace('_', ' ')}
                </p>
              </div>
            )}

            {/* Editable: First Name and Last Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName" className="flex items-center gap-1">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="firstName"
                  autoComplete="given-name"
                  placeholder="John"
                  className="mt-1.5"
                  aria-invalid={!!errors.firstName}
                  aria-describedby={errors.firstName ? 'firstName-error' : undefined}
                  {...register('firstName')}
                />
                <AnimatePresence>
                  {errors.firstName && (
                    <motion.p
                      id="firstName-error"
                      role="alert"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-sm text-red-500 mt-1.5"
                    >
                      {errors.firstName.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              <div>
                <Label htmlFor="lastName" className="flex items-center gap-1">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="lastName"
                  autoComplete="family-name"
                  placeholder="Doe"
                  className="mt-1.5"
                  aria-invalid={!!errors.lastName}
                  aria-describedby={errors.lastName ? 'lastName-error' : undefined}
                  {...register('lastName')}
                />
                <AnimatePresence>
                  {errors.lastName && (
                    <motion.p
                      id="lastName-error"
                      role="alert"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-sm text-red-500 mt-1.5"
                    >
                      {errors.lastName.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Editable: Date of Birth */}
            <div>
              <Label htmlFor="dateOfBirth" className="flex items-center gap-1">
                Date of Birth <span className="text-red-500">*</span>
              </Label>
              <Input
                id="dateOfBirth"
                type="date"
                autoComplete="off"
                className="mt-1.5"
                aria-invalid={!!errors.dateOfBirth}
                aria-describedby={errors.dateOfBirth ? 'dateOfBirth-error' : undefined}
                {...register('dateOfBirth')}
              />
              <AnimatePresence>
                {errors.dateOfBirth && (
                  <motion.p
                    id="dateOfBirth-error"
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-sm text-red-500 mt-1.5"
                  >
                    {errors.dateOfBirth.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Editable: Phone */}
            <div>
              <Label htmlFor="phone" className="flex items-center gap-1">
                Phone Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="(555) 123-4567"
                className="mt-1.5"
                aria-invalid={!!errors.phone}
                aria-describedby={errors.phone ? 'phone-error' : undefined}
                {...register('phone')}
              />
              <AnimatePresence>
                {errors.phone && (
                  <motion.p
                    id="phone-error"
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-sm text-red-500 mt-1.5"
                  >
                    {errors.phone.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>

        {/* Address Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-ocean-500" />
              Address
            </CardTitle>
            <CardDescription>
              Your home address. Rimal Health currently serves California residents only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Street Address */}
            <div>
              <Label htmlFor="addressStreet" className="flex items-center gap-1">
                Street Address <span className="text-red-500">*</span>
              </Label>
              <Input
                id="addressStreet"
                autoComplete="street-address"
                placeholder="123 Main Street, Apt 4B"
                className="mt-1.5"
                aria-invalid={!!errors.addressStreet}
                aria-describedby={errors.addressStreet ? 'addressStreet-error' : undefined}
                {...register('addressStreet')}
              />
              <AnimatePresence>
                {errors.addressStreet && (
                  <motion.p
                    id="addressStreet-error"
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-sm text-red-500 mt-1.5"
                  >
                    {errors.addressStreet.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* City, State, ZIP */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="addressCity" className="flex items-center gap-1">
                  City <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="addressCity"
                  autoComplete="address-level2"
                  placeholder="Los Angeles"
                  className="mt-1.5"
                  aria-invalid={!!errors.addressCity}
                  aria-describedby={errors.addressCity ? 'addressCity-error' : undefined}
                  {...register('addressCity')}
                />
                <AnimatePresence>
                  {errors.addressCity && (
                    <motion.p
                      id="addressCity-error"
                      role="alert"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-sm text-red-500 mt-1.5"
                    >
                      {errors.addressCity.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <Label htmlFor="addressState">State</Label>
                <Input
                  id="addressState"
                  autoComplete="address-level1"
                  value="California (CA)"
                  disabled
                  readOnly
                  className="mt-1.5 bg-gray-100 cursor-not-allowed"
                />
                <input type="hidden" value="CA" aria-hidden="true" {...register('addressState')} />
              </div>

              <div>
                <Label htmlFor="addressZip" className="flex items-center gap-1">
                  ZIP Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="addressZip"
                  autoComplete="postal-code"
                  placeholder="e.g. 90210"
                  className="mt-1.5"
                  aria-invalid={!!errors.addressZip}
                  aria-describedby={errors.addressZip ? 'addressZip-error' : undefined}
                  {...register('addressZip')}
                />
                <AnimatePresence>
                  {errors.addressZip && (
                    <motion.p
                      id="addressZip-error"
                      role="alert"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-sm text-red-500 mt-1.5"
                    >
                      {errors.addressZip.message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Verify Address Button */}
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleVerifyAddress}
                disabled={addressValidating || !watch('addressStreet') || !watch('addressCity') || !watch('addressZip')}
                className="text-ocean-600 border-ocean-200 hover:bg-ocean-50"
              >
                {addressValidating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <MapPin className="mr-2 h-4 w-4" />
                    Verify Address
                  </>
                )}
              </Button>
            </div>

            {/* Address verified indicator */}
            <AnimatePresence>
              {addressValid === true && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md"
                >
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-800">Address verified</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Address invalid — show suggestions */}
            <AnimatePresence>
              {addressValid === false && addressSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      We couldn&apos;t verify that address. Did you mean one of these?
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {addressSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => applySuggestion(suggestion)}
                        className="w-full text-left p-2.5 rounded-md border border-gray-200 hover:border-ocean-300 hover:bg-ocean-50 transition-colors text-sm"
                      >
                        <span className="font-medium">{suggestion.street}</span>
                        <span className="text-muted-foreground">
                          , {suggestion.city}, {suggestion.state} {suggestion.zipCode}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Address invalid — no suggestions */}
            <AnimatePresence>
              {addressValid === false && addressSuggestions.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Address could not be verified. Please double-check and try again.
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Preferred Pharmacy Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-ocean-500" />
              Preferred Pharmacy
            </CardTitle>
            <CardDescription>
              Search by city name or ZIP code to select your preferred pharmacy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current pharmacy display */}
            {displayPharmacy && !showPharmacySearch && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      {selectedPharmacy ? 'New selection (save to apply)' : 'Current pharmacy'}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPharmacySearch(true)}
                    className="text-ocean-600 border-ocean-200 hover:bg-ocean-50 hover:text-ocean-700"
                  >
                    Change
                  </Button>
                </div>
                <p className="font-medium text-gray-900">{displayPharmacy.name}</p>
                <p className="text-sm text-gray-600">{displayPharmacy.address}</p>
                {displayPharmacy.phone && (
                  <p className="text-sm text-gray-500 mt-1">{displayPharmacy.phone}</p>
                )}
              </div>
            )}

            {/* Pharmacy search via NPI */}
            {showPharmacySearch && (
              <>
                {profile.pharmacy && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowPharmacySearch(false);
                        setSelectedPharmacy(null);
                        setValue('preferredPharmacyId', '');
                      }}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </Button>
                  </div>
                )}

                <PatientPharmacySearch
                  onSelect={handlePharmacySelect}
                  currentPharmacyId={selectedPharmacy?.id}
                  currentPharmacyName={selectedPharmacy?.name}
                />
              </>
            )}

            {/* Hidden field for form submission */}
            <input type="hidden" aria-hidden="true" {...register('preferredPharmacyId')} />
          </CardContent>
        </Card>

        {/* Medical Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-ocean-500" />
              Medical Information
            </CardTitle>
            <CardDescription>
              Select from common options or type to add your own. This helps your physician provide better care.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Medical Conditions Combobox */}
            <MultiSelectCombobox
              id="medicalHistory"
              label="Medical Conditions"
              icon={<FileText className="h-4 w-4" />}
              presets={MEDICAL_CONDITIONS_PRESETS}
              value={medicalHistoryValue}
              onChange={(val) => setValue('medicalHistory', val, { shouldDirty: true })}
              placeholder="Select conditions or type to add..."
              error={errors.medicalHistory?.message}
            />

            {/* Current Medications Combobox */}
            <MultiSelectCombobox
              id="currentMedications"
              label="Current Medications"
              icon={<Pill className="h-4 w-4" />}
              presets={MEDICATIONS_PRESETS}
              value={currentMedicationsValue}
              onChange={(val) => setValue('currentMedications', val, { shouldDirty: true })}
              placeholder="Select medications or type to add..."
              error={errors.currentMedications?.message}
            />

            {/* Allergies Combobox */}
            <MultiSelectCombobox
              id="allergies"
              label="Allergies"
              icon={<AlertTriangle className="h-4 w-4" />}
              presets={ALLERGIES_PRESETS}
              value={allergiesValue}
              onChange={(val) => setValue('allergies', val, { shouldDirty: true })}
              placeholder="Select allergies or type to add..."
              error={errors.allergies?.message}
            />
          </CardContent>
        </Card>

        {/* Success/Error Messages */}
        {submitSuccess && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Your profile has been updated successfully.
            </AlertDescription>
          </Alert>
        )}

        {submitError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        {Object.keys(errors).length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please fix the highlighted fields above before saving.
            </AlertDescription>
          </Alert>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <LoadingButton
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Save Changes
          </LoadingButton>
        </div>
      </div>
    </form>
  );
}

export default PersonalInfoForm;
