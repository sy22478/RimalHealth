# RimalHealth -- Task Tracker

> **Status Legend:** `[ ]` To Do | `[~]` In Progress | `[x]` Done | `[!]` Blocked
> **Last Updated:** 2026-03-26
> **Mutable:** YES -- agents update this document as work completes
> **Source:** Deep review reports (Teams F, G, H, Research), compliance analysis, architecture assessment
> **Total:** 81 tasks across 8 groups

---

## TASK 1: P0 -- Immediate (Blocking)

- [ ] **1.1 Credential Rotation (USER ACTION REQUIRED)**
  - [!] 1.1.1 Rotate Neon DB password in Neon dashboard -- update `DATABASE_URL` in Netlify env vars
  - [!] 1.1.2 Rotate Netlify auth token in Netlify dashboard -- revoke exposed `nfp_e7CeWeCy5M...`
  - [ ] 1.1.3 Add `.claude/settings.local.json` to `.gitignore`
  - [ ] 1.1.4 Replace `.claude/settings.local.json` with clean version (no hardcoded credentials)
  - [ ] 1.1.5 Verify credentials are NOT in git history

- [x] **1.2 42 CFR Part 2 Compliance (Phase 1 -- Legal)**
  - [x] 1.2.1 Add 42 CFR 2.31 compliant consent checkbox to `app/checkout/consent/page.tsx` (language in `compliance_42cfr2.md`)
  - [x] 1.2.2 Update `app/(marketing)/hipaa/page.tsx` with Part 2 patient notice
  - [x] 1.2.3 Update `app/(marketing)/privacy/page.tsx` with Part 2 protections section
  - [x] 1.2.4 Add redisclosure notice to physician portal `components/physician/IntakeDataView.tsx`

- [ ] **1.3 Vendor BAA Verification (USER ACTION REQUIRED)**
  - [!] 1.3.1 Verify BAA with Neon (database)
  - [!] 1.3.2 Verify BAA with Netlify (hosting -- may require enterprise plan)
  - [!] 1.3.3 Verify BAA with SendGrid/Twilio (email -- may NOT sign on standard plans)
  - [!] 1.3.4 Verify BAA with AWS (S3 document storage)
  - [!] 1.3.5 Verify BAA with Stripe (payment processing)
  - [!] 1.3.6 If SendGrid lacks BAA, evaluate AWS SES or Postmark as replacement

- [x] **1.4 WCAG 2.1 AA Accessibility (Required by May 2026)**
  - [x] 1.4.1 Add ARIA attributes to intake form `app/intake/IntakeClient.tsx`
  - [x] 1.4.2 Add keyboard navigation to intake form wizard (Tab, Enter, Escape)
  - [x] 1.4.3 Ensure all interactive elements have 44px minimum tap targets
  - [x] 1.4.4 Add screen reader announcements for form step changes
  - [x] 1.4.5 Audit consent page, create-account, verify-email for accessibility
  - [x] 1.4.6 Verify color contrast ratios meet AA standard (4.5:1 text, 3:1 large)

---

## TASK 2: P1 -- Security & Data Integrity

- [x] **2.1 Document Route Auth Hardening**
  - [x] 2.1.1 Add `requireRole('PATIENT')` to `app/api/patient/documents/route.ts` (already had it)
  - [x] 2.1.2 Add `requireRole('PATIENT')` to `app/api/patient/documents/[id]/route.ts`
  - [x] 2.1.3 Add `requireRole('PATIENT')` to `app/api/patient/documents/[id]/download/route.ts`
  - [x] 2.1.4 Add `requireRole('PATIENT')` to `app/api/patient/documents/upload-url/route.ts`

- [x] **2.2 Legacy Intake Route**
  - [x] 2.2.1 Deleted orphaned `app/api/intake/route.ts` (no frontend references, only e2e URL match)

- [x] **2.3 Intake Form Validation Gaps**
  - [x] 2.3.1 Add `opioidUse` and `opioidMaintenance` to safety step validation in `IntakeClient.tsx:1220`
  - [x] 2.3.2 Add `currentMedications` and `seeingTherapist` to medical step validation

- [x] **2.4 CSRF Protection**
  - [x] 2.4.1 Wire `lib/security/csrf.ts` into state-changing API routes (POST, PUT, DELETE) — added `requireCSRF()` helper to csrf.ts; wired into profile PUT, messages POST, intake submit POST, consent POST
  - [x] 2.4.2 Add CSRF token generation to form pages — created `GET /api/csrf` endpoint that generates token pair, sets cookie, returns form token
  - [x] 2.4.3 Add CSRF validation middleware to API routes — `requireCSRF()` validates double-submit cookie pattern via X-CSRF-Token header

- [~] **2.5 CI/CD Hardening**
  - [x] 2.5.1 Remove `ignoreBuildErrors: true` from `next.config.ts:270` (set to `false`)
  - [x] 2.5.2 Fix any TypeScript errors that surface (none found after cache clean)
  - [ ] 2.5.3 Verify CI pipeline passes end-to-end

- [ ] **2.6 Dual Stripe Consolidation**
  - [ ] 2.6.1 Identify all 7 routes importing from `lib/integrations/stripe.ts`
  - [ ] 2.6.2 Migrate each to use `lib/stripe/stripe-server.ts`
  - [ ] 2.6.3 Delete `lib/integrations/stripe.ts` after migration
  - [ ] 2.6.4 Verify checkout, billing, subscription, webhook all work

- [x] **2.7 Database Connection Pooling**
  - [x] 2.7.1 Add pool config to `lib/db/prisma.ts` (max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 5000)

- [ ] **2.8 Patient MFA**
  - [ ] 2.8.1 Extend MFA setup UI to include patients
  - [ ] 2.8.2 Add MFA verification step to patient login
  - [ ] 2.8.3 Add MFA bypass for first login (before setup)

- [ ] **2.9 Stripe Webhook Deduplication**
  - [ ] 2.9.1 Create `WebhookEvent` Prisma model with unique `stripeEventId`
  - [ ] 2.9.2 Add dedup check at start of webhook handler
  - [ ] 2.9.3 Record event ID after successful processing

- [ ] **2.10 Encryption & Audit Tests**
  - [ ] 2.10.1 Write encrypt/store/retrieve/decrypt roundtrip tests for all 7 models
  - [ ] 2.10.2 Write audit logger coverage tests for all PHI access routes
  - [ ] 2.10.3 Write no-PHI-in-console tests across all API routes
  - [x] 2.10.4 Write DSM-5 scoring edge case tests

---

## TASK 3: P1 -- Code Quality

- [x] **3.1 Console.error Sanitization (55+ routes)**
  - [x] 3.1.1 Replace raw `error` objects with `error.message` in all `app/api/` routes -- sanitized 78 instances across 66 files using `error instanceof Error ? error.message : 'Unknown error'` pattern
  - [x] 3.1.2 Verify no PHI field names in error log patterns -- confirmed all console.error messages use generic labels only, no PHI field names

- [x] **3.2 Webhook Secret Safety**
  - [x] 3.2.1 Replace `process.env.STRIPE_WEBHOOK_SECRET!` with runtime check in `app/api/webhooks/stripe/route.ts`

- [ ] **3.3 Test Coverage (Currently 2.6%)**
  - [ ] 3.3.1 Tests for verify-token, verify-email, send-verification API routes
  - [ ] 3.3.2 Tests for consent API route
  - [x] 3.3.3 Tests for 4 new scoring functions
  - [ ] 3.3.4 Tests for patient layout intake gate
  - [x] 3.3.5 Tests for encryption extension with expanded PHI fields
  - [x] 3.3.6 Fix `vitest.config.ts` to include both unit AND integration tests

- [ ] **3.4 Consent-to-User Linkage**
  - [ ] 3.4.1 Pass `consentRecordId` as Stripe session metadata
  - [ ] 3.4.2 Store `consentRecordId` on User/PatientProfile in webhook

- [x] **3.5 Public Checkout URL Validation**
  - [x] 3.5.1 Validate `successUrl`/`cancelUrl` start with `NEXT_PUBLIC_APP_URL` (both checkout routes)

---

## TASK 4: P2 -- Infrastructure & Performance

- [ ] **4.1 Data Retention Automation**
  - [ ] 4.1.1 Add `deletedAt` to relevant Prisma models
  - [ ] 4.1.2 Connect `data-retention.ts` stubs to real `auditLogger`
  - [ ] 4.1.3 Create scheduled function for `processExpiredDeletions()`
  - [ ] 4.1.4 Implement actual record deletion/anonymization

- [ ] **4.2 Infrastructure Cleanup**
  - [ ] 4.2.1 Upgrade `actions/create-release@v1` to `softprops/action-gh-release@v2`
  - [ ] 4.2.2 Upgrade `codecov/codecov-action@v3` to `@v4`
  - [ ] 4.2.3 Remove duplicate security headers from `netlify.toml`
  - [x] 4.2.4 Delete orphaned `lib/db/encryption-middleware.ts` (25 lines)
  - [x] 4.2.5 Delete orphaned `lib/db/encryption.ts` (37 lines)

- [ ] **4.3 Session & Security**
  - [ ] 4.3.1 Move session timeout check BEFORE user header injection in `middleware.ts`
  - [ ] 4.3.2 Implement in-memory fallback rate limiter for auth when Redis is down
  - [ ] 4.3.3 Add timing-safe comparison for token lookups

- [ ] **4.4 Performance**
  - [ ] 4.4.1 Switch to Neon pooled connection endpoint
  - [ ] 4.4.2 Evaluate and enable React Compiler
  - [ ] 4.4.3 Enable PPR for marketing pages

- [~] **4.5 npm Audit**
  - [~] 4.5.1 Run `npm audit fix` -- ran; remaining 27 vulns require major version bumps (next, prisma, eslint)

---

## TASK 5: P3 -- Backlog

- [ ] **5.1 Integrations**
  - [ ] 5.1.1 Implement subscription cancellation email (`app/api/patient/billing/cancel/route.ts:193`)
  - [ ] 5.1.2 Implement email retry worker for `notifications:email:retry` Redis queue
  - [ ] 5.1.3 DoseSpot production mode (currently always mock)

- [ ] **5.2 Minor Quality**
  - [ ] 5.2.1 Replace `'CONSENT_RECORDED'` string literal with AuditEventType enum
  - [ ] 5.2.2 Remove dead `notes` parameter from `NotificationService.notifyReviewComplete()`
  - [ ] 5.2.3 Document encryption salt rotation plan
  - [ ] 5.2.4 Document rollback strategy for flow redesign

---

## TASK 6: 42 CFR Part 2 (Phase 2-3)

- [ ] **6.1 Accounting of Disclosures**
  - [ ] 6.1.1 Create `GET /api/patient/disclosures` endpoint
  - [ ] 6.1.2 Add disclosure tracking to audit logger
  - [ ] 6.1.3 Add disclosures page to patient portal

- [ ] **6.2 Consent Management**
  - [ ] 6.2.1 Create `ConsentRecord` Prisma model
  - [ ] 6.2.2 Implement consent revocation workflow
  - [ ] 6.2.3 Generate consent PDF for download

- [ ] **6.3 Restriction Requests**
  - [ ] 6.3.1 Add patient disclosure restriction request mechanism
  - [ ] 6.3.2 Store and enforce restriction requests

---

## TASK 7: Context & Documentation

- [x] **7.1 Context Management**
  - [x] 7.1.1 Update `context_brief.md` with new app flow
  - [x] 7.1.2 Update `context_brief.md` with 42 CFR Part 2
  - [ ] 7.1.3 Update `build_instructions.md` with new API routes
  - [x] 7.1.4 Update `conversation.md` with this session

- [x] **7.2 Memory Management**
  - [x] 7.2.1 Update MEMORY.md with new app flow
  - [x] 7.2.2 Remove stale `(patient)` route group references from MEMORY.md
  - [x] 7.2.3 Add 42 CFR Part 2 to memory
  - [x] 7.2.4 Update MEMORY.md with 8-team structure (A-H)

- [x] **7.3 Trace Logging**
  - [x] 7.3.1 Update `trace.md` with Phase 8 entries
  - [x] 7.3.2 Log all agent outputs and key decisions
  - [x] 7.3.3 Record task completion stats

- [x] **7.4 CLAUDE.md**
  - [x] 7.4.1 Update Key Reference Files table
  - [x] 7.4.2 Update app flow description in conventions

---

## TASK 8: SendGrid BAA Evaluation

- [ ] **8.1 Email Provider**
  - [ ] 8.1.1 Research SendGrid BAA requirements
  - [ ] 8.1.2 Research AWS SES BAA + integration effort
  - [ ] 8.1.3 Research Postmark BAA + integration effort
  - [ ] 8.1.4 Produce recommendation report

---

## Priority Matrix

| Priority | Count | Key Items |
|----------|:-----:|-----------|
| **P0** | 15 | Credentials, 42 CFR, BAAs, Accessibility |
| **P1** | 26 | Security hardening, CSRF, Stripe consolidation, MFA, tests |
| **P2** | 14 | Data retention, infra cleanup, performance |
| **P3** | 6 | Integrations, minor quality |
| **Compliance** | 6 | 42 CFR Phase 2-3 |
| **Docs** | 10 | Context, memory, trace, CLAUDE.md |
| **Evaluation** | 4 | SendGrid BAA |
| **Total** | **81** | |
