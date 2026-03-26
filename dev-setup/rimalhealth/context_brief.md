# RimalHealth Context Brief

**Author:** E1 (Context & Brief Writer)
**Date:** 2026-03-25
**Purpose:** Single-source domain knowledge reference for all agents working on RimalHealth
**Replaces:** Need to read AGENTS.md (769 lines, stale) for domain knowledge

---

## 1. Project Summary

**Rimal Health** is a HIPAA-compliant telehealth platform that provides medication-assisted treatment (MAT) for Alcohol Use Disorder (AUD) using Naltrexone. The service is restricted to California residents only.

### Why It Exists

Traditional addiction treatment is expensive ($200-400/month), slow (3-7 day wait for appointments), and requires in-person visits. Rimal Health eliminates these barriers with:

- **Flat-fee pricing** ($50/month active, $25/month maintenance) vs. $200-400/month traditional
- **24-hour physician review** (asynchronous) vs. 3-7 day appointment wait
- **No appointments required** -- fully asynchronous messaging-based care
- **Direct-to-pharmacy** e-prescribing via DoseSpot/Surescripts

### Regulatory Context

- **HIPAA** -- Health Insurance Portability and Accountability Act governs all PHI handling
- **California telemedicine law** -- service is restricted to California-licensed physicians treating California residents
- **Naltrexone** is NOT a controlled substance (no DEA Schedule), so it can be prescribed via telemedicine without an in-person visit (unlike opioid MAT drugs like buprenorphine)
- **7-year data retention** required by HIPAA for medical records after account closure

### Technology Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| UI | React | 19 |
| Language | TypeScript (strict mode) | 5.x |
| Database | PostgreSQL (Neon) via Prisma | Prisma 7.4.1 |
| Styling | Tailwind CSS v4 (no config file) | 4.x |
| UI Library | shadcn/ui ("new-york" style) | latest |
| Validation | Zod | 4.x |
| Testing | Vitest + Playwright | 4.x / 1.58.x |
| Deployment | Netlify (via GitHub Actions) | -- |
| Payments | Stripe | API 2026-01-28.clover |
| Email | SendGrid | -- |
| SMS | Twilio | -- |
| E-Prescribing | DoseSpot (has mock for dev) | -- |
| Documents | AWS S3 | -- |
| Cache/Sessions | Redis | 7 |

**App root:** `premium-telehealth-website/my-app/` -- all commands run from here.

---

## 2. HIPAA Compliance Framework

### 2.1 PHI Definitions Specific to This App

PHI (Protected Health Information) includes any individually identifiable health information. In this codebase, PHI fields are encrypted at the database level using a Prisma client extension.

**Encrypted PHI fields by model** (from `lib/db/encryption-extension.ts`):

| Model | Encrypted Fields | Count |
|-------|-----------------|-------|
| `PatientProfile` | firstName, lastName, dateOfBirth, phone, addressStreet, addressCity, addressZip, billingStreet, billingCity, billingZip, medicalHistory, currentMedications, allergies, insuranceProvider, insuranceMemberId, insuranceGroupNumber | 16 |
| `Intake` | formData, medicationList | 2 |
| `Review` | clinicalNotes, contraindications, rejectionReason, alternativeRecommendation, instructions | 5 |
| `Prescription` | instructions, pharmacyAddress | 2 |
| `Message` | subject, body | 2 |
| `PhysicianNote` | content | 1 |
| **Total** | | **28 fields** |

**PHI field categories** (from `lib/constants.ts` `PHI_FIELDS`):
- **Identifiers:** firstName, lastName, dateOfBirth, ssn, mrn, email, phone, address, city, state, zipCode
- **Medical:** medicalHistory, currentMedications, allergies, diagnosis, symptoms, treatmentPlan, notes, labResults
- **Billing:** insuranceProvider, insurancePolicyNumber, insuranceGroupNumber, paymentMethod, billingAddress

### 2.2 Encryption Requirements

**Algorithm:** AES-256-GCM (from `lib/constants.ts` `ENCRYPTION_CONFIG`)
- Key length: 32 bytes (256 bits)
- IV length: 16 bytes
- Auth tag length: 16 bytes
- Salt length: 32 bytes
- PBKDF2 iterations: 100,000

**The Dual Encryption Issue:**

There are TWO separate encryption implementations active in the codebase. This is a known inconsistency:

| Implementation | File | Env Var | Key Format | Used By |
|---------------|------|---------|------------|---------|
| Primary (PHI) | `lib/encryption/phi.ts` | `PHI_ENCRYPTION_KEY` | Hex (64+ chars) | Prisma encryption extension (`lib/db/encryption-extension.ts`) |
| Secondary (HIPAA) | `lib/hipaa/encryption.ts` | `ENCRYPTION_KEY` | Base64 | HIPAA module, possibly some standalone encryption |
| Third (DB) | `lib/db/encryption.ts` | varies | varies | Unclear if actively used |

**Risk:** Mixing these could cause data integrity issues. The Prisma extension (which handles automatic encrypt/decrypt on read/write) uses `lib/encryption/phi.ts`. The env validation in `lib/env-validation.ts` only requires `ENCRYPTION_KEY`, not `PHI_ENCRYPTION_KEY`.

**Usage pattern:**
```typescript
import { encryptPHI, decryptPHI } from '@/lib/encryption/phi';

const encrypted = encryptPHI(plaintext);   // Returns encrypted string
const decrypted = decryptPHI(encrypted);    // Returns original plaintext
```

The Prisma client extension in `lib/db/encryption-extension.ts` automatically calls these on marked fields, so most code does not need to call them directly.

### 2.3 Audit Logging Requirements

Every access to PHI must be logged. The audit log captures: userId, action, resourceType, resourceId, timestamp, IP address, userAgent.

**The Dual Logger Issue:**

| Logger | File | Lines | Focus |
|--------|------|-------|-------|
| HIPAA audit logger | `lib/hipaa/audit-logger.ts` | 724 | HIPAA-specific audit events |
| General audit logger | `lib/audit/logger.ts` | 660 | General audit singleton |

Both exist and are imported in different parts of the codebase. This means audit coverage may be inconsistent -- some modules use one logger, some the other.

**Audited actions** (from `AUDIT_CONFIG`): CREATE, READ, UPDATE, DELETE, EXPORT, PRINT, LOGIN, LOGOUT, FAILED_LOGIN

**PHI resource types audited:** PATIENT, INTAKE, PRESCRIPTION, MESSAGE, DOCUMENT, BILLING, APPOINTMENT, MEDICAL_RECORD

### 2.4 Data Retention Policy

From `lib/constants.ts` `DATA_RETENTION`:

| Data Type | Retention Period | Code Constant |
|-----------|-----------------|---------------|
| Patient data after account closure | 7 years (2,555 days) | `AFTER_CLOSURE` |
| Audit logs | 7 years (2,555 days) | `AUDIT_LOGS` |
| Session logs | 90 days | `SESSION_LOGS` |
| Failed login attempts | 365 days | `FAILED_LOGINS` |
| Soft delete grace period | 30 days | `SOFT_DELETE_GRACE_PERIOD` |

### 2.5 What Constitutes a HIPAA Violation in Code

**Never do these:**
- Log PHI to console, files, or error tracking services
- Include PHI in error messages returned to clients
- Store PHI unencrypted in the database
- Include PHI in URLs, query parameters, or JWT tokens
- Cache PHI in browser storage (localStorage, sessionStorage, cookies)
- Send PHI over unencrypted channels (must use TLS)
- Return PHI in API responses without verifying role-based access
- Skip audit logging when accessing PHI
- Include PHI in email subject lines (email body is OK with TLS)

**Always do these:**
- Use `encryptPHI()`/`decryptPHI()` for any PHI stored outside the auto-encrypting Prisma extension
- Log all PHI access via audit logger
- Validate role-based access before returning PHI (HIPAA "minimum necessary" principle)
- Use secure, httpOnly cookies for authentication tokens
- Apply rate limiting to prevent brute-force access

---

## 3. Clinical Domain Knowledge

### 3.1 Alcohol Use Disorder (AUD)

AUD is a medical condition characterized by an impaired ability to stop or control alcohol use despite adverse consequences. It affects approximately 14.5 million Americans. The DSM-5 classifies AUD severity by symptom count:
- **Mild:** 2-3 symptoms
- **Moderate:** 4-5 symptoms
- **Severe:** 6+ symptoms (out of 11 total criteria)

### 3.2 Naltrexone

Naltrexone is an FDA-approved medication for treating AUD. Key facts for developers:
- **Mechanism:** Opioid receptor antagonist that reduces alcohol cravings and the rewarding effects of drinking
- **NOT a controlled substance** -- this is critical because it means Naltrexone CAN be prescribed via telemedicine without an in-person exam (unlike Schedule III drugs like buprenorphine)
- **Standard dosing:** 50mg oral tablet, once daily
- **Cost to patient:** $10-50/month at pharmacy (insurance often covers it)
- **Contraindications** coded in the system: liver disease (hepatotoxicity risk), current opioid use, pregnancy
- **Prescribing:** Via DoseSpot e-prescribing integration (currently has a TODO stub; mock mode available in dev via `DOSESPOT_MOCK_MODE=true`)

### 3.3 AUDIT-C Screening Tool

**Source:** `lib/intake/scoring.ts`

AUDIT-C (Alcohol Use Disorders Identification Test -- Consumption) is a validated 3-question screening tool. The questions are defined in `lib/intake/questions.ts`.

**Scoring:**
- 3 questions, each scored 0-4
- Total range: 0-12
- Questions correspond to form fields: `audit_1`, `audit_2`, `audit_3`

**Risk level thresholds** (from `calculateAuditCScore()`):

| Score | Risk Level | Interpretation |
|-------|-----------|----------------|
| 0-3 | LOW | Low risk for AUD. Continue monitoring. |
| 4-5 | MODERATE | Moderate risk. Brief counseling and monitoring recommended. |
| 6-7 | HIGH | High risk for AUD. Medical intervention strongly recommended. |
| 8-12 | SEVERE | Severe AUD likely. Immediate medical attention recommended. |

### 3.4 Risk Score (0-100)

**Source:** `calculateRiskScore()` in `lib/intake/scoring.ts`

The Risk Score estimates clinical severity and urgency. Higher score = higher risk.

| Factor | Points | Max |
|--------|--------|-----|
| AUDIT-C score | score * 3.33 | 40 |
| Seizure history | +10 | 10 |
| Psychiatric history | +8 | 8 |
| Liver disease | +10 | 10 |
| Pregnancy | +12 | 12 |
| Quit attempts | +5 per attempt | 20 |
| Concern level (not/slightly/moderately/very/extremely) | 0/2/5/8/10 | 10 |
| **Maximum possible** | | **100** |

### 3.5 Complexity Score (0-100)

**Source:** `calculateComplexityScore()` in `lib/intake/scoring.ts`

The Complexity Score estimates how medically complex the case is. Higher = needs more specialized care.

| Factor | Points | Max |
|--------|--------|-----|
| Medications | +4 per medication | 20 |
| Seizure history | +12 | 12 |
| Psychiatric history | +10 | 10 |
| Liver disease | +12 | 12 |
| Kidney disease | +8 | 8 |
| Heart condition | +8 | 8 |
| Pregnancy | +15 | 15 |
| Other conditions (by text length) | length / 20 | 10 |
| Previous treatment | +5 | 5 |
| Previous medications (if text > 5 chars) | +10 | 10 |
| **Maximum possible** | | **100** |

### 3.6 Combined Risk Assessment

**Source:** `generateRiskAssessment()` in `lib/intake/scoring.ts`

The combined assessment uses both Risk Score and Complexity Score:

| Level | Condition | Physician Response |
|-------|-----------|-------------------|
| SEVERE | riskScore >= 70 OR complexityScore >= 70 | Immediate physician review required; consider intensive outpatient/inpatient |
| HIGH | riskScore >= 50 OR complexityScore >= 50 | Priority review within 24 hours; MAT recommended |
| MODERATE | riskScore >= 25 OR complexityScore >= 30 | Standard review within 24-48 hours; consider medication options |
| LOW | Below all thresholds | Routine review; behavioral interventions may suffice |

### 3.7 DSM-5 Support

**Source:** `calculateIntakeScores()` in `lib/intake/scoring.ts`

The scoring system also supports DSM-5 format intake (11 yes/no symptom questions, fields `dsm5Q1` through `dsm5Q11`). When DSM-5 format is detected:
- Symptom count is calculated (number of `true` responses)
- Mapped to AUDIT-C equivalent: `Math.min(Math.round(dsm5Score * 12 / 11), 12)`
- This effective AUDIT-C score is then used in the standard risk score calculation

### 3.8 California Telemedicine Regulations

- Service restricted to California residents (validated by ZIP code prefix)
- California ZIP code prefixes: 900-961 (defined in `lib/constants.ts` `CA_ZIP_PREFIXES`)
- Physicians must hold a California medical license (`licenseState` defaults to `"CA"` in schema)
- `addressState` on PatientProfile is always `"CA"`

---

## 4. Business Rules (Complete, with Code References)

### Rule 1: California Residents Only

**Enforcement:** ZIP code validation in intake forms checks against `CA_ZIP_PREFIXES` array in `lib/constants.ts`. The `addressState` field defaults to `"CA"` in the Prisma schema and intake form.

**Error message:** `"Service is only available for California residents"` (from `ERROR_MESSAGES.VALIDATION.CALIFORNIA_ONLY`)

### Rule 2: Payment-First Flow (Exact Sequence)

The patient never creates an account manually. The flow is:

1. **Landing page CTA** directs to `/checkout/payment` (public, no auth required)
2. **Public checkout** calls `POST /api/stripe/public-checkout-session` (no auth) to create a Stripe Checkout Session
3. **Stripe Checkout** collects payment (customer provides email)
4. **Stripe webhook** (`app/api/webhooks/stripe/route.ts`, 617 lines) fires on `checkout.session.completed` and orchestrates:
   - Creates `User` record (role: PATIENT, random password, `emailVerified: false`)
   - Creates `PatientProfile` (empty, linked to user)
   - Creates `Subscription` (ACTIVE_TREATMENT plan, $50/month)
   - Sends `SET_PASSWORD` email template (link expires in 72 hours)
5. **Patient sets password** at `/set-password` (public route) using `POST /api/auth/reset-password` (also sets `emailVerified: true`)
6. **Patient logs in** and completes **intake form** at `/intake`
7. **On intake submission** (`POST /api/patient/intake/[id]/submit`): notifies all active physicians via `NotificationService.notifyPhysicianNewIntake`

**Code locations:**
- Public checkout API: `app/api/stripe/public-checkout-session/route.ts`
- Webhook handler: `app/api/webhooks/stripe/route.ts`
- Set password page: `app/(auth)/set-password/page.tsx`
- Intake submit: `app/api/patient/intake/[id]/submit/route.ts`

**Payment requirement toggle:** In `app/api/patient/intake/[id]/submit/route.ts` line 117, `requirePayment` is `true` in production or when `REQUIRE_PAYMENT=true` env var is set. Can be disabled for development.

### Rule 3: Physician 24-Hour Review SLA

Physicians must review submitted intakes within 24 hours. This is reflected in:
- Risk assessment recommendations: HIGH risk = "Priority physician review within 24 hours"
- Email templates: "Our medical team will review it within 24 hours"
- Not enforced programmatically (no cron job or escalation), just communicated in notifications

### Rule 4: One Active Intake Per Patient

**Enforcement:** `app/api/patient/intake/route.ts` checks for existing DRAFT or SUBMITTED intakes before allowing creation of a new one. If found, returns the existing intake instead.

**Intake statuses:** DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, NEEDS_INFO, EXPIRED

### Rule 5: Refill Request Window (7 Days Before)

Refill requests are only allowed 7 days before medication runs out. Checked via the `nextRefillAvailable` field on the `Prescription` model.

### Rule 6: All Physicians See All Patients

There is no physician-patient assignment in the schema or middleware. The physician review queue shows ALL submitted intakes. Any active physician can review any intake. The `canAccessPatient()` function in `lib/auth/rbac.ts` returns `true` for both PHYSICIAN and ADMIN roles regardless of the target patient.

### Rule 7: Email Verification is Optional

The login route checks `REQUIRE_EMAIL_VERIFICATION` env var; only enforces when set to `'true'`. The payment-first flow creates users with `emailVerified: false` and relies on password setting to mark them verified.

---

## 5. User Personas & Flows

### 5.1 Patient Flow: Payment-First Checkout to Treatment

```
1. Visit rimalhealth.com (marketing pages)
2. Click CTA -> /checkout/payment (public, no auth)
3. Enter email + pay $50/month via Stripe
4. Receive "Create Your Account" email (SET_PASSWORD template, 72h expiry)
5. Click link -> /set-password -> create password
6. Log in -> redirected to /patient/dashboard
7. Complete intake form at /intake (multi-step wizard, auto-saves)
8. Submit intake -> physicians notified
9. Wait for physician review (within 24h)
10. Receive INTAKE_APPROVED or INTAKE_REJECTED email
11. If approved: prescription sent to pharmacy
12. Ongoing: message physician, request refills, manage subscription
```

**Patient portal routes** (under `app/patient/`): dashboard, messages, prescriptions, documents, billing, profile, settings

### 5.2 Physician Flow: Invitation to Active Practice

```
1. Admin creates physician record (NPI, license number, name)
2. Admin generates secret key -> physician receives it out-of-band
3. Physician navigates to /physician/login
4. First login: enters email + secret key -> account activated (status: INVITED -> ACTIVE)
5. Sets password on subsequent logins
6. Access physician portal: /physician/dashboard
7. Review queue at /physician/queue -> view submitted intakes
8. Click intake -> /physician/intake/[id] -> full review UI
9. Decision: APPROVE (with prescription), REJECT (with reason), or NEEDS_INFO
10. If APPROVE: creates Prescription record, sends to pharmacy (DoseSpot)
11. Ongoing: message patients, manage prescriptions, handle refill requests
```

**Physician statuses:** PENDING -> INVITED (key generated) -> ACTIVE (first login) -> INACTIVE (suspended)

**Physician portal routes** (under `app/physician/(portal)/`): dashboard, queue, patients, intake/[id], prescriptions, messages, reviews, settings

### 5.3 Admin Flow: Platform Management

```
1. Log in at /login with ADMIN role credentials
2. Access /admin/dashboard
3. Manage physicians: /admin/physicians
   - View pending physicians: /admin/physicians/pending
   - View physician detail: /admin/physicians/[id]
   - Actions: authorize, suspend, reject, reactivate, reset-key
4. View audit logs (HIPAA compliance)
5. Monitor system health
```

**Admin routes:** `app/admin/` -- dashboard, physicians, physicians/[id], physicians/pending

**Admin special powers:** Admin has ALL permissions (Patient + Physician + Admin-specific). In middleware, `if (role === Role.ADMIN) return true` grants access to all routes.

---

## 6. Pricing Model

| Plan | Monthly Price | Stripe Price ID Env Var | Description |
|------|-------------|------------------------|-------------|
| Active Treatment | $50.00/month (5000 cents) | `STRIPE_PRICE_ACTIVE_TREATMENT` | During active AUD treatment with Naltrexone |
| Maintenance | $25.00/month (2500 cents) | `STRIPE_PRICE_MAINTENANCE` | After treatment completion, ongoing monitoring |
| Medication (Naltrexone) | $10-50/month | N/A (paid at pharmacy) | Insurance often covers; not billed through platform |

**Stripe configuration:**
- API version: `2026-01-28.clover`
- Env vars required: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ACTIVE_TREATMENT`, `STRIPE_PRICE_MAINTENANCE`

---

## 7. Data Model Summary

**Source of truth:** `prisma/schema.prisma` (908 lines, 18 models, 17 enums)

| # | Model | Field Count | PHI Encrypted? | Key Relationships |
|---|-------|------------|----------------|-------------------|
| 1 | `User` | 13 + MFA fields | No (email not encrypted at DB level) | -> PatientProfile?, Physician?, Intake[], Message[], Subscription[], Invoice[], Session[], PasswordReset[] |
| 2 | `PatientProfile` | ~26 | Yes (16 fields) | -> User, Document[], Pharmacy? |
| 3 | `Physician` | ~20 | No | -> User, Review[], Message[], PhysicianNote[], PhysicianMessage[] |
| 4 | `Intake` | ~15 | Yes (2 fields + boolean flags) | -> User, Review?, Prescription? |
| 5 | `Review` | ~16 | Yes (5 fields) | -> Intake (unique), Physician |
| 6 | `Prescription` | ~20 | Yes (2 fields) | -> Intake (unique), RefillRequest[], Pharmacy? |
| 7 | `Message` | ~12 | Yes (2 fields) | -> Physician?, User? |
| 8 | `Document` | ~9 | No (files stored in S3, encrypted there) | -> PatientProfile |
| 9 | `Session` | 7 | No | -> User |
| 10 | `PasswordReset` | 5 | No | -> User |
| 11 | `RefillRequest` | 6 | No | -> Prescription |
| 12 | `Subscription` | ~15 | No | -> User, Invoice[] |
| 13 | `Invoice` | ~9 | No | -> Subscription, User |
| 14 | `Notification` | 9 | No | -- (standalone) |
| 15 | `Pharmacy` | ~17 | No | -> Prescription[], PatientProfile[] |
| 16 | `PhysicianNote` | 5 | Yes (1 field) | -> Physician |
| 17 | `PhysicianAuthorizationLog` | 7 | No | -- (standalone audit) |
| 18 | `PhysicianMessage` | ~14 | Yes (subject, body) | -> Physician (sender), Physician (recipient), self (replies) |
| -- | `PhysicianMessageThread` | ~9 | No | -- (denormalized for query) |
| -- | `AdminActivityLog` | ~10 | No | -- (standalone audit) |
| -- | `AuditLog` | ~12 | No | -- (standalone audit) |

**17 Enums:** Role, PhysicianStatus, IntakeStatus, PaymentStatus, ReviewDecision, PrescriptionStatus, RefillStatus, SenderType, MessageStatus, DocumentType, DocumentStatus, PlanType, SubscriptionStatus, InvoiceStatus, NotificationType, ConcernType, TreatmentGoal, AuthorizationAction, AdminAction

**Key relationships:**
- User 1:1 PatientProfile (patients) or User 1:1 Physician (doctors)
- Patient 1:N Intake, each Intake 1:1 Review, each Intake 1:1 Prescription
- Prescription 1:N RefillRequest
- Subscription 1:N Invoice

---

## 8. RBAC Permission Matrix

**Source:** `lib/auth/rbac.ts` -- 39 total permissions

| Permission | PATIENT | PHYSICIAN | ADMIN |
|------------|---------|-----------|-------|
| **Patient Self-Service** | | | |
| `VIEW_OWN_PROFILE` | Y | - | Y |
| `EDIT_OWN_PROFILE` | Y | - | Y |
| `VIEW_OWN_INTAKE` | Y | - | Y |
| `CREATE_INTAKE` | Y | - | Y |
| `VIEW_OWN_PRESCRIPTIONS` | Y | - | Y |
| `REQUEST_REFILL` | Y | - | Y |
| `VIEW_OWN_MESSAGES` | Y | - | Y |
| `SEND_MESSAGE` | Y | - | Y |
| `VIEW_OWN_DOCUMENTS` | Y | - | Y |
| `UPLOAD_DOCUMENT` | Y | - | Y |
| `VIEW_OWN_BILLING` | Y | - | Y |
| `MANAGE_SUBSCRIPTION` | Y | - | Y |
| `DELETE_OWN_ACCOUNT` | Y | - | Y |
| **Physician Clinical** | | | |
| `VIEW_PHYSICIAN_PROFILE` | - | Y | Y |
| `UPDATE_AVAILABILITY` | - | Y | Y |
| `VIEW_ALL_PATIENTS` | - | Y | Y |
| `VIEW_PATIENT_DETAILS` | - | Y | Y |
| `VIEW_PATIENT_DOCUMENTS` | - | Y | Y |
| `REVIEW_INTAKE` | - | Y | Y |
| `APPROVE_INTAKE` | - | Y | Y |
| `REJECT_INTAKE` | - | Y | Y |
| `REQUEST_INTAKE_INFO` | - | Y | Y |
| `CREATE_PRESCRIPTION` | - | Y | Y |
| `SEND_PRESCRIPTION` | - | Y | Y |
| `CANCEL_PRESCRIPTION` | - | Y | Y |
| `VIEW_PHYSICIAN_MESSAGES` | - | Y | Y |
| `REPLY_TO_MESSAGES` | - | Y | Y |
| `ACCESS_CLINICAL_TOOLS` | - | Y | Y |
| **Administrative** | | | |
| `MANAGE_USERS` | - | - | Y |
| `USER_CRUD` | - | - | Y |
| `MANAGE_PHYSICIANS` | - | - | Y |
| `VERIFY_PHYSICIAN_CREDENTIALS` | - | - | Y |
| `VIEW_AUDIT_LOGS` | - | - | Y |
| `EXPORT_AUDIT_LOGS` | - | - | Y |
| `MANAGE_SYSTEM` | - | - | Y |
| `VIEW_ANALYTICS` | - | - | Y |
| `MANAGE_BILLING` | - | - | Y |
| `PROCESS_REFUNDS` | - | - | Y |
| `ACCESS_ADMIN_PANEL` | - | - | Y |
| `SEND_NOTIFICATIONS` | - | - | Y |
| `MANAGE_CONTENT` | - | - | Y |
| `IMPERSONATE_USER` | - | - | Y |

**Permission count:** PATIENT = 13, PHYSICIAN = 16, ADMIN = 43 (all Patient + all Physician + 14 Admin-specific)

**Key RBAC functions** (from `lib/auth/rbac.ts`):
- `hasPermission(role, permission)` -- single permission check
- `hasAllPermissions(role, permissions[])` -- all must match
- `hasAnyPermission(role, permissions[])` -- any must match
- `canAccessPatient(role, userId, patientId)` -- HIPAA minimum necessary check
- `canAccessPhysician(role, userId, physicianId)` -- physician data access check
- `canSendMessage(senderRole, senderId, recipientId, recipientRole)` -- messaging access

**Middleware enforcement** (`middleware.ts`, 314 lines):
- `/patient/*` requires PATIENT role
- `/physician/*` requires PHYSICIAN role
- `/admin/*` requires ADMIN role
- Admin bypasses all role checks (`if (role === Role.ADMIN) return true`)
- API routes (`/api/*`) excluded from middleware; use `requireAuth`/`requirePermission` per-route

---

## 9. Notification System

### 9.1 Email Templates (20 types)

**Source:** `lib/notifications/templates.ts` (854 lines)

| Template Enum | Subject Line | Recipient | Purpose |
|--------------|-------------|-----------|---------|
| `WELCOME` | "Welcome to Rimal Health!" | Patient | New patient onboarding |
| `EMAIL_VERIFICATION` | "Verify Your Email Address" | Patient | Email verification link (24h expiry) |
| `PASSWORD_RESET` | "Reset Your Password" | Patient | Password reset link (1h expiry) |
| `SET_PASSWORD` | "Create Your Account -- Rimal Health" | Patient | Post-payment account activation (72h expiry) |
| `INTAKE_SUBMITTED` | "Intake Form Submitted - Under Review" | Patient | Confirms intake received, 24h review promise |
| `INTAKE_CONFIRMATION` | "Intake Confirmation - Payment Received" | Patient | Payment + intake confirmation |
| `INTAKE_APPROVED` | "Your Intake Has Been Approved" | Patient | Treatment plan ready, prescription sent |
| `INTAKE_REJECTED` | "Update on Your Intake" | Patient | Rejection with reason |
| `INTAKE_NEEDS_INFO` | "Additional Information Needed for Your Intake" | Patient | Physician needs more info |
| `NEW_INTAKE_PENDING` | "New Intake Pending Review" | Physician(s) | New intake in review queue |
| `REFILL_REQUESTED` | "Prescription Refill Request Received" | Patient | Refill request acknowledged |
| `REFILL_APPROVED` | "Your Refill Request Has Been Approved" | Patient | Refill approved and sent to pharmacy |
| `PRESCRIPTION_SENT` | "Your Prescription Has Been Sent" | Patient | Prescription sent to pharmacy with details |
| `MESSAGE_RECEIVED` | "New Message from Your Care Team" | Patient | New message from physician (truncated preview) |
| `PAYMENT_RECEIPT` | "Payment Receipt - Rimal Health" | Patient | Payment confirmation with amount/date |
| `PAYMENT_FAILED` | "Payment Failed - Action Required" | Patient | Failed payment, update method prompt |
| `SUBSCRIPTION_CANCELLED` | "Subscription Cancelled" | Patient | Cancellation confirmation with end date |
| `GENERIC_NOTIFICATION` | Custom subject | Any | Generic template for ad-hoc notifications |
| `ADMIN_ALERT` | "Admin Alert: [subject]" | Admin | System alerts and errors |

### 9.2 SMS Templates (7 types)

| Template Enum | Purpose | Max Length |
|--------------|---------|-----------|
| `VERIFICATION_CODE` | SMS verification code (10 min expiry) | ~100 chars |
| `INTAKE_APPROVED` | Intake approved with dashboard link | ~160 chars |
| `PRESCRIPTION_READY` | Prescription sent to pharmacy | ~160 chars |
| `APPOINTMENT_REMINDER` | Appointment reminder with date/time | ~160 chars |
| `MESSAGE_NOTIFICATION` | New message from doctor | ~160 chars |
| `STATUS_UPDATE` | Generic status update | Truncated to 160 |
| `MESSAGE_RECEIVED` | New message notification | Truncated to 160 |

### 9.3 HIPAA Constraints on Notifications

- Email templates use `{{placeholder}}` interpolation -- PHI is injected at runtime, never stored in template strings
- SMS templates are capped at 160 chars to fit single SMS
- Message previews in notifications are truncated (no full message body in email)
- Email subject lines do not contain PHI (e.g., "New Message from Your Care Team" not "Message about your Naltrexone prescription")
- All emails include branded header (`#0a2540` navy background) and footer with `support@rimalhealth.com`

---

## 10. Source Document Cross-Reference

| Document | Location | Purpose | Status |
|----------|----------|---------|--------|
| `CLAUDE.md` | `/Users/sonuyadav/RimalHealth/CLAUDE.md` | Quick reference for Claude Code agents | **Active** -- primary agent instructions |
| `AGENTS.md` | `/Users/sonuyadav/RimalHealth/AGENTS.md` | Comprehensive project guide (769 lines) | **Stale** -- being retired by dev-setup; contains outdated info |
| `context_brief.md` | `/Users/sonuyadav/RimalHealth/dev-setup/rimalhealth/context_brief.md` | Domain knowledge reference (this file) | **Active** -- replaces AGENTS.md for domain knowledge |
| `p2_codebase_analysis.md` | `/Users/sonuyadav/RimalHealth/dev-setup/rimalhealth/p2_codebase_analysis.md` | Codebase architecture and metrics | **Active** -- detailed technical analysis |
| `api-spec.md` | `premium-telehealth-website/docs/api-spec.md` | API endpoint specifications | Active |
| `security-audit-report.md` | `premium-telehealth-website/docs/security-audit-report.md` | Security audit findings | Active |
| `netlify-dns-setup.md` | `premium-telehealth-website/docs/netlify-dns-setup.md` | DNS configuration for Netlify | Active |
| `context.md` | `premium-telehealth-website/my-app/context.md` | Business rules and user flows | Active |
| `AUTH_SETUP.md` | `premium-telehealth-website/my-app/AUTH_SETUP.md` | Auth system setup guide | Active |
| `CHANGELOG.md` | `premium-telehealth-website/my-app/CHANGELOG.md` | Change log | Active |
| `README.md` | `premium-telehealth-website/my-app/README.md` | App readme | Active |
| `tests/README.md` | `premium-telehealth-website/my-app/tests/README.md` | Test suite documentation | Active |
| `deployment-guide.md` | `premium-telehealth-website/my-app/docs/deployment-guide.md` | Deployment procedures | Active |
| `runbook.md` | `premium-telehealth-website/my-app/docs/runbook.md` | Operational runbook | Active |
| `PRODUCTION_READINESS_REPORT.md` | `premium-telehealth-website/my-app/audit/PRODUCTION_READINESS_REPORT.md` | Production readiness assessment | Active |

---

## 11. Inconsistencies Found

### 11.1 AGENTS.md Says Vercel; Reality Is Netlify

**AGENTS.md Section 17:** "Deployed via GitHub Actions to Vercel"
**Reality:** Deployed to Netlify. Domain `rimalhealth.com` is registered on SiteGround, deployed on Netlify. CLAUDE.md is correct; AGENTS.md is wrong.

### 11.2 AGENTS.md Says `(patient)` Is Primary; `app/patient/` Is

**AGENTS.md Section 3:** Lists `app/(patient)/` as the primary patient portal and `app/patient/` as "Legacy patient routes (redirects)"
**Reality:** `app/patient/` IS the primary patient portal with 8 pages and its own sidebar layout. `app/(patient)/` does not exist (was cleaned up). CLAUDE.md still references `(patient)` as orphaned but it has been fully removed.

### 11.3 Dual Encryption Systems

Two active encryption modules with different key formats:
- `lib/encryption/phi.ts` uses `PHI_ENCRYPTION_KEY` (hex format)
- `lib/hipaa/encryption.ts` uses `ENCRYPTION_KEY` (base64 format)
- `lib/db/encryption.ts` is a third module with unclear usage

**Risk:** Data encrypted with one system cannot be decrypted by the other. The Prisma extension uses `lib/encryption/phi.ts`.

### 11.4 Dual Stripe Implementations

- `lib/integrations/stripe.ts` (693 lines) -- older, full-featured client
- `lib/stripe/` directory (4 files, 1,292 lines) -- newer module

The webhook handler imports from `lib/stripe/stripe-server.ts`. Some API routes may still use `lib/integrations/stripe.ts`. Both use the same Stripe API version (`2026-01-28.clover`).

### 11.5 Dual Audit Loggers

- `lib/hipaa/audit-logger.ts` (724 lines) -- HIPAA-focused
- `lib/audit/logger.ts` (660 lines) -- general singleton

Different parts of the codebase import from different loggers, creating inconsistent audit coverage.

### 11.6 Missing Env Vars in .env.example

The following env vars are used in code but not documented in `.env.example`:

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
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | `app/layout.tsx` | Google Search Console |
| `AUDIT_HASH_SALT` | `lib/audit/utils.ts` | Salt for audit log hashing |
| `AWS_S3_BUCKET_NAME` | `lib/integrations/s3.ts` | S3 bucket name |

Conversely, `STRIPE_PRODUCT_ACTIVE_TREATMENT` and `STRIPE_PRODUCT_MAINTENANCE` are in `.env.example` but NOT actually used in code.

### 11.7 Orphaned/Dead Code

- `app/profile/setup/page.tsx` (793 lines) -- exists at `/profile/setup` but not in middleware public routes or documented routes. Likely orphaned from earlier flow.
- `app/(marketing)/payment/page.tsx` -- public payment page alongside `app/checkout/payment/page.tsx`. Relationship unclear.
- `components/physician/MessageThread.tsx` exists at top level AND inside `components/physician/messaging/MessageThread.tsx` -- possible duplicate.
- `lib/db/encryption-middleware.ts` and `lib/db/encryption.ts` -- separate from primary encryption; unclear if actively used.

### 11.8 Vitest Default Config Confusion

The root `vitest.config.ts` has `include: ['tests/integration/**/*.test.ts']`, meaning `npm test` only runs integration tests. Unit tests require explicit `npm run test:unit`. This is counterintuitive.

### 11.9 Incomplete Integrations (TODOs)

Only 2 genuine TODOs in the codebase:
1. `app/api/patient/billing/cancel/route.ts:193` -- `// TODO: Implement email notification` (on subscription cancellation)
2. `app/api/physician/prescriptions/send/route.ts:142` -- `// TODO: Integrate with DoseSpot for e-prescribing` (prescription sending uses stub)

### 11.10 Checkout Consent Page Not Documented

`app/checkout/consent/page.tsx` exists but is not mentioned in CLAUDE.md route documentation.

### 11.11 CLAUDE.md References Non-Existent `(patient)` Route Group

CLAUDE.md states: "app/(patient)/ also exists but is orphaned" -- this directory no longer exists. The memory file also references it. Both should be updated.

---

## Appendix A: Security Constants Quick Reference

**Source:** `lib/constants.ts`

| Constant | Value | Notes |
|----------|-------|-------|
| Access token expiry | 15 minutes (900s) | JWT, httpOnly cookie |
| Refresh token expiry | 7 days (604,800s) | Versioned for invalidation |
| CSRF token expiry | 1 hour (3,600s) | Double-submit cookie |
| Session idle timeout | 30 minutes (1,800s) | |
| Session absolute timeout | 8 hours (28,800s) | |
| Login rate limit | 5 attempts / 15 minutes | Redis-backed |
| Authenticated rate limit | 100 req / minute | |
| Unauthenticated rate limit | 20 req / minute | |
| Password min length | 12 characters | |
| Password max length | 128 characters | |
| Password requirements | Uppercase + lowercase + digit + special | Max 3 consecutive identical chars |
| Bcrypt rounds | 12 | For password hashing |
| Audit log retention | 7 years (2,555 days) | HIPAA requirement |

## Appendix B: External Service Integration Status

| Service | Status | Notes |
|---------|--------|-------|
| Stripe | Fully implemented | Checkout, subscriptions, customer portal, webhooks |
| SendGrid | Fully implemented | 20 email templates, retry queue via Redis |
| Twilio | Fully implemented | 7 SMS templates, E.164 formatting, retry queue |
| AWS S3 | Fully implemented | Presigned upload/download, HIPAA encryption, virus scan stub |
| DoseSpot | Partially implemented | Real API client + mock; prescription send route has TODO |
| Redis | Fully implemented | Cache, sessions, rate limiting, notification retry queue |
| Google Analytics 4 | Stub | Measurement ID env var read but no GA script tag in layouts |

## Appendix C: Key File Paths

Every developer should know these files:

| Purpose | Path (relative to `premium-telehealth-website/my-app/`) |
|---------|------|
| Route protection | `middleware.ts` |
| Auth system | `lib/auth/jwt.ts`, `lib/auth/require-auth.ts` |
| RBAC permissions | `lib/auth/rbac.ts` |
| Database client | `lib/db/prisma.ts`, `lib/db/encryption-extension.ts` |
| PHI encryption | `lib/encryption/phi.ts` |
| Intake scoring | `lib/intake/scoring.ts` |
| Stripe webhook (patient creation) | `app/api/webhooks/stripe/route.ts` |
| Security/session constants | `lib/constants.ts` |
| Database schema | `prisma/schema.prisma` |
| Tailwind v4 theme | `app/globals.css` |
| Notification templates | `lib/notifications/templates.ts` |
| Env validation | `lib/env-validation.ts` |

---

## App Flow (Authoritative -- Updated 2026-03-26)

This is the complete, canonical patient flow. All teams must implement against this flow.

1. **Landing page** -- "Get Started" CTA links to `/checkout/consent`
2. **Consent page** (`/checkout/consent`) -- 7 checkboxes:
   - Terms and conditions agreement
   - Consent form
   - HIPAA privacy agreement
   - Privacy policy agreement
   - Informed consent for telehealth
   - 42 CFR Part 2 consent (SUD treatment disclosure authorization)
   - Links to each full document
   - "Continue" button (all must be checked)
   - Consent record stored via `POST /api/checkout/consent`
3. **Stripe payment** -- Stripe Checkout session (`POST /api/stripe/public-checkout-session`, no auth required)
4. **After payment** -- Stripe webhook (`app/api/webhooks/stripe/route.ts`) fires, triggers:
   - Receipt email sent to patient
   - User auto-created (PATIENT role, random password, `emailVerified=false`)
   - PatientProfile (empty) + Subscription created in `prisma.$transaction()`
   - "Create Account" email sent with tokenized link to `/create-account`
5. **Create Account** (`/create-account`) -- Token-based page: read-only email, patient sets password
6. **Email verification** -- Verification email sent automatically after account creation. Patient clicks link to `/verify-email`
7. **Login** -- Patient logs in at `/login`. Login endpoint enforces `emailVerified=true` for PATIENT role (always, no env var gate)
8. **Intake gate** -- Patient layout (`app/patient/layout.tsx`, server component) checks if intake is completed. If not, redirects to intake form. Patient CANNOT access portal until intake is done. Patient CAN sign out during intake.
9. **Intake form** (`app/intake/IntakeClient.tsx`) -- 34 questions, 7 sections, DSM-5 format:
   - Section 1: DSM-5 AUD Screening (Q1-11) -- 11 Yes/No
   - Section 2: Current Drinking Pattern (Q12-15) -- multiple choice + Yes/No
   - Section 3: Withdrawal Risk Assessment (Q16-19) -- 4 Yes/No (any Yes = elevated risk)
   - Section 4: Naltrexone Safety Screening (Q20-25) -- contraindications (Q20/Q21 = absolute)
   - Section 5: Medical & Psychiatric History (Q26-29) -- multi-select + text
   - Section 6: Treatment Goals & Readiness (Q30-32) -- multiple choice
   - Section 7: Demographics (Q33-34) -- sex + age
   - Auto-save to server every 30s (NO browser storage for PHI)
   - Sign-out button available, review step, submit confirmation modal
   - On submit: 4 scoring functions run (DSM-5, contraindications, withdrawal risk, provider decision summary)
10. **After intake submission** -- Form sent to physician portal for review. Patient notified to complete profile. Patient can now access portal.
11. **Doctor reviews** intake in physician portal -- IntakeDataView shows DSM-5 score, contraindications, withdrawal risk, priority badges
12. **Patient notified** of decision (approved/declined/needs-info) in portal
13. **If approved** -- Doctor sends prescription to patient's chosen pharmacy via DoseSpot
14. **Patient portal features** -- Messages, prescription status, profile completion, billing, documents. Email notifications are HIPAA-compliant (no PHI in emails).

### Key Routes for This Flow

| Step | Route | Auth |
|------|-------|------|
| Consent | `/checkout/consent` | Public |
| Payment | `/checkout/payment` | Public |
| Checkout success | `/checkout/success` | Public |
| Create account | `/create-account` | Public (token-based) |
| Verify email | `/verify-email` | Public (token-based) |
| Login | `/login` | Public |
| Intake form | `/intake` | Requires PATIENT auth |
| Patient portal | `/patient/*` | Requires PATIENT auth + intake complete |
| Physician portal | `/physician/*` | Requires PHYSICIAN auth |

---

## 42 CFR Part 2 Requirements

**What it is:** 42 CFR Part 2 is a federal regulation providing **additional privacy protections** for Substance Use Disorder (SUD) treatment records, beyond standard HIPAA requirements. Since Rimal Health treats Alcohol Use Disorder (a substance use disorder), Part 2 applies.

**Enforcement:** Active since **February 2026** under the final rule published January 2024.

**Key requirements:**
- **Consent** (42 CFR 2.31): Patient must provide written consent before SUD records can be disclosed. Consent must include 9 specific elements (name, purpose, recipients, what info, right to revoke, expiration, etc.)
- **Redisclosure notice:** Any recipient of Part 2 records must be notified: "This information has been disclosed to you from records protected by Federal confidentiality rules (42 CFR Part 2)."
- **Accounting of disclosures:** Patients have the right to request an accounting of all disclosures of their SUD records
- **Restriction requests:** Patients may request restrictions on how their SUD records are shared
- **No conditioning treatment:** Cannot condition treatment on consent to disclose records

**Compliance plan:** See `dev-setup/rimalhealth/compliance_42cfr2.md` for the full 3-phase implementation plan, exact consent language, privacy page updates, and gap analysis. The compliance plan identifies 7 gaps and provides remediation steps for each.

**Impact on codebase:**
- Consent page needs 42 CFR 2.31 compliant checkbox (TASK 1.2.1)
- HIPAA page needs Part 2 patient notice (TASK 1.2.2)
- Privacy page needs Part 2 protections section (TASK 1.2.3)
- Physician portal needs redisclosure notice (TASK 1.2.4)
- Accounting of disclosures API needed (TASK 6.1)
- Consent management system needed (TASK 6.2)
- Restriction request mechanism needed (TASK 6.3)
