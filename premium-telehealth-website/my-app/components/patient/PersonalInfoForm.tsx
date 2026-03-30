'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, User, MapPin, FileText, Pill, AlertTriangle, Building2, Search, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingButton } from '@/components/ui/LoadingButton';

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
    .optional().or(z.literal('')),
  addressState: z.string().optional().or(z.literal('')),
  addressZip: z.string()
    .max(10, 'ZIP code is too long')
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

interface PharmacyResult {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string | null;
  is24Hour: boolean;
  hasDelivery: boolean;
  hasDriveThru: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export function PersonalInfoForm({ profile, onUpdate }: PersonalInfoFormProps): React.ReactElement {
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);

  // Pharmacy search state
  const [pharmacyQuery, setPharmacyQuery] = React.useState('');
  const [pharmacyResults, setPharmacyResults] = React.useState<PharmacyResult[]>([]);
  const [pharmacySearching, setPharmacySearching] = React.useState(false);
  const [pharmacySearchError, setPharmacySearchError] = React.useState<string | null>(null);
  const [selectedPharmacy, setSelectedPharmacy] = React.useState<PharmacyResult | null>(null);
  const pharmacySearchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
  } = useForm<PersonalInfoFormValues>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      dateOfBirth: profile.dateOfBirth || '',
      phone: profile.phone || '',
      addressStreet: profile.addressStreet || '',
      addressCity: profile.addressCity || '',
      addressState: profile.addressState || 'CA',
      addressZip: profile.addressZip || '',
      medicalHistory: profile.medicalHistory || '',
      currentMedications: profile.currentMedications || '',
      allergies: profile.allergies || '',
      preferredPharmacyId: '',
    },
  });

  // Reset form when profile changes
  React.useEffect(() => {
    reset({
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      dateOfBirth: profile.dateOfBirth || '',
      phone: profile.phone || '',
      addressStreet: profile.addressStreet || '',
      addressCity: profile.addressCity || '',
      addressState: profile.addressState || 'CA',
      addressZip: profile.addressZip || '',
      medicalHistory: profile.medicalHistory || '',
      currentMedications: profile.currentMedications || '',
      allergies: profile.allergies || '',
      preferredPharmacyId: '',
    });
  }, [profile, reset]);

  // Pharmacy search handler with debounce
  const handlePharmacySearch = React.useCallback((query: string): void => {
    setPharmacyQuery(query);
    setPharmacySearchError(null);

    if (pharmacySearchTimeout.current) {
      clearTimeout(pharmacySearchTimeout.current);
    }

    if (query.trim().length < 2) {
      setPharmacyResults([]);
      return;
    }

    pharmacySearchTimeout.current = setTimeout(async () => {
      setPharmacySearching(true);
      try {
        // Detect if query looks like a ZIP code (starts with digits)
        const isZip = /^\d{3,5}$/.test(query.trim());
        const params = new URLSearchParams();
        if (isZip) {
          params.set('zip', query.trim());
        } else {
          params.set('q', query.trim());
        }

        const res = await fetch(`/api/patient/pharmacies/search?${params.toString()}`, {
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error('Search failed');
        }

        const data = await res.json();
        setPharmacyResults(data.pharmacies || []);
      } catch {
        setPharmacySearchError('Failed to search pharmacies. Please try again.');
        setPharmacyResults([]);
      } finally {
        setPharmacySearching(false);
      }
    }, 400);
  }, []);

  // Clean up timeout on unmount
  React.useEffect(() => {
    return () => {
      if (pharmacySearchTimeout.current) {
        clearTimeout(pharmacySearchTimeout.current);
      }
    };
  }, []);

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
                <Label className="text-muted-foreground">Treatment</Label>
                <p className="font-medium text-gray-900 capitalize">
                  {profile.primaryConcern?.toLowerCase().replace('_', ' ') || 'Not specified'}
                </p>
              </div>
            </div>

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
                autoComplete="bday"
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
                <input type="hidden" value="CA" {...register('addressState')} />
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
              Search by pharmacy name or ZIP code to select your preferred pharmacy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current pharmacy display */}
            {(selectedPharmacy || profile.pharmacy) && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    {selectedPharmacy ? 'New selection (save to apply)' : 'Current pharmacy'}
                  </span>
                </div>
                <p className="font-medium text-gray-900">
                  {selectedPharmacy?.name ?? profile.pharmacy?.name}
                </p>
                <p className="text-sm text-gray-600">
                  {selectedPharmacy
                    ? [selectedPharmacy.address, selectedPharmacy.city, selectedPharmacy.state, selectedPharmacy.zipCode].filter(Boolean).join(', ')
                    : [profile.pharmacy?.address, profile.pharmacy?.city, 'CA', profile.pharmacy?.zip].filter(Boolean).join(', ')}
                </p>
                {(selectedPharmacy?.phone ?? profile.pharmacy?.phone) && (
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedPharmacy?.phone ?? profile.pharmacy?.phone}
                  </p>
                )}
              </div>
            )}

            {/* Search input */}
            <div>
              <Label htmlFor="pharmacySearch" className="flex items-center gap-1">
                <Search className="h-4 w-4" />
                Search Pharmacies
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="pharmacySearch"
                  type="text"
                  placeholder="Enter pharmacy name or ZIP code..."
                  value={pharmacyQuery}
                  onChange={(e) => handlePharmacySearch(e.target.value)}
                  autoComplete="off"
                />
                {pharmacySearching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Search error */}
            {pharmacySearchError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{pharmacySearchError}</AlertDescription>
              </Alert>
            )}

            {/* Search results */}
            {pharmacyResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pharmacyResults.map((pharmacy) => {
                  const isSelected = selectedPharmacy?.id === pharmacy.id;
                  return (
                    <button
                      key={pharmacy.id}
                      type="button"
                      onClick={() => {
                        setSelectedPharmacy(pharmacy);
                        setValue('preferredPharmacyId', pharmacy.id);
                        setPharmacyResults([]);
                        setPharmacyQuery('');
                      }}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        isSelected
                          ? 'border-ocean-400 bg-ocean-50'
                          : 'border-gray-200 hover:border-ocean-300 hover:bg-gray-50'
                      }`}
                    >
                      <p className="font-medium text-gray-900 text-sm">{pharmacy.name}</p>
                      <p className="text-xs text-gray-600">
                        {[pharmacy.address, pharmacy.city, pharmacy.state, pharmacy.zipCode].filter(Boolean).join(', ')}
                      </p>
                      {pharmacy.phone && (
                        <p className="text-xs text-gray-500 mt-0.5">{pharmacy.phone}</p>
                      )}
                      <div className="flex gap-2 mt-1">
                        {pharmacy.is24Hour && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">24 Hour</span>
                        )}
                        {pharmacy.hasDelivery && (
                          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Delivery</span>
                        )}
                        {pharmacy.hasDriveThru && (
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Drive-Thru</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* No results message */}
            {pharmacyQuery.trim().length >= 2 && !pharmacySearching && pharmacyResults.length === 0 && !pharmacySearchError && (
              <p className="text-sm text-muted-foreground text-center py-2">
                No pharmacies found. Try a different search term.
              </p>
            )}

            {/* Hidden field for form submission */}
            <input type="hidden" {...register('preferredPharmacyId')} />
          </CardContent>
        </Card>

        {/* Medical Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-ocean-500" />
              Medical Information (Optional)
            </CardTitle>
            <CardDescription>
              Additional medical details to help your physician
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Medical History */}
            <div>
              <Label htmlFor="medicalHistory" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Medical History
              </Label>
              <Textarea
                id="medicalHistory"
                placeholder="Any relevant medical conditions, surgeries, or family history..."
                rows={4}
                className="mt-1.5 resize-none"
                aria-invalid={!!errors.medicalHistory}
                aria-describedby={errors.medicalHistory ? 'medicalHistory-error' : undefined}
                {...register('medicalHistory')}
              />
              <AnimatePresence>
                {errors.medicalHistory && (
                  <motion.p
                    id="medicalHistory-error"
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-sm text-red-500 mt-1.5"
                  >
                    {errors.medicalHistory.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Current Medications */}
            <div>
              <Label htmlFor="currentMedications" className="flex items-center gap-2">
                <Pill className="h-4 w-4" />
                Current Medications
              </Label>
              <Textarea
                id="currentMedications"
                placeholder="List any medications you are currently taking..."
                rows={3}
                className="mt-1.5 resize-none"
                aria-invalid={!!errors.currentMedications}
                aria-describedby={errors.currentMedications ? 'currentMedications-error' : undefined}
                {...register('currentMedications')}
              />
              <AnimatePresence>
                {errors.currentMedications && (
                  <motion.p
                    id="currentMedications-error"
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-sm text-red-500 mt-1.5"
                  >
                    {errors.currentMedications.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Allergies */}
            <div>
              <Label htmlFor="allergies" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Allergies
              </Label>
              <Textarea
                id="allergies"
                placeholder="List any allergies to medications, foods, or other substances..."
                rows={2}
                className="mt-1.5 resize-none"
                aria-invalid={!!errors.allergies}
                aria-describedby={errors.allergies ? 'allergies-error' : undefined}
                {...register('allergies')}
              />
              <AnimatePresence>
                {errors.allergies && (
                  <motion.p
                    id="allergies-error"
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-sm text-red-500 mt-1.5"
                  >
                    {errors.allergies.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
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
