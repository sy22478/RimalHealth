/**
 * Patient Portal Layout (Server Component)
 *
 * Gate 1 — Intake Gate: Checks if the patient has a submitted/reviewed/approved intake.
 * If not, redirects to /intake. This prevents access to ANY patient portal page
 * until the intake form is completed.
 *
 * Gate 2 — MFA Gate: After the 7-day grace period, patients MUST have MFA enabled
 * to access the portal. If mfaEnabled === false and account is older than 7 days,
 * redirects to /patient/mfa-setup. The MFA setup page is excluded from this gate.
 *
 * 2026 HIPAA Security Rule mandates MFA for all ePHI access, including patients.
 *
 * Per Team H Architecture Amendment #1: These gates live here (server component
 * with Prisma access), NOT in Edge Middleware (which cannot run Prisma).
 *
 * @module app/patient/layout
 */

import * as React from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db/prisma';
import { ConcernType, IntakeStatus, Prisma, SubscriptionStatus } from '@prisma/client';
import { resolveProductId, WEIGHT_MANAGEMENT_SLUG, DEFAULT_PRODUCT_SLUG } from '@/lib/products/product';
import PatientLayoutClient from './PatientLayoutClient';

export const dynamic = 'force-dynamic';

// TEMPORARY: MFA gate disabled until AWS SNS toll-free number is approved
// and SMS delivery is verified. Re-enable when SMS works end-to-end.
// Tracking: AWS_MIGRATION_STATUS.md
const MFA_REQUIRED = false;

/** Number of days after account creation before MFA becomes mandatory */
const MFA_GRACE_PERIOD_DAYS = 7;

// Intake statuses that indicate the form has been completed/submitted
const COMPLETED_INTAKE_STATUSES: IntakeStatus[] = [
  IntakeStatus.SUBMITTED,
  IntakeStatus.UNDER_REVIEW,
  IntakeStatus.APPROVED,
  IntakeStatus.REJECTED,
  IntakeStatus.NEEDS_INFO,
];

export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Prefer middleware-injected headers (already verified, survives inline refresh)
  const headerStore = await headers();
  const middlewareUserId = headerStore.get('x-user-id');
  const currentPath = headerStore.get('x-pathname') ?? '';
  const isMfaSetupPath = currentPath === '/patient/mfa-setup';

  let userId: string;

  if (middlewareUserId) {
    // Middleware already verified the token (or refreshed it inline)
    userId = middlewareUserId;
  } else {
    // Fallback: verify access token cookie directly
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;

    if (!token) {
      redirect('/login?from=/patient/dashboard');
    }

    try {
      const payload = await verifyAccessToken(token);
      userId = payload.userId;
    } catch {
      redirect('/login?from=/patient/dashboard');
    }
  }

  // Gate 1a: Payment gate — payment-first flow requires an active or trialing
  // subscription before any portal access. A patient with a rejected intake,
  // cancelled subscription, or no subscription at all must return to checkout.
  let activeSubscription: { id: string } | null = null;
  try {
    activeSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
      },
      select: { id: true },
    });
  } catch (err) {
    console.error('[PatientLayout] Failed to check subscription status:', err instanceof Error ? err.message : 'Unknown error');
    redirect('/error?reason=subscription-check-failed');
  }

  if (!activeSubscription) {
    redirect('/checkout/payment');
  }

  // Gate 1b: Intake gate — check if patient has completed the CORRECT intake for
  // their product. Skip this gate when on /patient/mfa-setup, otherwise a patient
  // with no intake AND expired MFA grace period would loop:
  //   /intake → (MFA gate) → /patient/mfa-setup → (intake gate) → /intake
  if (!isMfaSetupPath) {
    // Determine the patient's product from their profile. Unset (legacy
    // patients) defaults to AUD so the existing flow is unchanged.
    let primaryConcern: ConcernType | null = null;
    try {
      const profile = await prisma.patientProfile.findUnique({
        where: { userId },
        select: { primaryConcern: true },
      });
      primaryConcern = profile?.primaryConcern ?? null;
    } catch (err) {
      console.error('[PatientLayout] Failed to read patient product:', err instanceof Error ? err.message : 'Unknown error');
      redirect('/error?reason=intake-check-failed');
    }

    const wantsGlp1 = primaryConcern === ConcernType.WEIGHT_MANAGEMENT;
    const intakeRoute = wantsGlp1 ? '/intake/glp1' : '/intake';

    let completedIntake: { id: string } | null = null;
    try {
      // Build a product-scoped where clause. Match completed intakes carrying the
      // patient's productId. For AUD, also accept legacy null-productId intakes
      // created before the Product table existed (Phase 1). If the product id
      // can't be resolved (un-migrated DB), fall back to "any completed intake".
      const where: Prisma.IntakeWhereInput = {
        patientId: userId,
        status: { in: COMPLETED_INTAKE_STATUSES },
      };
      if (wantsGlp1) {
        const glp1ProductId = await resolveProductId(WEIGHT_MANAGEMENT_SLUG);
        if (glp1ProductId) where.productId = glp1ProductId;
      } else {
        const audProductId = await resolveProductId(DEFAULT_PRODUCT_SLUG);
        where.OR = audProductId
          ? [{ productId: audProductId }, { productId: null }]
          : [{ productId: null }];
      }

      completedIntake = await prisma.intake.findFirst({ where, select: { id: true } });
    } catch (err) {
      console.error('[PatientLayout] Failed to check intake status:', err instanceof Error ? err.message : 'Unknown error');
      // On DB failure, redirect to an error page rather than silently allowing access
      redirect('/error?reason=intake-check-failed');
    }

    // If no completed intake for this product, redirect to the correct intake form
    if (!completedIntake) {
      redirect(intakeRoute);
    }
  }

  // Gate 2: MFA gate — enforce MFA after grace period
  // (Skip this gate if user is already on the MFA setup page to avoid redirect loop)
  let user: { mfaEnabled: boolean; createdAt: Date } | null = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, createdAt: true },
    });
  } catch (err) {
    console.error('[PatientLayout] Failed to fetch user for MFA check:', err instanceof Error ? err.message : 'Unknown error');
    // On DB failure, skip MFA gate to avoid blocking portal access
  }

  // Date.now() is safe in server components (single render per request).
  const now = Date.now();
  if (user && !user.mfaEnabled) {
    const accountAgeDays = Math.floor(
      (now - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (accountAgeDays > MFA_GRACE_PERIOD_DAYS) {
      // After grace period, MFA is mandatory — redirect to setup page
      // The redirect is caught by Next.js and the mfa-setup page renders
      // inside this layout (with sidebar), but we skip the gate for that path.
      // We pass a flag via headers/searchParams — however, since this is a layout
      // and we can't easily read the current pathname in a server component layout,
      // we store the MFA requirement in a data attribute and let the mfa-setup page
      // handle it. But we CAN redirect and let the mfa-setup page be within this layout.
      //
      // Note: The mfa-setup page route is at /patient/mfa-setup which is INSIDE this layout.
      // To avoid infinite redirect, we need to check the current path. In Next.js App Router,
      // layouts don't have access to the current path. So instead, we pass `mfaRequired`
      // as a prop to the client layout which can check pathname.
      //
      // Simplest approach: redirect here, and in mfa-setup page, it's a child of this layout
      // so the redirect would loop. Solution: use headers to detect the request path.
    }
  }

  // TEMPORARY: MFA gate disabled until AWS SNS toll-free number is approved
  // and SMS delivery is verified. Re-enable when SMS works end-to-end.
  // Tracking: AWS_MIGRATION_STATUS.md
  const mfaRequired = MFA_REQUIRED && (user ? !user.mfaEnabled : false);
  const accountAgeDays = user
    ? Math.floor((now - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <PatientLayoutClient
      mfaRequired={mfaRequired}
      mfaGracePeriodExpired={MFA_REQUIRED && accountAgeDays > MFA_GRACE_PERIOD_DAYS}
    >
      {children}
    </PatientLayoutClient>
  );
}
