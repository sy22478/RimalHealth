-- GLP-1 Phase 5: add the WEIGHT_MANAGEMENT plan type so a weight-management
-- subscription can be distinguished from AUD (ACTIVE_TREATMENT). Additive enum
-- value only — behavior-neutral for existing AUD subscriptions. Apply with
-- `prisma migrate deploy` at deploy time (stacks on the prior unapplied migrations).

ALTER TYPE "PlanType" ADD VALUE IF NOT EXISTS 'WEIGHT_MANAGEMENT';
