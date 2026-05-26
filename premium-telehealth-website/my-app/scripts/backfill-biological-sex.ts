#!/usr/bin/env tsx
/**
 * Backfill PatientProfile.biologicalSex from the patient's latest submitted
 * intake. Pre-existing patients submitted before the intake-submit sync was
 * added (commit b62a7a8) have biologicalSex NULL on the profile but the value
 * sitting unused in Intake.formData.biologicalSex.
 *
 * Usage:
 *   npx tsx scripts/backfill-biological-sex.ts              # dry-run, all patients
 *   npx tsx scripts/backfill-biological-sex.ts --apply      # apply fix
 *   npx tsx scripts/backfill-biological-sex.ts --email=x@y  # only one patient
 */

import { config as loadEnv } from 'dotenv';
import path from 'node:path';

loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
loadEnv({ path: path.resolve(__dirname, '..', '.env') });

const VALID_VALUES = ['MALE', 'FEMALE', 'OTHER'] as const;
type BiologicalSex = typeof VALID_VALUES[number];

function normalize(raw: unknown): BiologicalSex | null {
  if (typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase();
  return (VALID_VALUES as readonly string[]).includes(upper) ? (upper as BiologicalSex) : null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const emailArg = args.find((a) => a.startsWith('--email='))?.split('=')[1];

  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  if (emailArg) console.log(`Filter: email=${emailArg}`);

  const { prisma } = await import('../lib/db/prisma');

  const where = {
    biologicalSex: null,
    ...(emailArg ? { user: { email: emailArg } } : {}),
  };
  const profiles = await prisma.patientProfile.findMany({
    where,
    include: { user: { select: { email: true } } },
  });

  console.log(`Scanning ${profiles.length} profile(s) with biologicalSex NULL...\n`);

  let candidateCount = 0;
  let fixedCount = 0;
  let noIntakeCount = 0;
  let invalidValueCount = 0;

  for (const profile of profiles) {
    const intake = await prisma.intake.findFirst({
      where: { patientId: profile.userId, status: 'SUBMITTED' },
      orderBy: { submittedAt: 'desc' },
      select: { id: true, formData: true, submittedAt: true },
    });

    if (!intake) {
      console.log(`[${profile.user.email}] no SUBMITTED intake — skipped`);
      noIntakeCount++;
      continue;
    }

    const formData = intake.formData as Record<string, unknown> | null;
    const raw = formData?.biologicalSex;
    const value = normalize(raw);

    if (!value) {
      console.log(
        `[${profile.user.email}] intake=${intake.id} formData.biologicalSex=${JSON.stringify(raw)} — invalid, skipped`,
      );
      invalidValueCount++;
      continue;
    }

    candidateCount++;
    console.log(`[${profile.user.email}] before: null  after: ${value}  (intake=${intake.id})`);

    if (apply) {
      await prisma.patientProfile.update({
        where: { userId: profile.userId },
        data: { biologicalSex: value },
      });
      fixedCount++;
      console.log(`  -> APPLIED\n`);
    } else {
      console.log(`  -> (dry-run; re-run with --apply)\n`);
    }
  }

  console.log(`\nSummary:`);
  console.log(`  ${profiles.length} profile(s) with biologicalSex NULL`);
  console.log(`  ${candidateCount} have a valid value in their latest submitted intake`);
  console.log(`  ${noIntakeCount} have no submitted intake`);
  console.log(`  ${invalidValueCount} have an invalid / missing intake value`);
  console.log(`  ${fixedCount} updated`);
  if (!apply && candidateCount > 0) {
    console.log(`\nRe-run with --apply to persist fixes.`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Backfill failed:', err instanceof Error ? err.message : 'Unknown error');
  process.exit(1);
});
