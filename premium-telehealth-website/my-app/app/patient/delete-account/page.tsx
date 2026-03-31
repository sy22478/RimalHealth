'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertTriangle,
  Clock,
  ShieldCheck,
  Mail,
  Lock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================================================
// Validation Schema
// ============================================================================

const DELETION_REASONS = [
  'NO_LONGER_NEEDED',
  'COST',
  'PRIVACY_CONCERNS',
  'SWITCHING_PROVIDER',
  'DISSATISFIED',
  'OTHER',
] as const;

const REASON_LABELS: Record<(typeof DELETION_REASONS)[number], string> = {
  NO_LONGER_NEEDED: 'I no longer need treatment',
  COST: 'Cost concerns',
  PRIVACY_CONCERNS: 'Privacy concerns',
  SWITCHING_PROVIDER: 'Switching to another provider',
  DISSATISFIED: 'Dissatisfied with service',
  OTHER: 'Other',
};

const deleteAccountSchema = z.object({
  reason: z.enum(DELETION_REASONS, {
    message: 'Please select a reason',
  }),
  details: z
    .string()
    .max(1000, { message: 'Must be under 1000 characters' })
    .optional()
    .or(z.literal('')),
  password: z
    .string()
    .min(1, { message: 'Password is required to confirm deletion' }),
  confirmation: z.literal(true, {
    message: 'You must acknowledge the data retention policy',
  }),
});

type DeleteAccountFormData = z.infer<typeof deleteAccountSchema>;

// ============================================================================
// Success View
// ============================================================================

interface SuccessViewProps {
  gracePeriodEnds: string;
}

function SuccessView({ gracePeriodEnds }: SuccessViewProps): React.ReactElement {
  const router = useRouter();
  const [countdown, setCountdown] = React.useState(5);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  const formattedDate = new Date(gracePeriodEnds).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <Card className="border-green-200">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Account Deletion Request Submitted
            </h2>
            <p className="text-gray-600">
              Your account has been deactivated and your subscription has been cancelled.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left space-y-3">
            <h3 className="font-medium text-blue-900">What happens next</h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  <strong>30-day grace period</strong> until {formattedDate}.
                  Contact{' '}
                  <a
                    href="mailto:support@rimalhealth.com"
                    className="underline hover:text-blue-900"
                  >
                    support@rimalhealth.com
                  </a>{' '}
                  to reactivate.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Your medical records will be retained for 7 years per federal law,
                  then anonymized.
                </span>
              </li>
            </ul>
          </div>

          <p className="text-sm text-gray-500">
            Redirecting to homepage in {countdown} second{countdown !== 1 ? 's' : ''}...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function DeleteAccountPage(): React.ReactElement {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [successData, setSuccessData] = React.useState<{
    gracePeriodEnds: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DeleteAccountFormData>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: {
      reason: undefined,
      details: '',
      password: '',
      confirmation: undefined,
    },
  });

  const confirmationValue = watch('confirmation');
  const detailsValue = watch('details');

  const onSubmit = async (data: DeleteAccountFormData): Promise<void> => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/patient/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          reason: data.reason,
          details: data.details || undefined,
          password: data.password,
        }),
      });

      const responseData = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setSubmitError('Incorrect password. Please try again.');
        } else if (res.status === 409) {
          setSubmitError(
            'An account deletion request is already pending. Contact support@rimalhealth.com for assistance.'
          );
        } else {
          setSubmitError(
            (responseData as { error?: string }).error ??
              'An unexpected error occurred. Please try again.'
          );
        }
        return;
      }

      setSuccessData({
        gracePeriodEnds: (responseData as { gracePeriodEnds: string }).gracePeriodEnds,
      });
    } catch {
      setSubmitError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show success view after submission
  if (successData) {
    return <SuccessView gracePeriodEnds={successData.gracePeriodEnds} />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.push('/patient/settings')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Delete Your Account</h1>
      </div>

      {/* Warning Banner */}
      <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-medium text-red-900">Important Notice</h3>
            <p className="text-sm text-red-800 mt-1">
              This action will deactivate your account. Your medical records will be
              retained for 7 years as required by federal law (HIPAA and 42 CFR Part 2).
            </p>
          </div>
        </div>
      </div>

      {/* Information Cards */}
      <div className="grid gap-4 mb-8">
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              What happens immediately
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-gray-600 space-y-1.5">
              <li>Your account will be deactivated and you will be signed out</li>
              <li>You will no longer be able to log in</li>
              <li>Your active subscription will be cancelled</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              30-day grace period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Within 30 days, you can contact{' '}
              <a
                href="mailto:support@rimalhealth.com"
                className="text-ocean-600 hover:underline font-medium"
              >
                support@rimalhealth.com
              </a>{' '}
              to reactivate your account.
            </p>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4 text-gray-500" />
              After 30 days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Your account will be permanently deactivated. Data will be retained per
              federal requirements.
            </p>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-ocean-500" />
              After 7 years
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Your personal information will be anonymized and medical records
              de-identified, as permitted by law.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Deletion Form */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-lg text-red-900">Confirm Account Deletion</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-5">
            {/* Reason Select */}
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason for leaving <span className="text-red-500">*</span>
              </Label>
              <Select
                onValueChange={(value) =>
                  setValue('reason', value as DeleteAccountFormData['reason'], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="reason" className="w-full">
                  <SelectValue placeholder="Select a reason..." />
                </SelectTrigger>
                <SelectContent>
                  {DELETION_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {REASON_LABELS[reason]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.reason && (
                <p className="text-sm text-red-600">{errors.reason.message}</p>
              )}
            </div>

            {/* Details Textarea */}
            <div className="space-y-2">
              <Label htmlFor="details">
                Additional feedback{' '}
                <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                id="details"
                placeholder="Please share any additional feedback that could help us improve..."
                className="min-h-[100px] resize-none"
                maxLength={1000}
                {...register('details')}
              />
              <div className="flex justify-between text-xs text-gray-400">
                {errors.details ? (
                  <p className="text-red-600">{errors.details.message}</p>
                ) : (
                  <span />
                )}
                <span>{detailsValue?.length ?? 0}/1000</span>
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <Label htmlFor="password">
                Confirm your password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password to confirm"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Confirmation Checkbox */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <Checkbox
                id="confirmation"
                checked={confirmationValue === true}
                onCheckedChange={(checked) =>
                  setValue(
                    'confirmation',
                    checked === true ? true : (undefined as unknown as true),
                    { shouldValidate: true }
                  )
                }
                className="mt-0.5"
              />
              <Label
                htmlFor="confirmation"
                className="text-sm text-amber-900 font-normal cursor-pointer leading-relaxed"
              >
                I understand that my medical records will be retained for 7 years per
                federal law and that this action cannot be undone after 30 days.
              </Label>
            </div>
            {errors.confirmation && (
              <p className="text-sm text-red-600 -mt-3">
                {errors.confirmation.message}
              </p>
            )}

            {/* Error Message */}
            {submitError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-800">{submitError}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/patient/settings')}
                className="w-full sm:w-auto"
              >
                <Mail className="h-4 w-4 mr-2" />
                Keep my account
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? 'Processing...' : 'Delete My Account'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
