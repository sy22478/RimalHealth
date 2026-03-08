-- AlterTable
ALTER TABLE "PatientProfile" ADD COLUMN     "notificationPreferences" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PhysicianNote" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "physicianId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysicianNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhysicianNote_patientId_idx" ON "PhysicianNote"("patientId");

-- CreateIndex
CREATE INDEX "PhysicianNote_physicianId_idx" ON "PhysicianNote"("physicianId");

-- CreateIndex
CREATE INDEX "PhysicianNote_createdAt_idx" ON "PhysicianNote"("createdAt");

-- AddForeignKey
ALTER TABLE "PhysicianNote" ADD CONSTRAINT "PhysicianNote_physicianId_fkey" FOREIGN KEY ("physicianId") REFERENCES "Physician"("id") ON DELETE CASCADE ON UPDATE CASCADE;
