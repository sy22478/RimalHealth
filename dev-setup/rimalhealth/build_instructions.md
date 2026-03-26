# RimalHealth -- Build & Maintenance Instructions

> **Purpose:** How to correctly extend, modify, and maintain the RimalHealth platform.
> This is NOT a "build from scratch" guide. The app is production-ready (all 5 phases complete). This document tells agents HOW to add features, fix bugs, and deploy changes without breaking HIPAA compliance or architectural patterns.

**App root:** `premium-telehealth-website/my-app/` -- all paths below are relative to this unless stated otherwise.

---

## 1. DESIGN SYSTEM

### 1.1 Color Tokens

Defined in `app/globals.css` under `@theme inline`. No `tailwind.config.js` (Tailwind v4).

| Token | Hex | Usage |
|-------|-----|-------|
| `navy` / `navy-600` | `#0A2540` | Primary brand dark -- headers, logo bg |
| `navy-50` | `#E6F0F7` | Light navy tint |
| `ocean` / `ocean-500` | `#0284C7` | Accent blue -- CTAs, links, active sidebar |
| `ocean-50` | `#E0F2FE` | Active sidebar item bg |
| `ocean-600` | `#0369A1` | Icons, focus rings |
| `success` | `#10B981` | Approval badges |
| `warning` | `#F59E0B` | Pending badges |
| `destructive` | oklch | Error states (shadcn system) |
| `soft-purple` | `#8B5CF6` | Charts/badges accent |

Full shade scales (`navy-50` through `navy-900`, `ocean-50` through `ocean-900`) available -- see `globals.css`. **Rule:** Always use token names, never raw hex.

### 1.2 Typography

| Role | Font | CSS Variable |
|------|------|-------------|
| Headings | Instrument Sans | `--font-soehne` / `--font-instrument` |
| Body | Instrument Sans | `--font-sans` / `--font-instrument` |
| Code/Mono | Geist Mono | `--font-mono` |

Heading sizes use standard Tailwind scale with custom overrides for `5xl`-`7xl` (tight letter-spacing `-0.02em`). All headings get `font-bold text-gray-900` via the `@layer base` rule in `globals.css`.

### 1.3 Component Patterns

Use `@layer components` classes from `app/globals.css` instead of raw utilities:

| Class | Usage |
|-------|-------|
| `.btn-primary` | Gradient blue CTA button (blue-500 to ocean-500) |
| `.btn-secondary` | White bordered button |
| `.card-hover` | White card with hover shadow + lift |
| `.section-padding` | Responsive py-16/24/32 |
| `.container-custom` | max-w-7xl with responsive padding |

For interactive UI elements, use shadcn/ui components from `components/ui/` (style: "new-york").

### 1.4 Spacing & Layout

- 8px grid system (Tailwind's default `p-2` = 8px, `p-4` = 16px, etc.)
- Page sections: use `.section-padding` (responsive py-16/24/32)
- Container: use `.container-custom` (max-w-7xl with responsive px)
- Base border radius: `--radius: 0.5rem` (8px), with `radius-sm` through `radius-4xl` derived from it

---

## 2. HOW TO ADD A NEW FEATURE

### 2.1 Adding a New Patient Portal Page

1. Create `app/patient/<name>/page.tsx`. Use `'use client'` if the page has hooks/interactivity. Wrap content in `<div className="p-6 lg:p-8">`.
2. Add to sidebar nav in `app/patient/layout.tsx` -- add to `navItems` array (line ~34): `{ href: '/patient/<name>', label: '...', icon: IconName }`. Icons from `lucide-react`.
3. **Middleware protection is automatic** -- all `/patient/*` routes require `PATIENT` role (see `middleware.ts` line 71).
4. If fetching data, create an API route (see Section 2.2).
5. If using Prisma directly (server component), add `export const dynamic = 'force-dynamic'` at top.

### 2.2 Adding a New API Endpoint

**Example:** Adding `GET /api/patient/appointments`.

1. Create `app/api/patient/appointments/route.ts`.
2. Follow the standard pattern from Section 3.3 below. Use `requireRole(request, [Role.PATIENT])` for auth, Zod for input validation, `AuditService` for PHI access logging.
3. **API routes are NOT covered by middleware** (`/api/*` is in `STATIC_ROUTES`). Auth is handled per-route via the `requireAuth`/`requireRole`/`requirePermission` functions.
4. Use Zod v4 syntax: `{ message: '...' }`, NOT `{ required_error: '...' }` (Zod v3).

### 2.3 Adding a New Prisma Model

1. Add the model to `prisma/schema.prisma`. Follow existing patterns (cuid IDs, createdAt/updatedAt, relations).
2. **If the model has PHI fields**, register them in `lib/db/encryption-extension.ts`:
   - Add to `PHI_FIELDS` map (model name -> field names array)
   - Add to `JSON_FIELDS` if any field stores JSON objects
   - Add to `NULLABLE_FIELDS` if any PHI field is optional
3. Generate and migrate: `npm run db:generate && npm run db:migrate`
4. For production: `npm run db:deploy` (runs pending migrations only).

### 2.4 Adding a New Email/SMS Notification

1. Add to the `EmailTemplate` enum in `lib/notifications/templates.ts`.
2. Add a template generator to the `emailTemplates` map (same file). Each generator returns `{ subject, html, text }`. Use `interpolateTemplate()` for `{{placeholder}}` substitution and `siteConfig.name` for the app name.
3. Send via `sendEmail({ to, template, data })` from `lib/integrations/sendgrid.ts`.
4. For SMS, add to `SMSTemplate` enum and follow the same pattern with `lib/integrations/twilio.ts`.

**HIPAA constraint:** Never include diagnosis details, medication names, or treatment specifics in email body. Keep emails generic ("your appointment" not "your Naltrexone appointment").

### 2.5 Adding a New Integration

1. **Create the integration file** in `lib/integrations/`:
   ```
   lib/integrations/new-service.ts
   ```

2. **Add required env vars** to `.env.example` with documentation comments.

3. **If the service should be validated at startup**, add to `lib/env-validation.ts`.

4. **For development without credentials**, create a mock:
   ```
   lib/integrations/new-service.mock.ts
   ```
   Toggle with an env var like `NEW_SERVICE_MOCK_MODE=true`.

5. **Add env vars to Netlify** before deploying (Site settings > Environment variables).

---

## 3. API ROUTE PATTERNS

### 3.1 The Auth HOFs

All live in `lib/auth/require-auth.ts`:

- `requireAuth(request)` -- any authenticated user. Returns `{ user }` or 401.
- `requireRole(request, [Role.PATIENT])` -- specific role(s). Returns `AuthenticatedRequest` or 401/403.
- `requirePermission(request, Permission.X)` -- specific RBAC permission. Returns `AuthenticatedRequest` or 401/403.
- `requireAnyPermission(request, [...])` / `requireAllPermissions(request, [...])` -- multi-permission variants.
- `withAuth(handler)` / `withPermission(perm, handler)` -- HOF wrappers that handle auth internally.

**Pattern:** `const auth = await requireAuth(request); if (auth instanceof NextResponse) return auth;` -- then use `auth.user.userId`, `auth.user.role`, etc.

### 3.2 How Auth Reaches API Routes

API routes (`/api/*`) bypass Next.js middleware. `requireAuth` has a 3-step fallback: (1) middleware-injected `x-user-*` headers, (2) `Authorization: Bearer` header, (3) `accessToken` httpOnly cookie read directly.

### 3.3 Standard API Route Structure

Every route follows this pattern (see `app/api/patient/profile/route.ts` for a real example):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/require-auth';
import { prisma } from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit-service';
import { Role } from '@prisma/client';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, [Role.PATIENT]);
  if (auth instanceof NextResponse) return auth;
  const { userId } = auth.user;

  try {
    // For POST/PUT: validate body with Zod (z.object({...}).safeParse(body))
    const data = await prisma.patientProfile.findUnique({ where: { userId } });
    await AuditService.logPatientProfileAccess(/* ... */); // Required for PHI access
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Route error:', error); // NEVER expose PHI in error messages
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 3.4 Permissions Reference

39 permissions in `lib/auth/rbac.ts`. Key ones:

| Permission | Roles |
|-----------|-------|
| `VIEW_OWN_PROFILE` | PATIENT |
| `VIEW_ALL_PATIENTS` | PHYSICIAN, ADMIN |
| `REVIEW_INTAKE` | PHYSICIAN, ADMIN |
| `CREATE_PRESCRIPTION` | PHYSICIAN, ADMIN |
| `MANAGE_USERS` | ADMIN |
| `VIEW_AUDIT_LOGS` | ADMIN |

Admin has access to all routes (`if (role === Role.ADMIN) return true` in middleware).

---

## 4. DATA FLOW PATTERNS

### 4.1 PHI Encryption Pipeline

**Files:** `lib/encryption/phi.ts` (AES-256-GCM) + `lib/db/encryption-extension.ts` (Prisma extension).

**How it works:** On write, the Prisma extension intercepts create/update, encrypts PHI fields via `encryptPHI()`. On read, it decrypts via `decryptPHI()`. Encrypted values are prefixed `enc:v1:` + base64(IV + ciphertext + authTag).

**Auto-encrypted models** (6 models, 28 fields total):
- **PatientProfile**: 16 fields (names, DOB, phone, addresses, medical history, insurance)
- **Intake**: formData, medicationList
- **Review**: clinicalNotes, contraindications, rejectionReason, alternativeRecommendation, instructions
- **Prescription**: instructions, pharmacyAddress
- **Message**: subject, body
- **PhysicianNote**: content

**Key:** `PHI_ENCRYPTION_KEY` must be 64+ char hex string (derived via scrypt). Changing it makes all existing data unreadable.

**Caution:** Two encryption systems exist -- `lib/encryption/phi.ts` uses `PHI_ENCRYPTION_KEY` (hex), `lib/hipaa/encryption.ts` uses `ENCRYPTION_KEY` (base64). The Prisma extension uses the former. They are NOT interchangeable.

### 4.2 JWT Auth Flow

1. **Login** (`POST /api/auth/login`): Validates credentials, creates access token (15 min) + refresh token (7 days), sets httpOnly cookies (`accessToken`, `refreshToken`).
2. **Page requests** (e.g., `/patient/dashboard`): `middleware.ts` extracts token from cookie, verifies via `verifyAccessToken()`, injects `x-user-id`/`x-user-role`/`x-user-email` headers, refreshes cookie maxAge (15 min sliding window).
3. **API requests** (e.g., `GET /api/patient/profile`): Bypass middleware (`/api/*` in STATIC_ROUTES). `requireAuth()` reads `accessToken` cookie directly, verifies JWT, returns `{ user }`.
4. **Token refresh** (`POST /api/auth/refresh`): Uses refreshToken cookie to issue new access token.

### 4.3 Patient Payment-First Flow

No signup form -- patients enter through payment:

1. Landing CTA -> `/checkout/payment` (public) -> `POST /api/stripe/public-checkout-session` -> Stripe-hosted checkout
2. Stripe webhook (`checkout.session.completed`) auto-creates User (PATIENT, random password) + PatientProfile + Subscription, sends SET_PASSWORD email
3. Patient sets password at `/set-password` -> logs in -> `/patient/dashboard`
4. Intake form at `/intake` (requires active subscription) -> auto-saves drafts -> submits -> AUDIT-C scoring -> notifies physicians
5. Physician reviews at `/physician/intake/[id]` -> approves/rejects/requests-info

**Key files:** `app/api/webhooks/stripe/route.ts` (user creation), `app/intake/IntakeClient.tsx` (1,444-line wizard), `lib/intake/scoring.ts` (AUDIT-C algorithm).

---

## 5. INTEGRATION PATTERNS

### 5.1 Stripe (Payments)

**Purpose:** Checkout sessions, subscription management, customer portal, webhook-driven user creation. API version: `2026-01-28.clover`.

**Key files:** `lib/stripe/stripe-server.ts` (server client), `lib/stripe/stripe-client.ts` (browser), `app/api/webhooks/stripe/route.ts` (webhook handler, 617 lines). **Note:** An older `lib/integrations/stripe.ts` (693 lines) also exists -- some API routes may still reference it. Check which module is imported when modifying Stripe logic.

**Local testing:**
```bash
brew install stripe/stripe-cli/stripe
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copy whsec_xxx from output to STRIPE_WEBHOOK_SECRET in .env.local
stripe trigger checkout.session.completed
```
Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (decline).

### 5.2 SendGrid (Email)

**Purpose:** All transactional emails (19 templates). **Files:** `lib/integrations/sendgrid.ts`, `lib/notifications/templates.ts`. **Local:** Set `SENDGRID_API_KEY` in `.env.local`; if missing, emails log to console. **HIPAA:** Never include PHI in subject lines or body (no medication names, no diagnosis).

### 5.3 DoseSpot (e-Prescribing)

**Purpose:** Electronic prescription sending. **Files:** `lib/integrations/dosespot.ts` (real), `dosespot.mock.ts` (dev mock). **Local:** Set `DOSESPOT_MOCK_MODE=true`. **Known issue:** Prescription send route has `// TODO: Integrate with DoseSpot` at line 142 of `app/api/physician/prescriptions/send/route.ts`.

### 5.4 AWS S3 (Document Storage)

**Purpose:** HIPAA-compliant document storage with presigned URLs. **File:** `lib/integrations/s3.ts` (994 lines). **Env vars:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME`, `AWS_REGION`.

### 5.5 Twilio (SMS)

**Purpose:** SMS notifications (7 templates). **File:** `lib/integrations/twilio.ts`. **Status:** Implemented but not connected in production -- needs `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.

### 5.6 Redis (Cache/Sessions)

**Purpose:** Sessions, caching, rate limiting, retry queues, account lockout. **Files:** `lib/redis/client.ts`, `lib/redis/cache.ts`, `lib/redis/session.ts`. **Env vars:** `REDIS_URL`, `REDIS_PASSWORD` (optional), `REDIS_TLS_ENABLED` (optional). **Account lockout keys:** `auth:failed_attempts:<email>`, `auth:locked:<email>` -- clear with `redis-cli DEL`.

---

## 6. DEPLOYMENT RUNBOOK

### 6.1 Local Netlify Deploy

Use when CI has persistent issues (e.g., Turbopack barrel export resolution):

```bash
cd premium-telehealth-website/my-app

# 1. Build locally
npm run build

# 2. Deploy to Netlify (requires netlify-cli and login)
netlify deploy --prod --dir=.next

# Or let Netlify handle the build:
netlify deploy --build --prod
```

**Pre-deploy checklist:**
- All env vars set in Netlify dashboard (Site settings > Environment variables)
- `npm run type-check` passes locally (CI may skip type errors via `ignoreBuildErrors`)
- `npm test` passes

### 6.2 CI/CD Pipeline (GitHub Actions)

**File:** `.github/workflows/deploy.yml`. Triggered on push to `main` or manual dispatch.

**Test job:** ubuntu-latest with Postgres + Redis services. Runs `npm ci`, Prisma generate, lint (continue-on-error), type check (continue-on-error), unit tests, integration tests.

**Deploy job:** Builds app, deploys to Netlify, runs DB migrations, health check, smoke tests. Working directory: `premium-telehealth-website/my-app`.

### 6.3 Post-Deploy Verification

```bash
curl -s https://rimalhealth.com/api/health | jq .          # Health check
curl -s -o /dev/null -w "%{http_code}" https://rimalhealth.com/  # Homepage 200?
npm run test:smoke                                           # Automated smoke tests
```

### 6.4 Environment Variable Checklist

**Required in all environments:**

| Variable | Service | Description |
|----------|---------|-------------|
| `DATABASE_URL` | PostgreSQL (Neon) | Connection string |
| `JWT_SECRET` | Auth | 64-char hex string for JWT signing |
| `ENCRYPTION_KEY` | HIPAA | 32-byte base64 key for data encryption |

**Required in production:**

| Variable | Service | Description |
|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | Stripe | `sk_live_xxx` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe | `pk_live_xxx` |
| `STRIPE_WEBHOOK_SECRET` | Stripe | `whsec_xxx` |
| `STRIPE_PRICE_ACTIVE_TREATMENT` | Stripe | Price ID for $50/mo plan |
| `STRIPE_PRICE_MAINTENANCE` | Stripe | Price ID for $25/mo plan |
| `SENDGRID_API_KEY` | SendGrid | `SG.xxx` |
| `SENDGRID_FROM_EMAIL` | SendGrid | e.g., `noreply@admin.rimalhealth.com` |
| `REDIS_URL` | Redis | Connection string |
| `NEXT_PUBLIC_APP_URL` | App | `https://rimalhealth.com` |

**Optional / Feature-specific:** `PHI_ENCRYPTION_KEY` (HIPAA), `TWILIO_*` (3 vars, SMS), `AWS_*` (4 vars, S3), `DOSESPOT_*` (6 vars + `DOSESPOT_MOCK_MODE`), `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `REQUIRE_PAYMENT`, `REQUIRE_EMAIL_VERIFICATION`. See `.env.example` for full documentation.

---

## 7. TESTING GUIDE

### 7.1 Running Tests

```bash
npm run test:unit          # 5 files: auth, encryption, RBAC, validation
npm run test:integration   # 4 files: auth flow, patient API, physician API, webhooks
npm run test:e2e           # 5 specs: checkout, intake, messaging, review, signup
npx vitest run tests/unit/auth.test.ts              # Single file
npx vitest run --reporter=verbose -t "test name"    # Single test by name
npm run test:coverage                                # Coverage report
```

**Caveat:** `npm test` only runs integration tests (root `vitest.config.ts` includes only `tests/integration/`). Run `npm run test:unit` explicitly for unit tests.

### 7.2 Writing New Tests

**Locations:** Unit tests in `tests/unit/*.test.ts` (10s timeout), integration in `tests/integration/*.test.ts` (30s timeout, forks pool), E2E in `tests/e2e/*.spec.ts` (Playwright, 3 browsers).

**Mocking:** Database uses real Postgres in CI. External APIs: `vi.mock('@/lib/integrations/sendgrid', () => ({ sendEmail: vi.fn().mockResolvedValue({ success: true }) }))`.

**Test accounts:** `patient.test@rimalhealth.test` / `TestPatient123@` (PATIENT), `dr.sarah.johnson@rimalhealth.test` / `TestPhysician123!` (PHYSICIAN), `admin@rimalhealth.test` / `TestAdmin123!` (ADMIN).

### 7.3 Coverage Gaps (Priority Areas)

Current state: 14 test files for 422 source files. Priority areas that need tests:

1. **Notification service** (`lib/services/notification-service.ts`) -- zero tests
2. **S3 integration** (`lib/integrations/s3.ts`, 994 lines) -- zero tests
3. **DoseSpot integration** (`lib/integrations/dosespot.ts`) -- zero tests
4. **Audit logging** (`lib/audit/logger.ts`, `lib/hipaa/audit-logger.ts`) -- zero tests
5. **Rate limiting** (`lib/security/rate-limit.ts`, `lib/middleware/rate-limit.ts`) -- zero tests
6. **CSRF protection** (`lib/security/csrf.ts`) -- zero tests
7. **Component rendering** -- zero component tests exist (no React Testing Library)
8. **Intake scoring** (`lib/intake/scoring.ts`, 389 lines, AUDIT-C algorithm) -- zero tests

---

## 8. COMMON ISSUES & FIXES

### 8.1 Turbopack Barrel Export Resolution

**Symptom:** CI build fails with "Module not found" for `@/lib/audit`. **Fix:** Use explicit `/index` imports: `import { auditLogger } from '@/lib/audit/index'`. Or deploy locally with `netlify deploy --prod`.

### 8.2 Stripe Webhook Debugging

**Symptom:** Webhook returns 400 or user not created. **Check:** (1) `STRIPE_WEBHOOK_SECRET` matches CLI/Netlify, (2) `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, (3) API version matches `2026-01-28.clover`, (4) validate params against current Stripe API version before deploying.

### 8.3 PHI Encryption Roundtrip Failures

**Symptom:** Garbled data or decrypt errors. **Check:** (1) `PHI_ENCRYPTION_KEY` unchanged since encryption, (2) encrypted values start with `enc:v1:`, (3) JSON fields use `encryptJSON` not `encryptPHI`, (4) correct module used: `lib/encryption/phi.ts` (hex key) vs `lib/hipaa/encryption.ts` (base64 key) -- NOT interchangeable.

### 8.4 Auth Middleware Header Propagation

**Symptom:** `x-user-id` is null in API route. **Cause:** `/api/*` bypasses middleware. **Fix:** Use `requireAuth()` which reads the `accessToken` cookie directly as a fallback.

### 8.5 force-dynamic for Prisma Server Components

**Symptom:** Build error "Dynamic server usage". **Fix:** Add `export const dynamic = 'force-dynamic'` at top of file. Required for any server component running Prisma queries.

### 8.6 Netlify Stale Deploy Cache

**Symptom:** Deploy succeeds, old content shown. **Fix:** Netlify dashboard > Deploys > "Clear cache and deploy site". Or deploy locally: `netlify deploy --build --prod`.

### 8.7 Vitest Default Config

`npm test` only runs integration tests. Use `npm run test:unit` for unit tests explicitly.

### 8.8 Zod v3 vs v4

Project uses Zod v4. Use `{ message: '...' }` not `{ required_error: '...' }`. See `lib/validation/schemas.ts`.

---

## 9. QUICK REFERENCE

### File Locations for Common Tasks

| Task | Key File(s) |
|------|------------|
| Add patient page | `app/patient/` + `app/patient/layout.tsx` (navItems) |
| Add physician page | `app/physician/(portal)/` + physician layout |
| Add API route | `app/api/` (organized by role) |
| Add Prisma model | `prisma/schema.prisma` + `lib/db/encryption-extension.ts` |
| Add email template | `lib/notifications/templates.ts` |
| Modify auth rules | `lib/auth/rbac.ts` (permissions) + `middleware.ts` (route protection) |
| Modify PHI encryption | `lib/db/encryption-extension.ts` (PHI_FIELDS map) |
| Modify Stripe flow | `lib/stripe/stripe-server.ts` + `app/api/webhooks/stripe/route.ts` |
| Modify validation | `lib/validation/schemas.ts` |
| Modify design tokens | `app/globals.css` (@theme inline section) |
| Modify security headers | `lib/constants.ts` (SECURITY_HEADERS) + `next.config.ts` |

### Architecture Decisions

- **Custom JWT** (not NextAuth): HIPAA requires full control over token content
- **Field-level encryption**: Prisma extension enables transparent encrypt/decrypt
- **Payment before signup**: Reduces abandoned signups; user created by webhook
- **Async messaging only**: Simpler HIPAA compliance; 24h physician SLA
- **California-only**: Regulatory simplicity for initial launch
