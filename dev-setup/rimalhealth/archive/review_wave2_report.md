# Team F: Wave 1 + Wave 2 Code Review Report

> **Reviewer:** Team F (Code Review)
> **Date:** 2026-03-25
> **Scope:** All files changed in Wave 1 (P0 fixes, consent page) and Wave 2 (post-payment flow, intake gate + form)
> **Files Reviewed:** 27

---

## Overall Risk Assessment

| Gate | Status | Notes |
|------|--------|-------|
| **F1 (HIPAA)** | CONDITIONAL PASS | 2 WARNINGs, no critical PHI leaks |
| **F2 (Quality)** | PASS | Zero `any`, zero Zod v3 syntax, all `'use client'` correct |
| **F3 (Security)** | CONDITIONAL PASS | 2 CRITICALs (missing rate limit + audit), 2 WARNINGs |

**Recommendation:** FIX FIRST on the 2 CRITICAL items before deploying to production.

---

## Findings

### CRITICAL

| # | Severity | File:Line | Category | Issue | Fix |
|---|----------|-----------|----------|-------|-----|
| 1 | CRITICAL | `app/api/auth/verify-token/route.ts` (entire file) | F3-Security | **No rate limiting.** This endpoint returns user email addresses given a token. An attacker can brute-force tokens at unlimited speed. Other auth endpoints (`send-verification`, `reset-password`, `login`) all have rate limiting -- this one was missed. | Add `rateLimit(clientIp, rateLimitPresets.strict)` at the top of the handler, matching the pattern in `send-verification/route.ts:28-35`. |
| 2 | CRITICAL | `app/api/auth/verify-token/route.ts` (entire file) + `app/api/auth/verify-email/route.ts` (entire file) | F1-HIPAA / F3-Security | **No audit logging.** Both new auth endpoints perform security-sensitive operations (token lookup, email verification) but neither calls `auditLogger`, `auditPasswordEvent`, or `AuditService`. `verify-email` does have audit logging for the success path (line 111) but none for failed attempts (invalid token, expired token, used token). `verify-token` has zero audit logging anywhere. HIPAA requires logging all access to user records. | Add `auditPasswordEvent` calls on both success and failure paths in `verify-token/route.ts`. Add audit logging for failed verification attempts in `verify-email/route.ts` (lines 61, 69, 85). |

### WARNING

| # | Severity | File:Line | Category | Issue | Fix |
|---|----------|-----------|----------|-------|-----|
| 3 | WARNING | `app/api/auth/login/route.ts:395` | F1-HIPAA | **User email returned in API response.** The `EMAIL_NOT_VERIFIED` error response includes `email: user.email`. While this is needed for the client's "resend verification" flow, it confirms email existence to an attacker who has already passed the password check. This is a design tradeoff (not a raw leak), but it should be documented as an accepted risk. | Document as accepted risk. Alternatively, the client could pass the email it already has from the login form rather than relying on the server response. |
| 4 | WARNING | `app/api/auth/verify-email/route.ts:124`, `app/api/auth/verify-token/route.ts:65`, `app/api/auth/send-verification/route.ts:94`, `app/api/physician/patients/route.ts:126` | F1-HIPAA | **Raw `error` object logged to console.** These `console.error('...:', error)` calls log the full error object, which may include Prisma query details or stack traces containing PHI field names/values. The P0-004 fix removed email from console logs in Stripe routes, but these new/modified routes re-introduce the pattern. | Replace `console.error('[tag] Error:', error)` with `console.error('[tag] Error:', error instanceof Error ? error.message : 'Unknown error')` to avoid logging full stack traces that might contain PHI. |
| 5 | WARNING | `app/api/auth/send-verification/route.ts` (entire file) | F1-HIPAA | **No audit logging for verification email sends.** This endpoint creates a PasswordReset record and sends an email but never logs the action to the audit trail. HIPAA requires tracking who requested what and when. | Add `auditPasswordEvent(AuditEventType.PASSWORD_RESET_REQUESTED, user.id, auditContext)` or a new event type after the email is sent. |
| 6 | WARNING | `app/api/webhooks/stripe/route.ts:58` | F3-Security | **`webhookSecret` uses non-null assertion at module level.** `const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;` will be `undefined` at runtime if the env var is missing, but TypeScript won't catch it. This was pre-existing but worth noting since this file was modified. | Add a runtime check: `if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is required');` at the start of the POST handler, or use the lazy-import pattern like the rest of the file. |
| 7 | WARNING | `app/intake/IntakeClient.tsx` (entire file) | F2-Quality | **`opioidUse` and `opioidMaintenance` not validated in `validateCurrentStep`.** The `safety` step validation (line 1220) only includes `['liverCondition', 'liverTests', 'pregnancyStatus', 'drugAllergies']` but omits `opioidUse`, `opioidMaintenance`. A user can skip these critical safety questions (which detect absolute contraindications) and proceed to the next section. | Add `'opioidUse', 'opioidMaintenance'` to the `safety` array in `stepFields` at line 1220. |
| 8 | WARNING | `.github/workflows/deploy.yml:157` | F2-Quality | **Netlify deploy uses `--dir=.next` which is the old pattern.** For Next.js on Netlify with the `@netlify/plugin-nextjs` adapter, the standard is `netlify deploy --build --prod` (letting Netlify handle the build output). The `--dir=.next` flag may work but can cause issues with serverless functions and ISR. This was flagged in previous CLAUDE.md guidance. | Verify this deploy command works end-to-end. If Netlify CLI rejects it, switch to `netlify deploy --prod --build` and remove the explicit `--dir` flag. |

### INFO

| # | Severity | File:Line | Category | Issue | Notes |
|---|----------|-----------|----------|-------|-------|
| 9 | INFO | `app/checkout/consent/page.tsx:149-150` | F1-HIPAA | `sessionStorage.setItem('consentRecordId', ...)` stores a UUID consent ID in browser storage. | ACCEPTABLE -- the value is a random UUID (not PHI). The code also handles sessionStorage being unavailable. |
| 10 | INFO | `app/intake/IntakeClient.tsx` (entire file) | F1-HIPAA | Intake form correctly avoids `localStorage`/`sessionStorage` for PHI. Auto-save goes to the server (`/api/patient/intake`) every 30 seconds. | GOOD -- this resolves the PHI-in-sessionStorage issue flagged in the prior review. |
| 11 | INFO | `app/api/checkout/consent/route.ts` | F3-Security | Consent endpoint is public (no auth required) by design -- users consent before creating an account. It has rate limiting and Zod validation. It writes to AuditLog directly (not via `auditLogger`), using `eventType: 'CONSENT_RECORDED'` which is not in the `AuditEventType` enum. | The string literal works at the Prisma level but bypasses type safety. Consider adding `CONSENT_RECORDED` to the `AuditEventType` enum for consistency. Low priority. |
| 12 | INFO | `app/api/webhooks/stripe/route.ts:203-283` | F3-Security | Transaction safety implemented as required by P1-002 fix. All DB writes (User, PatientProfile, Subscription, PasswordReset) now wrapped in `prisma.$transaction()`. | GOOD -- resolves the orphan-record risk. |
| 13 | INFO | `app/api/webhooks/stripe/route.ts:297-308` | F1-HIPAA | Payment receipt email sent to `customerEmail` with `firstName: 'there'` (generic). No PHI in the email body or subject. | GOOD -- matches the P0-002 fix requirement. |
| 14 | INFO | `app/api/intake/route.ts:54-63` | F1-HIPAA | Physician notification email now says "New Intake Submitted -- Please Review" with no patient name, email, or medical data. | GOOD -- P0-002 fix verified. The patient confirmation email (line 67-88) uses generic "Hello" greeting without patient name. |
| 15 | INFO | `app/api/physician/patients/route.ts:61-69` | F3-Security | SQL injection fix verified. Uses `prisma.patientProfile.findMany()` with type-safe Prisma queries instead of `$queryRaw`. Zod validation via `patientsQuerySchema`. | GOOD -- P0-003 fix verified. |
| 16 | INFO | `app/api/stripe/checkout-session/route.ts:313-401` | F3-Security | GET endpoint now requires authentication (line 331) and ownership verification (line 371). No tokens or customer emails in response. | GOOD -- P0-001 fix verified. |
| 17 | INFO | `app/patient/layout.tsx` | F2-Quality | Intake gate correctly implemented as server component with `export const dynamic = 'force-dynamic'` and Prisma access. Per Team H Amendment #1, this avoids Edge Middleware (which cannot run Prisma). | GOOD -- architecture pattern correct. |
| 18 | INFO | `middleware.ts:37-38` | F3-Security | `/create-account` and `/verify-email` correctly added to `PUBLIC_ROUTES`. | GOOD -- new pages are accessible without authentication as intended. |
| 19 | INFO | `lib/audit/types.ts:27` | F2-Quality | `EMAIL_VERIFIED = 'email_verified'` added to `AuditEventType` enum. Used by `verify-email/route.ts`. | GOOD -- type-safe audit event. |
| 20 | INFO | `lib/notifications/templates.ts:35-36` | F2-Quality | `CREATE_ACCOUNT` and `EMAIL_VERIFICATION` templates added to `EmailTemplate` enum. Both templates have generic subjects ("Create Your Account", "Verify Your Email Address") with no PHI. | GOOD -- F1-08 (no PHI in email subjects) verified. |
| 21 | INFO | `app/(auth)/set-password/page.tsx` | F2-Quality | Clean redirect to `/create-account` preserving query params. Has `'use client'` directive and Suspense boundary. | GOOD -- backward compatibility maintained. |
| 22 | INFO | `lib/intake/scoring.ts` | F2-Quality | Four new scoring functions added: `calculateDSM5Score`, `detectContraindications`, `assessWithdrawalRisk`, `generateProviderDecisionSummary`. All use `Record<string, unknown>` (no `any`). Pure functions with no side effects. | GOOD -- type-safe, no PHI logging. |
| 23 | INFO | `lib/intake/index.ts` | F2-Quality | Barrel export updated with all new scoring functions and types. Import paths use explicit `./scoring` (not bare `@/lib/intake`). | GOOD -- Turbopack-safe. |
| 24 | INFO | `app/api/patient/intake/[id]/submit/route.ts` | F1-HIPAA | Calls `generateProviderDecisionSummary()` and stores result in `formData._providerDecisionSummary` (auto-encrypted via Prisma extension). Has auth check, ownership verification, audit logging, and physician notification. | GOOD -- comprehensive HIPAA coverage. |
| 25 | INFO | All changed files | F2-Quality | Zero instances of `any` type. Zero instances of Zod v3 `required_error` syntax. All client components have `'use client'` directive. All import paths use explicit sub-paths for `@/lib/audit` (Turbopack-safe). | GOOD -- full quality compliance. |

---

## Summary by File

### P0 Fixes (Wave 1)

| File | Verdict | Notes |
|------|---------|-------|
| `app/api/stripe/checkout-session/route.ts` | PASS | Auth + ownership check added. No PHI in responses. |
| `app/api/webhooks/stripe/route.ts` | PASS (with WARNING #6) | Transaction safety added. No PHI in logs. Module-level `!` assertion on webhook secret. |
| `app/api/intake/route.ts` | PASS | No PHI in notification emails. Generic error messages. |
| `app/api/physician/patients/route.ts` | PASS (with WARNING #4) | SQL injection fixed. Raw error object in console.error. |
| `app/checkout/success/CheckoutSuccessClient.tsx` | PASS | No API calls, no PHI displayed, no tokens exposed. |
| `.github/workflows/deploy.yml` | PASS (with WARNING #8) | `continue-on-error` removed from lint/typecheck/test. Migrations before deploy. Deploy dir flag questionable. |

### Post-Payment Flow (Wave 2)

| File | Verdict | Notes |
|------|---------|-------|
| `app/(auth)/create-account/page.tsx` | PASS | Token-based, read-only email, Zod validation, `'use client'`, Suspense boundary. |
| `app/(auth)/set-password/page.tsx` | PASS | Clean redirect preserving query params. |
| `app/(auth)/verify-email/page.tsx` | PASS | No PHI displayed. Auto-redirect to login. |
| `app/api/auth/verify-email/route.ts` | CONDITIONAL (CRITICAL #2) | Missing audit logging on failure paths. |
| `app/api/auth/send-verification/route.ts` | CONDITIONAL (WARNING #5) | Has rate limiting. Missing audit logging entirely. |
| `app/api/auth/verify-token/route.ts` | FAIL (CRITICAL #1, #2) | No rate limiting. No audit logging. |
| `app/api/auth/login/route.ts` | PASS (with WARNING #3) | Email verification check added. Email in response is accepted risk. |
| `app/api/auth/reset-password/route.ts` | PASS | No longer sets `emailVerified=true`. Correct separation of concerns. |
| `lib/notifications/templates.ts` | PASS | CREATE_ACCOUNT + EMAIL_VERIFICATION templates. No PHI in subjects. |
| `lib/audit/types.ts` | PASS | EMAIL_VERIFIED event type added. |
| `middleware.ts` | PASS | `/create-account`, `/verify-email` added to PUBLIC_ROUTES. |

### Intake Gate + Form (Wave 2)

| File | Verdict | Notes |
|------|---------|-------|
| `app/patient/layout.tsx` | PASS | Server component intake gate. Correct architecture. |
| `app/patient/PatientLayoutClient.tsx` | PASS | Client component with sidebar. `'use client'` present. |
| `app/intake/IntakeClient.tsx` | PASS (with WARNING #7) | 7-section form, 34 questions, server-side auto-save, no browser PHI storage. Missing validation for opioid fields. |
| `lib/intake/scoring.ts` | PASS | 4 new scoring functions. Type-safe, no side effects. |
| `lib/intake/index.ts` | PASS | Barrel export updated. |
| `app/api/patient/intake/[id]/submit/route.ts` | PASS | Auth, ownership, audit logging, scoring, physician notification all present. |

### Consent Page (Wave 1)

| File | Verdict | Notes |
|------|---------|-------|
| `app/checkout/consent/page.tsx` | PASS | 7 consent items. Only UUID stored in sessionStorage. |
| `app/api/checkout/consent/route.ts` | PASS (INFO #11) | Rate limited, Zod validated. String literal eventType instead of enum. |

---

## Action Items (Ordered by Priority)

1. **[CRITICAL]** Add rate limiting to `app/api/auth/verify-token/route.ts`
2. **[CRITICAL]** Add audit logging to `app/api/auth/verify-token/route.ts` (all paths) and `app/api/auth/verify-email/route.ts` (failure paths)
3. **[WARNING]** Add audit logging to `app/api/auth/send-verification/route.ts`
4. **[WARNING]** Sanitize `console.error` calls in new auth routes to avoid logging raw error objects
5. **[WARNING]** Add `opioidUse` and `opioidMaintenance` to the `safety` step validation in IntakeClient.tsx
6. **[WARNING]** Add runtime check for `STRIPE_WEBHOOK_SECRET` in webhook handler
7. **[WARNING]** Verify Netlify deploy command works with `--dir=.next` flag
8. **[INFO]** Add `CONSENT_RECORDED` to `AuditEventType` enum for type safety
