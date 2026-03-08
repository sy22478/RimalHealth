-- CreateEnum
CREATE TYPE "PhysicianStatus" AS ENUM ('PENDING', 'INVITED', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AuthorizationAction" AS ENUM ('INVITED', 'AUTHORIZED', 'REJECTED', 'SUSPENDED', 'REACTIVATED', 'SECRET_KEY_RESET');

-- CreateEnum
CREATE TYPE "AdminAction" AS ENUM ('PHYSICIAN_INVITE', 'PHYSICIAN_AUTHORIZE', 'PHYSICIAN_REJECT', 'PHYSICIAN_SUSPEND', 'PHYSICIAN_REACTIVATE', 'SECRET_KEY_GENERATE', 'PATIENT_ACCESS', 'SETTINGS_UPDATE', 'EXPORT_DATA');

-- AlterTable
ALTER TABLE "Physician" ADD COLUMN     "authorizedAt" TIMESTAMP(3),
ADD COLUMN     "authorizedBy" TEXT,
ADD COLUMN     "secretKeyExpiry" TIMESTAMP(3),
ADD COLUMN     "secretKeyHash" TEXT,
ADD COLUMN     "secretKeyUsedAt" TIMESTAMP(3),
ADD COLUMN     "status" "PhysicianStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "PhysicianAuthorizationLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "physicianId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" "AuthorizationAction" NOT NULL,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "PhysicianAuthorizationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysicianMessage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "parentId" TEXT,
    "threadId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "patientId" TEXT,
    "sentFromIP" TEXT,

    CONSTRAINT "PhysicianMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysicianMessageThread" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "participant1Id" TEXT NOT NULL,
    "participant2Id" TEXT NOT NULL,
    "lastMessageId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "participant1Unread" INTEGER NOT NULL DEFAULT 0,
    "participant2Unread" INTEGER NOT NULL DEFAULT 0,
    "patientId" TEXT,

    CONSTRAINT "PhysicianMessageThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminActivityLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminId" TEXT NOT NULL,
    "action" "AdminAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionId" TEXT,

    CONSTRAINT "AdminActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhysicianAuthorizationLog_physicianId_idx" ON "PhysicianAuthorizationLog"("physicianId");

-- CreateIndex
CREATE INDEX "PhysicianAuthorizationLog_adminId_idx" ON "PhysicianAuthorizationLog"("adminId");

-- CreateIndex
CREATE INDEX "PhysicianAuthorizationLog_createdAt_idx" ON "PhysicianAuthorizationLog"("createdAt");

-- CreateIndex
CREATE INDEX "PhysicianMessage_senderId_idx" ON "PhysicianMessage"("senderId");

-- CreateIndex
CREATE INDEX "PhysicianMessage_recipientId_idx" ON "PhysicianMessage"("recipientId");

-- CreateIndex
CREATE INDEX "PhysicianMessage_threadId_idx" ON "PhysicianMessage"("threadId");

-- CreateIndex
CREATE INDEX "PhysicianMessage_patientId_idx" ON "PhysicianMessage"("patientId");

-- CreateIndex
CREATE INDEX "PhysicianMessage_isRead_idx" ON "PhysicianMessage"("isRead");

-- CreateIndex
CREATE INDEX "PhysicianMessage_createdAt_idx" ON "PhysicianMessage"("createdAt");

-- CreateIndex
CREATE INDEX "PhysicianMessageThread_participant1Id_idx" ON "PhysicianMessageThread"("participant1Id");

-- CreateIndex
CREATE INDEX "PhysicianMessageThread_participant2Id_idx" ON "PhysicianMessageThread"("participant2Id");

-- CreateIndex
CREATE INDEX "PhysicianMessageThread_updatedAt_idx" ON "PhysicianMessageThread"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PhysicianMessageThread_participant1Id_participant2Id_key" ON "PhysicianMessageThread"("participant1Id", "participant2Id");

-- CreateIndex
CREATE INDEX "AdminActivityLog_adminId_idx" ON "AdminActivityLog"("adminId");

-- CreateIndex
CREATE INDEX "AdminActivityLog_action_idx" ON "AdminActivityLog"("action");

-- CreateIndex
CREATE INDEX "AdminActivityLog_entityType_idx" ON "AdminActivityLog"("entityType");

-- CreateIndex
CREATE INDEX "AdminActivityLog_createdAt_idx" ON "AdminActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "Physician_status_idx" ON "Physician"("status");

-- CreateIndex
CREATE INDEX "Physician_authorizedAt_idx" ON "Physician"("authorizedAt");

-- AddForeignKey
ALTER TABLE "PhysicianMessage" ADD CONSTRAINT "PhysicianMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Physician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicianMessage" ADD CONSTRAINT "PhysicianMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Physician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicianMessage" ADD CONSTRAINT "PhysicianMessage_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PhysicianMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
