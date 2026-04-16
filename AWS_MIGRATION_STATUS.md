# AWS Migration Status

**Last updated:** 2026-04-16
**AWS Account ID:** `090814040113`
**Primary region:** `us-east-1`

This document is the single source of truth for the RimalHealth AWS migration. Update it whenever infrastructure state changes. If you spot something incorrect, fix it here first.

---

## 1. Migration Progress

### Completed

| Item | Details |
|------|---------|
| AWS account + BAA | Account created, **AWS BAA signed** |
| IAM users | `rimalhealth-admin` (AdministratorAccess + MFA), `sonu-developer`, `rimalhealth-app` (least-privilege for runtime) |
| ECR repository | `rimalhealth` (`090814040113.dkr.ecr.us-east-1.amazonaws.com/rimalhealth`) |
| Dockerfile | Multi-stage, Node 20 Alpine, Next.js standalone, port 3000, non-root `nextjs` user |
| CodeBuild | Project `rimalhealth-build`, GitHub App connection, auto-build on push to main, privileged mode enabled |
| `buildspec.yml` | At repo root; builds image, tags `latest` + commit SHA, pushes to ECR, emits `imagedefinitions.json` |
| ECS cluster | `rimalhealth-cluster` (Fargate) |
| ECS service | `rimalhealth-task-service-u24n1blr` (1 desired, REPLICA, rolling deploy 100/200) |
| Task definition | `rimalhealth-task` — latest revision: **8** (ElastiCache cutover) |
| Container | `rimalhealth-app`, port 3000, 0.5 vCPU / 1 GB |
| ALB | `rimalhealth-alb` → DNS `rimalhealth-alb-1901549988.us-east-1.elb.amazonaws.com` |
| Target group | `rimalhealth-tg`, HTTP:3000, health check `/api/health` |
| HTTPS listener + **SSL certificate** | Port 443 with ACM cert, HTTP→HTTPS redirect |
| Route 53 | Hosted zone `rimalhealth.com`, NS switched from SiteGround, propagation confirmed |
| DNS records | A (ALIAS) apex + `www` → ALB; SES DKIM CNAMEs; custom MAIL-FROM MX for `mail.rimalhealth.com`; SiteGround MX (mail receiving) |
| S3 bucket | `rimalhealth-documents` (PHI, SSE-S3, versioning, public access blocked) |
| Location Service | Place index `rimalhealth-address-validation` (Esri provider) |
| RDS | Instance `rimalhealth-db`, db.t3.micro, PostgreSQL 17.6-R2, Single-AZ, encrypted, 7-day backup, deletion protection on |
| Neon → RDS migration | `pg_dump` + `psql` pipe complete. All 26 tables + 5 users migrated. Verified healthy. |
| SES identities | `rimalhealth.com` verified, DKIM ✅, Custom MAIL FROM (`mail.rimalhealth.com`) ✅ |
| SES code | `lib/integrations/ses.ts` written; `sendgrid.ts` delegates to SES for backward compat |
| Health check | `/api/health` returns 200, DB + Redis both healthy |
| **ElastiCache Valkey** | Cluster `rimalhealth-cache`, cache.t4g.micro, engine 8.2, single node, cluster mode disabled, TLS enabled, no-auth, in same VPC as ECS/RDS, subnet group `rimalhealth-cache-subnet-group` (us-east-1a + 1b) |
| **Upstash → ElastiCache cutover** | `REDIS_URL` updated in task def rev 8 to `rediss://<endpoint>:6379`. No code changes required (`lib/redis/client.ts` auto-detects TLS from `rediss://` scheme). Verified healthy. |

### Third-party services — migration plan

| Service | Current provider | AWS replacement | Monthly cost | Status |
|---------|------------------|-----------------|--------------|--------|
| Hosting | Netlify | ECS Fargate | ~$15-30 | ✅ Done |
| Storage | Netlify Blobs | S3 | ~$1-5 | ✅ Done |
| Address validation | — | Amazon Location Service | ~$0.50 | ✅ Done |
| Database | Neon (PostgreSQL) | Amazon RDS for PostgreSQL | ~$15 | ✅ Done |
| Email | SendGrid | Amazon SES | ~$0.10 | 🟡 Code done; awaiting production access |
| Cache / sessions | Upstash (Redis) | Amazon ElastiCache for Redis (or Valkey) | ~$12 | ✅ Done (Valkey) |
| SMS (MFA) | Twilio | Amazon SNS (**optional**) | ~$0.05 | ⏸ Optional — keep Twilio unless cost/simplification justifies |
| Payments | Stripe | **No AWS alternative** — keep Stripe | N/A | N/A |

**Cost vs. the alternative:** ~$45/mo on AWS (hosting + all migrated services) vs. **$1,000+/mo** for Netlify Enterprise with HIPAA BAA. Savings drove the entire migration decision.

### In Progress

| Item | Status |
|------|--------|
| SES production access | Submitted ~2026-04-14. Check SES Account dashboard for approval. If still sandbox after 48h, re-submit or open support case. |

### Pending — Next Actions (ordered by priority)

| # | Item | Priority | Notes |
|---|------|----------|-------|
| 1 | **Check SES production access** | High | Check SES → Account dashboard. If approved, SES is fully live. |
| 2 | **Verify Stripe webhook URL** | Medium | Check Stripe dashboard → Developers → Webhooks. Should point to `https://rimalhealth.com/api/webhooks/stripe` |
| 3 | **Delete Upstash** | Medium | ElastiCache cutover verified. Upstash no longer needed — safe to delete. |
| 4 | **Fix document upload mismatch** | Medium | Frontend Gov ID upload uses old S3 presigned flow; backend uses FormData. Needs audit and consolidation. |
| 5 | **Delete Neon** | Low | After 2-week safety period (~end of April 2026). Rotate Neon credentials. |
| 6 | **Delete Netlify** | Low | After 2-week safety period (~end of April 2026). |
| 7 | **Delete SendGrid** | Low | After SES production access confirmed + first live email send verified. |
| 8 | **RDS SSL hardening** | Low | Bundle RDS CA cert in Docker image, switch `sslmode=no-verify` → `verify-full`. |
| 9 | **SNS for SMS MFA (optional)** | Low | Replace Twilio with Amazon SNS if consolidation desired; otherwise keep Twilio. |
| 10 | **Verify DoseSpot integration** | Low | Currently `DOSESPOT_MOCK_MODE=true`; real credentials pending business decision. |

---

## 2. Infrastructure Reference

### Networking

- **VPC:** `vpc-0a16159996bdbe874` (default VPC)
- **Active subnets (ECS + ALB):**
  - `subnet-027f82bc1c151dec4` (us-east-1a)
  - `subnet-06ee2f71ef9d730a2` (us-east-1b)
- **Unused subnets (do not attach to ECS):** `subnet-097904c45a4ada751` (1e), `subnet-042edf8d649c58bfa` (1c), `subnet-01835162a52fbc6db` (1d), `subnet-0a6cfd3d205eb9029` (1f)

### Security groups

| Name | ID | Inbound | Used by |
|------|-----|---------|---------|
| `default` | `sg-09691c1fc99109b58` | All traffic from self; PostgreSQL 5432 from `rimalhealth-container-sg` | RDS |
| `rimalhealth-alb-sg` | `sg-0b70367c96c25d763` | HTTP 80 + HTTPS 443 from 0.0.0.0/0 | ALB |
| `rimalhealth-container-sg` | `sg-02874e58d2e7f8f23` | TCP 3000 from `rimalhealth-alb-sg` | ECS tasks |

### Data layer

| Resource | Endpoint / Name |
|----------|-----------------|
| RDS endpoint | `rimalhealth-db.cszwwssua3ep.us-east-1.rds.amazonaws.com:5432` |
| RDS master user | `rimalhealthadmin` |
| RDS database name | `rimalhealth` |
| RDS public access | **Disabled** (VPC-only) |
| S3 PHI bucket | `rimalhealth-documents` |
| Location place index | `rimalhealth-address-validation` |
| ElastiCache | **Not yet created** |

### Domains & DNS

- **Domain:** `rimalhealth.com`
- **Registrar:** Squarespace (confirmed by Will)
- **DNS provider:** Route 53 (nameservers switched from SiteGround, DNS propagated ✅)
- **Custom MAIL FROM:** `mail.rimalhealth.com` (SES)
- **Mail receiving:** SiteGround (MX records: `mx10/20/30.antispam.mailspamprotection.com`)

### SES

| Item | Value |
|------|-------|
| Region | `us-east-1` |
| Status | Sandbox (production access pending approval) |
| Sending limit (sandbox) | 200 emails/day, 1 email/sec |
| Verified identity | `rimalhealth.com` (domain-level, via DKIM) |
| Custom MAIL FROM | `mail.rimalhealth.com` ✅ |
| DKIM | ✅ verified |
| From email (env) | `SES_FROM_EMAIL=noreply@rimalhealth.com` |
| From name (env) | `SES_FROM_NAME=Rimal Health` |

---

## 3. Environment Variables (ECS Task Definition)

### Database & Cache

| Variable | Value (current) | Notes |
|----------|-----------------|-------|
| `DATABASE_URL` | See format and fields below | `no-verify` due to RDS self-signed CA; see "RDS SSL hardening" |
| `REDIS_URL` | `rediss://<cache-endpoint>:6379` (ElastiCache Valkey) | Task def rev 8. TLS via `rediss://`. No AUTH token. |

**`DATABASE_URL` format:**

```
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=no-verify
```

| Field | Value |
|-------|-------|
| Host | `rimalhealth-db.cszwwssua3ep.us-east-1.rds.amazonaws.com` |
| Port | `5432` |
| Database | `rimalhealth` |
| User | `rimalhealthadmin` |
| Password | Stored only in ECS task definition (never in this doc or git) |
| SSL | `sslmode=no-verify` (temporary; switch to `verify-full` with RDS CA bundle later) |

### Auth & encryption

| Variable | Notes |
|----------|-------|
| `JWT_SECRET` | Carried over from Netlify |
| `PHI_ENCRYPTION_KEY` | Carried over; used by Prisma encryption extension |
| `ENCRYPTION_KEY` | Carried over |

### Stripe

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | API key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public key |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature validation |
| `STRIPE_PRICE_ACTIVE_TREATMENT` | Active treatment $50/mo price ID |
| (note) | Maintenance plan removed — no `STRIPE_PRICE_MAINTENANCE` needed |

### AWS services (authentication via task role, no access keys)

| Variable | Value |
|----------|-------|
| `AWS_REGION` | `us-east-1` |
| `AWS_S3_BUCKET_NAME` | `rimalhealth-documents` |
| `AWS_LOCATION_PLACE_INDEX` | `rimalhealth-address-validation` |
| `SES_FROM_EMAIL` | `noreply@rimalhealth.com` |
| `SES_FROM_NAME` | `Rimal Health` |
| `STORAGE_PROVIDER` | `s3` |

### App config

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_APP_URL` | `https://rimalhealth.com` |
| `NEXT_PUBLIC_APP_NAME` | `Rimal Health` |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `HOSTNAME` | `0.0.0.0` |

### Legacy (to remove after cutover)

- `SENDGRID_API_KEY` — remove after SES production access + verified live
- (any Netlify-specific vars) — remove from task def

### DO NOT set

- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — use ECS task role instead

---

## 4. IAM

### Roles

- **ECS task execution role:** pulls images from ECR, writes logs to CloudWatch
- **ECS task role:** grants runtime access to S3, SES, Location Service
- **CodeBuild service role:** `codebuild-rimalhealth-build-service-role` — ECR push, S3, CloudWatch Logs

### Task role policy (custom)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3DocumentStorage",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::rimalhealth-documents/*"
    },
    {
      "Sid": "LocationServiceAddressValidation",
      "Effect": "Allow",
      "Action": "geo:SearchPlaceIndexForText",
      "Resource": "arn:aws:geo:us-east-1:090814040113:place-index/rimalhealth-address-validation"
    },
    {
      "Sid": "SESEmailSending",
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": "*"
    }
  ]
}
```

---

## 5. Known Issues & Gotchas

1. **RDS self-signed cert.** Prisma fails with `sslmode=require` because RDS's CA isn't trusted. Current workaround: `sslmode=no-verify`. Proper fix: bundle RDS CA into Docker image and use `sslmode=verify-full&sslrootcert=<path>`.

2. **Prisma migration TRIALING enum.** `20260402000000_add_trialing_subscription_status` previously failed with `P3018` ("enum label TRIALING already exists"). Since Neon was already past this migration and we did a `pg_dump`/restore, RDS should be in sync. If a future migration fails with this enum, use `prisma migrate resolve --applied 20260402000000_add_trialing_subscription_status`.

3. **Document upload frontend/backend mismatch.** Frontend Gov ID upload still calls old S3 presigned-URL flow; backend expects FormData to `/api/patient/documents/upload`. Needs fixing.

4. **Fargate task retirement 2026-04-19.** AWS scheduled automatic task replacement for April 19, 2026, 10:00 GMT. Should be a non-event due to rolling deployment (100% min / 200% max). Monitor health check during the window.

5. **ACM cert public-access prompt.** During RDS creation, the AWS console didn't show Connectivity / Additional Configuration sections (likely an IAM permission quirk for `sonu-developer`). We worked around it by modifying the DB after creation and creating the `rimalhealth` database via psql in CloudShell.

6. **CloudShell `dig` missing.** Install with `sudo dnf install -y bind-utils`. Or use `host`.

7. **Bash history expansion with `!` in passwords.** Use `set +H` before exporting env vars, then single quotes.

---

## 6. Project Conventions (carried over)

- Act quickly on clear tasks; ask before expanding scope
- Be concise; no time estimates; no emoji
- Number steps for multi-stage work
- **HIPAA NEVER:** log/URL/JWT/email-subject PHI; store PHI unencrypted; cache PHI in browser storage
- Don't manually call `encryptPHI()` / `decryptPHI()` on fields already in the Prisma extension's `PHI_FIELDS` map — causes double encryption
- 42 CFR Part 2 enforcement active (Feb 16, 2026)
- California-only
- Before "done": `npm run type-check`, `npm run lint`, `npm test` all pass
- Never `.catch(() => {})` — always log
- Don't delete, archive
- Use agents only for truly parallel / context-heavy work

### Verification practice (important)

**Neither the assistant's nor the user's memory is reliable over long sessions.** The user's working memory is orders of magnitude smaller than the 1M-token context window, and the assistant still has gaps after `/compact`. So:

- Don't trust what the user says is done — verify via AWS Console, `curl`, CloudWatch logs, git, or the codebase
- Don't trust what the assistant says is done — verify the same way
- **This file is the authoritative state.** When in doubt, check here first. If this file is wrong, fix it here before acting
- When unsure about current state, ask the user to run a verification command (e.g., `curl`, `dig`, console screenshot) rather than guess

---

## 7. How to Update This File

- Edit directly when infrastructure changes (new resource, env var, endpoint)
- Commit with message prefix `docs: update AWS migration status — <what changed>`
- This file is the single source of truth — if it contradicts CLAUDE.md or the transcript, this file wins
- Refer here before suggesting AWS work in future sessions

---

## 8. Known Bugs — Open & Recently Identified

(Most bugs from Phases 1-11 are fixed. Items below are **open** or **need verification**.)

| Area | Issue | Status | Action |
|------|-------|--------|--------|
| **SES migration** | SendGrid refuses BAA → migrated to SES (code deployed); pending production access | In progress | Wait for AWS approval |
| **Document upload** | Frontend Gov ID upload still uses old S3 presigned flow; backend now uses FormData endpoint → inconsistent | Open | Audit both flows, consolidate to one |
| **CRON_SECRET env var** | Used by `/api/cron/data-retention` and `/api/cron/process-email-retry` | Unverified in ECS task def | Check task def; add if missing |
| **AWS credentials pattern** | `lib/integrations/ses.ts` uses task role (correct); `lib/integrations/s3.ts` may still reference `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` | Unverified | Audit S3 integration; remove explicit creds if present and rely on task role |
| **Patient counts in physician portal** | Physician "Patients" tab missing total/pending/completed breakdown | Open | Backend count query + UI update |
| **Notifications tab duplication** | Settings + patient portal both have "Notifications" | Open (low) | Remove from patient portal |
| **Disclosures tab necessity** | 42 CFR Part 2 — unclear if patient-visible tab required by regulation | Open (needs decision) | Compliance clarification |
| **42 CFR Part 2 Phase 2-3** | Code written (Phase 9); migrations + tests pending | In progress | Run 2 Prisma migrations; test flows |
| **Data retention automation** | `deletedAt` fields designed; DDL + cron deploy pending | In progress | Migrations + cron deploy |
| **React Compiler** | Disabled due to react-hook-form incompatibility | Deferred (P2) | Re-evaluate later |

---

## 9. Complete Environment Variable Inventory

### Database & cache (secrets)

| Variable | Status | Notes |
|----------|--------|-------|
| `DATABASE_URL` | ✅ ECS | RDS connection, `sslmode=no-verify` |
| `REDIS_URL` | ⚠️ ECS (Upstash) | Update after ElastiCache |
| `REDIS_PASSWORD` | Optional | Extracted from URL if present |
| `REDIS_TLS_ENABLED` | Optional | Used when `rediss://` |

### Auth & encryption (secrets)

| Variable | Status |
|----------|--------|
| `JWT_SECRET` | ✅ ECS |
| `PHI_ENCRYPTION_KEY` | ✅ ECS |
| `ENCRYPTION_KEY` | ✅ ECS |

### Stripe

| Variable | Type | Status |
|----------|------|--------|
| `STRIPE_SECRET_KEY` | secret | ✅ ECS |
| `STRIPE_WEBHOOK_SECRET` | secret | ✅ ECS |
| `STRIPE_PRICE_ACTIVE_TREATMENT` | plain | ✅ ECS |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | public | ✅ ECS |
| `STRIPE_PRICE_MAINTENANCE` | — | **Remove** (plan deleted) |
| `STRIPE_PRODUCT_ACTIVE_TREATMENT` | — | Verify if still used, remove if not |

### AWS services (plain; auth via task role)

| Variable | Value |
|----------|-------|
| `AWS_REGION` | `us-east-1` |
| `AWS_S3_BUCKET_NAME` | `rimalhealth-documents` |
| `AWS_LOCATION_PLACE_INDEX` | `rimalhealth-address-validation` |
| `SES_FROM_EMAIL` | `noreply@rimalhealth.com` |
| `SES_FROM_NAME` | `Rimal Health` |
| `STORAGE_PROVIDER` | `s3` |
| `AWS_ACCESS_KEY_ID` | ❌ **Should NOT be set** — use task role |
| `AWS_SECRET_ACCESS_KEY` | ❌ **Should NOT be set** — use task role |

### Email (transition)

| Variable | Status |
|----------|--------|
| `SES_FROM_EMAIL` | ✅ Active |
| `SES_FROM_NAME` | ✅ Active |
| `SENDGRID_API_KEY` | ⚠️ Legacy — remove after SES production access |
| `SENDGRID_FROM_EMAIL` | ⚠️ Legacy — remove |
| `CONTACT_FORM_TO_EMAIL` | Plain |

### SMS (Twilio — for patient MFA)

| Variable | Type |
|----------|------|
| `TWILIO_ACCOUNT_SID` | secret |
| `TWILIO_AUTH_TOKEN` | secret |
| `TWILIO_PHONE_NUMBER` | plain |

### E-prescribing (DoseSpot)

| Variable | Notes |
|----------|-------|
| `DOSESPOT_API_URL` | Sandbox vs prod |
| `DOSESPOT_CLIENT_ID` | secret |
| `DOSESPOT_CLIENT_SECRET` | secret |
| `DOSESPOT_CLINIC_ID` | plain |
| `DOSESPOT_USER_ID` | plain |
| `DOSESPOT_MOCK_MODE` | Must be `false` in prod |
| `DOSESPOT_TIMEOUT_MS` | Optional |
| `DOSESPOT_MAX_RETRIES` | Optional |
| `DOSESPOT_RETRY_DELAY_MS` | Optional |

### App config

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_APP_URL` | `https://rimalhealth.com` |
| `NEXT_PUBLIC_APP_NAME` | `Rimal Health` |
| `NEXT_PUBLIC_APP_VERSION` | Optional, inject at build |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Public |
| `NODE_ENV` | `production` (set in Dockerfile) |
| `PORT` | `3000` (Dockerfile) |
| `HOSTNAME` | `0.0.0.0` (Dockerfile) |

### CI/CD & ops

| Variable | Status |
|----------|--------|
| `CRON_SECRET` | ⚠️ **Verify presence in task def** — bearer token for cron endpoints |
| `SLACK_WEBHOOK_URL` | Documented, not integrated |

---

## 10. Migration Timeline (selected milestones)

| Date | Milestone |
|------|-----------|
| 2026-03-30 | Migration roadmap drafted |
| 2026-04-01 | 6-prompt deep review of patient + physician portals |
| 2026-04-02–04 | Phase 7+ fixes (double-encryption, PHI logging, rate limiting, CSRF) |
| 2026-04-05 | SMS MFA for patients (Twilio) |
| 2026-04-07 | Address validation → Amazon Location Service |
| 2026-04-08 | Maintenance plan removed from schema |
| 2026-04-09 | Discovery: Next.js 16 incompatible with Amplify → pivoted to ECS Fargate |
| 2026-04-09–12 | ECR, ECS, ALB, CodeBuild, security groups created |
| 2026-04-12 | App running on ALB (HTTP) |
| 2026-04-13 | Route 53 zone, ACM cert, HTTPS listener, DNS cutover from SiteGround |
| 2026-04-14 | SES identity verified (DKIM + Custom MAIL FROM); production access requested |
| 2026-04-14 | RDS created, Neon → RDS migration complete, task def rev 6→7, health check green |
| 2026-04-15 | ElastiCache setup pending |

---

## 11. Durable Rules from Prior Corrections

These patterns emerged across multiple user corrections:

1. **Verify state before proposing action.** Don't re-suggest work the user already completed.
2. **No unsolicited alternatives.** When scope is set ("don't make other changes"), honor it.
3. **Honor async signals.** If the user says "waiting for X," pause — don't offer the next step.
4. **User output is ground truth.** Test results, review logs, screenshots = data; act on them, don't re-propose verification.
5. **Suggest with humility.** Commands fail; be ready with diagnostics, not just happy-path instructions.
6. **Assume nothing about infrastructure state.** Ask or verify via console/curl before saying "do X."
7. **This file > everything else.** If the transcript, CLAUDE.md, or memory contradicts this file, **this file wins** — because we maintain it deliberately.

---

## 12. Items Requiring Verification

Before your next session touches AWS, verify these by running actual checks (not trusting memory):

- [ ] `CRON_SECRET` present in ECS task definition (check rev 7)
- [ ] `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` **not** set in task def (should rely on task role)
- [ ] Stripe webhook URL in Stripe dashboard points to `https://rimalhealth.com/api/webhooks/stripe`
- [ ] `DOSESPOT_MOCK_MODE=false` in ECS task def (or omitted) — not `true`
- [ ] SES production access status (check dashboard daily)
- [ ] `lib/integrations/s3.ts` — does it still reference explicit AWS keys? If yes, refactor to use task role
