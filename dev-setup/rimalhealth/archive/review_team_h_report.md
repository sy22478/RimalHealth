# Team H: Architecture Review Report -- RimalHealth
## Date: 2026-03-26

## Executive Summary

RimalHealth demonstrates solid foundational architecture for a HIPAA-compliant telehealth platform, with well-structured route groups, a thoughtful encryption pipeline, and comprehensive RBAC. However, the system suffers from **three systemic patterns that undermine its production readiness**: (1) pervasive dual implementations (Stripe, encryption, audit logging) that create divergence risk and maintenance burden, (2) a CI/CD pipeline where every quality gate uses `continue-on-error: true`, effectively making the pipeline decoration rather than enforcement, and (3) an exposed production secret (Netlify auth token and database connection string) in a committed settings file. **Overall Health Score: 2.8/5** -- structurally sound but with critical operational and security gaps.

---

## Architecture Health Scorecard

| Area | Score (1-5) | Key Concern |
|------|:-----------:|-------------|
| CI/CD Pipeline | 2 | All quality gates are `continue-on-error: true`; linting, type-checking, and tests are advisory only |
| Database Design | 4 | Comprehensive schema with 60+ indexes, proper relations; minor concern on connection pooling config |
| Caching Strategy | 4 | Well-designed Redis layer with circuit breaker, TTL tiers, and HIPAA-aware cache policy |
| Module Boundaries | 2.5 | Three duplicate module pairs (Stripe, encryption, audit) create confusion about canonical implementations |
| API Consistency | 4 | Consistent auth pattern (`requireRole`), validation (`Zod`), audit logging, and error format across routes |
| Testing Architecture | 1.5 | 13 test files for 401 source files (3.2% ratio); no component tests, no service tests, no audit tests |
| PHI Encryption Pipeline | 3 | Primary pipeline (`lib/encryption/phi.ts` -> extension -> Prisma) is sound; two orphaned alternatives confuse |
| Auth Architecture | 4 | JWT with proper expiry, `jose` for Edge compat, per-route auth for APIs, comprehensive RBAC (39 permissions) |
| Audit Trail | 3 | `lib/audit/logger.ts` is authoritative and well-structured; 7-year retention is declared but not enforced by automation |
| Secrets Management | 1 | Netlify auth token and DATABASE_URL exposed in `.claude/settings.local.json`; no rotation policy |
| **Overall** | **2.8** | **Good design, poor operational discipline** |

---

## H1: Infrastructure Architecture Assessment

### CI/CD Pipeline

**Files reviewed:** `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`, `.github/workflows/lighthouse.yml`, `next.config.ts`, `netlify.toml`

**Findings:**

1. **All quality gates in the deploy pipeline are `continue-on-error: true`.** Lines 68, 72, 76, 85, and 109 of `deploy.yml` mark linting, type-checking, unit tests, integration tests, and `npm audit` as non-blocking. This means a deploy proceeds even if ALL tests fail, ALL lints fail, and ALL type checks fail.

2. **`ignoreBuildErrors` is enabled in CI.** `next.config.ts` line 270: `ignoreBuildErrors: process.env.NODE_ENV === "development" || !!process.env.CI`. TypeScript errors do not fail the build in CI.

3. **Database migrations run AFTER deploy** (deploy.yml lines 157-160). If a migration fails, the live site is already deployed and may reference schema elements that do not exist. This ordering should be reversed.

4. **The CI workflow (`ci.yml`) is properly structured** with separate lint, unit-test, integration-test, security, and build jobs. However, PR CI and deploy CI are not linked -- a PR can pass CI but fail the deploy pipeline because deploy uses different `continue-on-error` settings.

5. **Lighthouse CI** runs daily and on PRs with proper artifact upload and PR commenting. This is well-implemented.

6. **`netlify.toml`** is minimal but correct. Security headers are defined both here and in `next.config.ts` -- potential for divergence.

### Database Architecture

**Files reviewed:** `prisma/schema.prisma` (908 lines), `lib/db/prisma.ts` (381 lines)

**Findings:**

1. **Index coverage is excellent.** 60+ `@@index` directives cover all foreign keys and common query patterns (status filters, date ranges, composite indexes for joined queries like `[patientId, status]`, `[threadId, recipientId]`).

2. **Connection pooling uses `pg` Pool** via `@prisma/adapter-pg`, but the Pool is created with only the connection string -- no `max`, `min`, `idleTimeoutMillis`, or `connectionTimeoutMillis` settings. In `lib/db/prisma.ts` line 125: `new Pool({ connectionString: dbUrl })`. Default `pg` pool size is 10, which may be insufficient under load on Netlify serverless functions (each cold start creates a new pool).

3. **Build-time safety proxy** (lines 200-243) is well-designed, preventing DB calls during static generation.

4. **No soft-delete implementation at the schema level.** The data retention module (`lib/hipaa/data-retention.ts`) references soft delete, but no `deletedAt` column exists on any model. The retention policy is declarative only.

### Caching Architecture

**Files reviewed:** `lib/redis/client.ts` (267 lines), `lib/redis/cache.ts` (306 lines), `lib/middleware/api-cache.ts` (288 lines)

**Findings:**

1. **Circuit breaker pattern** in `lib/redis/client.ts` is well-implemented (5-failure threshold, 30s cooldown, half-open probe). This prevents Redis outages from cascading.

2. **TTL hierarchy** is well-defined: SHORT (30s), MEDIUM (60s), LONG (5min), EXTENDED (15min). Cache keys use SHA-256 hashes for consistent length.

3. **HIPAA compliance** is addressed: comments state no PHI in cache keys, hashed identifiers, encrypted session data. The `withCache` wrapper gracefully degrades when the circuit breaker is open.

4. **Cache hit/miss stats** (`api-cache.ts` lines 264-287) are in-memory only and reset on deploy. No persistent monitoring.

5. **`rejectUnauthorized: false`** in TLS config (`client.ts` line 165) disables certificate verification for Redis TLS. This is a security concern even if documented as "Required for Upstash."

---

## H2: Application Architecture Assessment

### Module Boundary Assessment

**Files reviewed:** All `lib/` subdirectories via P2 analysis

| Module | Lines | Files | Assessment |
|--------|-------|-------|------------|
| `lib/integrations/` | 4,472 | 8 | **Too large** -- contains 5 unrelated services. Should split into per-service modules. |
| `lib/auth/` | 3,291 | 10 | Appropriate size for scope (JWT, sessions, RBAC, passwords, MFA, lockout) |
| `lib/hipaa/` | 2,908 | 5 | **Partially orphaned** -- `audit-logger.ts` (724 lines) is not imported anywhere; `encryption.ts` (581 lines) is not imported anywhere. Only `data-retention.ts` and `phi-identifiers.ts` provide unique value. |
| `lib/audit/` | 2,293 | ~5 | **Authoritative audit system** -- used by all API routes |
| `lib/encryption/` | 548 | ~2 | **Canonical encryption** -- used by Prisma extension and 8 API routes |

### Dual Implementation Inventory

| System | Implementation A | Implementation B | Canonical | Action |
|--------|-----------------|------------------|-----------|--------|
| **Stripe** | `lib/integrations/stripe.ts` (693 lines) -- used by 4 billing routes | `lib/stripe/stripe-server.ts` + 3 files (1,292 lines) -- used by webhook + checkout | **Both are active** | Consolidate into `lib/stripe/` (newer); migrate billing routes |
| **Encryption** | `lib/encryption/phi.ts` (318 lines) -- used by Prisma extension + 8 routes, uses `PHI_ENCRYPTION_KEY` (hex) | `lib/hipaa/encryption.ts` (581 lines) -- **not imported anywhere**, uses `ENCRYPTION_KEY` (base64) | `lib/encryption/phi.ts` | Delete `lib/hipaa/encryption.ts` |
| **Audit Logging** | `lib/audit/logger.ts` (661 lines) -- used by all API routes | `lib/hipaa/audit-logger.ts` (724 lines) -- **not imported by any API route** (only by `data-retention.ts` internally) | `lib/audit/logger.ts` | Delete or merge `lib/hipaa/audit-logger.ts` |
| **DB Encryption** | `lib/db/encryption-extension.ts` (493 lines) -- active Prisma extension | `lib/db/encryption-middleware.ts` (26 lines) -- deprecated, throws error | Extension | Delete `encryption-middleware.ts` |
| **DB Encryption Facade** | `lib/db/encryption.ts` -- re-exports from `lib/encryption/phi.ts` | N/A | N/A | Thin wrapper, acceptable but unused (no imports outside itself) |

### Component Architecture

**`components/physician/`**: 42 files, 15,582 lines -- the largest component group by far. This is a monolithic module. Key sub-concerns:
- Queue management (5-6 components)
- Patient detail views (PatientDetailView 798 lines, PatientNotes 726 lines)
- Messaging (MessageThread, MessageList, etc.)
- Prescriptions
- Review workflows

Recommendation: Split into `physician/queue/`, `physician/patients/`, `physician/messaging/`, `physician/prescriptions/`, `physician/reviews/` subdirectories.

### API Design Consistency

**Sampled 10 API routes:** `patient/profile`, `patient/messages`, `patient/intake`, `patient/billing`, `physician/queue`, `physician/review`, `physician/patients`, `admin/physicians`, `stripe/checkout-session`, `webhooks/stripe`

**Consistency findings (positive):**
- All use `requireRole()` from `lib/auth/require-auth.ts` for auth (except public routes)
- All return `NextResponse.json()` with consistent error format: `{ error: string, code: string, details?: unknown }`
- All use `AuditService.createAuditContext()` for audit logging
- All use Zod for input validation (either via `ValidationService.validateQueryParams()` or inline `schema.safeParse()`)
- All follow the pattern: auth check -> input validation -> business logic -> audit log -> response

**Consistency findings (negative):**
- **Validation approach diverges:** Patient/physician routes use `ValidationService.validateQueryParams()`, while admin routes do inline `querySchema.safeParse()`. The admin route (`admin/physicians/route.ts`) defines its Zod schema inline rather than importing from `lib/validation/schemas.ts`.
- **Some routes import `encryptPHI`/`decryptPHI` directly** (8 routes) even though the Prisma extension handles encryption automatically. This suggests either the extension is not trusted or there is confusion about when manual encryption is needed.

### Testing Architecture

**Files reviewed:** `vitest.config.ts`, `vitest.unit.config.ts`, `vitest.integration.config.ts`, `playwright.config.ts`

| Metric | Value | Assessment |
|--------|-------|------------|
| Test files | 13 (5 unit, 4 integration, 5 E2E) | Critically low |
| Source files | 401 | |
| Test:source ratio | 3.2% | Target: 30-50% |
| Covered domains | Auth, encryption, RBAC, validation, webhooks | |
| Uncovered domains | Notifications, S3, DoseSpot, Twilio, CSRF, rate limiting, audit logging, ALL components | Critical gap |

**Configuration issues:**
- `vitest.config.ts` (the default) only includes integration tests. Running `npm test` skips all unit tests. This is confusing and documented in P2.
- Unit and integration configs are well-separated (threads vs forks, 10s vs 30s timeouts).
- Playwright config is comprehensive (5 browser/device configs, traces, screenshots, video on retry).

---

## H3: Security & Compliance Architecture Assessment

### PHI Encryption Pipeline

**Complete flow (verified through file reads and import tracing):**

```
PHI_ENCRYPTION_KEY (hex, 64+ chars)
  -> lib/encryption/phi.ts: getEncryptionKey() derives 32-byte key via scrypt
  -> encryptPHI() / decryptPHI() use AES-256-GCM with random IV + auth tag
  -> lib/db/encryption-extension.ts: Prisma extension calls encryptPHI/decryptPHI
  -> lib/db/prisma.ts: prisma.$extends(createEncryptionExtension())
  -> All Prisma operations auto-encrypt/decrypt 6 models, 28 PHI fields
```

**Orphaned alternatives (NOT in the critical path):**
- `lib/hipaa/encryption.ts` -- Uses `ENCRYPTION_KEY` (base64 format), different key derivation. **Zero imports** from any route or service. Dead code.
- `lib/db/encryption-middleware.ts` -- Deprecated, throws error. Dead code.
- `lib/db/encryption.ts` -- Re-exports from `lib/encryption/phi.ts`. Not imported by any route.

**Key rotation:** `lib/encryption/phi.ts` exports `rotateEncryptionKey()` (lines 268-293), which decrypts with the current key and re-encrypts with a new one. However, there is no batch rotation script or automated rotation trigger. Key rotation would require manually iterating all encrypted records.

**Concern -- fixed salt:** `phi.ts` line 53 uses `'phi_encryption_salt_v1'` as a fixed salt for scrypt key derivation. This is documented as acceptable because the input key is high-entropy, but it means all encrypted values derive from the same key material. If the master key leaks, all data is compromised with no per-record diversity.

### Auth Architecture

**Files reviewed:** `lib/auth/jwt.ts`, `lib/auth/rbac.ts`, `lib/auth/require-auth.ts`, `middleware.ts`

**Strengths:**
- JWT uses `jose` library (Edge-compatible), HS256 with audience + issuer claims
- Access tokens: 15 min expiry; refresh tokens: 7 days with `tokenVersion` for invalidation
- No PHI in tokens (userId, email, role only)
- 39 permissions mapped to 3 roles with proper HIPAA minimum-necessary enforcement
- `canAccessPatient()` enforces data isolation (patients see only their own data)

**Concern -- API routes bypass middleware:** `middleware.ts` line 62 explicitly excludes `/api/*` from the middleware matcher via `STATIC_ROUTES`. API auth is handled per-route by `requireRole()` / `requireAuth()`. This is a common Next.js pattern but creates risk: a developer who adds a new API route and forgets to call `requireRole()` leaves it completely unprotected. There is no fail-safe.

**Concern -- token refresh extends cookie without verification:** `middleware.ts` lines 272-281 refresh the `accessToken` cookie on every authenticated request. The token is re-set with a new 15-minute `maxAge` but the same token value. This effectively extends the session indefinitely as long as the user makes requests within 15-minute intervals, undermining the short-lived token design.

### Audit Trail Architecture

**Authoritative system:** `lib/audit/logger.ts` (`AuditLogger` class, 661 lines)
- Used by all API routes (confirmed via import tracing: 20+ files import from `@/lib/audit/*`)
- Writes to `AuditLog` Prisma model
- Falls back to `console.error` on DB failure (critical for HIPAA -- must not lose events)
- Provides `logAuth()`, `logPHIAccess()`, `logDataModification()`, `queryLogs()`, `exportAuditLogs()`

**Orphaned system:** `lib/hipaa/audit-logger.ts` (724 lines)
- **Zero imports from any API route** (verified via grep)
- Only used internally by `lib/hipaa/data-retention.ts`
- Has a different interface (`AuditEvent` vs `AuditLogEntry`)

**7-year retention:** `DATA_RETENTION.AFTER_CLOSURE = 2555 days` is defined in `lib/constants.ts`. The `lib/hipaa/data-retention.ts` module defines retention policies. However:
- No scheduled job (cron, serverless function) actually runs the retention cleanup
- No `deletedAt` column exists in any Prisma model for soft-delete tracking
- The retention policy is **entirely declarative** -- it defines rules but nothing executes them

### Secrets Management

**Critical finding -- exposed secrets in `.claude/settings.local.json`:**

Line 31: `DATABASE_URL="postgresql://neondb_owner:npg_amzqY3bBKG5f@ep-morning-wind-ae70h0u4.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"`

Lines 64-65: `NETLIFY_AUTH_TOKEN=nfp_e7CeWeCy5MsQVAhAKRkbxRqLHWv1bee70389`

These are **production credentials** embedded in a file that is committed to the repository (not in `.gitignore`). Anyone with repo access has full database read/write access and can deploy to production.

**Other findings:**
- `PHI_ENCRYPTION_KEY` test value is in CI env vars (`deploy.yml` line 81: `test-encryption-key-for-ci-only`). This is appropriate for CI but should be verified it is not used in production.
- No secrets rotation policy exists
- No secret scanning in the deploy pipeline (TruffleHog runs in CI but with `--only-verified` flag, which may miss plaintext credentials)
- `env-validation.ts` validates presence of required vars but does not validate format (e.g., key length, key entropy)

---

## Recommendations (Prioritized)

### ARCH-P0-001: Rotate Exposed Secrets Immediately (Must fix)
- **Area:** Security
- **Current State:** `.claude/settings.local.json` contains production Neon database URL (with password) and Netlify deploy token in plaintext
- **Problem:** Any person or system with repository access can read the production database or deploy arbitrary code. This is a HIPAA breach vector.
- **Recommendation:**
  1. Rotate the Neon database password immediately
  2. Rotate the Netlify auth token
  3. Add `.claude/settings.local.json` to `.gitignore`
  4. Remove the file from git history using `git filter-repo` or BFG Repo-Cleaner
  5. Audit git history for other exposed secrets
- **Effort:** S (1-2 hours for rotation; M for history cleaning)
- **Risk if Not Fixed:** Full database compromise, unauthorized production deployments, HIPAA violation
- **Implementing Team:** Team D (Operations)

### ARCH-P0-002: Make CI Quality Gates Blocking (Must fix)
- **Area:** Infrastructure
- **Current State:** `deploy.yml` lines 68, 72, 76, 85 -- lint, type-check, unit tests, integration tests all have `continue-on-error: true`
- **Problem:** Broken code deploys to production. TypeScript errors, test failures, and lint violations do not prevent deployment.
- **Recommendation:** Remove `continue-on-error: true` from lint, type-check, and test steps. If there are known flaky tests, fix them or use retry mechanisms rather than ignoring all failures.
- **Effort:** S (change 4 YAML lines, then fix any currently-broken checks)
- **Risk if Not Fixed:** Regressions ship to production undetected
- **Implementing Team:** Team D (Operations)
- **File:** `.github/workflows/deploy.yml`

### ARCH-P0-003: Fix Migration-After-Deploy Ordering (Must fix)
- **Area:** Infrastructure
- **Current State:** `deploy.yml` deploys to Netlify (line 155), THEN runs `prisma migrate deploy` (line 158)
- **Problem:** If a code change requires a new database column, the live site will error for all users during the window between deploy and migration. If the migration fails, the site is broken with no automatic rollback.
- **Recommendation:** Run migrations BEFORE deploy. Add a rollback step if migration fails. Consider using Neon branching for zero-downtime migrations.
- **Effort:** S (reorder YAML steps)
- **Risk if Not Fixed:** User-facing errors during every migration, potential data loss if migration fails
- **Implementing Team:** Team D (Operations)
- **File:** `.github/workflows/deploy.yml`

### ARCH-P1-001: Consolidate Dual Stripe Implementations (Should fix this quarter)
- **Area:** Application
- **Current State:** `lib/integrations/stripe.ts` (693 lines) used by 4 billing routes; `lib/stripe/stripe-server.ts` (+ 3 files, 1,292 lines) used by webhook + checkout
- **Problem:** Two Stripe clients with the same API version but different initialization patterns. Bug fixes in one may not be applied to the other.
- **Recommendation:** Make `lib/stripe/` the canonical module. Migrate the 4 billing routes (`patient/billing/route.ts`, `patient/billing/invoices/[id]/download/route.ts`, `patient/billing/portal/route.ts`, `patient/billing/cancel/route.ts`) to use `lib/stripe/stripe-server.ts`. Delete `lib/integrations/stripe.ts`.
- **Effort:** M (migrate 4 routes, test payment flows)
- **Risk if Not Fixed:** Behavioral divergence between checkout and billing; double maintenance burden
- **Implementing Team:** Team A (Core Services)

### ARCH-P1-002: Delete Orphaned HIPAA Modules (Should fix this quarter)
- **Area:** Application / Security
- **Current State:**
  - `lib/hipaa/encryption.ts` (581 lines) -- zero imports, uses different key format (`ENCRYPTION_KEY` base64 vs `PHI_ENCRYPTION_KEY` hex)
  - `lib/hipaa/audit-logger.ts` (724 lines) -- zero imports from API routes
  - `lib/db/encryption-middleware.ts` (26 lines) -- deprecated, throws error
  - `lib/db/encryption.ts` -- re-export facade, not imported
- **Problem:** Dead code that (a) confuses developers about which module is canonical, (b) creates false confidence that features exist when they are not actually wired up, and (c) references `ENCRYPTION_KEY` env var that may diverge from the actual `PHI_ENCRYPTION_KEY`.
- **Recommendation:** Delete `lib/hipaa/encryption.ts`, `lib/db/encryption-middleware.ts`, and `lib/db/encryption.ts`. Refactor `lib/hipaa/data-retention.ts` to import from `lib/audit/logger.ts` instead of `lib/hipaa/audit-logger.ts`, then evaluate whether `lib/hipaa/audit-logger.ts` can be deleted entirely.
- **Effort:** M (careful deletion with import verification)
- **Risk if Not Fixed:** Developer confusion, accidental use of wrong encryption module, env var sprawl
- **Implementing Team:** Team C (HIPAA)

### ARCH-P1-003: Increase Test Coverage (Should fix this quarter)
- **Area:** Testing
- **Current State:** 13 test files for 401 source files (3.2%). No tests for: notification service, S3 integration, DoseSpot, Twilio, CSRF, rate limiting, audit logging, any React components.
- **Problem:** For a HIPAA-compliant medical platform, this coverage level is unacceptable. Regressions in PHI handling, authentication, or billing could go undetected.
- **Recommendation:**
  1. Add unit tests for `lib/audit/logger.ts` (critical for HIPAA compliance verification)
  2. Add unit tests for `lib/services/notification-service.ts` (email sending with PHI)
  3. Add unit tests for `lib/security/rate-limit.ts` and `lib/security/csrf.ts`
  4. Add component tests for critical flows (IntakeForm, CheckoutPaymentClient)
  5. Fix default `vitest.config.ts` to include both unit and integration tests
  6. Target: 30% test:source file ratio by end of quarter
- **Effort:** L (ongoing)
- **Risk if Not Fixed:** Regressions in security, compliance, and core business logic
- **Implementing Team:** All teams

### ARCH-P1-004: Remove `ignoreBuildErrors` in CI (Should fix this quarter)
- **Area:** Infrastructure
- **Current State:** `next.config.ts` line 270: `ignoreBuildErrors: process.env.NODE_ENV === "development" || !!process.env.CI`
- **Problem:** TypeScript errors in production code are silently ignored during CI builds. This defeats the purpose of using TypeScript strict mode.
- **Recommendation:** Set `ignoreBuildErrors: false` (or remove the line). Fix any existing type errors that surface. Run `npm run type-check` as a required step before build.
- **Effort:** M (may surface type errors to fix)
- **Risk if Not Fixed:** Type-unsafe code in production; runtime errors from type mismatches
- **Implementing Team:** Team D (Operations)
- **File:** `next.config.ts`

### ARCH-P1-005: Implement Data Retention Automation (Should fix this quarter)
- **Area:** Security / Compliance
- **Current State:** `lib/hipaa/data-retention.ts` defines retention policies declaratively but nothing executes them. No `deletedAt` columns exist in the schema. The 7-year audit log retention is a constant, not an enforced mechanism.
- **Problem:** HIPAA requires both retention AND deletion. Data that should be purged after the retention period is never purged. There is no soft-delete mechanism.
- **Recommendation:**
  1. Add `deletedAt DateTime?` to relevant models (User, PatientProfile, Intake, Message)
  2. Create a scheduled job (Netlify scheduled function or cron) that runs the retention cleanup
  3. Add an AuditLog cleanup job that archives logs older than 7 years
- **Effort:** L
- **Risk if Not Fixed:** HIPAA non-compliance for data lifecycle management; indefinite data accumulation
- **Implementing Team:** Team C (HIPAA)

### ARCH-P1-006: Add Connection Pool Configuration (Should fix this quarter)
- **Area:** Infrastructure
- **Current State:** `lib/db/prisma.ts` line 125: `new Pool({ connectionString: dbUrl })` -- no pool size, timeout, or idle settings
- **Problem:** Default `pg` pool size is 10 connections. On Netlify serverless, each function invocation may create its own pool. Under load, this can exhaust Neon's connection limit.
- **Recommendation:** Configure pool with `max: 5` (serverless-appropriate), `idleTimeoutMillis: 10000`, `connectionTimeoutMillis: 5000`. Consider using Neon's connection pooler endpoint (`-pooler` suffix in the hostname).
- **Effort:** S
- **Risk if Not Fixed:** Connection exhaustion under load; "too many clients" database errors
- **Implementing Team:** Team D (Operations)
- **File:** `lib/db/prisma.ts`

### ARCH-P2-001: Prevent Unprotected API Routes (Nice to have)
- **Area:** Security
- **Current State:** API routes (`/api/*`) are excluded from middleware. Auth is enforced per-route by calling `requireRole()`. If a developer forgets this call, the route is completely open.
- **Problem:** No fail-safe against accidentally unprotected routes.
- **Recommendation:** Create a lint rule or test that scans all `app/api/*/route.ts` files and verifies they either call `requireRole`/`requireAuth` or are explicitly listed in an allowlist of public routes (e.g., `api/health`, `api/webhooks/*`, `api/stripe/public-checkout-session`).
- **Effort:** M
- **Risk if Not Fixed:** Future API routes may be accidentally unprotected
- **Implementing Team:** Team C (HIPAA)

### ARCH-P2-002: Split `components/physician/` (Nice to have)
- **Area:** Application
- **Current State:** 42 files, 15,582 lines in a flat directory
- **Problem:** Difficult to navigate, high cognitive load, hard to identify component boundaries
- **Recommendation:** Split into subdirectories: `physician/queue/`, `physician/patients/`, `physician/messaging/`, `physician/prescriptions/`, `physician/reviews/`
- **Effort:** M (file moves with import updates)
- **Risk if Not Fixed:** Developer productivity loss; accidental tight coupling
- **Implementing Team:** Team B (UI)

### ARCH-P2-003: Fix Token Refresh Extending Sessions Indefinitely (Nice to have)
- **Area:** Security
- **Current State:** `middleware.ts` lines 272-281 refresh the `accessToken` cookie maxAge on every request without re-verifying the token
- **Problem:** A 15-minute access token effectively never expires as long as the user is active, undermining the security benefit of short-lived tokens
- **Recommendation:** Only refresh the cookie if the token is within its last 5 minutes of life. Or better: implement proper token rotation (issue a new access token via the refresh token endpoint).
- **Effort:** S
- **Risk if Not Fixed:** Sessions persist indefinitely for active users; stolen tokens remain valid longer
- **Implementing Team:** Team A (Core Services)

### ARCH-P2-004: Deduplicate Security Headers (Nice to have)
- **Area:** Infrastructure
- **Current State:** Security headers are defined in both `next.config.ts` (lines 41-93) and `netlify.toml` (lines 33-39)
- **Problem:** If headers diverge, one layer may override the other unpredictably
- **Recommendation:** Define security headers in one place. Since `next.config.ts` headers are more comprehensive and configurable, remove the partial set from `netlify.toml`.
- **Effort:** S
- **Risk if Not Fixed:** Confusing header behavior; potential security misconfiguration
- **Implementing Team:** Team D (Operations)

### ARCH-P2-005: Add Env Var Format Validation (Nice to have)
- **Area:** Security
- **Current State:** `lib/env-validation.ts` checks presence only, not format
- **Problem:** A misconfigured `PHI_ENCRYPTION_KEY` (e.g., too short, wrong format) will cause runtime encryption failures rather than a clear startup error
- **Recommendation:** Validate key format: `PHI_ENCRYPTION_KEY` must be 64+ hex chars, `JWT_SECRET` must be 32+ chars, `DATABASE_URL` must start with `postgresql://`
- **Effort:** S
- **Risk if Not Fixed:** Cryptic runtime errors from misconfigured keys
- **Implementing Team:** Team D (Operations)
- **File:** `lib/env-validation.ts`

### ARCH-P2-006: Enable Redis TLS Certificate Verification (Nice to have)
- **Area:** Security
- **Current State:** `lib/redis/client.ts` line 165: `rejectUnauthorized: false`
- **Problem:** Disabling TLS certificate verification allows MITM attacks on the Redis connection
- **Recommendation:** Set `rejectUnauthorized: true` and configure the Redis provider's CA certificate. If using Upstash, their certificates are signed by public CAs and should verify correctly.
- **Effort:** S
- **Risk if Not Fixed:** Potential man-in-the-middle attack on cached session/rate-limit data
- **Implementing Team:** Team D (Operations)

---

## Dependency Health

| Package | Current | Purpose | Risk |
|---------|---------|---------|------|
| `next` | 16.1.6 | Framework | Low -- latest stable |
| `react` | 19.2.3 | UI | Low -- latest stable |
| `@prisma/client` | ^7.4.1 | ORM | Low -- latest major |
| `stripe` | ^20.3.1 | Payments | Low -- API version `2026-01-28.clover` is current |
| `zod` | ^4.3.6 | Validation | Low -- v4 migration complete |
| `ioredis` | ^5.9.3 | Cache | Low -- stable |
| `bcrypt` | ^6.0.0 | Passwords | **Medium** -- native module, may cause issues on Netlify serverless |
| `jose` | (via next) | JWT | Low -- Edge-compatible, no native deps |
| `@sendgrid/mail` | ^8.1.6 | Email | Low |
| `twilio` | ^5.12.2 | SMS | **Medium** -- code exists but service is not connected |
| `@aws-sdk/client-s3` | ^3.996.0 | Documents | Low |
| `actions/create-release@v1` | v1 | CI | **Medium** -- deprecated GitHub Action, should upgrade to v4 |
| `codecov/codecov-action@v3` | v3 | CI | **Low** -- v4 available |
| `slackapi/slack-github-action@v1.24.0` | v1.24.0 | CI | Low |

---

## Appendix: File Reference

| Concern | Key Files |
|---------|-----------|
| CI/CD | `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`, `.github/workflows/lighthouse.yml` |
| Build Config | `next.config.ts`, `netlify.toml`, `postcss.config.mjs` |
| Database | `prisma/schema.prisma`, `lib/db/prisma.ts`, `lib/db/encryption-extension.ts` |
| Caching | `lib/redis/client.ts`, `lib/redis/cache.ts`, `lib/middleware/api-cache.ts` |
| Encryption (canonical) | `lib/encryption/phi.ts`, `lib/db/encryption-extension.ts` |
| Encryption (orphaned) | `lib/hipaa/encryption.ts`, `lib/db/encryption-middleware.ts`, `lib/db/encryption.ts` |
| Auth | `lib/auth/jwt.ts`, `lib/auth/rbac.ts`, `lib/auth/require-auth.ts`, `middleware.ts` |
| Audit (canonical) | `lib/audit/logger.ts`, `lib/audit/types.ts`, `lib/audit/utils.ts` |
| Audit (orphaned) | `lib/hipaa/audit-logger.ts` |
| Stripe (canonical for checkout) | `lib/stripe/stripe-server.ts`, `lib/stripe/stripe-client.ts` |
| Stripe (legacy for billing) | `lib/integrations/stripe.ts` |
| Data Retention | `lib/hipaa/data-retention.ts`, `lib/constants.ts` |
| Secrets (EXPOSED) | `.claude/settings.local.json` |
| Env Validation | `lib/env-validation.ts` |
| Test Configs | `vitest.config.ts`, `vitest.unit.config.ts`, `vitest.integration.config.ts`, `playwright.config.ts` |
