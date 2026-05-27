/**
 * Lab-gated refills (Phase 4) — GLP-1 only.
 *
 * A weight-management refill is blocked until the patient has a qualifying lab
 * result on file uploaded within the recency window. Thresholds/types come from
 * `LAB_GATE` in `lib/intake/glp1/clinical-config.ts` (sign-off gated). AUD
 * refills are never gated.
 *
 * @module lib/titration/lab-gate
 */
import { prisma } from '@/lib/db/prisma';
import { LAB_GATE } from '@/lib/intake/glp1/clinical-config';
import { DocumentStatus, DocumentType } from '@prisma/client';

export interface LabGateStatus {
  /** A qualifying lab was uploaded within `LAB_GATE.recencyDays`. */
  hasRecentLab: boolean;
  /** Upload date of the most recent qualifying lab (any age), for messaging. */
  mostRecentLabDate: Date | null;
  /** Whether the gate is satisfied (currently == hasRecentLab). */
  gatePassed: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const QUALIFYING_TYPES = LAB_GATE.requiredDocumentTypes.map(
  (t) => t as DocumentType
);

/**
 * Evaluate the lab gate for a patient.
 *
 * @param patientId The patient's user id (Document.patientId → PatientProfile.userId == User.id).
 */
export async function getLabGateStatus(
  patientId: string
): Promise<LabGateStatus> {
  const cutoff = new Date(Date.now() - LAB_GATE.recencyDays * MS_PER_DAY);

  // Most recent qualifying lab regardless of age (for messaging + recency check).
  const mostRecent = await prisma.document.findFirst({
    where: {
      patientId,
      documentType: { in: QUALIFYING_TYPES },
      status: { not: DocumentStatus.DELETED },
    },
    orderBy: { uploadedAt: 'desc' },
    select: { uploadedAt: true },
  });

  const mostRecentLabDate = mostRecent?.uploadedAt ?? null;
  const hasRecentLab =
    mostRecentLabDate !== null && mostRecentLabDate.getTime() >= cutoff.getTime();

  return {
    hasRecentLab,
    mostRecentLabDate,
    gatePassed: hasRecentLab,
  };
}
