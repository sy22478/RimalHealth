#!/usr/bin/env tsx
/**
 * One-off data repair: strip historical "[object Object]" tokens from
 * PatientProfile.medicalHistory / currentMedications / allergies.
 *
 * A prior revision of GET /api/patient/profile returned the raw medicalHistory
 * JSON object; the form rendered it via implicit String() coercion, and saves
 * wrote strings like "[object Object], High Cholesterol" back to the DB.
 *
 * Usage:
 *   npx tsx scripts/fix-medical-history.ts              # dry-run, all patients
 *   npx tsx scripts/fix-medical-history.ts --apply      # apply fix
 *   npx tsx scripts/fix-medical-history.ts --email=x@y  # only one patient
 */

import { config as loadEnv } from 'dotenv';
import path from 'node:path';

// Next.js auto-loads .env.local; a raw tsx script does not. Load before any
// import of lib/db/prisma (which reads DATABASE_URL at module init time).
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
loadEnv({ path: path.resolve(__dirname, '..', '.env') });

const FIELDS = ['medicalHistory', 'currentMedications', 'allergies'] as const;
type Field = typeof FIELDS[number];

function sanitizeMultiValueField(value: string): string | null {
  const cleaned = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item !== '[object Object]')
    .join(', ');
  return cleaned.length > 0 ? cleaned : null;
}

function isCorrupted(value: unknown): value is string {
  return typeof value === 'string' && value.includes('[object Object]');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const emailArg = args.find((a) => a.startsWith('--email='))?.split('=')[1];

  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  if (emailArg) console.log(`Filter: email=${emailArg}`);

  // Dynamic import: ensures DATABASE_URL is in env before lib/db/prisma reads it.
  const { prisma } = await import('../lib/db/prisma');

  const where = emailArg ? { user: { email: emailArg } } : {};
  const profiles = await prisma.patientProfile.findMany({
    where,
    include: { user: { select: { email: true } } },
  });

  console.log(`Scanning ${profiles.length} profile(s)...\n`);

  let corruptedCount = 0;
  let fixedCount = 0;

  for (const profile of profiles) {
    const updates: Record<Field, string | null> = {
      medicalHistory: null,
      currentMedications: null,
      allergies: null,
    };
    let hasCorruption = false;

    for (const field of FIELDS) {
      const current = profile[field];
      if (isCorrupted(current)) {
        hasCorruption = true;
        updates[field] = sanitizeMultiValueField(current);
        console.log(`[${profile.user.email}] ${field}:`);
        console.log(`  before: ${JSON.stringify(current)}`);
        console.log(`  after:  ${JSON.stringify(updates[field])}`);
      }
    }

    if (!hasCorruption) continue;
    corruptedCount++;

    if (apply) {
      const data: Record<string, string | null> = {};
      for (const field of FIELDS) {
        if (isCorrupted(profile[field])) {
          data[field] = updates[field];
        }
      }
      await prisma.patientProfile.update({
        where: { userId: profile.userId },
        data,
      });
      fixedCount++;
      console.log(`  -> APPLIED\n`);
    } else {
      console.log(`  -> (dry-run; re-run with --apply)\n`);
    }
  }

  console.log(`\nSummary: ${corruptedCount} profile(s) with corruption, ${fixedCount} repaired`);
  if (!apply && corruptedCount > 0) {
    console.log(`Re-run with --apply to persist fixes.`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Repair failed:', err instanceof Error ? err.message : 'Unknown error');
  process.exit(1);
});
