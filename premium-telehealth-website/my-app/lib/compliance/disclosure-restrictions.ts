/**
 * Disclosure Restriction Enforcement
 * 42 CFR Part 2 — Check active restrictions before disclosing PHI
 */

import { prisma } from '@/lib/db/prisma';

interface ActiveRestriction {
  id: string;
  restrictionType: string;
  description: string;
  requestedAt: Date;
}

/**
 * Check if the patient has any active (APPROVED) disclosure restrictions
 * that apply to the given disclosure type.
 *
 * Call this before logging a PHI disclosure to determine if the disclosure
 * should be blocked or flagged.
 */
export async function checkRestrictions(
  patientId: string,
  disclosureType: string
): Promise<ActiveRestriction[]> {
  const restrictions = await prisma.disclosureRestriction.findMany({
    where: {
      userId: patientId,
      status: 'APPROVED',
      restrictionType: disclosureType,
    },
    select: {
      id: true,
      restrictionType: true,
      description: true,
      requestedAt: true,
    },
  });

  return restrictions;
}

/**
 * Check if any approved restriction exists for a patient, regardless of type.
 * Useful for displaying a general restriction warning in the provider UI.
 */
export async function hasAnyRestriction(patientId: string): Promise<boolean> {
  const count = await prisma.disclosureRestriction.count({
    where: {
      userId: patientId,
      status: 'APPROVED',
    },
  });

  return count > 0;
}
