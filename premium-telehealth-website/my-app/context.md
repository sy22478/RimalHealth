# Rimal Health — Project Context

## Overview

HIPAA-compliant telehealth platform for medication-assisted treatment of alcohol use disorder (AUD) with Naltrexone, serving California residents. Flat-fee pricing: $50/month active treatment, $25/month maintenance.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS v4, shadcn/ui, Prisma ORM, PostgreSQL (Neon), Redis

---

## Auth Flow (httpOnly Cookies)

Authentication uses custom JWT — **not** NextAuth.

1. **Login:** `POST /api/auth/login` validates credentials, returns user data, sets two httpOnly cookies:
   - `accessToken` (15-min expiry) — JWT containing `{ userId, email, role }`
   - `refreshToken` (7-day expiry) — opaque token for refresh
2. **Auth check:** Client calls `GET /api/auth/me` which reads `accessToken` cookie, verifies JWT, returns `{ user }`.
3. **Refresh:** `POST /api/auth/refresh` reads `refreshToken` from cookie (or body), issues new access token.
4. **Logout:** `POST /api/auth/logout` clears both cookies.
5. **Middleware:** `middleware.ts` extracts JWT from cookie, enforces role-based route access, injects `x-user-id`, `x-user-role`, `x-user-email` headers for API routes.

**Roles:** `PATIENT`, `PHYSICIAN`, `ADMIN`

**Physician onboarding:** Admin creates physician record → generates one-time secret key → physician uses key + email to verify at `/physician/login` → gains access.

---

## Route Structure

### Marketing (public)
`app/(marketing)/` — Shared nav/footer layout
- `/` — Homepage
- `/about`, `/how-it-works`, `/pricing`, `/faq`, `/contact`
- `/alcohol-treatment`
- `/privacy`, `/terms`, `/hipaa`
- `/get-started`, `/payment`

### Auth
`app/(auth)/` — Minimal layout (no nav)
- `/login`, `/signup`

### Patient Portal
`app/patient/` — Sidebar layout with auth guard
- `/patient/dashboard` — Overview, intake status, prescriptions
- `/patient/messages` — Async messaging with physicians
- `/patient/prescriptions` — Active prescriptions, refill requests
- `/patient/documents` — Upload/view documents (ID, insurance)
- `/patient/billing` — Subscription management, invoices
- `/patient/profile/settings` — Personal info, notification preferences
- `/patient/settings` — Account settings

### Physician Portal
`app/physician/` — Two sub-groups:
- `(auth)/login` — Physician login (no layout)
- `(portal)/*` — Authenticated layout with sidebar:
  - `/physician/dashboard` — Stats, recent activity
  - `/physician/patients` — Patient list
  - `/physician/reviews` — Intake review queue
  - `/physician/prescriptions` — Prescription management
  - `/physician/messages` — Patient messaging
  - `/physician/settings` — Account settings

### Admin Portal
`app/admin/` — Admin layout with sidebar
- `/admin/dashboard` — Overview
- `/admin/physicians` — Physician management (list, filter, actions)
- `/admin/physicians/pending` — Pending authorization queue
- `/admin/physicians/[id]` — Physician detail (overview, reviews, auth history)

### Intake Flow
`app/intake/` — Multi-step intake form wizard
- Alcohol: AUDIT-C screening
- Auto-save to sessionStorage (PHI never in localStorage)

### Checkout
`app/checkout/` — Stripe-powered payment flow

---

## Database (Prisma + Neon PostgreSQL)

### Key Models

| Model | Purpose | PHI |
|-------|---------|-----|
| `User` | Auth, roles (PATIENT/PHYSICIAN/ADMIN) | Email |
| `PatientProfile` | Demographics, medical history, address | Yes (AES-256-GCM encrypted) |
| `Physician` | Credentials (NPI, license), status, stats | No |
| `Intake` | Form submissions, risk scoring | Yes (encrypted JSON) |
| `Review` | Physician intake reviews, decisions | Yes |
| `Prescription` | Medications, dosage, pharmacy, refills | Yes |
| `Message` | Patient-physician async messaging | Yes |
| `Document` | S3-stored files (ID, insurance, records) | Yes |
| `Subscription` | Stripe subscription tracking | No |
| `Invoice` | Payment history, Stripe invoice IDs | No |
| `AuditLog` | Immutable HIPAA audit trail | Metadata only |
| `Pharmacy` | Pharmacy directory (NCPDP ID, address) | No |
| `PhysicianAuthorizationLog` | Admin actions on physician accounts | No |

### PHI Encryption
All PHI fields are encrypted at rest using AES-256-GCM via `encryptPHI()`/`decryptPHI()` from `lib/encryption/phi.ts`. The Prisma extension in `lib/db/encryption-extension.ts` handles this automatically for marked fields.

---

## Integrations

| Service | Purpose | Config |
|---------|---------|--------|
| **Stripe** | Subscriptions ($50/mo active, $25/mo maintenance), checkout, customer portal, webhooks | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| **DoseSpot** | e-Prescribing (Surescripts network) | `DOSESPOT_*` env vars; mock at `lib/integrations/dosespot.mock.ts` for dev |
| **SendGrid** | Transactional email (password reset, notifications) | `SENDGRID_API_KEY` |
| **Twilio** | SMS notifications | `TWILIO_*` env vars |
| **AWS S3** | Document storage (encrypted at rest) | `AWS_*` env vars |
| **Redis** | Session store, rate limiting, caching, account lockout | `REDIS_URL` |

---

## Test Accounts

| Email | Password | Role | Notes |
|-------|----------|------|-------|
| `patient.test@rimalhealth.test` | `TestPatient123@` | PATIENT | No subscription, no profile |
| `dr.sarah.johnson@rimalhealth.test` | `TestPhysician123!` | PHYSICIAN | ACTIVE status |
| `admin@rimalhealth.test` | `TestAdmin123!` | ADMIN | Full admin access |

---

## Deployment

- **Hosting:** Netlify (production at rimalhealth.com)
- **Database:** Neon Serverless PostgreSQL
- **Cache:** Redis (Upstash or similar)
- **CI:** `npm run build && npm run type-check` before deploy
- **Deploy command:** `netlify deploy --build --prod` (from `my-app/` directory)

### Environment Variables

Required:
- `NEXT_PUBLIC_APP_URL` — Production URL
- `DATABASE_URL` — Neon PostgreSQL connection string
- `JWT_SECRET` — JWT signing key
- `PHI_ENCRYPTION_KEY` / `ENCRYPTION_KEY` — AES-256 key for PHI encryption

Optional (for full functionality):
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `REDIS_URL`
- `SENDGRID_API_KEY`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`
- `DOSESPOT_CLINIC_ID`, `DOSESPOT_CLINIC_KEY`, `DOSESPOT_API_URL`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`

---

## Key Conventions

- **Tailwind v4:** No config file. Theme tokens in `app/globals.css` under `@theme inline`. Brand: `navy` (#0A2540), `ocean` (#0284C7).
- **Forms:** React Hook Form + Zod + `zodResolver`
- **API security:** Zod input validation, rate limiting (5 req/15 min on auth), CSRF protection
- **Audit logging:** Every PHI access must call `auditLogger.logPHIAccess(...)` or `auditLogger.logAuth(...)`
- **California only:** Service restricted to CA residents
- **Async messaging:** No real-time chat; physicians respond within 24 hours
- **One active intake:** Patient can only have one active intake at a time
