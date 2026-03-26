# RimalHealth -- Master Implementation Plan

> **Created:** 2026-03-26
> **Sprint:** S4 -- App Flow Redesign + Security Fixes + UI/UX
> **Source of Truth:** `conversation.md` Session 4 (user-defined app flow is AUTHORITATIVE)
> **Mutable:** YES -- teams update status as work completes

---

## Sprint Overview

**Sprint Goal:** Fix all critical security vulnerabilities, align the codebase to the user's authoritative app flow (consent -> payment -> account creation -> email verification -> login -> mandatory intake -> doctor review -> portal), redesign the intake form to match the AUD Naltrexone PDF (34 questions, 7 sections, DSM-5 format), and deliver a polished UI/UX inspired by godly.website.

**Duration Estimate:** 5 working days

**Team Assignments:**

| Phase | Teams | Focus |
|-------|-------|-------|
| Phase 1: P0 Critical Fixes | A (Execution), D (DevOps), F (Code Review) | Security vulnerabilities, CI/CD, credential rotation |
| Phase 2: App Flow Alignment | A (Execution), B (Backend), C (Frontend) | Consent, payment, account creation, verification, intake gate |
| Phase 3: Intake Form Redesign | C (Frontend), B (Backend) | 34-question form, DSM-5 scoring, contraindication flags |
| Phase 4: Doctor Review Flow | B (Backend), C (Frontend) | Physician queue, approve/decline, patient notifications |
| Phase 5: UI/UX Overhaul | C (Frontend), E (Design) | Landing, consent, intake wizard, portals -- godly.website inspiration |
| Phase 6: Testing & QA | F (Code Review), G (Debugging) | E2E tests, HIPAA verification, deploy verification |

---

## Phase 1: P0 Critical Fixes (Day 1)

**BLOCKING: No other work begins until all P0 issues are resolved and reviewed by Team F.**

### P0-001: Unauthenticated GET /api/stripe/checkout-session

**File:** `app/api/stripe/checkout-session/route.ts` (line 308, `GET` handler)
**Problem:** No authentication check. Anyone with a Stripe session ID can retrieve customer emails, set-password tokens, and trigger account creation.
**Fix:**
1. Add `requireAuth` or `requireRole` check at the top of the `GET` handler (line 308-310).
2. If the GET is only needed by the checkout success page (which is public), consider splitting into two endpoints: one public (returns only payment status) and one authenticated (returns user details).
3. Remove the `setPasswordToken` from the GET response entirely -- it should never be exposed via API.

### P0-002: PHI in Plaintext Email via POST /api/patient/intake

**File:** `app/api/patient/intake/route.ts`
**Problem:** When intake is submitted, the notification email to the clinical team includes full PHI (name, email, phone, medical conditions, medications) in plaintext.
**Fix:**
1. Remove all PHI from email body in the notification to physicians.
2. Replace with: "A new intake has been submitted. Please log in to the physician portal to review."
3. Include only the intake ID and a link to the review page -- no patient name, no medical details.
4. Add audit logging for the intake creation event.

### P0-003: SQL Injection in Physician Patients Route

**File:** `app/api/physician/patients/route.ts` (lines 83-91)
**Problem:** `$queryRaw` uses string interpolation for the `search`, `limit`, and `offset` parameters. Direct injection point.
**Fix:**
1. Replace `$queryRaw` with `Prisma.sql` tagged template using parameterized values.
2. Use `Prisma.sql` for the WHERE clause conditionally:
   ```typescript
   const patients = await prisma.$queryRaw(
     Prisma.sql`SELECT ... FROM patient_profiles pp JOIN users u ON u.id = pp.user_id
     WHERE (${search}::text IS NULL OR pp.first_name ILIKE ${'%' + search + '%'} ...)
     ORDER BY pp.last_name ASC LIMIT ${limit} OFFSET ${offset}`
   );
   ```
3. Or better: rewrite using Prisma Client `.findMany()` with `where` clauses instead of raw SQL.

### P0-004: Patient Emails Logged to Console

**Files:**
- `app/api/stripe/checkout-session/route.ts` (line 448) -- logs email on set-password failure
- `app/api/webhooks/stripe/route.ts` (line 294) -- logs email on create-account email failure
**Fix:**
1. Replace `console.error(..., customerEmail, ...)` with `console.error('[Stripe] Failed to send email for session', sessionId)`.
2. Never include the email address in log output. Use the Stripe session ID or user ID (non-PHI) for correlation.

### P0-005: CI Quality Gates Disabled

**File:** `.github/workflows/deploy.yml` (lines 68, 72, 76, 85, 109)
**Problem:** `continue-on-error: true` on lint, type-check, unit tests, integration tests, and npm audit. Broken code deploys to production.
**Fix:**
1. Remove `continue-on-error: true` from lint step (line 68).
2. Remove `continue-on-error: true` from type-check step (line 72).
3. Remove `continue-on-error: true` from unit tests step (line 76).
4. Remove `continue-on-error: true` from integration tests step (line 85).
5. Keep `continue-on-error: true` ONLY for npm audit (line 109) -- advisory, not blocking.
6. Also remove from `.github/workflows/ci.yml` line 46 (prettier) -- make formatting required.

### P0-006: Production Secrets in Settings File

**File:** `.claude/settings.local.json` (lines 31, 64-65)
**Problem:** Neon DB password and Netlify auth token hardcoded in committed file.
**Fix:**
1. **IMMEDIATE:** Rotate Netlify auth token in Netlify dashboard.
2. **IMMEDIATE:** Rotate Neon DB password in Neon dashboard. Update `DATABASE_URL` in Netlify env vars and `.env.local`.
3. Replace `.claude/settings.local.json` with a clean version (no credentials).
4. Add `.claude/settings.local.json` to `.gitignore` if not already present.

### P0-007: DB Migrations Run After Deploy

**File:** `.github/workflows/deploy.yml`
**Problem:** Migrations run AFTER the Netlify deploy step. If a migration fails, the live site references non-existent schema.
**Fix:**
1. Move the DB migration step (`npm run db:deploy`) to run BEFORE the Netlify deploy step.
2. Add a rollback step: if migration fails, do not deploy.
3. Add a health check after migration to verify schema consistency.

### P0 Review Gate

After all P0 fixes are committed, Team F runs `/code-review` and `/security-scan` before any deploy. No exceptions.

---

## Phase 2: App Flow Alignment (Days 2-4)

The current codebase flow differs from the user's authoritative flow in several critical ways. This phase brings them into alignment.

### 2A: Fix Consent Page (ChunkLoadError on Production)

**Current State:** `/checkout/consent` shows "Something went wrong" with ChunkLoadError due to stale Netlify deploy referencing non-existent static chunk files.
**File:** `app/checkout/consent/page.tsx`

**Tasks:**
1. Clear Netlify cache and redeploy to fix stale chunks.
2. Enhance consent page with all 6 required agreement items:
   - Age confirmation (18+) -- EXISTS
   - California residency -- EXISTS
   - Terms and Conditions agreement (with link to `/terms`) -- EXISTS (combined with privacy)
   - Consent to Treatment form -- EXISTS as "telehealth consent" but needs to be a separate explicit treatment consent item
   - HIPAA Privacy Practices agreement (with link to `/hipaa`) -- EXISTS
   - Privacy Policy agreement (with link to `/privacy`) -- EXISTS (combined with terms)
3. Split the current combined "Privacy Policy and Terms of Service" item into two separate items.
4. Add a dedicated "Consent to Treatment" item (separate from telehealth consent).
5. Ensure all links open in new tabs.
6. Keep "Continue to Payment" button disabled until all items are checked.

### 2B: Post-Payment Flow Redesign

**Current State:** After Stripe payment, webhook creates User (random password) and sends a single "Set Password" email. User sets password and goes to login.
**Desired State:** After Stripe payment, user receives TWO emails: (1) Receipt email, (2) "Create Account" email. Account creation includes email + password. Then email verification. Then redirect to login.

**Tasks:**

#### 2B.1: Receipt Email After Payment
**File:** `app/api/webhooks/stripe/route.ts`
1. After successful `checkout.session.completed`, send `EmailTemplate.PAYMENT_RECEIPT` email (already exists in template enum).
2. Include: amount paid, plan name, date, next billing date. NO PHI.
3. Send BEFORE the account creation email.

#### 2B.2: Rename "Set Password" to "Create Account"
**Files:** `lib/notifications/templates.ts`, `app/api/webhooks/stripe/route.ts`
1. Add new `EmailTemplate.CREATE_ACCOUNT` enum value (or repurpose `SET_PASSWORD`).
2. Update email template content: subject = "Create Your Rimal Health Account", body includes link to account creation page.
3. Update webhook to send `CREATE_ACCOUNT` instead of `SET_PASSWORD`.

#### 2B.3: Account Creation Page (Email + Password)
**File:** `app/(auth)/set-password/page.tsx` (rename to `app/(auth)/create-account/page.tsx`)
1. Rename route from `/set-password` to `/create-account`.
2. Add email field (pre-filled from token but editable? -- No, read-only from token for security).
3. Display email as read-only confirmation.
4. Keep password + confirm password fields.
5. On submit: create account via API, then trigger email verification.
6. Update `PUBLIC_ROUTES` in `middleware.ts` to include `/create-account` (remove `/set-password` if fully replaced).

#### 2B.4: Email Verification Flow
**Files:** `app/api/auth/` (new route), `app/(auth)/verify-email/page.tsx` (new page)
1. After account creation, generate email verification token and send verification email using `EmailTemplate.EMAIL_VERIFICATION` (already exists in enum).
2. Create `GET /api/auth/verify-email?token=xxx` -- verifies token, sets `emailVerified: true`.
3. Create `app/(auth)/verify-email/page.tsx` -- displays "Verifying..." then "Email verified! Redirecting to login..."
4. After verification, redirect to `/login`.
5. Add `/verify-email` to `PUBLIC_ROUTES` in middleware.
6. In login route: check `emailVerified` flag. If false, reject login with "Please verify your email first" message and offer to resend verification email.

#### 2B.5: Update Webhook User Creation
**File:** `app/api/webhooks/stripe/route.ts`
1. Keep User creation with random password (user will set real password on account creation page).
2. Set `emailVerified: false` on User creation (already the case).
3. Send receipt email first, then create-account email.
4. Wrap User + PatientProfile + Subscription creation in a Prisma transaction (fixes P1-002 simultaneously).

### 2C: Intake Form Gate (Mandatory Intake After Login)

**Current State:** After login, patient goes directly to `/patient/dashboard`. Intake form is accessible but not mandatory.
**Desired State:** After login, if intake form is not completed, patient is FORCED to complete it. Cannot access any portal page. Can sign out during intake. On next login, back to intake if still incomplete.

**Tasks:**

#### 2C.1: Middleware Intake Check
**File:** `middleware.ts`
1. For PATIENT role accessing `/patient/*` routes:
   - After JWT verification, check if the user has a completed intake (status = `SUBMITTED`, `APPROVED`, or `REVIEWING`).
   - If no completed intake exists, redirect to `/intake`.
   - Allow access to `/intake` and `/logout` even without completed intake.
2. This requires a lightweight DB check or a JWT claim. Options:
   - **Option A (JWT claim):** Add `intakeComplete: boolean` to JWT payload. Requires re-issuing JWT after intake submission. Faster per-request.
   - **Option B (API check):** Middleware makes a quick DB query. Slower but always current.
   - **Recommended:** Option A with fallback to Option B if claim is missing.

#### 2C.2: Intake Page Auth Handling
**File:** `app/intake/IntakeClient.tsx`, `middleware.ts`
1. Move `/intake` from requiring active subscription to requiring PATIENT role only.
2. Ensure the intake page has a "Sign Out" button prominently displayed.
3. If patient signs out mid-intake, draft is NOT auto-saved (per user specification: "intake form is required again on next login"). Alternatively, save draft but still require completion.
4. Clarify with user: should drafts persist across sessions? The spec says "intake form is required again" but this could mean the form re-appears (not that progress is lost).
5. **Conservative interpretation:** Save drafts, but always redirect to intake until status is SUBMITTED or beyond.

#### 2C.3: Post-Intake Unlock
**Files:** `app/api/patient/intake/[id]/submit/route.ts`, JWT generation
1. After intake is submitted successfully, update the JWT `intakeComplete` claim (if using Option A).
2. Redirect patient to `/patient/dashboard` after successful submission.
3. Notify physicians of new intake (already exists -- verify it works).

### 2D: Intake Form Redesign (34 Questions, 7 Sections, DSM-5)

**Current State:** `IntakeClient.tsx` already has the 7-section structure with DSM-5 questions. However, scoring uses AUDIT-C (3-question alcohol screening) instead of DSM-5 scoring. The form also includes personal info fields (name, DOB, phone, email) which should NOT be in the intake form (they belong in the profile).

**Desired State:** 34-question intake form matching the AUD Naltrexone Intake Form PDF exactly. DSM-5 scoring. Provider decision summary with contraindication flags.

**Tasks:**

#### 2D.1: Audit Current Form vs PDF Spec
Compare `IntakeClient.tsx` sections against the PDF specification:
- Section 1: DSM-5 AUD Screening (Q1-11) -- 11 Yes/No -- **EXISTS** (dsm5Q1-Q11)
- Section 2: Current Drinking Pattern (Q12-15) -- **EXISTS** (drinkingDaysPerWeek, drinksPerDay, lastDrink, bingeDrinking)
- Section 3: Withdrawal Risk Assessment (Q16-19) -- **EXISTS** (withdrawalSeizure, withdrawalDTs, withdrawalHospitalized, morningDrinking)
- Section 4: Naltrexone Safety Screening (Q20-25) -- **EXISTS** (opioidUse, opioidMaintenance, liverCondition, liverTests, pregnancyStatus, drugAllergies)
- Section 5: Medical & Psychiatric History (Q26-29) -- **EXISTS** (medicalHistory, currentMedications, medicationList, previousTreatments, seeingTherapist)
- Section 6: Treatment Goals & Readiness (Q30-32) -- **EXISTS** (primaryGoal, motivationLevel, supportSystem)
- Section 7: Demographics (Q33-34) -- **EXISTS** (biologicalSex, age in personal info)

**Finding:** The form structure already matches the PDF closely. The main issues are:
1. Personal info fields (firstName, lastName, DOB, phone, email) are in the intake form -- these should come from profile or be collected separately.
2. Consent fields (hipaaConsent, termsConsent, telehealthConsent, treatmentConsent) are in the intake form -- these were already handled on the consent page.
3. Scoring uses AUDIT-C, not DSM-5.

#### 2D.2: Remove Redundant Fields from Intake Form
**File:** `app/intake/IntakeClient.tsx`
1. Remove personal info section (firstName, lastName, DOB, phone, email) -- this data comes from the PatientProfile created during account setup.
2. Remove consent checkboxes from the intake form -- already handled on the consent page before payment.
3. Remove feedbackNotes and concernsQuestions (not in PDF spec).
4. Update Zod schema accordingly.

#### 2D.3: Rebuild Scoring Engine (DSM-5 Instead of AUDIT-C)
**File:** `lib/intake/scoring.ts`
1. Keep AUDIT-C as a utility but add DSM-5 AUD scoring as the PRIMARY scoring system.
2. DSM-5 scoring rules from PDF:
   - Count Yes answers from Q1-Q11.
   - 0-1 Yes = No AUD / Subthreshold
   - 2-3 Yes = Mild AUD
   - 4-5 Yes = Moderate AUD
   - 6+ Yes = Severe AUD
3. Add `calculateDSM5Score(answers)` function returning `{ score, severity, meetsCriteria }`.
4. Add contraindication detection:
   - **Absolute contraindications (auto-decline):** Q20 (current opioid use) = Yes, Q21 (opioid maintenance therapy) = Yes
   - **Elevated withdrawal risk (flag for physician):** Any Yes in Q16-Q19
   - **Relative contraindications (physician discretion):** Q22 (liver condition) = cirrhosis/acute-hepatitis/liver-failure, Q24 (pregnancy) = pregnant/breastfeeding, Q25 (drug allergies) = naltrexone
5. Add `generateProviderDecisionSummary(answers)` function returning structured summary for physician review.

#### 2D.4: Update Intake Form UI/UX
**File:** `app/intake/IntakeClient.tsx`
1. Ensure each section has a clear header matching the PDF:
   - "Section 1: DSM-5 Alcohol Use Disorder Screening"
   - "Section 2: Current Drinking Pattern"
   - "Section 3: Withdrawal Risk Assessment"
   - "Section 4: Naltrexone Safety Screening"
   - "Section 5: Medical & Psychiatric History"
   - "Section 6: Treatment Goals & Readiness"
   - "Section 7: Demographics"
2. Step-by-step wizard with progress indicator.
3. Display question numbers (Q1, Q2, ..., Q34) matching the PDF.
4. For Yes/No questions: radio buttons (not checkboxes).
5. Review/summary page before submission.

#### 2D.5: Update Intake API & Database
**Files:** `app/api/patient/intake/route.ts`, `app/api/patient/intake/[id]/submit/route.ts`, `prisma/schema.prisma`
1. Update the intake submission handler to use DSM-5 scoring instead of (or in addition to) AUDIT-C.
2. Store both scores in the Intake model (`riskScore` for DSM-5, add `auditCScore` if needed for backward compatibility).
3. Store contraindication flags in the intake record.
4. Add `providerSummary` JSON field to Intake model if not already present.

### 2E: Doctor Review Flow

**Current State:** Physician portal has an intake queue and review pages. Needs verification that the full flow works end-to-end.
**Desired State:** Intake appears in physician queue -> Doctor approves/declines -> Patient notified in portal + email (HIPAA-safe).

**Tasks:**

#### 2E.1: Verify Physician Queue
**Files:** `app/physician/(portal)/queue/page.tsx`, `app/api/physician/queue/route.ts`
1. Verify that submitted intakes appear in the physician queue.
2. Verify the queue shows: patient ID (not name), submission date, DSM-5 severity, risk flags.
3. Ensure contraindication flags are prominently displayed.

#### 2E.2: Verify Review Page
**Files:** `app/physician/(portal)/intake/[id]/page.tsx`, `app/api/physician/review/route.ts`
1. Verify the review page shows the full intake form data (decrypted).
2. Verify the provider decision summary (DSM-5 score, contraindications, withdrawal risk).
3. Verify approve/decline/request-info actions work.

#### 2E.3: Patient Notification on Decision
**Files:** `app/api/physician/review/route.ts`, `lib/notifications/templates.ts`
1. On APPROVE: Send `EmailTemplate.INTAKE_APPROVED` (already exists). Content: "Your intake has been reviewed. Please log in to your portal for details." No PHI.
2. On REJECT: Send `EmailTemplate.INTAKE_REJECTED`. Content: "Your intake has been reviewed. Please log in to your portal for details." No PHI.
3. On REQUEST_INFO: Send `EmailTemplate.INTAKE_NEEDS_INFO`. Content: "Your physician has a question about your intake. Please log in to respond."
4. Show decision status prominently on patient dashboard.

#### 2E.4: Prescription Flow (Post-Approval)
**Files:** `app/physician/(portal)/patients/[id]/page.tsx`, `app/api/physician/prescriptions/send/route.ts`
1. After approval, physician can send prescription to patient's chosen pharmacy.
2. Verify the prescription send flow works (currently has DoseSpot TODO at line 142).
3. For MVP: use mock DoseSpot integration (already exists). Real integration is Phase 3.

### 2F: Patient Portal Enhancements

**Tasks:**

#### 2F.1: Profile Completion Prompt
**File:** `app/patient/dashboard/page.tsx`, `components/patient/PatientDashboard.tsx`
1. After intake is submitted, show a "Complete Your Profile" prompt on the dashboard.
2. Profile includes: preferred pharmacy, emergency contact, address (for California verification).
3. Profile completion is recommended but NOT blocking (unlike intake).

#### 2F.2: Messaging Doctor
**Files:** `app/patient/messages/page.tsx`, `app/api/patient/messages/route.ts`
1. Verify the messaging system works end-to-end.
2. Patient can send messages to their reviewing physician.
3. Doctor receives notification of new message.
4. Patient receives notification when doctor replies.

#### 2F.3: Email Notifications for Portal Updates
**Files:** `lib/services/notification-service.ts`, `lib/notifications/templates.ts`
1. Verify that all portal update events trigger email notifications:
   - New message received
   - Intake decision made
   - Prescription sent
   - Subscription status change
2. All emails must be HIPAA-compliant: no PHI in subject or body. Generic: "You have a new update in your Rimal Health portal."

---

## Phase 3: UI/UX Overhaul (Days 3-5)

**Design Inspiration:** godly.website (clean, modern, premium healthcare aesthetic)
**Brand Tokens:** navy (#0A2540) primary, ocean (#0284C7) accent -- already defined in globals.css

### 3A: Landing Page Redesign
**File:** `app/(marketing)/page.tsx`
1. Hero section: Clear headline about AUD treatment with Naltrexone.
2. Single prominent "Get Started" CTA button (links to `/checkout/consent`).
3. How it works: 4-step visual (Consent -> Pay -> Intake -> Treatment).
4. Trust indicators: HIPAA compliance, licensed physicians, California-licensed.
5. Pricing section: $50/mo active treatment, $25/mo maintenance.
6. FAQ accordion.
7. Clean footer with legal links.

### 3B: Consent Page Design
**File:** `app/checkout/consent/page.tsx`
1. Clean card layout with clear heading.
2. Each consent item as a distinct card/row with checkbox.
3. Links to full documents styled as inline links.
4. "Continue to Payment" button with clear state (disabled/enabled).
5. Progress indicator showing step 1 of the flow.

### 3C: Intake Form Wizard Design
**File:** `app/intake/IntakeClient.tsx`
1. Step-by-step wizard with sidebar progress tracker.
2. Section headers with clear numbering.
3. Question numbering (Q1-Q34) matching PDF.
4. Clean radio button groups for Yes/No questions.
5. Multiple choice with clear selection state.
6. Review page with editable sections.
7. Submit confirmation modal.

### 3D: Patient Portal Design
**Files:** `app/patient/layout.tsx`, `app/patient/dashboard/page.tsx`
1. Sidebar navigation with active state.
2. Dashboard cards: Intake status, Prescription status, Recent messages, Profile completion.
3. Mobile-responsive sidebar (hamburger menu).

### 3E: Physician Portal Design
**Files:** `app/physician/(portal)/layout.tsx`, `app/physician/(portal)/queue/page.tsx`
1. Queue page: sortable/filterable table of pending intakes.
2. Review page: intake data display with decision panel.
3. Patient detail page with messaging interface.

---

## Phase 4: P1 Fixes (Parallel with Phase 2-3)

These fixes should be addressed during the sprint but do not block the main flow work.

### P1-001: PhysicianMessage Encryption
**File:** `lib/db/encryption-extension.ts`
Add `subject` and `body` to the PhysicianMessage model in the `PHI_FIELDS` map.

### P1-002: Stripe Webhook Transaction Safety
**File:** `app/api/webhooks/stripe/route.ts`
Wrap User + PatientProfile + Subscription creation in `prisma.$transaction()`. (Addressed as part of Phase 2B.5)

### P1-003: PHI_ENCRYPTION_KEY Validation
**File:** `lib/env-validation.ts`
Add `PHI_ENCRYPTION_KEY` to the validated environment variables. Remove or fix `ENCRYPTION_KEY` check if dead code.

### P1-005: PHI in sessionStorage
**File:** `app/intake/IntakeClient.tsx`
Search for any `sessionStorage` or `localStorage` usage with PHI data. Remove or replace with server-side draft saving.

### P1-006: Prescription Model Encryption
**File:** `lib/db/encryption-extension.ts`
Add `medicationName`, `dosage`, `pharmacyName` to Prescription model in `PHI_FIELDS` map.

### P1-012: Remove Orphaned HIPAA Code
**Files:** `lib/hipaa/audit-logger.ts` (724 lines), `lib/hipaa/encryption.ts` (581 lines)
Delete both files. They have zero imports across the codebase and use incompatible key formats.

### P1-013: Remove ignoreBuildErrors
**File:** `next.config.ts` (line 271)
Set `ignoreBuildErrors: false` (or remove the setting entirely). Type errors must fail builds.

---

## Phase 5: Testing & QA (Day 5)

### 5A: E2E Test -- Full Patient Flow
**File:** `tests/e2e/patient-flow.spec.ts` (new)
1. Navigate to landing page, click "Get Started".
2. Complete consent page (check all items, click Continue).
3. Complete Stripe checkout (test card 4242...).
4. Verify receipt email sent (mock assertion).
5. Navigate to account creation page with token.
6. Create account (password).
7. Verify email verification sent.
8. Verify email.
9. Login.
10. Verify redirect to intake form (not dashboard).
11. Complete intake form (all 34 questions).
12. Submit.
13. Verify redirect to dashboard.
14. Verify intake appears in physician queue.

### 5B: E2E Test -- Physician Review Flow
**File:** `tests/e2e/physician-review.spec.ts` (new)
1. Login as physician.
2. View queue -- verify new intake appears.
3. Open intake review.
4. Approve intake.
5. Verify patient notification.

### 5C: HIPAA Compliance Verification
1. Run `/hipaa-review` skill on all modified files.
2. Verify no PHI in any email template body.
3. Verify no PHI in console.log/console.error statements.
4. Verify all PHI fields encrypted in database.
5. Verify audit logging on all PHI access routes.

### 5D: Deploy & Verify
1. Clear Netlify cache.
2. Deploy to production.
3. Run smoke tests against live URL.
4. Verify `/checkout/consent` loads without ChunkLoadError.
5. Verify full flow works on production.

---

## Dependency Graph

```
Phase 1 (P0 Fixes) ──────────────────────────┐
  |                                            |
  v                                            v
Phase 2A (Consent Fix) ──> Phase 2B (Post-Payment) ──> Phase 2C (Intake Gate)
                                                              |
                                                              v
                                                     Phase 2D (Intake Redesign)
                                                              |
                                                              v
                                                     Phase 2E (Doctor Review)
                                                              |
                                                              v
                                                     Phase 2F (Portal Enhancements)
                                                              |
Phase 3 (UI/UX) ── runs in parallel with Phases 2C-2F ───────┤
Phase 4 (P1 Fixes) ── runs in parallel with Phase 2-3 ───────┤
                                                              |
                                                              v
                                                     Phase 5 (Testing & QA)
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Intake form redesign breaks existing draft data | Medium | High | Add migration script for existing intakes; version the form schema |
| Email verification flow adds friction, reduces conversion | Medium | Medium | Make verification simple (1-click), clear messaging |
| JWT claim for intake status becomes stale | Low | Medium | Fallback to DB check; re-issue JWT on intake submit |
| DSM-5 scoring changes affect existing physician reviews | Low | High | Version scoring; keep old scores for existing reviews |
| Netlify stale cache persists after deploy | Medium | Low | Always clear cache before deploy; verify live URL |

---

## Success Criteria

1. All 7 P0 issues resolved and verified by Team F.
2. Full patient flow works end-to-end: consent -> payment -> receipt email -> create account email -> account creation -> email verification -> login -> mandatory intake -> submit -> dashboard.
3. Intake form has exactly 34 questions in 7 sections matching the PDF.
4. DSM-5 scoring produces correct severity levels.
5. Contraindication flags (Q20/Q21 absolute, Q16-Q19 withdrawal risk) correctly detected.
6. Physician can review, approve/decline, and patient is notified.
7. No PHI in any email body, console output, or URL.
8. CI quality gates enforce lint, type-check, and test passage.
9. Production site loads without ChunkLoadError.
10. At least 2 new E2E tests covering the full patient and physician flows.
