/**
 * Patients List Page
 *
 * Displays a searchable, sortable table of all patients with pagination.
 * Fetches data from /api/physician/patients on the server.
 *
 * @module app/physician/patients/page
 */

import * as React from 'react';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { PatientTable } from '@/components/physician/PatientTable';
import { PatientStats } from '@/components/physician/PatientStats';
import type { PhysicianPatientListItem } from '@/types/physician-dashboard';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Patients | Physician Portal',
  description: 'Manage and view all your patients.',
};

// ============================================================================
// Main Page Component
// ============================================================================

/**
 * Patients list page — fetches real data from /api/physician/patients.
 *
 * Features:
 * - Search by name/email
 * - Sortable columns (name, age, last visit)
 * - Pagination (20 per page)
 * - Click row to view patient detail
 * - Loading state with skeleton
 */
export default async function PatientsPage() {
  let patients: PhysicianPatientListItem[] = [];

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (token) {
      const res = await fetch(`${appUrl}/api/physician/patients`, {
        headers: { Cookie: `accessToken=${token}` },
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.patients)) {
          patients = data.patients;
        }
      }
    }
  } catch {
    // API unavailable — keep empty array
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <PatientStats patients={patients} />

      {/* Patient Table */}
      <PatientTable
        patients={patients}
        pageSize={20}
      />
    </div>
  );
}
