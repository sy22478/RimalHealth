-- AddPharmacyModel Migration
-- Adds the Pharmacy directory model and updates Prescription to link to it

-- CreateTable: Pharmacy
CREATE TABLE "Pharmacy" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ncpdpId" TEXT NOT NULL,
    "npiNumber" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'CA',
    "zipCode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "hours" JSONB,
    "is24Hour" BOOLEAN NOT NULL DEFAULT false,
    "hasDelivery" BOOLEAN NOT NULL DEFAULT false,
    "hasDriveThru" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Pharmacy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Pharmacy
CREATE UNIQUE INDEX "Pharmacy_ncpdpId_key" ON "Pharmacy"("ncpdpId");
CREATE INDEX "Pharmacy_ncpdpId_idx" ON "Pharmacy"("ncpdpId");
CREATE INDEX "Pharmacy_isActive_idx" ON "Pharmacy"("isActive");
CREATE INDEX "Pharmacy_city_idx" ON "Pharmacy"("city");
CREATE INDEX "Pharmacy_zipCode_idx" ON "Pharmacy"("zipCode");

-- AlterTable: Prescription - Add pharmacyId column
ALTER TABLE "Prescription" ADD COLUMN "pharmacyId" TEXT;

-- CreateIndex: Prescription pharmacyId
CREATE INDEX "Prescription_pharmacyId_idx" ON "Prescription"("pharmacyId");

-- AddForeignKey: Prescription to Pharmacy
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_pharmacyId_fkey" 
    FOREIGN KEY ("pharmacyId") REFERENCES "Pharmacy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
