/**
 * Patient Portal Layout (Server Component)
 *
 * Intake Gate: Checks if the patient has a submitted/reviewed/approved intake.
 * If not, redirects to /intake. This prevents access to ANY patient portal page
 * until the intake form is completed.
 *
 * Per Team H Architecture Amendment #1: This gate lives here (server component
 * with Prisma access), NOT in Edge Middleware (which cannot run Prisma).
 *
 * @module app/patient/layout
 */

import * as React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { prisma } from '@/lib/db/prisma';
import { IntakeStatus } from '@prisma/client';
import PatientLayoutClient from './PatientLayoutClient';

export const dynamic = 'force-dynamic';

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
  // Get user from access token cookie
  const cookieStore = await cookies();
  const token = cookieStore.get('accessToken')?.value;

  if (!token) {
    redirect('/login?from=/patient/dashboard');
  }

  let userId: string;
  try {
    const payload = await verifyAccessToken(token);
    userId = payload.userId;
  } catch {
    redirect('/login?from=/patient/dashboard');
  }

  // Check if patient has a completed/submitted intake
  const completedIntake = await prisma.intake.findFirst({
    where: {
      patientId: userId,
      status: { in: COMPLETED_INTAKE_STATUSES },
    },
    select: { id: true },
  });

  // If no completed intake, redirect to intake form
  if (!completedIntake) {
    redirect('/intake');
  }

  // Intake gate passed -- render the patient portal
  return <PatientLayoutClient>{children}</PatientLayoutClient>;
}
