# P2 Codebase Analysis: RimalHealth

**Analyst:** P2 (Codebase Analyst)
**Date:** 2026-03-25
**Codebase Root:** `/Users/sonuyadav/RimalHealth/premium-telehealth-website/my-app/`

---

## 1. Architecture Snapshot

### Overall Metrics

| Metric | Count |
|--------|-------|
| Total source files (.ts/.tsx, excluding node_modules/.next/.netlify) | 422 |
| Page routes (page.tsx) | 48 |
| API routes (route.ts) | 76 |
| Layout files (layout.tsx) | 11 |
| Lib module files | 86 (33,987 lines) |
| Component files | 140 (31,906 lines) |
| Custom hooks | 5 |
| Type definition files | 7 |
| Test files | 14 (5,492 lines total including inline test) |
| Script files | 8 |
| Prisma models | 18 |
| Prisma enums | 17 |
| Database migrations | 7 |

### Route File Breakdown

| Route Group | Page Count | Description |
|-------------|-----------|-------------|
| `app/(marketing)/*` | 13 | Public marketing pages (homepage, about, pricing, faq, etc.) |
| `app/(auth)/*` | 4 | Auth pages (login, signup, forgot-password, set-password) |
| `app/patient/*` | 8 | Patient portal (dashboard, billing, documents, messages, prescriptions, profile, settings) |
| `app/physician/(portal)/*` | 8 | Physician portal (dashboard, queue, patients, messages, prescriptions, reviews, settings, intake/[id]) |
| `app/physician/(auth)/*` | 1 | Physician login |
| `app/admin/*` | 4 | Admin portal (dashboard, physicians, physicians/[id], physicians/pending) |
| `app/checkout/*` | 4 | Checkout flow (consent, payment, success, cancel) |
| `app/intake/*` | 2 | Intake form + success page |
| `app/profile/*` | 1 | Profile setup |
| Other (logout, unauthorized) | 2 | Utility pages |

### API Route Breakdown

| API Group | Route Count |
|-----------|-------------|
| `api/auth/*` | 13 (login, register, logout, refresh, forgot/reset-password, set-password-token, change-password, me, mfa/setup/verify-setup/verify/disable, physician/verify-key) |
| `api/patient/*` | 20 (intake, profile, prescriptions, messages, documents, billing, onboarding, pharmacies) |
| `api/physician/*` | 18 (queue, review, patients, prescriptions, messages, pharmacies, stats, dashboard, profile, colleagues, intake/[id]) |
| `api/admin/physicians/*` | 8 (CRUD + authorize/suspend/reject/reactivate/reset-key) |
| `api/stripe/*` | 4 (checkout-session, public-checkout-session, customer-portal, subscription) |
| `api/webhooks/*` | 2 (stripe, dosespot) |
| `api/contact` | 1 |
| `api/health` | 1 |
| `api/intake` | 1 |

### Lib Module Sizes (by line count, descending)

| Module | Lines | Files | Key Responsibilities |
|--------|-------|-------|---------------------|
| `lib/integrations/` | 4,472 | 8 | Stripe, DoseSpot, S3, SendGrid, Twilio |
| `lib/auth/` | 3,291 | 10 | JWT, sessions, RBAC, passwords, MFA, account lockout, secret keys |
| `lib/hipaa/` | 2,908 | 5 | Audit logger, data retention, encryption, PHI identifiers |
| `lib/services/` | 2,501 | 5 | Notification, audit, document, subscription, validation services |
| `lib/utils/` | 2,465 | 5 | Date, error, string, validation helpers |
| `lib/security/` | 2,424 | 6 | CSRF, headers, password policy, rate limiting, sanitization |
| `lib/audit/` | 2,293 | ~5 | Audit logger singleton, types, utils, middleware |
| `lib/patient/` | 2,077 | 6 | Profile, prescriptions, messaging, documents, onboarding |
| `lib/physician/` | 2,044 | 6 | Queue, review, patients, messaging, patient-utils, review-types |
| `lib/notifications/` | 1,960 | 3 | Templates (854 lines), queue, index |
| `lib/intake/` | 1,537 | 5 | Questions, scoring, validations, auto-save |
| `lib/stripe/` | 1,292 | 4 | Client, server, webhooks, index |
| `lib/middleware/` | 1,236 | 3 | API cache, rate-limit, performance monitor |
| `lib/redis/` | 961 | 4 | Client, cache, session, index |
| `lib/db/` | 935 | 4 | Prisma singleton, encryption extension, encryption middleware, standalone encryption |
| `lib/validation/` | 619 | ~2 | Zod schemas for all API inputs |
| `lib/encryption/` | 548 | ~2 | AES-256-GCM PHI encryption/decryption |

### Component Breakdown (by line count, descending)

| Directory | Lines | Files | Description |
|-----------|-------|-------|-------------|
| `components/physician/` | 15,582 | 42 | Largest component group: queue, review, patients, prescriptions, messaging |
| `components/patient/` | 6,230 | 25 | Dashboard, billing, documents, messages, prescriptions, profile |
| `components/forms/` | 4,625 | 17 | Intake form (652 lines), checkout flow (4 steps), login, signup, contact |
| `components/ui/` | 1,981 | 22 | shadcn/ui: button, card, dialog, table, tabs, etc. |
| `components/shared/` | 1,194 | 3 | DocumentUploader, EmptyState, StatusBadge |
| `components/sections/` | 668 | 8 | Marketing: Hero, CTA, HowItWorks, Pricing, Proof, ValueProps |
| `components/marketing/` | 399 | 3 | ComparisonTable, PlanSelector, PricingCard |
| `components/layout/` | 300 | 3 | Navigation, Footer, MobileStickyCTA |
| `components/auth/` | 274 | 1 | MFASetup |
| `components/admin/` | 270 | 1 | AdminNav |
| `components/animations/` | 171 | 3 | CountUp, ScrollReveal, StaggerContainer |
| `components/a11y/` | 39 | 1 | Announcer (accessibility) |

### Top 15 Largest Files (by line count)

| File | Lines | Purpose |
|------|-------|---------|
| `app/intake/IntakeClient.tsx` | 1,444 | Multi-step intake form wizard (client component) |
| `app/physician/(portal)/messages/page.tsx` | 1,072 | Physician messaging page |
| `lib/integrations/s3.ts` | 994 | AWS S3 integration (presigned URLs, HIPAA-compliant document storage) |
| `lib/notifications/templates.ts` | 854 | 20 email + 7 SMS template generators |
| `lib/hipaa/phi-identifiers.ts` | 811 | PHI field definitions, classification, sensitivity levels |
| `components/physician/PatientDetailView.tsx` | 798 | Full patient detail view for physicians |
| `app/profile/setup/page.tsx` | 793 | Post-payment profile setup page |
| `scripts/security-audit.ts` | 741 | Security audit script |
| `lib/integrations/dosespot.mock.ts` | 739 | DoseSpot mock for development |
| `components/physician/PatientNotes.tsx` | 726 | Physician notes component |
| `lib/hipaa/audit-logger.ts` | 724 | HIPAA audit logger (DB-backed) |
| `app/api/stripe/subscription/route.ts` | 699 | Stripe subscription management API |
| `app/admin/dashboard/page.tsx` | 697 | Admin dashboard |
| `lib/integrations/stripe.ts` | 693 | Stripe payment integration |
| `lib/audit/middleware.ts` | 693 | Audit middleware |

---

## 2. Integration Inventory

### External Service Integrations

| Service | Implementation File(s) | Status | Env Vars Required |
|---------|----------------------|--------|-------------------|
| **Stripe** (Payments) | `lib/integrations/stripe.ts` (693 lines), `lib/stripe/stripe-server.ts`, `lib/stripe/stripe-client.ts`, `lib/stripe/stripe-webhooks.ts`, `app/api/webhooks/stripe/route.ts` (617 lines) | **Fully implemented** -- checkout, subscriptions, customer portal, webhook handling, auto-user creation | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ACTIVE_TREATMENT`, `STRIPE_PRICE_MAINTENANCE` |
| **SendGrid** (Email) | `lib/integrations/sendgrid.ts` | **Fully implemented** -- template-based sending, retry queue via Redis, 20 email templates | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME` |
| **Twilio** (SMS) | `lib/integrations/twilio.ts` | **Fully implemented** -- template-based SMS, E.164 formatting, retry queue | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` |
| **AWS S3** (Documents) | `lib/integrations/s3.ts` (994 lines) | **Fully implemented** -- presigned upload/download, HIPAA encryption, virus scanning stub | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET_NAME` |
| **DoseSpot** (e-Prescribing) | `lib/integrations/dosespot.ts` (605 lines), `lib/integrations/dosespot.mock.ts` (739 lines), `lib/integrations/dosespot.types.ts` | **Implemented with mock** -- real API client + full mock for dev. Mock mode toggled by `DOSESPOT_MOCK_MODE=true`. Physician prescription send route has `// TODO: Integrate with DoseSpot for e-prescribing`. | `DOSESPOT_API_URL`, `DOSESPOT_CLIENT_ID`, `DOSESPOT_CLIENT_SECRET`, `DOSESPOT_CLINIC_ID`, `DOSESPOT_USER_ID`, `DOSESPOT_MOCK_MODE` |
| **PostgreSQL** (Database) | `lib/db/prisma.ts` -- uses `pg` driver with `@prisma/adapter-pg` | **Fully implemented** -- singleton client with encryption extension | `DATABASE_URL` |
| **Redis** (Cache/Sessions) | `lib/redis/client.ts`, `lib/redis/cache.ts`, `lib/redis/session.ts` | **Fully implemented** -- caching, session store, rate limiting, notification retry queue | `REDIS_URL`, `REDIS_PASSWORD`, `REDIS_TLS_ENABLED` |
| **Google Analytics 4** | Referenced in `app/layout.tsx` (metadata) | **Stub** -- GA measurement ID is read but no GA script tag found in layouts | `NEXT_PUBLIC_GA_MEASUREMENT_ID` |

### Stripe API Version

The Stripe client uses API version `2026-01-28.clover` (in both `lib/integrations/stripe.ts` and `lib/stripe/stripe-server.ts`).

**Note:** There are **two separate Stripe implementations**: `lib/integrations/stripe.ts` (older, full-featured) and `lib/stripe/stripe-server.ts` (newer, used by webhook handler). The webhook handler imports from `lib/stripe/stripe-server.ts`. This is a potential source of divergence.

---

## 3. Domain Knowledge Extraction

### Business Rules Encoded in Code

1. **California-only residency** -- `addressState` defaults to `"CA"` in Prisma schema. Validation enforced in intake forms.

2. **Payment-first flow** -- The patient onboarding flow is:
   - Landing page CTA -> `/checkout/payment` (public, no auth)
   - Stripe checkout via `POST /api/stripe/public-checkout-session` (no auth required)
   - Stripe webhook (`app/api/webhooks/stripe/route.ts`) auto-creates: User (PATIENT role, random password, `emailVerified=false`), PatientProfile (empty), Subscription
   - Sends `SET_PASSWORD` email to patient
   - Patient sets password at `/set-password`
   - Login -> intake form -> physician notified

3. **Flat-fee pricing** -- Hardcoded in `lib/stripe/stripe-server.ts`:
   - `ACTIVE_TREATMENT`: $50.00/month (5000 cents)
   - `MAINTENANCE`: $25.00/month (2500 cents)

4. **One active intake per patient** -- Enforced in `app/api/patient/intake/route.ts` (checks for existing DRAFT/SUBMITTED intake before creating new one).

5. **Payment required before intake submission** -- In `app/api/patient/intake/[id]/submit/route.ts` line 117: `requirePayment` is true in production or when `REQUIRE_PAYMENT=true`. Checks for active subscription.

6. **Refill available 7 days before medication runs out** -- Checked via `nextRefillAvailable` field on `Prescription` model.

7. **Physician 24-hour review SLA** -- Reflected in risk assessment recommendations: HIGH risk = "Priority physician review within 24 hours", MODERATE = "within 24-48 hours".

8. **All physicians see all patients** -- No physician-patient assignment in schema or middleware. Queue shows all submitted intakes.

9. **Email verification optional** -- Login route checks `REQUIRE_EMAIL_VERIFICATION` env var; only enforces when set to `'true'`.

### AUDIT-C Scoring Algorithm

File: `lib/intake/scoring.ts` (389 lines)

**AUDIT-C (Alcohol Use Disorders Identification Test -- Consumption):**
- 3 questions, each scored 0-4 (total range: 0-12)
- Risk levels: LOW (0-3), MODERATE (4-5), HIGH (6-7), SEVERE (8+)
- Questions defined in `lib/intake/questions.ts`

**Risk Score (0-100):**
- AUDIT-C score * 3.33 (max 40 points)
- Seizure history: +10, Psychiatric history: +8, Liver disease: +10, Pregnancy: +12
- Quit attempts: +5 per attempt (max 20)
- Concern level: 0-10 points based on self-reported severity

**Complexity Score (0-100):**
- Medications: +4 per medication (max 20)
- Seizure: +12, Psychiatric: +10, Liver: +12, Kidney: +8, Heart: +8, Pregnancy: +15
- Other conditions text: up to +10 based on text length
- Previous treatment: +5 (+ 10 if tried medications before)

**DSM-5 Support:**
- Also supports DSM-5 format (11 symptom questions)
- Maps DSM-5 symptom count to AUDIT-C equivalent scale

**Risk Assessment (combined):**
- SEVERE: risk >= 70 OR complexity >= 70
- HIGH: risk >= 50 OR complexity >= 50
- MODERATE: risk >= 25 OR complexity >= 30
- LOW: below all thresholds

### Email Templates (20 types)

From `lib/notifications/templates.ts`:

| Template | Purpose |
|----------|---------|
| WELCOME | New patient welcome |
| EMAIL_VERIFICATION | Verify email address |
| PASSWORD_RESET | Password reset link |
| SET_PASSWORD | Post-payment password setup |
| INTAKE_SUBMITTED | Intake received confirmation |
| INTAKE_APPROVED | Intake approved notification |
| INTAKE_REJECTED | Intake rejected notification |
| INTAKE_NEEDS_INFO | Additional info needed |
| INTAKE_CONFIRMATION | Intake confirmation |
| NEW_INTAKE_PENDING | Notifies physicians of new intake |
| REFILL_REQUESTED | Refill request sent |
| REFILL_APPROVED | Refill approved |
| PRESCRIPTION_SENT | Prescription sent to pharmacy |
| MESSAGE_RECEIVED | New message notification |
| PAYMENT_RECEIPT | Payment confirmation |
| PAYMENT_FAILED | Payment failure alert |
| SUBSCRIPTION_CANCELLED | Subscription cancellation |
| GENERIC_NOTIFICATION | Generic notification |
| ADMIN_ALERT | Admin alert |

### SMS Templates (7 types)

| Template | Purpose |
|----------|---------|
| VERIFICATION_CODE | SMS verification code |
| INTAKE_APPROVED | Intake approved |
| PRESCRIPTION_READY | Prescription ready at pharmacy |
| APPOINTMENT_REMINDER | Appointment reminder |
| MESSAGE_NOTIFICATION | Message notification |
| STATUS_UPDATE | Status update |
| MESSAGE_RECEIVED | Message received |

### HIPAA Compliance Patterns in Code

1. **Field-level encryption** -- `lib/encryption/phi.ts` (AES-256-GCM with scrypt key derivation), `lib/db/encryption-extension.ts` maps 6 models to their PHI fields for automatic encrypt/decrypt.

2. **PHI fields encrypted via Prisma extension:**
   - `PatientProfile`: firstName, lastName, dateOfBirth, phone, addressStreet, addressCity, addressZip, billingStreet, billingCity, billingZip, medicalHistory, currentMedications, allergies, insuranceProvider, insuranceMemberId, insuranceGroupNumber (16 fields)
   - `Intake`: formData, medicationList (2 fields)
   - `Review`: clinicalNotes, contraindications, rejectionReason, alternativeRecommendation, instructions (5 fields)
   - `Prescription`: instructions, pharmacyAddress (2 fields)
   - `Message`: subject, body (2 fields)
   - `PhysicianNote`: content (1 field)

3. **Audit logging** -- `lib/hipaa/audit-logger.ts` and `lib/audit/logger.ts` (two separate audit loggers -- see Inconsistencies section). All PHI access logged with userId, action, resourceType, resourceId, timestamp, IP, userAgent.

4. **7-year retention** -- `DATA_RETENTION.AFTER_CLOSURE = 2555 days` (constants.ts), with HIPAA-mandated audit log retention matching.

5. **Security headers** -- Applied via `next.config.ts` including CSP, HSTS, X-Frame-Options, X-Content-Type-Options.

6. **CSRF protection** -- Double-submit cookie pattern in `lib/security/csrf.ts`.

7. **Rate limiting** -- Redis-backed in `lib/security/rate-limit.ts` and `lib/middleware/rate-limit.ts`: 5 login attempts per 15 minutes, 100 req/min authenticated, 20 req/min unauthenticated.

8. **Account lockout** -- `lib/auth/account-lockout.ts` with Redis-backed tracking.

9. **Print styles** -- `app/globals.css` includes `@media print` styles for HIPAA-compliant patient record printing.

### Key Constants and Config Values

From `lib/constants.ts`:
- Access token expiry: 15 minutes
- Refresh token expiry: 7 days
- CSRF token expiry: 1 hour
- Session idle timeout: 30 minutes
- Session absolute timeout: 8 hours
- Password: min 12 chars, uppercase + lowercase + digit + special required, max 3 consecutive identical chars
- Audit log retention: 7 years (2555 days)
- Failed login retention: 365 days
- Session log retention: 90 days

### RBAC Permission System

File: `lib/auth/rbac.ts`

**39 total permissions** organized into 3 groups:

- **Patient (13 permissions):** Self-service only -- view/edit own profile, intake, prescriptions, messages, documents, billing, manage subscription, delete account
- **Physician (additional ~16 permissions):** View all patients, view patient details/documents, review/approve/reject intake, create/send/cancel prescriptions, view/reply messages, access clinical tools, update availability
- **Admin (additional ~10 permissions):** Manage users/physicians, verify credentials, view/export audit logs, manage system/billing, process refunds, send notifications, manage content, impersonate user

Admin has access to all routes (enforced in middleware: `if (role === Role.ADMIN) return true`).

---

## 4. Current State Assessment

### Test Coverage

| Category | Files | Lines | Location |
|----------|-------|-------|----------|
| Unit tests | 5 (4 in tests/unit/ + 1 in lib/) | 1,790 | `tests/unit/{auth,encryption,rbac,validation}.test.ts`, `lib/encryption/phi.test.ts` |
| Integration tests | 4 | 2,154 | `tests/integration/{auth,patient,physician,webhooks}.test.ts` |
| E2E tests | 5 | 1,548 | `tests/e2e/{checkout,intake,messaging,review,signup}.spec.ts` |
| **Total** | **14** | **5,492** | |

**Test configuration:**
- Unit tests: `vitest.unit.config.ts` (10s timeout, threads pool)
- Integration tests: `vitest.integration.config.ts` (30s timeout, forks pool for DB isolation)
- E2E tests: `playwright.config.ts` (Chromium, Firefox, WebKit; 2 retries in CI)
- Default `vitest.config.ts` only includes integration tests (potential confusion for `npm test`)

**Coverage gaps:** No tests for notification service, S3 integration, DoseSpot integration, Twilio, CSRF module, rate limiting, audit logging, or any component rendering.

### TODO/FIXME/HACK Comments

Only **2 genuine TODOs** found in the codebase:

1. `app/api/patient/billing/cancel/route.ts:193` -- `// TODO: Implement email notification` (on subscription cancellation)
2. `app/api/physician/prescriptions/send/route.ts:142` -- `// TODO: Integrate with DoseSpot for e-prescribing` (prescription sending uses stub)

### Prisma Schema Structure

**18 models, 17 enums** in `prisma/schema.prisma` (908 lines):

**Core Domain Models:**
| Model | Key Fields | Relationships |
|-------|-----------|---------------|
| `User` | id, email, passwordHash, role, emailVerified, tokenVersion, mfaEnabled, mfaSecret | -> PatientProfile?, Physician?, Intake[], Message[], Subscription[], Invoice[], Session[], PasswordReset[] |
| `PatientProfile` | userId, firstName*, lastName*, dateOfBirth*, phone*, address*, billing*, medical*, insurance*, privacyConsent, preferredPharmacyId | -> User, Document[], Pharmacy? |
| `Physician` | userId, npiNumber, licenseNumber, status, secretKeyHash, isActive, maxDailyReviews | -> User, Review[], Message[], PhysicianNote[], PhysicianMessage[] |
| `Intake` | patientId, status, formData*, riskScore, complexityScore, paymentStatus | -> User, Review?, Prescription? |
| `Review` | intakeId (unique), physicianId, decision, clinicalNotes*, prescribedMedication | -> Intake, Physician |
| `Prescription` | intakeId (unique), patientId, pharmacyId?, medication details, status, refills | -> Intake, RefillRequest[], Pharmacy? |
| `Message` | threadId, senderType, senderId, recipientId, subject*, body*, status | -> Physician?, User? |

**Supporting Models:**
| Model | Purpose |
|-------|---------|
| `Session` | JWT session tracking |
| `PasswordReset` | Password reset tokens |
| `RefillRequest` | Prescription refill requests |
| `Document` | S3-backed document storage |
| `Subscription` | Stripe subscription tracking |
| `Invoice` | Stripe invoice tracking |
| `Notification` | In-app notifications |
| `Pharmacy` | Pharmacy directory (with geo fields) |
| `PhysicianNote` | Clinical notes (PHI encrypted) |
| `PhysicianAuthorizationLog` | Authorization audit trail |
| `PhysicianMessage` | Doctor-to-doctor messaging |
| `PhysicianMessageThread` | Thread summaries for physician messaging |
| `AdminActivityLog` | Admin action audit trail |
| `AuditLog` | HIPAA audit log |

(*) = PHI-encrypted fields

**Enums:** Role, PhysicianStatus, IntakeStatus, PaymentStatus, ReviewDecision, PrescriptionStatus, RefillStatus, SenderType, MessageStatus, DocumentType, DocumentStatus, PlanType, SubscriptionStatus, InvoiceStatus, NotificationType, ConcernType, TreatmentGoal, AuthorizationAction, AdminAction

### Middleware

File: `middleware.ts` (314 lines)

**Active middleware behavior:**
1. Skips static assets (`/_next`, `/api`, `/images`, file extensions)
2. Allows public routes (27 defined: marketing pages, auth pages, checkout pages)
3. For authenticated users on auth pages: redirects to role-appropriate dashboard
4. For protected routes: extracts JWT from `Authorization: Bearer` header or `accessToken` cookie
5. Verifies JWT, checks role-based access:
   - `/patient/*` -> PATIENT only
   - `/physician/*` -> PHYSICIAN only
   - `/admin/*` -> ADMIN only (but Admin also has access to all routes)
6. Injects `x-user-id`, `x-user-role`, `x-user-email`, `x-request-id` headers
7. Refreshes access token cookie (re-sets with 15-min maxAge)

**Important:** API routes (`/api/*`) are excluded from middleware via `STATIC_ROUTES`. API auth is handled per-route using `requireAuth`/`requirePermission` from `lib/auth/require-auth.ts`.

### Environment Validation

File: `lib/env-validation.ts` (called from `instrumentation.ts` on server startup)

**Required in all environments:** `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`
**Required in production only:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENDGRID_API_KEY`, `REDIS_URL`

---

## 5. Inconsistencies Found

### 5.1 Documentation vs. Code Discrepancies

1. **`(patient)` route group -- CLAUDE.md says it exists and is "orphaned"; it does NOT exist.**
   - CLAUDE.md states: `app/(patient)/` also exists but is orphaned
   - MEMORY.md references: "Patient billing page: `app/patient/billing/page.tsx` re-exports from `app/(patient)/billing/page.tsx`"
   - Reality: `app/(patient)/` directory does not exist. It was likely cleaned up at some point but docs were not updated.

2. **AGENTS.md route structure is outdated:**
   - AGENTS.md lists `app/(patient)/` as the primary patient portal and `app/patient/` as "Legacy patient routes (redirects)"
   - Reality: `app/patient/` IS the primary patient portal with 8 pages and its own layout. `app/(patient)/` does not exist.

3. **Tailwind CSS version discrepancy:**
   - CLAUDE.md/AGENTS.md says "Tailwind CSS 4.x"
   - `package.json` shows `tailwindcss: ^4` and `tailwind-merge: ^3.4.1`
   - The `^3.4.1` for `tailwind-merge` is correct (it's a separate package, not Tailwind itself)
   - Confirmed: Tailwind v4 is correctly configured via `@tailwindcss/postcss: ^4` in postcss

4. **Encryption key naming inconsistency:**
   - `lib/encryption/phi.ts` reads `process.env.PHI_ENCRYPTION_KEY` (hex format, 64+ chars)
   - `lib/hipaa/encryption.ts` reads `process.env.ENCRYPTION_KEY` (base64 format)
   - `lib/env-validation.ts` requires `ENCRYPTION_KEY` (not `PHI_ENCRYPTION_KEY`)
   - `.env.example` documents `ENCRYPTION_KEY` only (not `PHI_ENCRYPTION_KEY`)
   - **Two separate encryption implementations exist:** one uses hex key format, the other uses base64. Both are active.

5. **Checkout route `consent` not in CLAUDE.md:**
   - `app/checkout/consent/page.tsx` exists but is not mentioned in CLAUDE.md route documentation.

### 5.2 Duplicate/Redundant Code

1. **Two Stripe implementations:**
   - `lib/integrations/stripe.ts` (693 lines) -- older, full-featured Stripe client
   - `lib/stripe/stripe-server.ts` + related files (4 files, 1,292 lines total) -- newer Stripe module
   - The webhook handler uses `lib/stripe/stripe-server.ts`. Some API routes may still use `lib/integrations/stripe.ts`.

2. **Two audit logging systems:**
   - `lib/hipaa/audit-logger.ts` (724 lines) -- HIPAA-focused audit logger
   - `lib/audit/logger.ts` (660 lines) -- general audit logger singleton
   - Both exist and are imported in different parts of the codebase.

3. **Two encryption modules:**
   - `lib/encryption/phi.ts` -- AES-256-GCM with scrypt key derivation (uses `PHI_ENCRYPTION_KEY`)
   - `lib/hipaa/encryption.ts` (581 lines) -- separate encryption module (uses `ENCRYPTION_KEY`)
   - `lib/db/encryption.ts` -- yet another encryption file in the db module

### 5.3 Env Vars Referenced in Code but Missing from .env.example

The following env vars are used in source code but **not documented in `.env.example`**:

| Env Var | Used In | Purpose |
|---------|---------|---------|
| `PHI_ENCRYPTION_KEY` | `lib/encryption/phi.ts` | PHI encryption key (hex format) |
| `ADMIN_EMAIL` | Admin notification routes | Admin alert email |
| `REDIS_PASSWORD` | `lib/redis/client.ts` | Redis authentication |
| `REDIS_TLS_ENABLED` | `lib/redis/client.ts` | Redis TLS toggle |
| `DISABLE_API_CACHE` | `lib/middleware/api-cache.ts` | Disable API response caching |
| `REQUIRE_EMAIL_VERIFICATION` | `app/api/auth/login/route.ts` | Toggle email verification enforcement |
| `REQUIRE_PAYMENT` | `app/api/patient/intake/[id]/submit/route.ts` | Toggle payment requirement (dev) |
| `NEXT_PUBLIC_APP_VERSION` | `app/api/health/route.ts` | App version string |
| `NEXT_PUBLIC_SITE_URL` | `app/layout.tsx` | Metadata base URL |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | `app/layout.tsx` | Google Search Console verification |
| `AUDIT_HASH_SALT` | `lib/audit/utils.ts` | Salt for audit log hashing |
| `AWS_S3_BUCKET_NAME` | `lib/integrations/s3.ts`, `lib/services/document-service.ts` | S3 bucket name |
| `STRIPE_PRODUCT_ACTIVE_TREATMENT` | Referenced in .env.example but not actually used in code | Stripe product ID |
| `STRIPE_PRODUCT_MAINTENANCE` | Referenced in .env.example but not actually used in code | Stripe product ID |

### 5.4 Dead Code / Orphaned Files

1. **`app/profile/setup/page.tsx`** (793 lines) -- Profile setup page exists at `/profile/setup` but is not referenced in middleware public routes or in CLAUDE.md's documented routes. May be orphaned from an earlier flow.

2. **`app/(marketing)/for-physicians/page.tsx`** -- Listed in route files but not documented in CLAUDE.md architecture section (though it is in the footer links).

3. **`app/(marketing)/payment/page.tsx`** -- Public payment page exists but its relationship to `app/checkout/payment/page.tsx` is unclear. Both exist.

4. **`lib/db/encryption-middleware.ts`** and **`lib/db/encryption.ts`** -- Separate from the primary encryption extension but unclear if actively used.

5. **`components/physician/MessageThread.tsx`** exists at top level AND inside `components/physician/messaging/MessageThread.tsx` -- possible duplicate.

### 5.5 Vitest Default Config Issue

The root `vitest.config.ts` has `include: ['tests/integration/**/*.test.ts']`, meaning `npm test` (which runs `vitest run`) only runs integration tests by default. Unit tests require `npm run test:unit` explicitly. This is potentially confusing.

### 5.6 AGENTS.md Staleness

Several aspects of AGENTS.md (last updated 2026-03-02) are out of date:
- Lists `(patient)` route group as primary patient portal
- Lists Node.js 20+ but `engines` in package.json says `>=18.0.0`
- Does not mention the `checkout/consent` page
- Does not mention `profile/setup` page
- Does not mention the `for-physicians` marketing page

---

## 6. Summary for Context Brief

### Critical Files for Any Developer

1. `middleware.ts` -- Route protection, auth flow
2. `lib/auth/jwt.ts` + `lib/auth/require-auth.ts` -- Auth system
3. `lib/auth/rbac.ts` -- 39 permissions across 3 roles
4. `lib/db/prisma.ts` + `lib/db/encryption-extension.ts` -- Database with auto-encryption
5. `lib/encryption/phi.ts` -- PHI encryption core
6. `lib/intake/scoring.ts` -- AUDIT-C + risk/complexity scoring
7. `app/api/webhooks/stripe/route.ts` -- Payment-first patient onboarding
8. `lib/constants.ts` -- All security/session/retention config values
9. `prisma/schema.prisma` -- 18 models, 17 enums, full data model
10. `app/globals.css` -- Tailwind v4 theme tokens + component classes

### Key Risks

1. **Dual encryption systems** with different key formats could cause data integrity issues if mixed
2. **Dual audit logging** means audit coverage may be inconsistent across modules
3. **Dual Stripe implementations** could lead to behavior divergence
4. **Low test coverage** -- only 14 test files for 422 source files; no component tests, no service tests
5. **DoseSpot integration is partially stubbed** -- prescription sending route has TODO comment
6. **Subscription cancellation email not implemented** (TODO in billing cancel route)
