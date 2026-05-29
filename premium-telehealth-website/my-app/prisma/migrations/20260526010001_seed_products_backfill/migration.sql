-- Seed the two Product rows and backfill existing records (Phase 1).
-- Runs in a separate transaction from 20260526010000, so the WEIGHT_MANAGEMENT
-- enum value added there is already committed and safe to reference here
-- (avoids Postgres "unsafe use of new value of enum" error).
--
-- Idempotent: ON CONFLICT on the unique slug, and backfill only touches NULLs.

-- Insert the two products. AUD is the existing treatment; weight-management is new.
INSERT INTO "Product" ("id", "slug", "name", "concernType", "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'alcohol-aud', 'Alcohol Use Disorder', 'ALCOHOL', true, now(), now()),
  (gen_random_uuid(), 'weight-management', 'Weight Management', 'WEIGHT_MANAGEMENT', true, now(), now())
ON CONFLICT ("slug") DO NOTHING;

-- Backfill every existing intake to the AUD product (the only treatment to date).
UPDATE "Intake"
SET "productId" = (SELECT "id" FROM "Product" WHERE "slug" = 'alcohol-aud')
WHERE "productId" IS NULL;

-- Backfill every existing prescription to the AUD product.
UPDATE "Prescription"
SET "productId" = (SELECT "id" FROM "Product" WHERE "slug" = 'alcohol-aud')
WHERE "productId" IS NULL;
