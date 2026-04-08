# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Rimal Health** is a HIPAA-compliant telehealth platform for medication-assisted treatment of alcohol use disorder (AUD) with Naltrexone, serving California residents. Flat-fee pricing: $50/month.

**Stack:** Next.js 16.1.6, React 19, TypeScript 5.x (strict), Prisma 7.4.1, Tailwind CSS 4.x, Zod 4.x, Vitest 4.x, Playwright 1.58.x. Requires Node.js >=18.0.0.

## App Location

All application code lives in `premium-telehealth-website/my-app/`. All commands should be run from this directory.

## Development Commands

```bash
cd premium-telehealth-website/my-app

npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Production build
npm run type-check       # TypeScript check (no emit)
npm run lint             # Run ESLint
npm test                 # Run all tests (vitest)
npm run test:unit        # Unit tests only
npm run test:e2e         # Playwright E2E tests

# Run a single test file
npx vitest run tests/unit/path/to/file.test.ts

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run dev migrations
npm run db:studio        # Open Prisma Studio
```

## Conventions

**Workflow:**
- Act quickly -- implement directly when the task is clear. Avoid excessive planning.
- Before fixing a bug, verify the root cause. Check env vars, API URLs, middleware config first.

**Code Review — Mandatory Runtime Verification:**
- NEVER conduct a code review using only static code analysis. Always run the app and test affected user flows.
- Verify all API endpoints exist and return correct data shapes.
- Use `Array.isArray()` before calling `.map()` on any data from JSON columns or API responses.
- Every `.catch()` block must log the error — never use `.catch(() => {})`.
- After fixes, run `npm run type-check` and verify 0 errors before claiming work is complete.

**Imports:** Use `@/` path alias for all imports (maps to `premium-telehealth-website/my-app/`).

**TypeScript:** Strict mode, explicit return types, `interface` for objects, `type` for unions. `'use client'` required for hooks/browser APIs. No `any` without justification.

**HIPAA -- NEVER:** log PHI, include PHI in error messages/URLs/JWTs, store PHI unencrypted, cache PHI in browser storage.

**Business rules:** California-only. Payment before intake review. Physician 24h async response. All physicians see all patients. One active intake per patient. Refills available 7 days before end.

**Git:** Branch prefixes: `feature/`, `fix/`, `docs/`, `test/`, `refactor/`, `security/`. Commit prefixes: `feat:`, `fix:`, `docs:`, etc. Never commit `.env`, patient data, DB dumps, or PHI logs.

**Forms:** React Hook Form + Zod + `zodResolver`. Zod v4 syntax: `{ message: '...' }` not `{ required_error: '...' }`.

**shadcn/ui:** Style is "new-york". Add components with `npx shadcn add <component>`. Components land in `components/ui/`.

**Tailwind v4:** No `tailwind.config.js`; all theme tokens in `app/globals.css` under `@theme inline`. Brand colors: `navy` (#0A2540) and `ocean` (#0284C7). Use `btn-primary` and other `@layer components` classes.

## Architecture

### Route Groups

- `app/(marketing)/` -- Public marketing site with shared nav/footer
- `app/(auth)/` -- Login, signup (minimal layout, no nav)
- `app/patient/` -- Patient portal with sidebar layout
- `app/physician/` -- Physician portal: `(auth)/login/` (no layout) + `(portal)/*` (sidebar)
- `app/admin/` -- Admin portal: physician management
- `app/intake/` -- Intake form flow
- `app/checkout/` -- Payment flow (consent, payment, success, cancel)
- `app/api/` -- API routes by role: auth/, patient/, physician/, admin/, stripe/, webhooks/

### Middleware (middleware.ts)

- Extracts JWT from `Authorization: Bearer` header or `accessToken` cookie
- Enforces role-based route access: `/patient/*` -> PATIENT, `/physician/*` -> PHYSICIAN, `/admin/*` -> ADMIN
- Redirects unauthenticated to `/login?from=<path>`, unauthorized to `/unauthorized`
- Injects `x-user-id`, `x-user-role`, `x-user-email` headers for API routes
- Runs at Edge — cannot use Prisma directly

### Auth Flow

Custom JWT (not NextAuth). Access tokens: 15 min, refresh tokens: 7 days. Three roles: PATIENT, PHYSICIAN, ADMIN. API routes use `requireAuth`/`requireRole`/`requirePermission` from `lib/auth/require-auth.ts`.

### Patient Flow (payment-first)

Landing CTA -> `/checkout/consent` (8 checkboxes + 42 CFR Part 2) -> Stripe payment -> Receipt + "Create Account" email -> `/create-account` -> Email verification -> Login (emailVerified enforced) -> Intake gate in patient layout -> 34-question DSM-5 intake form -> Dashboard.

## Environment Setup

```bash
cp .env.example .env.local   # Then fill in DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY
npm run db:generate && npm run db:migrate
```

## Deployment

Deployed to **Netlify** via GitHub Actions. Domain `rimalhealth.com` on SiteGround.
- Local deploy: `netlify deploy --prod` from `premium-telehealth-website/my-app/`
- `ignoreBuildErrors = false` -- type errors fail the build. Always run `npm run type-check` first.
- Turbopack can't resolve barrel exports -- use explicit `/index` imports or deploy locally.
