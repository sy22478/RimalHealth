# Team F: Code Review — Design Document

> **Prepared by:** E-Team (Planning & Coordination)
> **Date:** 2026-03-25
> **Project:** RimalHealth HIPAA Telehealth Platform
> **Status:** Team design specification — ready for PM adoption

---

## 1. Team F Mission & Scope

### 1.1 Mission

Team F is the **quality gate** between implementation and deployment. Every code change that touches PHI, authentication, payments, or business logic must pass Team F review before reaching production. Team F does not write feature code — it reads, analyzes, and reports.

### 1.2 What Team F Reviews

Team F reviews all code produced by:

| Source Team | Review Scope |
|-------------|--------------|
| **Team A (API & Backend)** | API route auth patterns, Prisma queries with PHI, Stripe integration changes, business logic correctness |
| **Team B (Frontend & UX)** | Client-side PHI exposure risks, `'use client'` directive usage, Tailwind v4 token compliance, form validation wiring |
| **Team C (Testing & QA)** | Test coverage adequacy, test isolation (no PHI in fixtures), mock correctness |
| **Team D (DevOps & Deployment)** | Env var exposure, CI/CD config security, Netlify build settings, migration safety |

### 1.3 What Team F Reports to the PM

Each review produces a **structured report** containing:

- **Findings** — specific issues with file:line references, severity, and category
- **Risk assessment** — overall risk level (LOW / MEDIUM / HIGH / CRITICAL) for the change set
- **Fix suggestions** — concrete code changes or patterns to apply
- **Compliance status** — PASS / CONDITIONAL PASS / FAIL for HIPAA, security, and code quality gates

### 1.4 When Team F Activates

| Trigger | Review Level | Rationale |
|---------|-------------|-----------|
| After any agent completes a feature or bug fix | Full (F1+F2+F3) | Standard quality gate |
| Before every production deploy (`/deploy`) | Full (F1+F2+F3) | Pre-deploy safety check |
| On-demand by PM | Configurable (any combination) | Targeted review |
| After changes to `lib/auth/`, `lib/encryption/`, `lib/audit/`, `middleware.ts` | F1+F3 mandatory | Security-critical paths |
| After changes to `app/api/webhooks/stripe/route.ts` or `lib/stripe/` | F3 mandatory | Payment-critical path |
| After changes to any API route under `app/api/patient/` or `app/api/physician/` | F1 mandatory | PHI access paths |
| After new Prisma model or schema change | F1+F2 mandatory | Data model integrity |

---

## 2. Agent Roles Within Team F

### 2.1 F1: HIPAA Compliance Reviewer

**Purpose:** Verify that all code changes comply with HIPAA regulations — PHI is encrypted, access is logged, and no PHI leaks through logs, URLs, error messages, or client-side storage.

**Primary Skills:**
- `superpowers:verification-before-completion` (P0)
- `superpowers:systematic-debugging` (for tracing PHI data flow)

**MCP Tools Needed:**
- `Grep` / `Read` / `Glob` — code scanning
- `Neon:describe_table_schema` — verify encrypted column types match expectations
- `Serena:find_symbol`, `Serena:find_referencing_symbols` — trace PHI field usage across the codebase
- `Serena:search_for_pattern` — pattern matching for PHI identifiers

**Concrete Checklist:**

| # | Check | Files to Scan | What to Look For |
|---|-------|--------------|-----------------|
| F1-01 | PHI fields use `encryptPHI()` on write | `lib/db/encryption-extension.ts` | Every model in `PHI_FIELDS` map covers all PHI columns from `prisma/schema.prisma` |
| F1-02 | `auditLogger.log*()` called on every PHI access | All `app/api/patient/**/*.ts`, `app/api/physician/**/*.ts` | Any Prisma query on PatientProfile, Intake, Review, Prescription, Message, PhysicianNote must have a corresponding `auditLogger` or `AuditService` call |
| F1-03 | No `console.log` / `console.error` with PHI | All `.ts` / `.tsx` files | Grep for `console\.(log|error|warn|debug|info)\(.*\b(firstName|lastName|dateOfBirth|phone|address|medical|medication|allergies|insurance|ssn|mrn)\b` |
| F1-04 | No PHI in URL params or query strings | All `app/api/**/*.ts`, all client fetch calls | Grep for query parameters containing PHI field names; check `NextURL.searchParams` usage |
| F1-05 | No PHI in JWT token payloads | `lib/auth/jwt.ts`, `lib/auth/session.ts` | JWT payload should contain only `userId`, `role`, `email` — no name, DOB, medical data |
| F1-06 | No PHI in error messages returned to client | All `app/api/**/*.ts` | `NextResponse.json({ error: ... })` must use generic messages, never interpolate PHI |
| F1-07 | No PHI in `localStorage` / `sessionStorage` / cookies (besides httpOnly auth) | All `'use client'` components | Grep for `localStorage\.setItem\|sessionStorage\.setItem\|document\.cookie` near PHI data |
| F1-08 | No PHI in email subject lines | `lib/notifications/templates.ts` | Subject lines must be generic ("Your account update", not "Your Naltrexone prescription") |
| F1-09 | PHI response bodies do not over-fetch | All `app/api/**/*.ts` | Prisma `select` or explicit field filtering — no `findUnique()` returning entire model without select |
| F1-10 | 7-year data retention policy respected | `lib/hipaa/data-retention.ts` | No hard deletes of PHI — must use soft delete or archival |
| F1-11 | New Prisma models with PHI registered in encryption extension | `prisma/schema.prisma` vs `lib/db/encryption-extension.ts` | Any new model with PHI fields must be added to `PHI_FIELDS` map |
| F1-12 | Audit log entries include required HIPAA fields | `lib/audit/logger.ts`, `lib/audit/types.ts` | Every log entry has: who (userId), what (action), when (timestamp), where (ipAddress, userAgent) |

**Output Format:**

```
## F1: HIPAA Compliance Review
**Status:** PASS | CONDITIONAL PASS | FAIL
**Risk Level:** LOW | MEDIUM | HIGH | CRITICAL

### Findings
| # | Severity | File:Line | Issue | Fix |
|---|----------|-----------|-------|-----|
| 1 | CRITICAL | app/api/patient/profile/route.ts:45 | Missing auditLogger call after Prisma read | Add `await AuditService.logPatientProfileAccess(userId, ...)` |

### PHI Encryption Coverage
- Models checked: [list]
- Fields verified: [count]/28
- Gaps: [list any unencrypted PHI fields]

### Audit Logging Coverage
- Routes checked: [count]
- Routes with logging: [count]
- Gaps: [list routes missing audit calls]
```

---

### 2.2 F2: Code Quality Reviewer

**Purpose:** Ensure code follows RimalHealth conventions (CLAUDE.md), maintains consistency, uses correct framework patterns, and avoids performance anti-patterns.

**Primary Skills:**
- `superpowers:verification-before-completion` (P1)
- `frontend-design:frontend-design` (for UI component reviews)

**MCP Tools Needed:**
- `Grep` / `Read` / `Glob` — code scanning
- `Context7:resolve-library-id`, `Context7:query-docs` — verify API usage against current library versions
- `Serena:get_symbols_overview` — understand module structure and exported symbols

**Concrete Checklist:**

| # | Check | What to Look For |
|---|-------|-----------------|
| F2-01 | TypeScript strict mode compliance | No `any` without justification comment; explicit return types on all functions |
| F2-02 | Zod v4 syntax | `{ message: '...' }` not `{ required_error: '...' }` in all Zod schemas (especially `lib/validation/schemas.ts`) |
| F2-03 | `'use client'` directive present | Every component using hooks (`useState`, `useEffect`, `useContext`, `useRouter`) or browser APIs has `'use client'` at top |
| F2-04 | Tailwind v4 token usage | No raw hex colors (e.g., `#0A2540`); use token names (`navy`, `ocean`, `navy-600`). No `tailwind.config.js` references |
| F2-05 | `@layer components` classes used | `btn-primary`, `btn-secondary`, `card-hover`, `section-padding`, `container-custom` instead of raw utility chains for standard patterns |
| F2-06 | `interface` vs `type` convention | `interface` for object shapes, `type` for unions and primitives |
| F2-07 | React Hook Form + Zod for forms | All forms use `useForm` with `zodResolver` — no uncontrolled forms or custom validation |
| F2-08 | `export const dynamic = 'force-dynamic'` on server components with Prisma | Any page component that runs Prisma queries directly must have this export |
| F2-09 | Import path consistency | `@/lib/audit/index` (explicit) not `@/lib/audit` (barrel) for Turbopack compatibility |
| F2-10 | Error handling pattern | All API routes wrap logic in try/catch; errors return generic messages; `console.error('Route error:', error)` pattern used (never expose internals) |
| F2-11 | Auth HOF pattern | `const auth = await requireRole(request, [Role.X]); if (auth instanceof NextResponse) return auth;` — not custom JWT parsing |
| F2-12 | Prisma query efficiency | No N+1 queries; use `include` or `select` appropriately; pagination on list endpoints |
| F2-13 | shadcn/ui "new-york" style | UI components from `components/ui/` use the "new-york" variant, not "default" |
| F2-14 | No orphaned route group usage | New patient pages go in `app/patient/` not `app/(patient)/`; new physician pages in `app/physician/(portal)/` |
| F2-15 | Environment variable documentation | New env vars added to `.env.example` with documentation comments |

**Output Format:**

```
## F2: Code Quality Review
**Status:** PASS | CONDITIONAL PASS | FAIL
**Risk Level:** LOW | MEDIUM | HIGH

### Findings
| # | Severity | File:Line | Issue | Fix |
|---|----------|-----------|-------|-----|
| 1 | WARNING | components/patient/NewForm.tsx:12 | Raw hex color `#0284C7` used | Replace with `ocean` or `ocean-500` token |

### Convention Compliance
- TypeScript strict: [PASS/FAIL]
- Zod v4 syntax: [PASS/FAIL]
- Tailwind v4 tokens: [PASS/FAIL]
- Import paths: [PASS/FAIL]
- Auth patterns: [PASS/FAIL]

### Performance Notes
- [Any N+1 queries, missing pagination, etc.]
```

---

### 2.3 F3: Security Reviewer

**Purpose:** Identify security vulnerabilities — auth bypass, injection, missing rate limiting, CSRF gaps, OWASP Top 10 coverage.

**Primary Skills:**
- `superpowers:systematic-debugging` (P0)
- `superpowers:verification-before-completion` (P1)

**MCP Tools Needed:**
- `Grep` / `Read` / `Glob` — code scanning
- `Neon:run_sql` — verify database constraints and row-level security
- `Playwright:browser_console_messages`, `Playwright:browser_network_requests` — runtime security checks on live site
- `Perplexity:search` — research latest CVEs for dependencies

**Concrete Checklist:**

| # | Check | OWASP Category | What to Look For |
|---|-------|---------------|-----------------|
| F3-01 | Auth on every protected API route | A01: Broken Access Control | Every route in `app/api/patient/`, `app/api/physician/`, `app/api/admin/` calls `requireAuth`, `requireRole`, `requirePermission`, or `withPermission` |
| F3-02 | Role enforcement matches route pattern | A01: Broken Access Control | Patient routes use `Role.PATIENT`, physician use `Role.PHYSICIAN`, admin use `Role.ADMIN`. No route allows wrong role |
| F3-03 | Object-level authorization (IDOR) | A01: Broken Access Control | Patient can only access own data — verify `where: { userId }` or equivalent on all patient routes. Physician routes verify patient-physician relationship where applicable |
| F3-04 | Zod validation on all POST/PUT/PATCH bodies | A03: Injection | Every mutating API route uses `z.object({...}).safeParse(body)` before processing. No raw `request.json()` used directly |
| F3-05 | SQL injection prevention | A03: Injection | All database queries use Prisma (parameterized). Grep for `prisma.$queryRaw` or `prisma.$executeRaw` — must use `Prisma.sql` tagged template, never string concatenation |
| F3-06 | XSS prevention in responses | A03: Injection | HTML responses sanitized. Check `lib/security/sanitization.ts` is used on user-generated content before rendering |
| F3-07 | Rate limiting on auth endpoints | A04: Insecure Design | `POST /api/auth/login`, `/register`, `/forgot-password`, `/reset-password` have rate limiting (5 req/15 min per CLAUDE.md). Check `lib/security/rate-limit.ts` usage |
| F3-08 | Account lockout active | A07: Identification & Auth Failures | `lib/auth/account-lockout.ts` called in login flow. Redis keys `auth:failed_attempts:<email>` and `auth:locked:<email>` used |
| F3-09 | CSRF protection on state-changing endpoints | A05: Security Misconfiguration | `lib/security/csrf.ts` validates CSRF tokens on forms. Check that POST endpoints from browser forms include CSRF validation |
| F3-10 | Security headers configured | A05: Security Misconfiguration | `lib/constants.ts` `SECURITY_HEADERS` and `next.config.ts` include: X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, Content-Security-Policy, X-XSS-Protection |
| F3-11 | JWT secret strength | A02: Cryptographic Failures | `JWT_SECRET` is 64+ character hex string (not weak/default). Token expiry: 15 min access, 7 days refresh |
| F3-12 | Stripe webhook signature verification | A08: Software & Data Integrity Failures | `app/api/webhooks/stripe/route.ts` verifies `stripe-signature` header using `STRIPE_WEBHOOK_SECRET` before processing |
| F3-13 | No secret exposure in client bundles | A05: Security Misconfiguration | Only `NEXT_PUBLIC_*` vars reach the client. Grep for `process.env.STRIPE_SECRET_KEY`, `process.env.JWT_SECRET`, etc. in `'use client'` files |
| F3-14 | Dependency vulnerabilities | A06: Vulnerable Components | `npm audit` shows no critical/high vulnerabilities. Check `package-lock.json` for known CVEs |
| F3-15 | Password policy enforcement | A07: Identification & Auth Failures | `lib/security/password-policy.ts` enforces minimum length, complexity. Registration and set-password routes validate against policy |
| F3-16 | Refresh token rotation | A07: Identification & Auth Failures | `POST /api/auth/refresh` invalidates old refresh token and issues new one (prevents token reuse attacks) |

**Output Format:**

```
## F3: Security Review
**Status:** PASS | CONDITIONAL PASS | FAIL
**Risk Level:** LOW | MEDIUM | HIGH | CRITICAL

### Findings
| # | Severity | OWASP | File:Line | Issue | Fix |
|---|----------|-------|-----------|-------|-----|
| 1 | CRITICAL | A01 | app/api/patient/documents/route.ts:15 | Missing requireRole call | Add `const auth = await requireRole(request, [Role.PATIENT]);` |

### Auth Coverage
- Total protected API routes: [count]
- Routes with auth: [count]
- Unprotected routes (excluding public): [list]

### Rate Limiting Coverage
- Auth endpoints covered: [list]
- Auth endpoints missing rate limiting: [list]

### Dependency Audit
- Critical: [count]
- High: [count]
- Recommendation: [fix commands]
```

---

## 3. Custom Skills for Team F

### 3.1 `/code-review` Skill

**Location:** `.claude/skills/code-review/SKILL.md`

**Trigger:** After any agent completes a feature or bug fix. Called by PM orchestrator.

**Full Skill Definition:**

```markdown
# /code-review

Review code changes for HIPAA compliance, code quality, and security vulnerabilities.
Produces a structured report with severity levels for PM routing.

## When to Use

- After any agent (Team A, B, C, D) completes a feature or bug fix
- Before production deployments
- On-demand by PM for targeted review

## Input

The review operates on the current git diff (staged + unstaged changes). Optionally accepts:
- `--scope=hipaa|quality|security|all` (default: all)
- `--files=<glob>` (restrict to specific files)

## Process

### Step 1: Identify Changed Files

Run `git diff --name-only HEAD` and `git diff --name-only --cached` to get the full list
of changed files. Categorize them:

- **API routes** (`app/api/**/*.ts`) -> triggers F1 + F3
- **Client components** (`app/**/*.tsx`, `components/**/*.tsx`) -> triggers F2 + partial F1
- **Library modules** (`lib/**/*.ts`) -> triggers F1 + F2 + F3
- **Config files** (`middleware.ts`, `next.config.ts`, `prisma/schema.prisma`) -> triggers F2 + F3
- **Test files** (`tests/**/*.ts`) -> triggers F2 only

### Step 2: F1 — HIPAA Compliance Scan

For each changed file that touches data access:

1. **Grep for PHI field names** in changed code:
   ```bash
   # In the app root: premium-telehealth-website/my-app/
   grep -rn 'firstName\|lastName\|dateOfBirth\|phone\|addressStreet\|addressCity\|addressZip\|medicalHistory\|currentMedications\|allergies\|insuranceProvider\|insuranceMemberId\|insuranceGroupNumber\|formData\|medicationList\|clinicalNotes\|contraindications' <changed-files>
   ```

2. **Verify encryption coverage** — for any new Prisma model or field touching PHI:
   - Read `lib/db/encryption-extension.ts` and check the `PHI_FIELDS` map
   - Read `prisma/schema.prisma` and cross-reference encrypted fields

3. **Verify audit logging** — for any API route reading or writing PHI:
   ```bash
   # Check if route has audit logging
   grep -l 'auditLogger\|AuditService' <changed-api-routes>
   # Flag routes missing audit calls
   ```

4. **Scan for PHI leakage**:
   ```bash
   # Console logging with PHI
   grep -rn 'console\.\(log\|error\|warn\|debug\|info\)' <changed-files> | grep -i 'name\|dob\|birth\|phone\|address\|medical\|medication\|allerg\|insurance\|ssn'

   # PHI in URL construction
   grep -rn 'searchParams\|URLSearchParams\|encodeURIComponent.*\(name\|dob\|phone\|address\)' <changed-files>

   # Browser storage
   grep -rn 'localStorage\|sessionStorage' <changed-files>
   ```

5. **Check email templates** (if `lib/notifications/templates.ts` changed):
   - Verify subject lines are PHI-free
   - Verify body text does not include medication names or diagnosis details

### Step 3: F2 — Code Quality Scan

For all changed files:

1. **TypeScript conventions**:
   ```bash
   # Find any usage
   grep -rn ': any\b' <changed-files>
   # Check for missing return types on exported functions
   grep -rn 'export.*function\|export.*const.*=' <changed-files>
   ```

2. **Zod v4 syntax**:
   ```bash
   grep -rn 'required_error' <changed-files>
   # If found -> WARNING: use { message: '...' } instead (Zod v4)
   ```

3. **Tailwind v4 tokens**:
   ```bash
   grep -rn '#0A2540\|#0284C7\|#0369A1\|#E6F0F7\|#E0F2FE\|#10B981\|#F59E0B\|#8B5CF6' <changed-files>
   # If found -> WARNING: use token names (navy, ocean, success, warning, soft-purple)
   ```

4. **Import paths**:
   ```bash
   grep -rn "from '@/lib/audit'" <changed-files>
   # If found without /index -> WARNING: use @/lib/audit/index for Turbopack compat
   ```

5. **Auth pattern**:
   ```bash
   # Check API routes use the standard HOF pattern
   grep -l 'requireAuth\|requireRole\|requirePermission\|withAuth\|withPermission' <changed-api-routes>
   ```

6. **force-dynamic export** (if page component uses Prisma directly):
   ```bash
   grep -l 'prisma\.' <changed-pages> | while read f; do
     grep -q "dynamic.*=.*'force-dynamic'" "$f" || echo "MISSING force-dynamic: $f"
   done
   ```

### Step 4: F3 — Security Scan

For changed API routes and auth-related files:

1. **Auth presence on protected routes**:
   ```bash
   # List API routes WITHOUT auth calls
   for f in <changed-api-routes>; do
     grep -qL 'requireAuth\|requireRole\|requirePermission\|withAuth\|withPermission' "$f" && echo "NO AUTH: $f"
   done
   ```
   Exception: `app/api/auth/login/route.ts`, `app/api/auth/register/route.ts`,
   `app/api/auth/forgot-password/route.ts`, `app/api/health/route.ts`,
   `app/api/contact/route.ts`, `app/api/stripe/public-checkout-session/route.ts`,
   `app/api/webhooks/**` are legitimately public.

2. **Input validation**:
   ```bash
   # POST/PUT/PATCH routes must have Zod validation
   grep -l 'POST\|PUT\|PATCH' <changed-api-routes> | while read f; do
     grep -q 'safeParse\|\.parse(' "$f" || echo "NO VALIDATION: $f"
   done
   ```

3. **IDOR checks** — patient routes must scope queries to the authenticated user:
   ```bash
   grep -A5 'prisma\.\(patientProfile\|intake\|message\|prescription\)' <changed-patient-routes> | grep -v 'userId\|auth\.user'
   # Flag any Prisma query on patient data that does not filter by userId
   ```

4. **Raw SQL injection**:
   ```bash
   grep -rn '\$queryRaw\|\$executeRaw' <changed-files>
   # If found, verify it uses Prisma.sql tagged template, NOT string concatenation
   ```

5. **Secret exposure in client bundles**:
   ```bash
   grep -rn 'process\.env\.\(STRIPE_SECRET\|JWT_SECRET\|ENCRYPTION_KEY\|PHI_ENCRYPTION\|DATABASE_URL\|SENDGRID_API\|REDIS_\|AWS_SECRET\)' <changed-client-files>
   # Any match in 'use client' files is CRITICAL
   ```

6. **Stripe webhook verification** (if webhook route changed):
   ```bash
   grep -n 'stripe\.webhooks\.constructEvent\|constructEvent' app/api/webhooks/stripe/route.ts
   # Must be present; signature verification is mandatory
   ```

### Step 5: Consolidate Report

Merge findings from Steps 2-4 into a single report:

```
# Code Review Report
**Reviewed by:** Team F (Automated)
**Date:** [date]
**Scope:** [files reviewed]
**Trigger:** [feature completion / pre-deploy / on-demand]

## Overall Status: PASS | CONDITIONAL PASS | FAIL
## Risk Level: LOW | MEDIUM | HIGH | CRITICAL

## Summary
- Total files reviewed: [N]
- CRITICAL findings: [N]
- WARNING findings: [N]
- INFO findings: [N]

## F1: HIPAA Compliance
[F1 output]

## F2: Code Quality
[F2 output]

## F3: Security
[F3 output]

## Action Items
| Priority | Finding | Assigned To | Fix |
|----------|---------|-------------|-----|
| CRITICAL | ... | Team A | ... |
| WARNING | ... | Team B | ... |

## Recommendation
- [ ] DEPLOY — no blocking issues
- [ ] FIX FIRST — [N] critical issues must be resolved before deploy
- [ ] REDESIGN — architectural concern requires planning
```
```

---

### 3.2 `/hipaa-review` Skill (Comprehensive)

**Location:** `.claude/skills/hipaa-review/SKILL.md`

**Trigger:** Before any PR touching PHI fields or adding new data access. Also run as part of `/code-review`.

**Full Skill Definition:**

```markdown
# /hipaa-review

Comprehensive HIPAA compliance verification for RimalHealth codebase.
Checks encryption, audit logging, PHI leakage, and data handling across all changed files.

## When to Use

- Before any PR touching files in: `lib/encryption/`, `lib/audit/`, `lib/db/`, `lib/hipaa/`,
  `app/api/patient/`, `app/api/physician/`, `prisma/schema.prisma`
- After adding new Prisma models with patient data
- Before production deploys (called automatically by `/code-review`)
- On-demand for full codebase audit

## Process

### Check 1: PHI Encryption Registration (CRITICAL)

Verify every PHI field in `prisma/schema.prisma` is registered in the encryption extension.

```bash
cd premium-telehealth-website/my-app

# Read the PHI_FIELDS map from the encryption extension
grep -A 100 'PHI_FIELDS' lib/db/encryption-extension.ts

# Cross-reference with Prisma schema for models that store PHI:
# PatientProfile, Intake, Review, Prescription, Message, PhysicianNote
grep -B2 -A20 'model PatientProfile\|model Intake\|model Review\|model Prescription\|model Message\|model PhysicianNote' prisma/schema.prisma
```

**Expected:** All 28 PHI fields across 6 models are listed in `PHI_FIELDS`. Any new String
field on these models that contains identifiable or clinical data must be added.

### Check 2: encryptPHI/decryptPHI Usage (CRITICAL)

Verify the encryption functions are not bypassed.

```bash
cd premium-telehealth-website/my-app

# Find any direct Prisma writes to PHI models that bypass the extension
# The extension handles encryption automatically, but check for raw SQL writes
grep -rn '\$queryRaw.*INSERT.*patient_profile\|\$executeRaw.*UPDATE.*patient_profile\|\$queryRaw.*INSERT.*intake\|\$queryRaw.*INSERT.*review\|\$queryRaw.*INSERT.*prescription\|\$queryRaw.*INSERT.*message' app/ lib/

# Verify the encryption extension is imported in the Prisma singleton
grep -n 'encryptionExtension\|encryption-extension' lib/db/prisma.ts
```

**Expected:** Zero raw SQL writes to PHI models. Prisma singleton imports and applies the
encryption extension.

### Check 3: Audit Logging on PHI Access (CRITICAL)

Every API route that reads or writes PHI must call `auditLogger` or `AuditService`.

```bash
cd premium-telehealth-website/my-app

# List all patient API routes
find app/api/patient -name 'route.ts' -type f

# For each, check for audit logging
for f in $(find app/api/patient -name 'route.ts' -type f); do
  if ! grep -q 'auditLogger\|AuditService' "$f"; then
    echo "MISSING AUDIT: $f"
  fi
done

# Same for physician routes that access patient data
for f in $(find app/api/physician -name 'route.ts' -type f); do
  if grep -q 'patientProfile\|Intake\|Review\|Prescription\|Message' "$f"; then
    if ! grep -q 'auditLogger\|AuditService' "$f"; then
      echo "MISSING AUDIT: $f"
    fi
  fi
done
```

**Expected:** Zero routes accessing PHI without audit logging.

### Check 4: Console Logging PHI Leak (HIGH)

Scan for console output that might include PHI.

```bash
cd premium-telehealth-website/my-app

# Direct PHI field references in console statements
grep -rn 'console\.\(log\|error\|warn\|debug\|info\)' app/ lib/ --include='*.ts' --include='*.tsx' | grep -i '\bfirstName\b\|\blastName\b\|\bdateOfBirth\b\|\bphone\b\|\baddressStreet\b\|\bmedicalHistory\b\|\bcurrentMedications\b\|\ballergies\b\|\binsuranceProvider\b\|\bformData\b\|\bclinicalNotes\b'

# Generic object dumps that might contain PHI
grep -rn 'console\.\(log\|error\)\s*(' app/api/patient/ app/api/physician/ --include='*.ts' | grep -v 'Route error\|Error:\|Failed to' | grep 'data\|result\|profile\|patient\|intake\|review\|prescription\|message'
```

**Expected:** No console statements that dump PHI objects or reference PHI field names.
Acceptable: `console.error('Route error:', error)` with generic error objects.

### Check 5: PHI in URLs and Query Parameters (HIGH)

```bash
cd premium-telehealth-website/my-app

# URL construction with PHI
grep -rn 'searchParams\.set\|searchParams\.append\|URLSearchParams' app/ lib/ --include='*.ts' --include='*.tsx' | grep -i 'name\|dob\|birth\|phone\|address\|medical\|ssn'

# PHI in redirect URLs
grep -rn 'redirect.*\?\|redirect.*&' app/ lib/ --include='*.ts' --include='*.tsx' | grep -i 'name\|dob\|birth\|phone'

# PHI in fetch URLs
grep -rn 'fetch.*\?' app/ components/ --include='*.ts' --include='*.tsx' | grep -i 'name\|dob\|birth\|phone\|address'
```

**Expected:** Zero PHI values in URLs. IDs (userId, intakeId) are acceptable; names, DOBs,
and medical data are not.

### Check 6: PHI in JWT Tokens (CRITICAL)

```bash
cd premium-telehealth-website/my-app

# Check what goes into JWT payloads
grep -B5 -A20 'sign\|createAccessToken\|createRefreshToken' lib/auth/jwt.ts

# Verify JWT payload only contains: userId, role, email (maybe sessionId)
# Should NOT contain: name, dob, phone, address, medical data
```

**Expected:** JWT payload has `userId`, `role`, `email`, `sessionId` only.

### Check 7: Browser Storage PHI (HIGH)

```bash
cd premium-telehealth-website/my-app

# localStorage usage
grep -rn 'localStorage\.\(setItem\|getItem\)' app/ components/ --include='*.tsx' --include='*.ts'

# sessionStorage usage
grep -rn 'sessionStorage\.\(setItem\|getItem\)' app/ components/ --include='*.tsx' --include='*.ts'

# Cookie setting (non-httpOnly)
grep -rn 'document\.cookie' app/ components/ --include='*.tsx' --include='*.ts'
```

**Expected:** No PHI stored in browser storage. Auth tokens are httpOnly cookies set by the
server. Preferences and UI state are acceptable.

### Check 8: API Response Body Over-Exposure (MEDIUM)

```bash
cd premium-telehealth-website/my-app

# Find Prisma queries that return full models (no select clause)
grep -rn 'findUnique\|findFirst\|findMany' app/api/ --include='*.ts' | grep -v 'select:\|select :' | head -20

# Check if sensitive relations are included without filtering
grep -rn 'include:' app/api/ --include='*.ts' | grep -v 'select'
```

**Expected:** All queries returning PHI models use `select` to limit fields, or the response
explicitly filters before sending to client.

### Check 9: Error Message PHI Leakage (HIGH)

```bash
cd premium-telehealth-website/my-app

# Check all error responses for PHI interpolation
grep -rn 'NextResponse\.json.*error.*\$\|NextResponse\.json.*error.*\+' app/api/ --include='*.ts'

# Check for Prisma error details leaking to client
grep -rn 'error\.message\|error\.stack\|JSON\.stringify.*error' app/api/ --include='*.ts' | grep -v 'console'
```

**Expected:** Error responses use generic messages ("Internal server error", "Not found").
No Prisma error details, stack traces, or interpolated PHI in client-facing responses.

### Check 10: Email/SMS Content PHI (MEDIUM)

```bash
cd premium-telehealth-website/my-app

# Check email templates for PHI
grep -B5 -A10 'subject:' lib/notifications/templates.ts | grep -i 'naltrexone\|alcohol\|aud\|medication\|prescription\|diagnosis\|treatment'

# Check SMS templates
grep -B5 -A10 'smsTemplates\|SMSTemplate' lib/notifications/templates.ts lib/integrations/twilio.ts | grep -i 'naltrexone\|alcohol\|aud\|medication\|prescription\|diagnosis'
```

**Expected:** No medication names, diagnoses, or treatment specifics in email subjects or
SMS messages. Templates use generic language ("your appointment", "your account").

### Check 11: Data Retention Compliance (LOW)

```bash
cd premium-telehealth-website/my-app

# Check for hard deletes of PHI models
grep -rn '\.delete\|\.deleteMany' app/api/ lib/ --include='*.ts' | grep -i 'patient\|intake\|review\|prescription\|message\|physician.*note'

# Verify soft-delete or archival pattern
grep -rn 'softDelete\|archived\|deletedAt\|isDeleted' prisma/schema.prisma
```

**Expected:** No hard deletes of PHI records. 7-year retention period respected.

### Check 12: Dual Encryption System Consistency (MEDIUM)

```bash
cd premium-telehealth-website/my-app

# Verify which encryption module is imported where
grep -rn "from.*encryption/phi\|from.*hipaa/encryption\|from.*db/encryption" app/ lib/ --include='*.ts'

# Check env var usage consistency
grep -rn 'PHI_ENCRYPTION_KEY\|ENCRYPTION_KEY' lib/ --include='*.ts'
```

**Expected:** `lib/encryption/phi.ts` (with `PHI_ENCRYPTION_KEY`) is used for all Prisma
extension encryption. `lib/hipaa/encryption.ts` usage should be documented and intentional,
not accidental mixing.

## Output Format

```
# HIPAA Compliance Review Report
**Date:** [date]
**Scope:** [changed files or full codebase]

## Overall Status: COMPLIANT | CONDITIONAL | NON-COMPLIANT

### Critical Findings (must fix before deploy)
| # | Check | File:Line | Issue | Remediation |
|---|-------|-----------|-------|-------------|

### High Findings (should fix this sprint)
| # | Check | File:Line | Issue | Remediation |
|---|-------|-----------|-------|-------------|

### Medium Findings (track in backlog)
| # | Check | File:Line | Issue | Remediation |
|---|-------|-----------|-------|-------------|

### Encryption Coverage: [28/28 fields] or [X/28 — GAPS listed]
### Audit Logging Coverage: [N/M routes covered]
### PHI Leak Scan: [PASS/N issues found]
```
```

---

### 3.3 `/security-scan` Skill (NEW)

**Location:** `.claude/skills/security-scan/SKILL.md`

**Trigger:** Before production deploys, after auth-related changes, on-demand.

**Full Skill Definition:**

```markdown
# /security-scan

OWASP-focused security scan for the RimalHealth codebase. Detects auth bypass,
injection vulnerabilities, missing rate limiting, CSRF gaps, and dependency issues.

## When to Use

- Before any production deployment
- After changes to: `middleware.ts`, `lib/auth/`, `lib/security/`, `app/api/auth/`
- After adding new API routes
- After `npm install` of new dependencies
- On-demand for full security audit

## Process

### Scan 1: Auth Bypass Detection (OWASP A01)

Identify API routes missing authentication.

```bash
cd premium-telehealth-website/my-app

# Known public API routes (no auth required):
# app/api/auth/login/route.ts
# app/api/auth/register/route.ts
# app/api/auth/forgot-password/route.ts
# app/api/auth/reset-password/route.ts
# app/api/auth/set-password-token/route.ts
# app/api/auth/refresh/route.ts
# app/api/auth/logout/route.ts
# app/api/health/route.ts
# app/api/contact/route.ts
# app/api/stripe/public-checkout-session/route.ts
# app/api/webhooks/stripe/route.ts
# app/api/webhooks/dosespot/route.ts
# app/api/intake/route.ts (public intake creation)

# Find ALL route files
ALL_ROUTES=$(find app/api -name 'route.ts' -type f)

# Check each non-public route for auth calls
KNOWN_PUBLIC="login|register|forgot-password|reset-password|set-password-token|refresh|logout|health|contact|public-checkout-session|webhooks"

for f in $ALL_ROUTES; do
  # Skip known public routes
  echo "$f" | grep -qE "$KNOWN_PUBLIC" && continue

  # Check for auth call
  if ! grep -q 'requireAuth\|requireRole\|requirePermission\|withAuth\|withPermission' "$f"; then
    echo "CRITICAL: No auth on protected route: $f"
  fi
done
```

**Expected:** Zero unprotected non-public routes.

### Scan 2: Role Enforcement Correctness (OWASP A01)

Verify routes enforce the correct roles.

```bash
cd premium-telehealth-website/my-app

# Patient routes should require PATIENT role
for f in $(find app/api/patient -name 'route.ts'); do
  if grep -q 'requireRole' "$f"; then
    grep 'requireRole' "$f" | grep -v 'PATIENT' && echo "WRONG ROLE: $f"
  fi
done

# Physician routes should require PHYSICIAN (or PHYSICIAN+ADMIN)
for f in $(find app/api/physician -name 'route.ts'); do
  if grep -q 'requireRole' "$f"; then
    grep 'requireRole' "$f" | grep -v 'PHYSICIAN' && echo "WRONG ROLE: $f"
  fi
done

# Admin routes should require ADMIN role
for f in $(find app/api/admin -name 'route.ts'); do
  if grep -q 'requireRole' "$f"; then
    grep 'requireRole' "$f" | grep -v 'ADMIN' && echo "WRONG ROLE: $f"
  fi
done
```

### Scan 3: IDOR Vulnerability Detection (OWASP A01)

Check that patient data access is scoped to the authenticated user.

```bash
cd premium-telehealth-website/my-app

# Patient routes: every Prisma query on patient data should include userId from auth
for f in $(find app/api/patient -name 'route.ts'); do
  # Check if route uses Prisma and scopes to userId
  if grep -q 'prisma\.' "$f"; then
    if ! grep -q 'auth\.user\.userId\|userId.*auth\|user\.userId' "$f"; then
      echo "POTENTIAL IDOR: $f — Prisma query may not scope to authenticated user"
    fi
  fi
done

# Check for routes that accept user ID from request params instead of auth context
grep -rn 'params\.id\|params\.userId\|searchParams.*userId' app/api/patient/ --include='*.ts'
# Any of these should verify params.id === auth.user.userId (or be physician/admin route)
```

### Scan 4: Input Validation Gaps (OWASP A03)

```bash
cd premium-telehealth-website/my-app

# Find POST/PUT/PATCH handlers without Zod validation
for f in $(find app/api -name 'route.ts'); do
  if grep -q 'export.*async.*function.*POST\|export.*async.*function.*PUT\|export.*async.*function.*PATCH' "$f"; then
    if ! grep -q 'safeParse\|\.parse(' "$f"; then
      echo "NO VALIDATION: $f"
    fi
  fi
done

# Check for request body used without validation
grep -rn 'request\.json()' app/api/ --include='*.ts' -A3 | grep -v 'safeParse\|parse\|validate'
```

### Scan 5: SQL Injection (OWASP A03)

```bash
cd premium-telehealth-website/my-app

# Find raw SQL usage
grep -rn '\$queryRaw\|\$executeRaw\|\$queryRawUnsafe\|\$executeRawUnsafe' app/ lib/ --include='*.ts'

# $queryRawUnsafe and $executeRawUnsafe are ALWAYS dangerous
# $queryRaw and $executeRaw are safe ONLY with Prisma.sql tagged template
# Flag any string concatenation in raw queries
grep -rn '\$queryRaw\s*`\|\$executeRaw\s*`' app/ lib/ --include='*.ts' | grep '\${'
# The above catches template literals with interpolation in raw queries
```

### Scan 6: Rate Limiting Coverage (OWASP A04)

```bash
cd premium-telehealth-website/my-app

# Check auth endpoints for rate limiting
AUTH_ROUTES="app/api/auth/login/route.ts app/api/auth/register/route.ts app/api/auth/forgot-password/route.ts app/api/auth/reset-password/route.ts"

for f in $AUTH_ROUTES; do
  if [ -f "$f" ]; then
    if ! grep -q 'rateLimit\|rate-limit\|rateLimiter' "$f"; then
      echo "NO RATE LIMIT: $f"
    fi
  fi
done

# Check public checkout for rate limiting
if ! grep -q 'rateLimit\|rate-limit' app/api/stripe/public-checkout-session/route.ts; then
  echo "WARNING: No rate limit on public checkout endpoint"
fi

# Check contact form for rate limiting
if ! grep -q 'rateLimit\|rate-limit' app/api/contact/route.ts; then
  echo "WARNING: No rate limit on contact form endpoint"
fi
```

### Scan 7: CSRF Protection (OWASP A05)

```bash
cd premium-telehealth-website/my-app

# Check if CSRF module is imported in state-changing routes
grep -rn 'csrf\|CSRF\|csrfToken\|validateCSRF' app/api/ --include='*.ts'

# Check if CSRF tokens are generated for forms
grep -rn 'csrf\|CSRF' components/ app/ --include='*.tsx'
```

### Scan 8: Security Headers (OWASP A05)

```bash
cd premium-telehealth-website/my-app

# Verify security headers are configured
grep -rn 'SECURITY_HEADERS\|X-Frame-Options\|X-Content-Type-Options\|Strict-Transport-Security\|Content-Security-Policy\|X-XSS-Protection\|Referrer-Policy\|Permissions-Policy' lib/constants.ts next.config.ts middleware.ts
```

### Scan 9: Secret Exposure (OWASP A02 / A05)

```bash
cd premium-telehealth-website/my-app

# Server secrets referenced in client-side files
grep -rn "process\.env\." app/ components/ --include='*.tsx' | grep -v 'NEXT_PUBLIC_' | grep -v 'node_modules'

# Check for hardcoded secrets
grep -rn 'sk_live_\|sk_test_\|whsec_\|SG\.\|Bearer [A-Za-z0-9]' app/ lib/ --include='*.ts' --include='*.tsx' | grep -v 'node_modules\|\.example'

# Check .env files are gitignored
grep '\.env' .gitignore
```

### Scan 10: Stripe Webhook Integrity (OWASP A08)

```bash
cd premium-telehealth-website/my-app

# Verify webhook signature verification
grep -n 'constructEvent\|stripe\.webhooks' app/api/webhooks/stripe/route.ts

# Verify the raw body is used (not parsed JSON) for signature verification
grep -n 'request\.text()\|getRawBody\|request\.body' app/api/webhooks/stripe/route.ts
```

### Scan 11: Dependency Audit (OWASP A06)

```bash
cd premium-telehealth-website/my-app

# Run npm audit
npm audit --json 2>/dev/null | head -50

# Check for known problematic patterns
grep -c '"dependencies"' package.json
```

### Scan 12: Password and Token Security (OWASP A07)

```bash
cd premium-telehealth-website/my-app

# Password hashing algorithm
grep -rn 'bcrypt\|argon2\|scrypt\|hashPassword\|comparePassword' lib/auth/password.ts

# Token expiry configuration
grep -rn 'expiresIn\|maxAge\|TOKEN_EXPIRY\|ACCESS_TOKEN\|REFRESH_TOKEN' lib/auth/jwt.ts lib/auth/session.ts lib/constants.ts

# Account lockout thresholds
grep -rn 'MAX_ATTEMPTS\|LOCKOUT\|lockout' lib/auth/account-lockout.ts
```

## Output Format

```
# Security Scan Report
**Date:** [date]
**Scope:** [changed files or full codebase]

## Overall Security Rating: A | B | C | D | F

### Critical Vulnerabilities (deploy blocker)
| # | OWASP | File:Line | Vulnerability | Remediation |
|---|-------|-----------|--------------|-------------|

### High Risk (fix within 24h)
| # | OWASP | File:Line | Vulnerability | Remediation |
|---|-------|-----------|--------------|-------------|

### Medium Risk (fix this sprint)
| # | OWASP | File:Line | Vulnerability | Remediation |
|---|-------|-----------|--------------|-------------|

### Low Risk / Informational
| # | OWASP | File:Line | Note |
|---|-------|-----------|------|

### Coverage Summary
- Auth-protected routes: [N/M]
- Rate-limited endpoints: [N/M]
- Input-validated mutations: [N/M]
- Security headers: [N/M configured]
- Dependency vulnerabilities: [critical: N, high: N, moderate: N]

### Recommendation
- [ ] CLEAR TO DEPLOY
- [ ] FIX CRITICAL ISSUES FIRST — [list]
- [ ] COMPREHENSIVE REMEDIATION NEEDED
```
```

---

## 4. Review Workflow

### 4.1 Full Review Workflow (Step by Step)

```
PM Orchestrator
    |
    |--- 1. Receives signal: "Team [A/B/C/D] completed task T-XXX"
    |
    |--- 2. Dispatches Team F with context:
    |        - Task ID and description
    |        - Changed files (git diff)
    |        - Which team produced the code
    |        - Review scope (all / hipaa / quality / security)
    |
    |--- 3. Team F reads context:
    |        a. `git diff HEAD~N..HEAD` (commits since task start)
    |        b. `git diff --name-only` (file list)
    |        c. Task description from tasks.md
    |        d. Relevant CLAUDE.md sections for conventions
    |
    |--- 4. F1, F2, F3 execute IN PARALLEL:
    |        |
    |        |--- F1 (HIPAA): Runs /hipaa-review checks 1-12
    |        |--- F2 (Quality): Runs quality checks F2-01 through F2-15
    |        |--- F3 (Security): Runs /security-scan scans 1-12
    |        |
    |        (Each produces its own findings list)
    |
    |--- 5. Consolidation:
    |        - Merge findings from F1 + F2 + F3
    |        - De-duplicate (same file:line flagged by multiple reviewers)
    |        - Assign overall severity: highest individual finding wins
    |        - Generate unified report
    |
    |--- 6. Report delivered to PM:
    |        {
    |          status: "PASS" | "CONDITIONAL PASS" | "FAIL",
    |          risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    |          findings: [...],
    |          action_items: [...],
    |          recommendation: "DEPLOY" | "FIX FIRST" | "REDESIGN"
    |        }
    |
    |--- 7. PM routes action items:
             |
             |--- If PASS: Proceed to Team D for deployment
             |--- If CONDITIONAL PASS: Route warnings to original team,
             |    allow deploy with tracked tech debt
             |--- If FAIL:
                  a. CRITICAL findings -> back to producing team (urgent fix)
                  b. Create new tasks in tasks.md for each finding
                  c. Re-review after fixes (Team F activated again)
```

### 4.2 Parallel Execution Model

F1, F2, and F3 operate on the same file set but check orthogonal concerns. They can be dispatched as parallel agents using `superpowers:dispatching-parallel-agents`.

```
PM dispatches Team F:
  Agent F1 --- reads changed files --- runs HIPAA checks --- outputs F1 report
  Agent F2 --- reads changed files --- runs quality checks --- outputs F2 report
  Agent F3 --- reads changed files --- runs security checks --- outputs F3 report
                                                                     |
                                                              Consolidation agent
                                                              merges into one report
```

If only 1 agent is available, F1/F2/F3 run sequentially in the same session. The `/code-review` skill handles both modes.

### 4.3 Report Format for PM

```markdown
# Code Review Report — Task T-XXX

## Metadata
- **Task:** [task ID and title from tasks.md]
- **Producing Team:** [A/B/C/D]
- **Files Changed:** [count]
- **Review Scope:** Full (F1+F2+F3)
- **Date:** [timestamp]

## Verdict
- **Status:** PASS | CONDITIONAL PASS | FAIL
- **Risk Level:** LOW | MEDIUM | HIGH | CRITICAL
- **Recommendation:** DEPLOY | FIX FIRST | REDESIGN

## Findings Summary
| Severity | Count | Categories |
|----------|-------|------------|
| CRITICAL | 0 | — |
| WARNING | 2 | HIPAA (1), Quality (1) |
| INFO | 5 | Quality (3), Security (2) |

## Critical Findings (Block Deploy)
[None, or detailed table]

## Warning Findings (Fix Recommended)
| # | Category | Reviewer | File:Line | Issue | Suggested Fix | Route To |
|---|----------|----------|-----------|-------|---------------|----------|
| W1 | HIPAA | F1 | app/api/patient/new-route.ts:32 | Missing audit log | Add AuditService call | Team A |
| W2 | Quality | F2 | components/patient/NewForm.tsx:18 | Raw hex color | Use ocean token | Team B |

## Info Findings (Backlog)
[Table of informational items]

## Action Items for PM
1. [ ] Route W1 to Team A — estimated effort: 15 min
2. [ ] Route W2 to Team B — estimated effort: 5 min
3. [ ] After fixes, re-run `/code-review --scope=hipaa --files=app/api/patient/new-route.ts`
```

### 4.4 How PM Routes Fixes

| Finding Severity | PM Action | Timeline |
|-----------------|-----------|----------|
| CRITICAL | Dispatch producing team immediately. Block deploy. | Same session |
| WARNING | Create task in tasks.md. Route to producing team. Deploy allowed with PM approval. | Within 24h |
| INFO | Add to backlog in tasks.md. No immediate action. | Next sprint |

When fixes are applied, PM re-dispatches Team F with `--scope` narrowed to the specific checks that failed. Team F re-runs only those checks and updates the report status.

---

## 5. Skill-to-Task Mapping

### 5.1 Task Types That Trigger Review

Mapping from `tasks.md` task categories to Team F activation:

| Task Category | Tasks | Review Level | Rationale |
|---------------|-------|-------------|-----------|
| **0.1 Code Duplication** (consolidation) | 0.1.1-0.1.6 | F1+F2 | Consolidating encryption modules (0.1.3) requires F1 HIPAA verification; all consolidation needs F2 quality check |
| **0.5 Security Issues** | 0.5.1-0.5.4 | F3 only | Security fixes reviewed by security reviewer |
| **0.6 Configuration Issues** | 0.6.1-0.6.2 | F1+F2 | Encryption key format (0.6.2) requires HIPAA review |
| **1.1 Code TODOs** | 1.1.1-1.1.2 | F1+F2+F3 (full) | New notification and e-prescribing features touch PHI + payment + auth |
| **1.2 Integration Stubs** | 1.2.1-1.2.2 | F3 only | Integration changes need security review |
| **2.x Test Coverage** | 2.1.x-2.3.x | F2 only | Test code reviewed for quality and mock correctness only |
| **3.1 DoseSpot Integration** | 3.1.1-3.1.3 | F1+F2+F3 (full) | New integration handling prescription PHI — all three gates |
| **3.2 Notifications** | 3.2.1-3.2.3 | F1+F2 | Emails/SMS must not contain PHI; code quality matters |
| **3.3 Admin Features** | 3.3.1-3.3.2 | F2+F3 | Admin panel needs security review (privilege escalation risk) + quality |
| **3.4 Infrastructure** | 3.4.1-3.4.4 | F3 only | Infrastructure changes need security review |
| **4.4 Custom Skills** | 4.4.1-4.4.4 | F2 only | Skill definitions reviewed for quality/completeness |

### 5.2 Review Level Decision Matrix

For ad-hoc tasks not in the tracker, use this decision matrix:

```
Does the change touch PHI data (read/write/display)?
  YES -> F1 mandatory
  NO  -> F1 skipped

Does the change add or modify code (not just docs/config)?
  YES -> F2 mandatory
  NO  -> F2 skipped

Does the change touch auth, payments, API routes, or middleware?
  YES -> F3 mandatory
  NO  -> F3 skipped

Does the change go to production?
  YES -> All applicable reviews mandatory
  NO  -> Reviews are advisory
```

### 5.3 Task-Specific Review Instructions

#### Task 0.1.3: Consolidate dual encryption modules
- **F1 checks:** Verify consolidated module uses `PHI_ENCRYPTION_KEY` (hex, 64+ chars). Verify all 28 PHI fields still encrypt/decrypt correctly. Run encryption roundtrip verification on all 6 models.
- **F2 checks:** Single import path, no dead code remaining, backward compatibility with existing encrypted data (`enc:v1:` prefix preserved).

#### Task 3.1: DoseSpot Integration
- **F1 checks:** Prescription data (instructions, pharmacyAddress) encrypted. Audit logging on prescription create/send. No PHI in DoseSpot API request logging.
- **F2 checks:** Mock mode toggle via env var. Integration follows `lib/integrations/` pattern. Error handling does not expose DoseSpot API details.
- **F3 checks:** DoseSpot API credentials not in client bundle. Webhook handler verifies request authenticity. Rate limiting on prescription endpoints.

#### Task 2.1.9: Stripe webhook handler tests
- **F2 checks:** Test fixtures do not contain real PHI. Stripe signature verification is tested. All webhook event types have test coverage.

---

## 6. Integration with Existing Teams

### 6.1 Team F and Team C (Testing & QA) — Avoiding Overlap

Team C and Team F have complementary but distinct scopes:

| Concern | Team C (Testing & QA) | Team F (Code Review) |
|---------|----------------------|---------------------|
| **Correctness** | Writes and runs tests that verify behavior | Reviews code for patterns and conventions (does not execute tests) |
| **HIPAA** | Verifies PHI encryption works at runtime (roundtrip tests) | Verifies encryption calls exist in code (static analysis) |
| **Security** | Writes E2E tests for auth flows | Reviews auth implementation for bypass vectors |
| **Coverage** | Measures and improves test coverage metrics | Reviews test quality and mock correctness |
| **Timing** | Runs during and after implementation | Runs after implementation, before deploy |

**Handoff protocol:**
1. Team A/B implements feature
2. Team C writes tests, verifies functionality
3. Team F reviews both the feature code AND the test code
4. If Team F finds issues, they go back to the producing team (A/B for code, C for tests)

**Shared skill:** `superpowers:verification-before-completion` is used by both teams but for different purposes. Team C uses it to verify test results; Team F uses it to verify convention compliance.

### 6.2 How Team F Updates skills_matrix.md

When Team F identifies a recurring issue pattern, the PM updates `skills_matrix.md`:

| Finding Pattern | skills_matrix.md Update |
|----------------|------------------------|
| Multiple routes missing audit logging | Add note to Team A skill requirements: "All API routes must include AuditService calls for PHI access" |
| Recurring Zod v3 syntax in new code | Add `Context7` (Zod v4 docs lookup) as required tool for Team A and Team B |
| Auth bypass on new routes | Add F3 as mandatory reviewer for all Team A API route work |
| Tailwind raw hex colors | Add `frontend-design` as required skill for Team B with explicit token reference |

**Process:**
1. Team F flags the pattern in its review report under "Recurring Issues"
2. PM reviews and approves the skills_matrix.md update
3. Team E (Planning) applies the update to `dev-setup/rimalhealth/skills_matrix.md`
4. All future agent sessions pick up the updated guidance

### 6.3 How Team F Findings Create New Tasks

When Team F finds issues that cannot be fixed in the current session, they become new tasks in `tasks.md`.

**Task creation format:**

```markdown
## TASK N.x: [Category from F1/F2/F3]

- [ ] **N.x.y [Finding title]**
  - Source: Code Review Report [date], Finding #[N]
  - Severity: [CRITICAL/WARNING/INFO]
  - File: [file path:line]
  - Issue: [description]
  - Fix: [suggested remediation]
  - Assigned: Team [A/B/C/D]
```

**Where findings land in tasks.md:**

| Finding Category | tasks.md Section | Priority |
|-----------------|-----------------|----------|
| Missing PHI encryption | TASK 0 (Technical Debt) | P0 |
| Missing audit logging | TASK 0 (Technical Debt) | P1 |
| Auth bypass vulnerability | TASK 1 (Known Bugs) | P0 |
| Missing input validation | TASK 1 (Known Bugs) | P1 |
| Convention violations | TASK 0 (Technical Debt) | P2 |
| Missing test coverage | TASK 2 (Test Coverage) | P2 |
| Dependency vulnerabilities | TASK 0 (Technical Debt) | P1 |

### 6.4 Updated Skill-to-Team Matrix (with Team F)

| Skill | A (API) | B (UI) | C (QA) | D (DevOps) | E (Plan) | F (Review) |
|-------|:-------:|:------:|:------:|:----------:|:--------:|:----------:|
| `systematic-debugging` | **P** | - | S | S | - | S |
| `verification-before-completion` | S | S | **P** | - | - | **P** |
| `test-driven-development` | S | - | **P** | - | - | - |
| `executing-plans` | S | S | - | - | - | - |
| `writing-plans` | - | - | - | - | **P** | - |
| `brainstorming` | - | S | - | - | **P** | - |
| `frontend-design` | - | **P** | - | - | - | S |
| `requesting-code-review` | S | - | **P** | - | - | - |
| `dispatching-parallel-agents` | - | - | - | - | **P** | S |
| `revise-claude-md` | - | - | - | - | S | - |
| `ralph-loop` | - | - | - | S | - | - |
| `schedule` | - | - | - | **P** | - | - |
| `/deploy` (custom) | - | - | - | **P** | - | - |
| `/preflight` (custom) | - | - | - | **P** | - | - |
| `/hipaa-review` (custom) | - | - | S | - | - | **P** |
| `/test-flow` (custom) | - | - | **P** | - | - | - |
| `/stripe-debug` (custom) | **P** | - | - | - | - | - |
| `/db-check` (custom) | - | - | - | **P** | - | - |
| `/code-review` (custom, NEW) | - | - | - | - | - | **P** |
| `/security-scan` (custom, NEW) | - | - | - | - | - | **P** |

**P** = Primary, **S** = Secondary, **-** = Not applicable

### 6.5 Agent Count and Resource Allocation

| Scenario | F1 | F2 | F3 | Total Agents |
|----------|:--:|:--:|:--:|:------------:|
| Standard feature review | 1 | 1 | 1 | 3 (parallel) or 1 (sequential) |
| Pre-deploy full review | 1 | 1 | 1 | 3 (parallel preferred) |
| PHI-only review | 1 | - | - | 1 |
| Security-only review | - | - | 1 | 1 |
| Quality-only review | - | 1 | - | 1 |
| Full codebase audit | 1 | 1 | 1 | 3 (parallel preferred, longer runtime) |

Team F agents are stateless and re-deployable. They do not maintain state between reviews. Each review starts fresh with the git diff and task context provided by the PM.

---

## Appendix A: File Paths Quick Reference

All paths relative to `/Users/sonuyadav/RimalHealth/premium-telehealth-website/my-app/`:

| Purpose | Path |
|---------|------|
| PHI encryption (primary) | `lib/encryption/phi.ts` |
| PHI encryption (secondary — HIPAA module) | `lib/hipaa/encryption.ts` |
| Prisma encryption extension | `lib/db/encryption-extension.ts` |
| Prisma singleton | `lib/db/prisma.ts` |
| Audit logger | `lib/audit/logger.ts` |
| Audit types | `lib/audit/types.ts` |
| Audit service | `lib/services/audit-service.ts` |
| Auth middleware | `middleware.ts` |
| Auth HOFs | `lib/auth/require-auth.ts` |
| JWT creation/verification | `lib/auth/jwt.ts` |
| RBAC permissions | `lib/auth/rbac.ts` |
| Account lockout | `lib/auth/account-lockout.ts` |
| Rate limiting | `lib/security/rate-limit.ts` |
| CSRF protection | `lib/security/csrf.ts` |
| Security headers | `lib/security/headers.ts` + `lib/constants.ts` |
| Input sanitization | `lib/security/sanitization.ts` |
| Password policy | `lib/security/password-policy.ts` |
| Zod validation schemas | `lib/validation/schemas.ts` |
| Email templates | `lib/notifications/templates.ts` |
| SendGrid integration | `lib/integrations/sendgrid.ts` |
| Stripe server client | `lib/stripe/stripe-server.ts` |
| Stripe webhook handler | `app/api/webhooks/stripe/route.ts` |
| Prisma schema | `prisma/schema.prisma` |
| Tailwind theme tokens | `app/globals.css` |
| Patient API routes | `app/api/patient/**/*.ts` |
| Physician API routes | `app/api/physician/**/*.ts` |
| Admin API routes | `app/api/admin/**/*.ts` |
| Auth API routes | `app/api/auth/**/*.ts` |

## Appendix B: Severity Definitions

| Severity | Definition | Deploy Impact | Example |
|----------|-----------|--------------|---------|
| **CRITICAL** | HIPAA violation, auth bypass, data exposure, or security vulnerability that could cause immediate harm | **Block deploy** | Missing encryptPHI on new PHI field; API route with no auth; PHI in console.log |
| **WARNING** | Convention violation, potential performance issue, or minor security gap that should be fixed soon | Deploy allowed with PM approval | Raw hex color instead of token; missing audit log on low-risk route; Zod v3 syntax |
| **INFO** | Style preference, documentation gap, or minor improvement suggestion | No deploy impact | Missing JSDoc comment; could use `select` instead of full model fetch; env var not in .env.example |

---

*This document should be revisited when new API routes are added, when the HIPAA compliance requirements change, when the auth system is modified, or when new integrations are introduced.*
