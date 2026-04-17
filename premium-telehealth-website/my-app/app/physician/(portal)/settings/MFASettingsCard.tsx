'use client';

/**
 * MFA Settings Card
 *
 * Lets a user enroll in TOTP MFA, regenerate backup codes, or disable MFA.
 * Works for any authenticated role — the MFA API routes accept PATIENT,
 * PHYSICIAN, and ADMIN.
 *
 * @module app/physician/settings/MFASettingsCard
 */

import * as React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertCircle, CheckCircle, Copy, ShieldCheck, ShieldOff, KeyRound } from 'lucide-react';

type SetupStep = 'idle' | 'scan' | 'backup-codes';

function extractSecret(otpauthUri: string): string {
  try {
    const url = new URL(otpauthUri);
    return url.searchParams.get('secret') ?? '';
  } catch {
    return '';
  }
}

function BackupCodesPanel({
  codes,
  onClose,
  title = 'Save your backup codes',
}: {
  codes: string[];
  onClose: () => void;
  title?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Store these codes in a password manager or print them. Each code can only be used once.
          They will not be shown again.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-4 font-mono text-sm">
        {codes.map((code) => (
          <div key={code} className="tracking-widest">
            {code}
          </div>
        ))}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="outline" type="button" onClick={copyAll}>
          <Copy className="mr-2 h-4 w-4" />
          {copied ? 'Copied' : 'Copy all'}
        </Button>
        <Button type="button" onClick={onClose}>
          I&apos;ve saved these codes
        </Button>
      </div>

      <p className="sr-only">{title}</p>
    </div>
  );
}

export function MFASettingsCard({
  mfaEnabled: initialEnabled,
}: {
  mfaEnabled: boolean;
}) {
  const [mfaEnabled, setMfaEnabled] = React.useState(initialEnabled);

  // Enroll flow
  const [enrollOpen, setEnrollOpen] = React.useState(false);
  const [enrollStep, setEnrollStep] = React.useState<SetupStep>('idle');
  const [otpauthUri, setOtpauthUri] = React.useState('');
  const [secret, setSecret] = React.useState('');
  const [enrollCode, setEnrollCode] = React.useState('');
  const [backupCodes, setBackupCodes] = React.useState<string[]>([]);
  const [enrollLoading, setEnrollLoading] = React.useState(false);
  const [enrollError, setEnrollError] = React.useState('');

  // Disable flow
  const [disableOpen, setDisableOpen] = React.useState(false);
  const [disableCode, setDisableCode] = React.useState('');
  const [disableLoading, setDisableLoading] = React.useState(false);
  const [disableError, setDisableError] = React.useState('');

  // Regenerate flow
  const [regenOpen, setRegenOpen] = React.useState(false);
  const [regenCode, setRegenCode] = React.useState('');
  const [regenLoading, setRegenLoading] = React.useState(false);
  const [regenError, setRegenError] = React.useState('');
  const [regenCodes, setRegenCodes] = React.useState<string[]>([]);

  const startEnroll = async () => {
    setEnrollOpen(true);
    setEnrollStep('scan');
    setEnrollError('');
    setEnrollCode('');
    setEnrollLoading(true);

    try {
      const res = await fetch('/api/auth/mfa/setup', { method: 'POST' });
      const json = await res.json();

      if (!res.ok) {
        setEnrollError(json.error ?? 'Failed to start MFA setup');
        setEnrollStep('idle');
        return;
      }

      setOtpauthUri(json.otpauthUri ?? '');
      setSecret(extractSecret(json.otpauthUri ?? ''));
    } catch {
      setEnrollError('Network error while starting MFA setup. Try again.');
      setEnrollStep('idle');
    } finally {
      setEnrollLoading(false);
    }
  };

  const verifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(enrollCode)) {
      setEnrollError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setEnrollLoading(true);
    setEnrollError('');

    try {
      const res = await fetch('/api/auth/mfa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: enrollCode }),
      });
      const json = await res.json();

      if (!res.ok) {
        setEnrollError(json.error ?? 'Invalid verification code');
        return;
      }

      setBackupCodes(json.backupCodes ?? []);
      setEnrollStep('backup-codes');
      setMfaEnabled(true);
    } catch {
      setEnrollError('Network error. Try again.');
    } finally {
      setEnrollLoading(false);
    }
  };

  const closeEnroll = () => {
    setEnrollOpen(false);
    setEnrollStep('idle');
    setOtpauthUri('');
    setSecret('');
    setEnrollCode('');
    setBackupCodes([]);
    setEnrollError('');
  };

  const confirmDisable = async () => {
    if (!/^\d{6}$/.test(disableCode)) {
      setDisableError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setDisableLoading(true);
    setDisableError('');

    try {
      const res = await fetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: disableCode }),
      });
      const json = await res.json();

      if (!res.ok) {
        setDisableError(json.error ?? 'Failed to disable MFA');
        return;
      }

      setMfaEnabled(false);
      setDisableOpen(false);
      setDisableCode('');
    } catch {
      setDisableError('Network error. Try again.');
    } finally {
      setDisableLoading(false);
    }
  };

  const confirmRegenerate = async () => {
    if (!/^\d{6}$/.test(regenCode)) {
      setRegenError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setRegenLoading(true);
    setRegenError('');

    try {
      const res = await fetch('/api/auth/mfa/regenerate-backup-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: regenCode }),
      });
      const json = await res.json();

      if (!res.ok) {
        setRegenError(json.error ?? 'Failed to regenerate backup codes');
        return;
      }

      setRegenCodes(json.backupCodes ?? []);
      setRegenCode('');
    } catch {
      setRegenError('Network error. Try again.');
    } finally {
      setRegenLoading(false);
    }
  };

  const closeRegenerate = () => {
    setRegenOpen(false);
    setRegenCode('');
    setRegenCodes([]);
    setRegenError('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Protect your account with an authenticator app in addition to your password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border p-4">
          <div>
            <p className="text-sm font-medium">Status</p>
            <p className="text-xs text-muted-foreground">
              {mfaEnabled
                ? 'MFA is enabled on your account.'
                : 'MFA is not enabled. You will be prompted to enroll on next login if required.'}
            </p>
          </div>
          <Badge
            className={
              mfaEnabled ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
            }
          >
            {mfaEnabled ? 'Enabled' : 'Not enabled'}
          </Badge>
        </div>

        {!mfaEnabled && (
          <Button onClick={startEnroll}>
            <ShieldCheck className="mr-2 h-4 w-4" />
            Enable Two-Factor Authentication
          </Button>
        )}

        {mfaEnabled && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setRegenOpen(true)}>
              <KeyRound className="mr-2 h-4 w-4" />
              Regenerate backup codes
            </Button>
            <Button variant="destructive" onClick={() => setDisableOpen(true)}>
              <ShieldOff className="mr-2 h-4 w-4" />
              Disable MFA
            </Button>
          </div>
        )}
      </CardContent>

      {/* Enroll dialog */}
      <Dialog
        open={enrollOpen}
        onOpenChange={(open) => {
          if (!open) closeEnroll();
        }}
      >
        <DialogContent className="sm:max-w-md">
          {enrollStep === 'scan' && (
            <>
              <DialogHeader>
                <DialogTitle>Scan this QR code</DialogTitle>
                <DialogDescription>
                  Open your authenticator app (Google Authenticator, Authy, 1Password) and scan the
                  code below, or enter the secret key manually.
                </DialogDescription>
              </DialogHeader>

              {enrollLoading && !otpauthUri ? (
                <p className="text-sm text-muted-foreground">Generating setup code…</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-center rounded-md border bg-white p-4">
                    {otpauthUri ? (
                      <QRCodeSVG value={otpauthUri} size={192} level="M" />
                    ) : null}
                  </div>

                  {secret && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Or enter this secret manually
                      </Label>
                      <div className="rounded-md border bg-muted/40 p-2 font-mono text-xs tracking-widest break-all">
                        {secret}
                      </div>
                    </div>
                  )}

                  <form onSubmit={verifyEnroll} className="space-y-2">
                    <Label htmlFor="mfa-enroll-code">6-digit code from your app</Label>
                    <Input
                      id="mfa-enroll-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={enrollCode}
                      onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="font-mono tracking-widest text-center"
                      autoFocus
                    />

                    {enrollError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{enrollError}</AlertDescription>
                      </Alert>
                    )}

                    <DialogFooter className="pt-2">
                      <Button type="button" variant="outline" onClick={closeEnroll}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={enrollLoading}>
                        {enrollLoading ? 'Verifying…' : 'Verify & Enable'}
                      </Button>
                    </DialogFooter>
                  </form>
                </div>
              )}
            </>
          )}

          {enrollStep === 'backup-codes' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Two-factor authentication enabled
                </DialogTitle>
                <DialogDescription>
                  Save these backup codes now — you can use one in place of a TOTP code if you lose
                  access to your authenticator app.
                </DialogDescription>
              </DialogHeader>
              <BackupCodesPanel codes={backupCodes} onClose={closeEnroll} />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable confirmation */}
      <AlertDialog
        open={disableOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDisableOpen(false);
            setDisableCode('');
            setDisableError('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable two-factor authentication?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the extra verification step on login. Enter your current 6-digit
              authenticator code to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label htmlFor="mfa-disable-code">Authenticator code</Label>
            <Input
              id="mfa-disable-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="font-mono tracking-widest text-center"
            />
            {disableError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{disableError}</AlertDescription>
              </Alert>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDisable();
              }}
              disabled={disableLoading}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {disableLoading ? 'Disabling…' : 'Disable MFA'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate backup codes */}
      <Dialog
        open={regenOpen}
        onOpenChange={(open) => {
          if (!open) closeRegenerate();
        }}
      >
        <DialogContent className="sm:max-w-md">
          {regenCodes.length === 0 ? (
            <>
              <DialogHeader>
                <DialogTitle>Regenerate backup codes</DialogTitle>
                <DialogDescription>
                  Your previous backup codes will be invalidated. Enter your current 6-digit
                  authenticator code to continue.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label htmlFor="mfa-regen-code">Authenticator code</Label>
                <Input
                  id="mfa-regen-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={regenCode}
                  onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="font-mono tracking-widest text-center"
                  autoFocus
                />
                {regenError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{regenError}</AlertDescription>
                  </Alert>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeRegenerate}>
                  Cancel
                </Button>
                <Button onClick={confirmRegenerate} disabled={regenLoading}>
                  {regenLoading ? 'Regenerating…' : 'Regenerate codes'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  New backup codes
                </DialogTitle>
                <DialogDescription>
                  Save these backup codes. Previous codes are no longer valid.
                </DialogDescription>
              </DialogHeader>
              <BackupCodesPanel codes={regenCodes} onClose={closeRegenerate} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
