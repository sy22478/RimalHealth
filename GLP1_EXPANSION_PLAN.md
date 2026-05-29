# GLP-1 (Weight Management) Expansion — Plan & Status

**Last updated:** 2026-05-27
**Branch:** all work on `dev` (never `main` until explicitly approved).

Adds **GLP-1 weight management (Wegovy / semaglutide)** as a second treatment alongside
Alcohol Use Disorder (AUD). A `Product` table is the spine; every change is additive and
conditional on product type so the **AUD flow is 100% unchanged**.

---

## Phase status

| Phase | Scope | Status | Commit |
|-------|-------|--------|--------|
| 1 | Multi-product foundation: `Product` table, `productId` FK on Intake/Prescription, `WEIGHT_MANAGEMENT` ConcernType, `resolveProductId()`, SurveyJS spike | **DONE** | `82eb1f1` |
| 2 | GLP-1 intake (RHF+Zod 11-step / 63-question wizard), scoring/triage, product-gated consent (no 42 CFR Part 2, version `GLP1-1.0`), API persistence + triage columns | **DONE** | `1744265` |
| 3 | Wegovy physician medication catalog + `/weight-management` marketing page | **DONE** | `e1806ff` |
| 4A | Titration engine (pure), lab-gated refills, physician refill-approval route | **DONE** | `1828b6c` |
| 4B | Patient check-ins, patient/physician monitoring dashboards, `CRON_SECRET` monitoring cron, notifications | **DONE** | `297aed6` |
| 5 | Product-aware checkout / payment / consent / account-creation / intake routing + pricing page | **DONE** | Phase 5 `feat:` commit (this change set) |

**The clinical pipeline AND the patient-facing funnel are now complete.** A GLP-1 patient can
pay, receive the correct (non-SUD) consent, create an account, and be routed to the GLP-1 intake.

---

## Phase 5 deliverables (recap)

**Principle:** AUD path unchanged; 42 CFR Part 2 never shown for GLP-1 (compliance hard stop).

- **Stripe price infra** (`lib/stripe/stripe-server.ts`, `stripe-client.ts`, `lib/stripe/stripe-webhooks.ts`):
  `PlanType` enum gains `WEIGHT_MANAGEMENT`; all `Record<PlanType,…>` maps + `getPlans()` +
  customer-portal config + `determinePlanType()` cover both products.
- **Checkout metadata** (`app/api/stripe/checkout-session`, `public-checkout-session`):
  `planType` Zod accepts `WEIGHT_MANAGEMENT`; `productType` ('ALCOHOL' | 'WEIGHT_MANAGEMENT')
  added to session + subscription metadata (no PHI).
- **Consent** (Phase 2 built the product-gated page+API; Phase 5 fixed the signature blurb so it
  no longer references "42 CFR Part 2 / substance use disorder" for GLP-1).
- **Webhook** (`app/api/webhooks/stripe/route.ts`): reads `productType` (defaults `ALCOHOL`);
  branches consent record (`TREATMENT` + GLP-1 text vs `PART2_DISCLOSURE` + SUD text); product-aware
  plan label; persists `PatientProfile.primaryConcern`; appends `&product=` to the create-account URL.
- **Create-account** (`app/(auth)/create-account/page.tsx`): reads `product`; product-aware success copy.
- **Pricing page**: two products; GLP-1 CTA → `/checkout/consent?plan=weight-management&product=weight-management`;
  GLP-1 FAQ + cost notes are `TODO(legal/medical)` / `TODO(business)`.
- **Payment client** (`CheckoutPaymentClient.tsx`): normalizes the `?plan=` slug → PlanType enum so
  the value sent to the API is always valid; shows only the chosen product's card (AUD page unchanged).
- **Intake gate** (`app/patient/layout.tsx`): product-aware — routes GLP-1 patients to `/intake/glp1`
  and AUD patients to `/intake`, scoped by `productId` (AUD also matches legacy null-productId intakes).

Verification: type-check 0 errors; lint clean (no new warnings); **both consent paths verified in a
real browser** (AUD = 8 items incl. Part 2; GLP-1 = 9 items, NO Part 2 / Naltrexone / SUD).

---

## Hazards / gotchas

1. **6 migrations are CREATED but NOT APPLIED** (shared Neon dev DB is behind). Apply **in order**
   with `prisma migrate deploy` at deploy time only — never from a feature branch:
   1. `20260526010000_add_product_multi_treatment` (Phase 1)
   2. `20260526010001_seed_products_backfill` (Phase 1 — seeds products + backfills AUD)
   3. `20260526020000_add_glp1_triage_columns` (Phase 2)
   4. `20260527000000_glp1_phase4_titration_monitoring` (Phase 4A)
   5. `20260527010000_glp1_phase4_notification_types` (Phase 4B)
   6. `20260527020000_glp1_phase5_plan_type` (Phase 5)
2. **Stripe env vars must be set before deploy:** `STRIPE_PRICE_WEIGHT_MANAGEMENT` and
   `STRIPE_PRODUCT_WEIGHT_MANAGEMENT` (documented in `.env.example`). Without the price, the GLP-1
   checkout throws "Price ID not configured".
3. **Consent product param is lowercase** `weight-management` (the consent page's `resolveProductType`
   matches the lowercase slug). The payment client normalizes the `plan` slug to the enum.
4. **`npm test` (full suite) wipes the shared DB.** Use `type-check` + targeted `npx vitest run <file>`
   + `lint` + dev-server smoke. Never run the full suite locally against the shared DB.
5. **All clinical values are sign-off placeholders** in `lib/intake/glp1/clinical-config.ts`
   (`TODO(clinical)`): BMI thresholds, contraindications, titration cadence, lab gate, check-in
   questions. Marketing/pricing copy is `TODO(legal/medical)` / `TODO(business)`.
6. **Notifications** use SendGrid + Twilio (NOT SES/SNS). The monitoring cron has no in-repo
   scheduler — only the `CRON_SECRET`-guarded HTTP route exists.
7. **Authed runtime is blocked locally** (dev Redis/MFA gate down) — the intake gate, dashboards, and
   physician approval routes must be smoke-tested on prod after deploy.
8. GLP-1 stays on `dev`, never `main`, until explicitly approved.

---

## Next actions (go-live)

1. **Clinical sign-off** on every `TODO(clinical)` in `lib/intake/glp1/clinical-config.ts`.
2. **Legal/medical sign-off** on the `/weight-management` marketing page, the 9 GLP-1 consent items,
   and the pricing-page GLP-1 copy/claims.
3. **Business sign-off**: GLP-1 platform fee, pharmacy partnerships, patient-facing medication cost.
4. **Stripe Dashboard**: create the Weight Management product + price; set `STRIPE_PRICE_WEIGHT_MANAGEMENT`
   and `STRIPE_PRODUCT_WEIGHT_MANAGEMENT` in the deploy environment.
5. **Merge `dev` → `main`** (only when explicitly approved).
6. **Run `prisma migrate deploy`** (the 6 stacked migrations, in order — see Hazards #1).
7. **Wire an external scheduler** (EventBridge / cron-job.org) to hit `/api/cron/glp1-monitoring`
   with the `CRON_SECRET` bearer.
8. **Smoke-test both AUD and GLP-1 paths end-to-end** on prod (pricing → consent → payment →
   create-account → login → correct intake → dashboard).
9. Make the **Stripe webhook consent reconciliation** fully product-aware was done in Phase 5;
   confirm no remaining hardcoded `PART2_DISCLOSURE` for GLP-1 sessions in any other path.

## Out of scope

Stripe product/price creation (manual ops — env vars documented). Insurance/billing model changes.
Multi-subscription (a patient on both AUD and GLP-1 at once). Scheduler infrastructure (the cron route
exists; only the trigger is deployment work).

## Deployment

**Current path: AWS ECS Fargate via CodeBuild** (`buildspec.yml` at the repo root). On push to
`main`, CodeBuild (`rimalhealth-build`) builds the Docker image, tags it `latest` + the commit
SHA, pushes to ECR (`090814040113.dkr.ecr.us-east-1.amazonaws.com/rimalhealth`), then runs
`aws ecs update-service --cluster rimalhealth-cluster --service rimalhealth-task-service-u24n1blr
--force-new-deployment` (rolling, 100/200). The GitHub Actions workflows (`.github/workflows/`) run
**tests/security only** — they do not deploy.

> **Doc conflict, resolved:** `amplify.yml` and the "Amplify" line in `CLAUDE.md` are **stale** —
> the app no longer deploys via Amplify (it went Netlify → Amplify → ECS). Treat ECS/CodeBuild as
> authoritative; see `AWS_MIGRATION_STATUS.md` for the full infra inventory. This task did **not**
> change the pipeline — only this documentation.

**Rollback (code):** re-deploy the previous good image. Either register a new task-definition
revision pointing at the prior ECR image tag (the 7-char commit SHA) and `aws ecs update-service
--task-definition <prev-rev>`, or point the service back at the previous task-def revision. ECS
performs a rolling replacement; the ALB health check (`/api/health`) gates the rollout.

**Migration rollback caveat:** Prisma migrations are **forward-only**. `prisma migrate deploy` has
no automatic down-migration, so a *code* rollback after migrating leaves the new columns/enums in
place. For the GLP-1 expansion this is **harmless**: all the migrations are additive — new tables
(`Product`, `TitrationSchedule`, `TitrationStep`, `CheckIn`, …), new **nullable** columns, new enum
values, and a data backfill. None add a `NOT NULL` column to an existing table (verified: the only
`NOT NULL` clauses are inside `CREATE TABLE` or carry a `DEFAULT`), so old code keeps running against
the new schema. The only desync risk would be a future migration that adds a `NOT NULL`-without-default
column or drops/renames one — none of the current GLP-1 migrations do.

**Recommendation for the GLP-1 launch:** before production, run a **staging dry-run of all 6 stacked
migrations** (in order — see Hazards #1) against a clone of the prod database, then smoke-test both
the AUD and GLP-1 paths end-to-end. Roll forward with a fix rather than attempting a schema rollback.
