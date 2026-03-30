# Dev-Setup Migration: Convert to Claude Code Native Primitives

## Context

This repository has 31 files in `dev-setup/rimalhealth/` that were created as documentation for fictional "agent teams." Claude Code has built-in primitives (rules, skills, agents, auto-memory) that replace this structure more efficiently. This task migrates the useful knowledge into those native formats and archives the rest.

**Important:** Read each file referenced below before extracting content. Do not invent content — only extract and condense from existing files.

---

## Phase 1: Create `.claude/rules/` directory with conditional knowledge

These files load into context **only when Claude works with matching files**, reducing baseline context cost.

### 1.1 Create `.claude/rules/hipaa.md`

Read `dev-setup/rimalhealth/context_brief.md` sections 2.1 through 2.5, and extract the HIPAA rules into a concise rules file.

Write to `.claude/rules/hipaa.md`:

```yaml
---
description: HIPAA compliance rules for PHI handling
globs:
  - "premium-telehealth-website/my-app/lib/**"
  - "premium-telehealth-website/my-app/app/api/**"
---
```

After the frontmatter, include only:
- The "NEVER do these" list from context_brief.md section 2.5 (8 items)
- The "ALWAYS do these" list from context_brief.md section 2.5 (5 items)
- The PHI fields table from context_brief.md section 2.1 (which models, which fields, how many)
- The encryption usage pattern (import path, encryptPHI/decryptPHI, note that Prisma extension handles it automatically)
- A note that the Prisma extension in `lib/db/encryption-extension.ts` auto-encrypts/decrypts — do NOT manually call encryptPHI/decryptPHI on fields the extension already handles (this was a real bug: double-encryption)
- The dual encryption warning: `lib/encryption/phi.ts` uses `PHI_ENCRYPTION_KEY` (hex), `lib/hipaa/encryption.ts` uses `ENCRYPTION_KEY` (base64) — they are NOT interchangeable

Target: ~60 lines max.

### 1.2 Create `.claude/rules/api-patterns.md`

Read `dev-setup/rimalhealth/build_instructions.md` sections 3.1 through 3.4.

Write to `.claude/rules/api-patterns.md`:

```yaml
---
description: API route patterns and auth conventions
globs:
  - "premium-telehealth-website/my-app/app/api/**"
---
```

After the frontmatter, include only:
- The 4 auth HOFs and their usage pattern (requireAuth, requireRole, requirePermission, withPermission) — one line each with when to use
- The standard API route structure (the code template from section 3.3 — keep it short)
- The note that API routes bypass middleware — auth is per-route via requireAuth/requireRole
- The note about Zod v4 syntax: `{ message: '...' }` not `{ required_error: '...' }`
- The note about console.error sanitization: always use `error instanceof Error ? error.message : 'Unknown error'`

Target: ~50 lines max.

### 1.3 Create `.claude/rules/42cfr2.md`

Read `dev-setup/rimalhealth/compliance_42cfr2.md` sections 1 and 3 (executive summary and gap analysis).

Write to `.claude/rules/42cfr2.md`:

```yaml
---
description: 42 CFR Part 2 compliance rules for SUD treatment records
globs:
  - "premium-telehealth-website/my-app/app/api/patient/**"
  - "premium-telehealth-website/my-app/app/api/physician/**"
  - "premium-telehealth-website/my-app/components/physician/**"
---
```

After the frontmatter, include only:
- One-paragraph summary: RimalHealth treats AUD (substance use disorder), so ALL patient records are 42 CFR Part 2 records, enforcement active since Feb 16, 2026
- Key requirements: (1) Part 2-compliant written consent before disclosing for TPO, (2) redisclosure notice on all disclosures, (3) accounting of disclosures available to patients for 3 years, (4) patient right to request disclosure restrictions, (5) SUD records cannot be used in legal proceedings without specific consent
- Note: Consent management is implemented (ConsentRecord model, /api/patient/consent), disclosures page exists (/patient/disclosures), disclosure restrictions exist (/api/patient/disclosure-restrictions)

Target: ~30 lines max.

### 1.4 Create `.claude/rules/stripe.md`

Read `dev-setup/rimalhealth/build_instructions.md` section 5.1 and `dev-setup/rimalhealth/context_brief.md` section 6.

Write to `.claude/rules/stripe.md`:

```yaml
---
description: Stripe integration patterns and payment flow
globs:
  - "premium-telehealth-website/my-app/lib/stripe/**"
  - "premium-telehealth-website/my-app/app/api/stripe/**"
  - "premium-telehealth-website/my-app/app/api/webhooks/stripe/**"
  - "premium-telehealth-website/my-app/app/checkout/**"
---
```

After the frontmatter, include only:
- API version: `2026-01-28.clover` — validate params against this before deploying
- Key files: `lib/stripe/stripe-server.ts` (server client), `lib/stripe/stripe-client.ts` (browser), `app/api/webhooks/stripe/route.ts` (webhook handler)
- Webhook handler orchestrates user creation in `prisma.$transaction()` with deduplication via `WebhookEvent` model
- Public checkout: `POST /api/stripe/public-checkout-session` (no auth required)
- Pricing: Active Treatment $50/month (`STRIPE_PRICE_ACTIVE_TREATMENT`), Maintenance $25/month (`STRIPE_PRICE_MAINTENANCE`)
- Local testing commands (stripe listen, stripe trigger)

Target: ~25 lines max.

### 1.5 Create `.claude/rules/testing.md`

Read `dev-setup/rimalhealth/build_instructions.md` section 7 and the vitest configs referenced in CLAUDE.md.

Write to `.claude/rules/testing.md`:

```yaml
---
description: Testing conventions and configuration
globs:
  - "premium-telehealth-website/my-app/tests/**"
  - "premium-telehealth-website/my-app/**/*.test.ts"
---
```

After the frontmatter, include only:
- Three vitest configs: default (all tests, forks, 30s), unit (threads, 10s), integration (forks, 30s)
- `npm test` runs ALL tests; `npm run test:unit` for unit only; `npm run test:integration` for integration only
- Vitest globals enabled — no imports needed for describe/it/expect
- Co-located tests in `lib/**/*.test.ts` run in both default and unit configs
- Test environment: `node` (not jsdom)
- Mock pattern for external APIs: `vi.mock('@/lib/integrations/sendgrid', () => ({ sendEmail: vi.fn().mockResolvedValue({ success: true }) }))`
- Test accounts: patient.test@rimalhealth.test / TestPatient123@, dr.sarah.johnson@rimalhealth.test / TestPhysician123!, admin@rimalhealth.test / TestAdmin123!

Target: ~30 lines max.

---

## Phase 2: Create `.claude/agents/` with real custom agents

These replace the fictional Teams F, G, and H. Each agent runs in its own context window — no context pollution.

### 2.1 Create `.claude/agents/code-reviewer.md`

Read `dev-setup/rimalhealth/team_f_code_review.md` and extract the review checklists from sections 3-5 (F1 HIPAA checks, F2 Quality checks, F3 Security checks).

Write to `.claude/agents/code-reviewer.md`:

```yaml
---
name: code-reviewer
description: Reviews code changes for HIPAA compliance, security vulnerabilities, and code quality. Use proactively after code changes to API routes, auth, encryption, or PHI-handling code.
tools:
  - Read
  - Grep
  - Glob
  - Bash
disallowedTools:
  - Write
  - Edit
model: sonnet
---
```

After the frontmatter, write a system prompt that includes:

1. A brief role description: "You are a code reviewer for a HIPAA-compliant telehealth platform treating alcohol use disorder. All patient records are also 42 CFR Part 2 protected."

2. Three checklists extracted from the team_f doc:

**HIPAA checklist** (extract from F1 section — keep the most important 8-10 checks):
- No PHI in console.error/log (use error.message only)
- No PHI in URLs, query params, JWTs, error responses
- All PHI fields use Prisma encryption extension (do NOT manually call encryptPHI on extension-managed fields)
- Audit logging on all PHI access routes (auditLogger.logPHIAccess)
- No PHI in email subject lines or body (HIPAA-safe templates only)
- No PHI in browser storage (localStorage, sessionStorage)
- No PHI cached client-side
- 42 CFR Part 2 redisclosure notice visible when physician views patient SUD records

**Quality checklist** (extract from F2 section — keep 6-8 checks):
- TypeScript strict mode, no `any` without justification
- Explicit return types on functions
- `'use client'` directive present when using hooks/browser APIs
- Zod v4 syntax: `{ message: '...' }` not `{ required_error: '...' }`
- Server components with Prisma need `export const dynamic = 'force-dynamic'`
- React Compiler is DISABLED — do not re-enable (incompatible with react-hook-form)

**Security checklist** (extract from F3 section — keep 8-10 checks):
- requireAuth/requireRole on every API route (API routes bypass middleware)
- Zod validation on all POST/PUT request bodies
- Rate limiting on auth endpoints
- CSRF protection on state-changing routes
- No SQL injection (use Prisma client, not $queryRaw with string interpolation)
- Stripe webhook signature verification
- No secrets in code or logs
- Timing-safe token comparison for security-sensitive lookups

3. Output format: "Report findings as a markdown table with columns: Severity (CRITICAL/WARNING/INFO), File:Line, Category (HIPAA/Quality/Security), Issue, Fix."

Target: ~80 lines max for the full agent file.

### 2.2 Create `.claude/agents/debugger.md`

Read `dev-setup/rimalhealth/team_g_debugging.md` and extract the debugging methodology from sections 1-2.

Write to `.claude/agents/debugger.md`:

```yaml
---
name: debugger
description: Investigates bugs by tracing root causes through the codebase. Use when a bug is reported or when proactively hunting for issues in the patient portal, physician portal, or API routes.
tools:
  - Read
  - Grep
  - Glob
  - Bash
disallowedTools:
  - Write
  - Edit
model: sonnet
---
```

After the frontmatter, write a system prompt that includes:

1. Role: "You are a debugger for a HIPAA-compliant Next.js 16 telehealth platform. You investigate bugs but do NOT implement fixes — you produce bug reports with root cause analysis."

2. Investigation methodology (from team_g_debugging.md):
   - Always verify root cause before reporting. Check env vars, API URLs, middleware config first.
   - For auth issues: check middleware.ts (JWT extraction, role enforcement, token refresh), lib/auth/jwt.ts, cookie settings
   - For PHI issues: check lib/db/encryption-extension.ts (auto-encrypt/decrypt), verify no double-encryption
   - For Stripe issues: check webhook handler (app/api/webhooks/stripe/route.ts), verify STRIPE_WEBHOOK_SECRET, API version 2026-01-28.clover
   - For session issues: check middleware token refresh, useTokenRefresh hook, SESSION_CONFIG in lib/constants.ts (8h absolute, 30m idle)

3. Bug categories to check (from team_g):
   - Integration bugs (Stripe, SendGrid, Redis, S3)
   - Data integrity (PHI encryption roundtrip, orphaned records)
   - Auth flow (JWT, middleware, RBAC, session)
   - UI/UX (form validation gaps, routing, rendering)

4. Output format: "Report each bug as: Severity (P0-P3), Category, Root Cause (file:line), Impact, Fix Instructions, Verification Steps."

Target: ~60 lines max.

### 2.3 Create `.claude/agents/architect.md`

Read `dev-setup/rimalhealth/team_h_architecture.md` and extract the assessment framework from sections 1-2.

Write to `.claude/agents/architect.md`:

```yaml
---
name: architect
description: Assesses system architecture health including CI/CD, database design, module boundaries, security architecture, and HIPAA compliance patterns. Use before major features or for periodic health checks.
tools:
  - Read
  - Grep
  - Glob
  - Bash
disallowedTools:
  - Write
  - Edit
model: sonnet
---
```

After the frontmatter, write a system prompt that includes:

1. Role: "You are a system architect reviewing a HIPAA-compliant Next.js 16 telehealth platform deployed on Netlify with Neon PostgreSQL, Redis, and Stripe."

2. Assessment areas (from team_h scorecard):
   - CI/CD Pipeline (GitHub Actions -> Netlify)
   - Database Design (Prisma schema, indexes, connection pooling)
   - Module Boundaries (duplicate implementations, dead code)
   - PHI Encryption Pipeline (Prisma extension, key management)
   - Auth Architecture (JWT, middleware, RBAC)
   - Testing Architecture (coverage, test pyramid)
   - Secrets Management

3. Key architectural facts:
   - Middleware runs at Edge — cannot use Prisma (intake gate is in patient/layout.tsx server component, NOT middleware)
   - API routes bypass middleware — auth is per-route
   - Two encryption systems exist (PHI_ENCRYPTION_KEY hex vs ENCRYPTION_KEY base64) — only the former is used by the Prisma extension
   - React Compiler disabled due to react-hook-form incompatibility
   - Turbopack can't resolve barrel exports — use explicit /index imports

4. Output format: "Produce a health scorecard (1-5 per area) with prioritized improvement recommendations (P0-P3), implementing file references, and estimated effort."

Target: ~60 lines max.

---

## Phase 3: Create a review-code skill

### 3.1 Create `.claude/skills/review-code/SKILL.md`

This is a user-invocable skill that spawns the code-reviewer agent.

Write to `.claude/skills/review-code/SKILL.md`:

```yaml
---
name: review-code
description: Run a HIPAA + security + quality code review on recent changes
agent: code-reviewer
context: fork
---
```

After the frontmatter:

```
Review all files changed since the last commit (use `git diff HEAD` and `git diff --cached`).
If no uncommitted changes exist, review the last commit (`git diff HEAD~1`).

For each changed file, run the HIPAA, Quality, and Security checklists.

Report findings as a markdown table. Group by severity (CRITICAL first, then WARNING, then INFO).
Include file:line references for every finding.
End with a summary: DEPLOY (no criticals), FIX FIRST (has criticals), or REDESIGN (architectural issue).
```

---

## Phase 4: Trim tasks.md to open items only

### 4.1 Trim `dev-setup/rimalhealth/tasks.md`

Read the current `dev-setup/rimalhealth/tasks.md`. Replace it with a trimmed version containing ONLY items that are NOT marked `[x]` (done). Keep:
- The file header (title, status legend, last updated date)
- Any items marked `[ ]` (to do), `[~]` (in progress), or `[!]` (blocked)
- The parent task heading for each open item (for context)

Remove:
- All completed task groups where every item is `[x]`
- The Priority Matrix table (no longer needed — most work is done)
- All completed Phase 11 tasks

This should reduce the file from ~274 lines to ~30-40 lines.

---

## Phase 5: Trim CLAUDE.md

### 5.1 Edit `CLAUDE.md`

Read the current CLAUDE.md. Make these specific changes:

1. **Remove the "Key Reference Files" table entirely.** This table encourages reading 7 files at session start, wasting ~30K tokens. Claude can find these files when needed.

2. **Remove the "Testing Details" section.** This is now in `.claude/rules/testing.md` and loads only when working with test files.

3. **In the "Key lib/ Modules" table**, remove the rows for `security/`, `stripe/`, `integrations/`, `compliance/`, and `redis/`. These are now covered by `.claude/rules/` files. Keep only: `auth/`, `db/`, `encryption/`, `audit/`, `intake/`, `constants.ts`.

4. **In the "Architecture" section**, remove the "Key Patterns" subsection entirely (PHI Encryption, Server Components with DB, React Compiler, Audit Logging). These are now in `.claude/rules/hipaa.md` and `.claude/rules/api-patterns.md`. Keep: Middleware, Auth Flow, Patient Flow, Physician Portal.

5. **Remove the "Conventions" section entries for:** Stripe (now in `.claude/rules/stripe.md`), Forms (keep — it's short and always relevant), shadcn/ui (keep).

The goal is to get CLAUDE.md under 140 lines. Every line removed saves tokens on every session.

---

## Phase 6: Archive obsolete files

### 6.1 Create archive directory and move files

```bash
mkdir -p dev-setup/rimalhealth/archive
```

Move these files to the archive directory:
- `dev-setup/rimalhealth/trace.md`
- `dev-setup/rimalhealth/session_handoff.md`
- `dev-setup/rimalhealth/conversation.md`
- `dev-setup/rimalhealth/plan.md`
- `dev-setup/rimalhealth/plan_arch_review.md`
- `dev-setup/rimalhealth/p1_framework_mapping.md`
- `dev-setup/rimalhealth/p2_codebase_analysis.md`
- `dev-setup/rimalhealth/p3_skills_audit.md`
- `dev-setup/rimalhealth/e5_claude_md_v2_spec.md`
- `dev-setup/rimalhealth/review_pm_consolidated.md`
- `dev-setup/rimalhealth/review_team_f_report.md`
- `dev-setup/rimalhealth/review_team_g_report.md`
- `dev-setup/rimalhealth/review_team_h_report.md`
- `dev-setup/rimalhealth/review_wave2_report.md`
- `dev-setup/rimalhealth/review_deep_consolidated.md`
- `dev-setup/rimalhealth/review_deep_f_report.md`
- `dev-setup/rimalhealth/review_deep_g_report.md`
- `dev-setup/rimalhealth/review_deep_h_report.md`
- `dev-setup/rimalhealth/skills_matrix.md`
- `dev-setup/rimalhealth/team_f_code_review.md`
- `dev-setup/rimalhealth/team_g_debugging.md`
- `dev-setup/rimalhealth/team_h_architecture.md`

Keep in `dev-setup/rimalhealth/` (not archived):
- `context_brief.md` — domain knowledge reference (read on demand)
- `build_instructions.md` — maintenance guide (read on demand)
- `asset_manifest.md` — env vars and infrastructure (read on demand)
- `compliance_42cfr2.md` — full legal compliance reference (read on demand)
- `tasks.md` — trimmed task tracker (read on demand)
- `email_provider_evaluation.md` — SendGrid->SES migration reference
- `rollback_strategy.md` — emergency rollback reference
- `design_inspiration.md` — UX/UI reference
- `research_improvements.md` — HIPAA 2026 research reference

---

## Phase 7: Commit and push

After all changes are complete:

1. Verify the new structure exists:
   - `.claude/rules/` has 5 files (hipaa.md, api-patterns.md, 42cfr2.md, stripe.md, testing.md)
   - `.claude/agents/` has 3 files (code-reviewer.md, debugger.md, architect.md)
   - `.claude/skills/review-code/SKILL.md` exists
   - `dev-setup/rimalhealth/tasks.md` is trimmed to open items only
   - `dev-setup/rimalhealth/archive/` contains 22 moved files
   - `CLAUDE.md` is under 140 lines

2. Create a new branch, stage all changes, and commit:
   ```bash
   git checkout -b refactor/dev-setup-migration
   git add -A
   git commit -m "refactor: migrate dev-setup to Claude Code native primitives

   - Created .claude/rules/ with 5 conditional knowledge files (hipaa, api-patterns,
     42cfr2, stripe, testing) that load only when working with matching files
   - Created .claude/agents/ with 3 custom agents (code-reviewer, debugger, architect)
     that run in isolated contexts, replacing fictional team design documents
   - Created /review-code skill for on-demand code reviews
   - Trimmed tasks.md to open items only (was 274 lines, ~98% complete)
   - Trimmed CLAUDE.md to under 140 lines by removing content now in rules/
   - Archived 22 obsolete planning/review files to dev-setup/rimalhealth/archive/"
   ```

3. Push to remote:
   ```bash
   git push -u origin refactor/dev-setup-migration
   ```

---

## Summary of what this achieves

| Before | After |
|--------|-------|
| 31 flat files in dev-setup/ all loaded on demand | 5 files in dev-setup/ + 5 rules + 3 agents + 1 skill |
| CLAUDE.md ~180 lines | CLAUDE.md ~140 lines |
| tasks.md 274 lines (98% done) | tasks.md ~30 lines (open items only) |
| Fictional team docs (F/G/H) read into main context | Real agents running in isolated contexts |
| No conditional loading | Rules load only when working with matching file paths |
| Session start reads 5+ reference files (~30K tokens) | Session start reads only CLAUDE.md (~1.5K tokens) |
