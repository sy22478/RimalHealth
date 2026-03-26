# Team F: Code Review Report -- RimalHealth
## Date: 2026-03-25

## Executive Summary

The RimalHealth codebase has a solid security foundation: JWT auth is properly implemented with minimal claims, PHI encryption covers 28 fields across 6 models via the Prisma extension, and audit logging is present on most PHI-access routes. However, this review uncovered **3 CRITICAL**, **11 WARNING**, and **9 INFO** findings. The most severe issue is a SQL injection vulnerability in the physician patient search endpoint, followed by patient email addresses being logged to console in production, and multiple API routes for patient documents lacking `requireAuth`/`requireRole` calls (relying solely on middleware-injected headers).

---

## CRITICAL Findings (must fix before deploy)

### F3-CRIT-001: SQL Injection in Physician Patient Search

- **Severity:** CRITICAL
- **File:** `app/api/physician/patients/route.ts:83-91`
- **Finding:** The `$queryRaw` tagged template embeds a conditionally-constructed string for the WHERE clause. The pattern `${search ? \`WHERE pp.first_name ILIKE ${...}\` : ''}` inserts a raw string literal, NOT a Prisma parameterized value. Prisma's `$queryRaw` only parameterizes direct `${value}` expressions in the tagged template -- a ternary that evaluates to a string bypasses parameterization entirely. The `search` variable comes from user-supplied query parameters.
- **Impact:** A physician (or attacker with a compromised physician session) could inject arbitrary SQL through the search parameter.
- **Fix:** Use `Prisma.sql` fragments for conditional clauses, or rewrite using Prisma client `.findMany()` with `where` clauses. Example:
  ```typescript
  import { Prisma } from '@prisma/client';
  const whereClause = search
    ? Prisma.sql`WHERE pp.first_name ILIKE ${'%' + search + '%'} OR pp.last_name ILIKE ${'%' + search + '%'} OR u.email ILIKE ${'%' + search + '%'}`
    : Prisma.empty;
  ```
  Apply the same fix to the count query on lines 117-126.
- **Team:** A (API & Backend)

### F1-CRIT-002: Patient Email Logged to Console in Production

- **Severity:** CRITICAL
- **File:** `app/api/stripe/checkout-session/route.ts:374`, `app/api/stripe/checkout-session/route.ts:448`, `app/api/webhooks/stripe/route.ts:294`
- **Finding:** Patient email addresses (PHI under HIPAA) are logged to `console.info`/`console.error` with the actual email value:
  - Line 374: `console.info('[Checkout Session GET] Fallback: auto-created user for', normalizedEmail);`
  - Line 448: `console.error('[Checkout Session GET] CRITICAL: Failed to send set-password email to', normalizedEmail, emailResult.error);`
  - Line 294 (webhook): `console.error('[Stripe Webhook] CRITICAL: Failed to send create-account email to', customerEmail, setPasswordResult.error);`
- **Impact:** Email addresses are PHI identifiers. Logging them to stdout means they end up in Netlify/server logs, violating HIPAA's minimum necessary standard and creating an audit gap.
- **Fix:** Replace email with a hashed/masked version (e.g., `s***@example.com`) or log only the userId.
- **Team:** A (API & Backend)

### F3-CRIT-003: Multiple Patient Document Routes Lack `requireAuth`/`requireRole`

- **Severity:** CRITICAL
- **File:** `app/api/patient/documents/[id]/route.ts`, `app/api/patient/documents/[id]/download/route.ts`, `app/api/patient/documents/upload-url/route.ts`, `app/api/patient/documents/confirm/route.ts`
- **Finding:** These four document API routes do NOT call `requireAuth`, `requireRole`, or `requirePermission`. They rely solely on `request.headers.get('x-user-id')` which is set by the middleware. While the middleware does protect `/patient/*` paths, this is defense-in-depth violation: if middleware is misconfigured or bypassed (e.g., during a refactor), these routes are completely unprotected. The main `documents/route.ts` correctly uses `requireRole`, but its sub-routes do not.
- **Impact:** If middleware is ever bypassed (e.g., a config change making the path public), these routes would allow unauthenticated access to patient documents (PHI).
- **Fix:** Add `const auth = await requireRole(request, [Role.PATIENT]);` at the top of each handler, consistent with the parent `documents/route.ts`.
- **Team:** A (API & Backend)

---

## WARNING Findings (fix within 1 week)

### F1-WARN-001: PHI Stored in sessionStorage During Intake

- **Severity:** WARNING
- **File:** `lib/intake/auto-save.ts:60`
- **Finding:** The intake auto-save feature stores form data (PHI) in `sessionStorage`. While the code documents that sessionStorage is cleared when the tab closes (better than localStorage), PHI in browser storage is a HIPAA concern. The data includes medical history, medications, and personal health information from the intake form.
- **Mitigation in Place:** The code notes consent is obtained, and sessionStorage has a shorter lifecycle than localStorage.
- **Fix:** Consider encrypting the data client-side before storing in sessionStorage, or implement a server-only auto-save that doesn't require browser storage.
- **Team:** B (Frontend)

### F1-WARN-002: Prescription Model PHI Fields Not Fully Encrypted

- **Severity:** WARNING
- **File:** `lib/db/encryption-extension.ts:48-51` vs `prisma/schema.prisma:334-382`
- **Finding:** The encryption extension only encrypts `instructions` and `pharmacyAddress` on the Prescription model. However, the schema has additional fields that constitute PHI when combined with patient identity:
  - `medicationName` (reveals treatment/diagnosis)
  - `genericName` (reveals treatment/diagnosis)
  - `dosage` (medical detail)
  - `pharmacyName` (location identifier)
  - `pharmacyPhone` (contact identifier)

  Under HIPAA, prescription details linked to a patient ID are PHI because they reveal the patient's medical condition (AUD) and treatment.
- **Fix:** Add `medicationName`, `genericName`, `dosage`, `pharmacyName`, and `pharmacyPhone` to the `PHI_FIELDS.Prescription` array in `encryption-extension.ts`.
- **Team:** A (API & Backend)

### F1-WARN-003: Missing Audit Logging on Patient Onboarding Routes

- **Severity:** WARNING
- **File:** `app/api/patient/onboarding/start/route.ts` (entire file)
- **Finding:** The `POST /api/patient/onboarding/start` route stores PHI (personal info including name, DOB, phone, address) in Redis but has no `auditLogger` or `AuditService` call. HIPAA requires logging all PHI access events.
- **Fix:** Add `await AuditService.logPHIAccess('CREATE', userId, 'PATIENT', PHIResourceType.PATIENT_PROFILE, profileId, auditContext)` after successful storage.
- **Team:** A (API & Backend)

### F1-WARN-004: Missing Audit Logging on Physician Profile and Colleagues Routes

- **Severity:** WARNING
- **File:** `app/api/physician/profile/route.ts`, `app/api/physician/colleagues/route.ts`
- **Finding:** Neither route imports or calls `auditLogger`/`AuditService`. The profile route returns physician data including name, NPI, and license info. The colleagues route returns a list of physicians.
- **Fix:** Add audit logging for profile access and colleague list access.
- **Team:** A (API & Backend)

### F1-WARN-005: Missing Audit Logging on Patient Document Sub-Routes

- **Severity:** WARNING
- **File:** `app/api/patient/documents/[id]/download/route.ts`, `app/api/patient/documents/upload-url/route.ts`, `app/api/patient/documents/confirm/route.ts`
- **Finding:** While these routes have audit imports (`auditPHIAccess`, `auditLog`, `createAuditContext`), the download route (`[id]/download/route.ts`) does not import or call any audit function. Document downloads of medical records are PHI access events that must be logged.
- **Fix:** Add `await auditPHIAccess(...)` call after generating the download URL.
- **Team:** A (API & Backend)

### F3-WARN-006: Auth Change-Password and MFA Routes Missing Rate Limiting

- **Severity:** WARNING
- **File:** `app/api/auth/change-password/route.ts`, `app/api/auth/mfa/setup/route.ts`, `app/api/auth/mfa/verify/route.ts`, `app/api/auth/mfa/verify-setup/route.ts`, `app/api/auth/mfa/disable/route.ts`
- **Finding:** These auth routes do not implement rate limiting. While the main `login`, `register`, `forgot-password`, `reset-password`, `refresh`, `logout`, `set-password-token`, and `physician/verify-key` routes all have rate limiting, the change-password and all MFA routes are unprotected. The MFA verify endpoint is particularly concerning as it could be brute-forced.
- **Fix:** Add `rateLimit()` calls with appropriate thresholds (suggest `rateLimitPresets.strict` for MFA verify, `rateLimitPresets.auth` for others).
- **Team:** A (API & Backend)

### F3-WARN-007: DoseSpot Webhook Signature Verification Commented Out

- **Severity:** WARNING
- **File:** `app/api/webhooks/dosespot/route.ts:12-13`
- **Finding:** The webhook signature verification code is commented out:
  ```typescript
  // Verify webhook signature (implement based on DoseSpot docs)
  // const signature = request.headers.get('x-dosespot-signature');
  ```
  The route also has no Zod validation on the webhook payload. An attacker could send fake prescription status updates.
- **Fix:** Implement signature verification before production DoseSpot integration goes live. Add Zod validation for the payload shape. At minimum, add a shared secret check.
- **Team:** A (API & Backend)

### F3-WARN-008: No CSRF Protection on API Form-Handling Routes

- **Severity:** WARNING
- **File:** `lib/security/csrf.ts` exists but is not imported in any API route under `app/api/`
- **Finding:** While a CSRF module exists at `lib/security/csrf.ts`, it is not used by any API route. The middleware (`middleware.ts`) also does not implement CSRF checking. All state-mutating POST/PUT/DELETE endpoints are vulnerable to CSRF attacks. The use of httpOnly cookies for auth means CSRF is a real threat vector.
- **Mitigation:** API routes using `Authorization: Bearer` header are not vulnerable to CSRF, but routes that read auth from cookies (which is the primary auth method for browser requests) are.
- **Fix:** Implement CSRF token validation on all state-mutating API routes, or switch to `Authorization: Bearer` header exclusively for API calls from the frontend.
- **Team:** A (API & Backend) + B (Frontend)

### F2-WARN-009: 32 Components Missing `'use client'` Directive

- **Severity:** WARNING
- **Files:** 32 component files (see full list below)
- **Finding:** The following components import React hooks (`useState`, `useEffect`, `useRef`, `useCallback`, etc.) but do not have `'use client'` at the top of the file:
  - `app/admin/physicians/pending/PendingPhysiciansClient.tsx`
  - `app/checkout/success/CheckoutSuccessClient.tsx`
  - `app/patient/billing/page.tsx`
  - `app/physician/(portal)/messages/MessagesClient.tsx`
  - `app/physician/(portal)/messages/page.tsx`
  - `components/patient/DocumentCard.tsx`
  - `components/patient/DocumentList.tsx`
  - `components/patient/DocumentUpload.tsx`
  - `components/patient/InvoiceCard.tsx`
  - `components/patient/MessageComposer.tsx`
  - `components/patient/MessageThread.tsx`
  - `components/patient/PatientMessageList.tsx`
  - `components/physician/IntakeReviewForm.tsx`
  - `components/physician/MessageComposer.tsx`
  - `components/physician/MessageInbox.tsx`
  - `components/physician/MessageNotifications.tsx`
  - `components/physician/MessageSidebar.tsx`
  - `components/physician/MessageThread.tsx`
  - `components/physician/messaging/ComposeMessage.tsx`
  - `components/physician/messaging/MessageThread.tsx`
  - `components/physician/messaging/MessageThreadList.tsx`
  - `components/physician/PatientDetailView.tsx`
  - `components/physician/PatientList.tsx`
  - `components/physician/PatientNotes.tsx`
  - `components/physician/PatientStats.tsx`
  - `components/physician/PatientTable.tsx`
  - `components/physician/PharmacySearch.tsx`
  - `components/physician/PrescriptionForm.tsx`
  - `components/physician/PrescriptionList.tsx`
  - `components/physician/PrescriptionStatus.tsx`
  - `components/physician/PrescriptionWriter.tsx`
  - `components/physician/ReviewQueue.tsx`
- **Impact:** Next.js may fail to render these components correctly in production, or they may trigger build errors.
- **Fix:** Add `'use client';` as the first line of each file.
- **Team:** B (Frontend)

### F2-WARN-010: Physician Prescriptions Page Missing `force-dynamic` Export

- **Severity:** WARNING
- **File:** `app/physician/(portal)/prescriptions/page.tsx`
- **Finding:** This server component imports from `@prisma/client` (`PrescriptionStatus`) but does not export `const dynamic = 'force-dynamic'`. According to the project's CLAUDE.md: "Admin pages with Prisma queries need `export const dynamic = 'force-dynamic'` to avoid static generation errors."
- **Fix:** Add `export const dynamic = 'force-dynamic';` to the file.
- **Team:** B (Frontend)

### F1-WARN-011: Raw SQL Queries Bypass Prisma Encryption Extension

- **Severity:** WARNING
- **File:** `app/api/physician/patients/route.ts:62-91`, `app/api/physician/patients/[id]/history/route.ts:92-125`
- **Finding:** The `$queryRaw` calls bypass the Prisma encryption extension entirely. The `patients/route.ts` query returns `first_name`, `last_name`, `date_of_birth`, `content` directly from the database, meaning these come back as encrypted ciphertext. The code manually calls `decryptPHI()` on line 107-110 to handle this. While this works, it creates a maintenance risk: any new PHI field added to these raw queries must be manually decrypted, unlike Prisma client calls where the extension handles it automatically. Also, the `history/route.ts` raw queries for `physician_notes.content` return encrypted content but it is not clear if decryption is applied before returning to the client.
- **Fix:** Add a code comment documenting the manual decryption requirement. Verify the history route properly decrypts `content` before response. Prefer Prisma client methods over raw SQL where possible.
- **Team:** A (API & Backend)

---

## INFO Findings (backlog)

### F1-INFO-001: Email Templates Use Patient First Name in Body (acceptable)

- **Severity:** INFO
- **File:** `lib/notifications/templates.ts` (throughout)
- **Finding:** Email templates use `data.firstName` in the email body (e.g., "Hi John,"). Subject lines are generic and do not contain PHI. This is acceptable for personalized communication but worth documenting in the HIPAA compliance policy.
- **Action:** No code change needed. Document in HIPAA compliance documentation.

### F1-INFO-002: `billingState` and `addressState` Not Encrypted

- **Severity:** INFO
- **File:** `lib/db/encryption-extension.ts:19-36` vs `prisma/schema.prisma:101-108`
- **Finding:** The `addressState` field is always "CA" (California only service) and `billingState` is similarly a state code. These are not encrypted because they have very low information density (always CA). This is an acceptable risk reduction given the minimal PHI value.
- **Action:** No change needed; document the rationale.

### F2-INFO-003: Hardcoded Hex Colors in OG Image and Icon Files

- **Severity:** INFO
- **File:** `app/opengraph-image.tsx:15,32`, `app/icon.tsx:15`
- **Finding:** These files use hardcoded hex colors (`#0A2540`, `#0284C7`). This is acceptable because OG image/icon generators require inline styles and cannot use Tailwind classes.
- **Action:** No change needed.

### F2-INFO-004: Zero Instances of TypeScript `any` Type

- **Severity:** INFO
- **Finding:** Grep for `: any` across all `.ts` and `.tsx` files in `app/` and `lib/` returned zero matches. The codebase adheres to strict TypeScript mode.
- **Action:** None -- this is a positive finding.

### F2-INFO-005: Zero Instances of Zod v3 `required_error` Syntax

- **Severity:** INFO
- **Finding:** Grep for `required_error` across all TypeScript files returned zero matches. All Zod schemas correctly use v4 `{ message: '...' }` syntax.
- **Action:** None -- this is a positive finding.

### F2-INFO-006: All Audit Imports Use Explicit `/index` Path

- **Severity:** INFO
- **Finding:** All 44 files that import from `@/lib/audit` use the explicit `@/lib/audit/index` path, compliant with the Turbopack barrel export workaround.
- **Action:** None -- this is a positive finding.

### F3-INFO-007: `Stripe sk_test_placeholder` Fallback in Non-Test Code

- **Severity:** INFO
- **File:** `lib/integrations/stripe.ts:50`
- **Finding:** The Stripe integration falls back to `'sk_test_placeholder'` when no `STRIPE_SECRET_KEY` is configured. This is safe because Stripe will reject the placeholder key, but it could mask configuration errors in development.
- **Action:** Consider throwing an error instead of using a placeholder, to catch missing configuration early.

### F3-INFO-008: DoseSpot Webhook Logs Unhandled Event Types

- **Severity:** INFO
- **File:** `app/api/webhooks/dosespot/route.ts:43`
- **Finding:** `console.log(\`Unhandled DoseSpot event: ${eventType}\`)` logs the event type from the webhook payload. The `eventType` is not PHI, so this is acceptable, but in production it should use a structured logger.
- **Action:** Replace `console.log` with the audit logger for consistency.

### F2-INFO-009: Intake Client Console Logs Feedback Strings

- **Severity:** INFO
- **File:** `app/intake/IntakeClient.tsx:298,405,473,661,767,879`
- **Finding:** Multiple `console.log('... Feedback:', feedback)` calls exist in the intake form client. The `feedback` object contains user-selected feedback options from the form UI, not raw PHI. However, these are development debug logs that should be removed for production.
- **Action:** Remove or gate behind `process.env.NODE_ENV === 'development'`.

---

## Summary Stats

| Category | Items Checked | CRITICAL | WARNING | INFO |
|----------|:------------:|:--------:|:-------:|:----:|
| **F1: HIPAA Compliance** | PHI encryption (6 models, 28 fields), audit logging (35 patient/physician routes), console.log PHI leaks, PHI in URLs, PHI in JWT, PHI in error messages, PHI in browser storage, email templates, data retention | 1 | 5 | 2 |
| **F2: Code Quality** | TypeScript `any` usage, Zod v4 syntax, `use client` directives, Tailwind hardcoded values, barrel export imports, `force-dynamic` exports | 0 | 2 | 4 |
| **F3: Security** | Auth bypass (all 76 API routes), input validation (Zod coverage), rate limiting (auth endpoints), CSRF protection, secret exposure, SQL injection | 2 | 4 | 3 |
| **TOTAL** | | **3** | **11** | **9** |

---

## Compliance Gate Status

| Gate | Status | Notes |
|------|--------|-------|
| HIPAA Compliance | **CONDITIONAL PASS** | Must fix CRIT-002 (email logging) and WARN-002 (prescription encryption) before handling real patient data |
| Security | **FAIL** | Must fix CRIT-001 (SQL injection) and CRIT-003 (missing auth on document routes) before deploy |
| Code Quality | **CONDITIONAL PASS** | WARN-009 (32 missing `use client`) may cause build/render failures; fix before deploy |

---

## Positive Findings Worth Noting

1. **JWT implementation is solid** -- minimal claims (userId, email, role), no PHI in tokens, proper verification with audience/issuer checks
2. **PHI encryption coverage is comprehensive** -- 28 fields across 6 models, with automatic encrypt/decrypt via Prisma extension
3. **Zero TypeScript `any` usage** -- strict mode fully enforced
4. **Zero Zod v3 syntax** -- all schemas use correct v4 patterns
5. **Audit logging present on 35+ API routes** -- including both patient and physician paths
6. **Rate limiting on 8 auth endpoints** -- login, register, forgot-password, reset-password, refresh, logout, set-password-token, physician verify-key
7. **All barrel exports use explicit `/index` paths** -- Turbopack compatible
8. **Email template subjects are generic** -- no PHI in subject lines
9. **Data retention module uses soft-delete pattern** -- HIPAA 7-year retention respected
