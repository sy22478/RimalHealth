# E5: CLAUDE.md v2 Refactoring Specification

> **Author:** E5 (Hub Updater)
> **Date:** 2026-03-25
> **Goal:** Make CLAUDE.md framework-compliant at 5-8 KB. It should SHRINK, not grow.
> **Current size:** ~8 KB (235 lines)
> **Target size:** ~6 KB (~180 lines)

---

## Summary of Changes

1. Add "Key Reference Files" table (replaces Documentation section)
2. Add compact 15-line project structure (ASCII tree)
3. Add "Read tasks.md first" convention
4. Merge scattered convention sections into one "Conventions" section
5. Trim Architecture section (move detailed lib module list to build_instructions.md)
6. Move Environment Setup details to asset_manifest.md (keep only quick-start)
7. Fix the orphaned `(patient)` route group reference (P2 found it no longer exists)

---

## Change 1: Add "Key Reference Files" Table

**Where:** After the "Tech Stack" line (line 9), before "Workflow Preferences"

**What to add:**

```markdown
## Key Reference Files

| Document | Location | Purpose |
|----------|----------|---------|
| tasks.md | `dev-setup/rimalhealth/tasks.md` | Active work tracker -- read first |
| build_instructions.md | `dev-setup/rimalhealth/build_instructions.md` | How to add features, fix bugs, deploy |
| context_brief.md | `dev-setup/rimalhealth/context_brief.md` | Domain knowledge, HIPAA rules, business logic |
| asset_manifest.md | `dev-setup/rimalhealth/asset_manifest.md` | Env vars, integrations, infra inventory |
| skills_matrix.md | `dev-setup/rimalhealth/skills_matrix.md` | MCP tools, custom skills, team structure |
| trace.md | `dev-setup/rimalhealth/trace.md` | Cross-session audit trail |
| Prisma schema | `premium-telehealth-website/my-app/prisma/schema.prisma` | 18 models, 17 enums -- authoritative data model |
```

---

## Change 2: Add Compact Project Structure

**Where:** After the "App Location" section (after line 30)

**What to add:**

```markdown
## Project Structure

```
premium-telehealth-website/my-app/
  app/
    (marketing)/     # Public pages (homepage, pricing, FAQ, etc.)
    (auth)/          # Login, signup, forgot-password, set-password
    patient/         # Patient portal (dashboard, billing, messages, etc.)
    physician/       # Physician portal (queue, patients, reviews, etc.)
    admin/           # Admin portal (physician management)
    intake/          # Intake form flow
    checkout/        # Payment flow (consent, payment, success, cancel)
    api/             # API routes by role (auth/, patient/, physician/, admin/, stripe/, webhooks/)
  components/        # UI components (physician/, patient/, forms/, ui/, layout/)
  lib/               # Core logic (auth/, db/, encryption/, hipaa/, integrations/, etc.)
  prisma/            # Schema + migrations
  tests/             # Unit, integration, E2E tests
```
```

---

## Change 3: Merge Scattered Convention Sections into One

Currently, conventions are spread across 5 separate sections:
- "Workflow Preferences" (lines 12-16)
- "Bug Fixing Rules" (lines 18-22)
- "TypeScript Conventions" (lines 156-161)
- "HIPAA / Security Rules" (lines 163-173)
- "Git Conventions" (lines 219-225)
- "Business Rules" (lines 175-183)

**What to remove:** Delete all 6 sections listed above entirely.

**Remove this text (Workflow Preferences, lines 11-16):**
```
## Workflow Preferences

- Act quickly — avoid excessive planning. When the task is clear, implement directly instead of outlining plans.
- Do not make excessive or unnecessary changes beyond what was requested.
- When deploying to Netlify, always set the correct base directory and verify build settings.
```

**Remove this text (Bug Fixing Rules, lines 18-22):**
```
## Bug Fixing Rules

- Before fixing a bug, verify the root cause — don't fix symptoms. Check env vars, API URLs, and middleware config first.
- When fixing Stripe integration issues, always validate API params against the current Stripe API version before deploying.
- For auth-related changes, ensure components using useAuth are wrapped in AuthProvider.
```

**Remove this text (TypeScript Conventions, lines 156-161):**
```
## TypeScript Conventions

- Strict mode enabled — no `any` without justification
- Explicit return types on all functions
- `interface` for object shapes, `type` for unions/primitives
- `'use client'` directive required for components using hooks or browser APIs
```

**Remove this text (HIPAA / Security Rules, lines 163-173):**
```
## HIPAA / Security Rules

**Never:**
- Log PHI to console or files
- Include PHI in error messages, URLs, or JWT tokens
- Store PHI unencrypted in the database
- Cache PHI in browser storage (localStorage, sessionStorage, cookies)

**PHI fields** (must be encrypted): name, date of birth, address, phone, email, medical history, medications, intake form data, messages, prescription details.

**API security:** Validate JWT on every protected route, use Zod for all input validation, rate limit auth endpoints (5 req/15 min), include CSRF protection on forms.
```

**Remove this text (Business Rules, lines 175-183):**
```
## Business Rules

1. Service restricted to California residents only
2. Intake review begins only after payment is confirmed
3. Physicians respond within 24 hours (async messaging, no real-time chat)
4. All physicians see all patients (no assignment restrictions)
5. Refill requests allowed 7 days before medication runs out
6. Patient can only have one active intake at a time
```

**Remove this text (Git Conventions, lines 219-225):**
```
## Git Conventions

Branch naming: `feature/`, `fix/`, `docs/`, `test/`, `refactor/`, `security/`

Commit prefixes: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `security:`

Never commit `.env` files, real patient data, database dumps, or log files containing PHI.
```

**What to add (single unified section, placed after Development Commands):**

```markdown
## Conventions

**Task tracking:**
- Read `dev-setup/rimalhealth/tasks.md` first before starting work.
- Update tasks.md when work completes (check off items, add notes).

**Workflow:**
- Act quickly -- implement directly when the task is clear. Avoid excessive planning.
- Do not make changes beyond what was requested.
- Before fixing a bug, verify the root cause. Check env vars, API URLs, middleware config first.

**TypeScript:** Strict mode, explicit return types, `interface` for objects, `type` for unions. `'use client'` required for hooks/browser APIs. No `any` without justification.

**HIPAA -- NEVER:** log PHI, include PHI in error messages/URLs/JWTs, store PHI unencrypted, cache PHI in browser storage. PHI fields (name, DOB, address, phone, medical data, messages, prescriptions) must use `encryptPHI()`/`decryptPHI()`.

**Business rules:** California-only. Payment before intake review. Physician 24h async response. All physicians see all patients. One active intake per patient. Refills available 7 days before end.

**Git:** Branch prefixes: `feature/`, `fix/`, `docs/`, `test/`, `refactor/`, `security/`. Commit prefixes: `feat:`, `fix:`, `docs:`, etc. Never commit `.env`, patient data, DB dumps, or PHI logs.

**Forms:** React Hook Form + Zod + `zodResolver`. Zod v4 syntax: `{ message: '...' }` not `{ required_error: '...' }`.

**Stripe:** Validate API params against current Stripe API version (`2026-01-28.clover`) before deploying. Auth components must be wrapped in AuthProvider.
```

---

## Change 4: Trim Architecture Section

The current Architecture section (lines 80-154) is 75 lines. The "Key Library Modules" subsection alone is 20 lines listing every lib/ subdirectory. This detail belongs in `build_instructions.md`, not the hub document.

**What to remove:** Delete the "Key Library Modules" subsection (lines 114-134).

**Remove this text:**
```
### Key Library Modules

- `lib/auth/` — JWT (`jwt.ts`), session (`session.ts`, `session-helpers.ts`), RBAC (`rbac.ts`), password (`password.ts`, `account-lockout.ts`), auth middleware (`require-auth.ts`), physician key (`secret-key.ts`)
- `lib/db/` — Prisma singleton (`prisma.ts`), PHI encryption extension (`encryption-extension.ts`), encryption middleware (`encryption-middleware.ts`), standalone encryption (`encryption.ts`)
- `lib/encryption/phi.ts` — AES-256-GCM field-level encryption (`encryptPHI`/`decryptPHI`)
- `lib/hipaa/` — encryption, audit-logger, PHI identifier definitions (`phi-identifiers.ts`), data retention policy (`data-retention.ts`)
- `lib/audit/` — `auditLogger` singleton (`logger.ts`), types, utils, middleware. **All PHI access must be logged via `auditLogger`.**
- `lib/redis/` — client, cache utilities, session store, queue
- `lib/intake/` — multi-step form questions, validation, scoring (AUDIT-C), auto-save
- `lib/patient/` — profile, prescriptions, messaging, documents, onboarding
- `lib/physician/` — patients, queue, review, messaging, prescriptions, review-types
- `lib/integrations/` — Stripe (`stripe.ts`), DoseSpot e-prescribing (`dosespot.ts` + mock + types), S3 document storage (`s3.ts`), SendGrid (`sendgrid.ts`), Twilio (`twilio.ts`)
- `lib/stripe/` — stripe-client (browser), stripe-server, stripe-webhooks
- `lib/security/` — rate-limit, CSRF (`csrf.ts`), security headers (`headers.ts`), sanitization, password policy
- `lib/middleware/` — API cache, rate-limit, performance monitor
- `lib/services/` — notification-service, audit-service, document-service, subscription-service, validation-service
- `lib/validation/` — Zod schemas (`schemas.ts`), sanitization
- `lib/constants.ts` — Site config, navigation links, session config, security headers
- `components/ui/` — shadcn/ui components ("new-york" style)
- `components/layout/` — Navigation, Footer, MobileStickyCTA
- `components/forms/` — IntakeForm (multi-step wizard), ContactForm, SmartInput
```

**Also remove from "Key Architectural Patterns" these items that are now covered in Conventions:**
- The "Forms" paragraph (line 148): `**Forms** — Always use React Hook Form + Zod. Import `zodResolver` from `@hookform/resolvers/zod`.`
- The "Zod v4" paragraph (line 154): `**Zod v4** — Project uses Zod 4.x. Use `{ message: '...' }` for error messages, not `{ required_error: '...' }` (Zod v3 syntax).`

---

## Change 5: Fix Orphaned (patient) Route Group Reference

**What to remove:** The "(patient) orphaned" note in Route Groups.

**Remove this text (lines 89-90):**
```
  - **Note:** `app/(patient)/` also exists but is orphaned — it resolves WITHOUT the `/patient/` prefix. Always use `app/patient/` for patient portal work.
```

P2 confirmed this directory no longer exists. Removing the stale reference.

---

## Change 6: Move Environment Setup Details to asset_manifest.md

The current Environment Setup section (lines 184-207) is 24 lines with shell commands for generating secrets and Docker instructions. This detail now lives in `asset_manifest.md`.

**Remove this text (lines 184-207):**
```
## Environment Setup

```bash
cp .env.example .env.local
# Required: NEXT_PUBLIC_APP_URL, DATABASE_URL, JWT_SECRET, PHI_ENCRYPTION_KEY (ENCRYPTION_KEY)
# Optional: SENDGRID_API_KEY, STRIPE_SECRET_KEY, NEXT_PUBLIC_GA_MEASUREMENT_ID
```

Database options for local dev: Neon (cloud), Postgres.app, or Homebrew PostgreSQL. After setting `DATABASE_URL`, run `npm run db:generate && npm run db:migrate`.

Generate secrets:
```bash
# JWT_SECRET (64 hex chars)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# PHI_ENCRYPTION_KEY (32-byte base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Docker Development
```bash
docker-compose -f docker/docker-compose.yml up -d    # Start PostgreSQL + Redis + app
docker-compose -f docker/docker-compose.yml logs -f app  # View logs
docker-compose -f docker/docker-compose.yml down      # Stop services
```
```

**Replace with (compact quick-start):**

```markdown
## Environment Setup

```bash
cp .env.example .env.local   # Then fill in DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY
npm run db:generate && npm run db:migrate
```

Full env var inventory with status: see `dev-setup/rimalhealth/asset_manifest.md`.
```

---

## Change 7: Replace Documentation Section with Pointer to Key Reference Files

**Remove this text (lines 227-235):**
```
## Documentation

Detailed documentation is in `premium-telehealth-website/`:
- `docs/api-spec.md` — API endpoint specifications
- `docs/security-audit-report.md` — Security audit findings
- `PROJECT.md` — Vision, business model, requirements
- `PLAN.md` — Implementation tasks and phases
- `STATE.md` — Current implementation status
```

This is replaced by the "Key Reference Files" table added in Change 1. No replacement text needed here -- just delete the section.

---

## Change 8: Keep "Tech Stack" Inline in Project Overview

No change needed. The current compact format on line 9 is good:

```
**Stack:** Next.js 16.1.6, React 19, TypeScript 5.x (strict), Prisma 7.4.1, Tailwind CSS 4.x, Zod 4.x, Vitest 4.x, Playwright 1.58.x. Requires Node.js >=18.0.0.
```

---

## Final Document Structure (Outline)

After all changes, CLAUDE.md should have this structure:

```
# CLAUDE.md
  (intro line)

## Project Overview
  (2 lines: description + stack)

## Key Reference Files
  (table: 7 rows)

## App Location
  (2 lines + code block)

## Project Structure
  (15-line ASCII tree)

## Development Commands
  (existing, unchanged -- ~44 lines)

## Conventions
  (merged section -- ~20 lines covering task tracking, workflow, TypeScript,
   HIPAA, business rules, git, forms, Stripe)

## Architecture
  ### Route Groups & App Structure
    (existing minus orphaned (patient) note -- ~18 lines)
  ### Middleware
    (existing, unchanged -- ~6 lines)
  ### Key Architectural Patterns
    (existing minus Forms and Zod v4 paragraphs -- ~20 lines)

## Environment Setup
  (compact 3-line quick-start + pointer to asset_manifest.md)

## Deployment
  (existing, unchanged -- ~6 lines)
```

**Estimated final size:** ~170-180 lines, ~5.5-6.5 KB

---

## What Moved Where

| Content | Removed From CLAUDE.md | Now Lives In |
|---------|----------------------|--------------|
| Key Library Modules (20 lines) | Architecture section | `build_instructions.md` Section "Architecture Reference" |
| Environment Setup details (24 lines) | Environment Setup | `asset_manifest.md` Section 1 |
| Documentation references (8 lines) | Documentation section | Key Reference Files table (Change 1) |
| Forms + Zod convention (2 paragraphs) | Key Architectural Patterns | Conventions section (merged) |
| (patient) orphan note (2 lines) | Route Groups | Deleted (no longer true per P2) |
| Business Rules (6 lines) | Standalone section | Conventions section (1-line summary) |
| HIPAA rules (10 lines) | Standalone section | Conventions section (2-line summary) |
| TypeScript conventions (4 lines) | Standalone section | Conventions section (1-line summary) |
| Git conventions (5 lines) | Standalone section | Conventions section (2-line summary) |
| Workflow preferences (3 lines) | Standalone section | Conventions section (2-line summary) |
| Bug fixing rules (3 lines) | Standalone section | Conventions section (1 line) |

**Total lines removed:** ~95
**Total lines added:** ~50 (Key Reference Files table + Project Structure + Conventions + compact env setup)
**Net change:** ~-45 lines (shrinks as intended)

---

## Validation Checklist

Before applying, verify:
- [ ] tasks.md exists at `dev-setup/rimalhealth/tasks.md`
- [ ] build_instructions.md exists at `dev-setup/rimalhealth/build_instructions.md`
- [ ] context_brief.md exists at `dev-setup/rimalhealth/context_brief.md`
- [ ] asset_manifest.md exists at `dev-setup/rimalhealth/asset_manifest.md`
- [ ] skills_matrix.md exists at `dev-setup/rimalhealth/skills_matrix.md`
- [ ] trace.md exists at `dev-setup/rimalhealth/trace.md`
- [ ] Key Library Modules content has been incorporated into build_instructions.md before removing from CLAUDE.md
- [ ] `app/(patient)/` directory confirmed non-existent (P2 verified)

---

*This spec should be applied by the PM after all other E-Team deliverables are complete, since CLAUDE.md references documents that must exist first.*
