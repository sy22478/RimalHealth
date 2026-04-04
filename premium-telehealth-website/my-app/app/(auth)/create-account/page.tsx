'use client';

import React, { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Eye, EyeOff, CheckCircle2, Mail, Shield, Lock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const createAccountSchema = z.object({
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type CreateAccountFormData = z.infer<typeof createAccountSchema>;

// ============================================
// Progress Steps (shared pattern with consent page)
// ============================================

function ProgressSteps({ currentStep }: { currentStep: number }): React.JSX.Element {
  const steps = [
    { number: 1, label: 'Consent' },
    { number: 2, label: 'Payment' },
    { number: 3, label: 'Account' },
  ];

  return (
    <div className="flex items-center justify-center gap-0">
      {steps.map((step, index) => (
        <React.Fragment key={step.number}>
          <div className="flex items-center gap-2">
            <span
              className={`
                flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300
                ${step.number < currentStep
                  ? 'bg-success-500 text-white'
                  : step.number === currentStep
                    ? 'bg-ocean text-white shadow-md shadow-ocean/30'
                    : 'bg-gray-100 text-gray-400 border border-gray-200'
                }
              `}
            >
              {step.number < currentStep ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                step.number
              )}
            </span>
            <span
              className={`text-sm font-medium hidden sm:inline ${
                step.number === currentStep ? 'text-ocean' : step.number < currentStep ? 'text-success-600' : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`mx-3 h-px w-8 sm:w-12 transition-colors duration-300 ${
                step.number < currentStep ? 'bg-success-500' : 'bg-gray-200'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================
// Password Strength Bar
// ============================================

function PasswordStrengthBar({ password }: { password: string }): React.JSX.Element {
  const requirements = useMemo(() => [
    { label: 'At least 12 characters', met: password.length >= 12 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Special character', met: /[^A-Za-z0-9]/.test(password) },
  ], [password]);

  const metCount = requirements.filter((r) => r.met).length;
  const strength = metCount === 0 ? 0 : metCount <= 2 ? 1 : metCount <= 4 ? 2 : 3;
  const strengthLabels = ['', 'Weak', 'Good', 'Strong'];
  const strengthColors = ['bg-gray-200', 'bg-red-400', 'bg-warning', 'bg-success-500'];

  if (password.length === 0) return <></>;

  return (
    <div className="space-y-3">
      {/* Visual strength bar */}
      <div className="space-y-1.5">
        <div className="flex gap-1.5">
          {[1, 2, 3].map((level) => (
            <div
              key={level}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                strength >= level ? strengthColors[strength] : 'bg-gray-100'
              }`}
            />
          ))}
        </div>
        {strength > 0 && (
          <p className={`text-xs font-medium ${
            strength === 1 ? 'text-red-500' : strength === 2 ? 'text-warning-600' : 'text-success-600'
          }`}>
            {strengthLabels[strength]} password
          </p>
        )}
      </div>

      {/* Individual requirements */}
      <div className="space-y-1.5">
        {requirements.map((req) => (
          <div key={req.label} className="flex items-center gap-2 text-xs">
            <div
              className={`flex h-4 w-4 items-center justify-center rounded-full transition-all duration-200 ${
                req.met ? 'bg-success-500' : 'bg-gray-200'
              }`}
            >
              {req.met && (
                <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className={`transition-colors duration-200 ${req.met ? 'text-success-600' : 'text-gray-500'}`}>
              {req.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Main Content
// ============================================

function CreateAccountContent(): React.JSX.Element {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState<'loading-email' | 'idle' | 'loading' | 'success' | 'error' | 'invalid-token'>('loading-email');
  const [errorMessage, setErrorMessage] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateAccountFormData>({
    resolver: zodResolver(createAccountSchema),
  });

  const password = watch('password', '');

  // Fetch email from token on mount
  const fetchEmail = useCallback(async (): Promise<void> => {
    if (!token) {
      setStatus('invalid-token');
      return;
    }

    try {
      const response = await fetch(`/api/auth/verify-token?token=${encodeURIComponent(token)}`);
      const result = await response.json();

      if (!response.ok || !result.email) {
        setStatus('invalid-token');
        setErrorMessage(result.error || 'Invalid or expired link');
        return;
      }

      setUserEmail(result.email);
      setStatus('idle');
    } catch {
      setStatus('invalid-token');
      setErrorMessage('Unable to verify link. Please try again.');
    }
  }, [token]);

  useEffect(() => {
    fetchEmail();
  }, [fetchEmail]);

  // Invalid token state
  if (!token || status === 'invalid-token') {
    return (
      <div className="w-full">
        <Card className="shadow-lg border-gray-200/80">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 border border-red-100">
              <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-navy mb-3">Invalid Link</h1>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              {errorMessage || 'This account creation link is missing, invalid, or expired. Please check your email for the correct link.'}
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-ocean font-medium hover:text-ocean-600 transition-colors"
            >
              Go to Login
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (status === 'loading-email') {
    return (
      <div className="w-full">
        <Card className="shadow-lg border-gray-200/80">
          <CardContent className="pt-12 pb-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-ocean mx-auto mb-4" />
            <p className="text-muted-foreground">Verifying your link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="w-full">
        <Card className="shadow-lg border-gray-200/80">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-50 border-2 border-success-100">
              <CheckCircle2
                className="h-8 w-8 text-success-600"
                style={{
                  animation: 'consent-check-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                }}
              />
            </div>
            <h1 className="text-2xl font-bold text-navy mb-2">Account Created!</h1>
            <p className="text-muted-foreground mb-2 max-w-sm mx-auto">
              Your account has been created successfully. You can now log in and complete your intake form.
            </p>

            <div className="mt-6">
              <Link href="/login">
                <Button
                  className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-navy-500 to-ocean-500 hover:from-navy-600 hover:to-ocean-500 shadow-lg shadow-ocean/20 transition-all duration-200"
                >
                  Log In
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const onSubmit = async (data: CreateAccountFormData): Promise<void> => {
    setStatus('loading');
    setErrorMessage('');

    try {
      // Step 1: Set the password via the existing reset-password API
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: data.password,
          confirmPassword: data.confirmPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create account');
      }

      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong');
    }
  };

  return (
    <div className="w-full">
      {/* Progress indicator */}
      <div className="mb-8">
        <ProgressSteps currentStep={3} />
      </div>

      <Card className="shadow-lg border-gray-200/80 overflow-hidden">
        <CardHeader className="pb-0 pt-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-ocean-50 border border-ocean-100">
            <Lock className="h-7 w-7 text-ocean" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy mb-2">
            Create Your Account
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Set a secure password to activate your Rimal Health account
          </p>
        </CardHeader>

        <CardContent className="pt-6 pb-8">
          {/* Email display (read-only) */}
          <div className="mb-6 p-4 rounded-xl bg-navy-50/60 border border-navy-100">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-navy-100 shadow-sm">
                <Mail className="w-4 h-4 text-navy" />
              </div>
              <div>
                <p className="text-xs text-navy-500 font-medium">Account Email</p>
                <p className="text-sm font-semibold text-navy">{userEmail}</p>
              </div>
            </div>
          </div>

          {status === 'error' && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-navy">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  autoComplete="new-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  {...register('password')}
                  className={`h-11 pr-10 ${errors.password ? 'border-red-500 focus:ring-red-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>

            {/* Password strength indicator */}
            <PasswordStrengthBar password={password} />

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-navy">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  autoComplete="new-password"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  {...register('confirmPassword')}
                  className={`h-11 pr-10 ${errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full rounded-full h-12 text-base font-semibold bg-gradient-to-r from-navy-500 to-ocean-500 hover:from-navy-600 hover:to-ocean-500 shadow-lg shadow-ocean/20 transition-all duration-200 hover:shadow-xl hover:shadow-ocean/30"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-ocean font-medium hover:text-ocean-600 transition-colors">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>

      {/* Trust indicator */}
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5" />
        <span>Your data is encrypted with AES-256 and HIPAA-compliant</span>
      </div>
    </div>
  );
}

export default function CreateAccountPage(): React.JSX.Element {
  return (
    <Suspense fallback={
      <div className="w-full">
        <Card className="shadow-lg border-gray-200/80">
          <CardContent className="pt-12 pb-12">
            <div className="animate-pulse text-center space-y-4">
              <div className="h-8 bg-gray-200 rounded w-48 mx-auto" />
              <div className="h-4 bg-gray-200 rounded w-64 mx-auto" />
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <CreateAccountContent />
    </Suspense>
  );
}
