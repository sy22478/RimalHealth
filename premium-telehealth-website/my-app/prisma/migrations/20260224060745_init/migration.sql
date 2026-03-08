-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PATIENT', 'PHYSICIAN', 'ADMIN');

-- CreateEnum
CREATE TYPE "ConcernType" AS ENUM ('ALCOHOL', 'SMOKING', 'BOTH');

-- CreateEnum
CREATE TYPE "TreatmentGoal" AS ENUM ('QUIT', 'REDUCE', 'EXPLORE');

-- CreateEnum
CREATE TYPE "IntakeStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_INFO', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVE', 'REJECT', 'NEEDS_INFO');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('PENDING', 'SENT', 'RECEIVED_BY_PHARMACY', 'FILLED', 'READY_FOR_PICKUP', 'PICKED_UP', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RefillStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'SENT');

-- CreateEnum
CREATE TYPE "SenderType" AS ENUM ('PATIENT', 'PHYSICIAN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('ID_VERIFICATION', 'INSURANCE_CARD', 'MEDICAL_RECORD', 'CONSENT_FORM', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('ACTIVE_TREATMENT', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'PAST_DUE', 'UNPAID', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INTAKE_SUBMITTED', 'INTAKE_APPROVED', 'INTAKE_REJECTED', 'PRESCRIPTION_SENT', 'PRESCRIPTION_READY', 'REFILL_APPROVED', 'MESSAGE_RECEIVED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'SUBSCRIPTION_CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PATIENT',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressStreet" TEXT NOT NULL,
    "addressCity" TEXT NOT NULL,
    "addressState" TEXT NOT NULL,
    "addressZip" TEXT NOT NULL,
    "billingSameAsHome" BOOLEAN NOT NULL DEFAULT true,
    "billingStreet" TEXT,
    "billingCity" TEXT,
    "billingState" TEXT,
    "billingZip" TEXT,
    "medicalHistory" JSONB,
    "currentMedications" JSONB,
    "allergies" JSONB,
    "primaryConcern" "ConcernType",
    "treatmentGoal" "TreatmentGoal",
    "insuranceProvider" TEXT,
    "insuranceMemberId" TEXT,
    "insuranceGroupNumber" TEXT,
    "privacyConsentGiven" BOOLEAN NOT NULL DEFAULT false,
    "privacyConsentDate" TIMESTAMP(3),
    "privacyConsentVersion" TEXT,
    "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
    "termsAcceptedDate" TIMESTAMP(3),

    CONSTRAINT "PatientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Physician" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "npiNumber" TEXT NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "licenseState" TEXT NOT NULL DEFAULT 'CA',
    "deaNumber" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "specialty" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxDailyReviews" INTEGER NOT NULL DEFAULT 20,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "avgReviewTimeMin" INTEGER,

    CONSTRAINT "Physician_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intake" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "status" "IntakeStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "formData" JSONB NOT NULL,
    "riskScore" INTEGER,
    "complexityScore" INTEGER,
    "isPregnant" BOOLEAN,
    "hasSeizureHistory" BOOLEAN,
    "hasPsychiatricHistory" BOOLEAN,
    "takingMedications" BOOLEAN,
    "medicationList" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentIntentId" TEXT,
    "subscriptionId" TEXT,

    CONSTRAINT "Intake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "physicianId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "decision" "ReviewDecision",
    "clinicalNotes" TEXT,
    "contraindications" JSONB,
    "prescribedMedication" TEXT,
    "genericName" TEXT,
    "dosage" TEXT,
    "quantity" INTEGER,
    "refills" INTEGER,
    "instructions" TEXT,
    "rejectionReason" TEXT,
    "alternativeRecommendation" TEXT,
    "reviewedFromIP" TEXT,
    "reviewDurationSec" INTEGER,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "medicationName" TEXT NOT NULL,
    "genericName" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "refills" INTEGER NOT NULL,
    "refillsRemaining" INTEGER NOT NULL,
    "instructions" TEXT NOT NULL,
    "pharmacyName" TEXT NOT NULL,
    "pharmacyNcpdpId" TEXT NOT NULL,
    "pharmacyPhone" TEXT,
    "pharmacyAddress" TEXT,
    "surescriptsRxId" TEXT,
    "sentAt" TIMESTAMP(3),
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'PENDING',
    "lastRefillDate" TIMESTAMP(3),
    "nextRefillAvailable" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefillRequest" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "status" "RefillStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "RefillRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "parentId" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "senderType" "SenderType" NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "userId" TEXT,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "s3Bucket" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planType" "PlanType" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "interval" TEXT NOT NULL DEFAULT 'month',
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "InvoiceStatus" NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "stripeChargeId" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "userId" TEXT,
    "userRole" TEXT,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "targetUserId" TEXT,
    "metadata" JSONB,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "actionUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshToken_key" ON "Session"("refreshToken");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_token_key" ON "PasswordReset"("token");

-- CreateIndex
CREATE INDEX "PasswordReset_token_idx" ON "PasswordReset"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_userId_key" ON "PatientProfile"("userId");

-- CreateIndex
CREATE INDEX "PatientProfile_userId_idx" ON "PatientProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Physician_userId_key" ON "Physician"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Physician_npiNumber_key" ON "Physician"("npiNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Physician_licenseNumber_key" ON "Physician"("licenseNumber");

-- CreateIndex
CREATE INDEX "Physician_userId_idx" ON "Physician"("userId");

-- CreateIndex
CREATE INDEX "Physician_npiNumber_idx" ON "Physician"("npiNumber");

-- CreateIndex
CREATE INDEX "Intake_patientId_idx" ON "Intake"("patientId");

-- CreateIndex
CREATE INDEX "Intake_status_idx" ON "Intake"("status");

-- CreateIndex
CREATE INDEX "Intake_createdAt_idx" ON "Intake"("createdAt");

-- CreateIndex
CREATE INDEX "Intake_submittedAt_idx" ON "Intake"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_intakeId_key" ON "Review"("intakeId");

-- CreateIndex
CREATE INDEX "Review_intakeId_idx" ON "Review"("intakeId");

-- CreateIndex
CREATE INDEX "Review_physicianId_idx" ON "Review"("physicianId");

-- CreateIndex
CREATE INDEX "Review_assignedAt_idx" ON "Review"("assignedAt");

-- CreateIndex
CREATE INDEX "Review_completedAt_idx" ON "Review"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_intakeId_key" ON "Prescription"("intakeId");

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_surescriptsRxId_key" ON "Prescription"("surescriptsRxId");

-- CreateIndex
CREATE INDEX "Prescription_patientId_idx" ON "Prescription"("patientId");

-- CreateIndex
CREATE INDEX "Prescription_status_idx" ON "Prescription"("status");

-- CreateIndex
CREATE INDEX "Prescription_nextRefillAvailable_idx" ON "Prescription"("nextRefillAvailable");

-- CreateIndex
CREATE INDEX "RefillRequest_prescriptionId_idx" ON "RefillRequest"("prescriptionId");

-- CreateIndex
CREATE INDEX "RefillRequest_status_idx" ON "RefillRequest"("status");

-- CreateIndex
CREATE INDEX "Message_threadId_idx" ON "Message"("threadId");

-- CreateIndex
CREATE INDEX "Message_recipientId_idx" ON "Message"("recipientId");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_sentAt_idx" ON "Message"("sentAt");

-- CreateIndex
CREATE INDEX "Message_status_idx" ON "Message"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Document_s3Key_key" ON "Document"("s3Key");

-- CreateIndex
CREATE INDEX "Document_patientId_idx" ON "Document"("patientId");

-- CreateIndex
CREATE INDEX "Document_documentType_idx" ON "Document"("documentType");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeCustomerId_key" ON "Subscription"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_stripeInvoiceId_key" ON "Invoice"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "Invoice_subscriptionId_idx" ON "Invoice"("subscriptionId");

-- CreateIndex
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "AuditLog_eventType_idx" ON "AuditLog"("eventType");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_idx" ON "AuditLog"("resourceType");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_success_idx" ON "AuditLog"("success");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Physician" ADD CONSTRAINT "Physician_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intake" ADD CONSTRAINT "Intake_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "Intake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_physicianId_fkey" FOREIGN KEY ("physicianId") REFERENCES "Physician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "Intake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefillRequest" ADD CONSTRAINT "RefillRequest_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "message_physician_fk" FOREIGN KEY ("senderId") REFERENCES "Physician"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
