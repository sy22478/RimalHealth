'use client';

/**
 * MFASetup Component
 *
 * A multi-step wizard for physicians and admins to enable TOTP-based MFA.
 *
 * Steps:
 * 1. Start setup - calls POST /api/auth/mfa/setup
 * 2. Enter verification code from authenticator app
 * 3. Display backup codes on success
 *
 * Uses React Hook Form + Zod for the verification input.
 */

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { QRCodeSVG } from 'qrcode.react';
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

// ============================================
// Types & Validation
// ============================================

const verifyCodeSchema = z.object({
  code: z
    .string()
    .length(6, 'Code must be 6 digits')
    .regex(/^\d{6}$/, 'Code must be numeric'),
});

type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;

type SetupStep = 'start' | 'verify' | 'backup';

interface SetupState {
  otpauthUri: string;
}

// ============================================
// Component
// ============================================

export function MFASetup(): React.ReactElement {
  const [step, setStep] = useState<SetupStep>('start');
  const [setupState, setSetupState] = useState<SetupState | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<VerifyCodeInput>({
    resolver: zodResolver(verifyCodeSchema),
  });

  // Step 1: Initiate setup
  const handleStartSetup = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/mfa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to initiate MFA setup');
      }

      const data = await response.json();
      setSetupState({ otpauthUri: data.otpauthUri });
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  // Step 2: Verify code
  const handleVerifyCode = useCallback(
    async (formData: VerifyCodeInput): Promise<void> => {
      if (!setupState) return;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/auth/mfa/verify-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: formData.code,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Verification failed');
        }

        const data = await response.json();
        setBackupCodes(data.backupCodes);
        setStep('backup');
        reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    },
    [setupState, reset]
  );

  // Copy backup codes to clipboard
  const handleCopyBackupCodes = useCallback(async (): Promise<void> => {
    try {
      const text = backupCodes.join('\n');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy to clipboard. Please copy the codes manually.');
    }
  }, [backupCodes]);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          {step === 'start' &&
            'Add an extra layer of security to your account.'}
          {step === 'verify' &&
            'Scan the code with your authenticator app and enter the 6-digit code.'}
          {step === 'backup' &&
            'Save these backup codes in a secure location.'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Step 1: Start */}
        {step === 'start' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Two-factor authentication adds an additional layer of security to
              your account by requiring a verification code from an
              authenticator app (such as Google Authenticator, Authy, or 1Password)
              each time you sign in.
            </p>
            <Button
              onClick={handleStartSetup}
              disabled={loading}
              className="w-full btn-primary"
            >
              {loading ? 'Setting up...' : 'Enable Two-Factor Authentication'}
            </Button>
          </div>
        )}

        {/* Step 2: Verify */}
        {step === 'verify' && setupState && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Scan QR Code
              </Label>
              <p className="text-xs text-muted-foreground">
                Scan this QR code with your authenticator app (Google
                Authenticator, Authy, or 1Password).
              </p>
              <div className="flex justify-center rounded-md bg-white p-4">
                <QRCodeSVG
                  value={setupState.otpauthUri}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>

            <form
              onSubmit={handleSubmit(handleVerifyCode)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="mfa-code">Verification Code</Label>
                <Input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  {...register('code')}
                />
                {errors.code && (
                  <p className="text-sm text-red-600">{errors.code.message}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full btn-primary"
              >
                {loading ? 'Verifying...' : 'Verify & Enable'}
              </Button>
            </form>
          </div>
        )}

        {/* Step 3: Backup Codes */}
        {step === 'backup' && (
          <div className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <strong>Important:</strong> Save these backup codes now. You will
              not be able to see them again. Each code can only be used once.
            </div>

            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, index) => (
                <div
                  key={index}
                  className="rounded-md bg-muted p-2 text-center font-mono text-sm tracking-wider"
                >
                  {code}
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={handleCopyBackupCodes}
              className="w-full"
            >
              {copied ? 'Copied!' : 'Copy All Codes'}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Two-factor authentication is now enabled. You will need to enter a
              code from your authenticator app each time you sign in.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
