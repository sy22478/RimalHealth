# Tech Debt Register

> **Initiative:** Comprehensive Code Review & Improvement Sweep
> **Date:** 2026-03-29
> **Total Items:** 45 catalogued (across all teams)

---

## Tier 1 — Should Fix Soon (P1)

| # | Category | Item | Source | Effort |
|---|----------|------|--------|--------|
| 1 | Security | CSRF protection on 48+ routes | Architecture | Large |
| 2 | Security | DoseSpot webhook signature unimplemented | Tech Debt | Small |
| 3 | Security | Middleware token version validation order | Backend | Medium |
| 4 | Performance | N+1 queries in physician patient details | Backend | Medium |
| 5 | Auth | Session timeout not enforced in direct API calls | Backend | Medium |
| 6 | Auth | Missing rate limiting on admin endpoints | Backend | Small |
| 7 | Security | File path sanitization in S3 upload | Architecture | Small |
| 8 | Compliance | Missing audit logging on some PHI access paths | Architecture | Medium |

---

## Tier 2 — Should Schedule (P2)

| # | Category | Item | Source | Effort |
|---|----------|------|--------|--------|
| 9 | Architecture | API error handling wrapper for 86 routes | Tech Debt | Large |
| 10 | Architecture | Split large utility files (617+ lines each) | Tech Debt | Large |
| 11 | Architecture | Split data-retention.ts (1258 lines) | Tech Debt | Large |
| 12 | Architecture | Split rate-limit.ts (800 lines) | Tech Debt | Medium |
| 13 | Code Quality | 8 components exceed 300 lines | Frontend | Large |
| 14 | Code Quality | Missing React.memo for list items | Frontend | Medium |
| 15 | Dependencies | Radix UI duplication (individual + umbrella) | Tech Debt | Small |
| 16 | Dependencies | AWS SDK v3 used minimally, large bundle | Tech Debt | Medium |
| 17 | Type Safety | `as any` in Prisma client event handler | Tech Debt | Small |
| 18 | State Mgmt | Stale closures in queue auto-refresh | Frontend | Medium |
| 19 | State Mgmt | Derived state stored in useState | Frontend | Small |
| 20 | Performance | Missing dynamic imports for tab content | Frontend | Medium |
| 21 | UX | Inconsistent loading/skeleton patterns | Frontend + UX | Medium |
| 22 | UX | Missing empty state guidance text | UX | Small |
| 23 | UX | Missing success feedback (toast) for actions | UX | Medium |
| 24 | UX | Missing progress indicator in checkout flow | UX | Medium |
| 25 | UX | Responsive gaps at tablet sizes | Frontend | Medium |
| 26 | Security | Webhook idempotency — SELECT-then-INSERT pattern | Backend | Medium |
| 27 | Security | Contact form email header injection risk | Backend | Small |
| 28 | Performance | Missing pagination in messages thread list | Backend | Small |
| 29 | Validation | Inconsistent password strength validation | Backend | Small |
| 30 | Database | Missing composite index on Session(userId, expiresAt) | Backend | Small |

---

## Tier 3 — Nice to Have (P3)

| # | Category | Item | Source | Effort |
|---|----------|------|--------|--------|
| 31 | Config | React Compiler disabled (RHF incompatibility) | Tech Debt | Medium |
| 32 | Config | PPR disabled (force-dynamic conflicts) | Tech Debt | Large |
| 33 | Naming | Inconsistent test file naming (.test.ts vs .spec.ts) | Tech Debt | Medium |
| 34 | Dependencies | Potentially unused @types/supertest | Tech Debt | Trivial |
| 35 | Dead Code | Placeholder redirect in next.config.ts | Tech Debt | Trivial |
| 36 | Dead Code | Commented DoseSpot import | Tech Debt | Trivial |
| 37 | API | Missing API versioning strategy | Backend | Medium |
| 38 | API | Missing compression middleware | Backend | Small |
| 39 | UX | No dark mode support | UX | Large |
| 40 | UX | Glassmorphism on modals | UX | Small |
| 41 | UX | Sidebar width on tablet | UX | Small |
| 42 | UX | Dashboard H1 vs H2 heading level | UX | Trivial |
| 43 | Frontend | document.getElementById anti-pattern in LoginForm | Frontend | Small |
| 44 | Frontend | Prop drilling in patient profile components | Frontend | Medium |
| 45 | Logging | Overly verbose audit logging in webhook | Backend | Trivial |

---

## Resolution Status

| Tier | Total | Fixed This Sweep | Remaining |
|------|-------|-----------------|-----------|
| Tier 1 | 8 | 0 | 8 |
| Tier 2 | 22 | 0 | 22 |
| Tier 3 | 15 | 3 | 12 |
| **Total** | **45** | **3** | **42** |
