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
import { verifyAccessToken } from '@/lib/auth/jwt';
import { getPhysicianDisplayName } from '@/lib/physician/patients';
import type { PhysicianPatientDetail } from '@/types/physician-dashboard';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calculate age from date of birth string or Date.
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
 * Mask an email for display.
 */
function maskEmail(email: string | null | undefined): string {
  if (!email) return 'No email';
  const parts = email.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return 'Invalid email';
  return `${parts[0][0]}***@${parts[1]}`;
}

/**
 * Map the raw API patient detail response to PhysicianPatientDetail shape
 * that the PatientDetailView component expects.
 */
function mapApiResponseToPatientDetail(raw: Record<string, unknown>): PhysicianPatientDetail {
  const firstName = (raw.firstName as string) || '';
  const lastName = (raw.lastName as string) || '';
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown Patient';
  const email = raw.email as string | undefined;
  const dob = raw.dateOfBirth as string | undefined;
  const address = raw.address as Record<string, string> | undefined;

  return {
    id: (raw.id as string) || '',
    name,
    age: calculateAge(dob),
    gender: (raw.gender as string) || undefined,
    treatmentType: (raw.primaryConcern as string) || 'ALCOHOL',
    status: (raw.status as string) || 'ACTIVE',
    enrolledAt: raw.createdAt ? new Date(raw.createdAt as string) : new Date(),
    lastVisitAt: raw.lastVisit ? new Date(raw.lastVisit as string) : undefined,
    activePrescriptions: Array.isArray(raw.prescriptions) ? (raw.prescriptions as unknown[]).length : 0,
    unreadMessages: 0,
    riskLevel: (raw.riskLevel as string) || 'LOW',
    emailMasked: maskEmail(email),
    phoneMasked: (raw.phone as string) || 'No phone',
    dateOfBirth: dob ? new Date(dob) : undefined,
    address: address && address.street ? {
      street: address.street || '',
      city: address.city || '',
      state: address.state || '',
      zipCode: address.zip || address.zipCode || '',
    } : undefined,
    emergencyContact: raw.emergencyContact as PhysicianPatientDetail['emergencyContact'],
    medicalHistory: raw.medicalHistory ? {
      conditions: Array.isArray((raw.medicalHistory as Record<string, unknown>).conditions)
        ? (raw.medicalHistory as Record<string, unknown>).conditions as string[]
        : [],
      medications: Array.isArray(raw.currentMedications)
        ? raw.currentMedications as string[]
        : [],
      allergies: Array.isArray(raw.allergies) ? raw.allergies as string[] : [],
    } : undefined,
    treatmentPreferences: undefined,
    intakes: Array.isArray(raw.intakes)
      ? (raw.intakes as Record<string, unknown>[]).map((i) => ({
          id: (i.id as string) || '',
          status: (i.status as string) || 'DRAFT',
          submittedAt: i.submittedAt ? new Date(i.submittedAt as string) : new Date(),
          reviewedAt: i.review && (i.review as Record<string, unknown>).completedAt
            ? new Date((i.review as Record<string, unknown>).completedAt as string)
            : undefined,
          reviewedBy: i.review && (i.review as Record<string, unknown>).physician
            ? `Dr. ${((i.review as Record<string, unknown>).physician as Record<string, string>).firstName || ''} ${((i.review as Record<string, unknown>).physician as Record<string, string>).lastName || ''}`.trim()
            : undefined,
          riskScore: i.riskScore as number | undefined,
          outcome: i.review ? (i.review as Record<string, unknown>).decision as string : undefined,
        }))
      : [],
    prescriptions: Array.isArray(raw.prescriptions)
      ? (raw.prescriptions as Record<string, unknown>[]).map((rx) => ({
          id: (rx.id as string) || '',
          medicationName: (rx.medicationName as string) || '',
          genericName: (rx.genericName as string) || undefined,
          dosage: (rx.dosage as string) || '',
          frequency: (rx.frequency as string) || undefined,
          quantity: (rx.quantity as number) || 0,
          refillsRemaining: (rx.refillsRemaining as number) || 0,
          status: (rx.status as string) || 'PENDING',
          prescribedAt: rx.createdAt ? new Date(rx.createdAt as string) : new Date(),
          pharmacyName: (rx.pharmacyName as string) || 'Unknown pharmacy',
          instructions: (rx.instructions as string) || undefined,
        }))
      : [],
    recentMessages: Array.isArray(raw.messages)
      ? (raw.messages as Record<string, unknown>[]).map((msg) => ({
          id: (msg.id as string) || '',
          subject: (msg.subject as string) || undefined,
          body: (msg.body as string) || '',
          senderType: (msg.senderType as string) || 'PATIENT',
          sentAt: msg.sentAt ? new Date(msg.sentAt as string) : new Date(),
          read: !!msg.readAt,
        }))
      : [],
    timeline: [],
    notes: Array.isArray(raw.notes)
      ? (raw.notes as Record<string, unknown>[]).map((n) => ({
          id: (n.id as string) || '',
          content: (n.content as string) || '',
          type: 'CLINICAL' as const,
          createdAt: n.createdAt ? new Date(n.createdAt as string) : new Date(),
          physician: (n.physician as { firstName: string; lastName: string }) || { firstName: '', lastName: '' },
        }))
      : [],
    documents: Array.isArray(raw.documents)
      ? (raw.documents as Record<string, unknown>[]).map((d) => ({
          id: (d.id as string) || '',
          name: (d.fileName as string) || 'Untitled',
          type: (d.mimeType as string) || '',
          uploadedAt: d.uploadedAt ? new Date(d.uploadedAt as string) : new Date(),
          size: (d.fileSize as number) || 0,
          category: (d.documentType as string) || 'OTHER',
        }))
      : [],
  } as PhysicianPatientDetail;
}

// ============================================================================
// Metadata
// ============================================================================

export const dynamic = 'force-dynamic';

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
  let physicianName = 'Current Physician';

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (token) {
      // Verify token first (needed for userId), then run physician lookup and API fetch in parallel
      try {
        const payload = await verifyAccessToken(token);

        const [, res] = await Promise.all([
          getPhysicianDisplayName(payload.userId).then(name => { physicianName = name; }),
          fetch(`${appUrl}/api/physician/patients/${encodeURIComponent(id)}`, {
            headers: { Cookie: `accessToken=${token}` },
            cache: 'no-store',
          }),
        ]);

        if (res.status === 404) {
          notFound();
        }

        if (res.ok) {
          const data = await res.json();
          const rawPatient = data.patient ?? data ?? null;
          if (rawPatient) {
            patient = mapApiResponseToPatientDetail(rawPatient);
          }
        }
      } catch (error) {
        console.error('Patient detail fetch error:', error instanceof Error ? error.message : 'Unknown error');
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
      <PatientDetailView patient={patient} physicianName={physicianName} />
    </div>
  );
}
