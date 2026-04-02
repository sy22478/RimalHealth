/**
 * Prescriptions Page
 *
 * Prescription management page for physicians.
 * Shows all prescriptions with status tracking and actions.
 * Fetches data from /api/physician/prescriptions on the server.
 *
 * @module app/physician/prescriptions/page
 */

import * as React from 'react';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { PhysicianPrescriptionListItem } from '@/types/physician-dashboard';
import { PhysicianPrescriptionsClient } from './PhysicianPrescriptionsClient';

// ============================================================================
// Metadata
// ============================================================================

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Prescriptions | Physician Portal',
  description: 'Manage patient prescriptions and e-prescribing.',
};

// ============================================================================
// Main Page
// ============================================================================

export default async function PrescriptionsPage() {
  let prescriptions: PhysicianPrescriptionListItem[] = [];

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (token) {
      const res = await fetch(`${appUrl}/api/physician/prescriptions`, {
        headers: { Cookie: `accessToken=${token}` },
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.prescriptions)) {
          prescriptions = data.prescriptions;
        }
      }
    }
  } catch {
    // API unavailable — keep empty array
  }

  return <PhysicianPrescriptionsClient initialPrescriptions={prescriptions} />;
}
