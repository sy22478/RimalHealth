# RimalHealth — Skills & Agent Matrix

> **Prepared by:** E4 (Execution Team), updated by PM (2026-03-26)
> **Date:** 2026-03-26 (v2 — added Teams F, G, H)
> **Project:** RimalHealth HIPAA Telehealth Platform (Next.js 16 / Prisma 7 / Stripe / Netlify)
> **Status:** Production-deployed, maintenance & feature development mode

---

## 1. Agent Team Roster

RimalHealth is a mature, production-deployed application. Teams are structured for **maintenance, feature development, and operational reliability** rather than greenfield construction.

| Team | Role | Primary Skills | Secondary Skills | Typical Agents |
|------|------|---------------|-----------------|----------------|
| **A: API & Backend** | API routes, Prisma queries, business logic, integrations (Stripe, SendGrid, DoseSpot) | `systematic-debugging`, `test-driven-development` | `verification-before-completion`, `/stripe-debug` | 1-2 |
| **B: Frontend & UX** | Patient portal, physician portal, intake form, checkout flow, Tailwind v4 components | `frontend-design`, `brainstorming` | `verification-before-completion`, `executing-plans` | 1 |
| **C: Testing & QA** | Unit tests, integration tests, E2E tests, HIPAA compliance verification | `test-driven-development`, `verification-before-completion` | `systematic-debugging`, `/hipaa-review`, `/test-flow` | 1-2 |
| **D: DevOps & Deployment** | Netlify deployment, CI/CD, env management, database migrations | `/deploy`, `/preflight`, `/db-check` | `systematic-debugging`, `schedule`, `ralph-loop` | 1 |
| **E: Planning & Coordination** | Feature planning, sprint org, multi-agent coordination, CLAUDE.md maintenance | `writing-plans`, `dispatching-parallel-agents` | `brainstorming`, `revise-claude-md` | 1 |
| **F: Code Review** | Review code from Teams A-D. HIPAA compliance, code quality, security scanning. Reports to PM. | `/code-review`, `/hipaa-review`, `/security-scan` | `requesting-code-review`, `verification-before-completion` | 1-3 |
| **G: Debugging** | Proactive bug hunting. Integration health, data integrity, runtime issues. Reports to PM with fix instructions. | `/debug-investigate`, `/integration-health`, `/data-integrity-check` | `systematic-debugging`, `/perf-audit` | 1-3 |
| **H: System Architecture** | Monitor system design health. Infrastructure, application structure, security architecture. Reports to PM with improvement roadmap. | `/arch-review`, `/infra-audit`, `/dependency-review` | `/scale-assessment`, `writing-plans` | 1-3 |

### Team Design Documents

| Team | Design Doc | Agents |
|------|-----------|--------|
| F: Code Review | `dev-setup/rimalhealth/team_f_code_review.md` | F1 (HIPAA), F2 (Quality), F3 (Security) |
| G: Debugging | `dev-setup/rimalhealth/team_g_debugging.md` | G1 (Integration), G2 (Data Integrity), G3 (Runtime) |
| H: System Architecture | `dev-setup/rimalhealth/team_h_architecture.md` | H1 (Infrastructure), H2 (Application), H3 (Security/Compliance) |

---

## 2. Skill-to-Task Mapping

### `superpowers:systematic-debugging`

- **Primary team:** A (API & Backend)
- **When to activate:** Any bug investigation, especially Stripe webhook issues, auth flow bugs, Prisma query debugging, middleware route protection failures
- **Applicable tasks:** Bug fixes (single-file and cross-cutting), integration debugging, performance investigation
- **Why it matters:** RimalHealth has complex integrations (Stripe payment-first flow, JWT auth with role-based middleware, PHI encryption pipeline) that produce subtle bugs. Systematic debugging prevents wasted cycles on symptom-chasing.

### `superpowers:verification-before-completion`

- **Primary team:** C (Testing & QA)
- **When to activate:** Any work touching PHI fields, payment flows, or auth logic. Activate before marking any feature complete.
- **Applicable tasks:** HIPAA compliance verification, payment flow testing, auth flow changes, any PR touching `lib/encryption/`, `lib/audit/`, or `lib/auth/`
- **Why it matters:** HIPAA compliance demands that every feature touching PHI is verified for encryption, audit logging, and no PHI leakage. A missed check can be a regulatory violation.

### `superpowers:test-driven-development`

- **Primary team:** C (Testing & QA)
- **When to activate:** New API endpoints, new patient/physician flows, refactoring existing logic
- **Applicable tasks:** New feature development, API endpoint creation, business logic changes
- **Why it matters:** Project already has Vitest + Playwright configured. TDD ensures PHI handling and payment flows are correct before deployment. The test pyramid (unit -> integration -> E2E) is established and should be maintained.

### `superpowers:executing-plans`

- **Primary team:** A (API & Backend), B (Frontend & UX)
- **When to activate:** Multi-step feature work that spans multiple files (e.g., adding a new patient flow step, new Prisma model + API route + UI page)
- **Applicable tasks:** Full-stack features, large refactors, database migrations with data transformation
- **Why it matters:** Structured execution with checkpoints prevents drift on multi-file changes where missing one step (e.g., forgetting audit logging on a new endpoint) creates compliance gaps.

### `superpowers:writing-plans`

- **Primary team:** E (Planning & Coordination)
- **When to activate:** Before starting multi-file features, architecture decisions, sprint planning
- **Applicable tasks:** Feature planning, sprint organization, technical debt prioritization
- **Why it matters:** Planning prevents scope creep and ensures cross-cutting concerns (PHI encryption, audit logging, auth) are addressed upfront rather than patched in later.

### `superpowers:brainstorming`

- **Primary team:** E (Planning & Coordination), B (Frontend & UX)
- **When to activate:** UX decisions (intake form flow, dashboard layout), architecture decisions (caching strategy, audit log retention), solving ambiguous requirements
- **Applicable tasks:** Design-phase work on new features, evaluating multiple implementation approaches
- **Why it matters:** Telehealth UX has unique constraints (accessibility, clinical data presentation, HIPAA-safe messaging UI) that benefit from structured ideation.

### `frontend-design:frontend-design`

- **Primary team:** B (Frontend & UX)
- **When to activate:** Patient portal UI, physician dashboard, intake form wizard, any new page or component
- **Applicable tasks:** New UI pages, component design, responsive layout work, design system extensions
- **Why it matters:** Tailwind v4 with custom `@theme inline` tokens (navy/ocean brand colors, `btn-primary` component classes). The skill ensures consistency with the existing design system rather than introducing conflicting patterns.

### `superpowers:requesting-code-review`

- **Primary team:** C (Testing & QA)
- **When to activate:** Security-sensitive changes (auth, PHI handling, Stripe integration), before merging PRs that touch middleware or encryption
- **Applicable tasks:** Pre-merge review of security-sensitive code
- **Why it matters:** A single missed `encryptPHI()` call or missing `auditLogger.logPHIAccess()` in a new endpoint is a HIPAA violation. Code review catches these before production.

### `superpowers:dispatching-parallel-agents`

- **Primary team:** E (Planning & Coordination)
- **When to activate:** Large features requiring independent work streams (Agent A fixes API route while Agent B writes tests), multi-file refactors
- **Applicable tasks:** Full-stack feature development, large refactors, parallel test writing
- **Why it matters:** RimalHealth's architecture (co-located API routes + pages in App Router) means many tasks have independent sub-components that can be parallelized.

### `claude-md-management:revise-claude-md`

- **Primary team:** E (Planning & Coordination)
- **When to activate:** After major framework upgrades, new integration additions, architectural pattern changes
- **Applicable tasks:** CLAUDE.md maintenance, onboarding documentation updates
- **Why it matters:** CLAUDE.md is already 300+ lines and is the entry point for every agent session. Keeping it accurate prevents agents from following outdated patterns.

### `claude-md-management:claude-md-improver`

- **Primary team:** E (Planning & Coordination)
- **When to activate:** Monthly or after major changes to the codebase
- **Applicable tasks:** Periodic CLAUDE.md audit for accuracy and completeness
- **Why it matters:** Stale instructions in CLAUDE.md (e.g., wrong Zod syntax, outdated route structure) directly cause bugs in agent-generated code.

### `ralph-loop:ralph-loop`

- **Primary team:** D (DevOps & Deployment)
- **When to activate:** Repetitive multi-step refactors (e.g., "migrate all 15 API routes to new auth pattern"), bulk operations
- **Applicable tasks:** Large-scale code migrations, pattern updates across many files
- **Why it matters:** Keeps autonomous execution going through long sequences without losing momentum or stopping prematurely.

### `schedule`

- **Primary team:** D (DevOps & Deployment)
- **When to activate:** Scheduled deployment health checks, database backup verification, SSL cert expiry monitoring
- **Applicable tasks:** Operational monitoring, scheduled maintenance
- **Why it matters:** Production HIPAA applications require ongoing monitoring. Scheduled agents can verify database backups, check deployment health, and flag issues.

### Team F Skills

#### `/code-review` (Custom — Team F)
- **Primary team:** F (Code Review)
- **When:** After any agent completes a feature or bug fix, before deploy
- **Process:** F1 (HIPAA) + F2 (Quality) + F3 (Security) run in parallel, consolidate into single report
- **Output:** Structured report with CRITICAL/WARNING/INFO severity, actionable fix items, DEPLOY/FIX FIRST/REDESIGN recommendation

#### `/security-scan` (Custom — Team F)
- **Primary team:** F (Code Review — F3 agent)
- **When:** Before any deploy, after auth/payment changes, on-demand
- **Checks:** Auth bypass (missing requireAuth), IDOR vulnerabilities, input validation gaps (missing Zod), raw SQL injection, XSS via unsanitized output, rate limiting coverage, CSRF protection, security headers, secret exposure, dependency vulnerabilities

### Team G Skills

#### `/debug-investigate` (Custom — Team G)
- **Primary team:** G (Debugging)
- **When:** Bug reported or suspected, proactive weekly sweep
- **Process:** Reproduce → isolate → root cause → fix proposal. Checks env vars, middleware config, API URLs first (per CLAUDE.md bug fixing rules)
- **Output:** Bug report with P0-P3 severity, root cause file:line, fix steps, verification test, team assignment

#### `/integration-health` (Custom — Team G)
- **Primary team:** G (Debugging — G1 agent)
- **When:** Weekly proactive check, before deploy, after env changes
- **Checks:** Stripe (webhook secret, price IDs, API version `2026-01-28.clover`), SendGrid (API key, from email), Redis (connection, TLS), Neon (schema sync, slow queries), DoseSpot (mock mode status)

#### `/data-integrity-check` (Custom — Team G)
- **Primary team:** G (Debugging — G2 agent)
- **When:** After migrations, weekly, after data-touching bug fixes
- **Checks:** PHI encryption roundtrip on all 6 models/28 fields, unencrypted PHI detection, audit log completeness, orphaned records (subscriptions without users, intakes without profiles), schema drift

#### `/perf-audit` (Custom — Team G)
- **Primary team:** G (Debugging — G3 agent)
- **When:** Quarterly, after performance complaints, before scaling decisions
- **Checks:** N+1 Prisma queries, missing database indexes (via Neon MCP), API response time, bundle size analysis, slow query identification

### Team H Skills

#### `/arch-review` (Custom — Team H)
- **Primary team:** H (System Architecture — H2 agent)
- **When:** Before major features, quarterly, after large refactors
- **Evaluates:** Module coupling, dependency direction, API surface consistency, dual implementation audit, dead code detection
- **Output:** Architecture health report (scored 1-5 per concern area), prioritized improvements with implementing team

#### `/infra-audit` (Custom — Team H)
- **Primary team:** H (System Architecture — H1 agent)
- **When:** Quarterly, after deployment issues, before infrastructure changes
- **Checks:** CI/CD pipeline (GitHub Actions → Netlify), Neon config (branching, pooling, backups), Redis config (TLS, memory, eviction), security headers (CSP, HSTS, CORS), bundle size budget, single points of failure

#### `/dependency-review` (Custom — Team H)
- **Primary team:** H (System Architecture — H2 agent)
- **When:** Monthly, before major upgrades, after security advisories
- **Checks:** `npm audit` vulnerabilities, outdated packages, license compliance, unused dependencies, bundle impact, package maintenance health

#### `/scale-assessment` (Custom — Team H)
- **Primary team:** H (System Architecture — H1 agent)
- **When:** Quarterly, before expected growth, after performance incidents
- **Checks:** Database query patterns (N+1, indexes), API response time budget, Redis cache hit rates, static vs dynamic rendering strategy, CDN usage

---

## 3. Recommended Activation Order

### Tier 1 — Activate Immediately (All Sessions)

These skills should be active by default for every agent session working on RimalHealth.

| Priority | Skill | Reason |
|----------|-------|--------|
| **P0** | `superpowers:systematic-debugging` | Most backend work is fixing or extending complex integrations (Stripe, auth, PHI encryption). This skill prevents trial-and-error. |
| **P1** | `superpowers:verification-before-completion` | HIPAA compliance is non-negotiable. Every feature touching PHI must be verified before marking complete. |

### Tier 2 — Activate for Specific Work

Activate these when starting relevant task types. Not needed for every session.

| Priority | Skill | When |
|----------|-------|------|
| **P2** | `superpowers:test-driven-development` | Starting new API endpoints or modifying business logic |
| **P3** | `superpowers:writing-plans` | Planning multi-file features or sprint work |
| **P4** | `frontend-design:frontend-design` | Building new UI pages or components |
| **P5** | `superpowers:executing-plans` | Implementing a pre-planned multi-step feature |
| **P6** | `superpowers:dispatching-parallel-agents` | Large features with independent sub-tasks |
| **P7** | `superpowers:requesting-code-review` | Before merging PRs that touch auth, PHI, or payments |

### Tier 3 — Situational

Low-frequency skills activated for specific operational needs.

| Priority | Skill | When |
|----------|-------|------|
| **P8** | `ralph-loop:ralph-loop` | Bulk code migrations or repetitive refactors |
| **P9** | `schedule` | Setting up monitoring or scheduled health checks |
| **P10** | `claude-md-management:claude-md-improver` | Monthly CLAUDE.md audit |
| **P11** | `claude-md-management:revise-claude-md` | After framework upgrades or major pattern changes |
| **P12** | `superpowers:brainstorming` | UX design decisions, architecture discussions |

### Tier 4 — Low Value for This Project

| Skill | Why Low Priority |
|-------|-----------------|
| `figma:*` skills | No Figma integration. Design system lives in `globals.css` `@theme inline` tokens. |
| `claude-api` | No need for Claude API calls within the application itself. |
| `figma:create-design-system-rules` | Design system is already codified in CSS, not Figma. |

---

## 4. Custom Skills (Existing + Proposed)

### Existing Skills

#### `/deploy`
- **Location:** `.claude/skills/deploy/SKILL.md`
- **Trigger:** Before any production deployment to Netlify
- **Purpose:** Pre-flight validation + Netlify production deploy
- **Steps:**
  1. Run type check (`npx tsc --noEmit`)
  2. Run build (`npm run build`)
  3. Audit environment variables
  4. Deploy to Netlify (`netlify deploy --prod`)
  5. Verify live URL

#### `/preflight`
- **Location:** `.claude/skills/preflight/SKILL.md`
- **Trigger:** Before deploying or after env changes
- **Purpose:** Environment variable audit, build config validation, domain check
- **Steps:**
  1. Verify all required env vars are set (STRIPE_PRICE_ACTIVE_TREATMENT, SENDGRID_API_KEY, etc.)
  2. Check build configuration matches Netlify settings
  3. Validate domain DNS (rimalhealth.com)
  4. Check for static generation errors (missing `force-dynamic`)

### Proposed Skills

#### `/hipaa-review` (Priority: HIGH)
- **Trigger:** Before any PR touching PHI fields or adding new data access
- **Purpose:** Automated HIPAA compliance verification
- **Steps:**
  1. Grep changed files for PHI field names (name, dob, address, phone, email, medical history, medications)
  2. Verify `encryptPHI()`/`decryptPHI()` usage on all PHI fields
  3. Verify `auditLogger.logPHIAccess()` calls on every PHI access path
  4. Check for `console.log`/`console.error` containing PHI
  5. Scan for PHI in URLs, JWT tokens, error messages, localStorage/sessionStorage
  6. Report pass/fail with specific file:line references

#### `/test-flow` (Priority: MEDIUM)
- **Trigger:** After feature implementation, before PR
- **Purpose:** Run the full test pyramid for a specific area of the codebase
- **Steps:**
  1. Run relevant unit tests (`npx vitest run tests/unit/<area>`)
  2. Run relevant integration tests (`npx vitest run tests/integration/<area>`)
  3. Run type check (`npx tsc --noEmit`)
  4. Run lint on changed files (`npx eslint <changed-files>`)
  5. Report coverage delta vs. baseline

#### `/stripe-debug` (Priority: MEDIUM)
- **Trigger:** Stripe integration issues (payment failures, webhook errors, subscription problems)
- **Purpose:** Systematic Stripe debugging checklist
- **Steps:**
  1. Check Stripe API version in code vs. Stripe dashboard
  2. Verify webhook secret matches env var (`STRIPE_WEBHOOK_SECRET`)
  3. Verify price IDs (`STRIPE_PRICE_ACTIVE_TREATMENT`, `STRIPE_PRICE_MAINTENANCE`)
  4. Validate checkout session params against current Stripe API
  5. Check webhook handler at `app/api/webhooks/stripe/route.ts` for correct event handling
  6. Test webhook locally with `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

#### `/db-check` (Priority: MEDIUM — replaces broken `neon-postgres` symlink)
- **Trigger:** Before/after database migrations, when investigating data issues
- **Purpose:** Validate database state and schema integrity
- **Steps:**
  1. Run `npx prisma validate`
  2. Run `npx prisma db pull --force` and compare against schema
  3. Check for pending migrations
  4. Verify PHI encryption extension is active (query encrypted fields, verify ciphertext format)
  5. Spot-check PHI encryption roundtrip on sample records

---

## 5. MCP Tools Audit

### Critical MCP Servers

| MCP Server | Key Tools | RimalHealth Use Case | Permission Status |
|------------|-----------|---------------------|-------------------|
| **Neon** | `run_sql`, `run_sql_transaction`, `describe_table_schema`, `get_database_tables`, `explain_sql_statement`, `list_slow_queries` | Production database (Neon PostgreSQL). Query patient data, debug issues, verify encryption, optimize queries, manage migrations via branching. | 2 tools permitted, **14 more recommended** (see P3 audit Section 3.2) |
| **Playwright** | `browser_navigate`, `browser_take_screenshot`, `browser_fill_form`, `browser_click`, `browser_type`, `browser_evaluate`, `browser_resize`, `browser_console_messages`, `browser_network_requests` | E2E testing of patient flows, intake form, checkout, physician portal. Responsive testing. Post-deploy smoke tests on live site. | 8 tools permitted, **13 more recommended** (see P3 audit Section 3.3) |
| **Context7** | `resolve-library-id`, `query-docs` (both standalone and plugin variants) | Look up current documentation for Next.js 16, Prisma 7, Stripe, Zod 4, React 19, Tailwind CSS 4. Essential when APIs change between versions. | **Not yet permitted** |
| **Perplexity** | `search`, `reason`, `deep_research` | Research Stripe API changes, HIPAA regulation updates, dependency security advisories, complex debugging. | **Not yet permitted** |
| **GitHub** | `create_pull_request`, `get_pull_request_status`, `create_issue`, `list_issues` | PR management, issue tracking. Note: `gh:*` CLI is already permitted and covers most needs. | CLI permitted; MCP tools are nice-to-have |

### Supporting MCP Servers

| MCP Server | Key Tools | RimalHealth Use Case | Permission Status |
|------------|-----------|---------------------|-------------------|
| **claude-in-chrome** | `navigate`, `read_page`, `form_input`, `get_page_text` | Manual browser testing, visual QA of live site at rimalhealth.com | **Not yet permitted** |
| **Serena** | `find_symbol`, `get_symbols_overview`, `search_for_pattern` | Symbol-level code navigation in large files (useful for 908-line Prisma schema, complex lib modules) | **Not yet permitted** |
| **Semgrep** | `deprecation_notice` | None. Only shows a deprecation notice. | Ignore |

### Neon MCP: Priority Expansion

The Neon MCP is **critical** for RimalHealth because the production database is Neon PostgreSQL. Current permissions cover only `run_sql` and `list_projects`. The following tools should be added:

| Tool | Use Case | Priority |
|------|----------|----------|
| `run_sql_transaction` | Atomic multi-step data fixes | High |
| `get_database_tables` | Quick schema overview | High |
| `describe_table_schema` | Inspect column types and constraints | High |
| `explain_sql_statement` | Query optimization | High |
| `list_slow_queries` | Performance monitoring | High |
| `create_branch` / `describe_branch` / `delete_branch` | Preview branches for testing migrations | Medium |
| `prepare_database_migration` / `complete_database_migration` | Migration management via Neon branching | Medium |
| `compare_database_schema` | Drift detection between branches | Medium |
| `get_connection_string` | Connection strings for different branches | Low |

### Context7: Library Documentation Lookup

Highly valuable for staying current with the fast-moving stack:

| Library | Why Docs Matter |
|---------|----------------|
| Next.js 16 | App Router patterns, middleware API, server/client component boundaries |
| Prisma 7 | Query syntax changes, extension API, migration commands |
| Stripe | Checkout Sessions API, Webhook event types, Subscription lifecycle |
| Zod 4 | Schema syntax (v4 has breaking changes from v3, e.g., `{ message: '...' }` vs `{ required_error: '...' }`) |
| React 19 | New hooks, server component patterns |
| Tailwind CSS 4 | `@theme` syntax, new utility classes |

---

## 6. Agents per Task Type

| Task Type | Team(s) | Agents | Example |
|-----------|---------|--------|---------|
| Bug fix (single file) | A or B | 1 | Fix Stripe webhook error handling |
| Bug fix (cross-cutting) | A + C + **F** | 3 | Fix auth flow + review for regressions |
| New API endpoint | A + C + **F** | 3 | Add refill request API + tests + review |
| New UI page | B + C + **F** | 3 | Add patient documents page + review |
| New feature (full stack) | A + B + C + **F** | 4 | Add medication tracking + review |
| Large refactor | E + A + B + C + **F** + **H** | 4-6 | Migrate auth + arch review + code review |
| Deployment | D + **F** | 2 | Deploy via `/deploy` + pre-deploy review |
| Database migration | D + A + **G** | 3 | Schema change + data integrity check |
| Security / HIPAA audit | **F** + **G** + C | 3 | Full HIPAA review + data integrity + test |
| Performance optimization | A + **G** + **H** | 3 | Perf audit + fix + arch assessment |
| Proactive bug hunt | **G** | 1-3 | Weekly integration health + data integrity sweep |
| Architecture review | **H** | 1-3 | Quarterly arch review + infra audit + dependency review |
| Infrastructure work | D + **H** | 2 | CI/CD hardening + infrastructure audit |
| CLAUDE.md / docs update | E | 1 | Periodic docs maintenance |

### Skill-to-Team Matrix (Quick Reference)

| Skill | A (API) | B (UI) | C (QA) | D (DevOps) | E (Plan) | F (Review) | G (Debug) | H (Arch) |
|-------|:-------:|:------:|:------:|:----------:|:--------:|:----------:|:---------:|:--------:|
| `systematic-debugging` | **P** | - | S | S | - | - | S | - |
| `verification-before-completion` | S | S | **P** | - | - | S | - | - |
| `test-driven-development` | S | - | **P** | - | - | - | - | - |
| `executing-plans` | S | S | - | - | - | - | - | - |
| `writing-plans` | - | - | - | - | **P** | - | - | S |
| `brainstorming` | - | S | - | - | **P** | - | - | - |
| `frontend-design` | - | **P** | - | - | - | - | - | - |
| `requesting-code-review` | S | - | **P** | - | - | S | - | - |
| `dispatching-parallel-agents` | - | - | - | - | **P** | - | - | - |
| `revise-claude-md` | - | - | - | - | S | - | - | - |
| `ralph-loop` | - | - | - | S | - | - | - | - |
| `schedule` | - | - | - | **P** | - | - | - | - |
| `/deploy` | - | - | - | **P** | - | - | - | - |
| `/preflight` | - | - | - | **P** | - | - | - | - |
| `/hipaa-review` | - | - | S | - | - | **P** | - | - |
| `/test-flow` | - | - | **P** | - | - | - | - | - |
| `/stripe-debug` | **P** | - | - | - | - | - | S | - |
| `/db-check` | - | - | - | **P** | - | - | S | - |
| `/code-review` | - | - | - | - | - | **P** | - | - |
| `/security-scan` | - | - | - | - | - | **P** | - | - |
| `/debug-investigate` | - | - | - | - | - | - | **P** | - |
| `/integration-health` | - | - | - | - | - | - | **P** | - |
| `/data-integrity-check` | - | - | - | - | - | - | **P** | - |
| `/perf-audit` | - | - | - | - | - | - | **P** | S |
| `/arch-review` | - | - | - | - | - | - | - | **P** |
| `/infra-audit` | - | - | - | - | - | - | - | **P** |
| `/dependency-review` | - | - | - | - | - | - | - | **P** |
| `/scale-assessment` | - | - | - | - | - | - | - | **P** |

**P** = Primary, **S** = Secondary, **-** = Not applicable

---

## 7. Capability Gaps

### Gap 1: HIPAA Compliance Checker

- **Need:** Automated scanning of code changes for PHI handling violations (unencrypted storage, missing audit logs, PHI in error messages or URLs).
- **Current state:** Manual review only. CLAUDE.md documents the rules, but no automated enforcement exists.
- **Recommendation:** Create `/hipaa-review` custom skill (Section 4). Integrate as a pre-commit check pattern.
- **Priority:** HIGH -- a single missed `encryptPHI()` call is a regulatory violation.

### Gap 2: PHI Leak Detection in Logs and Responses

- **Need:** Runtime detection of PHI appearing in `console.log`, API error responses, or Netlify function logs.
- **Current state:** No automated scanning. Relies on developer discipline.
- **Recommendation:** Add grep-based scanning in `/hipaa-review` for known PHI patterns (SSN format, DOB format, name fields in log statements). Consider adding a Zod-based response sanitizer for API routes.
- **Priority:** HIGH -- PHI in logs is the most common accidental HIPAA violation.

### Gap 3: Stripe Webhook Testing Automation

- **Need:** End-to-end testing of the payment-first flow (Stripe checkout -> webhook -> user creation -> set-password email).
- **Current state:** Manual testing only. The Stripe CLI (`stripe listen`) can forward webhooks locally, but there is no automated test that exercises the full flow.
- **Recommendation:** Create `/stripe-debug` custom skill for investigation. Write Playwright E2E test that exercises the full checkout flow using Stripe test mode.
- **Priority:** MEDIUM -- the flow works in production, but regressions are hard to catch.

### Gap 4: Database Migration Safety Net

- **Need:** Pre-migration validation (will this migration break existing data? Are PHI fields still encrypted after schema change?).
- **Current state:** `npx prisma migrate dev` runs migrations, but no automated pre/post validation. The broken `neon-postgres` skill symlink means there is no database validation tooling.
- **Recommendation:** Create `/db-check` custom skill. Expand Neon MCP permissions to include `create_branch`, `compare_database_schema`, and `prepare_database_migration` for safe branch-based migration testing.
- **Priority:** MEDIUM -- schema changes on a HIPAA database require extra care.

### Gap 5: Monitoring and Alerting

- **Need:** Production monitoring for application health, database performance, and error rates.
- **Current state:** Health check endpoint exists (`/api/health`), but no scheduled monitoring or alerting.
- **Recommendation:** Use `schedule` skill to set up periodic health checks. Expand Neon MCP permissions to include `list_slow_queries` for database performance monitoring.
- **Priority:** LOW -- the application is stable but should have proactive monitoring for a healthcare product.

---

## 8. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Hardcoded secrets in settings.local.json** | HIGH -- Netlify token and DB credentials exposed in the file | Confirmed (exists now) | Rotate Netlify token immediately. Replace settings file with the recommended version from P3 audit Section 5.1. |
| **Missing `/hipaa-review` skill** | HIGH -- PHI handling verified only by human review, no automated enforcement | High | Create the skill (Section 4). Make it a required step before PRs touching PHI-related files. |
| **Broken `neon-postgres` skill symlink** | LOW -- Neon MCP tools provide equivalent functionality | Confirmed | Remove broken symlink from `.claude/skills/`. Create `/db-check` as replacement. |
| **Incomplete Playwright MCP permissions** | MEDIUM -- E2E testing limited to basic navigation, missing responsive testing and console error checking | High | Expand to full Playwright tool set per P3 audit Section 3.3. |
| **No team-shared `settings.json`** | LOW -- each developer must configure permissions independently | Medium | Create `.claude/settings.json` with baseline read-only + test permissions (P3 audit Section 5.3). |
| **Over-permissive `rm:*` in current settings** | MEDIUM -- agent could delete critical files | Medium | Remove from allow list. Replace with deny rule for `rm -rf:*`. Specific rm commands prompt interactively. |
| **Turbopack barrel export resolution in CI** | MEDIUM -- builds can fail on `@/lib/audit` imports | Known issue | Use explicit `/index` imports. Documented in CLAUDE.md. Consider deploying locally (`netlify deploy --prod`) as fallback. |
| **Context loss across agent sessions** | MEDIUM -- agents restart without knowledge of prior work | High | Ensure `trace.md` is updated after every agent session. Consider `claude-mem` plugin for persistent memory. |

---

## Quick Reference: "What tool should I use?"

| I need to... | Use this | Team |
|--------------|----------|------|
| Debug a failing API route | `systematic-debugging` + Neon MCP (`run_sql`) | A |
| Fix a Stripe payment issue | `/stripe-debug` + Stripe CLI + `systematic-debugging` | A |
| Build a new patient page | `frontend-design` + Playwright (screenshot) | B |
| Write tests for a new feature | `test-driven-development` + `/test-flow` | C |
| Verify PHI handling is correct | `/hipaa-review` + `verification-before-completion` | **F** |
| Deploy to production | `/preflight` then `/deploy` | D |
| Run a database migration | `/db-check` + Neon MCP (`create_branch`, `compare_database_schema`) | D |
| Plan a multi-file feature | `writing-plans` + `dispatching-parallel-agents` | E |
| **Review code before merge** | `/code-review` (runs F1+F2+F3 in parallel) | **F** |
| **Scan for security vulnerabilities** | `/security-scan` (OWASP-focused) | **F** |
| **Hunt for bugs proactively** | `/debug-investigate` + `/integration-health` | **G** |
| **Check data integrity** | `/data-integrity-check` (PHI encryption roundtrip, orphaned records) | **G** |
| **Profile performance** | `/perf-audit` (N+1 queries, slow queries, bundle size) | **G** |
| **Assess architecture health** | `/arch-review` (module coupling, dual implementation audit) | **H** |
| **Audit infrastructure** | `/infra-audit` (CI/CD, Neon, Redis, security headers) | **H** |
| **Check dependencies** | `/dependency-review` (npm audit, outdated, licenses) | **H** |
| **Evaluate scaling readiness** | `/scale-assessment` (DB patterns, caching, rendering) | **H** |
| Look up library documentation | Context7 (`resolve-library-id` -> `query-docs`) | Any |
| Research a complex issue | Perplexity (`search`, `reason`) | Any |
| Test the live site visually | Playwright (`browser_navigate`, `browser_take_screenshot`, `browser_resize`) | C/D |
| Migrate many files at once | `ralph-loop` + `executing-plans` | D/A |

## PM Deployment Guide

The PM can deploy any combination of teams. Common deployment patterns:

| Pattern | Teams | When |
|---------|-------|------|
| **Feature build** | A + B + C → F (review) | Standard full-stack feature |
| **Bug investigation** | G (hunt) → A/B (fix) → F (review) | Bug reported or proactive sweep |
| **Pre-deploy** | F (review) + D (deploy) | Before any production deploy |
| **Quarterly health check** | G (integration health) + H (arch review) | Scheduled quarterly |
| **Security audit** | F (security scan) + G (data integrity) + H (compliance arch) | Annual or after incidents |
| **Performance incident** | G (perf audit) + H (scale assessment) → A (fix) | Performance complaints |
| **Major refactor** | E (plan) → H (arch review) → A+B (implement) → F (review) → C (test) → D (deploy) | Large architectural changes |
| **Lightweight check** | Single agent from F, G, or H | Quick spot-check by PM |

---

*This matrix should be revisited when the tech stack changes (framework upgrades, new integrations), when new MCP servers become available, or when new custom skills are created.*
