'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const setPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a number')
    .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SetPasswordFormData = z.infer<typeof setPasswordSchema>;

function SetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SetPasswordFormData>({
    resolver: zodResolver(setPasswordSchema),
  });

  const password = watch('password', '');

  const requirements = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Special character', met: /[^A-Za-z0-9]/.test(password) },
  ];

  if (!token) {
    return (
      <div className="w-full text-center">
        <h1 className="text-2xl font-bold text-navy-800 mb-4">Invalid Link</h1>
        <p className="text-muted-foreground mb-6">
          This password link is missing or invalid. Please check your email for the correct link.
        </p>
        <Link href="/login" className="text-ocean-600 hover:text-ocean-700 font-medium">
          Go to Login
        </Link>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="w-full text-center">
        <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-navy-800 mb-2">Password Set Successfully</h1>
        <p className="text-muted-foreground mb-6">
          Your account is ready. You can now log in and complete your intake form.
        </p>
        <Button onClick={() => router.push('/login')} className="w-full">
          Go to Login
        </Button>
      </div>
    );
  }

  const onSubmit = async (data: SetPasswordFormData): Promise<void> => {
    setStatus('loading');
    setErrorMessage('');

    try {
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
        throw new Error(result.error || 'Failed to set password');
      }

      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong');
    }
  };

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-navy-800 mb-2">
          Set Your Password
        </h1>
        <p className="text-muted-foreground">
          Create a secure password to access your Rimal Health account
        </p>
      </div>

      {status === 'error' && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
              {...register('password')}
              className={errors.password ? 'border-red-500' : ''}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-red-500">{errors.password.message}</p>
          )}
        </div>

        {/* Password strength indicators */}
        {password.length > 0 && (
          <div className="space-y-1.5">
            {requirements.map((req) => (
              <div key={req.label} className="flex items-center gap-2 text-xs">
                <div className={`w-3 h-3 rounded-full ${req.met ? 'bg-green-500' : 'bg-gray-200'}`} />
                <span className={req.met ? 'text-green-700' : 'text-gray-500'}>{req.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirm your password"
              {...register('confirmPassword')}
              className={errors.confirmPassword ? 'border-red-500' : ''}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={status === 'loading'}>
          {status === 'loading' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Setting password...
            </>
          ) : (
            'Set Password & Continue'
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="text-ocean-600 hover:text-ocean-700 font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="w-full text-center">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48 mx-auto" />
          <div className="h-4 bg-gray-200 rounded w-64 mx-auto" />
        </div>
      </div>
    }>
      <SetPasswordContent />
    </Suspense>
  );
}
