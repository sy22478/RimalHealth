import type { Metadata } from 'next';
import { Suspense } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db/prisma';
import IntakeClient from './IntakeClient';

export const metadata: Metadata = {
  title: 'Treatment Intake | Rimal Health',
  description: 'Complete your medical intake form to begin treatment.',
};

export const dynamic = 'force-dynamic';

/**
 * Number of days after account creation before MFA becomes mandatory.
 * Mirrors `MFA_GRACE_PERIOD_DAYS` in app/patient/layout.tsx so /intake
 * doesn't become a PHI-entry hole that bypasses the patient-portal MFA gate.
 */
const MFA_GRACE_PERIOD_DAYS = 7;

/**
 * Server-side MFA gate.
 *
 * /intake collects PHI (name, DOB, address, medical history) but lives outside
 * the /patient/* layout, so until now an authenticated patient with no MFA
 * could fill it out indefinitely. The 2026 HIPAA Security Rule requires MFA
 * for all ePHI access, so once the 7-day setup grace period expires we
 * redirect to /patient/mfa-setup.
 */
async function enforceMfaGate(): Promise<void> {
  const headerStore = await headers();
  const middlewareUserId = headerStore.get('x-user-id');

  let userId: string | null = middlewareUserId;
  if (!userId) {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    if (!token) {
      // Middleware should have redirected — this is a defense-in-depth fallback.
      redirect('/login?from=/intake');
    }
    try {
      const payload = await verifyAccessToken(token);
      userId = payload.userId;
    } catch {
      redirect('/login?from=/intake');
    }
  }

  let user: { mfaEnabled: boolean; createdAt: Date } | null = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, createdAt: true },
    });
  } catch (err) {
    // If the DB lookup fails, fail open so a transient outage doesn't block
    // legitimate intake completion. The patient layout's MFA gate will catch
    // it on the next navigation.
    console.error(
      '[intake/page] Failed to fetch user for MFA check:',
      err instanceof Error ? err.message : 'Unknown error',
    );
    return;
  }

  if (!user || user.mfaEnabled) return;

  const accountAgeDays = Math.floor(
    (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );

  if (accountAgeDays > MFA_GRACE_PERIOD_DAYS) {
    redirect('/patient/mfa-setup');
  }
}

export default async function IntakePage() {
  await enforceMfaGate();

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
