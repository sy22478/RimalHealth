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
import type { PhysicianPatientDetail, RiskLevel } from '@/types/physician-dashboard';
import { getRiskLevelFromScore } from '@/types/physician-dashboard';
import { maskPhone } from '@/lib/utils/string-helpers';
import { humanizeValue } from '@/lib/utils/labels';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calculate age from date of birth string or Date.
 */
function calculateAge(dateOfBirth: string | Date | null | undefined): number {
  if (!dateOfBirth) return 0;
  let dob: Date;
  if (typeof dateOfBirth === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateOfBirth)) {
    const [y, m, d] = dateOfBirth.split('-').map(Number);
    dob = new Date(y, m - 1, d);
  } else {
    dob = new Date(dateOfBirth);
  }
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

  // Derive riskLevel from the latest intake's risk score so the patient detail
  // header agrees with the intake review's "Provider Decision Summary" risk badge.
  // Without this, riskLevel defaults to 'LOW' regardless of the actual score.
  const intakesRaw = Array.isArray(raw.intakes) ? (raw.intakes as Record<string, unknown>[]) : [];
  const latestIntakeScore = intakesRaw[0]?.riskScore as number | undefined;
  const riskLevel: RiskLevel =
    (raw.riskLevel as RiskLevel | undefined) ?? getRiskLevelFromScore(latestIntakeScore);

  // Prefer biologicalSex from the patient profile (synced from intake formData);
  // fall back to raw.gender for legacy rows. Humanize ("MALE" -> "Male") for display.
  const rawSex = (raw.biologicalSex as string | undefined) || (raw.gender as string | undefined);

  return {
    id: (raw.id as string) || '',
    name,
    age: calculateAge(dob),
    gender: rawSex ? humanizeValue(rawSex) : undefined,
    treatmentType: (raw.primaryConcern as string) || 'ALCOHOL',
    status: (raw.status as string) || 'ACTIVE',
    enrolledAt: raw.createdAt ? new Date(raw.createdAt as string) : new Date(),
    lastVisitAt: raw.lastVisit ? new Date(raw.lastVisit as string) : undefined,
    activePrescriptions: Array.isArray(raw.prescriptions) ? (raw.prescriptions as unknown[]).length : 0,
    unreadMessages: 0,
    riskLevel,
    emailMasked: maskEmail(email),
    phoneMasked: maskPhone(raw.phone as string | undefined),
    // Pass through raw YYYY-MM-DD string to avoid UTC serialization (Date objects
    // serialize as UTC timestamps across the RSC boundary and render a day early
    // in negative-offset timezones like PST).
    dateOfBirth: dob || undefined,
    address: address && address.street ? {
      street: address.street || '',
      city: address.city || '',
      state: address.state || '',
      zipCode: address.zip || address.zipCode || '',
    } : undefined,
    emergencyContact: raw.emergencyContact as PhysicianPatientDetail['emergencyContact'],
    medicalHistory: (() => {
      // The patient profile stores medicalHistory as a JSON object with boolean
      // flags plus arrays under medicalHistoryItems / conditions. Older callers
      // pass plain arrays; newer ones (post-intake-submit) store labeled arrays.
      // Coalesce every shape into the flat { conditions, medications, allergies }
      // expected by PatientDetailView so the chips actually render.
      const mh = raw.medicalHistory;
      const conditions: string[] = [];
      if (Array.isArray(mh)) {
        for (const item of mh) {
          if (typeof item === 'string' && item.trim()) conditions.push(humanizeValue(item));
        }
      } else if (mh && typeof mh === 'object') {
        const obj = mh as Record<string, unknown>;
        if (Array.isArray(obj.medicalHistoryItems)) {
          for (const item of obj.medicalHistoryItems) {
            if (typeof item === 'string' && item.trim()) conditions.push(humanizeValue(item));
          }
        }
        if (Array.isArray(obj.conditions)) {
          for (const item of obj.conditions) {
            if (typeof item === 'string' && item.trim()) conditions.push(humanizeValue(item));
          }
        }
        if (typeof obj.otherConditions === 'string' && obj.otherConditions.trim()) {
          conditions.push(obj.otherConditions.trim());
        }
        if (obj.hasLiverDisease === true) conditions.push('Liver Disease');
        if (obj.hasKidneyDisease === true) conditions.push('Kidney Disease');
        if (obj.hasHeartCondition === true) conditions.push('Heart Condition');
        if (obj.hasSeizureHistory === true) conditions.push('Seizure History');
        if (obj.hasPsychiatricHistory === true) conditions.push('Psychiatric History');
        if (obj.isPregnant === true) conditions.push('Pregnant');
      } else if (typeof mh === 'string' && mh.trim()) {
        for (const part of mh.split(',')) {
          const t = part.trim();
          if (t) conditions.push(humanizeValue(t));
        }
      }

      const medications: string[] = [];
      const cm = raw.currentMedications;
      if (Array.isArray(cm)) {
        for (const m of cm) if (typeof m === 'string' && m.trim()) medications.push(m.trim());
      } else if (cm && typeof cm === 'object') {
        const obj = cm as Record<string, unknown>;
        if (typeof obj.medicationList === 'string' && obj.medicationList.trim()) {
          medications.push(obj.medicationList.trim());
        }
      } else if (typeof cm === 'string' && cm.trim()) {
        for (const part of cm.split(',')) {
          const t = part.trim();
          if (t) medications.push(t);
        }
      }

      const allergies: string[] = [];
      const al = raw.allergies;
      if (Array.isArray(al)) {
        for (const a of al) if (typeof a === 'string' && a.trim()) allergies.push(humanizeValue(a));
      } else if (typeof al === 'string' && al.trim()) {
        for (const part of al.split(',')) {
          const t = part.trim();
          if (t) allergies.push(humanizeValue(t));
        }
      }

      const deduped = (arr: string[]) => Array.from(new Set(arr));
      return {
        conditions: deduped(conditions),
        medications: deduped(medications),
        allergies: deduped(allergies),
      };
    })(),
    treatmentPreferences: {
      preferredPharmacy: raw.prescriptions && Array.isArray(raw.prescriptions) && (raw.prescriptions as Record<string, unknown>[]).length > 0
        ? ((raw.prescriptions as Record<string, unknown>[])[0].pharmacyName as string) || undefined
        : undefined,
      communicationPreference: (raw.notificationPreferences as Record<string, string> | undefined)?.communicationPreference || undefined,
      languagePreference: undefined,
    },
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
