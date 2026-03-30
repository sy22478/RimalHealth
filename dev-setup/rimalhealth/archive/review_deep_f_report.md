# Team F: Deep Code Review Report

> **Reviewer:** Team F (Code Review) -- Deep Audit
> **Date:** 2026-03-25
> **Scope:** Full codebase after Phase 5 sprint (Waves 1-4). 80+ API routes, 30+ modified files, 4 new pages, 4 new scoring functions.
> **Previous Review:** `review_wave2_report.md` (2 CRITICAL, 6 WARNING)
> **Methodology:** Full PHI flow trace, email content audit, browser storage audit, auth coverage map, input validation completeness, security token review, scoring engine edge case analysis.

---

## Summary Table

| # | Severity | Category | File | Issue |
|---|----------|----------|------|-------|
| 1 | **CRITICAL** | F1-HIPAA | `lib/intake/auto-save.ts` | PHI stored in sessionStorage -- old auto-save module still exists and backs up form data to browser |
| 2 | **CRITICAL** | F3-Security | `app/api/auth/verify-email/route.ts` | No rate limiting -- token brute-force possible |
| 3 | **CRITICAL** | F1-HIPAA / F3-Security | `app/api/physician/review/route.ts:113-148` | Double encryption of Review and Prescription fields (manual `encryptPHI()` + Prisma extension) |
| 4 | **CRITICAL** | F3-Security | 4 document API routes | Auth relies solely on middleware-injected `x-user-id` header; no `requireRole()` call -- header-spoofable if middleware is bypassed |
| 5 | **WARNING** | F1-HIPAA | `lib/notifications/templates.ts:420,437` | REFILL_REQUESTED template includes `medicationName` in email body -- PHI leakage |
| 6 | **WARNING** | F1-HIPAA | `app/api/intake/route.ts` | Legacy intake endpoint has NO auth -- accepts PHI (name, email, phone, medical data) from anyone |
| 7 | **WARNING** | F2-Quality | `app/intake/IntakeClient.tsx:1220` | `opioidUse` and `opioidMaintenance` still missing from safety step validation (unfixed from previous review) |
| 8 | **WARNING** | F1-HIPAA | 55+ API routes | `console.error('...:', error)` logs raw error objects that may contain PHI field values from Prisma |
| 9 | **WARNING** | F3-Security | All state-changing API routes | CSRF module (`lib/security/csrf.ts`) still not wired into any API route (unfixed from Phase 4 review) |
| 10 | **WARNING** | F1-HIPAA | `app/api/patient/profile/route.ts:67-71` | Manual `decryptPHI()` on profile GET -- data already decrypted by Prisma extension, causing double-decrypt (silent failure or garbled data) |
| 11 | **WARNING** | F3-Security | `app/api/webhooks/stripe/route.ts:58` | `webhookSecret` uses non-null assertion at module level (unfixed from previous review) |
| 12 | **WARNING** | F1-HIPAA | `lib/services/notification-service.ts:69` | `console.log` includes `patientId` -- not PHI per se, but ties to patient identity in logs |
| 13 | **WARNING** | F2-Quality | `app/intake/IntakeClient.tsx:1220-1221` | `medical` step only validates `medicalHistory` and `previousTreatments` but omits `currentMedications` and `seeingTherapist` |
| 14 | **INFO** | F3-Security | `app/api/auth/verify-token/route.ts` | Token lookup uses Prisma `findUnique` on token value (DB index lookup, not brute-forceable at crypto level, but lacks timing-safe comparison) |
| 15 | **INFO** | F2-Quality | `app/api/physician/review/route.ts:174` | `notes` passed to `NotificationService.notifyReviewComplete()` but parameter is unused -- dead parameter |
| 16 | **INFO** | F1-HIPAA | `app/api/checkout/consent/route.ts:76` | `eventType: 'CONSENT_RECORDED'` string literal bypasses `AuditEventType` enum (unfixed from previous review) |
| 17 | **INFO** | F2-Quality | `lib/intake/auto-save.ts` | Old auto-save module with `calculateProgress()` references AUDIT-C format fields that no longer exist in the new DSM-5 intake form |
| 18 | **INFO** | F2-Quality | `validation.data!` pattern | 15 API routes use non-null assertion after validation success check -- safe but noisy |

---

## Previous Review Status Check

| Previous Finding | Status | Notes |
|-----------------|--------|-------|
| CRITICAL #1: No rate limiting on verify-token | **FIXED** | Rate limiting added (strict preset) |
| CRITICAL #2: No audit logging on verify-token/verify-email | **FIXED** | Audit logging on all paths (success + failure) |
| WARNING #3: Email in login response | **ACCEPTED** | Still present; documented as accepted risk |
| WARNING #4: Raw error objects in console | **PARTIALLY FIXED** | Fixed in 3 new auth routes; 55+ other routes still log `error` object directly |
| WARNING #5: No audit on send-verification | **FIXED** | `auditPasswordEvent` added |
| WARNING #6: Non-null assertion on webhook secret | **NOT FIXED** | Still `process.env.STRIPE_WEBHOOK_SECRET!` at line 58 |
| WARNING #7: opioidUse/opioidMaintenance not in safety validation | **NOT FIXED** | Still missing from `stepFields.safety` at line 1220 |
| WARNING #8: Netlify deploy flag | **DEFERRED** | Deploy process is handled separately |
| INFO #11: CONSENT_RECORDED string literal | **NOT FIXED** | Low priority, acceptable |

---

## F1: HIPAA Deep Audit

### F1.1: Complete PHI Flow Trace

**Intake Form Submission -> Storage -> Physician Retrieval -> Decision**

| Step | File | Encryption | Audit Logging | Verdict |
|------|------|-----------|---------------|---------|
| 1. Patient fills form | `IntakeClient.tsx` | N/A (client-side, no browser storage) | N/A | GOOD -- no sessionStorage/localStorage used in rewritten IntakeClient |
| 2. Auto-save to server | `POST /api/patient/intake` | formData auto-encrypted by Prisma extension | `AuditService.logIntakeAccess` on create | GOOD |
| 3. Submit intake | `POST /api/patient/intake/[id]/submit` | enrichedFormData (with provider summary) auto-encrypted by Prisma extension | `AuditService.logDataModification` | GOOD |
| 4. Physician retrieves | `lib/physician/review.ts:getIntakeForReview` | Auto-decrypted by Prisma extension | `logIntakeAccess` audit call | GOOD |
| 5. Physician submits review | `POST /api/physician/review` | **PROBLEM: Manual `encryptPHI()` on clinicalNotes/rejectionReason + Prisma extension will encrypt AGAIN** | `AuditService.logDataModification` | **CRITICAL -- double encryption** |
| 6. Patient notified | `NotificationService.notifyReviewComplete` | N/A -- email has no clinical data | N/A | GOOD |

**CRITICAL Finding #3 -- Double Encryption in Physician Review Route:**

At `app/api/physician/review/route.ts:113-148`, the code manually calls `encryptPHI()` on `clinicalNotes`, `rejectionReason`, `alternativeRecommendation`, and `instructions` before passing them to `prisma.review.create()` and `prisma.prescription.create()`. However, the Prisma encryption extension (`lib/db/encryption-extension.ts`) already encrypts these fields automatically for the `Review` model (lines 42-47: `clinicalNotes`, `contraindications`, `rejectionReason`, `alternativeRecommendation`, `instructions`) and the `Prescription` model (lines 48-54: `medicationName`, `dosage`, `pharmacyName`, `instructions`, `pharmacyAddress`).

This causes **double encryption**: the data is encrypted once by `encryptPHI()`, then the encrypted ciphertext is encrypted AGAIN by the Prisma extension. When the physician later reads the review via `getIntakeForReview`, the Prisma extension decrypts one layer, but the result is still encrypted ciphertext, not the original plaintext.

The `encryptField()` function at line 128-131 of `encryption-extension.ts` has an idempotency check (`isEncrypted(value)`), but this check happens BEFORE the manual encryption is applied in the route handler -- the route handler encrypts first, then Prisma extension sees already-encrypted data and skips. So the actual behavior depends on whether the `isEncrypted()` check works correctly on the output of `encryptPHI()`. If it does, data is only encrypted once (good). If it doesn't, data is double-encrypted (bad, causes garbled data on read).

**Risk:** If `isEncrypted()` fails to detect the manual encryption, clinical notes and prescriptions become unreadable. This needs verification and ideally the manual `encryptPHI()` calls should be removed from the review route since the Prisma extension handles it.

**Similarly for `app/api/patient/profile/route.ts:67-71`:** The GET handler manually calls `decryptPHI()` on profile fields that are already auto-decrypted by the Prisma extension. If the extension decrypts first (which it does, since `findUnique` is intercepted), then `decryptPHI()` receives plaintext and will either: (a) throw an error, (b) return garbled data, or (c) return the plaintext unchanged if it detects non-encrypted input. This is WARNING #10.

### F1.2: Email Content Audit

| Template | Subject | Body Contains PHI? | Verdict |
|----------|---------|-------------------|---------|
| WELCOME | "Welcome to Rimal Health!" | `firstName` (greeting only) | ACCEPTABLE -- first name is minimal, not clinical |
| EMAIL_VERIFICATION | "Verify Your Email Address" | `firstName` (greeting) + verification URL | GOOD |
| PASSWORD_RESET | "Reset Your Password" | `firstName` (greeting) + reset URL | GOOD |
| INTAKE_SUBMITTED | "Intake Form Submitted - Under Review" | `firstName` (greeting), generic "next step" message | GOOD |
| INTAKE_APPROVED | "You Have a New Update on Your Rimal Health Portal" | No clinical data; directs to portal | GOOD |
| INTAKE_REJECTED | "You Have a New Update on Your Rimal Health Portal" | No rejection reason; directs to portal | GOOD |
| INTAKE_NEEDS_INFO | "Your Physician Has a Question - Please Log In" | No question details; directs to portal | GOOD |
| INTAKE_CONFIRMATION | "Intake Confirmation - Payment Received" | `firstName` (greeting), generic status | GOOD |
| NEW_INTAKE_PENDING | "New Intake Pending Review" | `concernType` (e.g., "ALCOHOL") -- no patient identifier | GOOD |
| **REFILL_REQUESTED** | "Prescription Refill Request Received" | **`medicationName` in body** | **WARNING #5 -- PHI** |
| REFILL_APPROVED | "Your Refill Request Has Been Approved" | `message` field (content unknown) | NEEDS REVIEW |
| PRESCRIPTION_SENT | "You Have a New Update on Your Rimal Health Portal" | No clinical data; directs to portal | GOOD |
| MESSAGE_RECEIVED | "You Have a New Message on Your Rimal Health Portal" | No message content; directs to portal | GOOD |
| PAYMENT_RECEIPT | "Payment Receipt - Rimal Health" | Amount, date, description, transactionId -- financial, not clinical | ACCEPTABLE |
| PAYMENT_FAILED | "Payment Failed - Action Required" | `message` field (content unknown) | NEEDS REVIEW |
| SUBSCRIPTION_CANCELLED | "Subscription Cancelled" | End date -- financial, not clinical | ACCEPTABLE |
| SET_PASSWORD | "Create Your Account -- Rimal Health" | No PHI | GOOD |
| CREATE_ACCOUNT | "Create Your Rimal Health Account" | No PHI | GOOD |
| ADMIN_ALERT | Admin subject | System-level alerts, no PHI | GOOD |
| GENERIC_NOTIFICATION | Dynamic subject | Dynamic `message` field -- depends on caller | NEEDS REVIEW |

**WARNING #5 Detail:** The `REFILL_REQUESTED` template at `lib/notifications/templates.ts:420,437` includes `data.medicationName` directly in the email body. Medication name is PHI (it reveals what condition the patient is being treated for). This template should follow the same pattern as PRESCRIPTION_SENT and INTAKE_APPROVED: "You have an update -- log in to view."

### F1.3: Browser Storage Audit

| File | Storage Type | What's Stored | PHI? | Verdict |
|------|-------------|---------------|------|---------|
| `app/checkout/consent/page.tsx:271` | sessionStorage | `consentRecordId` (UUID) | No | ACCEPTABLE |
| `lib/intake/auto-save.ts:60` | sessionStorage | Full intake form data (name, DOB, medical history, etc.) | **YES** | **CRITICAL #1** |
| `components/physician/MessageNotifications.tsx:157,172` | localStorage | Notification preferences (JSON) | No | ACCEPTABLE |
| `tests/e2e/utils/auth.ts:74-106` | localStorage | Access tokens (test utility) | No (test only) | ACCEPTABLE |
| `hooks/use-auth.tsx` | httpOnly cookies only | N/A | N/A | GOOD |
| `hooks/usePatientUnreadCount.ts` | httpOnly cookies only | N/A | N/A | GOOD |

**CRITICAL #1 Detail:** `lib/intake/auto-save.ts` stores the full intake form draft in `sessionStorage`. While the rewritten `IntakeClient.tsx` does NOT import or use this module (confirmed by grep), the module still exists and is exported from `lib/intake/index.ts` (barrel export). Any future developer importing `auto-save` functions will inadvertently store PHI in the browser. The functions `saveDraftToLocalStorage()`, `loadDraftFromLocalStorage()`, and `createAutoSaveHandler()` (line 293) all write form data to sessionStorage.

Additionally, `lib/intake/auto-save.ts` has a misleading HIPAA compliance note claiming "Data is encrypted at rest" (line 8), but there is NO encryption applied to the sessionStorage data -- it's stored as plain JSON.

**Recommendation:** Either delete `lib/intake/auto-save.ts` entirely (since the new IntakeClient uses server-side auto-save), or gut the sessionStorage functions and keep only the server sync and utility functions.

### F1.4: New Pages Audit

| Page/Route | PHI in Response? | PHI in Error Messages? | PHI in Logs? | Verdict |
|------------|-----------------|----------------------|--------------|---------|
| `/create-account` page | Displays email (from token lookup) | No | No | ACCEPTABLE -- email needed for UX |
| `/verify-email` page | No PHI displayed | No | No | GOOD |
| `POST /api/checkout/consent` | No PHI (UUID only) | No | Error logged with `error.message` only | GOOD |
| `GET /api/auth/verify-token` | Returns `email` (needed for create-account UX) | Generic error messages | `error.message` only | ACCEPTABLE |
| `GET /api/auth/verify-email` | No PHI | Generic error messages | `error.message` only | GOOD |
| `POST /api/auth/send-verification` | No PHI (consistent "if account exists" response) | No | `error.message` only | GOOD |

---

## F2: Code Quality Deep Audit

### F2.1: API Route Consistency Check

Sampled 10 routes across patient/, physician/, admin/ domains:

| Pattern | patient/intake | patient/messages | patient/profile | physician/review | physician/patients | physician/queue | admin/physicians | admin/physicians/[id]/authorize | patient/intake/[id]/submit | physician/stats |
|---------|---------------|-----------------|----------------|-----------------|-------------------|----------------|-----------------|-------------------------------|---------------------------|----------------|
| Auth via `requireRole()` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Zod validation | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `AuditService` or `auditLogger` | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Try/catch with generic error | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `console.error('...:', error)` | Yes (raw) | Yes (raw) | Yes (raw) | Yes (raw) | Yes (raw) | Yes (raw) | Yes (raw) | Yes (raw) | Yes (raw) | Yes (raw) |
| `validation.data!` non-null | Yes | Yes | Yes | Yes | Yes | Yes | N/A | N/A | Yes | Yes |

**Consistency verdict:** Routes are highly consistent in structure. The main inconsistency is the 4 document sub-routes (`[id]`, `[id]/download`, `confirm`, `upload-url`) which use header-based auth (`x-user-id`) instead of `requireRole()`.

### F2.2: Dead Import Audit

**CLEAN.** Zero imports from deleted files `lib/hipaa/audit-logger` or `lib/hipaa/encryption`. The Wave 4 cleanup was thorough.

### F2.3: Component Architecture

**`PatientLayoutClient.tsx`** (268 lines): Well-structured. Extracts `Sidebar`, `MobileNav`, and `MobileBottomNav` as internal components. Uses `usePatientUnreadCount` hook for message badges. No PHI handling. Clean `'use client'` directive. **PASS.**

**`IntakeClient.tsx`** (~1400 lines): Large but well-organized. Extracts each section as a separate component function (`DSM5ScreeningStep`, `DrinkingPatternStep`, etc.). Uses `FormProvider`/`useFormContext` pattern correctly. Server-side auto-save every 30 seconds. No browser storage for PHI. Review step with edit-back capability.

**Concern:** At ~1400 lines, this is the largest client component. Consider extracting each step component into its own file under `app/intake/steps/` for maintainability. Not a blocker.

### F2.4: Scoring Engine Review

All 4 new scoring functions in `lib/intake/scoring.ts` are pure functions with `Record<string, unknown>` input (no `any`).

**Edge case analysis:**

| Function | Empty formData | Missing keys | Wrong types | Verdict |
|----------|---------------|-------------|-------------|---------|
| `calculateDSM5Score({})` | Returns score=0, severity='NONE', meetsCriteria=false | Safe -- `filter(k => answers[k] === true)` returns 0 | Non-boolean values treated as false (strict `=== true`) | GOOD |
| `detectContraindications({})` | Returns empty arrays, no contraindication flags | Safe -- all checks guard for undefined/null | `opioidUse` cast to `string[]` could be non-array; `Array.isArray()` check guards | GOOD |
| `assessWithdrawalRisk({})` | Returns isElevated=false, empty riskFactors | Safe -- `=== true` checks on undefined return false | Non-boolean values ignored | GOOD |
| `generateProviderDecisionSummary({})` | Returns ROUTINE priority, score=0, eligible=true | Safe -- composes the above functions | N/A | GOOD |
| `calculateIntakeScores({})` | Returns riskScore=0, complexityScore=0 | Safe -- all casts have fallbacks | `parseInt(undefined, 10)` returns NaN, then `Math.min(NaN)` returns NaN -- potential issue in `quitAttempts` | **MINOR** |

**Minor edge case:** In `calculateIntakeScores`, line 607: `parseInt(formData.alcoholQuitAttempts as string || '0', 10)` -- if `alcoholQuitAttempts` is explicitly `null`, `null || '0'` returns `'0'` (safe). If it's `undefined`, same. If it's a non-numeric string, `parseInt` returns `NaN`, then `Math.min(NaN * 5, 20)` returns `NaN`, which gets added to `score` and makes the final `riskScore` NaN. This is handled by `Math.round(NaN)` returning `NaN` and `Math.min(NaN, 100)` returning `NaN`. The `NaN` would propagate to the database `riskScore` column. Low risk since `alcoholQuitAttempts` is not a field in the DSM-5 form, but should still be guarded.

### F2.5: Type Safety

- **Zero `as any` casts** in `app/` directory.
- **One `as any` cast** in `lib/db/prisma.ts:143` for Prisma query event listener -- acceptable, Prisma internal API.
- **15 `validation.data!` non-null assertions** across API routes. All guarded by prior `!validation.success` check and early return. Safe pattern but could use `validation.data` with optional chaining instead.
- **No loose typing** found in new/modified files.

---

## F3: Security Deep Audit

### F3.1: Auth Coverage Map

**76 API routes classified:**

#### Public (No Auth) -- 8 routes

| Route | Intentional? | Risk |
|-------|-------------|------|
| `POST /api/auth/login` | Yes | Rate limited |
| `POST /api/auth/register` | Yes | Rate limited |
| `POST /api/auth/forgot-password` | Yes | Rate limited |
| `POST /api/auth/reset-password` | Yes | Token-validated |
| `GET /api/auth/verify-token` | Yes | Rate limited |
| `GET /api/auth/verify-email` | Yes | Token-validated |
| `POST /api/auth/send-verification` | Yes | Rate limited |
| `POST /api/checkout/consent` | Yes | Rate limited, no PHI |

#### Public (No Auth) -- QUESTIONABLE

| Route | Auth? | Risk | Verdict |
|-------|-------|------|---------|
| **`POST /api/intake`** | **NO auth** | **Accepts PHI (name, email, phone, medical data) from unauthenticated users** | **WARNING #6** |
| `POST /api/contact` | No auth | Contact form -- expected public | ACCEPTABLE |
| `GET /api/health` | No auth | Health check -- expected public | ACCEPTABLE |
| `POST /api/stripe/public-checkout-session` | No auth | Payment initiation -- expected public by design | ACCEPTABLE |
| `POST /api/webhooks/stripe` | Stripe signature verification | Webhook -- expected | ACCEPTABLE |
| `POST /api/webhooks/dosespot` | Signature verification (commented out per Phase 4) | **Known risk** | ACCEPTED |

**WARNING #6 Detail:** `POST /api/intake` (the legacy intake endpoint at `app/api/intake/route.ts`) has NO authentication. It accepts full PHI including `firstName`, `lastInitial`, `email`, `phone`, `medicalConditions`, and `currentMedications`. While this may be intentionally public (pre-payment intake), it means anyone can submit PHI to the system without being an authenticated user. The route does have Zod validation but no rate limiting. An attacker could flood the system with fake intakes and trigger physician notification emails. This endpoint should either be deprecated (since the new flow uses `POST /api/patient/intake` which requires auth) or have rate limiting added.

#### Patient-Only -- 23 routes
All use `requireRole(request, [Role.PATIENT])`:
- `GET/POST /api/patient/intake`
- `GET/PATCH /api/patient/intake/[id]`
- `POST /api/patient/intake/[id]/submit`
- `GET/POST /api/patient/messages`
- `GET /api/patient/messages/[id]`
- `GET/PUT /api/patient/profile`
- `GET /api/patient/profile/[id]`
- `PUT /api/patient/profile/password`
- `GET/PUT /api/patient/profile/preferences`
- `GET/POST /api/patient/documents` (main route only)
- `GET /api/patient/prescriptions`
- `GET /api/patient/prescriptions/[id]`
- `POST /api/patient/prescriptions/[id]/refill`
- `GET /api/patient/billing/*` (4 routes)
- `GET /api/patient/pharmacies/search`
- `POST /api/patient/onboarding/start`
- `POST /api/patient/onboarding/complete`

#### Patient Documents Sub-Routes -- WEAK AUTH (4 routes)

| Route | Auth Method | Problem |
|-------|-----------|---------|
| `GET /api/patient/documents/[id]` | `x-user-id` header check | **No `requireRole()` -- header-only auth** |
| `GET /api/patient/documents/[id]/download` | `x-user-id` header check | **No `requireRole()` -- header-only auth** |
| `POST /api/patient/documents/confirm` | `x-user-id` header check | **No `requireRole()` -- header-only auth** |
| `POST /api/patient/documents/upload-url` | `x-user-id` header check | **No `requireRole()` -- header-only auth** |

**CRITICAL #4 Detail:** These 4 routes rely entirely on the `x-user-id` header set by middleware. While the Next.js middleware does set this header after JWT verification, the routes don't perform their own JWT validation via `requireRole()`. If middleware is bypassed (e.g., during local development, testing, or if a misconfiguration in `middleware.ts` matcher excludes these paths), these routes would trust any client-supplied `x-user-id` header. The other 2 document routes (`GET/POST /api/patient/documents/route.ts`) correctly use `requireRole()`, making the 4 sub-routes inconsistent.

#### Physician-Only -- 22 routes
All use `requireRole(request, [Role.PHYSICIAN])` or `[Role.PHYSICIAN, Role.ADMIN]`:
- Queue, review, patients, messages, prescriptions, stats, dashboard, intake, profile, pharmacies, colleagues, notes

#### Admin-Only -- 8 routes
All use `requireRole(request, [Role.ADMIN])`:
- CRUD, authorize, suspend, reject, reactivate, reset-key

#### Auth-Protected (Any Role) -- 9 routes
- `GET /api/auth/me`, `POST /api/auth/logout`, `POST /api/auth/change-password`
- `POST /api/auth/refresh` (uses refresh token)
- `POST /api/stripe/checkout-session` (custom JWT verification)
- `POST /api/stripe/customer-portal`
- `GET /api/stripe/subscription`
- `POST /api/auth/mfa/*` (4 routes)
- `POST /api/auth/physician/verify-key`
- `POST /api/auth/set-password-token`

### F3.2: Token Security Review

| Endpoint | Token Expiry | One-Time Use | Rate Limited | Timing-Safe Comparison |
|----------|-------------|-------------|-------------|----------------------|
| `GET /api/auth/verify-token` | Yes (checked at line 85) | Read-only (doesn't consume) | Yes (strict, 5/15min) | No -- uses Prisma `findUnique` (DB lookup) |
| `GET /api/auth/verify-email` | Yes (checked at line 89) | Yes (`usedAt` checked + set in transaction) | **NO** | No -- uses Prisma `findUnique` (DB lookup) |
| `POST /api/auth/send-verification` | N/A (creates token) | N/A | Yes (strict, 5/15min) | N/A |
| `POST /api/auth/reset-password` | Yes | Yes (marks used) | Via forgot-password flow | No |

**CRITICAL #2 Detail:** `GET /api/auth/verify-email` has NO rate limiting. An attacker who obtains a list of verification tokens (e.g., via a database leak, or by brute-forcing the `verify-` prefix + UUID format) could verify any account's email without limit. While UUIDs are not practically brute-forceable, the lack of rate limiting is inconsistent with `verify-token` (which has strict rate limiting) and creates an asymmetric attack surface.

**Note on timing-safe comparison:** All token lookups use Prisma `findUnique` which performs a database index lookup. This is NOT timing-safe (a match takes longer than a miss due to index traversal). However, since tokens are UUIDs (128 bits of entropy), timing attacks are not practical. This is INFO-level.

### F3.3: Input Validation Completeness

All new/modified API routes use Zod validation on request bodies:

| Route | Validated? | Gaps |
|-------|-----------|------|
| `POST /api/patient/intake` | Yes (`createIntakeSchema`) | formData accepts `Prisma.InputJsonValue` (loose) |
| `POST /api/patient/intake/[id]/submit` | Yes (`submitIntakeSchema`) | formData accepts `Prisma.InputJsonValue` (loose) |
| `POST /api/physician/review` | Yes (`submitReviewSchema`) | Complete |
| `POST /api/checkout/consent` | Yes (inline schema) | Complete |
| `POST /api/auth/send-verification` | Yes (inline schema) | Complete |
| `GET /api/auth/verify-token` | Token from query param (no Zod, manual check) | Minimal -- just `!token` check |
| `GET /api/auth/verify-email` | Token from query param (no Zod, manual check) | Minimal -- `!token` + prefix check |

**Note:** The intake `formData` field uses `Prisma.InputJsonValue` which accepts any valid JSON. The actual validation of intake form fields happens client-side via the Zod schema in `IntakeClient.tsx`. Server-side, there's no schema validation of individual form fields -- only the wrapping `submitIntakeSchema` is validated. This means a malicious client could submit any JSON as form data. However, since the form data is encrypted at rest and only displayed in the physician review UI, the risk is limited to garbled display data rather than injection.

### F3.4: CSRF Status

**STILL NOT WIRED IN.** The CSRF module at `lib/security/csrf.ts` exists with full implementation (token generation, timing-safe validation, cookie-based double-submit pattern), but zero API routes import or use it. This was flagged in the Phase 4 review (Team F, WARNING) and remains unfixed.

**Risk assessment:** The application uses httpOnly cookies for authentication (JWT access token). All state-changing operations go through API routes. A CSRF attack would require:
1. The victim to be logged in (have valid httpOnly cookie)
2. The attacker to craft a cross-origin request to a state-changing endpoint
3. The browser to send the httpOnly cookie with the cross-origin request

Since the API routes check `Content-Type: application/json` (via `request.json()`) and browsers don't send JSON bodies for cross-origin form submissions, the risk is partially mitigated. However, this is not a complete defense -- a CORS misconfiguration could expose the API. The main risk is to the legacy `POST /api/intake` route which accepts form data without auth.

---

## Detailed Findings

### CRITICAL #1: PHI in sessionStorage via auto-save module

**File:** `lib/intake/auto-save.ts:53-66`
**Risk:** HIPAA violation -- unencrypted PHI in browser storage

The `saveDraftToLocalStorage()` function writes the full intake form draft to `sessionStorage` as plaintext JSON. The draft contains all PHI fields: name, DOB, phone, address, medical history, medications, psychiatric history, etc.

While the new `IntakeClient.tsx` does NOT use this function (it uses direct server-side auto-save), the module is still exported and available for import. The `createAutoSaveHandler()` function at line 293 also saves to sessionStorage as a "backup" after successful server save.

**Fix:** Delete `lib/intake/auto-save.ts` or remove all sessionStorage functions. The server-side auto-save in `IntakeClient.tsx` is the correct pattern.

### CRITICAL #2: No rate limiting on verify-email

**File:** `app/api/auth/verify-email/route.ts`
**Risk:** Unlimited token verification attempts

The `verify-token` endpoint was correctly rate-limited (fixed from previous review), but `verify-email` was not given the same treatment. Both endpoints perform token lookups and should have matching security controls.

**Fix:** Add `rateLimit(clientIp, rateLimitPresets.strict)` at the start of the GET handler, matching the pattern in `verify-token/route.ts:37-44`.

### CRITICAL #3: Double encryption in review route

**File:** `app/api/physician/review/route.ts:113-148`
**Risk:** Data corruption or unreadable clinical notes

Manual `encryptPHI()` calls on fields that are already in the Prisma encryption extension's PHI_FIELDS map. If the `isEncrypted()` idempotency check in the extension works correctly, data is encrypted once (by manual call, skipped by extension). If it doesn't, data is double-encrypted and becomes unreadable.

Additionally, `Prescription.instructions` is manually encrypted at line 148, but `Prescription.medicationName` is NOT manually encrypted at line 142. The extension encrypts both. This inconsistency suggests the manual encryption was added without awareness of the Prisma extension.

**Fix:** Remove all manual `encryptPHI()` calls from `app/api/physician/review/route.ts`. The Prisma extension handles encryption for `Review` and `Prescription` models. Verify this by checking that `isEncrypted()` correctly identifies already-encrypted output from `encryptPHI()`.

### CRITICAL #4: Weak auth on document sub-routes

**File:** `app/api/patient/documents/[id]/route.ts`, `[id]/download/route.ts`, `confirm/route.ts`, `upload-url/route.ts`
**Risk:** Header spoofing if middleware is bypassed

These 4 routes check `request.headers.get('x-user-id')` instead of calling `requireRole()`. The `x-user-id` header is set by middleware after JWT verification, but if middleware doesn't run (local dev, config error, or middleware matcher miss), these routes would accept any `x-user-id` value from the client.

**Fix:** Add `requireRole(request, [Role.PATIENT])` to all 4 routes, matching the pattern in the parent `documents/route.ts`.

---

## Recommendations (Priority Order)

### Must Fix Before Deploy

1. **CRITICAL #3:** Remove manual `encryptPHI()` from `app/api/physician/review/route.ts` -- verify Prisma extension handles encryption correctly
2. **CRITICAL #2:** Add rate limiting to `app/api/auth/verify-email/route.ts`
3. **CRITICAL #4:** Add `requireRole()` to 4 document sub-routes
4. **CRITICAL #1:** Delete or gut `lib/intake/auto-save.ts` to remove PHI browser storage functions

### Should Fix Soon

5. **WARNING #5:** Remove `medicationName` from REFILL_REQUESTED email template; replace with "Log in to view your refill request status"
6. **WARNING #6:** Either deprecate `POST /api/intake` (legacy) or add rate limiting + auth
7. **WARNING #7:** Add `opioidUse`, `opioidMaintenance` to safety step validation in IntakeClient.tsx line 1220
8. **WARNING #8:** Sanitize all 55+ `console.error('...:', error)` calls to log `error.message` only
9. **WARNING #9:** Wire CSRF protection into state-changing API routes (at minimum: login, register, intake submit)
10. **WARNING #10:** Remove manual `decryptPHI()` from profile GET route -- Prisma extension handles decryption
11. **WARNING #11:** Add runtime check for `STRIPE_WEBHOOK_SECRET` in webhook handler
12. **WARNING #12:** Remove `patientId` from `console.log` in notification service
13. **WARNING #13:** Add `currentMedications`, `seeingTherapist` to medical step validation

### Low Priority

14. **INFO #16:** Add `CONSENT_RECORDED` to `AuditEventType` enum
15. **INFO #17:** Remove or update stale `lib/intake/auto-save.ts` progress calculation (references old AUDIT-C fields)
16. **INFO #18:** Consider replacing `validation.data!` with optional chaining across 15 routes

---

## Positive Findings

- **Zero `as any` types** in application code (1 acceptable instance in Prisma debug listener)
- **Zero Zod v3 syntax** (`required_error`) -- all use v4 `{ message: '...' }`
- **Zero dead imports** from deleted hipaa/ modules
- **All `'use client'` directives** correctly placed
- **All import paths** use explicit sub-paths for `@/lib/audit` (Turbopack-safe)
- **Server-side auto-save** correctly implemented in IntakeClient (no browser PHI storage)
- **Email templates** mostly HIPAA-safe (18 of 20 templates direct to portal without clinical data)
- **Scoring engine** handles edge cases well (empty data, missing keys, wrong types)
- **Prisma encryption extension** comprehensive -- covers all PHI models and all CRUD operations
- **Transaction safety** in webhook and review submission routes
- **Previous CRITICAL fixes verified:** rate limiting on verify-token, audit logging on auth routes, auth on checkout-session, SQL injection fix, PHI removed from notification emails

---

## Risk Assessment

| Gate | Status | Notes |
|------|--------|-------|
| **F1 (HIPAA)** | **CONDITIONAL PASS** | 2 CRITICALs (auto-save PHI, double encryption), 3 WARNINGs |
| **F2 (Quality)** | **PASS** | Zero `any`, consistent patterns, well-structured components |
| **F3 (Security)** | **CONDITIONAL PASS** | 2 CRITICALs (missing rate limit, weak document auth), CSRF still unwired |

**Overall Recommendation:** **FIX FIRST** on the 4 CRITICAL items before production deployment. The double-encryption issue (#3) is the highest priority as it may cause data corruption for physician reviews.
