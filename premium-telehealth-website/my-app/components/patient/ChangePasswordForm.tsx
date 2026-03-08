'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Lock, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LoadingButton } from '@/components/ui/LoadingButton';

// ============================================================================
// Validation Schema
// ============================================================================

const changePasswordSchema = z.object({
  currentPassword: z.string()
    .min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be under 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

// ============================================================================
// Main Component
// ============================================================================

export function ChangePasswordForm(): React.ReactElement {
  const router = useRouter();
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
  });

  const newPassword = watch('newPassword', '');

  // Password strength indicator
  const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const strengthMap: Record<number, { label: string; color: string }> = {
      0: { label: 'Very Weak', color: 'bg-red-500' },
      1: { label: 'Weak', color: 'bg-orange-500' },
      2: { label: 'Fair', color: 'bg-yellow-500' },
      3: { label: 'Good', color: 'bg-blue-500' },
      4: { label: 'Strong', color: 'bg-green-500' },
      5: { label: 'Very Strong', color: 'bg-green-600' },
    };

    return { score, ...strengthMap[score] };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  const onSubmit = async (data: ChangePasswordFormValues): Promise<void> => {
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const res = await fetch('/api/patient/profile/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
          confirmPassword: data.confirmPassword,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to change password');
      }

      setSubmitSuccess(true);
      reset();

      // If re-login is required, redirect after delay
      if (result.requireReLogin) {
        setTimeout(() => {
          router.push('/login?message=password_changed');
        }, 3000);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-ocean-500" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your password to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Password */}
          <div>
            <Label htmlFor="currentPassword" className="flex items-center gap-1">
              Current Password <span className="text-red-500">*</span>
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                placeholder="Enter your current password"
                className="pr-10"
                aria-invalid={!!errors.currentPassword}
                aria-describedby={errors.currentPassword ? 'currentPassword-error' : undefined}
                {...register('currentPassword')}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <AnimatePresence>
              {errors.currentPassword && (
                <motion.p
                  id="currentPassword-error"
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-red-500 mt-1.5"
                >
                  {errors.currentPassword.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* New Password */}
          <div>
            <Label htmlFor="newPassword" className="flex items-center gap-1">
              New Password <span className="text-red-500">*</span>
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Enter your new password"
                className="pr-10"
                aria-invalid={!!errors.newPassword}
                aria-describedby={errors.newPassword ? 'newPassword-error' : undefined}
                {...register('newPassword')}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <AnimatePresence>
              {errors.newPassword && (
                <motion.p
                  id="newPassword-error"
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-red-500 mt-1.5"
                >
                  {errors.newPassword.message}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Password Strength Indicator */}
            {newPassword && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Password strength</span>
                  <span className={`text-xs font-medium ${passwordStrength.color.replace('bg-', 'text-')}`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${passwordStrength.color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}

            {/* Password Requirements */}
            <div className="mt-3 space-y-1">
              <p className="text-xs text-muted-foreground">Password must have:</p>
              <ul className="text-xs space-y-0.5">
                <li className={newPassword.length >= 8 ? 'text-green-600' : 'text-gray-400'}>
                  • At least 8 characters
                </li>
                <li className={/[A-Z]/.test(newPassword) ? 'text-green-600' : 'text-gray-400'}>
                  • One uppercase letter
                </li>
                <li className={/[a-z]/.test(newPassword) ? 'text-green-600' : 'text-gray-400'}>
                  • One lowercase letter
                </li>
                <li className={/\d/.test(newPassword) ? 'text-green-600' : 'text-gray-400'}>
                  • One number
                </li>
                <li className={/[^A-Za-z0-9]/.test(newPassword) ? 'text-green-600' : 'text-gray-400'}>
                  • One special character
                </li>
              </ul>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <Label htmlFor="confirmPassword" className="flex items-center gap-1">
              Confirm New Password <span className="text-red-500">*</span>
            </Label>
            <div className="relative mt-1.5">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your new password"
                className="pr-10"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
                {...register('confirmPassword')}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <AnimatePresence>
              {errors.confirmPassword && (
                <motion.p
                  id="confirmPassword-error"
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-red-500 mt-1.5"
                >
                  {errors.confirmPassword.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Security Notice */}
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
            <p className="text-sm text-amber-800">
              <strong>Security Note:</strong> After changing your password, you will be logged out of all devices and need to sign in again with your new password.
            </p>
          </div>

          {/* Success/Error Messages */}
          {submitSuccess && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Your password has been changed successfully. You will be redirected to the login page in a few seconds.
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
              Change Password
            </LoadingButton>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

export default ChangePasswordForm;
