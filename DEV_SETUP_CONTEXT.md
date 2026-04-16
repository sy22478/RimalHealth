# Dev-Setup Context Recovery

**Last updated:** 2026-04-16
**Source:** Recovered from compacted session transcript via deep agent research

This document captures the dev-setup migration details, review prompts, reference document contents, and CLAUDE.md evolution that were lost during context compaction. It serves as a reference for future sessions.

---

## 1. Dev-Setup Migration Overview

### What happened

The project had 31 files in `dev-setup/rimalhealth/` — a legacy documentation structure with fictional agent teams (Teams A-H), session handoff docs, and planning artifacts. These were migrated to Claude Code native primitives (rules, agents, skills) to reduce session startup overhead from ~30-50K tokens to ~1.5K tokens.

### Migration instructions

Full runbook at `/home/user/RimalHealth/dev-setup-migration-instructions.md` (on main branch).

7 phases:
1. Create `.claude/rules/` (5 conditional knowledge files)
2. Create `.claude/agents/` (3 real agents replacing fictional teams)
3. Create `.claude/skills/review-code/` (on-demand code review skill)
4. Archive 22 historical files to `dev-setup/rimalhealth/archive/`
5. Trim CLAUDE.md from ~180 to ~140 lines
6. Trim tasks.md from 274 to ~30 lines
7. Validate and test

### Files inventory (31 total → 9 kept, 22 archived)

**Kept actively:**
- `context_brief.md` (~400 lines) — domain knowledge, HIPAA framework, clinical info, business rules, RBAC
- `build_instructions.md` (~600 lines) — maintenance guide, 79 API routes, data flows, deployment runbook
- `asset_manifest.md` (~350 lines) — 55+ env vars, 8 integrations, schema overview
- `compliance_42cfr2.md` (~250 lines) — 42 CFR Part 2 gap analysis, 7 gaps, implementation plan
- `tasks.md` (~30 lines, trimmed) — open items only

**Kept as reference:**
- `email_provider_evaluation.md` — SendGrid→SES decision (SendGrid won't sign BAA)
- `rollback_strategy.md` — emergency rollback procedures
- `design_inspiration.md` — UX/UI philosophy
- `research_improvements.md` — HIPAA 2026 changes, Next.js 16 features

**Archived (22 files):**
- `session_handoff.md`, `trace.md`, `conversation.md` — replaced by auto-memory
- `plan.md`, `plan_arch_review.md` — sprint S4 complete
- 6x `review_*.md` files — all findings fixed in Phases 5-9
- 3x `team_f/g/h_*.md` — replaced by `.claude/agents/`
- `skills_matrix.md`, `e5_claude_md_v2_spec.md` — one-time planning
- 3x `p1/p2/p3_*.md` — one-time agent outputs

---

## 2. Claude Code Native Primitives Created

### Rules (5 files, conditional loading)

| File | Globs | Content source | ~Lines |
|------|-------|----------------|--------|
| `.claude/rules/hipaa.md` | `lib/**`, `app/api/**` | context_brief.md §2.1-2.5 | 60 |
| `.claude/rules/api-patterns.md` | `app/api/**` | build_instructions.md §3.1-3.4 | 50 |
| `.claude/rules/42cfr2.md` | `app/api/patient/**`, `app/api/physician/**` | compliance_42cfr2.md §1, §3 | 30 |
| `.claude/rules/stripe.md` | `lib/stripe/**`, `app/api/stripe/**`, `app/api/webhooks/stripe/**` | build_instructions.md §5.1 | 25 |
| `.claude/rules/testing.md` | `tests/**`, `**/*.test.ts` | build_instructions.md §7 | 30 |

### Agents (3 files, isolated context)

| Agent | Replaces | Model | Tools | Purpose |
|-------|----------|-------|-------|---------|
| `code-reviewer.md` | Team F | sonnet | Read, Grep, Glob, Bash | HIPAA + security + quality code review |
| `debugger.md` | Team G | sonnet | Read, Grep, Glob, Bash | Root cause investigation |
| `architect.md` | Team H | sonnet | Read, Grep, Glob, Bash | Architecture health assessment |

### Skills

| Skill | Description |
|-------|-------------|
| `/review-code` | Runs code-reviewer agent on recent changes (git diff) |
| `/deploy` | Pre-existing deployment skill |
| `/preflight` | Pre-existing pre-deploy checks |

---

## 3. CLAUDE.md Evolution

### Key changes made

**Removed:**
- "Key Reference Files" table (7 files, encouraged 30K+ token reads at startup)
- "Testing Details" section → moved to `.claude/rules/testing.md`
- "Key lib/ Modules" rows for security/, stripe/, integrations/, compliance/, redis/ → covered by rules
- "Key Patterns" subsection (PHI Encryption, Server Components, React Compiler, Audit Logging) → covered by rules
- Stripe conventions → moved to `.claude/rules/stripe.md`

**Kept:**
- Project overview, app location, development commands
- Middleware, auth flow, patient flow architecture
- Forms, shadcn/ui, Tailwind conventions
- Environment setup, deployment section

**User feedback that drove changes:**
> "The problem is your `session_handoff.md` says 'Read this first,' `tasks.md` says 'Read before starting work,' and previous sessions trained Claude to read 5-10 of these files at session start. That's easily 30,000-50,000 tokens consumed before any real work begins."

**Deployment section evolution:** Vercel (incorrect) → Netlify → AWS Amplify (incompatible with Next.js 16) → Docker on ECS Fargate (current)

---

## 4. Review Prompts & Testing Workflows

### The 6-Prompt Deep Review Structure

The user created 6 structured review prompts for deep code review, organized by portal and reviewer type:

**By portal:** Patient portal, Physician portal, Admin portal
**By reviewer type:** Backend reviewer, Frontend reviewer, Integration tester

### Review Team Architecture

**Team F (Code Review) — 3 tiers:**
- F1: HIPAA Gate (PHI encryption, audit logging, access controls)
- F2: Quality Gate (TypeScript strict, Zod validation, error handling)
- F3: Security Gate (input validation, auth patterns, CSRF, rate limiting)

**Team G (Debugging)** — full codebase audit: PHI flow tracing, email content audit, browser storage audit, auth coverage mapping

**Team H (Architecture)** — system health scoring: CI/CD, database design, module boundaries, PHI encryption pipeline, auth architecture, testing architecture

### Output Format (standardized across all reviewers)

```
| # | Severity | Category | File:Line | Issue | Fix |
|---|----------|----------|-----------|-------|-----|
| 1 | CRITICAL | F1-HIPAA | lib/intake/auto-save.ts:45 | PHI in sessionStorage | Delete module |
| 2 | CRITICAL | F3-Security | app/api/auth/verify-email/route.ts:12 | No rate limiting | Add rateLimit() |
```

Severity levels: CRITICAL (must fix before deploy) → WARNING (fix in next phase) → INFO (nice to have)

Verdict: DEPLOY (no criticals) | FIX FIRST (has criticals) | REDESIGN (architectural issue)

### Patient Portal Testing Flows (7 flows)

1. **Login → Intake Gate → Intake Form → Submit** — 33 questions, 7 sections, 4 scoring functions
2. **Profile View → Edit → Save** — address validation, pharmacy preference, encrypted fields
3. **Documents → Upload Gov ID** — S3 presigned URL flow (later simplified to direct upload)
4. **Billing → Payment Method → Cancel Subscription** — trial status, cancel_at_period_end
5. **Prescriptions → View Status** — UNDER_REVIEW, APPROVED, SENT, REJECTED mappings
6. **DOB Accuracy** — timezone-safe date handling verification
7. **Messages → Send → Receive** — patient-physician messaging

### Physician Portal Testing Flows (7 flows)

1. **Login → Dashboard → Pending Reviews Count**
2. **Review Queue → Patient List**
3. **Click Patient → Review Intake** — all 7 sections, scoring results
4. **Approve/Reject Intake** — creates Review record, triggers trial_end
5. **Send Prescription** — manual workflow, status update + patient notification
6. **Refill Request Handling**
7. **Session Refresh + Token Management**

### Bug Verification Format

```
| # | Bug | Status | Evidence |
|---|-----|--------|----------|
| 1 | Profile page doesn't work | FIXED | GET returns all fields (route.ts:126-129). Form handles nulls (PersonalInfoForm.tsx:450-463). |
| 2 | ID upload not working | STILL BROKEN | Frontend uses old presigned-URL flow; new FormData endpoint exists but unused. |
```

### Post-Fix Validation Commands

```bash
npm run type-check   # 0 errors
npm run lint         # 0 errors
npm run build        # Success
```

### User Feedback on Reviewer Effectiveness

> "Even though we performed code and system review with six reviewers, there were still errors/bugs found. Why were reviewers not able to catch these bugs?"

Key missed bugs: ID upload system, profile page, billing shows $0 during trial, DOB corruption, prescription text overflow, pharmacy validation gaps, missing doctor's notes, 2FA not implemented, proration on cancel.

---

## 5. Reference Document Key Contents

### context_brief.md — Domain Knowledge

- **Clinical:** AUD treatment with Naltrexone, AUDIT-C screening (0-12), Risk Score (0-100), DSM-5 (11 questions)
- **HIPAA:** 28 PHI fields across 7 models, AES-256-GCM encryption via Prisma extension
- **Business rules:** Payment-first flow, 24h physician review SLA, one active intake per patient, all physicians see all patients, California-only, email verification enforced for PATIENT role
- **Pricing:** $50/mo active treatment (maintenance plan removed)
- **RBAC:** 39 permissions (PATIENT: 13, PHYSICIAN: 16, ADMIN: 43)
- **Critical warnings:** Dual encryption systems (PHI_ENCRYPTION_KEY hex ≠ ENCRYPTION_KEY base64), dual audit loggers

### build_instructions.md — Maintenance Guide

- **Design system:** Navy (#0A2540) + Ocean (#0284C7), Instrument Sans, Tailwind v4
- **79 API routes** catalogued by domain (auth, patient, physician, admin, stripe, webhooks)
- **Integration patterns:** Stripe (API 2026-01-28.clover), SES (replaced SendGrid), DoseSpot (mock), S3, SNS (replaced Twilio), Redis
- **Test accounts:** patient.test@rimalhealth.test / TestPatient123@, dr.sarah.johnson@rimalhealth.test / TestPhysician123!, admin@rimalhealth.test / TestAdmin123!

### compliance_42cfr2.md — 42 CFR Part 2

- **Status:** Enforcement active since Feb 16, 2026
- **7 gaps identified:** consent management, accounting of disclosures, privacy notices, redisclosure notice, restriction requests, BAA status, breach notification
- **Implementation status:** ConsentRecord model exists, /api/patient/consent endpoint exists, /patient/disclosures page exists

### asset_manifest.md — Infrastructure

- **55+ env vars** documented with status
- **8 integrations:** Stripe, SES (was SendGrid), SNS (was Twilio), Neon→RDS, Upstash→ElastiCache, S3, DoseSpot (mock), Redis
- **18 Prisma models, 17 enums**

---

## 6. Critical Architectural Notes

### Encryption (from context_brief.md)

- **Prisma extension** (`lib/db/encryption-extension.ts`) auto-encrypts/decrypts PHI fields
- **Manual encryption** (`lib/encryption/phi.ts`) exports `encryptPHI(text, key)` / `decryptPHI(ciphertext, key)`
- **NEVER** call encryptPHI/decryptPHI on fields the Prisma extension manages — causes double-encryption (was a real P0 bug)
- **Dual key warning:** PHI_ENCRYPTION_KEY (hex, ~71 chars) ≠ ENCRYPTION_KEY (base64, ~44 chars) — NOT interchangeable

### Middleware boundary

- Middleware runs at Edge — **Prisma cannot run here**
- Intake gate moved to `app/patient/layout.tsx` (server component) — can use Prisma
- API routes bypass middleware — each route handles its own auth

### Session configuration

- `SESSION_CONFIG` in `lib/constants.ts`: absolute 8h, idle 30m
- Token refresh: automatic via middleware when token < 5 min from expiry
- JWT: 15-min access token, 7-day refresh token, httpOnly cookies

### React Compiler

- **DISABLED** — incompatible with react-hook-form across 18+ form components
- Do NOT re-enable without testing all forms
