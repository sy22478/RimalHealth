# Team G: DEEP Debugging Report -- RimalHealth (Post-Sprint)

## Date: 2026-03-25
## Scope: Full codebase audit after Phase 5 Major Sprint (Waves 1-4)

---

## Executive Summary

A deep investigation of the codebase following the Phase 5 sprint reveals that **all P0 bugs from the previous report have been successfully fixed**. The sprint addressed the unauthenticated GET endpoint (now requires auth + ownership check), removed PHI from intake emails, wrapped the webhook in a transaction, added encryption for PhysicianMessage and Prescription fields, validated PHI_ENCRYPTION_KEY at startup, and deleted 1,305 lines of dead code.

However, this deep audit uncovered **9 new bugs** (0 P0, 2 P1, 4 P2, 3 P3), **6 risks**, and confirmed several issues remain from the prior review. The most critical new findings are:

1. **P1: Double encryption in profile PUT route** -- manual `encryptPHI()` calls + Prisma extension = data encrypted twice, becoming unreadable on next read
2. **P1: `billingState` and `User.mfaSecret`/`mfaBackupCodes` marked as encrypted in schema but missing from encryption extension** -- stored as plaintext
3. **P2: All notification `actionUrl` values point to `/dashboard/billing`** which does not exist (correct path is `/patient/billing`)
4. **P2: `submitIntakeSchema` accepts arbitrary `z.record(z.string(), z.unknown())`** -- no server-side validation of intake form data structure
5. **P2: Login endpoint exposes user email in 403 response body** when email is unverified
6. **P2: No `loading.tsx` files anywhere** -- all page transitions show blank screens during data fetches

---

## Previous Report Status (Phase 4 Review Findings)

| Bug ID | Description | Status |
|--------|-------------|--------|
| BUG-001 (P0) | GET /api/stripe/checkout-session unauthenticated | **FIXED** -- Auth + ownership check added, tokens removed from response |
| BUG-002 (P0) | /api/intake sends PHI via plaintext email | **FIXED** -- Route rewritten with auth, no PHI in emails |
| BUG-003 (P1) | PhysicianMessage PHI not encrypted | **FIXED** -- Added to `PHI_FIELDS` in encryption extension |
| BUG-004 (P1) | Webhook has no DB transaction | **FIXED** -- Wrapped in `prisma.$transaction()` |
| BUG-005 (P1) | PHI_ENCRYPTION_KEY not validated at startup | **FIXED** -- Added to `REQUIRED_VARS` in env-validation.ts |
| BUG-006 (P2) | Dual Stripe client with placeholder key | **NOT FIXED** -- `lib/integrations/stripe.ts` still exports `stripe` with placeholder. Public checkout session imports it directly on line 69 |
| BUG-007 (P2) | lib/hipaa/audit-logger.ts dead code | **FIXED** -- Deleted per P1-012 |
| BUG-008 (P2) | lib/hipaa/encryption.ts dead code | **FIXED** -- Deleted per P1-012 |
| BUG-009 (P3) | npm test only runs integration tests | **NOT FIXED** -- vitest.config.ts still only includes integration tests |
| BUG-010 (P2) | DoseSpot always uses mock in production | **NOT FIXED** -- Still returns `{ mock: true }` |
| BUG-011 (P3) | Subscription cancellation email not sent | **NOT FIXED** -- Still has `// TODO: Implement email notification` |
| RISK-001 | GET fallback race condition with webhook | **MITIGATED** -- GET fallback removed; webhook is sole creator now |
| RISK-004 | Stripe checkout accepts arbitrary URLs | **NOT FIXED** -- Both checkout endpoints still accept any URL |
| RISK-006 | Encryption salt is hardcoded | **NOT FIXED** -- Still uses `'phi_encryption_salt_v1'` |
| RISK-008 | Encryption extension silently swallows decryption errors | **NOT FIXED** -- Still returns ciphertext as-is on failure |

---

## New Bugs Found

### BUG-012: Profile PUT Route Double-Encrypts PHI Fields
- **Severity:** P1
- **Category:** Data Integrity / HIPAA
- **Root Cause:** `app/api/patient/profile/route.ts` lines 148-176 manually call `encryptPHI()` on fields like `firstName`, `lastName`, `phone`, `addressStreet`, `addressCity`, `addressZip` before passing them to `prisma.patientProfile.update()`. However, the Prisma encryption extension (`lib/db/encryption-extension.ts`) also automatically encrypts these same fields on every `update` operation (line 329-344). This means every profile update **double-encrypts** these fields.
- **Impact:** After the first PUT update, the data is encrypted twice. The next GET (which decrypts only once via the extension, then once more manually in the GET handler) will return garbled data for the first layer, or the manual `decryptPHI()` call on line 67-73 of the GET handler will receive already-decrypted data from the extension and attempt to decrypt plaintext, which will either return it as-is (if not prefixed with `enc:v1:`) or fail silently. The exact behavior depends on operation order, but data corruption is certain after a profile update.
- **Fix Instructions:**
  1. In `app/api/patient/profile/route.ts` PUT handler, remove ALL manual `encryptPHI()` calls (lines 149, 153, 159, 164, 169, 175). Pass raw values to Prisma -- the encryption extension handles encryption automatically.
  2. In the GET handler, remove the manual `decryptPHI()` calls (lines 67-74). The encryption extension already decrypts on read. Just access `profile.firstName` etc. directly.
  3. The intake submit route (`app/api/patient/intake/[id]/submit/route.ts`) correctly documents this pattern with the comment "PHI fields are auto-encrypted by the Prisma encryption extension -- do NOT manually encrypt them here" (line 287).
- **Verification:** Update a profile, then read it back. All fields should be readable (not garbled). Query the database directly to confirm fields have exactly one `enc:v1:` prefix.
- **Implementing Team:** A

### BUG-013: `billingState` and `User.mfaSecret`/`mfaBackupCodes` Not in Encryption Extension
- **Severity:** P1
- **Category:** Data Integrity / HIPAA
- **Root Cause:** The Prisma schema (`prisma/schema.prisma`) marks three fields as encrypted that are NOT registered in the encryption extension:
  - `PatientProfile.billingState` (line 108: `// Encrypted`) -- not in `PHI_FIELDS.PatientProfile`
  - `User.mfaSecret` (line 29: `// Encrypted with PHI encryption`) -- no `User` model in `PHI_FIELDS` at all
  - `User.mfaBackupCodes` (line 30: `// Encrypted JSON array of backup codes`) -- no `User` model in `PHI_FIELDS`

  Note: `billingStreet`, `billingCity`, and `billingZip` ARE correctly included. Only `billingState` is missing. While a billing state (like "CA") is less sensitive than a street address, the schema explicitly marks it for encryption and it is not being encrypted.

  For MFA: `mfaSecret` is the TOTP secret key -- if stored plaintext, an attacker with database read access can generate valid MFA codes, completely defeating MFA. `mfaBackupCodes` are one-time recovery codes that would also be exposed.
- **Impact:**
  - `billingState`: Low-moderate. A US state abbreviation alone is not strongly identifying, but it violates the documented encryption contract.
  - `mfaSecret`/`mfaBackupCodes`: High. If MFA is enabled for any user, their TOTP secret is stored in plaintext. A database compromise would allow an attacker to generate valid MFA codes. However, MFA appears to not be actively used yet (no MFA setup UI found), so the risk is currently theoretical.
- **Fix Instructions:**
  1. Add `billingState` to `PHI_FIELDS.PatientProfile` array and to `NULLABLE_FIELDS.PatientProfile` set.
  2. Add a `User` entry to `PHI_FIELDS` for `mfaSecret` and `mfaBackupCodes`.
  3. Add to `NULLABLE_FIELDS.User` since both are optional.
  4. Add `mfaBackupCodes` to `JSON_FIELDS.User` since it stores a JSON array.
- **Verification:** Set `billingState` on a profile, query DB directly, confirm it starts with `enc:v1:`.
- **Implementing Team:** A

### BUG-014: Notification `actionUrl` Points to Non-Existent `/dashboard/billing`
- **Severity:** P2
- **Category:** Runtime / UX
- **Root Cause:** Multiple files set `actionUrl: '/dashboard/billing'` for payment-related notifications:
  - `app/api/webhooks/stripe/route.ts` line 473 (payment failed notification)
  - `app/api/webhooks/stripe/route.ts` line 629 (subscription cancelled notification)
  - `lib/stripe/stripe-webhooks.ts` lines 285, 457
  - `lib/services/subscription-service.ts` line 295
  - `app/api/stripe/subscription/route.ts` line 500

  The actual billing page lives at `/patient/billing` (confirmed via `app/patient/billing/page.tsx`). There is no route at `/dashboard/billing`.
- **Impact:** When a patient clicks on a "Payment Failed" or "Subscription Cancelled" notification, they get a 404 error or are redirected by middleware instead of reaching the billing page. This breaks the critical payment recovery flow.
- **Fix Instructions:** Replace all instances of `/dashboard/billing` with `/patient/billing` across the codebase.
- **Verification:** Trigger a payment failure notification and confirm the action link navigates to the billing page.
- **Implementing Team:** A

### BUG-015: Submit Intake Schema Accepts Arbitrary Data (No Server-Side Validation)
- **Severity:** P2
- **Category:** Data Integrity / Security
- **Root Cause:** `lib/validation/schemas.ts` line 143-146:
  ```typescript
  export const submitIntakeSchema = z.object({
    formData: z.record(z.string(), z.unknown()),
  });
  ```
  This schema only validates that `formData` is a record with string keys -- it does NOT validate the actual form data structure. The `intakeFormDataSchema` (line 81-138) defines a strict schema with specific fields, types, and validations, but it is NEVER used on the submit endpoint.

  The submit route (`app/api/patient/intake/[id]/submit/route.ts`) receives this unvalidated `formData`, casts it to `Record<string, unknown>` (line 143), and passes it directly to scoring functions and profile updates. The scoring functions are defensive (they check for `undefined` values), but malformed or missing data will produce incorrect scores.
- **Impact:**
  - A malicious actor could submit formData with any structure, potentially injecting unexpected values into the scoring engine.
  - Missing required fields (like DSM-5 answers) will produce a score of 0, making it appear the patient has no AUD.
  - Extra fields in formData are stored in the encrypted `formData` JSON blob and could contain arbitrarily large data.
- **Fix Instructions:**
  1. Create a `submitIntakeFormDataSchema` that validates the DSM-5 format fields required for scoring.
  2. Apply this schema in the submit route before passing data to scoring functions.
  3. Add a maximum size check on the formData object (e.g., `JSON.stringify(formData).length < 50000`).
- **Verification:** Submit an intake with missing DSM-5 fields and verify the server returns a validation error.
- **Implementing Team:** B

### BUG-016: Login 403 Response Exposes User Email
- **Severity:** P2
- **Category:** Security / HIPAA
- **Root Cause:** `app/api/auth/login/route.ts` line 396:
  ```typescript
  return NextResponse.json({
    error: 'Email not verified...',
    code: 'EMAIL_NOT_VERIFIED',
    email: user.email,  // <-- exposes email
  }, { status: 403 });
  ```
  When a patient tries to log in with correct credentials but hasn't verified their email, the response includes their full email address. This was likely added so the client can show "Check your email at [address]", but it also means anyone who can guess a valid email+password combination gets confirmation that the email exists in the system.
- **Impact:** Account enumeration -- an attacker can confirm which email addresses have accounts by trying common passwords. The email is PHI in a healthcare context (confirms a person is a patient at an AUD treatment service).
- **Fix Instructions:**
  1. Remove the `email` field from the 403 response.
  2. If the client needs to show the email for the "resend verification" flow, it should use the email the user already typed into the login form (the client already has it).
- **Verification:** Attempt to log in with a valid but unverified account. Confirm the response does NOT include the `email` field.
- **Implementing Team:** A

### BUG-017: No `loading.tsx` Files -- Blank Screens During Page Transitions
- **Severity:** P3
- **Category:** Runtime / UX
- **Root Cause:** Zero `loading.tsx` files exist in the entire app directory (confirmed by glob search). Next.js uses `loading.tsx` files to show loading UI during server component data fetching. Without them, the user sees a blank/frozen screen while navigating between pages.
- **Impact:** Poor UX on every page transition that involves server-side data fetching (dashboard, intake, billing, messages, etc.). The patient dashboard in particular fetches 6 database queries in parallel, which could take 1-3 seconds on a cold start. During this time, the user sees nothing.
- **Fix Instructions:** Create `loading.tsx` files in key route directories:
  - `app/patient/loading.tsx` -- for the entire patient portal
  - `app/intake/loading.tsx` -- for the intake form
  - `app/checkout/loading.tsx` -- for checkout pages
  These should show skeleton loading states or a spinner.
- **Verification:** Navigate to the patient dashboard and observe a loading skeleton instead of a blank screen.
- **Implementing Team:** B (UI)

### BUG-018: `ENCRYPTION_KEY` Still in `REQUIRED_VARS` (Ghost Requirement)
- **Severity:** P3
- **Category:** Configuration / DX
- **Root Cause:** `lib/env-validation.ts` line 15 still requires `ENCRYPTION_KEY` alongside `PHI_ENCRYPTION_KEY`. The `ENCRYPTION_KEY` was used by the now-deleted `lib/hipaa/encryption.ts` (removed in P1-012). It serves no purpose and confuses operators who must set two encryption keys but only one is used.
- **Impact:** Deployment will fail if `ENCRYPTION_KEY` is not set, even though nothing in the codebase reads it. Operators waste time configuring and rotating an unused key.
- **Fix Instructions:** Remove `'ENCRYPTION_KEY'` from the `REQUIRED_VARS` array in `lib/env-validation.ts` line 15. Update `.env.example` to remove or deprecate `ENCRYPTION_KEY`.
- **Verification:** Start the server without `ENCRYPTION_KEY` set (but with `PHI_ENCRYPTION_KEY`). Confirm no startup error.
- **Implementing Team:** A

### BUG-019: Email Retry Queue Has No Worker
- **Severity:** P3
- **Category:** Integration
- **Root Cause:** `lib/integrations/sendgrid.ts` implements a Redis-based retry queue (`queueForRetry()` on line 95, `processRetryQueue()` on line 371). Failed emails are queued to `notifications:email:retry` with exponential backoff. However, `processRetryQueue()` is only imported by `lib/notifications/index.ts` -- there is no cron job, background worker, or scheduled function that actually calls it. The retry queue grows indefinitely but is never processed.
- **Impact:** Any email that fails on the first attempt (SendGrid outage, rate limit, network error) is permanently lost. The retry mechanism exists in code but is never executed.
- **Fix Instructions:**
  1. Create a scheduled Netlify function or API endpoint that calls `processRetryQueue()` periodically (e.g., every 5 minutes).
  2. Alternatively, implement a simpler retry: retry the send 2-3 times inline with a delay before giving up, rather than relying on an external worker.
- **Verification:** Simulate a SendGrid failure, wait 5 minutes, confirm the retry queue is processed and the email is sent.
- **Implementing Team:** A

### BUG-020: Webhook Returns 200 on Processing Errors (Prevents Stripe Retry)
- **Severity:** P2 (upgraded from prior RISK assessment)
- **Category:** Data Integrity
- **Root Cause:** `app/api/webhooks/stripe/route.ts` line 135:
  ```typescript
  return NextResponse.json({ received: true, error: 'Processing error' });
  ```
  When the `handleCheckoutComplete` function throws (e.g., database connection failure during the transaction), the outer catch block returns HTTP 200 to Stripe. This tells Stripe the webhook was successfully processed, so Stripe will NOT retry. But the user, profile, and subscription were never created. The comment on line 133 says "Return 200 to prevent Stripe from retrying (we'll handle errors internally)" -- but there IS no internal error handling or recovery mechanism.
- **Impact:** If the database is temporarily unavailable during a webhook call, the customer pays but never gets an account. There is no retry, no alerting, and no recovery path. The customer must contact support. This is especially dangerous because the transaction is the only mechanism for account creation in the payment-first flow.
- **Fix Instructions:**
  1. Change the catch block to return 500 for errors that should be retried (database errors, network errors).
  2. Return 200 only for errors that should NOT be retried (e.g., duplicate subscription, invalid data).
  3. Add alerting (e.g., send an email to ops) when a webhook processing error occurs.
  4. The idempotency check at line 168-176 already prevents duplicate processing on retry.
- **Verification:** Simulate a database timeout during webhook processing. Confirm Stripe receives a 500 and retries the webhook.
- **Implementing Team:** A

---

## Risks Identified

### RISK-009: Consent Record Not Linked to Stripe Session or User
- **Severity:** Medium
- **Category:** Compliance / Data Integrity
- **File:** `app/api/checkout/consent/route.ts`, `app/checkout/consent/page.tsx`
- **Description:** The consent record is stored in AuditLog (line 74-98) with a random `consentRecordId` and the client IP/user agent. The `consentRecordId` is stored in `sessionStorage` on the client (line 269-274) but is never passed to the Stripe checkout session, the webhook, or the user record. There is no way to link a specific consent record to a specific payment or user after the fact.
- **Mitigation:** Pass `consentRecordId` as Stripe session metadata so the webhook can link it to the user. Store it in the PatientProfile or a dedicated ConsentRecord model.

### RISK-010: Public Checkout URL Validation Missing
- **Severity:** Medium
- **Category:** Security
- **File:** `app/api/stripe/public-checkout-session/route.ts` lines 18-19
- **Description:** Both `successUrl` and `cancelUrl` accept any valid URL. An attacker can craft a public checkout session with `successUrl: 'https://evil.com/phishing'` to redirect users to a phishing page after payment. Since this is a public endpoint (no auth), anyone can create these sessions.
- **Mitigation:** Validate that `successUrl` and `cancelUrl` start with `process.env.NEXT_PUBLIC_APP_URL` or are relative paths. The same issue exists in the authenticated `checkout-session` endpoint.

### RISK-011: Redis Unavailability Disables Rate Limiting Silently
- **Severity:** Medium
- **Category:** Security
- **File:** `lib/middleware/rate-limit.ts` line 262-274
- **Description:** Rate limiting fails open when Redis is unavailable (returns `success: true`). While this is appropriate for general availability, it means a Redis outage completely disables all rate limiting on authentication endpoints, allowing unlimited brute-force attempts on login, password reset, and account creation.
- **Mitigation:** For auth endpoints specifically, implement an in-memory fallback rate limiter (e.g., a simple Map with timestamps) that kicks in when Redis is unavailable. Alternatively, use the circuit breaker from `lib/redis/client.ts` to detect Redis outages and switch to a stricter in-memory limiter.

### RISK-012: Absolute Session Timeout Check Occurs After Authorization
- **Severity:** Low-Medium
- **Category:** Security
- **File:** `middleware.ts` lines 277-288
- **Description:** The absolute session timeout (8 hours) check occurs AFTER the user headers are set (line 258-263) and AFTER the `NextResponse.next()` is created (line 265-269). While the redirect response on line 283 will override the next response, there is a brief code path where user identity headers are set on a response that will be discarded. More importantly, if the session has expired, the user's request still reaches the route handler briefly before the redirect fires (since Next.js middleware runs at the edge and the route handler runs on the server).
- **Mitigation:** Move the absolute timeout check to immediately after `verifyAccessToken()` (before line 247), before setting any user headers. This ensures expired sessions are caught before any authorization logic runs.

### RISK-013: PatientProfile `addressState` Not Encrypted But Could Be Sensitive
- **Severity:** Low
- **Category:** HIPAA
- **File:** `prisma/schema.prisma` line 101, `lib/db/encryption-extension.ts`
- **Description:** `PatientProfile.addressState` is NOT marked as `// Encrypted` in the schema and is not in the encryption extension. For this California-only service, every patient's state is "CA", so it reveals no information. However, if the service expands to other states, this field would need encryption (combined with city/zip, a state can narrow down a patient's location significantly). `billingState` IS marked as encrypted but is similarly excluded from the extension (see BUG-013).
- **Mitigation:** No action needed now (California-only). If expanding to other states, add `addressState` and `billingState` to encryption.

### RISK-014: `console.error('Submit intake error:', error)` May Log PHI in Stack Traces
- **Severity:** Low
- **Category:** HIPAA
- **Files:** `app/api/patient/intake/[id]/submit/route.ts` line 321, `app/api/patient/profile/route.ts` line 93, `app/api/patient/messages/route.ts` line 114
- **Description:** Several error handlers log the raw `error` object to console. If the error is a Prisma error containing encrypted PHI data in the query context, or if the error includes request body data, PHI could appear in server logs. The Stripe webhook handler correctly logs only `errorMessage` (error.message), but these routes log the full error.
- **Mitigation:** Change all `console.error('...error:', error)` to `console.error('...error:', error instanceof Error ? error.message : 'Unknown error')` to avoid accidentally logging PHI from error stack traces.

---

## Integration Health Status (Updated)

| Integration | Status | Change from Last Review |
|---|---|---|
| **Stripe (Payments)** | Improved | Webhook now uses transactions, GET endpoint secured. Public checkout still accepts arbitrary URLs (RISK-010). Dual Stripe client still exists (BUG-006 unfixed). Webhook returns 200 on error (BUG-020). |
| **SendGrid (Email)** | Degraded | Retry queue exists but has no worker to process it (BUG-019). Cancellation email still TODO (BUG-011). |
| **DoseSpot (e-Prescribing)** | Not Functional | No change -- still always mock (BUG-010). |
| **Redis (Cache/Sessions)** | Functional | Circuit breaker implemented. Rate limiting fails open when Redis is down (RISK-011). |
| **PostgreSQL/Neon (Database)** | Functional | Schema validates clean. PHI encryption coverage improved (PhysicianMessage, Prescription fields added) but billingState, mfaSecret still missing (BUG-013). |
| **Prisma Encryption Extension** | Improved | 8 models now covered (was 6). Double-encryption bug in profile route (BUG-012). Still silently swallows decryption errors (RISK-008). |
| **HIPAA Audit Logging** | Improved | Dead code removed. Single audit system in use. All new routes (verify-token, verify-email, send-verification) properly log. |

---

## Dependency Vulnerabilities

`npm audit` reports **20 vulnerabilities** (1 low, 7 moderate, 12 high):

- **undici** (7.0.0-7.23.0): 6 high-severity issues including HTTP smuggling, WebSocket crashes, CRLF injection, DoS via memory consumption. Fix: `npm audit fix`
- **picomatch**: 2 high-severity ReDoS + method injection vulnerabilities across 5 transitive dependencies. Fix: `npm audit fix`

All are fixable via `npm audit fix` without breaking changes.

---

## Summary of Findings by Severity

| Severity | Count | Bug IDs |
|---|---|---|
| **P0** (Critical) | 0 | -- (all P0s from prior report fixed) |
| **P1** (High) | 2 | BUG-012, BUG-013 |
| **P2** (Medium) | 4 | BUG-014, BUG-015, BUG-016, BUG-020 |
| **P3** (Low) | 3 | BUG-017, BUG-018, BUG-019 |
| **Risks** | 6 | RISK-009 through RISK-014 |
| **Unfixed from Prior** | 4 | BUG-006, BUG-009, BUG-010, BUG-011 |

## Recommended Fix Priority

1. **Immediate (BUG-012):** Remove manual encrypt/decrypt in profile route -- data corruption on every profile update.
2. **Immediate (BUG-020):** Change webhook error handler to return 500 for retriable errors -- lost payments are unrecoverable.
3. **This Sprint (BUG-013):** Add billingState and User MFA fields to encryption extension.
4. **This Sprint (BUG-014):** Fix `/dashboard/billing` -> `/patient/billing` in all notification URLs.
5. **This Sprint (BUG-015):** Add proper server-side validation for intake form data.
6. **This Sprint (BUG-016):** Remove email from login 403 response.
7. **Next Sprint:** Add loading.tsx files (BUG-017), remove ghost ENCRYPTION_KEY requirement (BUG-018), implement email retry worker (BUG-019).
8. **Ongoing:** Fix npm audit vulnerabilities, address remaining unfixed bugs from prior report.
