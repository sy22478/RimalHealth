# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Rimal Health** is a HIPAA-compliant telehealth platform for medication-assisted treatment of alcohol use disorder (AUD) with Naltrexone, serving California residents. Flat-fee pricing: $50/month active treatment, $25/month maintenance.

## App Location

All application code lives in:
```
premium-telehealth-website/my-app/
```

All commands should be run from this directory.

## Development Commands

```bash
cd premium-telehealth-website/my-app

# Development
npm run dev              # Start dev server (http://localhost:3000)
npm run dev:turbo        # Dev server with Turbopack (faster)
npm run build            # Production build
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

## Architecture

### Route Groups & App Structure

The app uses Next.js App Router with route groups for layout isolation:

- `app/(marketing)/` — Public marketing site with shared nav/footer (homepage, about, pricing, FAQ, contact, alcohol-treatment, how-it-works, privacy, terms, hipaa, get-started, payment)
- `app/(auth)/` — Auth pages: `/login`, `/signup` (minimal layout, no nav)
- `app/patient/` — Patient portal with sidebar layout (`/patient/*`): dashboard, messages, prescriptions, billing, documents, profile/settings
  - **Note:** `app/(patient)/` also exists but is orphaned — it resolves WITHOUT the `/patient/` prefix. Always use `app/patient/` for patient portal work.
- `app/physician/` — Physician portal, split into sub-groups:
  - `physician/(auth)/login/` — Physician login (no layout)
  - `physician/(portal)/` — Auth-protected portal with sidebar: dashboard, queue, patients, intake/[id], prescriptions, messages, reviews, settings
- `app/admin/` — Admin portal: physician management
- `app/intake/` — Intake form flow and success page
- `app/checkout/` — Payment/checkout flow (payment, success, cancel pages)
- `app/api/` — API routes organized by role:
  - `api/auth/` — login, register, logout, refresh, forgot/reset-password, physician verify-key
  - `api/patient/` — intake, profile, prescriptions, messages, documents, billing, onboarding
  - `api/physician/` — queue, review, patients, prescriptions, messages, pharmacies, stats, dashboard
  - `api/admin/physicians/` — CRUD + authorize/suspend/reject/reactivate/reset-key
  - `api/stripe/` — checkout-session, customer-portal, subscription
  - `api/webhooks/` — stripe, dosespot
  - `api/health/` — health check endpoint

### Middleware (middleware.ts)

Route protection runs in `middleware.ts`. The middleware:
- Extracts JWT from `Authorization: Bearer` header (priority) or `accessToken` cookie
- Enforces role-based route access: `/patient/*` → PATIENT, `/physician/*` → PHYSICIAN, `/admin/*` → ADMIN
- Redirects unauthenticated users to `/login?from=<path>`
- Redirects unauthorized users to `/unauthorized`
- Injects `x-user-id`, `x-user-role`, `x-user-email` headers for downstream API routes

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

### Key Architectural Patterns

**Tailwind v4** — No `tailwind.config.js`; all theme tokens defined in `app/globals.css` under `@theme inline`. Brand colors: `navy` (primary dark, `#0A2540`) and `ocean` (accent blue, `#0284C7`). Use `btn-primary` and other `@layer components` classes rather than raw utility classes.

**PHI Encryption** — All personally identifiable health data must be encrypted at the field level using `encryptPHI()`/`decryptPHI()` from `lib/encryption/phi.ts`. The Prisma extension in `lib/db/encryption-extension.ts` handles this automatically for marked fields.

**Auth flow** — Custom JWT (not NextAuth). Access tokens expire in 15 minutes, refresh tokens in 7 days. Three roles: `PATIENT`, `PHYSICIAN`, `ADMIN`. API routes use `requireAuth`, `requirePermission`, `requireRole`, or `withPermission` HOF from `lib/auth/require-auth.ts`. See `lib/auth/rbac.ts` for the full `Permission` enum and role matrix.

**Audit Logging** — Every PHI access must call `auditLogger.logPHIAccess(...)` or `auditLogger.logAuth(...)`. Import the singleton from `lib/audit`. The logger never throws — it silently falls back to console on DB failure.

**Forms** — Always use React Hook Form + Zod. Import `zodResolver` from `@hookform/resolvers/zod`.

**Third-party integrations** — DoseSpot for e-prescriptions (has a mock at `lib/integrations/dosespot.mock.ts` for dev), Stripe for subscriptions/billing, S3 for document storage, SendGrid for email, Twilio for SMS.

**Patient flow (payment-first)** — Landing CTA → `/checkout/payment` (no signup required) → Stripe checkout → webhook auto-creates User (PATIENT, random password) + PatientProfile + Subscription → "Set Password" email sent → patient sets password at `/set-password` → login → intake form → physician notified. The public checkout uses `POST /api/stripe/public-checkout-session` (no auth). The Stripe webhook handler at `app/api/webhooks/stripe/route.ts` orchestrates user creation.

**Zod v4** — Project uses Zod 4.x. Use `{ message: '...' }` for error messages, not `{ required_error: '...' }` (Zod v3 syntax).

## TypeScript Conventions

- Strict mode enabled — no `any` without justification
- Explicit return types on all functions
- `interface` for object shapes, `type` for unions/primitives
- `'use client'` directive required for components using hooks or browser APIs

## HIPAA / Security Rules

**Never:**
- Log PHI to console or files
- Include PHI in error messages, URLs, or JWT tokens
- Store PHI unencrypted in the database
- Cache PHI in browser storage (localStorage, sessionStorage, cookies)

**PHI fields** (must be encrypted): name, date of birth, address, phone, email, medical history, medications, intake form data, messages, prescription details.

**API security:** Validate JWT on every protected route, use Zod for all input validation, rate limit auth endpoints (5 req/15 min), include CSRF protection on forms.

## Business Rules

1. Service restricted to California residents only
2. Intake review begins only after payment is confirmed
3. Physicians respond within 24 hours (async messaging, no real-time chat)
4. All physicians see all patients (no assignment restrictions)
5. Refill requests allowed 7 days before medication runs out
6. Patient can only have one active intake at a time

## Environment Setup

```bash
cp .env.example .env.local
# Required: NEXT_PUBLIC_APP_URL, DATABASE_URL, JWT_SECRET, PHI_ENCRYPTION_KEY (ENCRYPTION_KEY)
# Optional: RESEND_API_KEY, STRIPE_SECRET_KEY, NEXT_PUBLIC_GA_MEASUREMENT_ID
```

Database options for local dev: Neon (cloud), Postgres.app, or Homebrew PostgreSQL. After setting `DATABASE_URL`, run `npm run db:generate && npm run db:migrate`.

### Docker Development
```bash
docker-compose -f docker/docker-compose.yml up -d    # Start PostgreSQL + Redis + app
docker-compose -f docker/docker-compose.yml logs -f app  # View logs
docker-compose -f docker/docker-compose.yml down      # Stop services
```

## Deployment

Deployed to **Netlify** via GitHub Actions. Push to `main` triggers the deployment workflow (lint, type-check, tests, security scan, build, deploy, migrations, health check, smoke tests).

Domain `rimalhealth.com` is registered on SiteGround.

## Git Conventions

Branch naming: `feature/`, `fix/`, `docs/`, `test/`, `refactor/`, `security/`

Commit prefixes: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `security:`

Never commit `.env` files, real patient data, database dumps, or log files containing PHI.

## Documentation

Detailed documentation is in `premium-telehealth-website/`:
- `docs/api-spec.md` — API endpoint specifications
- `docs/security-audit-report.md` — Security audit findings
- `PROJECT.md` — Vision, business model, requirements
- `PLAN.md` — Implementation tasks and phases
- `STATE.md` — Current implementation status
