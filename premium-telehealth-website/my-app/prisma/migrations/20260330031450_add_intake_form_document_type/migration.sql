-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'INTAKE_FORM';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "intakeId" TEXT,
ALTER COLUMN "s3Key" DROP NOT NULL,
ALTER COLUMN "s3Bucket" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Document_intakeId_idx" ON "Document"("intakeId");
