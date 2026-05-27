# Feature Decisions & Future Expansion Notes

**Last updated:** 2026-05-27

This document captures product/business decisions made during development — especially decisions that affect how features should evolve when the platform expands. Unlike AWS_MIGRATION_STATUS.md (infrastructure), this file covers feature logic, regulatory considerations, and planned scaling behavior.

---

## 1. Pharmacy Search & Selection

### Current behavior (CA only)

- Patients search pharmacies by **city or ZIP code**
- Results filtered to **California only** (matches current service area)
- Patient selects preferred pharmacy → saved to `PatientProfile.preferredPharmacyId`
- Available in: **intake form** + **patient profile** settings
- Data source: **NPI Registry API** (free, real-time, all US pharmacies) with results cached in local `Pharmacy` table

### When expanding to other states

- **Default search to patient's home state** (from their profile address)
- **Allow searching other states** via a state dropdown
- Show disclaimer for out-of-state selections: *"Your insurance may not cover prescriptions filled at out-of-state pharmacies."*
- **No admin approval gate** for out-of-state pharmacy selection — patients legally can fill prescriptions at any licensed US pharmacy
- **Naltrexone is not a controlled substance** — no DEA cross-state restrictions apply

### Implementation notes for expansion

1. Remove the CA-only filter in `/app/api/patient/pharmacies/search/route.ts`
2. Default the state filter to `patient.addressState` (from PatientProfile)
3. Add state dropdown to pharmacy search UI (intake form + profile)
4. Add insurance disclaimer when selected pharmacy state !== patient's home state
5. No schema changes needed — `Pharmacy.state` field already supports any state

### Regulatory context (verify with healthcare attorney before launch)

- Prescriber must be licensed in the **patient's state** (where patient is located)
- Pharmacy state doesn't matter — patient's choice
- Controlled substance rules (DEA) don't apply to naltrexone
- State-specific telehealth prescribing laws vary — check when adding each new state

---

## 2. Address Validation

### Current behavior

- Basic ZIP code regex + state = "CA" check
- No real address verification

### Planned

- Integrate **Amazon Location Service** (`rimalhealth-address-validation` place index, Esri provider)
- Validate patient address on profile save and intake submit
- Enforce California-only addresses (reject non-CA)

### When expanding to other states

1. Update the allowed-states list (currently hardcoded to CA in multiple places)
2. Key files to update:
   - `components/forms/checkout/Step2Address.tsx` (state dropdown locked to CA)
   - `/app/api/patient/profile/route.ts` (CA validation)
   - `/app/api/patient/intake/[id]/submit/route.ts` (CA validation)
   - Prisma schema `PatientProfile.addressState` default value
3. Amazon Location Service works for all US addresses — no API changes needed

---

## 3. Prescription System

### Current behavior

- Physician reviews intake → creates prescription (status: PENDING)
- Physician manually sends prescription through a **separate app** (not through RimalHealth)
- No electronic prescribing (DoseSpot is in mock mode, real credentials pending)

### Planned changes (this session)

- Add **"Send" button** in physician's prescription tab
- When clicked: marks prescription as `SENT`, sets `sentAt` timestamp
- **Notifies patient**: "Your prescription for [medication] has been sent to [pharmacy name]"
- Does NOT send electronically — physician still sends manually through separate app
- The "Send" button is a **status update + notification trigger**, not an e-prescribe action

### When DoseSpot goes live (future)

1. Replace mock mode with real DoseSpot API credentials
2. The "Send" button would then call DoseSpot API to electronically send to pharmacy
3. Add webhook handler for DoseSpot status updates (RECEIVED_BY_PHARMACY, FILLED, etc.)
4. Patient notifications for each status change
5. Key files: `lib/integrations/dosespot.ts`, `/app/api/physician/prescriptions/send/route.ts`

### When expanding to other states

- Prescriber licensing per state must be verified before prescribing
- DoseSpot/SureScripts covers all 50 states — no pharmacy network limitations
- Naltrexone prescribing rules are consistent across states (non-controlled)

---

## 4. SMS MFA (Twilio → Amazon SNS)

### Current behavior

- SMS MFA codes sent via **Amazon SNS** (replaced Twilio)
- `lib/integrations/sns.ts` — SNS client using ECS task role (no explicit credentials)
- `lib/integrations/twilio.ts` — kept for reference/rollback, but no longer called
- SNS uses `Transactional` SMS type for high deliverability
- Rate limiting: 5 attempts/hour per phone number (Redis-based, unchanged)
- Code TTL: 5 minutes in Redis (unchanged)

### When expanding to other states

- SNS works nationwide — no changes needed
- SMS deliverability is consistent across US states

### Environment variables to clean up

- `TWILIO_ACCOUNT_SID` — remove from ECS task definition after SNS verified working
- `TWILIO_AUTH_TOKEN` — remove from ECS task definition
- `TWILIO_PHONE_NUMBER` — remove from ECS task definition
- No new env vars needed — SNS uses task role + `AWS_REGION`

### SNS sandbox

- SNS may be in sandbox mode — can only send to verified phone numbers
- To exit sandbox: open AWS support case (similar to SES production access)
- For testing: add test phone numbers via SNS console → Text messaging → Sandbox

---

## 5. Document Upload

### Current state

- Two parallel flows exist (direct upload vs presigned URL) — causes confusion
- Plan: consolidate to single direct upload flow (FormData → server → S3)

### No state-expansion impact

- Document upload is state-agnostic

---

## 6. State Expansion Checklist (use when adding a new state)

When expanding beyond California, update these areas:

- [ ] **Allowed states list** — Add new state to validation in profile/intake routes
- [ ] **Address validation** — Amazon Location Service works nationwide, no change needed
- [ ] **Pharmacy search** — Unlock state dropdown, add new state to filter options
- [ ] **Prescriber licensing** — Verify physician is licensed in the new state (business process, not code)
- [ ] **Telehealth laws** — Research state-specific telehealth prescribing requirements
- [ ] **Consent forms** — May need state-specific consent language
- [ ] **42 CFR Part 2** — Federal regulation, applies in all states, no change needed
- [ ] **Stripe/billing** — No state-specific changes (flat $50/month nationwide)
- [ ] **SMS MFA (Twilio)** — Works nationwide, no change needed
- [ ] **SES email** — Works nationwide, no change needed

---

## 7. Service Area Configuration

### Current

- **California only**
- Enforced at: checkout address form, patient profile save, intake submit
- Hardcoded in multiple places (search codebase for `"CA"` and `California`)

### Future

- Consider extracting to a **config file or environment variable** (`ALLOWED_STATES=CA,TX,NY`)
- Single place to update when expanding
- All validation functions reference this config instead of hardcoded "CA"

---

## 8. Invoice / Charge Timing (2026-04-21)

**Decision:** Use Stripe's 30-day trial to defer the $50 charge until physician approval.

**How it works:**
- Checkout creates a subscription with `trial_period_days: 30`
- During trial: Billing page shows a synthetic "Pending $50" invoice
- Physician approves → `trial_end: 'now'` → Stripe charges $50 immediately
- Physician rejects → `subscriptions.cancel()` → no charge ever processed
- Patient's payment method from checkout is saved and shown on Billing page

**Why not manual capture (authorize-then-capture)?**
- Would require rewriting checkout flow, webhook handlers, and billing display
- Trial-based approach uses Stripe's native subscription lifecycle
- Same end result: charge only on approval, no charge on rejection

**Edge cases:**
- 30-day trial expires before physician reviews → Stripe auto-charges. Mitigated by 24h physician response SLA.
- Webhook failure → charge might succeed but local DB not updated. Mitigated by webhook retry + manual reconciliation.

**Key files:** `app/api/stripe/public-checkout-session/route.ts` (creates the trial subscription), `app/api/physician/reviews/[id]/approve/route.ts` (ends trial, charges), `app/api/physician/reviews/[id]/deny/route.ts` (cancels subscription, no charge).

---

## 9. Medical Information Editability (2026-05-26)

**Decision:** Patients CAN edit `medicalHistory`, `currentMedications`, `allergies`, and `biologicalSex` after intake submission, via the profile settings page. The submitted intake record itself is NOT modified — it remains a point-in-time clinical snapshot.

**Rationale:**
- HIPAA §164.526 gives patients the right to request amendment to their PHI; blocking edits would conflict with that right.
- 42 CFR Part 2 requires an audit trail for SUD record modifications; the original intake must be preserved as the clinical record of record.
- Post-launch, material changes (e.g., a newly disclosed allergy or contraindication) need a physician notification path. Today this is not surfaced — flagged as a follow-up.

**How it works today:**
- Patient edits a field on `/patient/profile/settings` → `PUT /api/patient/profile` updates `PatientProfile.*`.
- The originating `Intake.formData` is untouched.
- Physician's patient detail view reads from `PatientProfile`, so the latest patient-asserted values are what shows up clinically.

**Post-launch follow-ups (deferred):**
- Audit log entry (`AuditLog`) on every profile edit that touches medical fields, with before/after values.
- Physician notification (in-app banner or email) only for **material** changes after the last approved review — newly disclosed conditions or allergies that could be contraindications — **not** routine medication-list edits, to avoid alert fatigue.

**Key files:** `components/patient/PersonalInfoForm.tsx`, `app/api/patient/profile/route.ts` (PUT), `app/api/patient/intake/[id]/submit/route.ts` (one-time sync, no longer overwrites profile after submit).

---

## 10. Conventions for This File

- Update when a product/business decision is made that affects future scaling
- Include the **regulatory reasoning** (not just the technical decision)
- Flag items that need **legal/compliance review** before implementation
- This file complements `AWS_MIGRATION_STATUS.md` (infrastructure) and `CLAUDE.md` (coding conventions)
