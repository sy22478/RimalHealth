import type { Metadata } from 'next';
import { Suspense } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { IntakeStatus } from '@prisma/client';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db/prisma';
import { resolveProductId, WEIGHT_MANAGEMENT_SLUG } from '@/lib/products/product';
import Glp1IntakeClient from './Glp1IntakeClient';

export const metadata: Metadata = {
  title: 'Weight Management Intake',
  description: 'Complete your GLP-1 weight-management intake to begin treatment.',
};

export const dynamic = 'force-dynamic';

// Once a patient has submitted (or been reviewed on) their GLP-1 intake, the
// form must NOT re-render as a blank Step 1 — that breaks the "one active intake
// per patient (per product)" business rule and would let them silently
// overwrite or duplicate a record that is already in physician review.
const NON_DRAFT_INTAKE_STATUSES: IntakeStatus[] = [
  IntakeStatus.SUBMITTED,
  IntakeStatus.UNDER_REVIEW,
  IntakeStatus.APPROVED,
  IntakeStatus.REJECTED,
  IntakeStatus.NEEDS_INFO,
];

export default async function Glp1IntakePage(): Promise<React.ReactElement> {
  const headerStore = await headers();
  let userId = headerStore.get('x-user-id');

  if (!userId) {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    if (token) {
      try {
        const payload = await verifyAccessToken(token);
        userId = payload.userId;
      } catch {
        // Fall through — middleware will handle the auth redirect
      }
    }
  }

  if (userId) {
    try {
      // Per-(patient, product) gate: a patient with a completed AUD intake can
      // still start the GLP-1 treatment, and vice versa.
      const productId = await resolveProductId(WEIGHT_MANAGEMENT_SLUG);

      const existingIntake = await prisma.intake.findFirst({
        where: {
          patientId: userId,
          status: { in: NON_DRAFT_INTAKE_STATUSES },
          productId,
        },
        select: { id: true },
      });

      if (existingIntake) {
        redirect('/patient/dashboard');
      }
    } catch (err) {
      // redirect() throws — re-throw so Next.js can handle it
      if (err && typeof err === 'object' && 'digest' in err) throw err;
      console.error(
        '[Glp1IntakePage] Failed to check existing intake:',
        err instanceof Error ? err.message : 'Unknown error'
      );
      // On DB failure, allow the form to render rather than block the user
    }
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-center">
            <div className="h-8 w-48 bg-gray-200 rounded mx-auto mb-4"></div>
            <div className="h-4 w-32 bg-gray-200 rounded mx-auto"></div>
          </div>
        </div>
      }
    >
      <Glp1IntakeClient />
    </Suspense>
  );
}
