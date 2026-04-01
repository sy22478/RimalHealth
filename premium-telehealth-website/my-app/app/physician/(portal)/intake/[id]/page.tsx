/**
 * Intake Review Page
 * 
 * Page for physicians to review patient intake forms and make clinical decisions.
 * Protected route requiring PHYSICIAN role.
 * 
 * @module app/(physician)/intake/[id]/page
 */

import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { IntakeReview } from '@/components/physician/IntakeReview';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getIntakeForReview } from '@/lib/physician/review';
import { Permission, hasPermission } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getPhysicianDisplayName } from '@/lib/physician/patients';

interface IntakeReviewPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Page component for intake review
 * 
 * HIPAA Compliance:
 * - Verifies physician authentication
 * - Checks REVIEW_INTAKE permission
 * - Logs PHI access to audit trail
 */
export default async function IntakeReviewPage({ params }: IntakeReviewPageProps) {
  const { id: intakeId } = await params;

  // Get access token from cookies
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;

  if (!accessToken) {
    redirect('/login?redirect=' + encodeURIComponent(`/physician/intake/${intakeId}`));
  }

  // Verify token and get user
  let payload;
  try {
    payload = await verifyAccessToken(accessToken);
  } catch {
    redirect('/login?redirect=' + encodeURIComponent(`/physician/intake/${intakeId}`));
  }

  const user = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  };

  // Check if user has physician role
  if (user.role !== Role.PHYSICIAN && user.role !== Role.ADMIN) {
    redirect('/unauthorized');
  }

  // Check for review permission
  if (!hasPermission(user.role, Permission.REVIEW_INTAKE)) {
    redirect('/unauthorized');
  }

  // Get intake data
  const result = await getIntakeForReview(intakeId, user.userId, {
    ipAddress: 'server',
    userAgent: 'server',
    requestId: crypto.randomUUID(),
  });

  if (!result.success) {
    notFound();
  }

  const intake = result.data;

  // Only allow review of submitted or under-review intakes
  if (intake.status !== 'SUBMITTED' && intake.status !== 'UNDER_REVIEW') {
    redirect('/physician/dashboard');
  }

  // Run independent queries in parallel
  const [patientUser, physicianName] = await Promise.all([
    prisma.user.findUnique({
      where: { id: intake.patientId },
      select: { deactivatedAt: true },
    }),
    getPhysicianDisplayName(user.userId, user.email?.split('@')[0] || 'Physician'),
  ]);
  const isDeactivated = !!patientUser?.deactivatedAt;

  return (
    <IntakeReview
      intake={intake}
      physicianId={user.userId}
      physicianName={physicianName}
      isDeactivated={isDeactivated}
    />
  );
}

/**
 * Metadata for the page
 */
export const metadata = {
  title: 'Review Intake | Rimal Health Physician Portal',
  description: 'Review patient intake form and make clinical decisions',
};
