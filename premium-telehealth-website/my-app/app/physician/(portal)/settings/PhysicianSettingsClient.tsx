'use client';

/**
 * Physician Settings Client Component
 *
 * Handles password change and displays read-only profile information.
 *
 * @module app/physician/settings/PhysicianSettingsClient
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Lock, User, Shield } from 'lucide-react';
import { MFASettingsCard } from './MFASettingsCard';
import { fetchWithCSRF } from '@/lib/security/csrf';

// ============================================================================
// Types
// ============================================================================

interface PhysicianProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  npiNumber: string;
  licenseNumber: string;
  licenseState: string;
  deaNumber?: string | null;
  specialty?: string | null;
  status: string;
  isActive: boolean;
  maxDailyReviews: number;
  totalReviews: number;
  mfaEnabled?: boolean;
}

// ============================================================================
// Password Change Schema
// ============================================================================

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password must be under 128 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/\d/, 'Must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

// ============================================================================
// Password Change Form
// ============================================================================

function ChangePasswordForm() {
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = React.useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = async (data: ChangePasswordFormData) => {
    setStatus('loading');
    setErrorMessage('');

    try {
      const res = await fetchWithCSRF('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
          confirmPassword: data.confirmPassword,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setStatus('error');
        setErrorMessage(json.error || 'Failed to change password');
        return;
      }

      setStatus('success');
      reset();

      // If requireReLogin, redirect to login after a short delay
      if (json.requireReLogin) {
        setTimeout(() => {
          window.location.assign('/physician/login');
        }, 2000);
      }
    } catch {
      setStatus('error');
      setErrorMessage('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {status === 'success' && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Password changed successfully. Redirecting to login…
          </AlertDescription>
        </Alert>
      )}

      {status === 'error' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="currentPassword">Current Password</Label>
        <Input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          {...register('currentPassword')}
        />
        {errors.currentPassword && (
          <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">New Password</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          {...register('newPassword')}
        />
        {errors.newPassword && (
          <p className="text-sm text-destructive">{errors.newPassword.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm New Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      <Button type="submit" disabled={status === 'loading' || status === 'success'}>
        {status === 'loading' ? 'Updating…' : 'Change Password'}
      </Button>
    </form>
  );
}

// ============================================================================
// Main Settings Component
// ============================================================================

export function PhysicianSettingsClient({ physician }: { physician: PhysicianProfile }) {
  const statusColor =
    physician.status === 'ACTIVE'
      ? 'bg-green-100 text-green-800'
      : physician.status === 'PENDING'
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-red-100 text-red-800';

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Profile Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Physician Profile
          </CardTitle>
          <CardDescription>Your credentials and account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">
                Dr. {physician.firstName} {physician.lastName}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{physician.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Specialty</p>
              <p className="font-medium">{physician.specialty || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Account Status</p>
              <Badge className={statusColor}>{physician.status}</Badge>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">NPI Number</p>
              <p className="font-medium font-mono">{physician.npiNumber}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">License</p>
              <p className="font-medium font-mono">
                {physician.licenseState}-{physician.licenseNumber}
              </p>
            </div>
            {physician.deaNumber && (
              <div>
                <p className="text-sm text-muted-foreground">DEA Number</p>
                <p className="font-medium font-mono">{physician.deaNumber}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Total Reviews</p>
              <p className="font-medium">{physician.totalReviews}</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            To update your credentials or profile information, contact the administrator.
          </p>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Security
          </CardTitle>
          <CardDescription>Change your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <MFASettingsCard mfaEnabled={Boolean(physician.mfaEnabled)} />

      {/* HIPAA Notice */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 text-sm">HIPAA Compliance Notice</h3>
            <p className="text-xs text-blue-800 mt-1">
              All your actions in this portal are audit logged as required by HIPAA regulations.
              Do not share your login credentials. Log out when leaving an unattended workstation.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
