'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage(): React.ReactElement {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordInput): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Something went wrong');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Reset Your Password</CardTitle>
          <CardDescription>
            {submitted
              ? 'Check your email for a reset link.'
              : "Enter your email and we'll send you a password reset link."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {submitted ? (
            <div className="space-y-4">
              <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                If an account with that email exists, a password reset link has
                been sent. Please check your inbox and spam folder.
              </div>
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  Back to Sign In
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-sm text-red-600">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full btn-primary"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                Remember your password?{' '}
                <Link href="/login" className="text-ocean hover:underline">
                  Sign in
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
