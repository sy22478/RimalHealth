-- GLP-1 Phase 4 Part B: notification types for the monitoring flow. Additive
-- enum values only — behavior-neutral for existing notifications. Apply with
-- `prisma migrate deploy` at deploy time (stacks on the Part A migration).

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CHECK_IN_DUE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CHECK_IN_REVIEWED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TITRATION_STEP_READY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REFILL_READY';
