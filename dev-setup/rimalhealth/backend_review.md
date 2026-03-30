# Backend Review Report

> **Initiative:** Comprehensive Code Review & Improvement Sweep
> **Team:** Backend Team
> **Date:** 2026-03-29
> **Total Findings:** 30 (5 P0, 10 P1, 10 P2, 5 P3)

---

## P0 — Critical

### BE-001: Thread ID Validation Bypass in Messages
- **File:** `app/api/patient/messages/route.ts:71-73`
- **Issue:** `threadId.includes(\`-${userId}-\`)` pattern is insufficient — UUIDs contain hyphens, enabling cross-patient thread access
- **Fix:** Strict regex validation of thread ID format
- **Status:** FIXING

### BE-002: N+1 Query in Physician Patient Details
- **File:** `app/api/physician/patients/[id]/route.ts:66-120`
- **Issue:** 7 parallel Prisma queries with nested includes — 50 prescriptions = 51+ queries
- **Fix:** Add pagination limits and use `select()` to limit nested depth
- **Status:** LOGGED (requires careful refactor)

### BE-003: Open Redirect in Stripe Checkout
- **File:** `app/api/stripe/checkout-session/route.ts:196-209`
- **Issue:** URL validation skipped entirely when `NEXT_PUBLIC_APP_URL` is not set
- **Fix:** Return 500 if URL validation env var is missing, never skip validation
- **Status:** FIXING

### BE-004: Resource Exhaustion in Admin Search
- **File:** `app/api/admin/physicians/route.ts:88-100`
- **Issue:** No limit on search string length — 10MB search string could DoS database
- **Fix:** Add max length validation (50 chars) before Prisma query
- **Status:** FIXING

### BE-005: Middleware Token Refresh Race Condition
- **File:** `middleware.ts:306-356`
- **Issue:** Token version check happens AFTER refresh, not before — could bypass session invalidation
- **Fix:** Validate tokenVersion BEFORE attempting refresh
- **Status:** LOGGED (requires careful middleware refactor)

---

## P1 — High

### BE-006 through BE-015
Key items: session timeout inconsistency, missing admin rate limiting, weak token rotation, pharmacy existence check, inconsistent password validation, missing Session index, missing document size validation, incomplete Zod refinements, missing audit logging on prescriptions, CSRF gaps.

See full Backend Team report for details. Items logged in tech_debt_register.md where not immediately fixable.

---

## P2/P3 — Medium/Low

15 items covering: error leakage in webhook, idempotency gaps, contact form email injection risk, missing pagination, API versioning, compression, error context in catch blocks. All logged in tech_debt_register.md.

---

## Changes Implemented This Sweep

| # | File | Change | Status |
|---|------|--------|--------|
| 1 | patient/messages/route.ts | Thread ID validation hardened | Pending |
| 2 | stripe/checkout-session/route.ts | URL validation made mandatory | Pending |
| 3 | admin/physicians/route.ts | Search string length limit added | Pending |
| 4 | webhooks/stripe/route.ts | Optional chaining + null guards | Pending |
