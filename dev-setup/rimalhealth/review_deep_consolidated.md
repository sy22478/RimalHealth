# PM Deep Review — Consolidated Report

> **Date:** 2026-03-26
> **Teams:** F (Code Review), G (Debugging), H (Architecture), Research
> **Total effort:** ~521K tokens, 278 tool calls
> **Architecture health:** 2.8/5 -> **3.7/5** (+0.9 from sprint)

---

## Executive Summary

The sprint significantly improved the codebase — all P0 security issues fixed, app flow redesigned, dead code removed, encryption gaps closed. Architecture score improved from 2.8 to 3.7/5. However, the deep review uncovered **4 new CRITICAL issues** (double-encryption corrupting data, PHI in auto-save module, missing rate limiting, weak document auth) and a **major compliance finding** (42 CFR Part 2 for substance use disorder treatment, enforcement active since Feb 2026).

---

## P0: CRITICAL — Fix Immediately

| # | Finding | Source | Impact |
|---|---------|--------|--------|
| **P0-A** | **Double-encryption bug:** `app/api/physician/review/route.ts` manually calls `encryptPHI()` on clinicalNotes/rejectionReason, then Prisma extension encrypts AGAIN. Data becomes unreadable. Same issue in `app/api/patient/profile/route.ts` (double-decrypt). | F (CRIT-3) + G (BUG-012) | **Data corruption** — physician notes and patient profiles corrupted on write/read |
| **P0-B** | **PHI auto-save module still exists:** `lib/intake/auto-save.ts` writes unencrypted PHI to sessionStorage. Not used by new IntakeClient but remains importable. | F (CRIT-1) | **HIPAA violation risk** — accidental import leaks PHI to browser |
| **P0-C** | **No rate limiting on verify-email:** `app/api/auth/verify-email/route.ts` — can brute-force verification tokens. | F (CRIT-2) | **Token brute-force** — unlimited attempts to guess verification tokens |
| **P0-D** | **Webhook returns 200 on errors:** `app/api/webhooks/stripe/route.ts` returns HTTP 200 even when processing fails. Stripe won't retry. Customer pays but never gets account. | G (BUG-020) | **Payment loss** — paid customers can be silently dropped |

### P0 Fix Plan
```
1. Remove manual encryptPHI/decryptPHI calls from physician/review and patient/profile routes (Prisma extension handles it)
2. Delete lib/intake/auto-save.ts entirely (or gut it to be server-only)
3. Add rate limiting to verify-email route (same pattern as verify-token)
4. Change webhook error responses from 200 to 500 so Stripe retries
```

---

## P1: HIGH — Fix This Week

| # | Finding | Source |
|---|---------|--------|
| **P1-A** | `billingState`, `User.mfaSecret`, `User.mfaBackupCodes` NOT in encryption extension — plaintext PHI in DB | G (BUG-013) |
| **P1-B** | `submitIntakeSchema` accepts arbitrary `z.record(z.string(), z.unknown())` — no server-side validation of 34 questions | G (BUG-015) |
| **P1-C** | Medication name in REFILL_REQUESTED email template — PHI leak | F (WARN-1) |
| **P1-D** | 7 routes still use legacy `lib/integrations/stripe.ts` instead of canonical `lib/stripe/` | H |
| **P1-E** | `ENCRYPTION_KEY` still in env-validation but its consumer was deleted | G (BUG-018) + H |
| **P1-F** | Payment notification URLs point to `/dashboard/billing` (doesn't exist, should be `/patient/billing`) | G (BUG-014) |
| **P1-G** | Login 403 includes `email` in response body — account enumeration | G (BUG-016) |
| **P1-H** | `opioidUse`/`opioidMaintenance` intake fields still missing from validation schema | F (WARN-5) |
| **P1-I** | Zero `loading.tsx` files — blank screens during all page transitions | G (BUG-017) |
| **P1-J** | Email retry queue implemented but no worker calls it — failed emails permanently lost | G (BUG-019) |

---

## Compliance: 42 CFR Part 2 (URGENT)

The Research Team found that **42 CFR Part 2** (the federal regulation for substance use disorder treatment records) applies to RimalHealth and enforcement began **February 16, 2026**. This is in ADDITION to HIPAA.

**Key requirements not yet met:**
1. SUD-specific consent management (separate from HIPAA consent)
2. Accounting of disclosures (tracking who accessed SUD records and when)
3. Updated privacy notices mentioning 42 CFR Part 2 protections
4. Patient MFA now **mandatory** for ePHI access (2026 HIPAA Security Rule)
5. Verify BAAs with Neon, Netlify, and SendGrid (SendGrid may NOT sign BAAs on standard plans)

---

## Architecture Health (Before vs After Sprint)

| Area | Before | After | Change | Remaining Issue |
|------|:------:|:-----:|:------:|-----------------|
| CI/CD Pipeline | 2.0 | **3.5** | +1.5 | `ignoreBuildErrors` still active |
| Database Design | 3.0 | 3.5 | +0.5 | No connection pooling |
| Caching Strategy | 3.0 | 3.0 | 0 | No changes made |
| Module Boundaries | 2.5 | **3.5** | +1.0 | Dual Stripe still (7 routes) |
| API Consistency | 3.0 | 3.5 | +0.5 | Some routes don't follow pattern |
| Testing Architecture | 1.5 | 1.5 | 0 | 2.6% coverage, no new tests |
| PHI Encryption Pipeline | 3.0 | **4.0** | +1.0 | Double-encryption bug (P0-A) |
| Auth Architecture | 3.5 | **4.5** | +1.0 | Strong flow, minor token issues |
| Audit Trail | 2.5 | **3.5** | +1.0 | Single logger, good coverage |
| Secrets Management | 1.5 | 2.0 | +0.5 | Still needs rotation |
| **Overall** | **2.8** | **3.7** | **+0.9** | |

---

## Research: Top 10 Improvements

| # | Improvement | Area | Effort | Impact | Priority |
|---|------------|------|--------|--------|----------|
| 1 | 42 CFR Part 2 compliance (SUD consent, disclosures) | Compliance | L | Critical | P0 |
| 2 | Verify/obtain BAAs from all vendors | Compliance | M | Critical | P0 |
| 3 | Add patient MFA (mandatory per 2026 HIPAA Rule) | Security | M | High | P1 |
| 4 | WCAG 2.1 AA accessibility audit (legally required by May 2026) | UX | M | High | P1 |
| 5 | Stripe webhook idempotency (event ID deduplication table) | Payment | S | High | P1 |
| 6 | Test coverage for encryption roundtrips + audit completeness | Testing | M | High | P1 |
| 7 | Neon connection pooling for serverless | Performance | S | Medium | P2 |
| 8 | Enable Next.js PPR for marketing pages | Performance | S | Medium | P2 |
| 9 | Implement data retention automation (currently declarative only) | Compliance | L | Medium | P2 |
| 10 | Replace SendGrid with BAA-capable provider (AWS SES/Postmark) | Compliance | M | Medium | P2 |

---

## Reports Location

| Team | Report | Key Finding |
|------|--------|-------------|
| F | `review_deep_f_report.md` | 4 CRITICAL, 9 WARNING |
| G | `review_deep_g_report.md` | 9 bugs (1 P1, 4 P2, 4 P3), 6 risks |
| H | `review_deep_h_report.md` | Score 3.7/5, 8 prioritized recommendations |
| Research | `research_improvements.md` | 42 CFR Part 2 compliance gap, 10 improvements |
