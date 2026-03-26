# RimalHealth -- Asset Manifest

> **Purpose:** Complete inventory of infrastructure, integrations, environment, and resources
> **Last Updated:** 2026-03-25
> **Source of Truth:** This document inventories what EXISTS and its current STATUS.

---

## 1. Environment Variables

All env vars from `.env.example` plus undocumented ones found in source code (P2 analysis).

### 1.1 Application

| Variable | Required? | Service | Default | Status |
|----------|-----------|---------|---------|--------|
| `NEXT_PUBLIC_APP_URL` | Yes | App | `https://rimalhealth.com` | Configured |
| `NEXT_PUBLIC_APP_NAME` | No | App | `"Rimal Health"` | Configured |
| `NEXT_PUBLIC_APP_VERSION` | No | App | None | Undocumented in .env.example |
| `NEXT_PUBLIC_SITE_URL` | No | App (metadata) | None | Undocumented in .env.example |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | No | Google Search Console | None | Undocumented in .env.example |

### 1.2 Database

| Variable | Required? | Service | Default | Status |
|----------|-----------|---------|---------|--------|
| `DATABASE_URL` | Yes (all envs) | Neon PostgreSQL | None | Configured |

### 1.3 Authentication

| Variable | Required? | Service | Default | Status |
|----------|-----------|---------|---------|--------|
| `JWT_SECRET` | Yes (all envs) | Auth (JWT) | None | Configured |
| `SESSION_SECRET` | No | Auth (CSRF) | None | Documented in .env.example |

### 1.4 Encryption

| Variable | Required? | Service | Default | Status |
|----------|-----------|---------|---------|--------|
| `ENCRYPTION_KEY` | Yes (all envs) | PHI encryption (`lib/hipaa/encryption.ts`) | None | Configured |
| `PHI_ENCRYPTION_KEY` | No | PHI encryption (`lib/encryption/phi.ts`) | None | Undocumented in .env.example -- uses hex format, separate from ENCRYPTION_KEY |
| `AUDIT_HASH_SALT` | No | Audit log hashing | None | Undocumented in .env.example |

**Warning:** Two separate encryption implementations exist with different key formats. `ENCRYPTION_KEY` uses base64; `PHI_ENCRYPTION_KEY` uses hex. See P2 Section 5.2.

### 1.5 Stripe (Payments)

| Variable | Required? | Service | Default | Status |
|----------|-----------|---------|---------|--------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes (prod) | Stripe | None | Configured |
| `STRIPE_SECRET_KEY` | Yes (prod) | Stripe | None | Configured |
| `STRIPE_WEBHOOK_SECRET` | Yes (prod) | Stripe | None | Configured |
| `STRIPE_PRICE_ACTIVE_TREATMENT` | Yes | Stripe | None | Configured |
| `STRIPE_PRICE_MAINTENANCE` | Yes | Stripe | None | Configured |
| `STRIPE_PRODUCT_ACTIVE_TREATMENT` | No | Stripe | None | Documented but NOT used in code |
| `STRIPE_PRODUCT_MAINTENANCE` | No | Stripe | None | Documented but NOT used in code |

### 1.6 SendGrid (Email)

| Variable | Required? | Service | Default | Status |
|----------|-----------|---------|---------|--------|
| `SENDGRID_API_KEY` | Yes (prod) | SendGrid | None | Configured |
| `SENDGRID_FROM_EMAIL` | No | SendGrid | `noreply@admin.rimalhealth.com` | Configured |
| `SENDGRID_FROM_NAME` | No | SendGrid | `Rimal Health` | Configured |

### 1.7 Twilio (SMS)

| Variable | Required? | Service | Default | Status |
|----------|-----------|---------|---------|--------|
| `TWILIO_ACCOUNT_SID` | No | Twilio | None | Not connected (code exists, no live integration) |
| `TWILIO_AUTH_TOKEN` | No | Twilio | None | Not connected |
| `TWILIO_PHONE_NUMBER` | No | Twilio | None | Not connected |

### 1.8 AWS S3 (Documents)

| Variable | Required? | Service | Default | Status |
|----------|-----------|---------|---------|--------|
| `AWS_ACCESS_KEY_ID` | No | S3 | None | Configured |
| `AWS_SECRET_ACCESS_KEY` | No | S3 | None | Configured |
| `AWS_S3_BUCKET_NAME` | No | S3 | `rimalhealth-documents` | Undocumented in .env.example (only AWS_REGION listed) |
| `AWS_REGION` | No | S3 | `us-east-1` | Configured |

### 1.9 DoseSpot (e-Prescribing)

| Variable | Required? | Service | Default | Status |
|----------|-----------|---------|---------|--------|
| `DOSESPOT_API_URL` | No | DoseSpot | `https://api-sandbox.dosespot.com` | Mock mode |
| `DOSESPOT_CLIENT_ID` | No | DoseSpot | None | Mock mode |
| `DOSESPOT_CLIENT_SECRET` | No | DoseSpot | None | Mock mode |
| `DOSESPOT_CLINIC_ID` | No | DoseSpot | None | Mock mode |
| `DOSESPOT_USER_ID` | No | DoseSpot | None | Mock mode |
| `DOSESPOT_MOCK_MODE` | No | DoseSpot | `false` | Set to `true` for dev |
| `DOSESPOT_TIMEOUT_MS` | No | DoseSpot | `30000` | Configured |
| `DOSESPOT_MAX_RETRIES` | No | DoseSpot | `3` | Configured |
| `DOSESPOT_RETRY_DELAY_MS` | No | DoseSpot | `1000` | Configured |

### 1.10 Redis

| Variable | Required? | Service | Default | Status |
|----------|-----------|---------|---------|--------|
| `REDIS_URL` | Yes (prod) | Redis | `redis://localhost:6379` | Configured |
| `REDIS_PASSWORD` | No | Redis | None | Undocumented in .env.example |
| `REDIS_TLS_ENABLED` | No | Redis | None | Undocumented in .env.example |

### 1.11 Google Analytics

| Variable | Required? | Service | Default | Status |
|----------|-----------|---------|---------|--------|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | No | Google Analytics 4 | None | Stub -- GA ID read but no GA script tag in layouts |

### 1.12 Feature Flags & Config

| Variable | Required? | Service | Default | Status |
|----------|-----------|---------|---------|--------|
| `NEXT_PUBLIC_ENABLE_INTAKE` | No | Feature flag | `true` | Configured |
| `REQUIRE_EMAIL_VERIFICATION` | No | Auth | `false` | Undocumented in .env.example |
| `REQUIRE_PAYMENT` | No | Intake submit | `true` in prod | Undocumented in .env.example |
| `DISABLE_API_CACHE` | No | API middleware | `false` | Undocumented in .env.example |
| `CONTACT_FORM_TO_EMAIL` | No | Contact form | `support@rimalhealth.com` | Documented |
| `ADMIN_EMAIL` | No | Admin alerts | None | Undocumented in .env.example |

### 1.13 Rate Limiting & HIPAA

| Variable | Required? | Service | Default | Status |
|----------|-----------|---------|---------|--------|
| `RATE_LIMIT_WINDOW_MS` | No | Security | `60000` | Documented |
| `RATE_LIMIT_MAX_REQUESTS` | No | Security | `100` | Documented |
| `RATE_LIMIT_UNAUTH_MAX_REQUESTS` | No | Security | `20` | Documented |
| `RATE_LIMIT_LOGIN_MAX_ATTEMPTS` | No | Security | `5` | Documented |
| `AUDIT_LOGGING_ENABLED` | No | HIPAA | `true` | Documented |
| `AUDIT_LOG_RETENTION_DAYS` | No | HIPAA | `2555` (7 years) | Documented |
| `DATA_RETENTION_DAYS_AFTER_CLOSURE` | No | HIPAA | `2555` | Documented |
| `SOFT_DELETE_GRACE_PERIOD_DAYS` | No | HIPAA | `30` | Documented |

### 1.14 Env Validation Summary

`lib/env-validation.ts` (called from `instrumentation.ts` on startup) enforces:
- **All environments:** `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`
- **Production only:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENDGRID_API_KEY`, `REDIS_URL`

---

## 2. External API Integrations

| Service | Purpose | Implementation File(s) | API Version | Status | Key Env Vars |
|---------|---------|----------------------|-------------|--------|--------------|
| **Stripe** | Payments, subscriptions, checkout, customer portal | `lib/integrations/stripe.ts` (693 lines), `lib/stripe/stripe-server.ts`, `lib/stripe/stripe-client.ts`, `lib/stripe/stripe-webhooks.ts`, `app/api/webhooks/stripe/route.ts` | `2026-01-28.clover` | **ACTIVE** -- fully implemented | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` |
| **SendGrid** | Transactional email (20 templates) | `lib/integrations/sendgrid.ts` | v3 (via `@sendgrid/mail ^8.1.6`) | **ACTIVE** -- fully implemented with Redis retry queue | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME` |
| **Twilio** | SMS notifications (7 templates) | `lib/integrations/twilio.ts` | v5.x SDK | **NOT CONNECTED** -- code exists, not wired to live service | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` |
| **DoseSpot** | e-Prescribing (medication orders) | `lib/integrations/dosespot.ts` (605 lines), `lib/integrations/dosespot.mock.ts` (739 lines) | Sandbox | **MOCK MODE** -- full API client + mock; prescription send has TODO | `DOSESPOT_*` (9 vars) |
| **AWS S3** | HIPAA-compliant document storage | `lib/integrations/s3.ts` (994 lines) | SDK v3 | **CONFIGURED** -- presigned URLs, encryption, virus scanning stub | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME`, `AWS_REGION` |
| **Google Analytics 4** | Analytics | `app/layout.tsx` (metadata reference) | GA4 | **STUB** -- measurement ID read but no script tag | `NEXT_PUBLIC_GA_MEASUREMENT_ID` |
| **Neon** | Managed PostgreSQL database | `lib/db/prisma.ts` (via `@prisma/adapter-pg`) | Prisma 7.4.1 | **ACTIVE** -- singleton client with encryption extension | `DATABASE_URL` |
| **Redis** | Caching, sessions, rate limiting, notification queue | `lib/redis/client.ts`, `lib/redis/cache.ts`, `lib/redis/session.ts` | ioredis 5.x | **ACTIVE** -- full implementation | `REDIS_URL`, `REDIS_PASSWORD`, `REDIS_TLS_ENABLED` |

**Note:** Two separate Stripe implementations exist (`lib/integrations/stripe.ts` and `lib/stripe/stripe-server.ts`). The webhook handler uses the newer `lib/stripe/` module. This is a known divergence risk (P2 Section 5.2).

---

## 3. Database Schema Overview

**Source:** `prisma/schema.prisma` (908 lines) -- 18 models, 17 enums.

### Core Domain Models

| Model | PHI Encrypted? | Field Count | Key Relationships | Notes |
|-------|:--------------:|:-----------:|-------------------|-------|
| `User` | No (email is not encrypted) | 13 | -> PatientProfile?, Physician?, Intake[], Message[], Subscription[], Invoice[], Session[], PasswordReset[] | Central identity model; 3 roles via enum |
| `PatientProfile` | **Yes** (16 fields) | 26 | -> User, Document[], Pharmacy? | firstName, lastName, dateOfBirth, phone, address, billing, medical, insurance all encrypted |
| `Physician` | No | 16 | -> User, Review[], Message[], PhysicianNote[], PhysicianMessage[] (sent/received) | NPI + license number unique; 4-state status enum |
| `Intake` | **Yes** (2 fields) | 15 | -> User, Review?, Prescription? | formData (JSON) and medicationList encrypted |
| `Review` | **Yes** (5 fields) | 17 | -> Intake (1:1), Physician | clinicalNotes, contraindications, rejectionReason, alternativeRecommendation, instructions |
| `Prescription` | **Yes** (2 fields) | 19 | -> Intake (1:1), RefillRequest[], Pharmacy? | instructions and pharmacyAddress encrypted |
| `Message` | **Yes** (2 fields) | 11 | -> Physician?, User? | subject and body encrypted; thread-based |

### Supporting Models

| Model | PHI Encrypted? | Field Count | Key Relationships | Notes |
|-------|:--------------:|:-----------:|-------------------|-------|
| `Session` | No | 7 | -> User | JWT session tracking |
| `PasswordReset` | No | 5 | -> User | Token-based password reset |
| `RefillRequest` | No | 5 | -> Prescription | Refill status workflow |
| `Document` | No (content in S3) | 9 | -> PatientProfile | S3-backed; metadata only in DB |
| `Subscription` | No | 13 | -> User, Invoice[] | Stripe subscription mirror |
| `Invoice` | No | 8 | -> Subscription, User | Stripe invoice mirror |
| `Notification` | No | 8 | None (userId ref) | In-app notification queue |
| `Pharmacy` | No | 15 | -> Prescription[], PatientProfile[] | Pharmacy directory with geo fields |
| `PhysicianNote` | **Yes** (1 field) | 5 | -> Physician | Clinical notes; content encrypted |
| `PhysicianAuthorizationLog` | No | 6 | None (physicianId/adminId refs) | Admin authorization audit trail |
| `PhysicianMessage` | **Yes** (2 fields) | 14 | -> Physician (sender/recipient), self-referential (thread) | Doctor-to-doctor messaging |
| `PhysicianMessageThread` | No | 8 | None (participant refs) | Thread summaries for efficient queries |
| `AuditLog` | No | 12 | None | Immutable HIPAA audit trail |
| `AdminActivityLog` | No | 9 | None | Admin action audit trail |

### Enums (17)

`Role`, `PhysicianStatus`, `IntakeStatus`, `PaymentStatus`, `ReviewDecision`, `PrescriptionStatus`, `RefillStatus`, `SenderType`, `MessageStatus`, `DocumentType`, `DocumentStatus`, `PlanType`, `SubscriptionStatus`, `InvoiceStatus`, `NotificationType`, `ConcernType`, `TreatmentGoal`, `AuthorizationAction`, `AdminAction`

---

## 4. Infrastructure

### Domain & Hosting

| Component | Provider | Details |
|-----------|----------|---------|
| Domain | SiteGround (DNS registration) | `rimalhealth.com` |
| Hosting | Netlify | Static + serverless functions |
| SSL | Netlify (automatic) | Let's Encrypt |

### Database & Cache

| Component | Provider | Details |
|-----------|----------|---------|
| Database | Neon PostgreSQL | Managed serverless Postgres; Prisma 7.4.1 ORM |
| Cache/Sessions | Redis | ioredis 5.x; used for caching, sessions, rate limiting, notification retry queue |

### CI/CD

| Component | Details |
|-----------|---------|
| Pipeline | GitHub Actions -> Netlify deploy |
| Workflow steps | lint, type-check, tests, security scan, build, deploy, migrations, health check, smoke tests |
| Local deploy | `netlify deploy --prod` (preferred when CI has framework-level bugs) |

### Docker (Local Dev)

| File | Services |
|------|----------|
| `docker/docker-compose.yml` | PostgreSQL, Redis, App |

### Known CI Issues

- Turbopack cannot resolve barrel exports (`@/lib/audit`). Use explicit `/index` imports or deploy locally.
- `next.config.ts` sets `typescript.ignoreBuildErrors = true` in CI. Run `npm run type-check` separately.

---

## 5. Key Dependencies

### Production Dependencies (Top 20)

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.1.6 | React framework (App Router, SSR, API routes) |
| `react` / `react-dom` | 19.2.3 | UI library |
| `typescript` | ^5 | Language |
| `@prisma/client` / `prisma` | ^7.4.1 | Database ORM with encryption extension |
| `@prisma/adapter-pg` / `pg` | ^7.4.1 / ^8.18.0 | PostgreSQL driver for Prisma |
| `stripe` / `@stripe/stripe-js` | ^20.3.1 / ^8.8.0 | Payment processing (server + client) |
| `@sendgrid/mail` | ^8.1.6 | Transactional email |
| `twilio` | ^5.12.2 | SMS notifications |
| `@aws-sdk/client-s3` / `@aws-sdk/s3-request-presigner` | ^3.996.0 | Document storage |
| `ioredis` | ^5.9.3 | Redis client (cache, sessions, rate limiting) |
| `zod` | ^4.3.6 | Schema validation (v4 syntax) |
| `react-hook-form` / `@hookform/resolvers` | ^7.71.1 / ^5.2.2 | Form state management |
| `bcrypt` | ^6.0.0 | Password hashing |
| `tailwind-merge` | ^3.4.1 | Tailwind class merging |
| `framer-motion` | ^12.34.1 | Animations |
| `lucide-react` | ^0.574.0 | Icon library |
| `class-variance-authority` | ^0.7.1 | Component variant styling (shadcn/ui) |
| `clsx` | ^2.1.1 | Conditional class names |
| `date-fns` | ^4.1.0 | Date utilities |
| `otpauth` / `qrcode.react` | ^9.5.0 / ^4.2.0 | MFA (TOTP + QR codes) |

### Key Dev Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `tailwindcss` / `@tailwindcss/postcss` | ^4 | CSS framework (v4, no config file) |
| `vitest` / `@vitest/coverage-v8` | ^4.0.18 | Unit + integration testing |
| `@playwright/test` | ^1.58.2 | E2E testing |
| `eslint` / `eslint-config-next` | ^9 / 16.1.6 | Linting |
| `prettier` | ^3.5.3 | Code formatting |
| `shadcn` | ^3.8.5 | UI component toolkit |
| `supertest` | ^6.3.4 | HTTP testing |

---

## 6. Custom Skills

| Skill | Location | Status | Purpose |
|-------|----------|--------|---------|
| `/deploy` | `.claude/skills/deploy/SKILL.md` | **Working** | Type check, build, env audit, Netlify deploy, post-deploy verify |
| `/preflight` | `.claude/skills/preflight/SKILL.md` | **Working** | Env var audit, build config, domain validation, static generation safety |
| `neon-postgres` | `.claude/skills/neon-postgres` (symlink) | **Broken** | Symlink to `../../.agents/skills/neon-postgres` -- target does not exist |

**Proposed new skills** (from P3 audit):
- `/hipaa-review` -- Verify PHI encryption, audit logging, no PHI leakage
- `/test-flow` -- Run full test pyramid for a specific area
- `/stripe-debug` -- Systematic Stripe debugging
- `/db-check` -- Database state validation (replaces broken neon-postgres)

---

## 7. Static Assets

### Dynamic Images (Generated at Build/Request Time)

| File | Output | Description |
|------|--------|-------------|
| `app/icon.tsx` | Favicon | Dynamic favicon generated via Next.js ImageResponse |
| `app/opengraph-image.tsx` | OG image | Dynamic Open Graph image for social sharing |

### Public Directory (`public/`)

| File/Dir | Description |
|----------|-------------|
| `icon.svg` | SVG favicon |
| `icon-192x192.png` | PWA icon (192px) |
| `icon-512x512.png` | PWA icon (512px) |
| `site.webmanifest` | PWA manifest |
| `images/logo.svg` | Brand logo |
| `images/dr-rabah.png` | Physician photo |
| `file.svg` | Default file icon (Next.js) |
| `globe.svg` | Default globe icon (Next.js) |
| `next.svg` | Next.js logo (default) |
| `vercel.svg` | Vercel logo (default, unused) |
| `window.svg` | Default window icon (Next.js) |

---

*This manifest should be updated when integrations change status, new env vars are added, or infrastructure changes.*
