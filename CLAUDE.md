# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Rimal Health** is a HIPAA-compliant telehealth platform for medication-assisted treatment of alcohol use disorder (AUD) with Naltrexone, serving California residents. Flat-fee pricing: $50/month active treatment, $25/month maintenance.

**Stack:** Next.js 16.1.6, React 19, TypeScript 5.x (strict), Prisma 7.4.1, Tailwind CSS 4.x, Zod 4.x, Vitest 4.x, Playwright 1.58.x. Requires Node.js >=18.0.0.

## App Location

All application code lives in `premium-telehealth-website/my-app/`. **All commands must be run from this directory.**

## Development Commands

```bash
cd premium-telehealth-website/my-app

# Development
npm run dev              # Start dev server (http://localhost:3000)
npm run dev:turbo        # Dev server with Turbopack (faster)
npm run build            # Production build
npm run type-check       # TypeScript check (no emit) — run before deploying
npm run lint             # ESLint (uses NODE_OPTIONS='--max-old-space-size=4096')
npm run lint:fix         # Auto-fix lint issues
npm run format           # Prettier format all files

# Testing
npm test                 # Run all tests (vitest)
npm run test:unit        # Unit tests only (vitest.unit.config.ts)
npm run test:integration # Integration tests only (vitest.integration.config.ts)
npm run test:watch       # Watch mode
npm run test:coverage    # With v8 coverage report
npm run test:e2e         # Playwright E2E tests

# Run a single test file
npx vitest run tests/unit/path/to/file.test.ts
# Run a single test by name pattern
npx vitest run --reporter=verbose -t "test name pattern"

# Database (Prisma)
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run dev migrations
npm run db:deploy        # Deploy migrations (production)
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed database (scripts/seed.ts)
```

## Testing Details

- Vitest globals enabled — `describe`/`it`/`expect` available without imports
- Test files live in `tests/unit/`, `tests/integration/`, and co-located as `lib/**/*.test.ts`
- Test environment: `node` (not jsdom). 30s timeout for DB operations. Pool: `forks`
- Three vitest configs: `vitest.config.ts` (all), `vitest.unit.config.ts`, `vitest.integration.config.ts`
- Path aliases (`@/`) are mirrored in vitest config `resolve.alias`
- E2E tests use Playwright (`playwright.config.ts`)

## Project Structure

```
premium-telehealth-website/my-app/
  app/
    (marketing)/     # Public pages (homepage, pricing, FAQ, etc.)
    (auth)/          # Login, signup, forgot-password, set-password
    patient/         # Patient portal (dashboard, billing, messages, etc.)
    physician/       # Physician portal, split into (auth)/ and (portal)/ sub-groups
    admin/           # Admin portal (physician management)
    intake/          # Intake form flow
    checkout/        # Payment flow (consent, payment, success, cancel)
    api/             # API routes by role: auth/, patient/, physician/, admin/, stripe/, webhooks/, health/
  components/        # UI components: physician/, patient/, forms/, ui/, layout/, a11y/, marketing/
  lib/               # Core logic (see below)
  hooks/             # Custom React hooks
  types/             # TypeScript type definitions
  prisma/            # Schema + migrations
  tests/             # Unit, integration, E2E tests
  scripts/           # Utility scripts (seed, smoke-test, deploy, etc.)
```

### Key lib/ Modules

| Module | Purpose |
|--------|---------|
| `auth/` | JWT (custom, not NextAuth), passwords (bcrypt 12 rounds), RBAC (`rbac.ts` has Permission enum + role matrix), route guards (`require-auth.ts`: `requireAuth`, `requireRole`, `requirePermission`, `withPermission`) |
| `db/` | Prisma client, `encryption-extension.ts` (auto-encrypts marked PHI fields) |
| `encryption/` | `phi.ts` — `encryptPHI()`/`decryptPHI()` (AES-256-GCM) |
| `audit/` | Singleton `auditLogger` — `logPHIAccess()`, `logAuth()`, `logDisclosure()`. Never throws; falls back to console on DB failure |
| `security/` | CSRF tokens, rate limiting (memory fallback), input sanitization |
| `stripe/` | Stripe utilities. API version: `2026-01-28.clover` |
| `integrations/` | S3, SendGrid, Twilio, DoseSpot (mock only — `dosespot.mock.ts`) |
| `intake/` | DSM-5 scoring functions, intake form logic |
| `compliance/` | 42 CFR Part 2 consent management, disclosure tracking |
| `redis/` | Redis client, sessions, cache |
| `constants.ts` | Site config, security headers (used by `next.config.ts`) |

## Architecture

### Middleware (`middleware.ts`)

Route protection at the edge:
- Extracts JWT from `Authorization: Bearer` header (priority) or `accessToken` cookie
- Auto-refreshes expired access tokens using refresh tokens
- Role-based route enforcement: `/patient/*` → PATIENT, `/physician/*` → PHYSICIAN, `/admin/*` → ADMIN
- Injects `x-user-id`, `x-user-role`, `x-user-email`, `x-request-id` headers for downstream API routes
- Redirects: unauthenticated → `/login?from=<path>`, unauthorized → `/unauthorized`
- Public routes (marketing, checkout, auth pages) bypass authentication

### Auth Flow

Custom JWT — access tokens expire in 15 minutes, refresh tokens in 7 days. Three roles: `PATIENT`, `PHYSICIAN`, `ADMIN`. MFA (TOTP via `otpauth`) is enabled for both physicians and patients.

### Patient Flow (payment-first)

Landing CTA → `/checkout/consent` (8 checkboxes including 42 CFR Part 2) → Stripe payment → Receipt + "Create Account" emails → `/create-account` (token-based password set) → Email verification (`/verify-email`) → Login → Intake gate (server component checks for completed intake) → 34-question DSM-5 intake form → Dashboard.

The public checkout uses `POST /api/stripe/public-checkout-session` (no auth). The Stripe webhook at `app/api/webhooks/stripe/route.ts` orchestrates user creation in a `prisma.$transaction()` with deduplication via `WebhookEvent` model.

### Physician Portal

Split layout: `physician/(auth)/login/` (no layout) and `physician/(portal)/` (sidebar). Physicians see all patients, review intakes with DSM-5 scoring display, send prescriptions, and message patients.

### Key Patterns

**Tailwind v4** — No `tailwind.config.js`; theme tokens in `app/globals.css` under `@theme inline`. Brand colors: `navy` (`#0A2540`), `ocean` (`#0284C7`). Use `btn-primary` and `@layer components` classes.

**PHI Encryption** — Field-level encryption via `encryptPHI()`/`decryptPHI()`. The Prisma extension in `lib/db/encryption-extension.ts` auto-encrypts/decrypts marked fields. PHI fields: name, DOB, address, phone, medical data, messages, prescriptions.

**Server Components with DB** — Any server component running Prisma queries needs `export const dynamic = 'force-dynamic'` to avoid Next.js static generation errors.

**React Compiler** — Disabled in `next.config.ts` due to incompatibility with react-hook-form's `watch`/`setValue`. Do not re-enable without testing RHF compatibility.

**Audit Logging** — Every PHI access must call `auditLogger.logPHIAccess(...)` or `auditLogger.logAuth(...)`. Import from `lib/audit`.

## Conventions

**Imports:** Use `@/` path alias for all imports (maps to `premium-telehealth-website/my-app/`).

**TypeScript:** Strict mode. Explicit return types. `interface` for objects, `type` for unions. `'use client'` required for hooks/browser APIs. No `any` without justification.

**Forms:** React Hook Form + Zod + `zodResolver`. Zod v4 syntax: `{ message: '...' }` not `{ required_error: '...' }`.

**shadcn/ui:** Style is "new-york". Add with `npx shadcn add <component>`. Components in `components/ui/`.

**HIPAA — NEVER:** log PHI, include PHI in error messages/URLs/JWTs, store PHI unencrypted, cache PHI in browser storage.

**Business rules:** California-only. Payment before intake review. Physician 24h async response. All physicians see all patients. One active intake per patient. Refills available 7 days before end.

**Git:** Branch prefixes: `feature/`, `fix/`, `docs/`, `test/`, `refactor/`, `security/`. Commit prefixes: `feat:`, `fix:`, `docs:`, etc. Never commit `.env`, patient data, DB dumps, or PHI logs.

**Stripe:** Validate API params against version `2026-01-28.clover` before deploying.

## Environment Setup

```bash
cp .env.example .env.local   # Then fill in DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY
npm install
npm run db:generate && npm run db:migrate
```

Key env vars: `DATABASE_URL` (Neon PostgreSQL with pooling), `JWT_SECRET` (64 hex chars), `PHI_ENCRYPTION_KEY` (32-byte base64), `REDIS_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENDGRID_API_KEY`, `AWS_S3_BUCKET_NAME`.

Full env var inventory: `dev-setup/rimalhealth/asset_manifest.md`.

## Deployment

Deployed to **Netlify** via GitHub Actions. Push to `main` triggers: lint → type-check → tests → security scan → build → deploy → migrations → health check → smoke tests.

- `typescript.ignoreBuildErrors = false` in `next.config.ts` — type errors fail the build
- Turbopack in CI can't resolve barrel exports (`@/lib/audit`). Use explicit `/index` imports or deploy locally
- Prefer `netlify deploy --prod` when CI has persistent framework-level bugs

## Key Reference Files

| Document | Location | Purpose |
|----------|----------|---------|
| session_handoff.md | `dev-setup/rimalhealth/session_handoff.md` | Cross-session state — read first for context continuity |
| tasks.md | `dev-setup/rimalhealth/tasks.md` | Active work tracker — read before starting work |
| build_instructions.md | `dev-setup/rimalhealth/build_instructions.md` | How to add features, fix bugs, deploy |
| context_brief.md | `dev-setup/rimalhealth/context_brief.md` | Domain knowledge, HIPAA rules, business logic |
| asset_manifest.md | `dev-setup/rimalhealth/asset_manifest.md` | Env vars, integrations, infra inventory |
| compliance_42cfr2.md | `dev-setup/rimalhealth/compliance_42cfr2.md` | 42 CFR Part 2 compliance plan |
| Prisma schema | `premium-telehealth-website/my-app/prisma/schema.prisma` | Authoritative data model |
