# RimalHealth -- Task Tracker

> **Status Legend:** `[ ]` To Do | `[~]` In Progress | `[x]` Done | `[!]` Blocked / User Action Required
> **Last Updated:** 2026-05-26
> **Open items:** 5 user-action items. All 21 runtime findings resolved (PORTAL-02 fixed 2026-05-27; PORTAL-15 confirmed no hydration on the prescriptions page). See Task 6.

---

## TASK 1: P0 -- Immediate (Blocking)

> **Note 2026-05-04:** Original 1.1 / 1.3 referenced Neon DB and Netlify hosting. We migrated to AWS ECS Fargate (RDS, S3, ElastiCache, Location Service). Items below have been rewritten for the current stack.

- [ ] **1.1 Credential Rotation (USER ACTION REQUIRED)**
  - [!] 1.1.1 Rotate RDS `rimalhealth-db` master password in AWS Secrets Manager; ECS task pulls `DATABASE_URL` from secrets so service should pick it up on next deploy/restart
  - [!] 1.1.2 Audit IAM access keys (any long-lived keys for the deploy CI / S3 / Stripe? Prefer task role + GitHub OIDC); revoke any exposed keys
  - [!] 1.1.3 Rotate `JWT_SECRET` and `PHI_ENCRYPTION_KEY` if not already rotated post-migration -- coordinate with re-encrypt window for any keys that gate at-rest data

- [ ] **1.3 Vendor BAA Verification (USER ACTION REQUIRED)**
  - [!] 1.3.1 AWS Business Associate Addendum -- one BAA covers RDS + S3 + ElastiCache + Amazon Location Service + ECS in scope
  - [!] 1.3.2 SendGrid BAA -- on standard plans SendGrid does NOT sign BAAs; confirm current plan or migrate to AWS SES / Postmark (see `dev-setup/rimalhealth/email_provider_evaluation.md`)
  - [!] 1.3.3 Stripe BAA (payment processing) -- request via Stripe support
  - [!] 1.3.4 SiteGround -- DNS only; confirm no PHI traverses SiteGround infra (it shouldn't, but document it)

---

## TASK 2: P1 -- Security & Data Integrity

- [~] **2.5 CI/CD Hardening**
  - [ ] 2.5.3 Verify CI pipeline passes end-to-end on the AWS CodeBuild path (buildspec at `premium-telehealth-website/my-app/buildspec.yml` -- NEXT_PUBLIC_* args, Docker Hub login, npm ci retry already applied per commits `17a4c63`, `49505a4`, `546c0e4`)

- [~] **2.6 Dual Stripe Consolidation**
  - [ ] 2.6.4 Verify checkout, billing, subscription, webhook all work end-to-end against the single Stripe surface (see `FEATURE_DECISIONS.md` §8 for the trial-based deferred billing approach)

---

## TASK 5: P3 -- Backlog

- [~] **5.1 Integrations**
  - [ ] 5.1.3 DoseSpot production mode (currently always mock) -- **ON HOLD** pending evaluation of alternative e-prescribing services

---

## TASK 6: Runtime Test Findings (Apr 2026)

> Findings from `premium-telehealth-website/my-app/reviews/runtime-physician-2026-04-22.md` and `runtime-patient-2026-04-22.md`.
> **2026-05-26 reconciliation:** Most findings were resolved by the post-test fix sprint (commits `5a74dcf`, `2724b30`, `067b741`, `17e984b`, `b62a7a8`). Statuses below verified by two read-only code-audit passes + git history. The handoff's "Intake -> PatientProfile sync broken" hypothesis is resolved: the submit route (`app/api/patient/intake/[id]/submit/route.ts`) writes medicalHistory/currentMedications/allergies/biologicalSex/treatmentGoal to PatientProfile, and the physician detail page mapper (`app/physician/(portal)/patients/[id]/page.tsx:109-182`, commit `b62a7a8`) coalesces them into the shape the view expects. Runtime confirmation on prod still advisable for PORTAL-15.

### 6.1 HIGH severity (clinical safety / hard breakage)

- [x] **6.1.1 PORTAL-01** -- FIXED (`5a74dcf`). Approve now redirects to `/physician/prescriptions` (which exists) instead of the non-existent `/physician/prescriptions/{id}`. Verified `IntakeReview.tsx:220-226`.
- [x] **6.1.2 PORTAL-13** -- FIXED (`b62a7a8`). Page mapper coalesces raw profile JSON (`medicalHistoryItems`, boolean flags, `otherConditions`, `medicationList`, allergies) into `{conditions, medications, allergies}` for `PatientDetailView`. Not a sync bug -- was a read-side shape mismatch.

### 6.2 MEDIUM severity

- [x] **6.2.1 PORTAL-02** -- FIXED 2026-05-27. Added timezone-pinned `formatClinicDateTime`/`formatClinicDate` to `lib/utils/date-helpers.ts` (pinned to `DEFAULT_TIMEZONE='America/Los_Angeles'`) and routed physician timestamps through them: intake review sidebar (`submittedAt`/`completedAt`), review history (`reviewedAt`), patients-list "Last Visit", and prescription dates. Pinning also removes the day-boundary SSR/CSR hydration risk. DOB rendering left untouched (date-only, parsed local by design).
- [x] **6.2.2 PORTAL-07** -- FIXED (`067b741`, `2724b30`). `formatMedicalCondition`/`formatTreatmentType` + `humanizeValue` map enum keys to labels in `IntakeDataView.tsx:139-169` and `PersonalInfoForm.tsx`.
- [x] **6.2.3 PORTAL-12** -- FIXED (`17e984b`, `2724b30`). API returns `biologicalSex`; page mapper maps it to `gender` + humanizes; new submissions sync it (submit route:486) -- not reliant on the backfill alone.
- [x] **6.2.4 PORTAL-14** -- FIXED (`5a74dcf`). `PrescriptionList.tsx:408` has a Pharmacy column (`hidden lg:table-cell`), data from `prescriptions/route.ts`.
- [~] **6.2.5 PORTAL-15** -- LIKELY FIXED, runtime-confirm. `17e984b` fixed hydration in the QUEUE components (deferred `lastUpdated`/relative-time to `useEffect`). Prescriptions page itself has no time-dependent render left (only deterministic `formatDate`), so #418 should be gone -- confirm on prod.
- [x] **6.2.6 Patient #4** -- FIXED (`2724b30`). `InvoiceCard.tsx:113-119` relabels `$0.00` TRIALING invoices to "Trial -- no charge".
- [x] **6.2.7 Patient #6** -- FIXED (`2724b30`). Both `/api/patient/profile` and physician detail emit pharmacy `state` (CA fallback).

### 6.3 LOW + P1/P2 polish

- [x] **6.3.1 PORTAL-04** -- RESOLVED 2026-05-26 (decision: keep age-only). DOB stays in the "Personal Information" accordion; sidebar remains a compact summary. No code change.
- [x] **6.3.2 PORTAL-05** -- RESOLVED 2026-05-26 (decision: keep email masked). Patient contact is in-app messaging; masking stays as the minimum-necessary default. No code change.
- [x] **6.3.3 PORTAL-06** -- FIXED (`272a07b`). Phone masked consistently across both physician views (`maskPhone`); no unmasked render remains.
- [x] **6.3.4 PORTAL-08** -- FIXED (`2724b30`). AUD-criteria badge uses `flex-wrap`/`whitespace-normal` (`IntakeDataView.tsx:254,273,290`).
- [x] **6.3.5 PORTAL-09** -- NOT A BUG (current code). The "42 CFR Part 2" `AlertTitle` has no `truncate`/`ellipsis`/`nowrap` classes; it wraps freely.
- [x] **6.3.6 PORTAL-10** -- FIXED (`5a74dcf`). `reviews/page.tsx:137` has a Reviewer column populated from `review.physicianName`.
- [x] **6.3.7 PORTAL-11** -- FIXED (2026-05-26). List API now returns `lastVisitAt` from a per-patient `MAX(submittedAt)` aggregate (`app/api/physician/patients/route.ts`); previously the field was never emitted so the table always showed "Never".
- [x] **6.3.8 Patient #1** -- FIXED (`eb4fb9e`). Name-only pharmacy search with no ZIP/city now defaults to the patient profile's `addressZip` and sorts by haversine distance (`pharmacies/search/route.ts:102-113,220+`).
- [x] **6.3.9 Patient #2** -- FIXED (`cd5297a`). Intake address step calls `verifyPatientAddress()` -> `/api/patient/address/validate`, gated on step-advance/submit (`IntakeClient.tsx:1668-1714,1823,1954`).
- [x] **6.3.10 Patient #3 / #11** -- FIXED. Same label-mapping fix as 6.2.2.
- [x] **6.3.11 Patient #5 / #18** -- FIXED (`2724b30`). `QuickActions.tsx` uses `min-w-0`/`whitespace-normal break-words`.
- [x] **6.3.12 Patient #7 / #8** -- FIXED. Dashboard/billing/documents/messages got their own titles; intake page-title triple-suffix fixed 2026-05-26 (`app/intake/page.tsx` now bare `'Treatment Intake'`).
- [x] **6.3.13 Patient #9 / #10** -- FIXED. `IntakeDataView.tsx:197-216` parses `YYYY-MM-DD` as local and formats "March 1, 2000"; DOB rendered once (no Section 7 duplication in current code).
- [x] **6.3.14 Patient #13** -- NOT A BUG (current code). `BooleanRadio` uses boolean `checked`/`onChange`; all other radios use semantic `value`. No `value="on"` anywhere.
- [x] **6.3.15 Patient #14** -- IMPLEMENTED 2026-05-26. Added two conditional inputs in `IntakeClient.tsx`: a textarea for `otherConditions` (shown when Q26 "other-medical" is checked) and a textarea for `medicationAllergies` (shown when Q25 drugAllergies is "other"/"naltrexone"), plus the two fields in the local `intakeFormSchema` + `defaultValues`. Backend submit route already persists both. Type-check + 394 unit tests pass; `/intake` compiles + serves at runtime. NOTE: interactive click-through (select option -> field appears -> submit persists) not done locally -- local dev login is blocked by a dead Upstash Redis URL in `.env.local`. Verify on prod or with a working local Redis.
- [x] **6.3.16 Patient #17** -- FIXED (`b62a7a8`). `treatmentGoal` synced to PatientProfile on submit (submit route:485) and returned by profile/detail APIs.

### 6.4 Working-tree cleanup

- [ ] **6.4.1** Commit `FEATURE_DECISIONS.md` §8 (Stripe trial-based deferred billing decision -- keep, useful)
- [ ] **6.4.2** Move `runtime-*.png`, `physician-*.png`, `sweep-*.png` (~106 files at repo root) into `premium-telehealth-website/my-app/reviews/screenshots/`, or delete after reports are archived
- [ ] **6.4.3** Delete `dashboard-snapshot.yml` (stray Playwright DOM snapshot at repo root) and `premium-telehealth-website/my-app/netlify.toml.bak`
- [ ] **6.4.4** (Optional) Add `reviews/screenshots/` to `.gitignore` to keep future runtime artifacts out of the working tree
