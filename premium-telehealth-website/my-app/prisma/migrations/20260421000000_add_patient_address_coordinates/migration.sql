-- Add geocoded coordinates for patient's home address.
-- Populated from Amazon Location Service when address is validated/saved.
-- Used for proximity-based pharmacy search sorting.

ALTER TABLE "PatientProfile" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "PatientProfile" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
