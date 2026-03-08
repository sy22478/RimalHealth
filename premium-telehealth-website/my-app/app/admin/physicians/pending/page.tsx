/**
 * Pending Physicians Queue Page
 *
 * A focused queue for reviewing and authorizing pending physicians.
 * Features card-based layout with bulk actions for efficiency.
 *
 * Server component fetches data from DB; interactive client component handles actions.
 *
 * @module app/admin/physicians/pending/page
 */

import * as React from 'react';
import { Metadata } from 'next';
import { prisma } from '@/lib/db/prisma';
import { PendingPhysiciansClient } from './PendingPhysiciansClient';

// ============================================================================
// Metadata
// ============================================================================

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pending Authorization | Admin Panel',
  description: 'Review and authorize physician applications',
};

// ============================================================================
// Data Fetching
// ============================================================================

export interface PendingPhysicianData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  npiNumber: string;
  licenseNumber: string;
  deaNumber: string | null;
  specialty: string | null;
  status: string;
  createdAt: string; // serialized for client component
}

async function fetchPendingPhysicians(): Promise<PendingPhysicianData[]> {
  const physicians = await prisma.physician.findMany({
    where: { status: 'PENDING' },
    include: {
      user: {
        select: {
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' }, // oldest first (highest urgency)
  });

  return physicians.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    email: p.user.email,
    npiNumber: p.npiNumber,
    licenseNumber: p.licenseNumber,
    deaNumber: p.deaNumber,
    specialty: p.specialty,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  }));
}

// ============================================================================
// Main Page (Server Component)
// ============================================================================

export default async function PendingPhysiciansPage(): Promise<React.ReactElement> {
  const physicians = await fetchPendingPhysicians();

  return <PendingPhysiciansClient initialPhysicians={physicians} />;
}
