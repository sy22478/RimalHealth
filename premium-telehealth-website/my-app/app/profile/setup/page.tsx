'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import {
  User,
  MapPin,
  Phone,
  Shield,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Building2,
  Heart,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { LoadingButton } from '@/components/ui/LoadingButton';

// ============================================================================
// Validation Schema
// ============================================================================

const profileSetupSchema = z.object({
  // Personal Information
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  
  // Address
  addressLine1: z.string().min(1, 'Address is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.literal('CA').catch('CA'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Valid ZIP code required'),
  
  // Emergency Contact
  emergencyContactName: z.string().min(1, 'Emergency contact name is required'),
  emergencyContactPhone: z.string().min(10, 'Valid phone number is required'),
  
  // Insurance (optional)
  insuranceProvider: z.string().optional(),
  policyNumber: z.string().optional(),
  
  // Pharmacy
  preferredPharmacyId: z.string().optional(),
});

type ProfileSetupData = z.infer<typeof profileSetupSchema>;

// ============================================================================
// Pharmacy Search Types & Hook
// ============================================================================

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

/**
 * Custom hook for debounced pharmacy search via the real API.
 * Calls GET /api/patient/pharmacies/search with query and optional zip.
 */
function usePharmacySearch() {
  const [pharmacies, setPharmacies] = React.useState<PharmacyResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = React.useCallback((query: string, zip: string) => {
    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // If both fields are empty, clear results
    if (!query.trim() && !zip.trim()) {
      setPharmacies([]);
      setSearchError(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      setSearchError(null);

      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('q', query.trim());
        if (zip.trim()) params.set('zip', zip.trim());

        const response = await fetch(`/api/patient/pharmacies/search?${params.toString()}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to search pharmacies');
        }

        const data = await response.json() as { pharmacies: PharmacyResult[] };
        setPharmacies(data.pharmacies);
      } catch {
        setSearchError('Unable to search pharmacies. You can add one later from your profile.');
        setPharmacies([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  // Cleanup debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return { pharmacies, isSearching, searchError, search };
}

// ============================================================================
// Form Steps Configuration
// ============================================================================

interface FormStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

const formSteps: FormStep[] = [
  {
    id: 'personal',
    title: 'Personal Information',
    description: 'Your basic information',
    icon: User,
  },
  {
    id: 'address',
    title: 'Address',
    description: 'Your California address',
    icon: MapPin,
  },
  {
    id: 'emergency',
    title: 'Emergency Contact',
    description: 'Someone we can contact in an emergency',
    icon: Heart,
  },
  {
    id: 'insurance',
    title: 'Insurance & Pharmacy',
    description: 'Optional insurance and preferred pharmacy',
    icon: Building2,
  },
];

// ============================================================================
// Step Components
// ============================================================================

function PersonalInfoStep() {
  const { register, formState: { errors } } = useFormContext<ProfileSetupData>();
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">
            First Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="firstName"
            {...register('firstName')}
            placeholder="John"
            className={cn(errors.firstName && 'border-red-500')}
          />
          {errors.firstName && (
            <p className="text-sm text-red-500">{errors.firstName.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="lastName">
            Last Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="lastName"
            {...register('lastName')}
            placeholder="Doe"
            className={cn(errors.lastName && 'border-red-500')}
          />
          {errors.lastName && (
            <p className="text-sm text-red-500">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dateOfBirth">
          Date of Birth <span className="text-red-500">*</span>
        </Label>
        <Input
          id="dateOfBirth"
          type="date"
          {...register('dateOfBirth')}
          className={cn(errors.dateOfBirth && 'border-red-500')}
        />
        {errors.dateOfBirth && (
          <p className="text-sm text-red-500">{errors.dateOfBirth.message}</p>
        )}
        <p className="text-xs text-gray-500">You must be 18 or older to use this service</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">
          Phone Number <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="phone"
            {...register('phone')}
            placeholder="(555) 123-4567"
            className={cn('pl-10', errors.phone && 'border-red-500')}
          />
        </div>
        {errors.phone && (
          <p className="text-sm text-red-500">{errors.phone.message}</p>
        )}
      </div>
    </div>
  );
}

function AddressStep() {
  const { register, formState: { errors } } = useFormContext<ProfileSetupData>();
  
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="addressLine1">
          Street Address <span className="text-red-500">*</span>
        </Label>
        <Input
          id="addressLine1"
          {...register('addressLine1')}
          placeholder="123 Main Street"
          className={cn(errors.addressLine1 && 'border-red-500')}
        />
        {errors.addressLine1 && (
          <p className="text-sm text-red-500">{errors.addressLine1.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="addressLine2">
          Apartment, Suite, etc. (Optional)
        </Label>
        <Input
          id="addressLine2"
          {...register('addressLine2')}
          placeholder="Apt 4B"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">
            City <span className="text-red-500">*</span>
          </Label>
          <Input
            id="city"
            {...register('city')}
            placeholder="Los Angeles"
            className={cn(errors.city && 'border-red-500')}
          />
          {errors.city && (
            <p className="text-sm text-red-500">{errors.city.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="zipCode">
            ZIP Code <span className="text-red-500">*</span>
          </Label>
          <Input
            id="zipCode"
            {...register('zipCode')}
            placeholder="90210"
            className={cn(errors.zipCode && 'border-red-500')}
          />
          {errors.zipCode && (
            <p className="text-sm text-red-500">{errors.zipCode.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="state">State</Label>
        <Input
          id="state"
          {...register('state')}
          value="CA"
          disabled
          className="bg-gray-50"
        />
        <p className="text-xs text-gray-500">
          Currently only serving California residents
        </p>
      </div>
    </div>
  );
}

function EmergencyContactStep() {
  const { register, formState: { errors } } = useFormContext<ProfileSetupData>();
  
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">Why we need this</h4>
            <p className="text-sm text-blue-700 mt-1">
              In case of a medical emergency, we need someone we can contact on your behalf.
              This information is kept confidential and only used when necessary.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="emergencyContactName">
          Contact Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="emergencyContactName"
          {...register('emergencyContactName')}
          placeholder="Jane Doe"
          className={cn(errors.emergencyContactName && 'border-red-500')}
        />
        {errors.emergencyContactName && (
          <p className="text-sm text-red-500">{errors.emergencyContactName.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="emergencyContactPhone">
          Contact Phone <span className="text-red-500">*</span>
        </Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            id="emergencyContactPhone"
            {...register('emergencyContactPhone')}
            placeholder="(555) 123-4567"
            className={cn('pl-10', errors.emergencyContactPhone && 'border-red-500')}
          />
        </div>
        {errors.emergencyContactPhone && (
          <p className="text-sm text-red-500">{errors.emergencyContactPhone.message}</p>
        )}
      </div>
    </div>
  );
}

function InsurancePharmacyStep() {
  const { register, watch, setValue, formState: { errors } } = useFormContext<ProfileSetupData>();
  const selectedPharmacy = watch('preferredPharmacyId');
  const zipCode = watch('zipCode');
  const { pharmacies, isSearching, searchError, search } = usePharmacySearch();
  const [pharmacyQuery, setPharmacyQuery] = React.useState('');

  const handlePharmacySearch = React.useCallback(
    (query: string) => {
      setPharmacyQuery(query);
      search(query, zipCode || '');
    },
    [search, zipCode]
  );

  return (
    <div className="space-y-6">
      {/* Insurance Section */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900 flex items-center gap-2">
          <Shield className="h-4 w-4 text-ocean-500" />
          Insurance Information (Optional)
        </h4>

        <div className="space-y-2">
          <Label htmlFor="insuranceProvider">Insurance Provider</Label>
          <Input
            id="insuranceProvider"
            {...register('insuranceProvider')}
            placeholder="e.g., Blue Cross, Kaiser, etc."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="policyNumber">Policy/Member Number</Label>
          <Input
            id="policyNumber"
            {...register('policyNumber')}
            placeholder="Your policy number"
          />
        </div>

        <p className="text-xs text-gray-500">
          This is optional. You can add it later. Insurance is processed directly at your pharmacy.
        </p>
      </div>

      <div className="border-t border-gray-200" />

      {/* Pharmacy Section */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-ocean-500" />
          Preferred Pharmacy (Optional)
        </h4>

        {/* Pharmacy Search Input */}
        <div className="space-y-2">
          <Label htmlFor="pharmacySearch">Search by name or city</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="pharmacySearch"
              value={pharmacyQuery}
              onChange={(e) => handlePharmacySearch(e.target.value)}
              placeholder="e.g., CVS, Walgreens, Los Angeles..."
              className="pl-10"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
            )}
          </div>
          {zipCode && (
            <p className="text-xs text-gray-500">
              Showing results near ZIP code {zipCode}
            </p>
          )}
        </div>

        {/* Search Error */}
        {searchError && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{searchError}</AlertDescription>
          </Alert>
        )}

        {/* Pharmacy Results */}
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {pharmacies.length > 0 ? (
            pharmacies.map((pharmacy) => (
              <label
                key={pharmacy.id}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all',
                  selectedPharmacy === pharmacy.id
                    ? 'border-ocean-500 bg-ocean-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                )}
              >
                <input
                  type="radio"
                  {...register('preferredPharmacyId')}
                  value={pharmacy.id}
                  className="w-4 h-4 mt-0.5 text-ocean-600 border-gray-300 focus:ring-ocean-500"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{pharmacy.name}</p>
                  <p className="text-sm text-gray-500">
                    {pharmacy.address}, {pharmacy.city}, {pharmacy.state} {pharmacy.zipCode}
                  </p>
                  {pharmacy.phone && (
                    <p className="text-sm text-gray-500">{pharmacy.phone}</p>
                  )}
                  <div className="flex gap-2 mt-1">
                    {pharmacy.is24Hour && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">24 Hour</span>
                    )}
                    {pharmacy.hasDelivery && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Delivery</span>
                    )}
                    {pharmacy.hasDriveThru && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Drive-Thru</span>
                    )}
                  </div>
                </div>
              </label>
            ))
          ) : pharmacyQuery.trim() && !isSearching && !searchError ? (
            <div className="text-center py-6 text-gray-500">
              <Building2 className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No pharmacies found. Try a different search term.</p>
            </div>
          ) : !pharmacyQuery.trim() ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Start typing to search for a pharmacy near you.
            </p>
          ) : null}
        </div>

        {/* Clear selection option */}
        {selectedPharmacy && (
          <button
            type="button"
            onClick={() => setValue('preferredPharmacyId', undefined)}
            className="text-sm text-ocean-600 hover:underline"
          >
            Clear pharmacy selection
          </button>
        )}

        <p className="text-xs text-gray-500">
          You can change your preferred pharmacy at any time from your profile settings.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Progress Indicator
// ============================================================================

function StepProgress({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">
          Step {currentStep + 1} of {totalSteps}
        </span>
        <span className="text-sm font-medium text-gray-600">
          {Math.round(((currentStep + 1) / totalSteps) * 100)}%
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-ocean-500"
          initial={{ width: 0 }}
          animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Main Profile Setup Page
// ============================================================================

export default function ProfileSetupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const methods = useForm<ProfileSetupData>({
    resolver: zodResolver(profileSetupSchema),
    defaultValues: {
      state: 'CA',
    },
    mode: 'onBlur',
  });

  const { handleSubmit, trigger, formState: { errors } } = methods;

  const validateCurrentStep = async (): Promise<boolean> => {
    const stepFields: Record<string, string[]> = {
      personal: ['firstName', 'lastName', 'dateOfBirth', 'phone'],
      address: ['addressLine1', 'city', 'zipCode'],
      emergency: ['emergencyContactName', 'emergencyContactPhone'],
      insurance: [],
    };

    const currentStepId = formSteps[currentStep].id;
    const fieldsToValidate = stepFields[currentStepId] || [];
    
    if (fieldsToValidate.length === 0) return true;
    
    const result = await trigger(fieldsToValidate as unknown as Parameters<typeof trigger>[0]);
    return result;
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (isValid && currentStep < formSteps.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const onSubmit = async (data: ProfileSetupData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/patient/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to save profile');
      }

      setIsSuccess(true);
      
      // Redirect after showing success
      setTimeout(() => {
        router.push('/patient/dashboard');
      }, 2000);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const CurrentStepIcon = formSteps[currentStep].icon;
  const StepComponent = [PersonalInfoStep, AddressStep, EmergencyContactStep, InsurancePharmacyStep][currentStep];

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Profile Created!
            </h2>
            <p className="text-gray-600 mb-6">
              Your profile has been successfully set up. Redirecting to your dashboard...
            </p>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-green-500"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 2 }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Complete Your Profile
          </h1>
          <p className="text-gray-600 mt-2">
            We need some information to get your treatment started
          </p>
        </div>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card>
              <CardHeader>
                <StepProgress currentStep={currentStep} totalSteps={formSteps.length} />
                
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-ocean-50 rounded-lg">
                    <CurrentStepIcon className="h-5 w-5 text-ocean-600" />
                  </div>
                  <div>
                    <CardTitle>{formSteps[currentStep].title}</CardTitle>
                    <CardDescription>{formSteps[currentStep].description}</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {submitError && (
                  <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{submitError}</AlertDescription>
                  </Alert>
                )}

                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <StepComponent />
                </motion.div>

                {/* Navigation */}
                <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                  {currentStep > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBack}
                      className="flex items-center gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Back
                    </Button>
                  ) : (
                    <div />
                  )}

                  {currentStep < formSteps.length - 1 ? (
                    <Button
                      type="button"
                      onClick={handleNext}
                      className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-ocean-500 hover:from-blue-600 hover:to-ocean-600 text-white"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <LoadingButton
                      type="submit"
                      loading={isSubmitting}
                      className="flex items-center gap-2"
                    >
                      Complete Profile
                      <CheckCircle className="h-4 w-4" />
                    </LoadingButton>
                  )}
                </div>
              </CardContent>
            </Card>
          </form>
        </FormProvider>

        {/* Skip Option (for development) */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Already have a profile?{' '}
          <Link href="/patient/dashboard" className="text-ocean-600 hover:underline">
            Go to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}

import Link from 'next/link';
