/**
 * Patient MFA Setup Page
 *
 * Allows patients to set up TOTP-based two-factor authentication.
 * After the 7-day grace period, patients are redirected here from the
 * patient layout if MFA is not yet enabled.
 *
 * Reuses the shared MFASetup component from components/auth/MFASetup.tsx.
 *
 * 2026 HIPAA Security Rule mandates MFA for all ePHI access.
 *
 * @module app/patient/mfa-setup/page
 */

'use client';

import * as React from 'react';
import { MFASetup } from '@/components/auth/MFASetup';
import { ShieldCheck } from 'lucide-react';

export default function PatientMFASetupPage(): React.ReactElement {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-ocean-50 rounded-lg">
          <ShieldCheck className="h-6 w-6 text-ocean-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Set Up Two-Factor Authentication
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Protect your health information with an extra layer of security.
            You will need an authenticator app such as Google Authenticator,
            Authy, or 1Password.
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="mb-6 rounded-md border border-ocean-200 bg-ocean-50 p-4 text-sm text-ocean-800">
        <strong>Why is this required?</strong> Under the 2026 HIPAA Security Rule,
        all access to electronic protected health information (ePHI) must be secured
        with multi-factor authentication. This protects your medical records from
        unauthorized access.
      </div>

      {/* Reuse the shared MFA setup wizard */}
      <MFASetup redirectUrl="/patient/dashboard" />
    </div>
  );
}
