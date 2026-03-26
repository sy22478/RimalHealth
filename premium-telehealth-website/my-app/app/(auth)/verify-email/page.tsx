'use client';

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, XCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

// ============================================
// Animated Success Checkmark
// ============================================

function AnimatedCheckmark(): React.JSX.Element {
  return (
    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center">
      <svg
        className="h-20 w-20"
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Circle */}
        <circle
          cx="40"
          cy="40"
          r="36"
          stroke="#059669"
          strokeWidth="3"
          fill="#ECFDF5"
          className="animate-[circle-draw_0.5s_ease-out_forwards]"
          style={{
            strokeDasharray: 226,
            strokeDashoffset: 226,
            animation: 'circle-draw 0.5s ease-out forwards',
          }}
        />
        {/* Checkmark */}
        <path
          d="M24 40l10 10 22-22"
          stroke="#059669"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          style={{
            strokeDasharray: 50,
            strokeDashoffset: 50,
            animation: 'check-draw 0.4s ease-out 0.4s forwards',
          }}
        />
      </svg>
    </div>
  );
}

// ============================================
// Countdown Progress
// ============================================

function RedirectCountdown({ seconds }: { seconds: number }): React.JSX.Element {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining(remaining - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  const progress = ((seconds - remaining) / seconds) * 100;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Redirecting to login in {remaining} second{remaining !== 1 ? 's' : ''}...
      </p>
      <div className="mx-auto w-48 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-success-500 to-success-600 transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ============================================
// Main Content
// ============================================

function VerifyEmailContent(): React.JSX.Element {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const redirectDelay = 4;

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  const verifyEmail = useCallback(async (): Promise<void> => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Verification token is missing. Please check your email for the correct link.');
      return;
    }

    try {
      const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
      const result = await response.json();

      if (!response.ok) {
        setStatus('error');
        setErrorMessage(result.error || 'Email verification failed. Please try again.');
        return;
      }

      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMessage('Unable to verify email. Please try again.');
    }
  }, [token]);

  useEffect(() => {
    verifyEmail();
  }, [verifyEmail]);

  // Auto-redirect to login after successful verification
  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => router.push('/login'), redirectDelay * 1000);
      return () => clearTimeout(timer);
    }
  }, [status, router]);

  // Verifying state
  if (status === 'verifying') {
    return (
      <Card className="shadow-lg border-gray-200/80">
        <CardContent className="pt-12 pb-12 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-ocean-50 border border-ocean-100">
            <Loader2 className="w-8 h-8 animate-spin text-ocean" />
          </div>
          <h1 className="text-2xl font-bold text-navy mb-2">Verifying Your Email</h1>
          <p className="text-muted-foreground max-w-xs mx-auto">
            Please wait while we verify your email address...
          </p>
        </CardContent>
      </Card>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <Card className="shadow-lg border-gray-200/80">
        <CardContent className="pt-10 pb-10 text-center">
          <AnimatedCheckmark />
          <h1 className="text-2xl font-bold text-navy mb-2">Email Verified!</h1>
          <p className="text-muted-foreground mb-6 max-w-xs mx-auto">
            Your email has been verified successfully. You can now log in and start your intake.
          </p>

          <RedirectCountdown seconds={redirectDelay} />

          <div className="mt-6">
            <Button
              onClick={() => router.push('/login')}
              className="w-full rounded-full h-11 font-semibold bg-gradient-to-r from-blue-500 to-ocean-500 hover:from-blue-600 hover:to-ocean-600 shadow-lg shadow-ocean/20 transition-all duration-200"
            >
              Go to Login Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  return (
    <Card className="shadow-lg border-gray-200/80">
      <CardContent className="pt-10 pb-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 border-2 border-red-100">
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-navy mb-2">Verification Failed</h1>
        <p className="text-muted-foreground mb-6 max-w-xs mx-auto">{errorMessage}</p>
        <div className="space-y-3 max-w-xs mx-auto">
          <Link href="/login" className="block">
            <Button variant="outline" className="w-full rounded-full h-11 font-medium">
              Go to Login
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground">
            Need a new verification email?{' '}
            <Link href="/login" className="text-ocean font-medium hover:text-ocean-600 transition-colors">
              Log in to request one
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage(): React.JSX.Element {
  return (
    <Suspense fallback={
      <div className="w-full">
        <Card className="shadow-lg border-gray-200/80">
          <CardContent className="pt-12 pb-12 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-ocean mx-auto mb-4" />
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
