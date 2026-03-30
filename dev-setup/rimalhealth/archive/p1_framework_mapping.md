# P1: Framework Mapping -- Dev-Setup Adoption for RimalHealth

> **Author:** P1 (Framework Mapper)
> **Date:** 2026-03-25
> **Status:** Complete
> **Scope:** Map the dev-setup 4-tier, 10-document framework onto RimalHealth's full-stack HIPAA telehealth platform

---

## 1. Document Inventory

The dev-setup framework defines 10 documents across 4 tiers. Below is the concrete mapping for RimalHealth, with existence status, content specification, and sizing.

### TIER 1: HUB

#### 1.1 CLAUDE.md

| Attribute | Value |
|-----------|-------|
| **Exists?** | YES -- substantial, ~8 KB |
| **Framework-Compliant?** | PARTIAL -- see Section 2.1 for gap analysis |
| **Location** | `/Users/sonuyadav/RimalHealth/CLAUDE.md` |
| **Estimated Final Size** | 6-8 KB (should shrink, not grow) |

**What it currently contains:** Project overview, tech stack, workflow preferences, bug fixing rules, app location, dev commands, architecture (route groups, middleware, lib modules, key patterns), TypeScript conventions, HIPAA rules, business rules, env setup, deployment, git conventions, docs references.

**What needs to change for framework compliance:** See Section 2.1.

---

### TIER 2: CORE PLANNING

#### 2.1 build_instructions.md (Maintenance & Extension Guide)

| Attribute | Value |
|-----------|-------|
| **Exists?** | NO |
| **Adapted Name** | `build_instructions.md` (single file, NOT split) |
| **Location** | `dev-setup/rimalhealth/build_instructions.md` |
| **Estimated Size** | 15-20 KB |

**Decision: Single file, not split into frontend + API.** The framework recommends splitting for full-stack apps. For RimalHealth, this is wrong because:
1. The project is already built (all 5 phases complete). There is no "build from scratch" scenario.
2. Next.js App Router co-locates frontend and API in the same `app/` directory. Splitting would create artificial boundaries that don't reflect how the code is organized.
3. Most future work touches both layers simultaneously (e.g., adding a new patient feature requires a page component AND an API route).

**Content for RimalHealth:**

```
## ARCHITECTURE REFERENCE
  - Design system tokens (from globals.css @theme inline)
  - Component patterns (shadcn/ui "new-york", btn-primary, etc.)
  - API route patterns (requireAuth HOFs, Zod validation, audit logging)
  - Data flow patterns (PHI encryption pipeline, JWT auth flow)
  - The patient payment-first flow (step-by-step)

## HOW TO ADD A NEW FEATURE
  - Step-by-step for adding a new patient portal page
  - Step-by-step for adding a new API endpoint
  - Step-by-step for adding a new Prisma model (with PHI encryption)
  - Step-by-step for adding a new email notification template

## HOW TO FIX COMMON ISSUES
  - Turbopack barrel export resolution failures
  - Stripe webhook debugging
  - PHI encryption/decryption roundtrip failures
  - Auth middleware header propagation issues
  - Prisma `force-dynamic` for server components

## INTEGRATION PATTERNS
  - Stripe: checkout session creation, webhook handling, customer portal
  - SendGrid: template rendering, HIPAA-safe email content
  - DoseSpot: mock mode vs production, prescription flow
  - S3: document upload/download with encryption

## DEPLOYMENT RUNBOOK
  - Local Netlify deploy steps
  - CI/CD pipeline description
  - Environment variable checklist
  - Post-deploy verification steps
```

#### 2.2 tasks.md

| Attribute | Value |
|-----------|-------|
| **Exists?** | NO -- `PLAN.md` and `STATE.md` exist in `premium-telehealth-website/` but use a different format |
| **Location** | `dev-setup/rimalhealth/tasks.md` |
| **Estimated Size** | 5-10 KB (smaller than greenfield because most work is done) |

**Content for RimalHealth:**

This is the critical shared mutable state document. For a mature project, tasks.md shifts from "build the app" to "maintain and extend the app." Structure:

```
## TASK 0: Known Technical Debt
  - [ ] 0.1 Orphaned (patient) route group cleanup
  - [ ] 0.2 AGENTS.md deployment section says "Vercel" (should be Netlify)
  - [ ] 0.3 DoseSpot mock mode -- implement real integration
  - [ ] 0.4 Twilio SMS notifications -- not yet connected

## TASK 1: Current Sprint Work
  - [ ] (populated per sprint from backlog)

## TASK 2: Known Bugs / Issues
  - [ ] (populated from issue tracker)

## TASK 3: Planned Features
  - [ ] 3.1 Admin analytics dashboard
  - [ ] 3.2 Physician MFA
  - [ ] 3.3 Production deployment automation

## TASK 4: Infrastructure & DevOps
  - [ ] 4.1 CI/CD pipeline hardening
  - [ ] 4.2 Monitoring/alerting setup
  - [ ] 4.3 Backup automation
```

#### 2.3 sprint_plan.md

| Attribute | Value |
|-----------|-------|
| **Exists?** | NO (the one in `dev-setup/sprint_plan.md` is the SEPA Babies plan, not RimalHealth) |
| **Location** | `dev-setup/rimalhealth/sprint_plan.md` |
| **Estimated Size** | 8-12 KB |

**Content for RimalHealth:**

For a mature project, the sprint plan is less about "build phases" and more about:

```
## PROJECT STATUS SNAPSHOT
  ### Resource Audit
  - All env vars, API integrations, database, deployment status
  ### Completion Status
  - Phases 1-5: COMPLETE
  - Outstanding items from TASK 0 (technical debt)

## CURRENT SPRINT: [Name]
  ### Goal
  ### Parallel Workstreams
  ### Workarounds if Blocked
  ### Dependencies on External Services

## BACKLOG (Prioritized)
  - Feature requests ranked P0/P1/P2
  - Technical debt items ranked by risk

## OPERATIONAL CADENCE
  - How to handle bug reports
  - How to prioritize feature requests
  - Deploy frequency and rollback procedures
```

---

### TIER 3: REFERENCE MATERIAL

#### 3.1 content.md

| Attribute | Value |
|-----------|-------|
| **Exists?** | NO |
| **Location** | `dev-setup/rimalhealth/content.md` |
| **Estimated Size** | 12-20 KB |

**Decision: What content.md contains for a HIPAA telehealth app.**

This is NOT a typical "copy deck" with marketing headlines. For RimalHealth, content.md should contain:

```
## 1. EMAIL TEMPLATES
  - All 18 EmailTemplate enum values with:
    - Subject line
    - Body structure (what dynamic fields are interpolated)
    - HIPAA constraints (what MUST NOT appear in email body)
  - All 7 SMSTemplate enum values with message text

## 2. UI STRING CONSTANTS
  - Error messages (validation errors, API errors, auth errors)
  - Success messages (form submissions, payment confirmations)
  - Empty state messages (no prescriptions, no messages, etc.)
  - Loading state messages

## 3. FORM LABELS & HELP TEXT
  - Intake form step labels, field labels, help text, validation messages
  - Patient profile form labels
  - Contact form labels

## 4. MARKETING PAGE COPY
  - Homepage hero text, feature descriptions
  - Pricing page copy (the $50/$25 tiers)
  - FAQ content
  - About page content

## 5. LEGAL / COMPLIANCE COPY
  - Privacy policy key sections
  - HIPAA notice text
  - Terms of service key sections
  - Consent form language

## 6. SEO METADATA
  - Page titles, meta descriptions, OG tags for all marketing pages
```

**Source files to extract from:**
- `lib/notifications/templates.ts` -- email/SMS template identifiers and structures
- `lib/validation/schemas.ts` -- Zod error messages
- `app/(marketing)/` pages -- marketing copy
- `app/globals.css` -- any text defined in CSS layers

#### 3.2 asset_manifest.md

| Attribute | Value |
|-----------|-------|
| **Exists?** | NO |
| **Location** | `dev-setup/rimalhealth/asset_manifest.md` |
| **Estimated Size** | 10-15 KB |

**Decision: What asset_manifest.md contains for this project.**

For RimalHealth, "assets" extend well beyond media files. The manifest should inventory:

```
## 1. ENVIRONMENT VARIABLES
  Complete table from .env.example with:
  | Variable | Required? | Service | Where Configured | Status |
  (38 env vars across 12 service categories)

## 2. EXTERNAL API INTEGRATIONS
  | Service | Purpose | Credentials Location | API Version | Status |
  - Stripe (payments) -- ACTIVE
  - SendGrid (email) -- ACTIVE
  - DoseSpot (e-prescribing) -- MOCK MODE
  - Twilio (SMS) -- NOT CONNECTED
  - AWS S3 (documents) -- CONFIGURED
  - Google Analytics -- CONFIGURED
  - Neon (database) -- ACTIVE

## 3. DATABASE SCHEMA INVENTORY
  | Model | PHI Encrypted? | Fields Count | Relations |
  (18 Prisma models, 15 enums)

## 4. MEDIA ASSETS
  - Public directory inventory (favicon, OG images, logos)
  - Dynamic images (icon.tsx, opengraph-image.tsx)

## 5. THIRD-PARTY LIBRARIES (Key Dependencies)
  | Package | Version | Purpose | License |
  (top 20 critical dependencies)

## 6. INFRASTRUCTURE
  - Domain: rimalhealth.com (SiteGround DNS, Netlify hosting)
  - Database: Neon PostgreSQL
  - Cache: Redis
  - CI/CD: GitHub Actions -> Netlify
  - Docker: docker-compose for local dev

## 7. CUSTOM SKILLS
  | Skill | Location | Purpose |
  - /deploy -- .claude/skills/deploy/SKILL.md
  - /preflight -- .claude/skills/preflight/SKILL.md
```

#### 3.3 context_brief.md

| Attribute | Value |
|-----------|-------|
| **Exists?** | PARTIAL -- split across AGENTS.md, CLAUDE.md, PROJECT.md, context.md, and several docs/ files |
| **Location** | `dev-setup/rimalhealth/context_brief.md` |
| **Estimated Size** | 20-30 KB |

**Content for RimalHealth:**

```
## 1. PROJECT SUMMARY
  What, who, why, regulatory context

## 2. HIPAA COMPLIANCE FRAMEWORK
  - PHI definitions specific to this app
  - Encryption requirements (AES-256-GCM)
  - Audit logging requirements
  - Data retention policy (7 years)
  - What constitutes a HIPAA violation in code

## 3. CLINICAL DOMAIN KNOWLEDGE
  - What is AUD (Alcohol Use Disorder)?
  - What is Naltrexone? How does it work?
  - What is the AUDIT-C screening tool?
  - California telemedicine regulations
  - DEA requirements for controlled substances (Naltrexone is NOT controlled, but the system supports it)

## 4. BUSINESS RULES (Complete)
  All 6 existing rules plus detailed edge cases:
  - Payment-first flow with exact sequence
  - Physician review SLA (24 hours)
  - California-only ZIP code validation
  - One active intake constraint
  - Refill request window (7 days before)
  - Physician-patient visibility rules

## 5. USER PERSONAS & FLOWS
  - Patient: signup-free checkout -> set password -> intake -> treatment
  - Physician: admin invitation -> secret key -> login -> review queue
  - Admin: physician management CRUD

## 6. PRICING MODEL
  | Plan | Monthly Fee | Description |
  | Active Treatment | $50 | During active Naltrexone treatment |
  | Maintenance | $25 | Post-treatment monitoring |
  | Medication | $10-50 | At pharmacy, insurance may cover |

## 7. SOURCE DOCUMENT CROSS-REFERENCE
  | Document | Location | Purpose |
  - PROJECT.md, PLAN.md, STATE.md, api-spec.md, security-audit-report.md

## 8. INCONSISTENCIES FOUND
  - AGENTS.md Section 17 says "Deployed via GitHub Actions to Vercel" -- should be Netlify
  - AGENTS.md Section 3 says patient/ is "Legacy patient routes (redirects)" -- actually the active portal
  - AGENTS.md lists some env vars (e.g., RESEND_API_KEY) that are not in the primary stack
```

---

### TIER 4: COORDINATION

#### 4.1 skills_matrix.md

| Attribute | Value |
|-----------|-------|
| **Exists?** | NO (the one in `dev-setup/skills_matrix.md` is the SEPA Babies matrix) |
| **Location** | `dev-setup/rimalhealth/skills_matrix.md` |
| **Estimated Size** | 10-15 KB |

**Content for RimalHealth:**

```
## 1. AGENT TEAM ROSTER
  (Per trace.md: PM, P-Team (P1-P3), E-Team (E1-E5))

## 2. AVAILABLE MCP TOOLS AUDIT
  | MCP Server | Tools | Project Use |
  - Neon: run_sql, list_projects -- DATABASE OPS (direct SQL for debugging)
  - Playwright: browser_* -- E2E TESTING, visual verification
  - GitHub: issues, PRs, code search -- PROJECT MANAGEMENT
  - Perplexity: search, research -- DOCUMENTATION LOOKUP
  - Chrome Extension: navigate, form_input, etc. -- MANUAL TESTING
  - Serena: find_symbol, get_symbols_overview -- CODE NAVIGATION
  - Context7: query-docs -- LIBRARY DOCS

## 3. CUSTOM SKILLS
  - /deploy: Pre-flight checks + Netlify production deploy
  - /preflight: Env var audit, build config, domain validation

## 4. SKILL-TO-TASK MAPPING
  For ongoing maintenance work:
  - Bug fixing: Serena (code nav) + Neon (SQL debugging) + Playwright (repro)
  - Feature dev: Serena + Context7 (lib docs) + Playwright (E2E)
  - Deployment: /deploy skill + /preflight skill
  - Code review: GitHub MCP tools

## 5. CAPABILITY GAPS
  - No automated HIPAA compliance checker
  - No PHI leak detection in logs/responses
  - No Stripe webhook testing automation

## 6. RISK REGISTER
  - PHI exposure in error messages or logs
  - Stale deploy cache on Netlify
  - Turbopack barrel export resolution in CI
```

#### 4.2 trace.md

| Attribute | Value |
|-----------|-------|
| **Exists?** | YES -- initialized at `dev-setup/rimalhealth/trace.md` |
| **Location** | `dev-setup/rimalhealth/trace.md` |
| **Estimated Size** | Grows over time, starts at ~1 KB |

Already initialized with PM-001 and the P-Team/E-Team structure. No changes needed to format.

#### 4.3 .claude/settings.local.json

| Attribute | Value |
|-----------|-------|
| **Exists?** | YES -- at `.claude/settings.local.json` |
| **Framework-Compliant?** | NO -- heavily polluted with one-off commands |
| **Location** | `/Users/sonuyadav/RimalHealth/.claude/settings.local.json` |
| **Estimated Size** | ~2 KB (after cleanup) |

**Current problems:**
1. Contains 69 permission entries, many of which are one-off commands accumulated over time (e.g., full inline TypeScript scripts, hardcoded database URLs, specific curl commands with test credentials)
2. Exposes database credentials in plain text (`DATABASE_URL=...` with Neon password)
3. Has redundant entries (both `Bash(git:*)` and individual git subcommands)
4. Missing some useful patterns from the framework template

**Needs cleanup to match the framework template pattern.** See Section 3.3 for the recommended replacement.

---

## 2. What Already Exists vs What's Missing

### 2.1 CLAUDE.md -- Gap Analysis for Framework Compliance

The existing CLAUDE.md is strong. At ~8 KB it is near the framework's 5-10 KB target. Specific changes needed:

| Framework Requirement | Current Status | Action Needed |
|----------------------|---------------|---------------|
| Project Overview | Present | None |
| Tech Stack | Present (compact) | None |
| Project Structure (ASCII tree) | **MISSING** | Add. The full tree is in AGENTS.md but not CLAUDE.md. Add a compact 15-line version. |
| Commands | Present (comprehensive) | None |
| Key Reference Files table | **MISSING** | Add table pointing to all dev-setup docs |
| Domain Knowledge quick reference | Present (as Business Rules) | Minor: consolidate HIPAA rules + business rules into a "Domain Knowledge" table |
| Design System summary | Present (Tailwind v4 paragraph) | Minor: convert to summary table format |
| Conventions section | Scattered (workflow prefs, bug fixing rules, TS conventions, HIPAA rules, git conventions) | Restructure: merge into a single "Conventions" section with sub-bullets |
| "Read tasks.md first" convention | **MISSING** | Add as first convention bullet |
| "Update tasks.md when work completes" convention | **MISSING** | Add as second convention bullet |

**Sizing assessment:** The current CLAUDE.md does NOT need to grow. It should be refactored for structure, not expanded. Some content currently in CLAUDE.md belongs in Tier 2/3 docs:
- The full Architecture section (route groups, middleware, lib modules) could move to `build_instructions.md`, with only a compact summary remaining in CLAUDE.md
- The Environment Setup section could move to `asset_manifest.md` (environment variables inventory)
- The Documentation section is replaced by the Key Reference Files table

### 2.2 AGENTS.md -- Overlap Analysis

AGENTS.md (`/Users/sonuyadav/RimalHealth/AGENTS.md`) is a 769-line comprehensive guide. It overlaps with MULTIPLE framework documents:

| AGENTS.md Section | Overlaps With | Disposition |
|-------------------|--------------|-------------|
| Sec 1-2: Project Overview, Tech Stack | CLAUDE.md, context_brief.md | Keep in CLAUDE.md only |
| Sec 3: Project Structure | CLAUDE.md (after adding tree) | Keep in CLAUDE.md only |
| Sec 4: Build/Dev Commands | CLAUDE.md | Already in CLAUDE.md |
| Sec 5: Environment Setup | asset_manifest.md | Move to asset_manifest.md |
| Sec 6: Code Style Guidelines | build_instructions.md | Move to build_instructions.md |
| Sec 7: Form Development | build_instructions.md | Move to build_instructions.md |
| Sec 8: Security/HIPAA | context_brief.md | Move to context_brief.md |
| Sec 9: Business Rules | context_brief.md | Move to context_brief.md |
| Sec 10: Roles & Permissions | context_brief.md | Move to context_brief.md |
| Sec 11: Testing Strategy | build_instructions.md | Move to build_instructions.md |
| Sec 12: Implementation Status | tasks.md (as completion status) | Move to tasks.md |
| Sec 13: Database Schema | context_brief.md or standalone | Prisma schema IS the source of truth; brief summary in context_brief.md |
| Sec 14: Performance Guidelines | build_instructions.md | Move to build_instructions.md |
| Sec 15: Accessibility | build_instructions.md | Move to build_instructions.md |
| Sec 16: Git Workflow | CLAUDE.md (already there) | Keep in CLAUDE.md only |
| Sec 17: Deployment | build_instructions.md (runbook) | Move to build_instructions.md -- **FIX: says Vercel, should be Netlify** |
| Sec 18: Documentation References | CLAUDE.md Key Reference Files table | Superseded |

**Recommendation:** AGENTS.md should be RETIRED once the framework documents are in place. It is a monolithic "everything" doc that violates the framework's core principle of specialized documents. Its content will be distributed across the 10 framework docs. After migration, AGENTS.md can either be deleted or retained as a frozen historical reference with a header note pointing to CLAUDE.md.

### 2.3 Existing Documentation Summary

| Document | Exists | Framework Role | Action |
|----------|--------|---------------|--------|
| `CLAUDE.md` | Yes | Tier 1 Hub | Refactor for compliance |
| `AGENTS.md` | Yes | Overlaps Tier 2+3 | Retire after migration |
| `premium-telehealth-website/PROJECT.md` | Yes | Source for context_brief.md | Extract content, reference |
| `premium-telehealth-website/PLAN.md` | Yes | Source for tasks.md | Extract content, reference |
| `premium-telehealth-website/STATE.md` | Yes | Source for tasks.md | Extract content, reference |
| `premium-telehealth-website/docs/api-spec.md` | Yes | Source for build_instructions.md | Extract content, reference |
| `premium-telehealth-website/docs/security-audit-report.md` | Yes | Source for context_brief.md | Extract content, reference |
| `premium-telehealth-website/docs/netlify-dns-setup.md` | Yes | Source for asset_manifest.md | Extract content, reference |
| `.claude/settings.local.json` | Yes | Tier 4 Permissions | Clean up |
| `.claude/skills/deploy/SKILL.md` | Yes | Custom skill | Reference in skills_matrix.md |
| `.claude/skills/preflight/SKILL.md` | Yes | Custom skill | Reference in skills_matrix.md |
| `dev-setup/rimalhealth/trace.md` | Yes | Tier 4 Trace | Already initialized |

### 2.4 What's Completely Missing

| Document | Priority | Why It Matters |
|----------|----------|---------------|
| `build_instructions.md` | **HIGH** | Without it, agents make inconsistent decisions about how to add features or fix bugs. The AGENTS.md monolith is too large to parse efficiently. |
| `tasks.md` | **HIGH** | No shared mutable state. Agents don't know what work is in progress or completed. STATE.md exists but is a static snapshot, not a live tracker. |
| `content.md` | **MEDIUM** | Email templates, error messages, and form labels are spread across 20+ files. No single source of truth for UI strings. |
| `asset_manifest.md` | **MEDIUM** | Env vars, integrations, and infrastructure are documented in .env.example and scattered docs but not inventoried with status. |
| `context_brief.md` | **MEDIUM** | Domain knowledge is split across CLAUDE.md, AGENTS.md, PROJECT.md. No single synthesized reference. |
| `sprint_plan.md` | **LOW** | The project is in maintenance mode. Sprint planning is less critical than for a greenfield build. |
| `skills_matrix.md` | **LOW** | The project uses specific MCP tools. Documenting them is useful but not blocking. |

---

## 3. Adaptation Decisions

### 3.1 Should build_instructions be split?

**Decision: NO. Single file.**

Rationale:
- The project is already built. Build instructions are about "how to extend and maintain," not "how to construct from nothing."
- Next.js App Router makes frontend/API a continuum, not separate layers.
- A single `build_instructions.md` with sections for "Add a Feature," "Fix a Bug," "Deploy," and "Integration Patterns" is more useful than two documents that agents must cross-reference.

### 3.2 What should content.md contain?

**Decision: Email templates, UI strings, form labels, error messages, legal/compliance copy, SEO metadata.**

NOT marketing page copy in its entirety (that lives in the page components and is rarely changed). content.md should focus on:
1. **Things that are reused** -- email subjects, error messages, validation messages
2. **Things that must be consistent** -- the $50/$25 pricing appears in multiple places
3. **Things with compliance constraints** -- what CAN and CANNOT appear in emails (HIPAA)
4. **Things an agent needs when adding a new feature** -- "what template do I use for a new notification?"

### 3.3 What should asset_manifest.md contain?

**Decision: Environment variables, API integrations, database schema overview, infrastructure inventory, custom skills, and media assets.**

The traditional "media assets" section is small for this project (mostly generated images via `icon.tsx` and `opengraph-image.tsx`). The real "assets" are the 38 environment variables, 7 external API integrations, and 18 database models. These are the resources that agents need to know about.

### 3.4 Does RimalHealth need data_model.md?

**Decision: NO, as a separate document.**

The framework suggests `data_model.md` for full-stack apps. For RimalHealth:
- The Prisma schema at `prisma/schema.prisma` (908 lines) IS the authoritative data model
- It is well-commented with PHI encryption annotations
- A separate data_model.md would be a stale copy

Instead: `context_brief.md` should contain a summary table of models with PHI flags, and `build_instructions.md` should contain the "how to add a new model" guide. Both reference `prisma/schema.prisma` as the source of truth.

### 3.5 Recommended settings.local.json Replacement

The current `.claude/settings.local.json` has 69 entries including hardcoded credentials and one-off scripts. Replace with a clean version based on the framework's Full-Stack Web App template, adapted for RimalHealth:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm install:*)",
      "Bash(npm run:*)",
      "Bash(npx:*)",
      "Bash(npx vitest:*)",
      "Bash(npx prisma:*)",
      "Bash(npx tsx:*)",
      "Bash(npx tsc:*)",
      "Bash(npx eslint:*)",
      "Bash(npx next:*)",
      "Bash(node:*)",
      "Bash(python3:*)",
      "Bash(docker compose:*)",
      "Bash(git:*)",
      "Bash(gh:*)",
      "Bash(netlify:*)",
      "Bash(curl -s:*)",
      "Bash(open:*)",
      "Bash(cp:*)",
      "Bash(ls:*)",
      "Bash(wc:*)",
      "Bash(du:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(rm:*)",
      "Bash(stripe:*)",
      "Bash(redis-cli:*)",
      "Bash(dig:*)",
      "Bash(claude mcp:*)",
      "mcp__Neon__list_projects",
      "mcp__Neon__run_sql",
      "mcp__plugin_playwright_playwright__browser_navigate",
      "mcp__plugin_playwright_playwright__browser_take_screenshot",
      "mcp__plugin_playwright_playwright__browser_fill_form",
      "mcp__plugin_playwright_playwright__browser_click",
      "mcp__plugin_playwright_playwright__browser_type",
      "mcp__plugin_playwright_playwright__browser_wait_for",
      "mcp__plugin_playwright_playwright__browser_snapshot",
      "mcp__plugin_playwright_playwright__browser_evaluate",
      "WebSearch",
      "WebFetch(domain:nextjs.org)",
      "WebFetch(domain:react.dev)",
      "WebFetch(domain:developer.mozilla.org)",
      "WebFetch(domain:github.com)",
      "WebFetch(domain:stripe.com)",
      "WebFetch(domain:docs.netlify.com)"
    ]
  }
}
```

Key changes from current:
- Removed all hardcoded database URLs with credentials
- Removed one-off inline TypeScript scripts
- Consolidated `git` subcommands into `Bash(git:*)`
- Added `Bash(stripe:*)` for Stripe CLI testing
- Added WebFetch for relevant documentation domains
- Kept MCP tools for Neon and Playwright that are actively used

---

## 4. Framework Gaps for an Existing Project

The dev-setup framework was designed for SEPA Babies -- a greenfield landing page built from nothing in one session. RimalHealth is a production-ready full-stack app with 5 completed phases. This creates several adaptation requirements.

### 4.1 The "Build" vs "Maintain" Shift

| Framework Assumption | RimalHealth Reality | Adaptation |
|---------------------|---------------------|------------|
| build_instructions defines how to construct from scratch | App is already built | Reframe as "maintenance & extension guide" -- how to add features, fix bugs, deploy |
| tasks.md tracks construction progress | Construction is complete | Track tech debt, active bugs, planned features, current sprint work |
| sprint_plan.md sequences a multi-day build | No multi-day build planned | Document operational cadence, bug triage process, feature request pipeline |
| copy_deck.md provides content for first build | Content is already in the codebase | Document reusable strings, templates, and compliance-constrained copy for CONSISTENCY not for initial creation |
| asset_manifest.md inventories what needs to be created | All assets exist | Inventory what EXISTS and its STATUS (active, mock mode, not connected) |
| context_brief.md resolves conflicts before building | Code IS the resolved truth | Document domain knowledge that is NOT obvious from code -- clinical concepts, regulatory rules, business logic rationale |

### 4.2 Document Lifecycle in Maintenance Mode

For a mature project, the documents serve different purposes than during initial construction:

**CLAUDE.md** -- Unchanged role. Still the entry point for every agent session. Updated rarely (version bumps, new conventions).

**build_instructions.md** -- Becomes a "contributor guide." How to extend the app correctly. Referenced when adding features, not when building from scratch. Updated when architectural patterns change.

**tasks.md** -- Becomes a living backlog/sprint tracker. The ONLY document updated frequently. Replaces GitHub Issues for agent coordination (agents read tasks.md, not the issue tracker).

**sprint_plan.md** -- Becomes an operational playbook. Updated per sprint cycle. Less about "sequence 240 sub-tasks" and more about "here are the 5 things we're doing this week."

**content.md** -- Becomes a content governance document. Referenced when adding new notifications, error messages, or UI text. Ensures consistency across the app. Updated when new template types are added.

**asset_manifest.md** -- Becomes an infrastructure status board. Shows what's connected, what's in mock mode, what credentials expire when. Updated when integrations change status.

**context_brief.md** -- Becomes the domain knowledge base. The document an agent reads to understand WHY things work the way they do. Updated when business rules change.

**skills_matrix.md** -- Becomes a tool reference card. Which MCP tools to use for which tasks. Updated when new tools are added.

**trace.md** -- Unchanged role. Still the cross-session audit trail. Updated by every agent during execution.

**settings.local.json** -- Unchanged role. Still gates permissions. Updated when new tools are needed.

### 4.3 What to Skip / Deprioritize

For a mature project, the framework's Phase A-E document generation order can be compressed:

| Framework Phase | For RimalHealth | Rationale |
|----------------|-----------------|-----------|
| Phase A: Foundation (CLAUDE.md v1, context_brief.md) | **Do both** | CLAUDE.md needs refactoring; context_brief.md synthesizes scattered domain knowledge |
| Phase B: Specification (build_instructions, content, assets) | **Do build_instructions + asset_manifest; defer content.md** | build_instructions is the highest-value new document. content.md extraction is labor-intensive and lower priority since the content already works. |
| Phase C: Execution Planning (tasks, sprint_plan, skills_matrix) | **Do tasks.md; defer sprint_plan + skills_matrix** | tasks.md is essential shared state. Sprint plan and skills matrix add less value when there's no multi-day build to sequence. |
| Phase D: Finalization (CLAUDE.md v2, settings.local.json, trace.md) | **Do all three** | CLAUDE.md needs the reference files table. settings.local.json needs cleanup. trace.md is already started. |

### 4.4 Recommended Execution Order for E-Team

Based on the above analysis, the E-Team should produce documents in this priority order:

```
PRIORITY 1 (Immediate, Parallel):
  E1: context_brief.md    -- synthesize domain knowledge from 7+ source docs
  E2: build_instructions.md -- create the "how to extend" guide

PRIORITY 2 (After P1 complete, Parallel):
  E3: tasks.md            -- create the shared mutable state tracker
  E4: skills_matrix.md + settings.local.json cleanup

PRIORITY 3 (After all above, Serial):
  E5: CLAUDE.md v2        -- refactor with reference file table + compact structure
      asset_manifest.md   -- inventory all integrations and infrastructure

PRIORITY 4 (Deferred):
  content.md              -- extract email templates, error messages, UI strings
  sprint_plan.md          -- create when the next sprint is planned
```

---

## 5. Summary: Complete Document Map

| # | Document | Tier | Exists? | Priority | Est. Size | Owner |
|---|----------|------|---------|----------|-----------|-------|
| 1 | CLAUDE.md | 1-Hub | Partial | P1 | 6-8 KB | E5 |
| 2 | build_instructions.md | 2-Core | No | P1 | 15-20 KB | E2 |
| 3 | tasks.md | 2-Core | No | P1 | 5-10 KB | E3 |
| 4 | sprint_plan.md | 2-Core | No | P4 (defer) | 8-12 KB | E3 |
| 5 | content.md | 3-Ref | No | P4 (defer) | 12-20 KB | E1 |
| 6 | asset_manifest.md | 3-Ref | No | P3 | 10-15 KB | E2 |
| 7 | context_brief.md | 3-Ref | No | P1 | 20-30 KB | E1 |
| 8 | skills_matrix.md | 4-Coord | No | P2 | 10-15 KB | E4 |
| 9 | trace.md | 4-Coord | Yes | Done | ~1 KB+ | PM |
| 10 | settings.local.json | 4-Coord | Partial | P2 | ~2 KB | E4 |

**Total new content to produce:** ~88-135 KB across 8 documents (2 exist but need rework).

**AGENTS.md disposition:** Retire after E-Team completes all documents. Add deprecation header pointing to CLAUDE.md.

---

## 6. Key Findings and Cross-Team Notes

### For P2 (Codebase Analyst):
- The Prisma schema has 18 models and 15 enums across 908 lines. All PHI fields are annotated with `// Encrypted` comments. This should be inventoried in your deliverable.
- The `lib/notifications/templates.ts` file defines 18 email templates and 7 SMS templates. These are the canonical list of notification types.
- The `.env.example` file lists 38 environment variables across 12 service categories. This is the definitive env var reference.

### For P3 (Skills & Tools Auditor):
- The current `settings.local.json` exposes a Neon database password in plaintext. This must be flagged as a security issue.
- The MCP tools most relevant to RimalHealth maintenance are: Neon (SQL debugging), Playwright (E2E testing), GitHub (project management), and Serena (code navigation).
- Two custom skills exist: `/deploy` and `/preflight`. These should be documented in the skills matrix.

### For PM:
- The SEPA Babies documents in `dev-setup/` (sprint_plan.md, skills_matrix.md, trace.md) should be moved to a `dev-setup/sepa/` subdirectory to avoid confusion with the RimalHealth documents being created in `dev-setup/rimalhealth/`.
- AGENTS.md contains a factual error in Section 17 (says "Vercel" instead of "Netlify"). This should be fixed regardless of framework adoption.
- The orphaned `app/(patient)/` route group mentioned in CLAUDE.md should be tracked as tech debt in tasks.md.
