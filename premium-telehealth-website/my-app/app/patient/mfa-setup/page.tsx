'use client';

/**
 * Patient MFA Setup Page
 *
 * SMS-based two-factor authentication for patients (opt-in).
 * Sends a verification code to the patient's phone number on file.
 * If no phone number, prompts to add one in profile settings.
 *
 * TEMPORARY: MFA gate disabled until AWS SNS toll-free number is approved
 * and SMS delivery is verified. Re-enable when SMS works end-to-end.
 * Tracking: AWS_MIGRATION_STATUS.md
 *
 * @module app/patient/mfa-setup/page
 */

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { ShieldCheck, Smartphone, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function PatientMFASetupPage(): React.ReactElement {
  const router = useRouter();
  const [step, setStep] = useState<'start' | 'verify' | 'done'>('start');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [phoneHint, setPhoneHint] = useState('');
  const [code, setCode] = useState('');
  const [noPhone, setNoPhone] = useState(false);

  // Fetch the masked phone-on-file at mount so we can show
  // "We'll send a code to (•••) •••-1234" before the user clicks Send,
  // instead of the generic "your phone number on file".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/patient/mfa/setup-sms', {
          method: 'GET',
          credentials: 'include',
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data?.hasPhone === false) {
          setNoPhone(true);
          return;
        }
        if (typeof data?.phoneHint === 'string') {
          setPhoneHint(data.phoneHint);
        }
      } catch {
        // Non-fatal: the page still works, the hint just won't render.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Step 1: Request SMS code for setup
  const handleStartSetup = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const sendRes = await fetch('/api/patient/mfa/setup-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const sendData = await sendRes.json();

      if (!sendRes.ok) {
        if (sendData.code === 'NO_PHONE_NUMBER') {
          setNoPhone(true);
          return;
        }
        throw new Error(sendData.error || 'Failed to send verification code');
      }

      setPhoneHint(sendData.phoneHint || '');
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  // Step 2: Verify the SMS code and enable MFA
  const handleVerifyCode = useCallback(async (): Promise<void> => {
    if (code.length !== 6) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/patient/mfa/verify-sms-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: code }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Verification failed');
      }

      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [code]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-ocean-50 rounded-lg">
          <ShieldCheck className="h-6 w-6 text-ocean-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Set Up SMS Verification
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Protect your health information with a verification code sent to your phone.
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="mb-6 rounded-md border border-ocean-200 bg-ocean-50 p-4 text-sm text-ocean-800">
        <strong>Recommended for your security.</strong> We strongly recommend
        enabling multi-factor authentication to protect your health information.
        You can set this up now, or do it later from your settings.
      </div>

      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>SMS Verification</CardTitle>
          <CardDescription>
            {step === 'start' &&
              (noPhone
                ? 'No phone number on file. Please add one in your profile.'
                : phoneHint
                ? `We'll send a code to ${phoneHint}.`
                : 'We will send a code to your phone number on file.')}
            {step === 'verify' && `Enter the 6-digit code sent to ${phoneHint}.`}
            {step === 'done' && 'SMS verification is now enabled.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {noPhone && (
            <div className="space-y-4">
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <Smartphone className="inline h-4 w-4 mr-1" />
                <strong>Phone number required.</strong> Please add your phone number
                in your profile settings first, then return here to enable SMS verification.
              </div>
              <Button asChild className="w-full btn-primary">
                <Link href="/patient/settings">Go to Profile Settings</Link>
              </Button>
            </div>
          )}

          {/* Step 1: Start */}
          {step === 'start' && !noPhone && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Each time you sign in, we will send a 6-digit verification code
                to your phone via SMS. This adds an extra layer of security
                to protect your health information.
              </p>
              <Button
                onClick={handleStartSetup}
                disabled={loading}
                className="w-full btn-primary"
              >
                {loading ? 'Sending code...' : 'Send Verification Code'}
              </Button>
            </div>
          )}

          {/* Step 2: Verify */}
          {step === 'verify' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sms-code">Verification Code</Label>
                <Input
                  id="sms-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-lg tracking-widest font-mono"
                  autoFocus
                />
              </div>

              <Button
                onClick={handleVerifyCode}
                disabled={loading || code.length !== 6}
                className="w-full btn-primary"
              >
                {loading ? 'Verifying...' : 'Verify & Enable'}
              </Button>

              <button
                type="button"
                onClick={handleStartSetup}
                disabled={loading}
                className="w-full text-sm text-ocean-600 hover:text-ocean-700 disabled:text-muted-foreground"
              >
                Resend code
              </button>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 'done' && (
            <div className="space-y-4">
              <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800 text-center">
                SMS verification is now enabled. You will receive a code
                each time you sign in.
              </div>
              <Button
                className="w-full btn-primary"
                onClick={() => router.push('/patient/dashboard')}
              >
                Continue to Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
