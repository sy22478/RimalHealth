# P3 — Skills, Tools & Permissions Audit for RimalHealth

> **Prepared by:** P3 (Skills & Tools Auditor)
> **Date:** 2026-03-25
> **Project:** RimalHealth Telehealth Platform (Next.js 16 / Prisma / Stripe / Netlify)
> **Status:** Audit complete — recommendations ready for implementation

---

## 1. Current Settings Audit

### 1.1 Existing File: `.claude/settings.local.json`

The current file contains **69 permission entries**. It has grown organically through interactive approval prompts rather than intentional configuration. Key observations:

**What is configured:**

| Category | Entries | Assessment |
|----------|---------|------------|
| Git operations | `git add`, `git commit`, `git push`, `git status`, `git remote`, `git:*` (catch-all) | Redundant — `git:*` makes the specific ones unnecessary |
| npm/npx | `npm run:*`, `npm install:*`, `npx prisma:*`, `npx tsc:*`, `npx tsx:*`, `npx eslint:*`, `npx next:*` | Good but incomplete — missing `npx vitest:*`, `npx playwright:*` |
| Netlify | `netlify:*`, `netlify status:*`, `netlify deploy:*`, `netlify deploys:*`, `npx netlify:*`, `npx netlify-cli:*` | Redundant — `netlify:*` covers all sub-commands |
| Playwright MCP | 6 tools: navigate, screenshot, fill_form, click, type, wait_for, snapshot, evaluate | Good coverage but missing: `browser_close`, `browser_resize`, `browser_press_key`, `browser_select_option`, `browser_tabs`, `browser_run_code` |
| Neon MCP | `list_projects`, `run_sql` | Minimal — missing `describe_table_schema`, `get_database_tables`, `run_sql_transaction`, `get_connection_string` |
| Shell utilities | `find`, `curl`, `tail`, `cat`, `head`, `ls`, `wc`, `grep`, `echo`, `rm`, `du`, `dig` | Over-broad — `rm:*` is dangerous; `dig` is rarely needed |
| Other | `python3:*`, `node:*`, `WebSearch`, `WebFetch(domain:github.com)`, `gh:*`, `redis-cli ping:*`, `source:*`, `pkill:*`, `stripe events:*` | Mixed — `pkill:*` is dangerous; some one-off commands should be removed |

**Critical issues:**

1. **Hardcoded secrets in permissions:** Lines 64-65 contain `NETLIFY_AUTH_TOKEN=nfp_e7CeWeCy5MsQVAhAKRkbxRqLHWv1bee70389` directly in the permission rules. This token is now committed to the settings file and readable by anyone with repo access.
2. **Hardcoded database URL:** Line 31 contains a full Neon connection string with credentials (`neondb_owner:npg_amzqY3bBKG5f`).
3. **One-off script permissions:** Lines 66-68 contain long, specific script invocations that were approved once and never cleaned up. These add clutter without value.
4. **Dangerous permissions:** `rm:*` and `pkill:*` allow destructive operations without guardrails.
5. **No `settings.json`** (team-shared settings file) exists — all configuration is local-only.

### 1.2 Existing Custom Skills

| Skill | Location | Status | Assessment |
|-------|----------|--------|------------|
| `deploy` | `.claude/skills/deploy/SKILL.md` | Working | Good — covers type check, build, env audit, deploy, verify |
| `preflight` | `.claude/skills/preflight/SKILL.md` | Working | Good — env vars, build config, domain, static generation safety |
| `neon-postgres` | `.claude/skills/neon-postgres` (symlink) | **Broken** | Symlink target `../../.agents/skills/neon-postgres` does not exist. Dead link. |

### 1.3 Gap Analysis vs. Full-Stack Template

Comparing current permissions against the "Full-Stack Web App (Node.js / Next.js)" template:

| Template Entry | Current Status | Gap? |
|----------------|---------------|------|
| `Bash(npm install:*)` | Present | No |
| `Bash(npm run:*)` | Present | No |
| `Bash(npx:*)` | Missing (only specific npx commands) | **YES** — should use `npx:*` wildcard |
| `Bash(node:*)` | Present | No |
| `Bash(next:*)` | Missing (has `npx next:*`) | Minor gap |
| `Bash(prisma:*)` | Missing (has `npx prisma:*`) | Minor gap |
| `Bash(docker compose:*)` | Missing | **YES** — project has Docker setup |
| `Bash(git:*)` (consolidated) | Has separate entries + catch-all | Messy but functional |
| `Bash(gh:*)` | Present | No |
| `Bash(vercel:*)` | N/A — project uses Netlify | Correct exclusion |
| `Bash(curl -s:*)` | Has `curl:*` (broader) | No |
| `Bash(open:*)` | Missing | **YES** |
| `Bash(cp:*)` | Missing | **YES** |
| `WebSearch` | Present | No |
| `WebFetch(domain:nextjs.org)` | Missing | **YES** |
| `WebFetch(domain:developer.mozilla.org)` | Missing | **YES** |
| `WebFetch(domain:react.dev)` | Missing | **YES** |

**RimalHealth-specific gaps** (not in the template but needed for this project):

| Missing Permission | Why Needed |
|-------------------|------------|
| `Bash(npx vitest:*)` | Unit/integration testing |
| `Bash(npx playwright:*)` | E2E testing |
| `Bash(netlify:*)` | Already present but buried in redundancy |
| `Bash(stripe:*)` | Stripe CLI for webhook testing |
| Neon MCP (expanded) | Database management for production Neon DB |
| Playwright MCP (complete) | Full browser automation for E2E testing |
| `WebFetch(domain:stripe.com)` | Stripe API documentation |
| `WebFetch(domain:www.prisma.io)` | Prisma documentation |
| `WebFetch(domain:sendgrid.com)` | SendGrid API documentation |

---

## 2. Skills Inventory for RimalHealth

### 2.1 Existing Custom Skills

| Skill | Trigger | RimalHealth Relevance | Keep? |
|-------|---------|----------------------|-------|
| `/deploy` | Manual invocation | **HIGH** — Primary deployment method to Netlify | Yes |
| `/preflight` | Manual invocation | **HIGH** — Pre-deploy validation | Yes |
| `neon-postgres` | Symlink (broken) | **HIGH** — Database is on Neon | Fix or recreate |

### 2.2 Available Skills Mapped to RimalHealth Needs

#### Tier 1 — High Value, Activate Immediately

| Skill | RimalHealth Use Case | Priority |
|-------|---------------------|----------|
| `superpowers:systematic-debugging` | Stripe webhook issues, auth flow bugs, Prisma query debugging, middleware route protection — the project has complex integrations that frequently produce subtle bugs | **P0** |
| `superpowers:verification-before-completion` | HIPAA compliance demands verification — every feature touching PHI must be verified for encryption, audit logging, and no PHI leakage before marking complete | **P1** |
| `superpowers:test-driven-development` | Project has Vitest + Playwright already configured; TDD ensures PHI handling and payment flows are correct before deployment | **P2** |
| `superpowers:executing-plans` | Multi-step feature work (e.g., adding a new patient flow step) benefits from structured execution with checkpoints | **P3** |
| `claude-md-management:revise-claude-md` | CLAUDE.md is already 300+ lines; needs maintenance as the project evolves | **P4** |

#### Tier 2 — High Value, Activate for Specific Work

| Skill | RimalHealth Use Case | When to Activate |
|-------|---------------------|-----------------|
| `superpowers:writing-plans` | Planning new features (e.g., real-time messaging, provider scheduling, refill automation) | Before starting multi-file features |
| `superpowers:brainstorming` | UX decisions (intake form flow, dashboard layout), architecture decisions (caching strategy, audit log retention) | Design phase of new features |
| `frontend-design:frontend-design` | Patient portal UI, physician dashboard, intake form wizard — Tailwind v4 with custom design tokens | UI-focused tasks |
| `superpowers:requesting-code-review` | Security-sensitive changes (auth, PHI handling, Stripe integration) need review before merge | Before PRs on security-sensitive code |
| `superpowers:dispatching-parallel-agents` | Independent work streams: e.g., Agent A fixes API route while Agent B writes tests | Multi-file refactors, large features |

#### Tier 3 — Moderate Value, Situational

| Skill | RimalHealth Use Case | When to Activate |
|-------|---------------------|-----------------|
| `claude-md-management:claude-md-improver` | Periodic audit of CLAUDE.md for accuracy and completeness | Monthly or after major changes |
| `update-config` | Managing `.claude/settings.local.json` cleanup (needed now!) | One-time cleanup, then as needed |
| `ralph-loop:ralph-loop` | Autonomous execution of long task lists (e.g., "migrate all API routes to new auth pattern") | Repetitive multi-step refactors |
| `schedule` | Scheduled deployment health checks, database backup verification | Operational monitoring |

#### Tier 4 — Low Value for RimalHealth

| Skill | Why Low Priority |
|-------|-----------------|
| `figma:*` skills | No Figma integration; design system lives in `globals.css` @theme tokens |
| `claude-api` | No need for Claude API calls within the project itself |

### 2.3 Recommended New Custom Skills

These custom `SKILL.md` files should be created for RimalHealth-specific workflows:

#### `/hipaa-review` (New)
```
Trigger: Before any PR touching PHI fields
Purpose: Verify PHI encryption, audit logging, no console.log of PHI,
         no PHI in URLs/JWTs/error messages
Steps:
  1. Grep changed files for PHI field names (name, dob, address, phone, etc.)
  2. Verify encryptPHI/decryptPHI usage
  3. Verify auditLogger.logPHIAccess calls
  4. Check for console.log/console.error with PHI
  5. Report pass/fail
```

#### `/test-flow` (New)
```
Trigger: After feature implementation
Purpose: Run the full test pyramid for a specific area
Steps:
  1. Run relevant unit tests (npx vitest run tests/unit/<area>)
  2. Run relevant integration tests (npx vitest run tests/integration/<area>)
  3. Run type check (npx tsc --noEmit)
  4. Run lint (npx eslint <changed-files>)
  5. Report coverage delta
```

#### `/stripe-debug` (New)
```
Trigger: When Stripe integration issues arise
Purpose: Systematic Stripe debugging
Steps:
  1. Check Stripe API version in code vs. dashboard
  2. Verify webhook secret matches
  3. Check price IDs (STRIPE_PRICE_ACTIVE_TREATMENT, etc.)
  4. Verify checkout session params against current Stripe API
  5. Test webhook locally with stripe CLI
```

#### `/db-check` (New — replaces broken neon-postgres)
```
Trigger: Before/after database migrations
Purpose: Validate database state
Steps:
  1. Run npx prisma validate
  2. Run npx prisma db pull --force (compare schema)
  3. Check for pending migrations
  4. Verify encryption extension is active
  5. Spot-check PHI encryption on sample records
```

---

## 3. MCP Tools Audit

### 3.1 Available MCP Servers

| MCP Server | Tool Count | RimalHealth Relevance | Assessment |
|------------|-----------|----------------------|------------|
| **Neon** | 30+ tools | **CRITICAL** — Production database is Neon PostgreSQL | Currently only 2 tools permitted. Expand significantly. |
| **Playwright** (plugin) | 20+ tools | **HIGH** — E2E testing, visual verification, form flow testing | 8 tools permitted. Expand to full set. |
| **GitHub** | 20+ tools | **HIGH** — PR management, issue tracking, code search | `gh:*` CLI permitted but MCP tools not individually allowed. |
| **claude-in-chrome** | 15+ tools | **MEDIUM** — Manual browser testing, visual QA of live site | Not currently permitted. Add for QA workflows. |
| **Perplexity** | 3 tools (search, reason, deep_research) | **MEDIUM** — Research Stripe API changes, HIPAA regulations, dependency updates | Not currently permitted. |
| **Context7** (dual: standalone + plugin) | 2 tools each (resolve-library-id, query-docs) | **MEDIUM** — Look up Next.js, Prisma, Stripe, Zod docs | Not currently permitted. |
| **Serena** (plugin) | 20+ tools | **LOW** — Code analysis overlaps with built-in tools (Read, Grep, Glob) | Adds value for symbol-level navigation in large files. Not urgent. |
| **Semgrep** | 1 tool (deprecation_notice) | **NONE** — Only shows deprecation notice | Ignore. |

### 3.2 Neon MCP — Deep Dive (Critical for RimalHealth)

The project runs on Neon PostgreSQL. These Neon MCP tools map directly to RimalHealth workflows:

| Tool | Use Case | Priority |
|------|----------|----------|
| `run_sql` | Query patient data, debug issues, verify encryption | **Already permitted** |
| `run_sql_transaction` | Multi-step data fixes that need atomicity | **Add** |
| `list_projects` | Verify project configuration | **Already permitted** |
| `describe_project` | Check project settings, compute endpoints | **Add** |
| `get_database_tables` | Quick schema overview without Prisma Studio | **Add** |
| `describe_table_schema` | Inspect column types, constraints | **Add** |
| `get_connection_string` | Get connection strings for different branches | **Add** |
| `create_branch` | Create preview branches for testing migrations | **Add** |
| `describe_branch` | Check branch status | **Add** |
| `delete_branch` | Clean up preview branches | **Add** |
| `list_branch_computes` | Monitor compute usage | **Add** |
| `explain_sql_statement` | Query optimization | **Add** |
| `list_slow_queries` | Performance monitoring | **Add** |
| `prepare_database_migration` / `complete_database_migration` | Migration management via Neon branching | **Add** |
| `compare_database_schema` | Drift detection between branches | **Add** |
| `provision_neon_auth` | If Neon Auth is used in the future | Defer |
| `provision_neon_data_api` | If Neon Data API is used in the future | Defer |

### 3.3 Playwright MCP — Deep Dive (E2E Testing)

| Tool | Use Case | Currently Permitted? |
|------|----------|---------------------|
| `browser_navigate` | Navigate to app pages | Yes |
| `browser_take_screenshot` | Visual verification | Yes |
| `browser_fill_form` | Test intake form, login, signup | Yes |
| `browser_click` | Interact with buttons, links | Yes |
| `browser_type` | Type into fields | Yes |
| `browser_wait_for` | Wait for async operations | Yes |
| `browser_snapshot` | Accessibility tree snapshot | Yes |
| `browser_evaluate` | Run JS in page context | Yes |
| `browser_close` | Clean up after tests | **Add** |
| `browser_resize` | Test responsive layouts (mobile, tablet) | **Add** |
| `browser_press_key` | Keyboard navigation, Enter to submit | **Add** |
| `browser_select_option` | Dropdown selections in forms | **Add** |
| `browser_tabs` | Multi-tab testing | **Add** |
| `browser_run_code` | Complex test scenarios | **Add** |
| `browser_hover` | Tooltip/dropdown testing | **Add** |
| `browser_drag` | Drag interactions if any | Low priority |
| `browser_file_upload` | Document upload testing | **Add** |
| `browser_handle_dialog` | Alert/confirm dialogs | **Add** |
| `browser_navigate_back` | Back button behavior | **Add** |
| `browser_console_messages` | Check for JS errors | **Add** |
| `browser_network_requests` | Verify API calls | **Add** |
| `browser_install` | Install browsers for Playwright | **Add** |

### 3.4 GitHub MCP Tools

The `gh:*` CLI wildcard covers most GitHub operations, but MCP tools provide richer integration:

| Tool | Use Case | Priority |
|------|----------|----------|
| `create_pull_request` | Automated PR creation from agents | Medium |
| `get_pull_request_status` | Check CI status before deploy | Medium |
| `create_issue` | File bugs found during testing | Medium |
| `search_code` | Cross-repo code search | Low |

Recommendation: The CLI `gh:*` permission is sufficient. MCP GitHub tools are nice-to-have but not critical.

### 3.5 Context7 — Documentation Lookup

Highly valuable for looking up current API documentation without web search:

| Library | Use Case |
|---------|----------|
| Next.js 16 | App Router patterns, middleware, API routes |
| Prisma 7 | Query syntax, migration commands, extension API |
| Stripe | Checkout Sessions, Webhooks, Subscription API |
| Zod 4 | Schema syntax (v4 is new, docs are essential) |
| React 19 | New hooks, server components |
| Tailwind CSS 4 | @theme syntax, new utility classes |

Recommendation: Permit both `mcp__context7__*` and `mcp__plugin_context7_context7__*` tools.

---

## 4. Team Structure Recommendation

RimalHealth is a mature, production-deployed application. The team structure should optimize for **maintenance, feature development, and operational reliability** rather than greenfield build-out.

### 4.1 Recommended Agent Teams

#### Team A: API & Backend
**Focus:** API routes, Prisma queries, business logic, integrations (Stripe, SendGrid, DoseSpot)
**Typical agents per task:** 1-2

| Skill | Why |
|-------|-----|
| `superpowers:systematic-debugging` | Primary — most backend work is fixing or extending integrations |
| `superpowers:test-driven-development` | Write tests for API routes before implementation |
| `superpowers:verification-before-completion` | Verify PHI handling, audit logging |

**MCP tools:** Neon (run_sql, describe_table_schema), Context7 (Prisma docs, Stripe docs)

#### Team B: Frontend & UX
**Focus:** Patient portal, physician portal, intake form, checkout flow
**Typical agents per task:** 1

| Skill | Why |
|-------|-----|
| `frontend-design:frontend-design` | Tailwind v4 component design |
| `superpowers:brainstorming` | UX decisions, layout alternatives |
| `superpowers:verification-before-completion` | Visual verification of UI changes |

**MCP tools:** Playwright (screenshot, resize for responsive testing), Context7 (React/Next.js docs)

#### Team C: Testing & QA
**Focus:** Unit tests, integration tests, E2E tests, HIPAA compliance verification
**Typical agents per task:** 1-2

| Skill | Why |
|-------|-----|
| `superpowers:test-driven-development` | Primary skill — write and maintain test suites |
| `superpowers:verification-before-completion` | Final QA before deployment |
| `superpowers:systematic-debugging` | Investigate test failures |
| (custom) `/hipaa-review` | PHI compliance checks |

**MCP tools:** Playwright (full set for E2E), Neon (verify database state)

#### Team D: DevOps & Deployment
**Focus:** Netlify deployment, CI/CD, environment management, database migrations
**Typical agents per task:** 1

| Skill | Why |
|-------|-----|
| (custom) `/deploy` | Primary deployment skill |
| (custom) `/preflight` | Pre-deploy validation |
| (custom) `/db-check` | Database migration verification |
| `superpowers:systematic-debugging` | Debug deployment failures |
| `schedule` | Scheduled health checks |

**MCP tools:** Neon (migrations, branch management), Playwright (smoke tests on live site)

#### Team E: Planning & Coordination
**Focus:** Feature planning, sprint organization, multi-agent coordination
**Typical agents per task:** 1 (orchestrator role)

| Skill | Why |
|-------|-----|
| `superpowers:writing-plans` | Feature planning and task breakdown |
| `superpowers:dispatching-parallel-agents` | Coordinate Teams A-D on large features |
| `superpowers:brainstorming` | Architecture decisions |
| `claude-md-management:revise-claude-md` | Keep CLAUDE.md current |

### 4.2 Agents per Task Type

| Task Type | Team | Agents | Example |
|-----------|------|--------|---------|
| Bug fix (single file) | A or B | 1 | Fix Stripe webhook error handling |
| Bug fix (cross-cutting) | A + C | 2 | Fix auth flow affecting multiple routes |
| New API endpoint | A + C | 2 | Add refill request API with tests |
| New UI page | B + C | 2 | Add patient documents page with E2E tests |
| New feature (full stack) | A + B + C | 3 | Add medication tracking feature |
| Large refactor | E + A + B + C | 3-4 | Migrate from custom JWT to NextAuth |
| Deployment | D | 1 | Standard Netlify deploy |
| Database migration | D + A | 2 | Schema change with data migration |
| Security/HIPAA audit | C + A | 2 | Verify all PHI fields encrypted |
| Performance optimization | A + D | 2 | Optimize slow queries, caching |

### 4.3 Skill-to-Team Matrix (Summary)

| Skill | Team A (API) | Team B (UI) | Team C (QA) | Team D (DevOps) | Team E (Plan) |
|-------|:---:|:---:|:---:|:---:|:---:|
| `systematic-debugging` | Primary | - | Secondary | Secondary | - |
| `verification-before-completion` | Secondary | Secondary | Primary | - | - |
| `test-driven-development` | Secondary | - | Primary | - | - |
| `executing-plans` | Secondary | Secondary | - | - | - |
| `writing-plans` | - | - | - | - | Primary |
| `brainstorming` | - | Secondary | - | - | Primary |
| `frontend-design` | - | Primary | - | - | - |
| `requesting-code-review` | Secondary | - | Primary | - | - |
| `dispatching-parallel-agents` | - | - | - | - | Primary |
| `revise-claude-md` | - | - | - | - | Secondary |
| `claude-md-improver` | - | - | - | - | Secondary |
| `ralph-loop` | - | - | - | Secondary | - |
| `schedule` | - | - | - | Primary | - |
| `/deploy` (custom) | - | - | - | Primary | - |
| `/preflight` (custom) | - | - | - | Primary | - |
| `/hipaa-review` (proposed) | - | - | Primary | - | - |
| `/test-flow` (proposed) | - | - | Primary | - | - |
| `/stripe-debug` (proposed) | Primary | - | - | - | - |
| `/db-check` (proposed) | - | - | - | Primary | - |

---

## 5. Permission Recommendations

### 5.1 Recommended `.claude/settings.local.json`

This is a clean, intentional replacement for the current 69-line organic file. It follows the principle from the templates documentation: "Pre-allow everything your agents will need so they don't get blocked by permission prompts mid-execution."

```json
{
  "permissions": {
    "allow": [
      "Bash(npm install:*)",
      "Bash(npm run:*)",
      "Bash(npm test:*)",
      "Bash(npx:*)",
      "Bash(node:*)",
      "Bash(next:*)",

      "Bash(git:*)",
      "Bash(gh:*)",

      "Bash(netlify:*)",

      "Bash(docker compose:*)",

      "Bash(curl -s:*)",
      "Bash(open:*)",
      "Bash(cp:*)",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(wc:*)",
      "Bash(find:*)",
      "Bash(grep:*)",
      "Bash(python3:*)",
      "Bash(echo:*)",
      "Bash(du:*)",
      "Bash(mkdir:*)",
      "Bash(cd:*)",
      "Bash(source:*)",

      "Bash(stripe:*)",
      "Bash(redis-cli:*)",

      "WebSearch",
      "WebFetch(domain:nextjs.org)",
      "WebFetch(domain:developer.mozilla.org)",
      "WebFetch(domain:react.dev)",
      "WebFetch(domain:www.prisma.io)",
      "WebFetch(domain:stripe.com)",
      "WebFetch(domain:docs.sendgrid.com)",
      "WebFetch(domain:github.com)",
      "WebFetch(domain:zod.dev)",

      "mcp__Neon__run_sql",
      "mcp__Neon__run_sql_transaction",
      "mcp__Neon__list_projects",
      "mcp__Neon__describe_project",
      "mcp__Neon__get_database_tables",
      "mcp__Neon__describe_table_schema",
      "mcp__Neon__get_connection_string",
      "mcp__Neon__create_branch",
      "mcp__Neon__describe_branch",
      "mcp__Neon__delete_branch",
      "mcp__Neon__list_branch_computes",
      "mcp__Neon__explain_sql_statement",
      "mcp__Neon__list_slow_queries",
      "mcp__Neon__prepare_database_migration",
      "mcp__Neon__complete_database_migration",
      "mcp__Neon__compare_database_schema",

      "mcp__plugin_playwright_playwright__browser_navigate",
      "mcp__plugin_playwright_playwright__browser_take_screenshot",
      "mcp__plugin_playwright_playwright__browser_fill_form",
      "mcp__plugin_playwright_playwright__browser_click",
      "mcp__plugin_playwright_playwright__browser_type",
      "mcp__plugin_playwright_playwright__browser_wait_for",
      "mcp__plugin_playwright_playwright__browser_snapshot",
      "mcp__plugin_playwright_playwright__browser_evaluate",
      "mcp__plugin_playwright_playwright__browser_close",
      "mcp__plugin_playwright_playwright__browser_resize",
      "mcp__plugin_playwright_playwright__browser_press_key",
      "mcp__plugin_playwright_playwright__browser_select_option",
      "mcp__plugin_playwright_playwright__browser_tabs",
      "mcp__plugin_playwright_playwright__browser_run_code",
      "mcp__plugin_playwright_playwright__browser_hover",
      "mcp__plugin_playwright_playwright__browser_file_upload",
      "mcp__plugin_playwright_playwright__browser_handle_dialog",
      "mcp__plugin_playwright_playwright__browser_navigate_back",
      "mcp__plugin_playwright_playwright__browser_console_messages",
      "mcp__plugin_playwright_playwright__browser_network_requests",
      "mcp__plugin_playwright_playwright__browser_install",

      "mcp__context7__resolve-library-id",
      "mcp__context7__query-docs",
      "mcp__plugin_context7_context7__resolve-library-id",
      "mcp__plugin_context7_context7__query-docs",

      "mcp__perplexity__search",
      "mcp__perplexity__reason",
      "mcp__perplexity__deep_research"
    ],
    "deny": [
      "Bash(rm -rf:*)",
      "Bash(git push --force:*)",
      "Bash(git reset --hard:*)",
      "Bash(pkill:*)",
      "Bash(kill:*)",
      "Bash(chmod 777:*)"
    ]
  }
}
```

### 5.2 Changes Summary vs. Current

| Change | Rationale |
|--------|-----------|
| **Removed** hardcoded secrets (Netlify token, DB URL) | Security — credentials must never be in settings files |
| **Removed** one-off script permissions (lines 37, 50, 64-68) | Clutter — these were approved interactively and never cleaned up |
| **Removed** `Bash(rm:*)` | Safety — replaced with no blanket rm; specific rm commands will prompt |
| **Removed** `Bash(pkill:*)` | Safety — too destructive for auto-approval |
| **Consolidated** git permissions | `git:*` covers all git sub-commands |
| **Consolidated** Netlify permissions | `netlify:*` covers all Netlify CLI sub-commands |
| **Added** `npx:*` wildcard | Covers vitest, playwright, prisma, tsc, eslint, and future tools |
| **Added** `docker compose:*` | Project has Docker setup in `docker/` directory |
| **Added** `stripe:*` | Stripe CLI for local webhook testing |
| **Added** `redis-cli:*` | Expanded from `redis-cli ping:*` only |
| **Added** Neon MCP tools (14 more) | Database management, migration, monitoring |
| **Added** Playwright MCP tools (13 more) | Complete browser automation for E2E |
| **Added** Context7 MCP tools (4 total) | Documentation lookup for all stack libraries |
| **Added** Perplexity MCP tools (3) | Research capabilities for complex debugging |
| **Added** WebFetch domains (6 more) | Stack documentation sites |
| **Added** `deny` section | Explicit guardrails against destructive operations |

### 5.3 Recommended `.claude/settings.json` (Team-Shared)

This file should be committed to the repo so all contributors share baseline permissions:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run:*)",
      "Bash(npx:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(git branch:*)",
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(wc:*)",
      "Bash(find:*)",
      "Bash(grep:*)"
    ],
    "deny": [
      "Bash(rm -rf:*)",
      "Bash(git push --force:*)",
      "Bash(git reset --hard:*)"
    ]
  }
}
```

This provides safe read-only and test operations for any team member; write/deploy operations remain in `settings.local.json` (not committed).

---

## 6. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Hardcoded secrets in current settings.local.json** | HIGH — Netlify token and DB credentials exposed | Rotate Netlify token immediately; replace settings file with recommended version |
| **Broken neon-postgres skill** | LOW — Neon MCP tools provide equivalent functionality | Remove broken symlink; create `/db-check` custom skill instead |
| **Over-permissive `rm:*`** | MEDIUM — Agent could delete critical files | Remove from allow list; specific rm commands will require interactive approval |
| **No team-shared settings.json** | LOW — Each developer must configure independently | Create `settings.json` with baseline permissions |
| **Playwright MCP tools incomplete** | MEDIUM — E2E testing limited to basic navigation | Expand to full tool set per recommendations above |
| **No HIPAA-specific skill** | HIGH — PHI handling verified only by human review | Create `/hipaa-review` custom skill for automated checks |

---

## 7. Implementation Priority

### Immediate (Do Now)
1. **Rotate the Netlify auth token** — current one is exposed in settings.local.json
2. **Replace `.claude/settings.local.json`** with the recommended version (Section 5.1)
3. **Remove broken `neon-postgres` symlink** from `.claude/skills/`

### This Week
4. **Create `/hipaa-review` custom skill** — most impactful new skill for RimalHealth's compliance needs
5. **Create `/db-check` custom skill** — replaces broken neon-postgres
6. **Create `.claude/settings.json`** (team-shared) per Section 5.3

### Next Sprint
7. **Create `/test-flow` custom skill** — streamlines QA workflow
8. **Create `/stripe-debug` custom skill** — codifies Stripe debugging pattern from CLAUDE.md
9. **Activate `superpowers:systematic-debugging`** as default for all backend work
10. **Activate `superpowers:verification-before-completion`** as default for all PHI-related work

---

*This audit should be revisited when the stack changes (e.g., Zod upgrade, Next.js major version, new integrations) or when new MCP servers become available.*
