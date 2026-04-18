import type { Metadata } from 'next';
import { Suspense } from 'react';
import IntakeClient from './IntakeClient';

export const metadata: Metadata = {
  title: 'Treatment Intake | Rimal Health',
  description: 'Complete your medical intake form to begin treatment.',
};

export const dynamic = 'force-dynamic';

// TEMPORARY: MFA gate disabled until AWS SNS toll-free number is approved
// and SMS delivery is verified. Re-enable when SMS works end-to-end.
// Tracking: AWS_MIGRATION_STATUS.md
// The original enforceMfaGate() server-side check was removed from this
// file; restore it from commit 272a07b when re-enabling MFA enforcement.

export default async function IntakePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-8 w-48 bg-gray-200 rounded mx-auto mb-4"></div>
          <div className="h-4 w-32 bg-gray-200 rounded mx-auto"></div>
        </div>
      </div>
    }>
      <IntakeClient />
    </Suspense>
  );
}
