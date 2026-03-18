-- CreateIndex
CREATE INDEX "Intake_status_submittedAt_idx" ON "Intake"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "Message_threadId_recipientId_idx" ON "Message"("threadId", "recipientId");

-- CreateIndex
CREATE INDEX "Message_recipientId_readAt_idx" ON "Message"("recipientId", "readAt");

-- CreateIndex
CREATE INDEX "Prescription_patientId_status_idx" ON "Prescription"("patientId", "status");

-- CreateIndex
CREATE INDEX "RefillRequest_prescriptionId_status_idx" ON "RefillRequest"("prescriptionId", "status");

-- CreateIndex
CREATE INDEX "Subscription_userId_status_idx" ON "Subscription"("userId", "status");
