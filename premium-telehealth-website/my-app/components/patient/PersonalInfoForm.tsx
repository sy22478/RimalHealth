'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, User, MapPin, FileText, Pill, AlertTriangle, Building2, Info } from 'lucide-react';
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
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Please enter a valid date')
    .optional().or(z.literal('')),
  phone: z.string()
    .regex(/^\+?1?\d{10,15}$/, 'Please enter a valid phone number')
    .optional().or(z.literal('')),
  addressStreet: z.string()
    .max(200, 'Address must be under 200 characters')
    .optional().or(z.literal('')),
  addressCity: z.string()
    .max(100, 'City must be under 100 characters')
    .optional().or(z.literal('')),
  addressState: z.string().optional().or(z.literal('')),
  addressZip: z.string()
    .regex(/^9\d{4}(-\d{4})?$/, 'Must be a valid California ZIP code (starts with 9)')
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
// Main Component
// ============================================================================

export function PersonalInfoForm({ profile, onUpdate }: PersonalInfoFormProps): React.ReactElement {
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
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
    });
  }, [profile, reset]);

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
        {profile.pharmacy && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-ocean-500" />
                Preferred Pharmacy
              </CardTitle>
              <CardDescription>
                Pharmacy selected during intake. Contact support to update.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label className="text-muted-foreground">Pharmacy Name</Label>
                  <p className="font-medium text-gray-900">{profile.pharmacy.name}</p>
                </div>
                {profile.pharmacy.phone && (
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium text-gray-900">{profile.pharmacy.phone}</p>
                  </div>
                )}
                {profile.pharmacy.address && (
                  <div>
                    <Label className="text-muted-foreground">Address</Label>
                    <p className="font-medium text-gray-900">{profile.pharmacy.address}</p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">City</Label>
                  <p className="font-medium text-gray-900">
                    {[profile.pharmacy.city, 'CA', profile.pharmacy.zip].filter(Boolean).join(', ')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  {profile.pharmacy.source === 'intake'
                    ? 'This pharmacy was selected during your intake form. To change your preferred pharmacy, please contact support.'
                    : 'To change your preferred pharmacy, please contact support.'}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

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
