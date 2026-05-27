-- Multi-product foundation (Phase 1): introduces a Product catalog as the spine
-- for supporting multiple treatments (AUD first, GLP-1 weight management second).
-- Behavior-neutral for existing AUD patients: all new columns are nullable and
-- backfilled in the companion data migration (20260526010001_seed_products_backfill).

-- AlterEnum: add the weight-management concern type. Safe in this migration's
-- transaction because nothing here INSERTs a row using the new value (the data
-- migration that references it runs in a separate, later transaction).
ALTER TYPE "ConcernType" ADD VALUE IF NOT EXISTS 'WEIGHT_MANAGEMENT';

-- CreateTable
CREATE TABLE IF NOT EXISTS "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "concernType" "ConcernType" NOT NULL,
    "stripePriceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Intake" ADD COLUMN IF NOT EXISTS "productId" TEXT;

-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN IF NOT EXISTS "productId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_slug_idx" ON "Product"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_isActive_idx" ON "Product"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Intake_patientId_productId_idx" ON "Intake"("patientId", "productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Prescription_productId_idx" ON "Prescription"("productId");

-- AddForeignKey
ALTER TABLE "Intake" ADD CONSTRAINT "Intake_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
