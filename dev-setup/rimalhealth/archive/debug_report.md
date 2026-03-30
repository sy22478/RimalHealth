# Debug Report

> **Initiative:** Comprehensive Code Review & Improvement Sweep
> **Team:** Debugging Team
> **Date:** 2026-03-29
> **Status:** Findings reported, fixes in progress

---

## P0 — Critical (Production Blockers)

### BUG-001: Unsafe Array Access in Stripe Subscription Webhook
- **File:** `app/api/webhooks/stripe/route.ts:697`
- **Issue:** `subscription.items.data[0].price.id` lacks full optional chaining — crashes if `price` is null
- **Root Cause:** Incomplete optional chaining chain
- **Fix:** Add `?.` at each property access level
- **Status:** FIXING

### BUG-002: Silent Notification Failure in Patient Messages
- **File:** `app/api/patient/messages/route.ts:234-235`
- **Issue:** `.catch(() => {})` swallows all errors — physician never gets notified, no error trace
- **Root Cause:** Empty error handler treats critical notification as non-critical
- **Fix:** Add error logging in catch blocks
- **Status:** FIXING

### BUG-003: Missing Null Check on Subscription ID in Webhook
- **File:** `app/api/webhooks/stripe/route.ts:325-346`
- **Issue:** `subscriptionId || ''` fallback masks null subscription IDs, creates orphaned invoices
- **Root Cause:** Empty string fallback instead of explicit failure
- **Fix:** Throw error if subscriptionId is missing instead of falling back to empty string
- **Status:** FIXING

---

## P1 — High (Breaks Critical Flows)

### BUG-004: Premature Notification on Intake Draft Creation
- **File:** `app/api/patient/intake/route.ts:124-129`
- **Issue:** Physicians notified of "new intake waiting for review" when intake is still a DRAFT
- **Root Cause:** Notification logic not aligned with intake lifecycle
- **Fix:** Remove notification from draft creation; only notify on actual submission
- **Status:** FIXING

### BUG-005: Race Condition — Multiple Intakes for Same Patient
- **File:** `app/api/patient/intake/route.ts:55-97`
- **Issue:** Check-then-act pattern outside transaction allows concurrent duplicate intakes
- **Root Cause:** Uniqueness check happens outside the Prisma transaction
- **Fix:** Move entire check+create flow inside transaction with serializable isolation
- **Status:** FIXING

---

## P2 — Medium (Data Inconsistency/Edge Cases)

### BUG-006: Incomplete Optional Chaining on Stripe Items
- **File:** `app/api/webhooks/stripe/route.ts:303`
- **Issue:** `stripeSubscription?.items.data[0]?.price.id` — if `items` is undefined, `.data` throws
- **Root Cause:** Optional chaining only covers first property
- **Fix:** Full chain: `stripeSubscription?.items?.data?.[0]?.price?.id`
- **Status:** FIXING

### BUG-007: NaN in Physician Stats Approval Rate
- **File:** `app/api/physician/stats/route.ts:185-187`
- **Issue:** If `_count` is undefined, `approvalRate` becomes NaN, breaking dashboard graphs
- **Root Cause:** Insufficient type safety on aggregation result
- **Fix:** Use `?._count?.id ?? 0` and add `Number.isFinite()` guard
- **Status:** FIXING

### BUG-008: Null Profile Crash in Physician Messages
- **File:** `app/api/physician/messages/route.ts:206-210`
- **Issue:** Map lookup returns undefined for patient without profile, causing TypeError on `.firstName`
- **Root Cause:** Missing null check after map lookup
- **Fix:** Add fallback: `profile?.firstName || 'Patient'`
- **Status:** FIXING

---

## P3 — Low (Minor Issues)

### BUG-009: Empty String Fallback on Subscription ID
- **File:** `app/api/webhooks/stripe/route.ts:301-302`
- **Issue:** `subscriptionId || ''` could match wrong subscription if data is corrupted
- **Status:** FIXING (addressed with BUG-003)

### BUG-010: Silent Error in Consent Linking
- **File:** `app/api/webhooks/stripe/route.ts:477-480`
- **Issue:** Catch block doesn't log actual error, losing debugging information
- **Fix:** Add `error instanceof Error ? error.message : 'Unknown error'` to log
- **Status:** FIXING

---

## Verification Status

| Bug | Fixed | Verified |
|-----|-------|----------|
| BUG-001 | ✅ Yes | ✅ type-check pass |
| BUG-002 | ✅ Yes | ✅ type-check pass |
| BUG-003 | ✅ Yes | ✅ type-check pass |
| BUG-004 | ✅ Yes | ✅ type-check pass |
| BUG-005 | ✅ Yes | ✅ type-check pass |
| BUG-006 | ✅ Yes | ✅ type-check pass |
| BUG-007 | ✅ Yes | ✅ type-check pass |
| BUG-008 | N/A — already handled | ✅ code has fallback |
| BUG-009 | ✅ Yes (via BUG-003) | ✅ type-check pass |
| BUG-010 | ✅ Yes | ✅ type-check pass |
