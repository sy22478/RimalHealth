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
/**
 * Calculate age from date of birth string or Date.
 * Returns 0 if dateOfBirth is missing or invalid.
 */
function calculateAge(dateOfBirth: string | Date | null | undefined): number {
  if (!dateOfBirth) return 0;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Mask an email for display (e.g., "j***@example.com").
 */
function maskEmail(email: string | null | undefined): string {
  if (!email) return 'No email';
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  return `${local[0]}***@${domain}`;
}

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
          // Map API response fields to PhysicianPatientListItem shape
          patients = data.patients.map((p: Record<string, unknown>) => ({
            id: (p.id as string) || '',
            name: [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unknown',
            age: calculateAge(p.dateOfBirth as string | null),
            gender: (p.gender as string) || undefined,
            treatmentType: (p.primaryConcern as string) || 'ALCOHOL',
            status: (p.status as string) || 'ACTIVE',
            enrolledAt: p.createdAt ? new Date(p.createdAt as string) : new Date(),
            lastVisitAt: p.lastVisitAt ? new Date(p.lastVisitAt as string) : undefined,
            activePrescriptions: (p.activePrescriptions as number) || 0,
            unreadMessages: (p.unreadMessages as number) || 0,
            riskLevel: (p.riskLevel as string) || 'LOW',
            emailMasked: maskEmail(p.email as string | null),
            phoneMasked: (p.phoneMasked as string) || 'No phone',
          }));
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
