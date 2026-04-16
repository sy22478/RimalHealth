-- Create AccountDeletionRequest table — schema drift fix (finding 41).

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AccountDeletionStatus" AS ENUM ('PENDING', 'GRACE_PERIOD', 'PROCESSING', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AccountDeletionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "AccountDeletionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccountDeletionRequest_userId_idx" ON "AccountDeletionRequest"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccountDeletionRequest_status_idx" ON "AccountDeletionRequest"("status");

-- AddForeignKey
ALTER TABLE "AccountDeletionRequest"
  ADD CONSTRAINT "AccountDeletionRequest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
