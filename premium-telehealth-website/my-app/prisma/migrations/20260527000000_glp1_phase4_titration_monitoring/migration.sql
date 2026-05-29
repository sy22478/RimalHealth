-- GLP-1 Phase 4: titration scheduling, check-ins, and lab-gated refills for
-- weight-management treatment. Behavior-neutral for existing AUD patients:
-- the only change to an existing table is a nullable Prescription.supplyEndDate;
-- everything else is new tables/enums. The titration engine proposes/flags only
-- — physician approval (physicianApprovedAt/By) gates every dose advance.
-- Authored offline to match the repo's hand-written idempotent style; apply with
-- `prisma migrate deploy` at deploy time only (shared dev DB is behind).

-- AlterEnum: add LAB_RESULT document type for uploaded lab results.
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'LAB_RESULT';

-- CreateEnum (idempotent via duplicate_object guard — Postgres CREATE TYPE has
-- no IF NOT EXISTS).
DO $$ BEGIN
  CREATE TYPE "TitrationStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'DISCONTINUED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "TitrationStepStatus" AS ENUM ('PENDING', 'CURRENT', 'COMPLETED', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CheckInStatus" AS ENUM ('SCHEDULED', 'DUE', 'SUBMITTED', 'REVIEWED', 'MISSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable: GLP-1 supply window (nullable/additive).
ALTER TABLE "Prescription" ADD COLUMN IF NOT EXISTS "supplyEndDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TitrationSchedule" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "prescriptionId" TEXT,
    "status" "TitrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TitrationSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TitrationStep" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "dosage" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "status" "TitrationStepStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledStartDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "physicianApprovedAt" TIMESTAMP(3),
    "physicianApprovedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TitrationStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CheckIn" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "status" "CheckInStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "responses" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TitrationSchedule_patientId_idx" ON "TitrationSchedule"("patientId");
CREATE INDEX IF NOT EXISTS "TitrationSchedule_prescriptionId_idx" ON "TitrationSchedule"("prescriptionId");
CREATE INDEX IF NOT EXISTS "TitrationSchedule_status_idx" ON "TitrationSchedule"("status");
CREATE INDEX IF NOT EXISTS "TitrationStep_scheduleId_idx" ON "TitrationStep"("scheduleId");
CREATE INDEX IF NOT EXISTS "CheckIn_patientId_idx" ON "CheckIn"("patientId");
CREATE INDEX IF NOT EXISTS "CheckIn_status_idx" ON "CheckIn"("status");
CREATE INDEX IF NOT EXISTS "CheckIn_dueAt_idx" ON "CheckIn"("dueAt");
CREATE INDEX IF NOT EXISTS "CheckIn_patientId_status_idx" ON "CheckIn"("patientId", "status");

-- AddForeignKey (idempotent via duplicate_object guard)
DO $$ BEGIN
  ALTER TABLE "TitrationSchedule" ADD CONSTRAINT "TitrationSchedule_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TitrationSchedule" ADD CONSTRAINT "TitrationSchedule_prescriptionId_fkey"
    FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "TitrationStep" ADD CONSTRAINT "TitrationStep_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "TitrationSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
