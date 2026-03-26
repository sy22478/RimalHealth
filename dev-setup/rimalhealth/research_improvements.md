# RimalHealth -- Improvement Research Report

> **Research Team** | March 2026
> Research-only document -- no code was modified.

---

## 1. HIPAA Compliance

### Current State

RimalHealth has a solid HIPAA foundation:
- **Encryption:** AES-256-GCM field-level encryption via `lib/encryption/phi.ts` with automatic Prisma extension (`lib/db/encryption-extension.ts`) covering 28 PHI fields across 7 models.
- **Audit Logging:** `lib/audit/logger.ts` provides a singleton audit logger for PHI access. However, the context brief documents a **dual logger issue** -- a second logger existed in `lib/hipaa/audit-logger.ts` (now removed, but `lib/hipaa/data-retention.ts` still has stub references to it).
- **MFA:** TOTP-based MFA is implemented for physicians/admins (`lib/auth/mfa.ts`, `app/api/auth/mfa/*`). Patient accounts do NOT have MFA.
- **Session Management:** 15-minute access tokens, 7-day refresh tokens, 30-minute idle timeout, 8-hour absolute timeout.
- **Encryption Key Management:** There is a documented dual encryption issue -- `PHI_ENCRYPTION_KEY` (hex, used by Prisma extension) vs `ENCRYPTION_KEY` (base64, used by `lib/hipaa/encryption.ts`). This creates risk of data integrity issues.
- **Data Retention:** Policy module exists at `lib/hipaa/data-retention.ts` but it is **dead code** (zero external imports, stub audit functions).

### Research Findings

**2026 HIPAA Security Rule Changes (Finalization expected May 2026):**

1. **Mandatory MFA for ALL ePHI access** -- The 2026 rule makes MFA required (not addressable) for any system touching ePHI, including patient portals, billing, and messaging. RimalHealth currently only has MFA for physicians/admins; **patients accessing their own PHI via the portal are not covered**.

2. **Encryption is now REQUIRED, not addressable** -- AES-256-GCM remains the gold standard. The elimination of the "addressable" exception means encryption at rest and in transit is mandatory with no documentation-only alternative.

3. **Annual penetration testing is now mandatory** under the updated Security Rule section 164.308(a)(8). Quarterly vulnerability scans are also expected.

4. **Audit log review requirements are stricter** -- Logs must be regularly reviewed (not just collected), and organizations must demonstrate they act on audit findings.

5. **42 CFR Part 2 alignment (deadline: February 16, 2026, NOW ENFORCEABLE)** -- Since RimalHealth treats alcohol use disorder, it falls under 42 CFR Part 2 in addition to HIPAA. The 2024 final rule aligns Part 2 with HIPAA but adds extra protections:
   - SUD records cannot be used in legal proceedings against the patient without specific consent or court order.
   - Updated consent requirements (single consent for treatment/payment/operations).
   - Accounting of disclosures must be available to patients.
   - OCR began accepting complaints on February 16, 2026.

**BAA Status of Vendors:**

| Vendor | BAA Available? | Status | Risk |
|--------|---------------|--------|------|
| **Neon (PostgreSQL)** | Yes | HIPAA compliant, BAA available via self-serve or Sales team. SOC 2 Type 2, ISO 27001. | **Action needed: Confirm BAA is signed.** |
| **Netlify** | Yes (Enterprise only) | HIPAA-compliant service offering for enterprise customers. Requires Enterprise plan. | **Action needed: Confirm Enterprise plan + signed BAA.** |
| **SendGrid** | Partial -- Enterprise only | Twilio will sign a BAA covering SendGrid **only on enterprise plans**. Standard plans are NOT HIPAA-compliant. | **HIGH RISK: If not on enterprise plan, SendGrid cannot transmit PHI.** |
| **AWS S3** | Yes | AWS signs BAAs and S3 is HIPAA-eligible. | Low risk if BAA is in place. |
| **Redis** | Depends on provider | Depends on hosting (AWS ElastiCache has BAA, self-hosted needs own controls). | **Action needed: Verify Redis provider BAA.** |

### Recommendations (Prioritized)

| # | Recommendation | Effort | Impact |
|---|---------------|--------|--------|
| 1 | **Implement patient MFA** -- Add optional (strongly encouraged) MFA for patient accounts accessing the portal. The 2026 rule mandates MFA for all ePHI access. File: `lib/auth/mfa.ts` (extend to patients), `middleware.ts` (enforce MFA check). | Medium | Critical |
| 2 | **Verify and document all vendor BAAs** -- Confirm signed BAAs with Neon, Netlify (enterprise), SendGrid (enterprise or switch to AWS SES/Postmark), S3, and Redis provider. Create a BAA tracking document. | Low | Critical |
| 3 | **Replace or upgrade SendGrid** -- If not on Twilio enterprise plan, switch to AWS SES (supports BAA), Postmark (offers BAA), or Paubox (HITRUST certified). File: `lib/integrations/sendgrid.ts`. | Medium | Critical |
| 4 | **Consolidate dual encryption implementations** -- Unify `PHI_ENCRYPTION_KEY` and `ENCRYPTION_KEY` into a single key management approach. The current state risks data integrity issues. Files: `lib/encryption/phi.ts`, `lib/db/encryption-extension.ts`, `lib/env-validation.ts`. | Medium | High |
| 5 | **Activate data retention automation** -- `lib/hipaa/data-retention.ts` is dead code. Wire it to a scheduled job (cron/Netlify function) that enforces the 7-year retention policy and handles soft-delete grace periods. | Medium | High |
| 6 | **Implement 42 CFR Part 2 compliance controls** -- Add consent management for SUD records, implement accounting of disclosures, ensure SUD data has additional access controls. Update privacy notice. Files: `app/(marketing)/hipaa/page.tsx`, `app/(marketing)/privacy/page.tsx`, new consent management module. | High | Critical |
| 7 | **Establish annual penetration testing program** -- Schedule annual pen tests and quarterly vulnerability scans as now required by the 2026 Security Rule. | Medium | High |

---

## 2. Next.js / React

### Current State

- **Next.js 16.1.6** with App Router, React 19, TypeScript strict mode.
- **No `use cache` directive or Cache Components** -- The codebase does not use the new Next.js 16 caching primitives.
- **No Partial Prerendering (PPR)** -- Marketing pages use HTTP cache headers but not PPR.
- **No React Compiler** -- `next.config.ts` does not enable `reactCompiler`.
- **No Server Actions** -- Only 2 files reference `'use server'` (`lib/auth/index.ts`, `lib/auth/session-helpers.ts`), and these appear to be barrel exports, not actual Server Actions.
- **Turbopack configured** but with known issues (barrel export resolution problems documented in CLAUDE.md).
- **`ignoreBuildErrors` is enabled in CI** -- `typescript.ignoreBuildErrors` is set to `true` when `process.env.CI` is truthy. This masks type errors in production builds.
- **Custom webpack splitChunks** config may conflict with Next.js 16 defaults.

### Research Findings

**Next.js 16 Key Features (March 2026):**

1. **Cache Components (`use cache`)** -- Explicit, opt-in caching for pages, components, and functions. Replaces the old implicit caching. Marketing pages like `/about`, `/pricing`, `/faq` are ideal candidates.

2. **Partial Prerendering (PPR)** -- Combines static shells with dynamic holes using Suspense boundaries. Ideal for pages with both static content and personalized data (e.g., patient dashboard with static layout + dynamic treatment status).

3. **React Compiler (stable in Next.js 16)** -- Automatically memoizes components, eliminating need for manual `useMemo`/`useCallback`. Zero code changes required, just enable the config.

4. **Turbopack stable for both `next dev` and `next build`** -- Can replace webpack for production builds if barrel export issues are resolved.

5. **React 19.2** -- View Transitions, `useEffectEvent`, Activity API. View Transitions could improve the intake form step transitions (currently using framer-motion).

6. **`updateTag` for Server Actions** -- Provides read-your-writes semantics for mutations.

### Recommendations (Prioritized)

| # | Recommendation | Effort | Impact |
|---|---------------|--------|--------|
| 1 | **Enable React Compiler** -- Add `reactCompiler: true` to `next.config.ts`. Zero code changes needed; automatic memoization reduces re-renders across the entire app. | Low | Medium |
| 2 | **Add `use cache` to marketing pages** -- Add `"use cache"` directive to `/about`, `/pricing`, `/faq`, `/how-it-works`, `/alcohol-treatment` pages. These are static content that changes rarely. Pair with `cacheLife('hours')` or `cacheLife('days')`. | Low | Medium |
| 3 | **Enable Partial Prerendering** -- Add `cacheComponents: true` to `next.config.ts`. Use Suspense boundaries on patient dashboard to prerender the layout shell while streaming dynamic data. | Medium | Medium |
| 4 | **Fix `ignoreBuildErrors` in CI** -- Remove `!!process.env.CI` from the `ignoreBuildErrors` condition. Fix the underlying type errors instead of suppressing them. This is a quality/safety concern. File: `next.config.ts` line 271. | Medium | High |
| 5 | **Evaluate Server Actions for form submissions** -- The intake form auto-save, contact form, and profile update could use Server Actions instead of manual `fetch()` to API routes. This reduces client-side code and improves progressive enhancement. | High | Medium |
| 6 | **Consider React 19 View Transitions** -- Replace framer-motion animations in the intake wizard (`app/intake/IntakeClient.tsx`) with native View Transitions API for smaller bundle size and better performance. | Medium | Low |

---

## 3. Telehealth UX

### Current State

- **34-question intake form** split into 7 sections with a multi-step wizard (`app/intake/IntakeClient.tsx`), framer-motion transitions, auto-save, and Zod validation.
- **Sections:** DSM-5 AUD Screening (11 Qs), Drinking Pattern (4 Qs), Withdrawal Risk (4 Qs), Naltrexone Safety (6 Qs), Medical/Psychiatric History (4 Qs), Treatment Goals (3 Qs), Emergency Contact + Consent (2 Qs).
- **Accessibility:** Only `app/globals.css` has `prefers-reduced-motion` support. The intake form has **zero `aria-` attributes** in the intake directory. No WCAG 2.2-specific patterns detected.
- **Patient notifications:** Email-based via SendGrid templates.

### Research Findings

**HHS Accessibility Deadline (May 11, 2026):**

The HHS final rule requires healthcare providers with 15+ employees to comply with **WCAG 2.1 Level AA** for all web content and mobile apps by May 11, 2026. Key WCAG 2.2 criteria (recommended over 2.1):
- **Focus Not Obscured:** Focused elements must not be hidden behind sticky headers.
- **Target Size (Minimum):** Interactive elements must be at least 24x24 CSS pixels.
- **Redundant Entry:** Users should not re-enter information already provided.
- **Accessible Authentication:** Login flows must not rely on cognitive tests.

**Intake Form UX Best Practices for Addiction Treatment:**

1. **Early ineligibility detection** -- Screen for obvious disqualifiers (non-CA resident, opioid maintenance) before patients invest time in 34 questions.
2. **Conditional logic** -- Hide irrelevant follow-ups (e.g., skip medication list if "no current medications").
3. **Plain-language section intros** -- Each section should explain WHY the questions matter.
4. **"Why we ask" tooltips** for sensitive questions (AUDIT-C, withdrawal history).
5. **Mobile-first** -- 70% of telehealth users are on mobile. Minimum 44x44px tap targets.
6. **Progress persistence messaging** -- "Your progress is saved. You can return anytime."

**42 CFR Part 2 Consent UX:**
- Layered disclosure: plain-language summary + expandable legal text.
- Individual checkboxes per consent area (not one "agree to all").
- Downloadable PDF of consent.

### Recommendations (Prioritized)

| # | Recommendation | Effort | Impact |
|---|---------------|--------|--------|
| 1 | **Add WCAG 2.1 AA compliance to intake form** -- Add `aria-label`, `aria-describedby`, `role` attributes to all form fields. Ensure keyboard navigation works for all steps. Test with screen reader. This is legally required by May 2026. File: `app/intake/IntakeClient.tsx`. | High | Critical |
| 2 | **Add early ineligibility screening** -- Move CA residency check and critical disqualifiers (active opioid use, severe liver failure) to the first 2-3 questions before the full intake. | Medium | High |
| 3 | **Implement `prefers-reduced-motion` in intake wizard** -- The framer-motion animations in `IntakeClient.tsx` do not honor reduced motion preferences. Wrap animations in a motion preference check. | Low | High |
| 4 | **Add "Why we ask" info tooltips** -- For AUDIT-C questions (Section 1), withdrawal questions (Section 3), and medication screening (Section 4), add collapsible explanatory text. | Low | Medium |
| 5 | **Add progress persistence UX** -- Show "Your progress is saved" indicator after auto-save, and display a "Resume where you left off" prompt on return. | Low | Medium |
| 6 | **Ensure minimum 44x44px tap targets** -- Audit all buttons, checkboxes, and radio buttons in the intake form for minimum target size compliance. | Low | Medium |
| 7 | **Add downloadable consent PDF** -- Allow patients to download their consent agreements before and after signing. | Medium | Medium |

---

## 4. Payment Flow

### Current State

- **Payment-first flow:** Landing CTA -> `/checkout/payment` (no signup) -> Stripe checkout -> webhook auto-creates User + PatientProfile + Subscription -> "Set Password" email -> login -> intake.
- **Webhook handler:** `app/api/webhooks/stripe/route.ts` handles 6 event types.
- **Idempotency:** Checks for existing subscription by `stripeSubscriptionId` before processing, but does NOT track event IDs (no `webhook_events` table).
- **Error handling:** Returns `200` even on processing errors (to prevent Stripe retries), with internal error logging.
- **No Stripe event ID deduplication** -- The current idempotency check only looks at subscription existence, not the Stripe event ID itself.

### Research Findings

**Stripe Webhook Best Practices (2026):**

1. **Event ID deduplication** -- Stripe may deliver the same event multiple times. Best practice is a `webhook_events` table with unique constraint on `event.id`, checked before processing. Current implementation only checks subscription existence, which doesn't cover all event types.

2. **Out-of-order event handling** -- Stripe does not guarantee event delivery order. `customer.subscription.updated` could arrive before `checkout.session.completed`. The handler should be resilient to this.

3. **Idempotency key storage** -- Use a dedicated table:
   ```
   WebhookEvent { id, stripeEventId (unique), eventType, processedAt, status }
   ```

4. **Optimistic locking** -- Use database version columns on `Subscription` to prevent race conditions when multiple webhook events modify the same record.

5. **Stripe Radar** -- Consider enabling Stripe Radar for fraud prevention on checkout.

6. **Subscription lifecycle management** -- The current implementation handles creation and deletion but may not fully handle:
   - Subscription pause/resume
   - Payment method update
   - Proration on plan changes
   - Dunning (failed payment retry) management

**Payment-First Flow in Telehealth:**
The payment-first pattern (pay before creating an account) is used by several telehealth platforms (Hims/Hers, Oar Health). It reduces friction but requires careful handling of:
- Account recovery if the "Set Password" email is lost.
- Refund handling if the patient never completes account setup.
- Subscription billing starting before intake completion.

### Recommendations (Prioritized)

| # | Recommendation | Effort | Impact |
|---|---------------|--------|--------|
| 1 | **Add webhook event deduplication table** -- Create a `WebhookEvent` model in Prisma schema with unique constraint on `stripeEventId`. Check before processing any event. File: `prisma/schema.prisma`, `app/api/webhooks/stripe/route.ts`. | Medium | High |
| 2 | **Handle out-of-order events** -- Add defensive checks in each handler to verify prerequisite state exists (e.g., don't process `invoice.payment_succeeded` if subscription record doesn't exist yet; queue for retry instead). | Medium | High |
| 3 | **Add subscription pause/resume support** -- The current billing page likely only supports cancel. Add pause and resume options for patients who want temporary breaks from treatment. | Medium | Medium |
| 4 | **Implement abandoned checkout recovery** -- If a patient completes Stripe checkout but never sets their password within 48 hours, send a reminder email. Track "last activity" timestamp on auto-created users. | Low | Medium |
| 5 | **Add refund grace period handling** -- If a patient requests cancellation within 24-48 hours of first payment and has not completed intake, process a full refund automatically. | Medium | Medium |

---

## 5. Testing Strategy

### Current State

**Test files found:**
- **Unit tests (4):** `tests/unit/auth.test.ts`, `tests/unit/encryption.test.ts`, `tests/unit/rbac.test.ts`, `tests/unit/validation.test.ts`
- **Integration tests (4):** `tests/integration/auth.test.ts`, `tests/integration/patient.test.ts`, `tests/integration/physician.test.ts`, `tests/integration/webhooks.test.ts`
- **E2E tests (5):** `tests/e2e/checkout.spec.ts`, `tests/e2e/intake.spec.ts`, `tests/e2e/messaging.spec.ts`, `tests/e2e/review.spec.ts`, `tests/e2e/signup.spec.ts`
- **Total: 13 test files** across 3 categories.

**Gaps identified:**
- No test for encryption key rotation (`rotateEncryptionKey` in `lib/encryption/phi.ts`).
- No test for the Prisma encryption extension roundtrip (encrypt on write, decrypt on read).
- No test for audit log completeness (verifying all PHI access paths log to audit).
- No test for MFA flows.
- No test for data retention policies.
- No test for the `SendGrid` email integration.
- No security-specific tests (XSS, CSRF, injection).
- No performance/load tests for the intake form or webhook handler.

### Research Findings

**2026 HIPAA Security Testing Requirements:**

1. **Annual penetration testing is mandatory** under the updated Security Rule. This must cover:
   - Authentication bypass attempts
   - Authorization escalation (patient accessing physician routes)
   - PHI exposure through error messages, logs, or API responses
   - Injection attacks (SQL, XSS, CSRF)
   - Encryption verification (data at rest and in transit)

2. **Quarterly vulnerability scans** are now expected as standard practice.

3. **Test coverage targets for HIPAA apps:**
   - Authentication/authorization: 90%+ coverage
   - PHI encryption/decryption: 100% coverage (roundtrip tests mandatory)
   - Audit logging: 100% coverage of PHI access paths
   - Input validation: 90%+ coverage
   - Overall: 80%+ line coverage recommended

4. **Critical E2E flows to test:**
   - Complete patient onboarding (checkout -> account creation -> intake -> physician review)
   - PHI access and display (verify encryption at rest, decryption on read)
   - Role-based access control (patient can't access physician routes and vice versa)
   - Session timeout and token refresh
   - Webhook idempotency (duplicate event delivery)

### Recommendations (Prioritized)

| # | Recommendation | Effort | Impact |
|---|---------------|--------|--------|
| 1 | **Add encryption roundtrip integration test** -- Test that data written via Prisma extension is encrypted in the database and correctly decrypted on read. Verify PHI fields are not stored in plaintext. | Medium | Critical |
| 2 | **Add audit logging completeness test** -- Create a test that exercises every API route that accesses PHI and verifies an audit log entry is created for each. | High | Critical |
| 3 | **Add MFA flow tests** -- Unit tests for TOTP generation/verification, integration tests for setup/verify/disable API routes, E2E test for physician login with MFA. | Medium | High |
| 4 | **Add security tests** -- RBAC boundary tests (patient accessing `/physician/*` routes returns 403), CSRF token validation, XSS in message content, SQL injection in search params. | Medium | High |
| 5 | **Add webhook idempotency test** -- Send the same Stripe event twice and verify it is processed only once. Send events out of order and verify correct handling. | Medium | High |
| 6 | **Establish annual penetration testing** -- Contract with a HIPAA-specialized pen test firm. Budget for annual test + remediation cycle. Required by 2026 Security Rule. | N/A (process) | Critical |
| 7 | **Set up coverage thresholds** -- Configure Vitest to enforce 80% overall coverage, 90%+ for `lib/auth/`, 100% for `lib/encryption/`. Add to CI pipeline. | Low | Medium |

---

## 6. Performance & Scalability

### Current State

- **Database connection:** Uses `pg` Pool + `@prisma/adapter-pg` (PrismaPg adapter). No connection limit configuration found. No Neon connection pooler endpoint configured.
- **Caching:** Marketing pages have HTTP cache headers (`Cache-Control: public, max-age=60, stale-while-revalidate=300`). API routes have `no-store`. Redis is available for session/cache but no systematic caching strategy for database queries.
- **Bundle optimization:** Custom webpack `splitChunks` for vendor/common/UI chunks. `optimizePackageImports` for Radix, lucide-react, framer-motion, AWS SDK.
- **Image optimization:** WebP + AVIF formats, responsive device sizes configured.
- **No `use cache` directive** -- New Next.js 16 caching is not utilized.
- **Build-safe proxy** in `lib/db/prisma.ts` prevents build-time DB access.

### Research Findings

**Neon Connection Pooling for Serverless (Netlify Functions):**

1. **Use Neon's pooled connection string** -- Neon provides a PgBouncer-based pooler at port 5432 (pooled) vs 5433 (direct). The DATABASE_URL should use the pooled endpoint for serverless.

2. **Set `connection_limit=1` in serverless** -- Each Netlify Function invocation creates a new Prisma client. With the default connection limit, traffic spikes can exhaust Neon's connection pool. Start with `?pgbouncer=true&connection_limit=1` on the DATABASE_URL.

3. **Prisma Accelerate** -- Prisma's hosted connection pooler and global cache, purpose-built for serverless. Provides HTTP-based database access, eliminating cold start connection penalties. Worth evaluating for production.

4. **Neon serverless driver** -- For edge runtimes (not currently used, but relevant if moving to edge functions), the `@neondatabase/serverless` driver provides WebSocket connections.

**HIPAA-Compliant Caching Strategy:**

| Data Type | Cacheable? | Strategy |
|-----------|-----------|----------|
| Marketing pages | Yes | `use cache` + CDN, long TTL |
| Patient dashboard layout (non-PHI) | Yes | `use cache` for static shell via PPR |
| PHI data (messages, prescriptions, profile) | No | Never cache; always fetch fresh |
| Physician queue counts | Limited | Short TTL (30s) server-side cache |
| Public content (FAQ, pricing) | Yes | CDN + `stale-while-revalidate` |
| Session tokens | In Redis only | Never in browser storage or CDN |

**Core Web Vitals Targets:**
- LCP (Largest Contentful Paint): < 2.5s
- FID/INP (Interaction to Next Paint): < 200ms
- CLS (Cumulative Layout Shift): < 0.1

### Recommendations (Prioritized)

| # | Recommendation | Effort | Impact |
|---|---------------|--------|--------|
| 1 | **Configure Neon pooled connection string** -- Ensure `DATABASE_URL` uses Neon's pooled endpoint with `?pgbouncer=true&connection_limit=1` for serverless. File: `.env.local`, `.env.production`, Netlify env vars. | Low | High |
| 2 | **Enable React Compiler** -- Automatic memoization reduces client-side re-renders. Zero code changes. File: `next.config.ts`. | Low | Medium |
| 3 | **Add `use cache` to marketing pages** -- Cache static marketing pages at the component level. Marketing pages are the highest-traffic, lowest-risk caching targets. | Low | Medium |
| 4 | **Enable Partial Prerendering for patient dashboard** -- Prerender the sidebar and layout shell; stream in dynamic data (treatment status, messages, prescriptions) via Suspense. File: `app/patient/dashboard/page.tsx`, `app/patient/layout.tsx`. | Medium | Medium |
| 5 | **Evaluate Prisma Accelerate** -- For production, Prisma Accelerate provides a global connection pool and query cache designed for serverless. Would eliminate connection management complexity. | Medium | Medium |
| 6 | **Reduce framer-motion bundle** -- The intake form imports all of framer-motion. Consider tree-shaking to only import `motion`, `AnimatePresence`, or replacing with CSS animations / View Transitions API for smaller bundle. File: `app/intake/IntakeClient.tsx`. | Low | Low |

---

## Summary: Top 10 Improvements (Prioritized)

| # | Improvement | Area | Effort | Impact | Priority |
|---|------------|------|--------|--------|----------|
| 1 | **Verify and sign BAAs with all vendors** (Neon, Netlify Enterprise, SendGrid/replacement, S3, Redis) | HIPAA | Low | Critical | P0 -- Immediate |
| 2 | **42 CFR Part 2 compliance** -- Add SUD consent management, accounting of disclosures, update privacy notice. Compliance deadline was Feb 16, 2026 (already past). | HIPAA | High | Critical | P0 -- Immediate |
| 3 | **WCAG 2.1 AA accessibility for intake form and patient portal** -- Legally required by May 11, 2026. Add aria attributes, keyboard nav, screen reader support, 44px tap targets. | UX | High | Critical | P0 -- By May 2026 |
| 4 | **Implement patient MFA** -- 2026 HIPAA Security Rule mandates MFA for all ePHI access. Currently only physicians/admins have MFA. | HIPAA | Medium | Critical | P1 -- High |
| 5 | **Replace/upgrade SendGrid for HIPAA compliance** -- Switch to AWS SES (BAA available) or Postmark (BAA available) if not on Twilio enterprise plan. | HIPAA | Medium | Critical | P1 -- High |
| 6 | **Add Stripe webhook event deduplication** -- Create `WebhookEvent` table with unique Stripe event ID constraint. Prevents duplicate processing on retries. | Payment | Medium | High | P1 -- High |
| 7 | **Add encryption roundtrip and audit completeness tests** -- Verify PHI is encrypted at rest and all access paths are audit-logged. Required for HIPAA compliance evidence. | Testing | Medium | Critical | P1 -- High |
| 8 | **Fix `ignoreBuildErrors` in CI** -- TypeScript errors are being suppressed in production builds. Fix root type errors instead. | Next.js | Medium | High | P2 -- Medium |
| 9 | **Configure Neon pooled connections + enable React Compiler** -- Two low-effort, high-reward performance improvements. Pooled connections prevent serverless connection exhaustion; React Compiler auto-memoizes. | Performance | Low | High | P2 -- Medium |
| 10 | **Consolidate dual encryption implementations and activate data retention** -- Unify `PHI_ENCRYPTION_KEY`/`ENCRYPTION_KEY`, wire up `data-retention.ts` to a scheduled job. | HIPAA | Medium | High | P2 -- Medium |

---

## File Reference Index

Key files mentioned in this report:

| File | Relevance |
|------|-----------|
| `lib/encryption/phi.ts` | PHI encryption (AES-256-GCM), key rotation |
| `lib/db/encryption-extension.ts` | Prisma auto-encrypt/decrypt extension |
| `lib/db/prisma.ts` | Database client, connection management |
| `lib/auth/mfa.ts` | TOTP-based MFA (physicians/admins only) |
| `lib/audit/logger.ts` | HIPAA audit logging singleton |
| `lib/hipaa/data-retention.ts` | Dead code -- data retention policy module |
| `lib/integrations/sendgrid.ts` | Email sending (HIPAA risk if no BAA) |
| `app/api/webhooks/stripe/route.ts` | Stripe webhook handler (no event deduplication) |
| `app/intake/IntakeClient.tsx` | 34-question intake form (no ARIA attributes) |
| `middleware.ts` | Route protection, JWT validation |
| `next.config.ts` | Build config (no React Compiler, no PPR, ignores build errors in CI) |
| `prisma/schema.prisma` | Database schema (has MFA columns) |
| `app/globals.css` | Theme tokens, prefers-reduced-motion |
| `tests/unit/encryption.test.ts` | Encryption unit tests (no roundtrip test) |

---

## Sources

### HIPAA Compliance
- [HIPAA Guidelines on Telemedicine - 2026](https://www.hipaajournal.com/hipaa-guidelines-on-telemedicine/)
- [2026 HIPAA Changes: New Security Rule Requirements](https://www.hipaavault.com/resources/2026-hipaa-changes/)
- [2026 HIPAA Rule: Mandatory MFA for ePHI Access](https://www.accountablehq.com/post/2026-hipaa-rule-mandatory-mfa-for-ephi-access-requirements-and-compliance-guide)
- [5 HIPAA Security Rule Changes in 2026](https://www.cbiz.com/insights/article/5-hipaa-security-rule-changes-in-2026-and-how-to-prepare)
- [New HIPAA Security Rule Updates](https://www.cyera.com/blog/new-hipaa-rules-mandate-mfa-and-encryption-for-ephi--is-your-organization-ready)
- [42 CFR Part 2 Final Rule](https://www.hhs.gov/hipaa/for-professionals/regulatory-initiatives/fact-sheet-42-cfr-part-2-final-rule/index.html)
- [February 16, 2026: Compliance Deadline for Part 2](https://www.hipaajournal.com/february-16-2026-compliance-deadline-part-2-final-rule/)
- [42 CFR Part 2 Civil Enforcement](https://foleyhoag.com/news-and-insights/blogs/security-privacy-and-the-law/2026/february/42-c-f-r-part-2-civil-enforcement-is-here-what-substance-use-disorder-providers-need-to-know/)

### Vendor BAA Status
- [Neon HIPAA Compliance](https://neon.com/docs/security/hipaa)
- [Neon HIPAA Announcement](https://neon.tech/blog/hipaa)
- [Netlify HIPAA Service Offering](https://www.netlify.com/blog/netlify-launches-a-hipaa-compliant-service-offering/)
- [Is SendGrid HIPAA Compliant?](https://www.paubox.com/blog/twilio-sendgrid-hipaa-compliant)
- [HIPAA BAA Requirements 2026](https://medcurity.com/hipaa-business-associate-agreement-requirements/)

### Next.js / React
- [Next.js 16 Release Blog](https://nextjs.org/blog/next-16)
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Partial Prerendering in Next.js 16](https://www.ashishgogula.in/blogs/a-practical-guide-to-partial-prerendering-in-next-js-16)
- [Cache Components Explained](https://webkul.com/blog/next-js-16-cache-components-explained/)
- [use cache Directive Documentation](https://nextjs.org/docs/app/api-reference/directives/use-cache)

### Telehealth UX
- [Healthcare UI Design 2026](https://www.eleken.co/blog-posts/user-interface-design-for-healthcare-applications)
- [Consumer Telehealth UX Design](https://everydayindustries.com/consumer-telehealth-user-experience-design-strategies/)
- [Telehealth for Substance Use Disorder](https://telehealth.hhs.gov/providers/best-practice-guides/telehealth-substance-use-disorder/getting-started-integrating)

### Accessibility
- [2026 WCAG 2.1 AA Healthcare Compliance](https://www.edreamz.com/blog/healthcare-website-accessibility-in-2026-what-wcag-21-aa-means-and-how-to-prepare)
- [May 2026 HHS Accessibility Deadline](https://www.mcdermottlaw.com/insights/may-2026-deadline-hhs-imposes-accessibility-standards-for-healthcare-company-websites-mobile-apps-kiosks/)
- [2026 Healthcare Accessibility Deadlines](https://www.modea.com/insights/2026-healthcare-accessibility-deadlines/)

### Payment / Stripe
- [Stripe Idempotent Requests](https://docs.stripe.com/api/idempotent_requests)
- [Stripe Webhook Best Practices](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks)
- [Stripe Healthcare Payment Processing](https://stripe.com/resources/more/healthcare-payment-processing-systems)

### Testing
- [HIPAA Compliance Testing Strategies 2026](https://blog.qasource.com/5-best-strategies-to-comply-with-hipaa-compliance-testing)
- [HIPAA Penetration Testing Requirements 2026](https://qualysec.com/hipaa-annual-penetration-testing-requirements/)
- [2026 HIPAA Security Rule Update](https://medcurity.com/hipaa-security-rule-2026-update/)
- [HIPAA Compliance Testing Checklist 2026](https://thinksys.com/security/hipaa-compliance-testing-checklist-for-healthcare-software/)

### Performance
- [Neon + Prisma Connection Guide](https://neon.com/docs/guides/prisma)
- [Neon Connection Pooling](https://neon.com/docs/connect/connection-pooling)
- [Prisma + Neon Accelerate](https://www.prisma.io/docs/guides/neon-accelerate)
- [Prisma Database Connections](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections)
