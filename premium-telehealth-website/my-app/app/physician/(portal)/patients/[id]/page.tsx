/**
 * Patient Detail Page
 *
 * Comprehensive view of a single patient including demographics,
 * medical history, intakes, prescriptions, notes, and documents.
 * Fetches data from /api/physician/patients/[id] on the server.
 *
 * @module app/physician/patients/[id]/page
 */

import * as React from 'react';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PatientDetailView } from '@/components/physician/PatientDetailView';
import type { PhysicianPatientDetail } from '@/types/physician-dashboard';

// ============================================================================
// Metadata
// ============================================================================

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  return {
    title: 'Patient Details | Physician Portal',
    description: 'View and manage patient information.',
  };
}

// ============================================================================
// Main Page Component
// ============================================================================

/**
 * Patient detail page with tabbed interface.
 *
 * Layout:
 * - Header with patient info and quick actions
 * - Tabbed interface: Overview, Intakes, Prescriptions, Notes, Documents
 */
export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let patient: PhysicianPatientDetail | null = null;

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (token) {
      const res = await fetch(`${appUrl}/api/physician/patients/${encodeURIComponent(id)}`, {
        headers: { Cookie: `accessToken=${token}` },
        cache: 'no-store',
      });

      if (res.status === 404) {
        notFound();
      }

      if (res.ok) {
        const data = await res.json();
        patient = data.patient ?? data ?? null;
      }
    }
  } catch {
    // API unavailable — treat as not found
  }

  if (!patient) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/physician/patients"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-1"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        Back to Patients
      </Link>

      {/* Patient Detail View with Tabs */}
      <PatientDetailView patient={patient} />
    </div>
  );
}
