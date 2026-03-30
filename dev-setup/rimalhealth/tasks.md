# RimalHealth -- Task Tracker

> **Status Legend:** `[ ]` To Do | `[~]` In Progress | `[x]` Done | `[!]` Blocked
> **Last Updated:** 2026-03-29
> **Remaining:** 8 open items (of 102 total)

---

## TASK 1: P0 -- Immediate (Blocking)

- [ ] **1.1 Credential Rotation (USER ACTION REQUIRED)**
  - [!] 1.1.1 Rotate Neon DB password in Neon dashboard -- update `DATABASE_URL` in Netlify env vars
  - [!] 1.1.2 Rotate Netlify auth token in Netlify dashboard -- revoke exposed `nfp_e7CeWeCy5M...`

- [ ] **1.3 Vendor BAA Verification (USER ACTION REQUIRED)**
  - [!] 1.3.1 Verify BAA with Neon (database)
  - [!] 1.3.2 Verify BAA with Netlify (hosting -- may require enterprise plan)
  - [!] 1.3.3 Verify BAA with SendGrid/Twilio (email -- may NOT sign on standard plans)
  - [!] 1.3.4 Verify BAA with AWS (S3 document storage)
  - [!] 1.3.5 Verify BAA with Stripe (payment processing)
  - [!] 1.3.6 If SendGrid lacks BAA, evaluate AWS SES or Postmark as replacement

---

## TASK 2: P1 -- Security & Data Integrity

- [~] **2.5 CI/CD Hardening**
  - [ ] 2.5.3 Verify CI pipeline passes end-to-end

- [~] **2.6 Dual Stripe Consolidation**
  - [ ] 2.6.4 Verify checkout, billing, subscription, webhook all work

---

## TASK 5: P3 -- Backlog

- [~] **5.1 Integrations**
  - [ ] 5.1.3 DoseSpot production mode (currently always mock) -- ON HOLD
