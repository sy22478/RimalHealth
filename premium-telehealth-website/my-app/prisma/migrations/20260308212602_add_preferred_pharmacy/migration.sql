-- AlterTable
ALTER TABLE "PatientProfile" ADD COLUMN     "preferredPharmacyId" TEXT;

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_preferredPharmacyId_fkey" FOREIGN KEY ("preferredPharmacyId") REFERENCES "Pharmacy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
