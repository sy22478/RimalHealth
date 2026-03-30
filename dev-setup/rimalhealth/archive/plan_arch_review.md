# Team H: Architecture Review of Master Plan (Sprint S4)

> **Date:** 2026-03-26
> **Reviewer:** Team H (System Architecture)
> **Documents Reviewed:** plan.md, tasks.md, conversation.md (Session 4), review_pm_consolidated.md, review_team_h_report.md
> **Verdict:** APPROVED WITH AMENDMENTS -- Plan is architecturally sound with 5 required amendments and 4 additions.

---

## 1. APPROVED ITEMS

The following plan elements are architecturally correct and require no changes.

**Phase 1 (P0 Fixes):** All 7 P0 items are correctly scoped, correctly prioritized as blocking, and have accurate file:line references. The fix strategies for SQL injection (P0-003), PHI in logs (P0-004), CI gates (P0-005), and migration ordering (P0-007) are sound.

**Phase 2A (Consent Page):** Clearing the Netlify cache and splitting consent items is straightforward. The 6-item consent checklist matches the user's requirements.

**Phase 2B.1 (Receipt Email):** Sending `PAYMENT_RECEIPT` before `CREATE_ACCOUNT` in the webhook is the correct ordering. The template enum already exists.

**Phase 2B.5 (Webhook Transaction):** Wrapping User + PatientProfile + Subscription in `prisma.$transaction()` is the right fix. The Prisma schema supports this without changes.

**Phase 2D.1 (Form Audit):** The plan correctly identifies that the 7-section, 34-question structure already exists in `IntakeClient.tsx`. The plan correctly identifies the redundant personal info and consent fields that need removal.

**Phase 2E (Doctor Review):** The Intake model already has the correct `IntakeStatus` enum (DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, NEEDS_INFO, EXPIRED). The Review model already has `contraindications Json?` and `clinicalNotes String?` fields. No schema changes are needed for the review flow.

**Phase 4 (P1 Fixes):** All P1 items are correctly categorized and have accurate references. Parallel execution with Phase 2-3 is appropriate.

---

## 2. AMENDMENTS (Changes Required to Plan)

### AMENDMENT 1: Intake Gate -- Do NOT Use Middleware (Task 4.1)

**Plan says:** Add intake completion check to `middleware.ts` for PATIENT role, with JWT claim option.

**Problem:** Next.js Edge Middleware cannot make database queries. The `middleware.ts` runs in the Edge Runtime, which does not support Node.js APIs like Prisma. The plan's "Option B (API check)" is not feasible in middleware. Option A (JWT claim) is feasible but introduces stale-state risk and requires JWT re-issuance after intake submission, adding complexity to a critical path.

**Amendment:** Implement the intake gate as a **client-side redirect in the patient layout**, not in middleware. Specifically:

1. In `app/patient/layout.tsx`, add a server component that queries the user's latest intake status via Prisma.
2. If no intake with status >= SUBMITTED exists, use `redirect('/intake')` (Next.js server-side redirect from `next/navigation`).
3. This runs on every patient page load as a server component, is always current (no stale JWT), and uses the same Prisma client available to all server components.
4. Keep `/intake` outside the patient layout (it already is -- it lives at `app/intake/`), so it is not subject to the gate.

This is simpler, always accurate, and does not require JWT modification. The middleware should only add `/create-account` and `/verify-email` to `PUBLIC_ROUTES` -- it should NOT contain intake-checking logic.

**Task impact:** Rewrite Task 4.1 entirely. Remove subtasks 4.1.1-4.1.5. Replace with: "Add intake completion check to `app/patient/layout.tsx` using server-side Prisma query + redirect."

### AMENDMENT 2: Email Verification -- Use Existing PasswordReset Model for Tokens (Tasks 3.4.1-3.4.3)

**Plan says:** "Generate email verification token" but does not specify the storage mechanism.

**Problem:** The plan omits where verification tokens are stored. Creating a new `EmailVerificationToken` model would require a migration. This is unnecessary.

**Amendment:** Reuse the existing `PasswordReset` model for email verification tokens. This model already has: `id`, `userId`, `token` (unique, indexed), `expiresAt`, `usedAt`, `createdAt`. This is exactly the structure needed for a one-time-use, expiring verification token. Differentiate by adding a `type` field or by convention (use a token prefix like `ev_` vs `pr_`).

Preferred approach: Add an optional `type String? @default("password_reset")` column to `PasswordReset` (one migration) and filter by type. This keeps the schema clean and avoids confusion.

Alternatively, to avoid any migration: use the existing `PasswordReset` model as-is and identify verification tokens by a naming convention in the token itself (e.g., `verify-${uuid}`). The `GET /api/auth/verify-email` route checks that the token starts with `verify-` before processing. This is pragmatic but less clean.

**Task impact:** Add a subtask to Task 3.4: "3.4.0: Decide on token storage -- reuse PasswordReset model with type field (requires 1 migration) or use token prefix convention (no migration)."

### AMENDMENT 3: Email Verification Gate -- Existing Login Check is Gated by Env Var (Task 3.4.7)

**Plan says:** "Update login route to check `emailVerified` flag. If false, reject login."

**Problem:** The login route at `app/api/auth/login/route.ts` line 383 already checks `emailVerified`, but it is gated behind `process.env.REQUIRE_EMAIL_VERIFICATION === 'true'`. Currently this env var is set to `false` in the example env. The plan does not mention enabling this variable.

**Amendment:** Task 3.4.7 must include: "Set `REQUIRE_EMAIL_VERIFICATION=true` in Netlify production env vars AND in `.env.example`." Without this, the email verification flow is built but never enforced, and users can log in with unverified emails, defeating the purpose.

**Task impact:** Add subtask 3.4.9: "Set REQUIRE_EMAIL_VERIFICATION=true in Netlify env vars and .env.example."

### AMENDMENT 4: DSM-5 Scoring -- Scoring Engine Already Has Partial DSM-5 Support (Task 5.2)

**Plan says:** "Rebuild Scoring Engine (DSM-5 Instead of AUDIT-C)."

**Problem:** The scoring engine at `lib/intake/scoring.ts` lines 269-292 already detects DSM-5 format (`dsm5Q1`-`dsm5Q11`), counts Yes answers, and maps the DSM-5 symptom count to an AUDIT-C equivalent score. The plan characterizes this as "AUDIT-C only" which is inaccurate. The existing `calculateIntakeScores()` function handles both formats.

**Amendment:** Task 5.2 should be scoped as an **enhancement**, not a rebuild:
1. Add a dedicated `calculateDSM5Score()` that returns `{ score, severity, meetsCriteria }` with the correct severity thresholds (0-1, 2-3, 4-5, 6+). This is an ADD, not replacing the existing code.
2. Add `detectContraindications()` and `generateProviderDecisionSummary()` as new functions.
3. Do NOT remove or rewrite the existing `calculateIntakeScores()` -- it is a working orchestrator. Instead, have the intake submit handler call both the existing scoring AND the new DSM-5 functions.
4. The `riskScore Int?` field on the Intake model (range 0-100) is sufficient for the DSM-5 score since DSM-5 yields 0-11. Store the raw DSM-5 count in `formData` JSON and the mapped 0-100 risk score in `riskScore`.

**Task impact:** Rename Task 5.2 from "Rebuild Scoring Engine" to "Extend Scoring Engine with DSM-5 Functions." Keep subtasks 5.2.1-5.2.7 but adjust scope.

### AMENDMENT 5: Rename Route Needs Redirect (Task 3.3)

**Plan says:** Rename `/set-password` to `/create-account`.

**Problem:** Existing users who received "Set Password" emails before this change will have links pointing to `/set-password`. If we remove the route entirely, those links break.

**Amendment:** Keep `/set-password` as a redirect to `/create-account` for backward compatibility. In `app/(auth)/set-password/page.tsx`, replace the full page component with a simple redirect component:
```
redirect(`/create-account?${searchParams.toString()}`)
```
This ensures old email links continue to work. The redirect can be removed in a future sprint after the token expiry window passes (e.g., 72 hours).

**Task impact:** Add subtask 3.3.8: "Add redirect from /set-password to /create-account for backward compatibility with existing emails."

---

## 3. ADDITIONS (Missing Tasks)

### ADDITION 1: Consent Record Storage (Missing from Plan)

**Problem:** The consent page captures user agreement to 6 items (age, residency, terms, consent to treatment, HIPAA, privacy), but there is no backend storage for consent records. The plan (Phase 2A) only addresses the UI -- there is no task to persist WHAT the user consented to, WHEN they consented, or from WHAT IP address.

**Why it matters:** For HIPAA compliance and legal defensibility, you must have a durable record of informed consent. A checkbox on a page that feeds into a Stripe redirect with no server-side persistence is not sufficient. If a patient disputes that they consented to treatment, there is no evidence.

**Recommended addition:**
1. Create a `ConsentRecord` model in Prisma: `id`, `email` (pre-account, so can't use userId yet), `stripeSessionId`, `items Json` (array of consented items with versions), `ipAddress String?`, `userAgent String?`, `consentedAt DateTime`, `createdAt DateTime`.
2. Create `POST /api/consent/record` (public endpoint) called from the consent page before redirecting to Stripe.
3. After account creation, link the `ConsentRecord` to the user by matching on email or Stripe session ID.

This is a small schema addition but a critical compliance requirement.

### ADDITION 2: Database Migration Plan (Missing from Plan)

**Problem:** Multiple amendments above require schema changes: (a) `PasswordReset.type` field for email verification tokens, (b) potentially a `ConsentRecord` model, (c) possibly `providerSummary Json?` on the Intake model (mentioned in plan 2D.5 but no migration task exists). The plan does not include an explicit migration task or a migration review step.

**Recommended addition:** Add a task "Create and review Prisma migration for Sprint S4 schema changes" between Phase 1 and Phase 2. List all schema changes in one migration to avoid migration proliferation. Run `npm run db:generate && npm run db:migrate` as a named task with Team F review.

### ADDITION 3: Token Expiry and One-Time-Use Enforcement for Create Account Tokens (Missing from Plan)

**Problem:** The plan (Task 2B.3) describes the account creation page but does not specify the security properties of the create-account token. The existing `PasswordReset` model has `expiresAt` and `usedAt` fields, which is good. However, the plan does not explicitly require:
- Token expiry window (recommend 72 hours for create-account, matching typical email delivery delays)
- One-time use (set `usedAt` after successful account creation; reject if already used)
- Token invalidation on password set (mark as used immediately)
- Rate limiting on the `POST /api/auth/reset-password` endpoint when used for account creation

**Recommended addition:** Add subtasks under Task 3.3:
- "Enforce 72-hour expiry for create-account tokens"
- "Mark token as used (set `usedAt`) immediately after successful password set"
- "Reject tokens where `usedAt` is not null"
- "Add rate limiting (5 attempts per token per hour) to prevent brute-force"

### ADDITION 4: Rollback Strategy for Flow Redesign (Missing from Plan)

**Problem:** The risk register mentions individual risks but does not define a rollback strategy for the overall flow redesign. If the new consent -> payment -> create-account -> verify -> login -> intake flow breaks in production, there is no documented way to revert.

**Recommended addition:** Before deploying Phase 2 changes:
1. Tag the current production commit as `pre-s4-flow-redesign`.
2. Document the Netlify deploy ID that is currently live.
3. If rollback is needed: `netlify deploy --prod --alias pre-s4` using the tagged build.
4. Keep the `REQUIRE_EMAIL_VERIFICATION` env var as the kill switch -- setting it to `false` bypasses the verification requirement without code changes.
5. The intake gate in the patient layout can be bypassed by deploying the previous layout.tsx.

---

## 4. RISKS AND MITIGATIONS

### RISK 1: Middleware Intake Gate Creates Edge Runtime Errors (HIGH if not amended)
- **Likelihood:** HIGH (if implemented as plan specifies)
- **Impact:** CRITICAL -- middleware crash breaks ALL routes
- **Mitigation:** See Amendment 1. Use server component redirect in patient layout instead.

### RISK 2: Email Verification Increases Drop-Off Rate
- **Likelihood:** MEDIUM
- **Impact:** MEDIUM -- fewer patients complete onboarding
- **Mitigation:** Make verification email clear and simple. Include a "Resend" button on the login error page. Consider a 24-hour grace period where login works without verification (show a warning banner instead of blocking). This can be tuned post-launch via the `REQUIRE_EMAIL_VERIFICATION` env var.

### RISK 3: Consent Page Has No Server-Side Persistence
- **Likelihood:** HIGH (it is currently the case)
- **Impact:** HIGH -- legal and HIPAA compliance gap
- **Mitigation:** See Addition 1. Store consent records server-side before Stripe redirect.

### RISK 4: Existing Set-Password Email Links Break
- **Likelihood:** MEDIUM (depends on how many users are in the pipeline)
- **Impact:** LOW-MEDIUM -- affected users cannot create accounts
- **Mitigation:** See Amendment 5. Keep /set-password as a redirect.

### RISK 5: Sprint Scope Creep -- 5 Days May Be Insufficient
- **Likelihood:** HIGH
- **Impact:** MEDIUM -- incomplete sprint
- **Mitigation:** Strictly prioritize: P0 fixes (Day 1) are non-negotiable. Flow alignment (Days 2-3) is the core deliverable. UI/UX (Days 4-5) can be partially deferred. If time is short, defer Tasks 8 (UI/UX overhaul) and 7 (portal enhancements) to next sprint. The flow must work correctly before it looks beautiful.

---

## Summary

| Category | Count | Details |
|----------|-------|---------|
| APPROVED | 8 items | P0 fixes, consent UI, receipt email, webhook transaction, form audit, review flow, P1 fixes, schema adequacy |
| AMENDMENTS | 5 | Intake gate location, token storage, env var activation, scoring scope, route redirect |
| ADDITIONS | 4 | Consent record storage, migration plan, token security spec, rollback strategy |
| RISKS | 5 | Edge runtime crash (HIGH), drop-off rate, consent persistence, link breakage, scope creep |

The plan is structurally sound and correctly interprets the user's authoritative flow. The most critical amendment is **Amendment 1** (intake gate implementation location) -- implementing it in Edge Middleware as planned will cause runtime errors. The most critical addition is **Addition 1** (consent record storage) -- without it, there is no legal record of patient consent.
