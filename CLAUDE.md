# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Rimal Health** is a HIPAA-compliant telehealth platform for medication-assisted treatment of alcohol use disorder (AUD) with Naltrexone, serving California residents. Flat-fee pricing: $50/month active treatment, $25/month maintenance.

**Stack:** Next.js 16.1.6, React 19, TypeScript 5.x (strict), Prisma 7.4.1, Tailwind CSS 4.x, Zod 4.x, Vitest 4.x, Playwright 1.58.x. Requires Node.js >=18.0.0.

## Key Reference Files

| Document | Location | Purpose |
|----------|----------|---------|
| session_handoff.md | `dev-setup/rimalhealth/session_handoff.md` | Cross-session state -- read first for context continuity |
| tasks.md | `dev-setup/rimalhealth/tasks.md` | Active work tracker -- read before starting work |
| build_instructions.md | `dev-setup/rimalhealth/build_instructions.md` | How to add features, fix bugs, deploy |
| context_brief.md | `dev-setup/rimalhealth/context_brief.md` | Domain knowledge, HIPAA rules, business logic |
| asset_manifest.md | `dev-setup/rimalhealth/asset_manifest.md` | Env vars, integrations, infra inventory |
| skills_matrix.md | `dev-setup/rimalhealth/skills_matrix.md` | 8 teams (A-H), 29 skills, MCP audit, PM deployment guide |
| trace.md | `dev-setup/rimalhealth/trace.md` | Cross-session audit trail |
| Team F design | `dev-setup/rimalhealth/team_f_code_review.md` | Code Review team: HIPAA, quality, security scanning |
| Team G design | `dev-setup/rimalhealth/team_g_debugging.md` | Debugging team: integration, data integrity, runtime |
| Team H design | `dev-setup/rimalhealth/team_h_architecture.md` | Architecture team: infra, app structure, compliance |
| Prisma schema | `premium-telehealth-website/my-app/prisma/schema.prisma` | 18 models, 17 enums -- authoritative data model |
| conversation.md | `dev-setup/rimalhealth/conversation.md` | Session log for cross-team context |
| compliance_42cfr2.md | `dev-setup/rimalhealth/compliance_42cfr2.md` | 42 CFR Part 2 compliance plan |

## App Location

All application code lives in:
```
premium-telehealth-website/my-app/
```

All commands should be run from this directory.

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

## Development Commands

```bash
cd premium-telehealth-website/my-app

# Development
npm run dev              # Start dev server (http://localhost:3000)
npm run dev:turbo        # Dev server with Turbopack (faster)
npm run build            # Production build
npm start                # Start production server (after build)
npm run build:analyze    # Production build with bundle analyzer
npm run lint             # Run ESLint
npm run lint:fix         # Auto-fix lint issues
npm run type-check       # TypeScript check (no emit)
npm run format           # Prettier format all files
npm run clean            # Remove .next and node_modules cache

# Testing
npm test                              # Run all tests (vitest)
npm run test:unit                     # Unit tests only (tests/unit/ and lib/*.test.ts)
npm run test:integration              # Integration tests only (tests/integration/)
npm run test:watch                    # Watch mode
npm run test:coverage                 # With coverage report
npm run test:e2e                      # Playwright E2E tests
npm run test:e2e:ui                   # Playwright with interactive UI
npm run test:e2e:debug                # Playwright in debug mode
npm run test:smoke                    # Smoke tests (scripts/smoke-test.ts)
npm run test:perf                     # Performance tests (scripts/performance-test.ts)

# Run a single test file
npx vitest run tests/unit/path/to/file.test.ts
# Run a single test by name pattern
npx vitest run --reporter=verbose -t "test name pattern"
# Note: vitest globals enabled -- describe/it/expect available without imports
# Tests also live in lib/**/*.test.ts (co-located with source)

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run dev migrations
npm run db:deploy        # Deploy migrations (production)
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed database (scripts/seed.ts)
npm run db:validate      # Validate Prisma schema
npm run db:format        # Format Prisma schema

# Ops
npm run cache:clear      # Clear Redis cache (scripts/clear-cache.ts)
npm run security:audit   # npm audit + fix
npm run health-check     # Run health check script
```

## Conventions

**Task tracking:**
- Read `dev-setup/rimalhealth/tasks.md` first before starting work.
- Update tasks.md when work completes (check off items, add notes).

**Workflow:**
- Act quickly -- implement directly when the task is clear. Avoid excessive planning.
- Do not make changes beyond what was requested.
- Before fixing a bug, verify the root cause. Check env vars, API URLs, middleware config first.

**Code Review — Mandatory Runtime Verification:**
- NEVER conduct a code review using only static code analysis. Always run the app (`npm run dev`) and test affected user flows in a browser.
- For every page changed, open it in Chrome with DevTools Console + Issues tabs open. Fix any errors/warnings.
- Verify all API endpoints exist and return correct data shapes by testing with `fetch()` or curl.
- Use `Array.isArray()` before calling `.map()` on any data from JSON columns or API responses.
- Every `.catch()` block must log the error — never use `.catch(() => {})`.
- After fixes, run `npm run type-check` and verify 0 errors before claiming work is complete.

**Imports:** Use `@/` path alias for all imports (maps to project root `premium-telehealth-website/my-app/`). Example: `import { cn } from '@/lib/utils'`.

**TypeScript:** Strict mode, explicit return types, `interface` for objects, `type` for unions. `'use client'` required for hooks/browser APIs. No `any` without justification.

**HIPAA -- NEVER:** log PHI, include PHI in error messages/URLs/JWTs, store PHI unencrypted, cache PHI in browser storage. PHI fields (name, DOB, address, phone, medical data, messages, prescriptions) must use `encryptPHI()`/`decryptPHI()`.

**Business rules:** California-only. Payment before intake review. Physician 24h async response. All physicians see all patients. One active intake per patient. Refills available 7 days before end.

**Git:** Branch prefixes: `feature/`, `fix/`, `docs/`, `test/`, `refactor/`, `security/`. Commit prefixes: `feat:`, `fix:`, `docs:`, etc. Never commit `.env`, patient data, DB dumps, or PHI logs.

**Forms:** React Hook Form + Zod + `zodResolver`. Zod v4 syntax: `{ message: '...' }` not `{ required_error: '...' }`.

**shadcn/ui:** Style is "new-york". Add components with `npx shadcn add <component>`. Components land in `components/ui/`. Uses Radix primitives + Tailwind.

**Stripe:** Validate API params against current Stripe API version (`2026-01-28.clover`) before deploying. Auth components must be wrapped in AuthProvider.

## Architecture

### Route Groups & App Structure

The app uses Next.js App Router with route groups for layout isolation:

- `app/(marketing)/` -- Public marketing site with shared nav/footer (homepage, about, pricing, FAQ, contact, alcohol-treatment, how-it-works, privacy, terms, hipaa, get-started, payment)
- `app/(auth)/` -- Auth pages: `/login`, `/signup` (minimal layout, no nav)
- `app/patient/` -- Patient portal with sidebar layout (`/patient/*`): dashboard, messages, prescriptions, billing, documents, profile/settings
- `app/physician/` -- Physician portal, split into sub-groups:
  - `physician/(auth)/login/` -- Physician login (no layout)
  - `physician/(portal)/` -- Auth-protected portal with sidebar: dashboard, queue, patients, intake/[id], prescriptions, messages, reviews, settings
- `app/admin/` -- Admin portal: physician management
- `app/intake/` -- Intake form flow and success page
- `app/checkout/` -- Payment/checkout flow (consent, payment, success, cancel pages)
- `app/api/` -- API routes organized by role: auth/, patient/, physician/, admin/, stripe/, webhooks/, health/

### Middleware (middleware.ts)

Route protection runs in `middleware.ts`. The middleware:
- Extracts JWT from `Authorization: Bearer` header (priority) or `accessToken` cookie
- Enforces role-based route access: `/patient/*` -> PATIENT, `/physician/*` -> PHYSICIAN, `/admin/*` -> ADMIN
- Redirects unauthenticated users to `/login?from=<path>`
- Redirects unauthorized users to `/unauthorized`
- Injects `x-user-id`, `x-user-role`, `x-user-email` headers for downstream API routes

### Key Architectural Patterns

**Tailwind v4** -- No `tailwind.config.js`; all theme tokens defined in `app/globals.css` under `@theme inline`. Brand colors: `navy` (primary dark, `#0A2540`) and `ocean` (accent blue, `#0284C7`). Use `btn-primary` and other `@layer components` classes rather than raw utility classes.

**PHI Encryption** -- All personally identifiable health data must be encrypted at the field level using `encryptPHI()`/`decryptPHI()` from `lib/encryption/phi.ts`. The Prisma extension in `lib/db/encryption-extension.ts` handles this automatically for marked fields.

**Auth flow** -- Custom JWT (not NextAuth). Access tokens expire in 15 minutes, refresh tokens in 7 days. Three roles: `PATIENT`, `PHYSICIAN`, `ADMIN`. API routes use `requireAuth`, `requirePermission`, `requireRole`, or `withPermission` HOF from `lib/auth/require-auth.ts`. See `lib/auth/rbac.ts` for the full `Permission` enum and role matrix.

**Audit Logging** -- Every PHI access must call `auditLogger.logPHIAccess(...)` or `auditLogger.logAuth(...)`. Import the singleton from `lib/audit`. The logger never throws -- it silently falls back to console on DB failure.

**Server Components with DB** -- Admin pages or any server component running Prisma queries need `export const dynamic = 'force-dynamic'` to avoid Next.js static generation errors.

**React Compiler** -- Disabled in `next.config.ts` due to incompatibility with react-hook-form's `watch`/`setValue` pattern. Do not re-enable without verifying RHF compatibility.

**Third-party integrations** -- Stripe for subscriptions/billing, S3 for document storage, SendGrid for email, Twilio for SMS. DoseSpot e-prescribing is **on hold** (evaluating alternatives); mock available at `lib/integrations/dosespot.mock.ts`.

**Patient flow (payment-first, with email verification and intake gate)** -- Landing CTA -> `/checkout/consent` (7 checkboxes + 42 CFR Part 2) -> Stripe payment -> Receipt email + "Create Account" email -> `/create-account` (token-based, set password) -> Email verification (`/verify-email`) -> Login (emailVerified enforced for PATIENT) -> Intake gate in patient layout (server component) -> 34-question DSM-5 intake form -> Dashboard. The public checkout uses `POST /api/stripe/public-checkout-session` (no auth). The Stripe webhook handler at `app/api/webhooks/stripe/route.ts` orchestrates user creation in a `prisma.$transaction()`. See `dev-setup/rimalhealth/context_brief.md` "App Flow" section for the full authoritative flow.

## Environment Setup

```bash
cp .env.example .env.local   # Then fill in DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY
npm run db:generate && npm run db:migrate
```

Full env var inventory with status: see `dev-setup/rimalhealth/asset_manifest.md`.

## Deployment

Deployed to **Netlify** via GitHub Actions. Push to `main` triggers the deployment workflow (lint, type-check, tests, security scan, build, deploy, migrations, health check, smoke tests). Domain `rimalhealth.com` is registered on SiteGround.

- Always check that all required env vars (`STRIPE_PRICE_ACTIVE_TREATMENT`, `SENDGRID_API_KEY`, etc.) are set in Netlify before deploying.
- After deploying, verify the live URL is not a cached/stale deploy.
- Prefer local Netlify deploys (`netlify deploy --prod`) when CI has persistent framework-level bugs.
- Turbopack in CI can't resolve barrel exports (`@/lib/audit`). Use explicit `/index` imports or deploy locally.
- `next.config.ts` has `typescript.ignoreBuildErrors = false` -- type errors will fail the build. Always run `npm run type-check` before deploying.
