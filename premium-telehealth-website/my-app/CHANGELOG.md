# Changelog

All notable changes to the Rimal Health website are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased] — 2026-03-05
*Changes made by Claude Code — Auth hardening, physician portal restructure, mock data removal, patient billing*

### Added

- **`app/physician/(auth)/login/page.tsx`** — Physician login page moved into `(auth)` route group so it renders without the physician portal layout. Previously inaccessible when another role was logged in (parent layout rejected non-physician tokens).
- **`app/physician/(portal)/`** — New route group containing all physician portal pages (dashboard, queue, intake review, patients, prescriptions, reviews, messages, settings) with a shared auth-checking layout.
- **`app/physician/(portal)/layout.tsx`** — Server-component layout that reads `accessToken` from httpOnly cookie, calls `verifyAccessToken`, and redirects to `/physician/login` if unauthenticated or to `/unauthorized` if role is not `PHYSICIAN`/`ADMIN`. Replaces the old unprotected `app/physician/layout.tsx`.
- **`app/physician/(portal)/settings/page.tsx`** — New physician settings page (was 404). Displays physician profile info and allows password change via `PhysicianSettingsClient`.
- **`app/physician/(portal)/settings/PhysicianSettingsClient.tsx`** — Client component for physician settings: profile card (name, email, specialty, license) + change-password form both wired to real API endpoints.
- **`app/api/physician/profile/route.ts`** — New GET endpoint returning the authenticated physician's profile data (name, email, specialty, licenseNumber, state, physicianId).
- **`app/patient/billing/page.tsx`** — Patient billing page at the correct `/patient/billing` URL (within the patient layout). The existing billing client lived at `app/(patient)/billing/page.tsx` which resolved to `/billing` without a layout.
- **`app/patient/settings/page.tsx`** — Patient account settings page (was 404).
- **`app/patient/profile/settings/page.tsx`** — Patient profile settings page (Personal Info, Password, Notifications, Privacy tabs).
- **`public/icon.svg`** — Rimal Health favicon as an SVG (navy background, ocean-blue "R").
- **`prisma/migrations/20260305050807_add_physician_status_and_auth/`** — Migration adding `status` (PENDING/INVITED/ACTIVE/INACTIVE), `authorizedBy`, `authorizedAt`, `secretKeyHash`, `secretKeyExpiry`, `secretKeyUsedAt` columns to the `Physician` table.

### Changed

- **`middleware.ts`** — Added `/physician/login` to `PUBLIC_ROUTES` so the physician login page is accessible regardless of auth state.
- **`app/patient/layout.tsx`** — Added **Billing** nav item (CreditCard icon, `/patient/billing`) between Documents and Profile in the sidebar and mobile nav.
- **`app/api/auth/login/route.ts`** — Added full physician authorization flow: checks `physician.status` (rejects PENDING, INACTIVE); handles `INVITED` status by verifying a one-time secret key and activating the account (`status → ACTIVE`, logs a `PhysicianAuthorizationLog` record). All Redis calls (IP rate limit, account lockout) wrapped in try/catch as fail-safe — login proceeds if Redis is unavailable.
- **`app/api/auth/logout/route.ts`** — Changed response from JSON `{ success: true }` to `NextResponse.redirect('/login')` so the Sign Out button works correctly from the browser.
- **`lib/auth/require-auth.ts`** — Added `request.cookies.get('accessToken')` as a third auth source (after `Authorization` header and `x-user-id` injected header). Required because Next.js middleware skips `/api/*` routes, so the `x-user-*` headers are never set for API calls — the cookie is the reliable fallback.
- **`lib/redis/client.ts`** — Added connection error handling; Redis errors no longer crash the process.
- **`app/api/patient/billing/route.ts`** — Replaced hardcoded `userId: 'mock-user-id'` with real JWT verification via `requireAuth`. Billing data now returned for the authenticated user.
- **`app/api/patient/billing/cancel/route.ts`** — Same mock auth replaced with real JWT + cookie auth.
- **`app/api/patient/billing/invoices/route.ts`** — Same mock auth replaced.
- **`app/api/patient/billing/invoices/[id]/download/route.ts`** — Same mock auth replaced.
- **`app/api/patient/billing/portal/route.ts`** — Same mock auth replaced.
- **`app/api/patient/onboarding/start/route.ts`** — Added cookie fallback to auth check.
- **`app/api/patient/onboarding/complete/route.ts`** — Added cookie fallback to auth check.
- **`app/api/patient/prescriptions/route.ts`** — Added cookie fallback to auth check.
- **`app/api/patient/prescriptions/[id]/route.ts`** — Added cookie fallback; removed unused mock prescriptions.
- **`app/api/patient/profile/[id]/route.ts`** — Added cookie fallback to auth check.
- **`app/api/patient/profile/password/route.ts`** — Added cookie fallback to auth check.
- **`app/api/patient/profile/preferences/route.ts`** — Added cookie fallback to auth check.
- **`app/api/stripe/customer-portal/route.ts`** — Added cookie fallback to auth check.
- **`app/api/stripe/subscription/route.ts`** — Added cookie fallback to auth check.
- **`app/api/physician/queue/route.ts`** — Removed `getMockQueueData()` fallback; queue now returns real DB data only (empty array when no intakes present).
- **`app/physician/(portal)/dashboard/page.tsx`** — Replaced all hardcoded mock stats and queue/prescription arrays with server-side API fetches using the forwarded auth cookie.
- **`app/physician/(portal)/patients/page.tsx`** — Replaced 8 hardcoded fake patients with real `/api/physician/patients` fetch.
- **`app/physician/(portal)/prescriptions/page.tsx`** — Replaced 8 fake prescriptions with real `/api/physician/prescriptions` fetch.
- **`app/physician/(portal)/reviews/page.tsx`** — Replaced 8 fake reviews with real `/api/physician/queue` fetch.
- **`app/physician/(portal)/messages/MessagesClient.tsx`** — Replaced fake colleague message threads with real `/api/physician/messages` fetch.
- **`components/sections/Pricing.tsx`** — Removed Maintenance plan ($25/month) card. Active Treatment ($50/month) is now the only plan shown. CTA links updated to `/checkout/payment?plan=active-treatment`.
- **`components/layout/Navigation.tsx`** — Accessibility and mobile nav improvements.
- **`components/patient/ProfileSettings.tsx`**, **`PersonalInfoForm.tsx`**, **`ChangePasswordForm.tsx`**, **`NotificationPreferences.tsx`**, **`PrivacySettings.tsx`** — Wired to real API endpoints; removed static/mock data.

### Removed

- **`app/physician/layout.tsx`** — Old unprotected physician layout (replaced by `app/physician/(portal)/layout.tsx`).
- **`app/physician/login/page.tsx`** — Moved to `app/physician/(auth)/login/page.tsx`.
- **`app/physician/PhysicianNavClient.tsx`** — Moved to `app/physician/(portal)/PhysicianNavClient.tsx`.
- **`app/physician/dashboard/page.tsx`**, **`queue/`**, **`intake/`**, **`patients/`**, **`prescriptions/`**, **`reviews/`**, **`messages/`** — All moved into `app/physician/(portal)/`.

---

## [Unreleased] — 2026-02-18
*Changes made by Claude Code (continuing from the Qoder initial build)*

### Added

- **`app/sitemap.ts`** — Next.js App Router sitemap generator. Produces `/sitemap.xml` at build time covering all 12 marketing routes with per-route `priority` and `changeFrequency` values (homepage 1.0, treatment/get-started 0.9, legal pages 0.4–0.5).
- **`app/robots.ts`** — Next.js App Router robots file. Produces `/robots.txt` allowing all user agents to crawl `/` while disallowing `/api/`, and references the sitemap URL.
- **`components/JsonLd.tsx`** — Server component that injects a `MedicalBusiness` JSON-LD schema into `<head>`. Includes `name`, `description`, `url`, `email`, `areaServed` (California), `medicalSpecialty`, `availableService` (alcohol + tobacco treatment), `priceRange`, and `hasCredential`. Consumed by `app/layout.tsx`.
- **`components/Analytics.tsx`** — Server component that conditionally loads Google Analytics 4 via `next/script` with `strategy="afterInteractive"`. Only renders if `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set; otherwise returns `null`. Consumed by `app/layout.tsx`.
- **`app/api/contact/route.ts`** — POST handler for the contact form. Validates the request body with a Zod schema server-side, then uses the Resend API (`RESEND_API_KEY`) to email the message to `CONTACT_FORM_TO_EMAIL`. Gracefully no-ops (returns `{ success: true }`) when `RESEND_API_KEY` is absent so the form works in development. Does not log PHI.
- **`app/api/intake/route.ts`** — POST handler for the intake form. Validates PHI-containing fields server-side with Zod, sends a structured clinical intake summary to the support email (via Resend), and sends a patient confirmation email. Gracefully no-ops when `RESEND_API_KEY` is absent. The clinical email is required; the patient confirmation is non-critical (catch-only). Never logs PHI.
- **`components/forms/ContactForm.tsx`** — HIPAA-aware contact form with four fields: full name, email address, subject (select: general / billing / technical / medical), and message. Built with React Hook Form + Zod v4; features Framer Motion animated inline error messages, a loading spinner on submit, and an animated success confirmation state. Includes a privacy note linking to `/privacy`.
- **`app/(marketing)/contact/page.tsx`** — Contact page. Renders `ContactForm` alongside a three-item contact-details strip (email address, 24-hour response time, HIPAA-secure note) and a PHI-safety disclaimer advising users not to submit health information through this form.
- **`app/(marketing)/privacy/page.tsx`** — Full Privacy Policy page covering: what data we collect (personal, health/PHI, payment, usage), how it is used, HIPAA compliance obligations, information-sharing rules, data-security measures, cookie policy, and user rights (access, amendment, deletion, opt-out).
- **`app/(marketing)/terms/page.tsx`** — Terms of Service page covering: service description, eligibility requirements (18+, California resident, not in acute withdrawal), billing and cancellation, emergency-care disclaimer, user responsibilities, medical disclaimer, intellectual property, limitation of liability, and governing law (California).
- **`app/(marketing)/hipaa/page.tsx`** — HIPAA Notice of Privacy Practices, required by federal law. Covers: our duties under HIPAA, permitted uses and disclosures (treatment, payment, operations, legal requirements), uses requiring written authorization, special protections for substance use disorder records under 42 CFR Part 2, all six patient rights (access, amendment, accounting, restrictions, confidential communications, paper copy), complaint procedures, and Privacy Officer contact.
- **`app/(marketing)/about/layout.tsx`** — Nested route layout exporting per-page `Metadata` (`title`, `description`) for the About page, enabling the root `%s | Rimal Health` title template without converting the client component page to a server component.
- **`app/(marketing)/alcohol-treatment/layout.tsx`** — Per-route metadata layout for the Alcohol Treatment page.
- **`app/(marketing)/faq/layout.tsx`** — Per-route metadata layout for the FAQ page.
- **`app/(marketing)/how-it-works/layout.tsx`** — Per-route metadata layout for the How It Works page.
- **`app/(marketing)/pricing/layout.tsx`** — Per-route metadata layout for the Pricing page.
- **`app/(marketing)/smoking-cessation/layout.tsx`** — Per-route metadata layout for the Smoking Cessation page.
- **`.env.example`** — Documented environment variable template (safe to commit). Sections: Application (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`), Email/Contact (Resend API key, recipient), Analytics (GA4, PostHog), Feature Flags (`NEXT_PUBLIC_ENABLE_INTAKE`), Payment (Stripe publishable/secret/webhook keys), Database (`DATABASE_URL`).

### Changed

- **`app/layout.tsx`** — Root metadata title changed from the flat string `"Premium Telehealth | Medication-Assisted Treatment for Alcohol & Smoking"` to a title object `{ default: "Rimal Health | Medication-Assisted Addiction Treatment", template: "%s | Rimal Health" }` so per-page titles compose correctly. Added `openGraph.siteName: "Rimal Health"` and a `twitter` card block. Added a skip-to-content `<a href="#main-content">` link (visually hidden, visible on keyboard focus) for WCAG keyboard accessibility. Added `<JsonLd />` and `<Analytics />` to `<body>`.
- **`app/(marketing)/layout.tsx`** — Added `id="main-content"` to `<main>` to serve as the skip-link target.
- **`app/(marketing)/page.tsx`** — Added explicit `Metadata` export (`title`, `description`) to the server-component homepage, taking advantage of the new title template.
- **`components/sections/Pricing.tsx`** — Added Framer Motion `whileInView` / `viewport={{ once: true }}` animations to the section heading, the Active Treatment card, the Maintenance card, and the fine-print note. This was the only homepage section that had no scroll-reveal animations.
- **`lib/constants.ts`** — Footer `company` links: removed the placeholder `Blog` entry (linked to `#`), updated `Contact` from `#` to `/contact`. Footer `legal` links: all three (`Privacy Policy`, `Terms of Service`, `HIPAA Notice`) updated from `#` to `/privacy`, `/terms`, `/hipaa` respectively.
- **`components/forms/ContactForm.tsx`** — `onSubmit` now POSTs to `/api/contact` instead of using `setTimeout`. Added a `submitError` state that renders a `role="alert"` error message if the API call fails.
- **`components/forms/IntakeForm.tsx`** — `onSubmit` now POSTs to `/api/intake` instead of using `setTimeout`. Added `isSubmitting` from `formState` to disable and show a spinner on the submit button during submission. Added `submitError` state rendered as a `role="alert"` message. Fixed three `href="#"` consent links to use real routes: `/privacy`, `/terms`, `/hipaa`.
- **`components/layout/Navigation.tsx`** — Mobile hamburger button: added dynamic `aria-label` ("Open menu" / "Close menu"), `aria-expanded`, and `aria-controls="mobile-menu"`. Mobile menu container: added `id="mobile-menu"`, `role="dialog"`, and `aria-label="Navigation menu"`. Backdrop overlay: added `aria-hidden="true"`.

### Fixed

- **`app/(marketing)/alcohol-treatment/page.tsx`** — Three `href="/intake"` anchor links (hero CTA, pricing reminder card, final CTA) corrected to `href="/get-started"`. The route `/intake` does not exist in the app; the correct intake route is `/get-started`.

---

## [0.1.0] — Initial Build
*Built by Qoder coding agent*

### Added

**Project foundation**
- Next.js 16.1.6 project bootstrapped with `shadcn@latest init` (new-york style, RSC-enabled, TypeScript strict mode).
- shadcn/ui primitive components installed: `accordion`, `avatar`, `badge`, `button`, `card`, `input`, `label`, `separator`, `tabs`, `textarea`.
- Runtime dependencies: `framer-motion`, `react-hook-form`, `@hookform/resolvers`, `zod`, `lucide-react`, `clsx`, `tailwind-merge`.
- Dev dependencies: `tailwindcss` v4, `@tailwindcss/postcss`, `tailwindcss-animate`, `tw-animate-css`, `typescript`, `eslint`, `eslint-config-next`, `shadcn`.
- **`app/globals.css`** — Complete design system implemented via **Tailwind CSS v4** `@theme inline {}` blocks (no `tailwind.config.ts` file, as required by v4). Defines: brand color tokens (`--color-navy: #0A2540`, `--color-ocean: #0284C7`, `--color-success: #10B981`, `--color-warning: #F59E0B`, `--color-soft-purple: #8B5CF6`), neutral scale (`--color-gray-50` through `--color-gray-900`), font-size tokens, border-radius tokens, keyframe animations (`accordion-down`, `accordion-up`, `fade-in-up`, `fade-in`), and reusable component utility classes (`.btn-primary` — blue gradient button with shadow/hover lift; `.btn-secondary` — white bordered button; `.card-hover` — white card with hover shadow/lift; `.section-padding` — responsive `py-16/24/32`; `.container-custom` — `max-w-7xl` centered container).
- **`app/layout.tsx`** — Root layout. Loads **Instrument Sans** (400/500/600/700) via `next/font/google` as `--font-instrument-sans`. Note: `--font-soehne` CSS variable maps to Instrument Sans as a fallback since Söhne is a commercial font.
- **`lib/constants.ts`** — Centralised site config object (`siteConfig`: name, description, URL, support email, license), navigation link array (`navLinks`), and footer link groups (`footerLinks.product / company / legal`).
- **`lib/utils.ts`** — `cn()` helper combining `clsx` and `tailwind-merge` for conditional class merging.
- **`tsconfig.json`** — Path alias `@/*` mapped to the project root (`premium-telehealth-website/my-app/*`).
- Directory structure: `app/(marketing)/`, `components/ui/`, `components/layout/`, `components/sections/`, `components/forms/`, `hooks/`, `lib/`, `types/`, `public/images/`.

**Shared layout components**
- **`app/(marketing)/layout.tsx`** — Route group layout wrapping all marketing pages with `<Navigation />` above and `<Footer />` below the `<main>` element.
- **`components/layout/Navigation.tsx`** — Sticky 80px top navbar. Left: wordmark logo linking to `/`. Centre: nav links (`How It Works`, `Pricing`, `FAQ`) sourced from `navLinks` constant. Right: `Get Started →` primary CTA button. Behaviour: `position: sticky`, scroll-triggered backdrop blur and drop shadow via `useEffect`/`useState`. Mobile: links collapse into a hamburger menu with slide-down drawer.
- **`components/layout/Footer.tsx`** — 4-column grid footer (Brand, Product, Company, Legal) sourced from `footerLinks` constant. Brand column: site name + tagline. All link columns: 14px text with `hover:text-ocean-500` transitions. Bottom bar: copyright (`© 2026 Rimal Health`), California Medical License placeholder, and `mailto:` support email link. Background: `bg-gray-50`.
- **`components/sections/SectionWrapper.tsx`** — Utility wrapper applying `.section-padding` and `.container-custom` with optional `className` override prop for per-section background colours.
- **`components/MedicalDisclaimer.tsx`** — Gray-background disclaimer block required on all treatment pages. Text: "This information is for educational purposes only and does not constitute medical advice. Always consult a qualified healthcare provider. In emergencies call 911."
- **`components/TrustBadges.tsx`** — Horizontal flex strip of three trust badges: ✓ California Medical Board Licensed, ✓ HIPAA Secure, ✓ 24hr Review. Icon size 16px, ocean-600 colour.

**Homepage sections**
- **`components/sections/Hero.tsx`** — Full-width centred hero, `min-h-[90vh]`. Headline: `"Get medication to quit drinking or smoking. No appointments. Just results."` (72px bold). Subheadline: physician/pharmacy/price statement (20px gray-600). CTA: `btn-primary` linking to `/get-started` + secondary text `"Takes 2 minutes →"`. Trust badges row below CTA. Background: white-to-gray-50 gradient with subtle SVG wave shape. Page-load staggered Framer Motion `fadeInUp` animation on all children.
- **`components/sections/HowItWorks.tsx`** — 3-column step grid (80px gap, collapses to single column on mobile). Each step: 48px icon inside `bg-ocean-500/10` circle, step number label, title, description. Dashed `<ArrowRight />` connector between steps (desktop only, positioned absolutely). Scroll-triggered Framer Motion animations with staggered 0.1s delays.
- **`components/sections/ValueProps.tsx`** — Full-width `bg-gradient-to-br from-ocean-500 to-blue-500` section, 100px vertical padding. Centred headline: "Built for busy people who want real solutions". 3-column grid: "No appointments", "$50/month", "Physician-prescribed". White text throughout. Framer Motion scroll animations with staggered delays.
- **`components/sections/Services.tsx`** — 2-card side-by-side grid. Card 1 (Alcohol): title, description, `Learn more →` link to `/alcohol-treatment`. Card 2 (Smoking): title, description, `Learn more →` link to `/smoking-cessation`. Card style: `bg-gradient-to-br from-gray-50 to-white`, border, `rounded-2xl`, hover lift (`hover:-translate-y-1`). Framer Motion scroll animations.
- **`components/sections/Proof.tsx`** — Dark `bg-gray-900` section, 96px padding. Headline: "1,200+ people helped". 5-stat grid: 75% reduction in drinking, 24 hours avg review, $60 typical monthly cost, 4.9/5 rating. Stats animate count-up on scroll via `useEffect` + `IntersectionObserver`. Testimonial below: quote from Sarah M., San Francisco.
- **`components/sections/Pricing.tsx`** — 2-card pricing grid (`max-w-3xl`). Active Treatment card: `border-2 border-ocean-500`, "Most popular" badge, $50/month, 5 feature items with `<Check />` icons, `btn-primary` CTA. Maintenance card: `border-gray-200`, $25/month, 4 feature items, `btn-secondary` CTA. Fine print: medication cost note.
- **`components/sections/CTA.tsx`** — Final page CTA. Background: `bg-gradient-to-b from-gray-50 to-white`, 120px padding. Headline: "Start today. Prescription tomorrow." Subhead: "Join 1,200+ Californians who've quit with our help." `btn-primary` button. Trust line: ✓ No commitment ✓ Doctor review in 24hrs ✓ HIPAA secure.
- **`app/(marketing)/page.tsx`** — Homepage server component assembling sections in order: `Hero → HowItWorks → ValueProps → Services → Proof → Pricing → CTA`.

**Treatment pages**
- **`app/(marketing)/alcohol-treatment/page.tsx`** — Alcohol treatment page (9 sections, `"use client"` for Framer Motion): (1) split-screen hero with headline, subhead, `Get Started` CTA, and a placeholder gradient visual; (2) statistics row — 2.1M Californians with AUD, 75% average reduction, <8% currently treated; (3) 4-step numbered how-it-works list; (4) 3-column medication cards — Naltrexone (how it works, best for, dosage 50mg daily / 380mg monthly injection, cost $10–40/mo), Acamprosate (666mg 3×/day, $15–50/mo), Disulfiram (250mg/day, $10–30/mo); (5) flexible goals — complete sobriety vs moderation, recommended meds, outcome stats; (6) horizontal 12-week milestone timeline (responsive: vertical on mobile); (7) eligibility — good-fit list (✓) and not-good-fit list (✗); (8) centred pricing reminder card with `border-2 border-ocean-500`; (9) final CTA section. Includes `<MedicalDisclaimer />`.
- **`app/(marketing)/smoking-cessation/page.tsx`** — Smoking cessation page (10 sections, `"use client"`): (1) split-screen hero; (2) statistics — 3.4M Californians smoke, 3× higher success with medication, $4,300+/year cost of smoking; (3) 12-week program timeline with 4 phases (Preparation, Quit Day, Early Success, Solidifying); (4) 3-column medication cards — Varenicline/Chantix (33–44% quit rate, 12 weeks, $10–50/mo), Bupropion/Wellbutrin (30% quit rate, 7–12 weeks, $10–30/mo, bonus depression treatment), NRT/Patch-gum-lozenge (20–25%, can combine); (5) health benefits timeline from 20 minutes to 10 years post-quitting; (6) cost-savings calculator card (gradient background: $300 program vs $4,300+/year cost of smoking, 3-week payback); (7) success factors 2×2 grid (Medication, Support, Skills, Personalization); (8) eligibility lists; (9) pricing reminder card; (10) final CTA. Includes `<MedicalDisclaimer />`.

**Supporting pages**
- **`app/(marketing)/how-it-works/page.tsx`** — Detailed process page (`"use client"`): hero with breadcrumb, 3-step alternating-side vertical timeline (each step: step label, title, 3-bullet detail list), 6-feature "What's Included" grid (Doctor review, Personalised prescription, E-prescription to pharmacy, Unlimited messaging, Automatic refills, Treatment adjustments), messaging split-screen section with mock doctor chat UI, medications reference table (2 tables: alcohol meds and smoking meds with costs), 4-question FAQ accordion preview, final CTA.
- **`app/(marketing)/pricing/page.tsx`** — Comprehensive pricing page (`"use client"`): minimal hero, 2 full pricing cards with expanded 7-item feature lists and "Get Started"/"Learn More" buttons, total monthly cost breakdown table (service fee + pharmacy meds, with-insurance vs without-insurance columns), comparison table (Rimal Health vs Traditional Telehealth vs In-Person Treatment — cost, appointments, prescription time, flexibility, effectiveness), 8-item "no extra fees" checklist, money-back guarantee badge (dashed `border-success-green`), HSA/FSA section, 6-question pricing FAQ accordion, final CTA.
- **`app/(marketing)/faq/page.tsx`** — Full FAQ page (`"use client"`): hero with support email link, sticky horizontal category tab bar (All, How It Works, Medications, Pricing & Billing, Treatment Goals, Privacy & Security, Eligibility) that scrolls to sections, ~37 questions across 6 accordion sections, "Still have questions?" CTA card (`bg-ocean-500/10`).
- **`app/(marketing)/about/page.tsx`** — About page (`"use client"`): centred hero with mission statement, "The Problem" large-text block (24px body, `bg-gray-50`), 3-column "How We're Different" grid (No appointments, No insurance billing, Doctor-prescribed), doctor profile card (placeholder headshot + bio + quote + credentials), mission statement section (`bg-ocean-500/5`), 4-column values grid (No judgment / Evidence-based / Patient-centered / Privacy first), dark `bg-gray-900` stats section (1,200+ patients, 24hr review, $50/month, 100% HIPAA), final CTA.

**Forms & get-started**
- **`components/forms/IntakeForm.tsx`** — Multi-step HIPAA-compliant intake form (`"use client"`), 3 steps with Framer Motion `AnimatePresence` slide transitions and a step progress indicator. Step 1 — Personal info: first name, last initial, email, phone, age range (select: 18-24 through 65+), California resident confirmation (select). Step 2 — Treatment details: primary concern (Alcohol / Smoking-Tobacco); conditional fields for alcohol (drinks per week, goal: stop entirely / reduce) and for smoking (daily amount, previous quit attempts); prior treatment experience. Step 3 — Consent: three required checkboxes (HIPAA notice acknowledgement, Terms of Service, telehealth consent). Zod schema with conditional `.superRefine()` validation; `aria-invalid` / `aria-describedby` on all fields; animated error messages; submit simulates API call with spinner.
- **`app/(marketing)/get-started/page.tsx`** — Get Started server-component page. Exports `metadata` (`title: "Get Started | Rimal Health"`, description). Renders: page headline + subhead, `<TrustBadges />`, `<IntakeForm />`, `<MedicalDisclaimer />`.

### Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router, Turbopack) | 16.1.6 |
| UI Library | React | 19.2.3 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS (`@theme inline`) | ^4 |
| Components | shadcn/ui (new-york style) | ^3.8.5 |
| Animation | Framer Motion | ^12 |
| Forms | React Hook Form + Zod | ^7 + ^4 |
| Icons | Lucide React | ^0.574 |
| Font | Instrument Sans (Google Fonts) | — |
| Build output | 15 fully static pages (SSG) | — |
