-- GLP-1 intake triage metadata (Phase 2). Non-PHI columns that let the
-- physician queue filter/sort on weight-management triage. Actual answers stay
-- in the encrypted Intake.formData JSON column. All nullable / additive →
-- behavior-neutral for existing AUD intakes.

ALTER TABLE "Intake" ADD COLUMN IF NOT EXISTS "bmi" DOUBLE PRECISION;
ALTER TABLE "Intake" ADD COLUMN IF NOT EXISTS "glp1Eligibility" TEXT;
ALTER TABLE "Intake" ADD COLUMN IF NOT EXISTS "requiresUrgentReview" BOOLEAN;
