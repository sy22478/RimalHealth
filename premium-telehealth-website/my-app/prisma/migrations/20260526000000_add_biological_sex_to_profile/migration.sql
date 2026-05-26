-- Add biologicalSex to PatientProfile so intake form data (formData.biologicalSex)
-- can be persisted to the profile and surfaced to physicians.
-- Values stored: "MALE" | "FEMALE" | "OTHER"; nullable for legacy rows.

ALTER TABLE "PatientProfile" ADD COLUMN IF NOT EXISTS "biologicalSex" TEXT;
