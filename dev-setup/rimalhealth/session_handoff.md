# RimalHealth — Session Handoff

> **Last active session:** 2026-05-26 (runtime-findings reconciliation + fixes)
> **Saved by:** Claude (Opus 4.7).
>
> **2026-05-26 session:** Reconciled the Apr-2026 runtime backlog against current `main`. Discovered the backlog was ~85% already cleared by the post-test fix sprint (commits `5a74dcf`, `2724b30`, `067b741`, `17e984b`, `b62a7a8`) — the handoff below had been describing those as still-open. Verified all 21 findings via two read-only code-audit agents + git-history tracing. Fixed the 2 genuinely-open clear bugs this session (intake page-title triple-suffix; physician patients-list "Last Visit" always "Never"). Type-check clean. Both fixes are uncommitted in the working tree.

---

## TL;DR — Where We Left Off

The Apr-2026 runtime QA backlog is essentially done. **18 of 21 findings are fixed/verified.** What remains:

**Update 2026-05-27 — all 21 findings now resolved.** This session closed the last items: Patient #14 (conditional free-text for "Other" condition + drug-allergy name), and PORTAL-02 (timezone-pinned `formatClinicDate`/`formatClinicDateTime` in `date-helpers.ts`, routed through intake review, review history, patients list, prescriptions). PORTAL-15 confirmed: the prescriptions page has no current-time rendering, so the #418 hydration error is not present (the queue components were already fixed in `17e984b`). The two product decisions were made: PORTAL-04 keep age-only, PORTAL-05 keep email masked (no code).

Both HIGH bugs (PORTAL-01 approve-redirect 404, PORTAL-13 blank medical-history panel) are FIXED. PORTAL-13 turned out to be a read-side shape mismatch, not the "Intake → PatientProfile sync broken" theory — the sync works; commit `b62a7a8`'s page mapper coalesces the profile JSON into the view's expected shape.

> **Local runtime caveat:** authenticated local verification is blocked — `.env.local` Redis points at a decommissioned Upstash host, so login 503s. Compile smoke confirmed routes serve (no 500s); verify the physician portal visually on prod after deploy.

Full per-finding status is in `dev-setup/rimalhealth/tasks.md` Task 6.

### Original QA reports (for reference)

| Date | Scope | Report |
|------|-------|--------|
| 2026-04-21 | Smoke test | `premium-telehealth-website/my-app/reviews/smoke-2026-04-21.md` |
| 2026-04-21 | Address validation + pharmacy search | `…/runtime-address-pharmacy-2026-04-21.md` |
| 2026-04-22 | Patient portal end-to-end | `…/runtime-patient-2026-04-22.md` |
| 2026-04-22 | Physician portal end-to-end | `…/runtime-physician-2026-04-22.md` |

---

## To Resume the Actual Prior Conversation

Claude Code transcripts are stored locally:

- **Most recent prior session** (the physician runtime test): `~/.claude/projects/-Users-sonuyadav-RimalHealth/dfbaf4c8-e23e-41ff-a34a-c854e3047e29.jsonl` (Apr 23 20:10, 12 MB)
- **Patient runtime test session:** `~/.claude/projects/-Users-sonuyadav-RimalHealth/9b2f8cae-0496-4e93-9be5-262572b266ee.jsonl` (Apr 22 22:30)

To pick up exactly where you left off, run `claude --resume` and select the session by timestamp/preview. That restores the full conversation context, so I won't have to be re-briefed.

---

## Working-Tree State (Why It Looks Messy)

Nothing was committed after the test runs. Current uncommitted state:

| Path | Status | What it is | Suggested action |
|------|--------|-----------|------------------|
| `FEATURE_DECISIONS.md` | M | Adds §8 "Invoice / Charge Timing (2026-04-21)" — documents the Stripe `trial_period_days: 30` approach to defer billing until physician approval. Real product decision, useful to keep. | **Commit** as `docs: record Stripe trial-based deferred billing decision` |
| `dashboard-snapshot.yml` | ?? | Stray Playwright DOM snapshot of patient dashboard from a test session. | **Delete** or move under `reviews/` |
| `runtime-1-*.png` (52 files, Apr 17) | ?? | Public marketing site sweep screenshots, referenced by `reviews/review-runtime-1-public.md` | Move to `reviews/screenshots/` or delete after committing report |
| `runtime-2-*.png` (24 files, Apr 17–22) | ?? | Patient portal screenshots, referenced by `reviews/runtime-patient-2026-04-22.md` | Same as above |
| `physician-*.png` (16 files, Apr 22) | ?? | Physician portal screenshots, referenced by `reviews/runtime-physician-2026-04-22.md` | Same |
| `sweep-*-1024.png` (4 files, Apr 22) | ?? | 1024-px viewport sweep, also referenced by physician report | Same |
| `premium-telehealth-website/my-app/netlify.toml.bak` | ?? | Leftover from Netlify→Amplify→ECS migration. | **Delete** |

Recommended cleanup before any new work:
```bash
mkdir -p premium-telehealth-website/my-app/reviews/screenshots
mv runtime-*.png physician-*.png sweep-*.png premium-telehealth-website/my-app/reviews/screenshots/
mv dashboard-snapshot.yml premium-telehealth-website/my-app/reviews/screenshots/  # or rm
rm premium-telehealth-website/my-app/netlify.toml.bak
echo "premium-telehealth-website/my-app/reviews/screenshots/" >> .gitignore  # optional
```

---

## Deployment / Infra (Current Reality)

**AWS ECS Fargate, us-east-1.** Not Neon. Not Netlify. Not Amplify.

| Component | Resource |
|-----------|----------|
| Compute | ECS service `rimalhealth-task-service-u24n1blr`, task def family `rimalhealth-task`, task role `rimalhealth-task-role` |
| Database | RDS `rimalhealth-db` (Postgres) |
| Object storage | S3 `rimalhealth-documents` |
| Cache | ElastiCache / Valkey (Redis-compatible) — used for rate-limit, account lockout, NPI cache |
| Address validation | Amazon Location Service place index `rimalhealth-address-validation` |
| Email | SendGrid (permanent — ignore the "SES replaces SendGrid" comment in `.env.example`) |
| Payments | Stripe (API version `2026-01-28.clover`) |
| Domain | `rimalhealth.com` — registered on SiteGround, DNS → ECS/ALB |
| Env vars | Live on the ECS task definition, **not in the repo**. Audit with: `aws ecs describe-task-definition --task-definition rimalhealth-task --query 'taskDefinition.containerDefinitions[0].environment'` |

**Stale files in repo (do not treat as evidence of current infra):**
- `amplify.yml` at repo root
- `premium-telehealth-website/my-app/netlify.toml.bak`
- The "SendGrid → SES" comment in `.env.example`

---

## Recent Commit Sweep (last ~4 weeks)

The pre-test sprint cleared a wide P0 backlog. Read the log if you want the full picture (`git log --oneline -50`); high-level themes:

- **Patient portal P0 fixes** — sign-out, `[object Object]` chips, intake gate, MFA copy, prescriptions, hydration, dates (`14645e4`, `7c43621`, `cd5297a`)
- **Physician portal P0 fixes** — patient list, prescriptions link, queue count, login routing, resend email (`d6152e2`)
- **Stripe + checkout** — public consent route CSRF, NEXT_PUBLIC_* at Docker build time (`d74d7d9`, `79aa7fa`)
- **CI/CD** — buildspec quoting, Docker Hub login, npm ci retry (`17a4c63`, `49505a4`, `546c0e4`)
- **Address + pharmacy** — Amazon Location wiring, autocomplete on live forms, NPI Valkey caching, distance sort (`3586905`, `b252091`, `2650cd3`, `3971946`, `eb4fb9e`)
- **Document download** — Content-Type fallback so PDFs/images render inline (`6dd1086` ← latest)

---

## Open Work — Runtime Test Findings

> **SUPERSEDED 2026-05-26.** The tables below were the original backlog snapshot. They are now stale — 18 of 21 are fixed. See `dev-setup/rimalhealth/tasks.md` Task 6 for the authoritative per-finding status. Kept here only for the original severity/description detail.

### Physician portal — `reviews/runtime-physician-2026-04-22.md`

| ID | Severity | Summary |
|----|----------|---------|
| **PORTAL-01** | **HIGH** | After "Confirm & Approve", redirect lands on `/physician/prescriptions/{id}` which 404s. Approval itself succeeds (record + history are correct) — only the redirect target is broken. |
| **PORTAL-13** | **HIGH** | Patient detail page → Medical History block renders "No conditions / medications / allergies reported" even though the intake submitted all three. Safety-critical: contraindications could be missed. Intake → PatientProfile sync is broken. |
| PORTAL-02 | MED | Timezone inconsistency portal-wide. Intake sidebar renders in UTC (`Apr 23, 2026, 3:23 AM`); review history renders local (`Apr 22, 2026`). Browser TZ observed `America/Chicago` despite request for `America/Los_Angeles`. |
| PORTAL-07 | MED | Medical History on intake review shows raw form keys (`depression-anxiety, other-medical`) instead of human labels. |
| PORTAL-12 | MED | Patient detail → Demographics shows "Gender: Not specified" even though intake recorded `Biological Sex: MALE`. Field mapping is broken for `biologicalSex`. |
| PORTAL-14 | MED | Prescriptions table has no Pharmacy column despite spec. |
| PORTAL-15 | MED | Prescriptions page throws React minified error #418 (hydration mismatch) on load. Likely date/locale SSR vs CSR — ties to PORTAL-02. |
| PORTAL-04 | LOW | Intake review sidebar shows age but not DOB; physicians need DOB for identity verification. |
| PORTAL-05 | LOW | Patient email in sidebar is masked and not shown anywhere unmasked on the physician view. Confirm intent. |
| PORTAL-06 | LOW | Phone masked in sidebar but unmasked in Personal Information accordion — same page, two policies. |
| PORTAL-08 | LOW | "Meets AUD Criteria" green badge overflows the form column at 1024 and 1280 px (positioned absolutely). |
| PORTAL-09 | LOW | "42 CFR Part 2 — Federal…" heading truncates with ellipsis at 1024 px. |
| PORTAL-10 | LOW | Review history table has no reviewer/physician column — audit ambiguity with multiple physicians. |
| PORTAL-11 | LOW | Patients list "Last Visit" shows "Never" right after approval; detail page header card shows "April 22, 2026". |

### Patient portal — `reviews/runtime-patient-2026-04-22.md`

P0: 0 · P1: 6 · P2: 9 · Info: 3

| # | Severity | Page | Summary |
|---|----------|------|---------|
| 1 | P1 | Intake — Pharmacy | Empty-location pharmacy search by name does NOT default to patient ZIP. Searched "CVS" with patient ZIP 93726 → got Pasadena/Hawthorne/Santee/Oakland/Van Nuys/LA results. **Note:** commit `eb4fb9e` was supposed to fix this — verify against production. |
| 2 | P1 | Intake — Address | No address validation triggers anywhere in the intake form. Texas street + Fresno city/ZIP advanced silently. Profile/settings page DOES validate — inconsistent. **Note:** commit `cd5297a` claims address validation fix — verify. |
| 3 | P1 | Intake Review + Profile | Medical conditions render as raw enum keys (`depression-anxiety`, `other-medical`). Mirror of PORTAL-07. |
| 4 | P1 | Billing | Invoice shows `$0.00` Paid for a TRIALING subscription. Should hide or label "Trial / no charge". |
| 5 | P1 | Dashboard 1024px | Quick Actions cards clip text horizontally (4 buttons with `scrollWidth > clientWidth`). |
| 6 | P1 | Profile API | `pharmacy` object omits `state` field — propagates to "FRESNO 93726" without state in review screen. |
| 7 | P2 | Page titles | `"Treatment Intake \| Rimal Health \| Rimal Health"` (duplicated suffix). |
| 8 | P2 | Page titles | Dashboard / Billing / Documents / Messages all use the homepage title. |
| 9 | P2 | Intake Review | DOB shown as raw ISO `2000-03-01`. |
| 10 | P2 | Intake Review | DOB duplicated under Personal Information AND Section 7: Demographics. |
| 11 | P2 | Intake Review | "Previous treatments: none" shows raw enum. |
| 12 | P2 | Intake Review | Pharmacy line missing state and comma between city/ZIP (caused by #6). |
| 13 | P2 | Intake DOM | Yes/No radio inputs all have `value="on"` for both options — non-semantic. |
| 14 | P2 | Intake — Medical | "Other significant medical conditions" reveals no free-text field. Allergies have no detail capture. |
| 15 | info | Intake submit | Confirmation modal requires two clicks — intentional, flagged for test scripts. |
| 16 | info | Test plan | Form is 9 steps (no consent step inside intake) — older test plan needs updating. |
| 17 | P2 | Profile sync | `treatmentGoal` is `null` despite intake Step 7 selection — Intake → PatientProfile mapping broken (same family as PORTAL-12 / PORTAL-13). |
| 18 | P2 | Dashboard 1024px | "No Prescription Yet" card text wraps to one-word-per-line. |

**Pattern observation across both reports:** several findings (PORTAL-12, PORTAL-13, patient #3, #17) all point at a broken **Intake → PatientProfile data sync** — biological sex, conditions, medications, allergies, treatmentGoal are saved on the Intake record but never propagated to PatientProfile. This is one root cause, multiple symptoms.

---

## Recommended Next Move (as of 2026-05-26)

1. **Commit this session's work** — `app/intake/page.tsx` (title fix), `app/api/physician/patients/route.ts` (lastVisitAt), plus the `tasks.md` + this handoff. Branch off `main` first (repo convention).
2. **Get Sonu's call on the 2 product decisions** — PORTAL-04 (DOB in sidebar) and PORTAL-05 (unmasked email on physician view).
3. **Optional polish, low priority** — Patient #14 (two conditional free-text inputs; backend ready) and PORTAL-02 (route physician timestamps through `lib/utils/date-helpers.ts`).
4. **Runtime confirm on prod** — PORTAL-15 hydration; and a quick smoke of the approve → prescription → patient-detail loop.

The 5 remaining `tasks.md` non-runtime items are all user-action-required (AWS/SendGrid/Stripe BAA verification, credential rotation) — they don't block code work.

---

## Project State Summary

- **Stack:** Next.js 16.1.6 / React 19 / TS strict / Prisma 7.4.1 / Tailwind 4 / Vitest 4 / Playwright 1.58
- **App location:** `premium-telehealth-website/my-app/` (run all commands here)
- **Phases:** All 5 dev phases complete; project is production-running on rimalhealth.com
- **Test accounts** (see `.claude/rules/testing.md`):
  - `patient.test@rimalhealth.test` / `TestPatient123@`
  - `dr.sarah.johnson@rimalhealth.test` / `TestPhysician123!`
  - `admin@rimalhealth.test` / `TestAdmin123!`
  - Production runtime tester: `physician@rimalhealth.com`, `computerlover.sonu@gmail.com`
- **Critical rules:** `.claude/rules/{hipaa,42cfr2,stripe,testing,api-patterns}.md`
- **DoseSpot:** ON HOLD — skip those tasks
- **42 CFR Part 2:** enforcement active since Feb 2026; consent + redisclosure + accounting all implemented

---

*If you re-run this kind of QA, save findings to `premium-telehealth-website/my-app/reviews/runtime-<scope>-<YYYY-MM-DD>.md` and screenshots to `premium-telehealth-website/my-app/reviews/screenshots/` (per the cleanup convention above).*
