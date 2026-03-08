# Rimal Health - AI Coding Agent Guide

> **Project:** Premium Telehealth Addiction Treatment Platform  
> **Location:** `/Users/sonuyadav/RimalHealth/premium-telehealth-website/my-app`  
> **Language:** English (US)  
> **Last Updated:** 2026-03-02

---

## 1. Project Overview

**Rimal Health** is a HIPAA-compliant telehealth platform providing medication-assisted treatment for alcohol use disorder (AUD) with Naltrexone. The platform exclusively serves California residents.

### Key Value Propositions
- **$50/month** flat fee for active treatment (vs $200-400/month traditional)
- **$25/month** maintenance plan after treatment completion
- **24-hour** physician review (vs 3-7 days traditional)
- **No appointments** - asynchronous messaging-based care
- California-licensed physicians only
- Direct-to-pharmacy e-prescribing

### Business Model
| Tier | Price | Description |
|------|-------|-------------|
| Active Treatment | $50/month | During active treatment |
| Maintenance | $25/month | After treatment completion |
| Medications | $10-50/month | At pharmacy, insurance accepted |

---

## 2. Technology Stack

### Core Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.6 | React framework with App Router |
| React | 19.2.3 | UI library |
| TypeScript | 5.x | Type safety (strict mode enabled) |
| Node.js | 20+ | Runtime (engines: >=18.0.0) |

### Styling & UI
| Technology | Version | Purpose |
|------------|---------|---------|
| Tailwind CSS | 4.x | Utility-first CSS (no config file) |
| shadcn/ui | latest | UI component library ("new-york" style) |
| Framer Motion | 12.x | Animations |
| Lucide React | 0.574.0 | Icons |
| class-variance-authority | 0.7.1 | Component variants |
| tailwind-merge | 3.4.1 | Class merging |

### Forms & Validation
| Technology | Version | Purpose |
|------------|---------|---------|
| React Hook Form | 7.x | Form state management |
| Zod | 4.x | Schema validation |
| @hookform/resolvers | 5.x | Form resolver integration |

### Database & Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| PostgreSQL | 15 | Primary database |
| Prisma | 7.4.1 | ORM with client extensions |
| Redis | 7 | Sessions, cache, rate limiting |
| pg | 8.18.0 | PostgreSQL driver |
| @prisma/adapter-pg | 7.4.1 | Prisma PostgreSQL adapter |

### Security & Encryption
| Technology | Purpose |
|------------|---------|
| AES-256-GCM | PHI encryption at rest |
| JWT (jose library) | Authentication tokens |
| bcrypt | Password hashing (12 rounds) |
| CSRF tokens | Form protection |

### External Integrations
| Service | Purpose |
|---------|---------|
| **Stripe** | Payments and subscriptions |
| **DoseSpot** | E-prescribing (Surescripts) |
| **AWS S3** | Document storage |
| **SendGrid** | Email delivery |
| **Twilio** | SMS notifications |
| **Google Analytics 4** | Analytics |

### Testing
| Technology | Version | Purpose |
|------------|---------|---------|
| Vitest | 4.x | Unit and integration tests |
| Playwright | 1.58.2 | E2E tests |
| @vitest/coverage-v8 | 4.x | Test coverage |
| supertest | 6.3.4 | HTTP assertion library |
| jsdom | 28.1.0 | DOM environment for tests |

---

## 3. Project Structure

```
premium-telehealth-website/my-app/
├── app/                              # Next.js App Router
│   ├── (marketing)/                  # Marketing site routes (public)
│   │   ├── page.tsx                  # Homepage
│   │   ├── about/
│   │   ├── alcohol-treatment/
│   │   ├── how-it-works/
│   │   ├── pricing/
│   │   ├── faq/
│   │   ├── contact/
│   │   ├── privacy/
│   │   ├── terms/
│   │   ├── hipaa/
│   │   └── get-started/              # Intake form entry
│   ├── (auth)/                       # Authentication routes
│   │   ├── login/
│   │   └── signup/
│   ├── (patient)/                    # Patient portal (protected)
│   │   ├── dashboard/
│   │   ├── messages/
│   │   ├── prescriptions/
│   │   ├── documents/
│   │   ├── billing/
│   │   └── profile/settings/
│   ├── patient/                      # Legacy patient routes (redirects)
│   ├── physician/                    # Physician portal (PHYSICIAN only)
│   │   ├── dashboard/
│   │   ├── queue/
│   │   ├── patients/
│   │   ├── messages/
│   │   └── prescriptions/
│   ├── checkout/                     # Payment flow
│   ├── intake/                       # Intake form wizard
│   ├── profile/setup/                # Profile completion
│   ├── api/                          # API routes
│   │   ├── auth/                     # Authentication endpoints
│   │   ├── patient/                  # Patient API
│   │   ├── physician/                # Physician API
│   │   ├── stripe/                   # Stripe integration
│   │   └── webhooks/                 # Webhook handlers
│   ├── layout.tsx                    # Root layout
│   ├── globals.css                   # Global styles + Tailwind v4 theme
│   ├── sitemap.ts                    # SEO sitemap
│   ├── robots.ts                     # SEO robots.txt
│   ├── icon.tsx                      # Dynamic favicon
│   └── opengraph-image.tsx           # OG image
├── components/
│   ├── ui/                           # shadcn/ui components
│   ├── layout/                       # Layout components (Navigation, Footer)
│   ├── sections/                     # Page sections (Hero, Features, etc.)
│   ├── forms/                        # Form components
│   ├── animations/                   # Animation components
│   ├── patient/                      # Patient portal components
│   ├── physician/                    # Physician portal components
│   ├── marketing/                    # Marketing site components
│   └── a11y/                         # Accessibility components
├── lib/                              # Utilities and business logic
│   ├── utils.ts                      # cn() helper
│   ├── constants.ts                  # Site config, security constants
│   ├── auth/                         # Authentication (JWT, passwords, RBAC)
│   ├── db/                           # Database (Prisma, encryption)
│   ├── encryption/                   # PHI encryption utilities
│   ├── redis/                        # Redis client, sessions, cache
│   ├── hipaa/                        # HIPAA compliance utilities
│   ├── audit/                        # Audit logging
│   ├── security/                     # CSRF, rate limiting, sanitization
│   ├── integrations/                 # Third-party APIs (Stripe, DoseSpot, S3)
│   ├── patient/                      # Patient business logic
│   ├── physician/                    # Physician business logic
│   ├── intake/                       # Intake form logic
│   ├── stripe/                       # Stripe-specific utilities
│   ├── notifications/                # Notification service
│   ├── services/                     # Shared services
│   ├── validation/                   # Validation schemas
│   └── middleware/                   # Custom middleware
├── prisma/
│   └── schema.prisma                 # Database schema
├── types/                            # TypeScript type definitions
├── hooks/                            # Custom React hooks
├── tests/                            # Test suites
│   ├── unit/                         # Unit tests (Vitest)
│   ├── integration/                  # Integration tests (Vitest)
│   └── e2e/                          # Playwright E2E tests
├── scripts/                          # Utility scripts
├── docker/                           # Docker configuration
│   ├── docker-compose.yml
│   └── Dockerfile
├── public/                           # Static assets
├── middleware.ts                     # Next.js middleware (auth protection)
├── package.json                      # Dependencies and scripts
├── next.config.ts                    # Next.js configuration
├── tsconfig.json                     # TypeScript configuration
├── eslint.config.mjs                 # ESLint configuration
├── vitest.config.ts                  # Vitest configuration
├── playwright.config.ts              # Playwright configuration
├── postcss.config.mjs                # PostCSS (Tailwind v4)
├── components.json                   # shadcn/ui configuration
└── .env.example                      # Environment template
```

---

## 4. Build and Development Commands

```bash
# Navigate to app directory
cd premium-telehealth-website/my-app

# Install dependencies
npm install

# Start development server
npm run dev
# Server runs on http://localhost:3000

# Start with Turbopack (faster)
npm run dev:turbo

# Build for production
npm run build

# Start production server
npm start

# Run ESLint
npm run lint
npm run lint:fix

# Type checking
npm run type-check

# Code formatting
npm run format
npm run format:check
```

### Database Commands
```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Deploy migrations (production)
npm run db:deploy

# Open Prisma Studio
npm run db:studio

# Seed database
npm run db:seed

# Validate schema
npm run db:validate

# Format schema
npm run db:format
```

### Testing Commands
```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run E2E with UI
npm run test:e2e:ui

# Run smoke tests
npm run test:smoke

# Run performance tests
npm run test:perf

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Utility Commands
```bash
# Clear cache
npm run cache:clear

# Clean build artifacts
npm run clean

# Security audit
npm run security:audit

# Health check
npm run health-check

# Deploy (production)
npm run deploy

# Backup database
npm run backup
```

---

## 5. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local
```

### Required Environment Variables
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_APP_URL` | Application URL (e.g., https://rimalhealth.com) |
| `NEXT_PUBLIC_APP_NAME` | Application name |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret (64 hex chars) |
| `PHI_ENCRYPTION_KEY` or `ENCRYPTION_KEY` | AES-256-GCM key (32-byte base64) |
| `SESSION_SECRET` | Session signing secret |
| `REDIS_URL` | Redis connection string |

### Optional Integrations
| Variable | Service |
|----------|---------|
| `RESEND_API_KEY` | Email (Resend) |
| `SENDGRID_API_KEY` | Email (SendGrid) |
| `STRIPE_SECRET_KEY` | Payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhooks |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe client-side |
| `TWILIO_ACCOUNT_SID` | SMS |
| `TWILIO_AUTH_TOKEN` | SMS |
| `TWILIO_PHONE_NUMBER` | SMS |
| `AWS_ACCESS_KEY_ID` | S3 Storage |
| `AWS_SECRET_ACCESS_KEY` | S3 Storage |
| `AWS_S3_BUCKET_NAME` | S3 Storage |
| `AWS_REGION` | S3 Storage |
| `DOSESPOT_CLIENT_ID` | E-prescribing |
| `DOSESPOT_CLIENT_SECRET` | E-prescribing |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics |

### Generate Secrets
```bash
# JWT/Session Secret (64 hex chars)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# PHI Encryption Key (32-byte base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Docker Development
```bash
# Start all services (app, PostgreSQL, Redis)
docker-compose -f docker/docker-compose.yml up

# Run in background
docker-compose -f docker/docker-compose.yml up -d

# View logs
docker-compose -f docker/docker-compose.yml logs -f app

# Stop services
docker-compose -f docker/docker-compose.yml down
```

---

## 6. Code Style Guidelines

### TypeScript Rules
- **Strict mode enabled** - no `any` without justification
- **Explicit return types** on all functions
- **Props interfaces** for all components
- Use `type` for unions, `interface` for objects

```typescript
// ✅ GOOD
interface User {
  id: string;
  email: string;
  role: 'PATIENT' | 'PHYSICIAN' | 'ADMIN';
}

async function getUser(id: string): Promise<User | null> {
  // Implementation
}

// ❌ BAD
function getUser(id) {
  return db.user.findById(id);
}
```

### React Component Patterns
```typescript
'use client';  // When using hooks/browser APIs

import * as React from 'react';

interface ComponentProps {
  prop1: string;
  prop2?: boolean;
}

export function Component({ prop1, prop2 = false }: ComponentProps) {
  return <div>{prop1}</div>;
}
```

### Styling with Tailwind v4
- Use **design system tokens** from `globals.css` `@theme inline` block
- Use **custom brand colors**: `navy`, `ocean`, `success`, `warning`
- Use **component classes** defined in `@layer components`
- Use `cn()` utility for conditional classes

```typescript
// ✅ GOOD - Use design tokens
<button className="btn-primary">
  Get Started
</button>

// ❌ BAD - Arbitrary values
<button className="bg-blue-500 px-4 py-2 rounded">
  Click me
</button>
```

### File Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `PatientCard.tsx` |
| Hooks | camelCase with `use` | `useAuth.ts` |
| Utilities | camelCase | `formatDate.ts` |
| API Routes | kebab-case folder, route.ts | `api/contact/route.ts` |
| Types | PascalCase | `patient.types.ts` |

---

## 7. Form Development Guidelines

Use **React Hook Form + Zod** for all forms:

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Please enter a valid email'),
  password: z.string()
    .min(12, 'Password must be at least 12 characters'),
});

type FormData = z.infer<typeof schema>;

export function MyForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* form fields */}
    </form>
  );
}
```

---

## 8. Security & HIPAA Compliance

### PHI (Protected Health Information)
**NEVER:**
- Log PHI to console or files
- Include PHI in error messages
- Store PHI unencrypted
- Send PHI over unencrypted channels
- Include PHI in URLs or query params
- Cache PHI in browser storage
- Include PHI in JWT tokens

**ALWAYS:**
- Encrypt PHI at rest using AES-256-GCM
- Use TLS 1.3 for transmission
- Audit all PHI access
- Validate need-to-know before access

### PHI Fields (Encrypted)
- Name (first, last), Date of Birth
- Address, Phone, Email
- Medical history, medications
- Intake form data
- Messages with doctors
- Prescription details

### Encryption Usage
```typescript
import { encryptPHI, decryptPHI } from '@/lib/encryption/phi';

// Encrypt before storing
const encryptedEmail = encryptPHI(patient.email);

// Decrypt after retrieving
const email = decryptPHI(encryptedEmail);
```

### API Security
- Validate JWT on every protected request
- Use Zod for input validation
- Rate limiting on auth endpoints (5 requests/15 min)
- CSRF protection on forms
- Secure headers configured (CSP, HSTS, etc.)

### Authentication
- Access tokens: 15-minute expiry
- Refresh tokens: 7-day expiry with versioning
- Passwords: bcrypt with 12 rounds
- MFA for physician accounts (planned)

### Security Headers
Configured in `next.config.ts` and `lib/constants.ts`:
- Content-Security-Policy
- X-Frame-Options: DENY
- Strict-Transport-Security
- X-Content-Type-Options: nosniff

---

## 9. Key Business Rules

1. **24-Hour SLA:** MD must review intake within 24 hours
2. **California Only:** Service restricted to CA residents (ZIP codes 90000-96199)
3. **One Active Intake:** Patient can only have one active intake at a time
4. **Payment First:** Intake review only starts after payment confirmed
5. **Refill Window:** Refill requests allowed 7 days before running out
6. **Message Response:** MD responds within 24 hours (async)
7. **All MDs See All Patients:** No patient assignment restrictions

---

## 10. User Roles & Permissions

| Action | Admin | Physician | Patient |
|--------|-------|-----------|---------|
| View All Patients | ✓ | ✓ | ✗ |
| View Own Profile | ✓ | ✓ | ✓ |
| Edit Patient Data | ✓ | Limited | Own only |
| Send Prescriptions | ✗ | ✓ | ✗ |
| Review Intakes | ✗ | ✓ | ✗ |
| Message Patients | ✓ | ✓ | Own MD only |
| Manage Billing | ✓ | ✗ | Own only |
| Cancel Subscription | ✓ | ✗ | Own only |
| Access Admin Panel | ✓ | ✗ | ✗ |

---

## 11. Testing Strategy

### Test Structure
```
tests/
├── unit/                    # Unit tests (Vitest)
│   ├── lib/
│   ├── components/
│   └── auth/
├── integration/             # Integration tests (Vitest)
│   ├── api/
│   ├── database/
│   └── setup.ts
└── e2e/                     # E2E tests (Playwright)
    ├── auth/
    ├── patient/
    ├── physician/
    ├── setup/
    │   ├── global-setup.ts
    │   └── global-teardown.ts
    └── fixtures/
```

### Priority Tests (P0 - Must Have)
1. Authentication flows (login, logout, password reset)
2. Payment processing (Stripe integration)
3. PHI access controls (role-based data access)
4. Encryption/decryption roundtrips

### Priority Tests (P1 - Should Have)
1. Form validations (input validation, error messages)
2. API endpoints (CRUD operations, error handling)
3. Database operations with encryption

### Priority Tests (P2 - Nice to Have)
1. UI components (rendering, interactions)
2. Animation behavior

---

## 12. Current Implementation Status

### ✅ Completed
- Marketing site with 17+ pages
- Responsive design with Tailwind v4
- shadcn/ui component integration
- Contact form with Resend email
- Intake form with multi-step wizard
- SEO: sitemap, robots, OG images, JSON-LD
- Accessibility: skip links, ARIA labels
- Animations with Framer Motion
- PHI encryption utilities (AES-256-GCM)
- JWT authentication utilities
- Prisma schema with PHI encryption extension
- RBAC (Role-Based Access Control) utilities
- Patient portal (dashboard, messages, prescriptions, billing)
- Physician portal (queue, patient review, messaging)
- Stripe payment integration
- AWS S3 document upload
- HIPAA audit logging
- Rate limiting and CSRF protection
- Docker development environment
- CI/CD pipeline (GitHub Actions)
- Comprehensive test suite (unit, integration, E2E)

### ⏳ Planned / In Progress
- DoseSpot e-prescribing integration (mock mode available)
- Twilio SMS notifications
- Admin panel
- Analytics dashboard
- Production deployment automation

---

## 13. Database Schema Overview

### Core Models
- **User** - Authentication and roles
- **PatientProfile** - PHI-encrypted patient data
- **Physician** - Provider credentials
- **Intake** - Patient intake forms (encrypted)
- **Review** - Physician review decisions
- **Prescription** - Medication prescriptions
- **Message** - Patient-physician messaging (encrypted)
- **Document** - Patient documents in S3
- **Subscription** - Stripe billing
- **Invoice** - Billing records
- **AuditLog** - HIPAA audit trail
- **Pharmacy** - Pharmacy directory

All PHI fields are encrypted using AES-256-GCM before storage.

---

## 14. Performance Guidelines

- Use `select` to limit database fields
- Don't include unnecessary data in API responses
- Optimize and lazy-load images
- Use `React.memo` for expensive renders
- Use edge runtime where possible
- Implement ISR caching for static pages (60s SWR)
- Bundle optimization via webpack chunks
- Font optimization with `next/font`

---

## 15. Accessibility Requirements

- WCAG 2.1 AA compliance target
- Skip-to-content link on all pages
- `aria-label` on interactive elements
- `aria-expanded` on collapsible content
- Focus visible states with 2px outline (ocean-600)
- Keyboard navigation support
- Screen reader announcements via Announcer component
- Print styles for patient records

---

## 16. Git Workflow

### Branch Naming
```
feature/patient-messaging
fix/prescription-status
docs/api-update
test/auth-flows
```

### Commit Messages
```
feat: add patient messaging
fix: correct prescription status display
docs: update API documentation
test: add auth flow tests
refactor: simplify patient query
security: encrypt PHI fields
```

### No PHI in Git
- Never commit real patient data
- Never commit test data with real names
- Never commit database dumps with PHI
- Never commit log files with PHI
- Never commit `.env` files

---

## 17. Deployment

### Production Deployment
Deployed via GitHub Actions to Vercel:

1. Push to `main` branch triggers deployment workflow
2. Runs full test suite (lint, type-check, unit, integration)
3. Security scan with npm audit and Trivy
4. Build and deploy to Vercel
5. Run database migrations
6. Health check verification
7. Smoke tests
8. Slack notification on success/failure

### Environment Requirements
- [ ] Environment variables configured
- [ ] SSL certificate installed
- [ ] Domain configured
- [ ] Stripe webhooks configured
- [ ] SendGrid domain verified
- [ ] AWS S3 bucket configured
- [ ] DoseSpot credentials configured
- [ ] Database migrations run
- [ ] Redis cache configured
- [ ] Monitoring enabled
- [ ] Backups configured

### Build Output
```bash
cd premium-telehealth-website/my-app
npm run build
# Output: .next/ directory (standalone mode for Docker)
```

---

## 18. Documentation References

| Document | Purpose | Location |
|----------|---------|----------|
| `CLAUDE.md` | Quick reference for Claude Code | `/Users/sonuyadav/RimalHealth/CLAUDE.md` |
| `PROJECT.md` | Vision, business model, requirements | `/Users/sonuyadav/RimalHealth/premium-telehealth-website/PROJECT.md` |
| `PLAN.md` | Implementation tasks and phases | `/Users/sonuyadav/RimalHealth/premium-telehealth-website/PLAN.md` |
| `STATE.md` | Current implementation status | `/Users/sonuyadav/RimalHealth/premium-telehealth-website/STATE.md` |
| `api-spec.md` | API endpoint specifications | `/Users/sonuyadav/RimalHealth/premium-telehealth-website/api-spec.md` |
| `context.md` | Business rules and user flows | `/Users/sonuyadav/RimalHealth/premium-telehealth-website/context.md` |
| `docs/security-audit-report.md` | Security audit findings | `/Users/sonuyadav/RimalHealth/premium-telehealth-website/docs/` |

---

**Questions?** Refer to the documentation in `/premium-telehealth-website/docs/` directory or check the specific component files for implementation details.
