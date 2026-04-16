-- Fix 42 CFR Part 2 cascade deletes + add missing FKs for Part 2 record retention.
-- See reviews/review-4-security-hipaa.md findings 23-32.

-- =====================================================================
-- 1. Change onDelete: Cascade -> Restrict on Part 2 record chains
-- =====================================================================

-- PatientProfile.user
ALTER TABLE "PatientProfile" DROP CONSTRAINT IF EXISTS "PatientProfile_userId_fkey";
ALTER TABLE "PatientProfile"
  ADD CONSTRAINT "PatientProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Intake.patient
ALTER TABLE "Intake" DROP CONSTRAINT IF EXISTS "Intake_patientId_fkey";
ALTER TABLE "Intake"
  ADD CONSTRAINT "Intake_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Review.intake
ALTER TABLE "Review" DROP CONSTRAINT IF EXISTS "Review_intakeId_fkey";
ALTER TABLE "Review"
  ADD CONSTRAINT "Review_intakeId_fkey"
  FOREIGN KEY ("intakeId") REFERENCES "Intake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prescription.intake
ALTER TABLE "Prescription" DROP CONSTRAINT IF EXISTS "Prescription_intakeId_fkey";
ALTER TABLE "Prescription"
  ADD CONSTRAINT "Prescription_intakeId_fkey"
  FOREIGN KEY ("intakeId") REFERENCES "Intake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ConsentRecord.user
ALTER TABLE "ConsentRecord" DROP CONSTRAINT IF EXISTS "ConsentRecord_userId_fkey";
ALTER TABLE "ConsentRecord"
  ADD CONSTRAINT "ConsentRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================================
-- 2. Add missing FK relations (per findings 23, 24, 25)
-- =====================================================================

-- Prescription.patientId -> User (onDelete: Restrict)
ALTER TABLE "Prescription" DROP CONSTRAINT IF EXISTS "Prescription_patientId_fkey";
ALTER TABLE "Prescription"
  ADD CONSTRAINT "Prescription_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RefillRequest.patientId -> User (onDelete: Restrict)
ALTER TABLE "RefillRequest" DROP CONSTRAINT IF EXISTS "RefillRequest_patientId_fkey";
ALTER TABLE "RefillRequest"
  ADD CONSTRAINT "RefillRequest_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RefillRequest.prescription: change Cascade -> Restrict (finding 35)
ALTER TABLE "RefillRequest" DROP CONSTRAINT IF EXISTS "RefillRequest_prescriptionId_fkey";
ALTER TABLE "RefillRequest"
  ADD CONSTRAINT "RefillRequest_prescriptionId_fkey"
  FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PhysicianNote.patientId -> User (onDelete: Restrict)
ALTER TABLE "PhysicianNote" DROP CONSTRAINT IF EXISTS "PhysicianNote_patientId_fkey";
ALTER TABLE "PhysicianNote"
  ADD CONSTRAINT "PhysicianNote_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PhysicianNote.physician: change Cascade -> Restrict (finding 34)
ALTER TABLE "PhysicianNote" DROP CONSTRAINT IF EXISTS "PhysicianNote_physicianId_fkey";
ALTER TABLE "PhysicianNote"
  ADD CONSTRAINT "PhysicianNote_physicianId_fkey"
  FOREIGN KEY ("physicianId") REFERENCES "Physician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
