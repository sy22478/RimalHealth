# Team G: Debugging -- Design Document

> **Author:** Team E (Planning & Coordination)
> **Date:** 2026-03-25
> **Project:** RimalHealth HIPAA Telehealth Platform
> **Status:** Design complete, ready for activation

---

## 1. Team G Mission & Scope

### 1.1 Mission

Team G is the **proactive bug hunting team**. Unlike Team A's `systematic-debugging` skill (which is reactive -- activated when a developer encounters a bug during their work), Team G continuously investigates the codebase for latent bugs, integration drift, data integrity issues, and performance degradation. Team G does NOT implement fixes. It produces structured bug reports with root cause analysis and specific fix instructions, which the PM dispatches to Teams A or B for implementation.

### 1.2 Scope

Team G covers five categories of issues:

| Category | Description | Examples |
|----------|-------------|---------|
| **Integration Bugs** | Mismatches between RimalHealth code and external service APIs | Stripe API version drift, SendGrid template misconfiguration, DoseSpot mock mode accidentally active in production |
| **Data Integrity Issues** | PHI encryption failures, schema drift, orphaned records | Encryption roundtrip failures, unencrypted PHI fields, subscriptions without users |
| **Auth Flow Bugs** | JWT, middleware, RBAC, session, and account lockout issues | Token refresh failures, role-based access bypasses, middleware header propagation gaps |
| **UI/UX Issues** | Broken user flows, form validation gaps, rendering errors | Intake form wizard state loss, checkout flow dead ends, responsive layout breakage |
| **Performance Problems** | Slow queries, N+1 patterns, bundle bloat, API latency | Unindexed queries on AuditLog, large Prisma includes, oversized client bundles |

### 1.3 What Team G Does NOT Do

- Does NOT implement fixes (dispatches to Teams A/B)
- Does NOT write tests (dispatches to Team C)
- Does NOT deploy (dispatches to Team D)
- Does NOT make architectural decisions (escalates to Team E)

### 1.4 Key Constraint: CLAUDE.md Bug Fixing Rules

Per CLAUDE.md, all debugging must follow these rules:

> Before fixing a bug, verify the root cause -- don't fix symptoms. Check env vars, API URLs, and middleware config first.

Team G enforces this by requiring every bug report to include verified root cause with specific file:line references.

---

## 2. Agent Roles Within Team G

### 2.1 G1: Integration Debugger

**Focus:** External service integration health -- Stripe, SendGrid, DoseSpot, S3, Twilio, Redis, Neon PostgreSQL.

#### Primary Skills & MCP Tools

| Skill/Tool | Purpose |
|------------|---------|
| `systematic-debugging` | Structured investigation of integration failures |
| Neon MCP: `run_sql`, `describe_table_schema` | Verify database state for Stripe/subscription records |
| Neon MCP: `list_slow_queries` | Identify slow queries caused by integration data patterns |
| Context7: `resolve-library-id`, `query-docs` | Look up current Stripe/SendGrid/Twilio API documentation |
| Perplexity: `search`, `reason` | Research breaking API changes, security advisories |
| Playwright MCP: `browser_navigate`, `browser_network_requests` | Test checkout flows, verify webhook delivery |

#### Investigation Patterns for RimalHealth

**Pattern G1-A: Dual Stripe Audit**

The codebase has two separate Stripe implementations that must stay in sync:

| Module | File | Lines | Used By |
|--------|------|-------|---------|
| Old integration | `lib/integrations/stripe.ts` | 693 | `api/patient/billing/route.ts`, `api/patient/billing/portal/route.ts`, `api/patient/billing/cancel/route.ts`, `api/patient/billing/invoices/[id]/download/route.ts` |
| New stripe module | `lib/stripe/stripe-server.ts` | ~300 | `api/webhooks/stripe/route.ts`, `lib/services/subscription-service.ts`, `app/checkout/payment/CheckoutPaymentClient.tsx` |

Investigation steps:
1. Compare Stripe API version strings in both files (currently both `2026-01-28.clover` -- verify they haven't drifted)
2. Compare `STRIPE_PRICE_IDS` / `PRICE_IDS` record definitions -- both read the same env vars but may diverge in defaults
3. Check for inconsistent error handling patterns between the two modules
4. Verify the webhook handler (`app/api/webhooks/stripe/route.ts`) imports from the correct module (`lib/stripe/stripe-server.ts`)
5. Check that billing routes importing from `lib/integrations/stripe.ts` are not creating Stripe clients with different config

**Pattern G1-B: DoseSpot Mock Mode Guard**

File: `lib/integrations/dosespot.ts` line 54 (`mockMode: process.env.DOSESPOT_MOCK_MODE === 'true'`)

The production safety guard at line 545 only logs a warning:
```
if (process.env.NODE_ENV === 'production' && process.env.DOSESPOT_MOCK_MODE === 'true') {
  console.warn('[DoseSpot] WARNING: Mock mode enabled in production environment');
}
```

Investigation: Verify Netlify production env does NOT have `DOSESPOT_MOCK_MODE=true`. Also check `app/api/physician/prescriptions/send/route.ts` line 108 for the mock mode check there.

**Pattern G1-C: SendGrid Configuration Validation**

File: `lib/integrations/sendgrid.ts`

Check:
1. `SENDGRID_API_KEY` is set and starts with `SG.`
2. `SENDGRID_FROM_EMAIL` matches a verified sender in SendGrid
3. Template names in `lib/notifications/templates.ts` match SendGrid template IDs (if using SendGrid templates vs inline HTML)
4. Retry queue in Redis is not growing unbounded (check `sendgrid:retry:*` keys)

#### Known Problem Areas (from P2 Section 5)

- **Dual Stripe implementations** (tasks.md 0.1.1): `lib/integrations/stripe.ts` vs `lib/stripe/` -- 4 billing routes use old, 3 files use new
- **DoseSpot mock mode active** (tasks.md 1.2.2): Prescription flow does not reach real e-prescribing API
- **GA4 stub** (tasks.md 1.2.1): `NEXT_PUBLIC_GA_MEASUREMENT_ID` is read in `app/layout.tsx` metadata but no GA script tag exists

#### Output Format

```markdown
## BUG REPORT: G1-XXXX

**Severity:** P0 / P1 / P2 / P3
**Category:** Integration
**Discovered:** 2026-XX-XX
**Debugger:** G1

### Summary
[One sentence describing the bug]

### Root Cause
**File:** `path/to/file.ts` line XX
**Cause:** [Specific technical explanation]

### Reproduction
1. [Step 1]
2. [Step 2]
3. [Observed behavior vs expected behavior]

### Affected Users/Flows
- [Which user roles are affected]
- [Which user flows are broken/degraded]

### Fix Instructions
**File(s) to modify:** `path/to/file.ts`
**Changes:**
1. [Exact change description]
2. [Code snippet if needed]

### Verification Test
```bash
[Command to verify the fix works]
```

### Dispatch
**Assign to:** Team A / Team B
**Estimated effort:** Small (< 1 hour) / Medium (1-4 hours) / Large (4+ hours)
```

---

### 2.2 G2: Data Integrity Debugger

**Focus:** PHI encryption correctness, Prisma schema integrity, database consistency, audit log completeness.

#### Primary Skills & MCP Tools

| Skill/Tool | Purpose |
|------------|---------|
| `systematic-debugging` | Structured investigation of data issues |
| `verification-before-completion` | Verify PHI encryption compliance |
| Neon MCP: `run_sql` | Query production data for integrity checks |
| Neon MCP: `run_sql_transaction` | Atomic multi-step data verification |
| Neon MCP: `describe_table_schema` | Verify column types match Prisma schema |
| Neon MCP: `get_database_tables` | Full schema overview |
| Neon MCP: `compare_database_schema` | Detect drift between branches |
| Serena: `find_symbol`, `get_symbols_overview` | Navigate encryption extension code |

#### Investigation Patterns for RimalHealth

**Pattern G2-A: Dual Encryption System Audit**

Three separate encryption modules exist:

| Module | File | Key Env Var | Key Format | Used By |
|--------|------|-------------|------------|---------|
| Primary PHI encryption | `lib/encryption/phi.ts` | `PHI_ENCRYPTION_KEY` | Hex (64+ chars) | `lib/db/encryption-extension.ts` (Prisma auto-encrypt for 6 models, 28 fields) |
| HIPAA encryption | `lib/hipaa/encryption.ts` | `ENCRYPTION_KEY` | Base64 (32 bytes) | 0 files import this directly (no import matches found) |
| DB encryption | `lib/db/encryption.ts` | Unknown | Unknown | Unclear if actively used |

Critical finding from P2: `lib/env-validation.ts` requires `ENCRYPTION_KEY` (base64), but the Prisma extension uses `PHI_ENCRYPTION_KEY` (hex). If only `ENCRYPTION_KEY` is set, the Prisma extension will fail silently on encryption operations.

Investigation steps:
1. Run SQL: `SELECT "firstName" FROM "PatientProfile" LIMIT 5` -- verify values start with `enc:v1:` prefix
2. Verify `PHI_ENCRYPTION_KEY` is set in Netlify production env vars
3. Check if `lib/hipaa/encryption.ts` is imported anywhere (grep found 0 imports -- likely dead code)
4. Check if `lib/db/encryption.ts` is imported anywhere and determine if it is dead code
5. Verify encryption roundtrip: encrypt a test value, store it, read it back, decrypt it

**Pattern G2-B: PHI Field Coverage Audit**

File: `lib/db/encryption-extension.ts` lines 18-57 (PHI_FIELDS map)

Cross-reference the `PHI_FIELDS` map against the Prisma schema to verify all PHI-containing fields are covered:

1. For each of the 6 models in `PHI_FIELDS`, verify every field listed actually exists in `prisma/schema.prisma`
2. For each model in the schema that contains PHI (per `lib/hipaa/phi-identifiers.ts`), verify it is in `PHI_FIELDS`
3. Check for new fields added to models after the encryption extension was written

**Pattern G2-C: Audit Log Completeness Check**

Two audit loggers exist:

| Logger | File | Lines | Imported By |
|--------|------|-------|-------------|
| `lib/audit/logger.ts` | General audit singleton | 660 | 66 files (API routes, services, lib modules) |
| `lib/hipaa/audit-logger.ts` | HIPAA audit logger | 724 | 0 files (no imports found) |

Investigation: The HIPAA audit logger (`lib/hipaa/audit-logger.ts`) has zero imports -- it appears to be dead code superseded by `lib/audit/logger.ts`. Verify:
1. Are both loggers writing to the same `AuditLog` table?
2. Does `lib/audit/logger.ts` cover all HIPAA-required audit fields (who, what, when, where)?
3. Are there any API routes that access PHI but do NOT call `auditLogger.logPHIAccess()` or `AuditService.log*()`?

**Pattern G2-D: Orphaned Record Detection**

Run SQL queries to find data integrity violations:

```sql
-- Subscriptions without users
SELECT s.id, s."userId" FROM "Subscription" s
LEFT JOIN "User" u ON s."userId" = u.id
WHERE u.id IS NULL;

-- Intakes without patient profiles
SELECT i.id, i."patientId" FROM "Intake" i
LEFT JOIN "PatientProfile" pp ON i."patientId" = pp."userId"
WHERE pp.id IS NULL;

-- Reviews without intakes
SELECT r.id, r."intakeId" FROM "Review" r
LEFT JOIN "Intake" i ON r."intakeId" = i.id
WHERE i.id IS NULL;

-- Prescriptions without intakes
SELECT p.id, p."intakeId" FROM "Prescription" p
LEFT JOIN "Intake" i ON p."intakeId" = i.id
WHERE i.id IS NULL;
```

#### Known Problem Areas (from P2 Section 5)

- **Dual encryption systems** (tasks.md 0.1.3): `PHI_ENCRYPTION_KEY` hex vs `ENCRYPTION_KEY` base64 -- both active with different modules
- **Dual audit loggers** (tasks.md 0.1.2): `lib/hipaa/audit-logger.ts` vs `lib/audit/logger.ts` -- inconsistent coverage
- **Missing env vars** (tasks.md 0.4): 12 env vars used in code but missing from `.env.example`
- **`lib/db/encryption-middleware.ts` and `lib/db/encryption.ts`** (tasks.md 0.1.5): unclear if actively used or dead code

#### Output Format

Same as G1 format (Section 2.1), with additional `Data Impact` field:

```markdown
### Data Impact
- **Records affected:** [count or query to determine count]
- **PHI exposure risk:** Yes/No -- [explanation]
- **Recovery possible:** Yes/No -- [if data is lost, can it be recovered?]
```

---

### 2.3 G3: Runtime Debugger

**Focus:** Auth flow bugs, middleware issues, API route errors, client-side rendering failures, performance bottlenecks.

#### Primary Skills & MCP Tools

| Skill/Tool | Purpose |
|------------|---------|
| `systematic-debugging` | Structured investigation of runtime errors |
| Playwright MCP: `browser_navigate`, `browser_console_messages`, `browser_network_requests` | Test auth flows, catch client-side errors |
| Playwright MCP: `browser_take_screenshot`, `browser_resize` | Visual regression detection, responsive testing |
| Neon MCP: `explain_sql_statement` | Query plan analysis for slow endpoints |
| Neon MCP: `list_slow_queries` | Identify performance bottlenecks |
| Serena: `find_symbol`, `search_for_pattern` | Trace execution paths through middleware and API routes |

#### Investigation Patterns for RimalHealth

**Pattern G3-A: Auth Flow End-to-End Verification**

The auth system has a complex 3-step fallback in `requireAuth()` (`lib/auth/require-auth.ts`):
1. Middleware-injected `x-user-*` headers
2. `Authorization: Bearer` header
3. `accessToken` httpOnly cookie read directly

Known issue (build_instructions.md 8.4): API routes bypass middleware (`/api/*` in `STATIC_ROUTES`), so `x-user-id` headers are NOT set for API routes. `requireAuth()` must fall back to cookie reading.

Investigation steps:
1. Verify middleware correctly skips `/api/*` routes (check `STATIC_ROUTES` in `middleware.ts`)
2. Verify every protected API route uses `requireAuth()`, `requireRole()`, or `requirePermission()` -- NOT `x-user-id` headers alone
3. Test token refresh: make a request with an expired access token and valid refresh token -- verify the 401 response triggers client-side refresh
4. Test account lockout: verify 5 failed login attempts triggers lockout via Redis keys `auth:failed_attempts:<email>` and `auth:locked:<email>`
5. Test role escalation: verify a PATIENT cannot access `/physician/*` or `/admin/*` routes

**Pattern G3-B: Middleware Header Propagation Audit**

File: `middleware.ts` (314 lines)

The middleware injects these headers for page routes (NOT API routes):
- `x-user-id`
- `x-user-role`
- `x-user-email`
- `x-request-id`

Investigation: Grep all API routes for direct reads of `x-user-id` header -- any route reading this header instead of using `requireAuth()` is a bug, since API routes bypass middleware.

```bash
# Find API routes reading x-user-id directly (potential bug)
grep -rn "x-user-id" app/api/
```

**Pattern G3-C: Client-Side Error Detection**

Use Playwright MCP to navigate critical user flows and check for:
1. Console errors on `/patient/dashboard`, `/physician/(portal)/dashboard`, `/admin/dashboard`
2. Network request failures (4xx/5xx) during normal flows
3. Hydration mismatches (React server/client rendering divergence)
4. Form submission errors on `/intake`, `/checkout/payment`, `/set-password`

**Pattern G3-D: Performance Bottleneck Identification**

1. **Database:** Use Neon MCP `list_slow_queries` to find queries > 100ms
2. **API response times:** Use Playwright `browser_network_requests` to measure API latency from the client perspective
3. **Bundle size:** Run `npm run build:analyze` and check for:
   - Pages over 200KB first-load JS
   - Duplicate dependencies in the bundle
   - Server-only code leaking to client bundles
4. **N+1 queries:** Search for Prisma queries inside loops:
   ```
   grep -rn "prisma\.\w\+\.\(findUnique\|findFirst\|findMany\)" app/api/ | grep -B5 "for\s*("
   ```

**Pattern G3-E: Vitest Config Audit**

File: `vitest.config.ts` (root)

Known issue (tasks.md 0.6.1): `npm test` only runs integration tests because `include` is `['tests/integration/**/*.test.ts']`. Unit tests at `tests/unit/**/*.test.ts` are excluded from the default test command.

Verify: Run `npm test` and confirm unit tests are NOT executed. Report if this causes false confidence in CI.

#### Known Problem Areas (from P2 Section 5)

- **Turbopack barrel export resolution** (tasks.md 1.3.1): CI build fails on `@/lib/audit` imports
- **Vitest default config** (tasks.md 0.6.1): `npm test` only runs integration tests
- **Encryption key format inconsistency** (tasks.md 0.6.2): `PHI_ENCRYPTION_KEY` hex vs `ENCRYPTION_KEY` base64

#### Output Format

Same as G1 format (Section 2.1), with additional `Performance Impact` field when relevant:

```markdown
### Performance Impact
- **Latency:** [measured or estimated impact in ms]
- **Affected endpoints:** [list of slow endpoints]
- **Root query:** [the SQL query causing the bottleneck]
```

---

## 3. Custom Skills for Team G

### 3.1 `/debug-investigate`

```yaml
name: debug-investigate
trigger: "When a bug is reported or suspected"
description: >
  Systematic bug investigation following CLAUDE.md rules: verify root cause first,
  check env vars, API URLs, and middleware config before attempting any fix.
  Outputs a structured bug report with root cause, affected files, fix steps,
  and verification test.
```

#### SKILL.md Definition

```markdown
# /debug-investigate

## Purpose
Systematically investigate a reported or suspected bug in the RimalHealth codebase.
Produces a structured bug report with root cause analysis and fix instructions.

## When to Use
- A user reports a bug (e.g., "checkout is broken", "patient can't see prescriptions")
- A deployment health check fails
- An integration returns unexpected errors
- A test starts failing

## Process

### Step 1: Triage (30 seconds)
Classify the bug into one of: Integration, Data Integrity, Auth/Middleware, UI/UX, Performance.
Assign to G1, G2, or G3 scope.

### Step 2: Environment Check (MANDATORY FIRST)
Per CLAUDE.md: "Before fixing a bug, verify the root cause -- don't fix symptoms.
Check env vars, API URLs, and middleware config first."

Run these checks in order:
1. **Env vars:** Verify all required env vars are set
   - Read `lib/env-validation.ts` for the required list
   - For Stripe issues: check `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
     `STRIPE_PRICE_ACTIVE_TREATMENT`, `STRIPE_PRICE_MAINTENANCE`
   - For encryption issues: check BOTH `PHI_ENCRYPTION_KEY` AND `ENCRYPTION_KEY`
   - For auth issues: check `JWT_SECRET`
2. **Middleware config:** Read `middleware.ts` PUBLIC_ROUTES and STATIC_ROUTES arrays
3. **API URLs:** Verify the endpoint path matches the file system structure in `app/api/`

### Step 3: Reproduce
1. Identify the exact user flow that triggers the bug
2. Use Playwright MCP to navigate the flow if it is a UI bug
3. Use curl/fetch to hit the API endpoint if it is an API bug
4. Use Neon MCP `run_sql` if it is a data issue
5. Document the exact reproduction steps

### Step 4: Isolate
1. Read the relevant source files using the Read tool
2. Trace the execution path from entry point to failure
3. For API routes: entry is the exported handler function in `route.ts`
4. For middleware: entry is `middleware.ts` > `middleware()` function
5. For client components: entry is the page component, check `useEffect` and fetch calls
6. Use Serena `find_symbol` to trace function calls across modules

### Step 5: Root Cause
1. Identify the exact file and line number where the bug originates
2. Explain WHY it fails (not just WHAT fails)
3. Check if the same pattern exists elsewhere (systematic issue vs isolated bug)
4. For Stripe issues: "validate API params against the current Stripe API version
   before deploying" (CLAUDE.md)

### Step 6: Output Bug Report
Use the standard format from Section 2.1 of team_g_debugging.md.
Include:
- Severity (P0-P3)
- Root cause with file:line
- Affected users and flows
- Specific fix instructions (code changes)
- Verification command or test
- Which team should implement (A or B)
```

---

### 3.2 `/integration-health`

```yaml
name: integration-health
trigger: "Proactive health check of all external service integrations"
description: >
  Scans all integration points (Stripe, SendGrid, Redis, Neon, DoseSpot, S3, Twilio)
  for misconfigurations, API version drift, expired credentials, and mock mode in production.
```

#### SKILL.md Definition

```markdown
# /integration-health

## Purpose
Proactive health check of ALL external service integrations in RimalHealth.
Flags misconfigurations before they cause user-facing issues.

## When to Use
- Before a production deployment (run alongside /preflight)
- Weekly scheduled check
- After any env var changes in Netlify
- After upgrading integration library versions

## Checks

### Stripe (Critical)
1. **API version consistency:**
   - Read `lib/integrations/stripe.ts` -- extract `apiVersion` value
   - Read `lib/stripe/stripe-server.ts` -- extract `apiVersion` value
   - FAIL if they differ
2. **Env vars present:**
   - `STRIPE_SECRET_KEY` -- must start with `sk_live_` in production or `sk_test_` in staging
   - `STRIPE_WEBHOOK_SECRET` -- must start with `whsec_`
   - `STRIPE_PRICE_ACTIVE_TREATMENT` -- must start with `price_`
   - `STRIPE_PRICE_MAINTENANCE` -- must start with `price_`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` -- must start with `pk_`
3. **Dual implementation divergence:**
   - Compare functions exported from both modules
   - Flag any function that exists in one but not the other with the same name
4. **Webhook endpoint:**
   - Verify `app/api/webhooks/stripe/route.ts` exists and exports POST handler
   - Verify it imports from `lib/stripe/stripe-server.ts` (not the old integration)

### SendGrid (High)
1. **Env vars:** `SENDGRID_API_KEY` (starts with `SG.`), `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`
2. **Template coverage:** Count templates in `lib/notifications/templates.ts` emailTemplates map.
   Verify all 20 EmailTemplate enum values have corresponding generators.
3. **From email domain:** Verify `SENDGRID_FROM_EMAIL` domain matches `rimalhealth.com` or `admin.rimalhealth.com`

### Redis (High)
1. **Connection:** `REDIS_URL` is set
2. **TLS in production:** If `NODE_ENV=production`, verify `REDIS_TLS_ENABLED=true` or REDIS_URL uses `rediss://`
3. **Password:** `REDIS_PASSWORD` is set in production

### Neon PostgreSQL (High)
1. **Connection:** `DATABASE_URL` is set and contains `neon.tech` or expected host
2. **Schema sync:** Run `npx prisma validate` -- PASS if no errors
3. **Pending migrations:** Run `npx prisma migrate status` -- FAIL if pending migrations exist

### DoseSpot (Medium)
1. **Mock mode guard:** Check `DOSESPOT_MOCK_MODE` value
   - In production: MUST be `false` or unset. FAIL if `true`.
   - In development: SHOULD be `true` (warn if credentials are set but mock mode is off)
2. **Credential presence:** If mock mode is off, verify `DOSESPOT_CLIENT_ID`,
   `DOSESPOT_CLIENT_SECRET`, `DOSESPOT_CLINIC_ID`, `DOSESPOT_USER_ID` are all set
3. **TODO stub check:** Read `app/api/physician/prescriptions/send/route.ts` line 142 --
   flag if TODO comment still exists (means real DoseSpot integration is incomplete)

### AWS S3 (Medium)
1. **Env vars:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME`, `AWS_REGION`
2. **Bucket encryption:** S3 bucket should have server-side encryption enabled (cannot verify programmatically -- flag as manual check)

### Twilio (Low)
1. **Env vars:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
2. **Status:** Currently implemented but not connected in production. Flag if env vars are missing.

### Google Analytics (Low)
1. **Env var:** `NEXT_PUBLIC_GA_MEASUREMENT_ID`
2. **Script tag check:** Search `app/layout.tsx` and root layout files for GA script tag.
   Known issue: env var is read but no script tag exists (tasks.md 1.2.1).

## Output Format
```
INTEGRATION HEALTH REPORT
=========================
Date: YYYY-MM-DD
Environment: production / staging / development

[PASS] Stripe -- API version consistent (2026-01-28.clover)
[FAIL] Stripe -- Dual implementation divergence: lib/integrations/stripe.ts exports
       createCheckoutSession() but lib/stripe/stripe-server.ts does not
[PASS] SendGrid -- All 20 templates present
[WARN] DoseSpot -- Mock mode is TRUE (acceptable in dev, CRITICAL in production)
[FAIL] GA4 -- No script tag found in layouts (tasks.md 1.2.1)

Summary: 8 PASS, 2 FAIL, 1 WARN
```
```

---

### 3.3 `/data-integrity-check`

```yaml
name: data-integrity-check
trigger: "Verify PHI encryption, audit completeness, and data consistency"
description: >
  Comprehensive data integrity verification covering PHI encryption roundtrip,
  audit log completeness, and orphaned record detection.
```

#### SKILL.md Definition

```markdown
# /data-integrity-check

## Purpose
Verify data integrity across the RimalHealth database, focusing on PHI encryption
correctness, audit log coverage, and referential integrity.

## When to Use
- After database migrations
- After encryption key rotation
- Weekly scheduled integrity check
- After bulk data operations
- When investigating data corruption reports

## Checks

### Check 1: PHI Encryption Roundtrip (6 models, 28 fields)

For each model in the PHI_FIELDS map (`lib/db/encryption-extension.ts` lines 18-57):

**PatientProfile (16 fields):**
```sql
SELECT id, "firstName", "lastName", "dateOfBirth", "phone",
       "addressStreet", "addressCity", "addressZip",
       "billingStreet", "billingCity", "billingZip",
       "medicalHistory", "currentMedications", "allergies",
       "insuranceProvider", "insuranceMemberId", "insuranceGroupNumber"
FROM "PatientProfile" LIMIT 10;
```
- PASS: All non-null values start with `enc:v1:`
- FAIL: Any non-null value is plaintext (HIPAA violation -- P0 severity)

**Intake (2 fields):** `formData`, `medicationList`
**Review (5 fields):** `clinicalNotes`, `contraindications`, `rejectionReason`,
  `alternativeRecommendation`, `instructions`
**Prescription (2 fields):** `instructions`, `pharmacyAddress`
**Message (2 fields):** `subject`, `body`
**PhysicianNote (1 field):** `content`

For each model, run the same pattern: SELECT the PHI fields, verify `enc:v1:` prefix.

### Check 2: Unencrypted PHI Detection

Search for PHI stored outside the 6 encrypted models that SHOULD be encrypted:

1. Check `User.email` -- email is PHI per HIPAA. Currently stored plaintext (used as login
   identifier, so encryption would complicate lookups). Flag as KNOWN EXCEPTION.
2. Check `AuditLog.metadata` (JSON field) -- may contain PHI in log context.
   Run: `SELECT id, metadata FROM "AuditLog" WHERE metadata::text LIKE '%@%' LIMIT 10`
   Flag any email addresses or names found in audit metadata.
3. Check `Notification` model for PHI in `title` or `message` fields.

### Check 3: Audit Log Completeness

For each API route that accesses PHI, verify a corresponding audit log entry pattern:

1. Count PHI-accessing API routes:
   ```bash
   grep -rl "prisma\.patientProfile\|prisma\.intake\|prisma\.review\|prisma\.prescription\|prisma\.message\|prisma\.physicianNote" app/api/
   ```
2. For each route, verify it imports from `@/lib/audit` or `@/lib/services/audit-service`
3. Flag routes that query PHI models but have no audit logging

**Known gap:** `lib/hipaa/audit-logger.ts` (724 lines) has zero imports -- it is likely dead code.
Verify `lib/audit/logger.ts` (660 lines, imported by 66 files) covers all HIPAA requirements.

### Check 4: Orphaned Record Detection

Run the following queries via Neon MCP `run_sql`:

```sql
-- Subscriptions without users
SELECT COUNT(*) as orphaned_subscriptions FROM "Subscription" s
LEFT JOIN "User" u ON s."userId" = u.id WHERE u.id IS NULL;

-- Patient profiles without users
SELECT COUNT(*) as orphaned_profiles FROM "PatientProfile" pp
LEFT JOIN "User" u ON pp."userId" = u.id WHERE u.id IS NULL;

-- Intakes without users
SELECT COUNT(*) as orphaned_intakes FROM "Intake" i
LEFT JOIN "User" u ON i."patientId" = u.id WHERE u.id IS NULL;

-- Reviews without intakes
SELECT COUNT(*) as orphaned_reviews FROM "Review" r
LEFT JOIN "Intake" i ON r."intakeId" = i.id WHERE i.id IS NULL;

-- Prescriptions without intakes
SELECT COUNT(*) as orphaned_prescriptions FROM "Prescription" p
LEFT JOIN "Intake" i ON p."intakeId" = i.id WHERE i.id IS NULL;

-- Sessions for deleted users
SELECT COUNT(*) as orphaned_sessions FROM "Session" s
LEFT JOIN "User" u ON s."userId" = u.id WHERE u.id IS NULL;

-- Password resets for deleted users
SELECT COUNT(*) as orphaned_resets FROM "PasswordReset" pr
LEFT JOIN "User" u ON pr."userId" = u.id WHERE u.id IS NULL;
```

Any non-zero count is a finding. Severity depends on the model:
- Orphaned subscriptions: P1 (active Stripe charges for non-existent users)
- Orphaned profiles with PHI: P1 (unlinked PHI data)
- Orphaned sessions: P3 (stale data, no security impact)

### Check 5: Schema Drift Detection

1. Run `npx prisma validate` -- verify schema is valid
2. Run `npx prisma migrate status` -- check for pending migrations
3. If Neon MCP `compare_database_schema` is available, compare production schema
   against the Prisma schema definition

## Output Format
```
DATA INTEGRITY REPORT
=====================
Date: YYYY-MM-DD
Database: [Neon project ID]

PHI ENCRYPTION:
  [PASS] PatientProfile: 142 records, all 16 PHI fields encrypted
  [PASS] Intake: 87 records, formData/medicationList encrypted
  [FAIL] Message: 3 records have plaintext body (IDs: xxx, yyy, zzz) -- P0

AUDIT COMPLETENESS:
  [PASS] 52/54 PHI-accessing routes have audit logging
  [FAIL] app/api/patient/documents/[id]/download/route.ts -- no audit log on PHI access
  [FAIL] app/api/physician/patients/[id]/history/route.ts -- no audit log on PHI access

ORPHANED RECORDS:
  [PASS] 0 orphaned subscriptions
  [WARN] 2 orphaned sessions (stale, no security risk)

SCHEMA:
  [PASS] Prisma schema valid
  [PASS] No pending migrations

Summary: 10 PASS, 2 FAIL, 1 WARN
Critical: 1 (plaintext PHI in Message table)
```
```

---

### 3.4 `/perf-audit`

```yaml
name: perf-audit
trigger: "Identify and report performance bottlenecks"
description: >
  Comprehensive performance audit covering database queries, API response times,
  bundle size, and client-side rendering performance.
```

#### SKILL.md Definition

```markdown
# /perf-audit

## Purpose
Identify performance bottlenecks across the RimalHealth stack: database, API,
bundle, and client rendering.

## When to Use
- Monthly performance baseline
- After adding new Prisma queries or models
- When users report slowness
- Before and after optimization work
- After major dependency upgrades

## Checks

### Check 1: N+1 Query Detection

Search for Prisma queries executed inside loops:

```bash
# In app root: premium-telehealth-website/my-app/

# Find findUnique/findFirst inside forEach/for/map callbacks
grep -rn "prisma\." app/api/ lib/ --include="*.ts" | grep -B3 "for\s*(\|forEach\|\.map("
```

Also check for Prisma queries that should use `include` or `select` but instead make
separate queries:

```bash
# Find routes that call prisma multiple times for related data
grep -l "await prisma\." app/api/ --include="*.ts" -r | while read f; do
  count=$(grep -c "await prisma\." "$f")
  if [ "$count" -gt 3 ]; then
    echo "REVIEW: $f has $count separate Prisma calls"
  fi
done
```

### Check 2: Missing Database Indexes

Check for queries filtering on non-indexed columns:

1. Get current indexes from Prisma schema:
   ```bash
   grep -A2 "@@index\|@@unique\|@unique" prisma/schema.prisma
   ```

2. Check for common query patterns that may need indexes:
   ```sql
   -- Via Neon MCP explain_sql_statement:
   EXPLAIN ANALYZE SELECT * FROM "AuditLog" WHERE "userId" = 'test' ORDER BY "createdAt" DESC LIMIT 50;
   EXPLAIN ANALYZE SELECT * FROM "Intake" WHERE "patientId" = 'test' AND "status" = 'SUBMITTED';
   EXPLAIN ANALYZE SELECT * FROM "Message" WHERE "recipientId" = 'test' AND "status" = 'UNREAD';
   EXPLAIN ANALYZE SELECT * FROM "Subscription" WHERE "userId" = 'test' AND "status" = 'ACTIVE';
   ```

3. Flag any sequential scan on tables with > 1000 rows

### Check 3: Slow Query Identification

Use Neon MCP `list_slow_queries` to get the top 10 slowest queries:

1. Flag any query over 500ms as P2
2. Flag any query over 2000ms as P1
3. For each slow query, run `explain_sql_statement` to get the query plan
4. Identify if the fix is an index, a query rewrite, or a caching opportunity

### Check 4: API Response Time Profiling

Use Playwright MCP to measure API response times for critical endpoints:

| Endpoint | Expected | Threshold |
|----------|----------|-----------|
| `GET /api/patient/profile` | < 200ms | P2 if > 500ms |
| `GET /api/patient/intake` | < 300ms | P2 if > 600ms |
| `GET /api/physician/queue` | < 500ms | P1 if > 1000ms |
| `GET /api/physician/dashboard` | < 500ms | P1 if > 1000ms |
| `POST /api/auth/login` | < 300ms | P2 if > 600ms |
| `GET /api/health` | < 100ms | P1 if > 300ms |

Method: Use `browser_network_requests` after navigating to pages that call these endpoints.

### Check 5: Bundle Size Analysis

```bash
cd premium-telehealth-website/my-app
npm run build:analyze
```

Check the output for:
1. **Total first-load JS** for key pages:
   - `/` (homepage): should be < 150KB
   - `/patient/dashboard`: should be < 200KB
   - `/intake`: should be < 250KB (complex form wizard)
   - `/physician/(portal)/dashboard`: should be < 200KB
2. **Duplicate dependencies:** Look for the same library appearing in multiple chunks
3. **Server-only code in client bundles:** Check if `prisma`, `crypto`, or `@prisma/client`
   appear in any client-side bundle (they should not)

### Check 6: Large File Impact Assessment

The following files are unusually large and may impact performance:

| File | Lines | Concern |
|------|-------|---------|
| `app/intake/IntakeClient.tsx` | 1,444 | Client component -- all JS ships to browser |
| `app/physician/(portal)/messages/page.tsx` | 1,072 | Check if this is a server or client component |
| `components/physician/PatientDetailView.tsx` | 798 | Large component -- check for unnecessary re-renders |
| `app/profile/setup/page.tsx` | 793 | May be dead code (P2 finding 5.4) -- if dead, remove from bundle |

## Output Format
```
PERFORMANCE AUDIT REPORT
========================
Date: YYYY-MM-DD

DATABASE:
  [WARN] N+1 detected: app/api/physician/patients/route.ts queries PatientProfile
         in a loop (line 45) -- use Prisma include instead
  [FAIL] Slow query: AuditLog query averages 1200ms -- missing index on
         (userId, createdAt) -- P1
  [PASS] All other queries under 500ms threshold

API RESPONSE TIMES:
  [PASS] GET /api/patient/profile: 180ms
  [WARN] GET /api/physician/queue: 650ms (threshold 500ms)

BUNDLE SIZE:
  [PASS] Homepage first-load: 128KB
  [WARN] Intake page first-load: 312KB (threshold 250KB)
  [PASS] No server-only code in client bundles

Summary: 4 PASS, 2 WARN, 1 FAIL
```
```

---

## 4. Debugging Workflow

### 4.1 Trigger Modes

Team G operates in three modes:

| Mode | Trigger | Frequency | Agents |
|------|---------|-----------|--------|
| **Reactive** | PM receives a bug report from a user or from Teams A-D | On demand | G1, G2, or G3 (based on triage) |
| **Scheduled** | Automated health checks on a regular cadence | Weekly | All G1/G2/G3 run in parallel |
| **Proactive** | PM requests a deep investigation of a known problem area | Sprint-based | 1-2 agents focused on specific area |

### 4.2 Reactive Debugging Flow

```
Bug Report
  |
  v
PM triages: Integration? Data? Runtime?
  |
  +-- Integration --> G1 runs /debug-investigate
  |                     |
  +-- Data ---------> G2 runs /debug-investigate
  |                     |
  +-- Runtime ------> G3 runs /debug-investigate
                        |
                        v
                  Bug Report (structured)
                        |
                        v
                  PM reviews severity
                        |
                  +-----+-----+
                  |           |
                P0-P1       P2-P3
                  |           |
              Immediate    Next sprint
              dispatch     backlog
                  |           |
                  v           v
           Team A or B    tasks.md
           implements     updated
                  |
                  v
           Team G verifies fix
```

### 4.3 Scheduled Health Check Flow

Run weekly (or before deployments):

```
PM triggers scheduled check
  |
  +-- G1 runs /integration-health  (parallel)
  |
  +-- G2 runs /data-integrity-check  (parallel)
  |
  +-- G3 runs /perf-audit  (parallel)
  |
  v
Three reports merged
  |
  v
PM reviews findings
  |
  +-- New bugs --> tasks.md
  |
  +-- Regressions --> immediate dispatch to A/B
  |
  +-- Trends --> Team E for architecture decisions
```

### 4.4 Parallel Investigation (Non-Overlapping Scopes)

G1, G2, and G3 have strictly separated scopes to avoid conflicts:

| Concern | G1 | G2 | G3 |
|---------|:--:|:--:|:--:|
| Stripe API params | X | | |
| SendGrid config | X | | |
| DoseSpot mock mode | X | | |
| PHI encryption roundtrip | | X | |
| Audit log completeness | | X | |
| Orphaned DB records | | X | |
| Schema drift | | X | |
| Auth token flow | | | X |
| Middleware routing | | | X |
| API response times | | | X |
| Bundle size | | | X |
| Client-side errors | | | X |

If a bug spans multiple scopes (e.g., "Stripe webhook fails to create user" involves both Stripe integration AND data integrity), G1 investigates the Stripe side and G2 investigates the data side. They produce separate bug reports that the PM can cross-reference.

### 4.5 Bug Report Format (Canonical)

Every Team G bug report follows this exact format:

```markdown
## BUG REPORT: G[1|2|3]-YYYY-NNNN

**Severity:** P0 (service down) | P1 (data integrity/security) | P2 (degraded experience) | P3 (cosmetic/minor)
**Category:** Integration | Data Integrity | Auth/Middleware | UI/UX | Performance
**Discovered:** YYYY-MM-DD
**Debugger:** G1 | G2 | G3
**Reproducible:** Always | Sometimes | Intermittent | Cannot reproduce

### Summary
[One sentence: what is broken and who is affected]

### Root Cause
**File:** `premium-telehealth-website/my-app/path/to/file.ts` line XX
**Cause:** [Specific technical explanation of WHY it fails]
**Pattern:** [Is this a one-off or systemic pattern?]

### Reproduction Steps
1. [Prerequisite state]
2. [Action taken]
3. [Observed behavior]
4. [Expected behavior]

### Affected Users/Flows
- **User roles:** PATIENT / PHYSICIAN / ADMIN / ALL
- **User flows:** [e.g., "Payment-first onboarding", "Prescription approval"]
- **Estimated impact:** [e.g., "All new patients since 2026-03-15"]

### Fix Instructions
**File(s) to modify:**
- `path/to/file1.ts` (line XX-YY)
- `path/to/file2.ts` (line ZZ)

**Changes:**
1. In `file1.ts` line XX: Change `oldCode` to `newCode` because [reason]
2. In `file2.ts` line ZZ: Add `newCode` because [reason]

**Migration required:** Yes/No
**Env var change required:** Yes/No -- [details]

### Verification Test
```bash
# Command to verify the fix
npm run test:unit -- --reporter=verbose -t "test name"
# Or manual verification:
curl -X GET https://rimalhealth.com/api/health
```

### Dispatch
**Assign to:** Team A (backend) / Team B (frontend)
**Estimated effort:** Small (< 1hr) / Medium (1-4hr) / Large (4+hr)
**Related tasks:** tasks.md 0.1.1, 1.2.2 (link to existing task if applicable)
**Blocked by:** [other tasks, if any]
```

### 4.6 How PM Dispatches Fixes

After receiving a bug report from Team G:

1. **PM reviews severity:**
   - P0: Dispatch immediately to Team A or B. Skip sprint planning.
   - P1: Dispatch within 24 hours. Add to current sprint.
   - P2: Add to `tasks.md` under TASK 1 (Known Bugs). Schedule for next sprint.
   - P3: Add to `tasks.md` under TASK 0 (Technical Debt). Backlog.

2. **PM assigns team:**
   - Backend bugs (API routes, Prisma, auth, integrations) --> Team A
   - Frontend bugs (components, pages, forms, CSS) --> Team B
   - Cross-cutting bugs --> Team A (backend fix) + Team B (frontend fix), coordinated

3. **PM includes in dispatch:**
   - The full bug report from Team G
   - Priority and deadline
   - Any additional context from user reports

4. **After fix is implemented:**
   - Team A/B marks task as done in `tasks.md`
   - PM triggers Team G to verify the fix (re-run the relevant check)
   - Team G confirms fix or reports regression

---

## 5. Known Bug Areas (from Codebase Analysis)

These are Team G's **ongoing investigation targets** -- known issues from the P2 codebase analysis that require active monitoring.

### 5.1 Dual Encryption Systems (P1 -- Data Integrity Risk)

**Status:** Actively investigated by G2
**Tasks:** tasks.md 0.1.3, 0.6.2

| System | File | Key Env Var | Format | Active? |
|--------|------|-------------|--------|---------|
| Primary (Prisma extension) | `lib/encryption/phi.ts` | `PHI_ENCRYPTION_KEY` | Hex, 64+ chars | YES -- encrypts 6 models, 28 fields |
| HIPAA module | `lib/hipaa/encryption.ts` | `ENCRYPTION_KEY` | Base64, 32 bytes | LIKELY DEAD -- 0 imports found |
| DB module | `lib/db/encryption.ts` | Unknown | Unknown | LIKELY DEAD -- unclear usage |

**Risk:** If `PHI_ENCRYPTION_KEY` is not set but `ENCRYPTION_KEY` is, `lib/env-validation.ts` will pass (it only checks `ENCRYPTION_KEY`), but the Prisma encryption extension will silently fail.

**Investigation cadence:** Monthly G2 check via `/data-integrity-check`
**Resolution:** Consolidate to single encryption module (tasks.md 0.1.3). Update `lib/env-validation.ts` to also require `PHI_ENCRYPTION_KEY`.

### 5.2 Dual Stripe Implementations (P2 -- Integration Drift Risk)

**Status:** Actively investigated by G1
**Task:** tasks.md 0.1.1

| Module | File | Lines | Importers |
|--------|------|-------|-----------|
| Old | `lib/integrations/stripe.ts` | 693 | 4 billing routes |
| New | `lib/stripe/stripe-server.ts` | ~300 | Webhook handler, subscription service, checkout client |

**Risk:** The two modules may diverge in API version, error handling, or price ID configuration. Currently both use `2026-01-28.clover` -- but this could drift after an upgrade.

**Investigation cadence:** Before every deployment, G1 runs `/integration-health`
**Resolution:** Consolidate to `lib/stripe/` module, migrate 4 billing routes (tasks.md 0.1.1)

### 5.3 Dual Audit Loggers (P2 -- Compliance Gap Risk)

**Status:** Actively investigated by G2
**Task:** tasks.md 0.1.2

| Logger | File | Lines | Importers |
|--------|------|-------|-----------|
| General (active) | `lib/audit/logger.ts` | 660 | 66 files |
| HIPAA (appears dead) | `lib/hipaa/audit-logger.ts` | 724 | 0 files |

**Risk:** The HIPAA audit logger has 724 lines of specialized HIPAA logging code that may have features not present in the general logger. If the general logger is missing HIPAA-required fields, audit compliance is incomplete.

**Investigation cadence:** Monthly G2 check
**Resolution:** Verify `lib/audit/logger.ts` covers all HIPAA requirements from the HIPAA logger. If yes, remove `lib/hipaa/audit-logger.ts`. If no, merge the missing features. (tasks.md 0.1.2)

### 5.4 Missing Env Vars in .env.example (P2 -- Developer Experience)

**Status:** Tracked, not actively investigated
**Task:** tasks.md 0.4 (10 items)

12 env vars are used in code but missing from `.env.example`:
- `PHI_ENCRYPTION_KEY`, `ADMIN_EMAIL`, `REDIS_PASSWORD`, `REDIS_TLS_ENABLED`
- `DISABLE_API_CACHE`, `REQUIRE_EMAIL_VERIFICATION`, `REQUIRE_PAYMENT`
- `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`
- `AUDIT_HASH_SALT`, `AWS_S3_BUCKET_NAME`

**Risk:** New developers or CI environments may miss critical config, leading to silent failures.

### 5.5 Vitest Default Config (P3 -- False Test Confidence)

**Status:** Tracked
**Task:** tasks.md 0.6.1

File: `vitest.config.ts` -- `include: ['tests/integration/**/*.test.ts']`

`npm test` only runs integration tests. Developers may believe they have passing tests when unit tests (auth, encryption, RBAC, validation) are not being executed.

**Investigation cadence:** G3 flags this in every `/perf-audit` run until fixed.

### 5.6 DoseSpot Mock Mode (P2 -- Integration Stub)

**Status:** Tracked
**Tasks:** tasks.md 1.2.2, 3.1

File: `lib/integrations/dosespot.ts` line 54
File: `app/api/physician/prescriptions/send/route.ts` line 142 (TODO)

The prescription flow uses DoseSpot mock mode. Real e-prescriptions are not sent. This is acceptable during development but MUST be resolved before prescriptions are offered to real patients.

**Investigation cadence:** G1 checks `DOSESPOT_MOCK_MODE` value in every `/integration-health` run.

### 5.7 GA4 Stub (P3 -- Analytics Gap)

**Status:** Tracked
**Task:** tasks.md 1.2.1

`NEXT_PUBLIC_GA_MEASUREMENT_ID` is read in `app/layout.tsx` metadata but no Google Analytics script tag exists in any layout file. Analytics data is not being collected.

---

## 6. Integration with Existing Teams

### 6.1 Team G vs Team A's `systematic-debugging`

| Aspect | Team A `systematic-debugging` | Team G |
|--------|-------------------------------|--------|
| **Trigger** | Reactive -- developer hits a bug during their work | Proactive -- hunts for bugs before users hit them |
| **Scope** | The specific file/feature the developer is working on | The entire codebase, all integrations, all data |
| **Output** | A fix (code change) | A bug report (diagnosis + fix instructions) |
| **Who fixes** | Team A fixes it themselves | Team A or B fixes it, based on PM dispatch |
| **Duration** | Minutes to hours (within a task) | Scheduled runs (weekly) or focused investigations |
| **Skills used** | `systematic-debugging` (Tier 1, always active) | `/debug-investigate`, `/integration-health`, `/data-integrity-check`, `/perf-audit` |

**Key distinction:** Team A debugs what they encounter. Team G debugs what nobody has encountered yet.

### 6.2 How Team G's Reports Feed into tasks.md

When Team G produces a bug report:

1. **PM reviews** the report for accuracy and severity
2. **PM adds** the bug to `tasks.md`:
   - P0-P1 bugs: Added to **TASK 1: Known Bugs / Active Issues** with immediate assignment
   - P2 bugs: Added to **TASK 1** for next sprint
   - P3 bugs: Added to **TASK 0: Technical Debt** if it is a systemic issue
3. **PM cross-references** with existing tasks to avoid duplicates
4. **PM updates** the bug report ID in `tasks.md` for traceability

Example `tasks.md` entry created from a Team G report:

```markdown
- [ ] **1.4 G-Reports**
  - [ ] 1.4.1 [G2-2026-0001] Plaintext PHI in Message table (3 records) -- P0
    - Root cause: Encryption extension skipped during bulk insert
    - Fix: Re-encrypt affected records, add guard in bulk insert path
    - Assigned: Team A
```

### 6.3 How Team G Validates Fixes

After Teams A/B implement a fix based on a Team G report:

1. **Team A/B** marks the task as complete in `tasks.md` and notifies PM
2. **PM triggers Team G** to re-run the specific check that found the original bug
3. **Team G agent** runs the relevant skill:
   - For integration bugs: G1 runs `/integration-health` (targeted check)
   - For data integrity: G2 runs `/data-integrity-check` (targeted check)
   - For runtime/perf: G3 runs `/perf-audit` (targeted check)
4. **Team G confirms** one of:
   - **VERIFIED:** Bug is fixed. Close the task.
   - **REGRESSION:** Fix introduced a new issue. New bug report created.
   - **INCOMPLETE:** Original bug persists. Task reopened with additional notes.

### 6.4 Team G in the Skills Matrix

Addition to `skills_matrix.md` Section 1:

| Team | Role | Primary Skills | Secondary Skills | Typical Agents |
|------|------|---------------|-----------------|----------------|
| **G: Debugging** | Proactive bug hunting, root cause analysis, integration health monitoring, data integrity verification | `/debug-investigate`, `/integration-health`, `/data-integrity-check`, `/perf-audit` | `systematic-debugging`, `verification-before-completion` | 1-3 (parallel) |

Addition to Skill-to-Team Matrix:

| Skill | G (Debug) |
|-------|:---------:|
| `/debug-investigate` | **P** |
| `/integration-health` | **P** |
| `/data-integrity-check` | **P** |
| `/perf-audit` | **P** |
| `systematic-debugging` | S |
| `verification-before-completion` | S |

---

## Appendix A: Quick Reference -- File Paths for Debugging

### Integration Files

| Integration | Primary File | Secondary Files |
|-------------|-------------|-----------------|
| Stripe (old) | `lib/integrations/stripe.ts` (693 lines) | -- |
| Stripe (new) | `lib/stripe/stripe-server.ts` | `lib/stripe/stripe-client.ts`, `lib/stripe/stripe-webhooks.ts`, `lib/stripe/index.ts` |
| Stripe webhook | `app/api/webhooks/stripe/route.ts` (617 lines) | -- |
| SendGrid | `lib/integrations/sendgrid.ts` | `lib/notifications/templates.ts` (854 lines) |
| DoseSpot | `lib/integrations/dosespot.ts` (605 lines) | `lib/integrations/dosespot.mock.ts` (739 lines), `lib/integrations/dosespot.types.ts` |
| S3 | `lib/integrations/s3.ts` (994 lines) | `lib/services/document-service.ts` |
| Twilio | `lib/integrations/twilio.ts` | -- |
| Redis | `lib/redis/client.ts` | `lib/redis/cache.ts`, `lib/redis/session.ts` |

### Encryption Files

| Module | File | Key Env Var |
|--------|------|-------------|
| Primary PHI | `lib/encryption/phi.ts` | `PHI_ENCRYPTION_KEY` (hex) |
| HIPAA encryption | `lib/hipaa/encryption.ts` | `ENCRYPTION_KEY` (base64) |
| DB encryption | `lib/db/encryption.ts` | Unknown |
| Prisma extension | `lib/db/encryption-extension.ts` | Uses `lib/encryption/phi.ts` |
| DB middleware | `lib/db/encryption-middleware.ts` | Unknown |

### Auth Files

| Module | File | Lines |
|--------|------|-------|
| JWT | `lib/auth/jwt.ts` | -- |
| Require auth | `lib/auth/require-auth.ts` | -- |
| RBAC | `lib/auth/rbac.ts` | 39 permissions |
| Session | `lib/auth/session.ts`, `lib/auth/session-helpers.ts` | -- |
| Password | `lib/auth/password.ts`, `lib/auth/account-lockout.ts` | -- |
| Middleware | `middleware.ts` | 314 |

### Audit Files

| Module | File | Lines | Importers |
|--------|------|-------|-----------|
| Active logger | `lib/audit/logger.ts` | 660 | 66 files |
| Dead? logger | `lib/hipaa/audit-logger.ts` | 724 | 0 files |
| Audit service | `lib/services/audit-service.ts` | -- | Multiple API routes |
| Audit middleware | `lib/audit/middleware.ts` | 693 | -- |

### Config Files

| File | Purpose |
|------|---------|
| `lib/env-validation.ts` | Runtime env var validation (requires `ENCRYPTION_KEY`, not `PHI_ENCRYPTION_KEY`) |
| `lib/constants.ts` | Session config, security headers, retention periods |
| `vitest.config.ts` | Default test config (integration-only -- known issue) |
| `vitest.unit.config.ts` | Unit test config |
| `vitest.integration.config.ts` | Integration test config |
| `middleware.ts` | Route protection, PUBLIC_ROUTES, STATIC_ROUTES |

---

## Appendix B: MCP Tool Commands for Team G

### Neon MCP (Database)

```
# Check for unencrypted PHI
mcp__Neon__run_sql: SELECT id, "firstName" FROM "PatientProfile" WHERE "firstName" NOT LIKE 'enc:v1:%' AND "firstName" IS NOT NULL LIMIT 10;

# Count orphaned records
mcp__Neon__run_sql: SELECT COUNT(*) FROM "Subscription" s LEFT JOIN "User" u ON s."userId" = u.id WHERE u.id IS NULL;

# Check slow queries
mcp__Neon__list_slow_queries: (returns top slow queries by avg execution time)

# Explain a suspicious query
mcp__Neon__explain_sql_statement: EXPLAIN ANALYZE SELECT * FROM "AuditLog" WHERE "userId" = 'xxx' ORDER BY "createdAt" DESC LIMIT 50;

# Verify schema matches Prisma
mcp__Neon__describe_table_schema: PatientProfile
mcp__Neon__get_database_tables: (list all tables)
```

### Playwright MCP (Browser Testing)

```
# Navigate to patient dashboard and check for errors
mcp__plugin_playwright_playwright__browser_navigate: https://rimalhealth.com/patient/dashboard
mcp__plugin_playwright_playwright__browser_console_messages: (check for errors)
mcp__plugin_playwright_playwright__browser_network_requests: (check for failed requests)

# Test checkout flow
mcp__plugin_playwright_playwright__browser_navigate: https://rimalhealth.com/checkout/payment
mcp__plugin_playwright_playwright__browser_take_screenshot: (visual verification)

# Responsive testing
mcp__plugin_playwright_playwright__browser_resize: { width: 375, height: 812 }
mcp__plugin_playwright_playwright__browser_take_screenshot: (mobile view)
```

### Context7 (Documentation Lookup)

```
# Check current Stripe API docs
mcp__context7__resolve-library-id: stripe
mcp__context7__query-docs: { libraryId: "stripe", query: "checkout session create parameters" }

# Check Prisma extension docs
mcp__context7__resolve-library-id: prisma
mcp__context7__query-docs: { libraryId: "prisma", query: "client extensions encryption" }
```

### Perplexity (Research)

```
# Research Stripe API changes
mcp__perplexity__search: "Stripe API version 2026-01-28 breaking changes"

# Research HIPAA encryption requirements
mcp__perplexity__reason: "HIPAA technical safeguards encryption at rest requirements 2026"
```

---

*This document should be updated when: new integrations are added, new encryption modules are created, the dual implementation issues (Stripe, audit, encryption) are resolved, or new MCP tools become available.*
