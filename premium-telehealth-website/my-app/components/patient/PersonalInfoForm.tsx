'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, User, MapPin, FileText, Pill, AlertTriangle } from 'lucide-react';
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
  phone: z.string()
    .min(10, 'Phone number is required')
    .regex(/^\+?1?\d{10,15}$/, 'Please enter a valid phone number'),
  addressStreet: z.string()
    .min(1, 'Street address is required')
    .max(200, 'Address must be under 200 characters'),
  addressCity: z.string()
    .min(1, 'City is required')
    .max(100, 'City must be under 100 characters'),
  addressState: z.string().min(1, 'State is required'),
  addressZip: z.string()
    .regex(/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code'),
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
              Your basic information (some fields cannot be edited)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Read-only fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-muted-foreground">Full Name</Label>
                <p className="font-medium text-gray-900">
                  {profile.firstName} {profile.lastName}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <p className="font-medium text-gray-900">{profile.email}</p>
                {!profile.emailVerified && (
                  <span className="text-xs text-amber-600">Not verified</span>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground">Date of Birth</Label>
                <p className="font-medium text-gray-900">{profile.dateOfBirth}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Treatment</Label>
                <p className="font-medium text-gray-900 capitalize">
                  {profile.primaryConcern?.toLowerCase().replace('_', ' ') || 'Not specified'}
                </p>
              </div>
            </div>

            {/* Editable: Phone */}
            <div>
              <Label htmlFor="phone" className="flex items-center gap-1">
                Phone Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
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
              Your home address (California residents only)
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
                  value="CA"
                  disabled
                  className="mt-1.5 bg-gray-100"
                  {...register('addressState')}
                />
              </div>

              <div>
                <Label htmlFor="addressZip" className="flex items-center gap-1">
                  ZIP Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="addressZip"
                  placeholder="90210"
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
