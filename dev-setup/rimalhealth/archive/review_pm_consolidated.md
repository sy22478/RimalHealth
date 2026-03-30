# PM Consolidated Review Report — RimalHealth

> **Date:** 2026-03-26
> **Teams deployed:** F (Code Review), G (Debugging), H (Architecture)
> **Total effort:** ~377K tokens, 250 tool calls across 3 agents
> **Overall health score:** 2.8/5

---

## Executive Summary

The RimalHealth codebase is functionally complete but has **critical security vulnerabilities** that must be fixed before any further production deploys. Two API routes expose PHI or auth tokens without authentication. The CI/CD pipeline has all quality gates disabled (`continue-on-error: true`), meaning broken code can reach production. Production secrets are hardcoded in `.claude/settings.local.json`. The architecture has significant dead code (1,305 lines of orphaned HIPAA modules) and test coverage is at 3.2%.

**Recommendation: STOP all feature work. Fix P0 issues first.**

---

## P0: CRITICAL — Fix Immediately (blocks all deploys)

| # | Finding | Source | File | Impact |
|---|---------|--------|------|--------|
| **P0-001** | `GET /api/stripe/checkout-session` has NO authentication. Anyone with a Stripe session ID can retrieve customer emails, set-password tokens, and trigger account creation. | G (BUG-001) | `app/api/stripe/checkout-session/route.ts` | **Live security vulnerability.** Patient PII exposed. |
| **P0-002** | `POST /api/intake` sends full PHI (name, email, phone, medical conditions, medications) in plaintext email to clinical team. Patient name in email subject. No auth, no audit logging. | G (BUG-002) | `app/api/patient/intake/route.ts` | **HIPAA violation.** PHI transmitted in plaintext email. |
| **P0-003** | SQL injection in physician patients route via `$queryRaw` with string interpolation. | F (F3-CRIT-001) | `app/api/physician/patients/route.ts:83-91` | **SQL injection.** Attacker could read/modify database. |
| **P0-004** | Patient emails logged to `console.log` in Stripe checkout and webhook routes. | F (F1-CRIT-002) | `app/api/stripe/checkout-session/route.ts`, `app/api/webhooks/stripe/route.ts` | **HIPAA violation.** PHI in server logs. |
| **P0-005** | ALL CI quality gates have `continue-on-error: true`. Lint, type-check, test failures don't block deployment. | H (ARCH-P0-002) | `.github/workflows/deploy.yml` | **Broken code deploys to production.** |
| **P0-006** | Production secrets (Neon DB password, Netlify auth token) hardcoded in `.claude/settings.local.json`. | H (ARCH-P0-001) | `.claude/settings.local.json` lines 31, 64-65 | **Credential exposure.** Rotate immediately. |
| **P0-007** | DB migrations run AFTER deploy in CI. If migration fails, live site references non-existent schema. | H (ARCH-P0-003) | `.github/workflows/deploy.yml` | **Schema mismatch on deploy.** |

### P0 Fix Plan (assign to Teams A + D)

```
STEP 1 — IMMEDIATE (Team D):
  1. Rotate Netlify auth token (P0-006)
  2. Rotate Neon DB password (P0-006)
  3. Replace .claude/settings.local.json with clean version

STEP 2 — SAME DAY (Team A):
  4. Add requireAuth to GET /api/stripe/checkout-session (P0-001)
  5. Remove console.log of patient emails in Stripe routes (P0-004)
  6. Fix SQL injection — use parameterized query in physician patients route (P0-003)
  7. Remove PHI from plaintext email in POST /api/intake or encrypt it (P0-002)

STEP 3 — SAME DAY (Team D):
  8. Remove continue-on-error: true from CI quality gates (P0-005)
  9. Move DB migrations to run BEFORE deploy (P0-007)

STEP 4 — Team F reviews all P0 fixes before deploy
```

---

## P1: HIGH — Fix This Week

| # | Finding | Source | File | Impact |
|---|---------|--------|------|--------|
| **P1-001** | `PhysicianMessage.subject` and `.body` not registered in encryption extension. Doctor-to-doctor messages stored as plaintext. | G (BUG-003) | `lib/db/encryption-extension.ts` | PHI in clinical discussions unencrypted. |
| **P1-002** | Stripe webhook creates User + PatientProfile + Subscription without DB transaction. Failure mid-way = orphaned records. | G (BUG-004) | `app/api/webhooks/stripe/route.ts` | Data integrity risk on payment flow. |
| **P1-003** | `PHI_ENCRYPTION_KEY` (the key actually used) is never validated at startup. `env-validation.ts` checks `ENCRYPTION_KEY` (dead code module's key). | G (BUG-005) | `lib/env-validation.ts` | App could start without encryption key, silently breaking PHI encryption. |
| **P1-004** | 4 patient document API routes lack `requireAuth`/`requireRole` — rely only on middleware-set headers. | F (F3-CRIT-003) | `app/api/patient/documents/*` | Defense-in-depth gap on document access. |
| **P1-005** | PHI stored in `sessionStorage` during intake form completion. | F (F1-WARN-001) | `app/intake/IntakeClient.tsx` | HIPAA violation — PHI in browser storage. |
| **P1-006** | `Prescription` model missing encryption on `medicationName`, `dosage`, `pharmacyName`. | F (F1-WARN-002) | `lib/db/encryption-extension.ts` | PHI fields stored as plaintext. |
| **P1-007** | Missing audit logging on 4 routes: onboarding/start, physician/profile, physician/colleagues, documents/download. | F (F1-WARN-003) | Various API routes | PHI access without audit trail. |
| **P1-008** | CSRF module exists but is not wired into any API route. | F (F3-WARN-006) | `lib/security/csrf.ts` | Form submissions lack CSRF protection. |
| **P1-009** | No rate limiting on change-password and all 4 MFA endpoints. | F (F3-WARN-005) | `app/api/auth/change-password/`, `app/api/auth/mfa/*` | Brute force risk on sensitive endpoints. |
| **P1-010** | DoseSpot webhook signature verification commented out. | F (F3-WARN-007) | `app/api/webhooks/dosespot/route.ts` | Spoofed webhook injection risk. |
| **P1-011** | Dual Stripe: 4 billing routes use legacy `lib/integrations/stripe.ts` while webhook uses `lib/stripe/stripe-server.ts`. | H | Various billing routes | Behavior divergence risk. |
| **P1-012** | 1,305 lines of orphaned HIPAA code (`lib/hipaa/audit-logger.ts` + `lib/hipaa/encryption.ts`) — zero imports, creates confusion. | G + H | `lib/hipaa/` | Developer confusion, maintenance burden. |
| **P1-013** | `ignoreBuildErrors: true` in `next.config.ts` for CI builds. | H | `next.config.ts:271` | Type errors don't fail builds. |
| **P1-014** | Token refresh extends sessions indefinitely — no absolute session timeout enforced. | H | `middleware.ts` | Session hijacking window unlimited. |

---

## P2: MEDIUM — Fix This Quarter

| # | Finding | Source |
|---|---------|--------|
| P2-001 | 32 components missing `'use client'` directive | F |
| P2-002 | Physician prescriptions page missing `force-dynamic` export | F |
| P2-003 | Test coverage at 3.2% (13 test files for 401 source files) | H |
| P2-004 | No connection pool configuration for Neon PostgreSQL | H |
| P2-005 | Data retention is declarative only — no automation, no soft-delete columns | H |
| P2-006 | No fail-safe against unprotected API routes (no route registration audit) | H |
| P2-007 | Physician components monolith (42 files, 15.5K lines in flat directory) | H |
| P2-008 | Redis TLS certificate verification disabled | H |
| P2-009 | Duplicated security headers between next.config.ts and netlify.toml | H |
| P2-010 | DoseSpot "production" code path returns mock success even with credentials | G |
| P2-011 | Vitest default config only runs integration tests (`npm test` skips unit tests) | G |

---

## Architecture Health Scorecard

| Area | Score | Key Issue |
|------|:-----:|-----------|
| CI/CD Pipeline | **2/5** | All quality gates disabled; migrations after deploy |
| Database Design | 3/5 | Good schema, no connection pooling, no indexes audit |
| Caching Strategy | 3/5 | Redis works but no TLS verification |
| Module Boundaries | **2.5/5** | Dual implementations, 1.3K dead HIPAA code |
| API Consistency | 3/5 | Good patterns but auth gaps on some routes |
| Testing Architecture | **1.5/5** | 3.2% coverage, config confusion |
| PHI Encryption Pipeline | 3/5 | Works but missing fields, wrong key validated |
| Auth Architecture | 3.5/5 | Solid JWT but no absolute session timeout |
| Audit Trail | **2.5/5** | One logger is dead code, 4 routes missing logging |
| Secrets Management | **1.5/5** | Production secrets in settings file |
| **Overall** | **2.8/5** | |

---

## Confirmed Dead Code

| File | Lines | Evidence |
|------|-------|---------|
| `lib/hipaa/audit-logger.ts` | 724 | 0 imports across entire codebase (G) |
| `lib/hipaa/encryption.ts` | 581 | Uses incompatible key format (base64 vs hex); not used by Prisma extension (G) |
| `lib/db/encryption-middleware.ts` | ~100 | Unclear usage — needs audit |

---

## Reports Location

| Team | Report | Size |
|------|--------|------|
| F (Code Review) | `dev-setup/rimalhealth/review_team_f_report.md` | Full findings with file:line references |
| G (Debugging) | `dev-setup/rimalhealth/review_team_g_report.md` | 11 bugs + 8 risks with fix instructions |
| H (Architecture) | `dev-setup/rimalhealth/review_team_h_report.md` | Scored assessment + 16 recommendations |

---

## Recommended Next Steps

1. **NOW:** Fix all P0 issues (assign Teams A + D). Block all deploys until complete.
2. **Team F reviews P0 fixes** before any deploy.
3. **This week:** Fix P1-001 through P1-010 (PHI encryption gaps, auth gaps, CSRF).
4. **This week:** Remove dead code (P1-012) to reduce confusion.
5. **Next sprint:** Address P2 items, starting with test coverage (P2-003).
6. **Schedule:** Team G weekly integration health sweeps, Team H quarterly arch reviews.
