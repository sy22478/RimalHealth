# Team H: System Architecture

> **Author:** Team H Design Agent
> **Date:** 2026-03-25
> **Project:** RimalHealth HIPAA Telehealth Platform
> **Status:** Team design document -- ready for PM deployment

---

## 1. Team H Mission & Scope

### Mission

Team H monitors the structural health of the RimalHealth platform. While Teams A-D build and maintain features, Team H evaluates **how the system is built** -- identifying architectural drift, tech debt accumulation, module boundary violations, scaling bottlenecks, and compliance gaps before they become incidents.

### Scope

Team H operates at the architecture level, not the code level:

| In Scope | Out of Scope |
|----------|-------------|
| Module boundaries, dependency direction, coupling analysis | Writing or fixing individual features |
| Database schema design, query patterns, index strategy | Day-to-day Prisma queries |
| Deployment pipeline design, CI/CD reliability | Performing deploys (Team D) |
| HIPAA architecture patterns, encryption strategy correctness | PHI field-level review (Team C via `/hipaa-review`) |
| API surface consistency, error handling standardization | Individual API route implementation (Team A) |
| Bundle size, rendering strategy, caching architecture | CSS/component styling (Team B) |
| Infrastructure single points of failure, DR planning | Ops monitoring execution (Team D via `schedule`) |

### Operating Cadence

| Trigger | Mode | Description |
|---------|------|-------------|
| Before major features | Standard | Full H1+H2+H3 review to validate proposed architecture |
| Quarterly review | Standard | Comprehensive architecture health assessment |
| After large refactors | Lightweight (H2) | Verify module boundaries and dependency direction survived |
| After incidents | Incident (H1+H3) | Root-cause analysis focused on infra and security architecture |
| PM request | Any combination | Ad-hoc assessment of specific concerns |

### Output

Team H produces **Architecture Assessment Reports** for the PM. Each report contains:
- Scored health metrics (1-5 per concern area)
- Prioritized improvement recommendations (P0-P3)
- Implementation guidance (which team, estimated effort, risk)
- Dependencies between improvements

The PM converts these into `tasks.md` items and assigns to Teams A-E for execution.

---

## 2. Agent Roles Within Team H

### H1: Infrastructure Architect

**Focus:** Deployment pipeline, database design, caching strategy, monitoring, infrastructure security.

**Primary Skills:**
- `systematic-debugging` (for infrastructure investigation)
- `/infra-audit` (custom, defined in Section 3)
- `/preflight` (existing)
- `schedule` (for monitoring assessment)

**MCP Tools:**
- **Neon MCP:** `list_slow_queries`, `explain_sql_statement`, `describe_table_schema`, `get_database_tables`, `compare_database_schema`, `create_branch`
- **Playwright MCP:** `browser_navigate`, `browser_network_requests` (for performance profiling)
- **Perplexity:** `search`, `reason` (for infrastructure best practices research)
- **GitHub MCP:** `list_issues`, `get_pull_request_status` (for CI/CD pipeline health)

**What H1 Evaluates (RimalHealth-specific):**

| Concern Area | Concrete Aspects | Key Files |
|-------------|-----------------|-----------|
| **CI/CD Pipeline** | GitHub Actions workflow reliability (`.github/workflows/deploy.yml`), test/security/deploy job ordering, `continue-on-error` on lint/type-check, missing working directory in test job | `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`, `.github/workflows/lighthouse.yml` |
| **Database Design** | Prisma schema (908 lines, 18 models), index coverage for common queries, N+1 patterns in API routes, connection pooling via Neon, migration safety | `prisma/schema.prisma`, `lib/db/prisma.ts` |
| **Caching Strategy** | Redis configuration (TLS, eviction policy, memory limits), cache key design, cache invalidation patterns, API cache middleware | `lib/redis/client.ts`, `lib/redis/cache.ts`, `lib/redis/session.ts`, `lib/middleware/api-cache.ts` |
| **Monitoring** | Health check endpoint, no APM integration, no error tracking (Sentry/Datadog), no uptime monitoring, Slack notifications only on deploy | `app/api/health/route.ts`, `.github/workflows/deploy.yml` (lines 168-264) |
| **Docker/Prod Parity** | Docker Compose exists for local dev (PostgreSQL+Redis+App) but CI deploys directly to Netlify with GitHub Actions services -- inconsistent environments | `docker/docker-compose.yml`, `docker/Dockerfile` |
| **Bundle Size** | Webpack split chunks config, `optimizePackageImports` for Radix/Lucide/Framer/AWS SDK, no bundle size CI gate | `next.config.ts` (lines 229-265) |

**Key Metrics H1 Tracks:**

| Metric | Current Baseline | Target | How to Measure |
|--------|-----------------|--------|----------------|
| CI pipeline success rate | Unknown (no tracking) | >95% | `gh run list --limit 50 --json conclusion` |
| Deploy-to-live latency | ~30s health check wait + build | <10 min total | GitHub Actions timing |
| Database slow queries | Unknown | 0 queries >500ms | Neon MCP `list_slow_queries` |
| Redis cache hit rate | Unknown | >80% for API cache | Custom instrumentation needed |
| Bundle size (JS, first load) | Unknown | <250KB first load | `npm run build:analyze` |
| Lighthouse performance score | Unknown | >90 | `.github/workflows/lighthouse.yml` |
| Health check response time | Unknown | <200ms | `curl -w "%{time_total}" /api/health` |

**Output Format:** Infrastructure Health Report with sections: Pipeline Assessment, Database Assessment, Cache Assessment, Monitoring Gap Analysis, Performance Budget Report.

---

### H2: Application Architect

**Focus:** Code organization, module boundaries, dependency management, API design, state management.

**Primary Skills:**
- `/arch-review` (custom, defined in Section 3)
- `/dependency-review` (custom, defined in Section 3)
- `writing-plans` (for architecture proposals)
- `brainstorming` (for design alternatives)

**MCP Tools:**
- **Serena:** `get_symbols_overview`, `find_symbol`, `search_for_pattern`, `find_referencing_symbols` (for dependency analysis)
- **Context7:** `resolve-library-id`, `query-docs` (for framework best practices)
- **GitHub MCP:** `search_code` (for cross-repo pattern analysis)

**What H2 Evaluates (RimalHealth-specific):**

| Concern Area | Concrete Aspects | Key Files/Dirs |
|-------------|-----------------|----------------|
| **Module Boundaries** | 20 lib/ subdirectories (audit, auth, db, encryption, hipaa, intake, integrations, middleware, notifications, patient, physician, redis, security, services, stripe, utils, validation) -- are boundaries clean? Do modules only depend downward? | `lib/` (86 files, 33,987 lines) |
| **Dual Implementations** | Three encryption modules (`lib/encryption/phi.ts`, `lib/hipaa/encryption.ts`, `lib/db/encryption.ts`), two Stripe modules (`lib/integrations/stripe.ts`, `lib/stripe/`), two audit loggers (`lib/hipaa/audit-logger.ts`, `lib/audit/logger.ts`) | See files listed |
| **Component Architecture** | `components/physician/` is 15,582 lines across 42 files -- needs sub-module splitting? `components/forms/` (17 files) has intake form + checkout steps co-located | `components/physician/`, `components/forms/` |
| **Middleware Design** | `middleware.ts` at 313 lines handles auth extraction, role routing, cookie refresh, header injection -- too many concerns? | `middleware.ts` |
| **API Surface Consistency** | 76 API routes across 6 groups -- consistent error response format? Consistent auth pattern usage? Consistent Zod validation? | `app/api/` |
| **Dead Code** | Orphaned `app/profile/setup/page.tsx` (793 lines), duplicate `app/(marketing)/payment/page.tsx`, duplicate `components/physician/MessageThread.tsx` | See P2 Section 5.4 |
| **Testing Architecture** | 14 test files for 422 source files (3.3% coverage by file count), `npm test` only runs integration tests, no component tests, no service tests | `tests/`, `vitest.config.ts`, `vitest.unit.config.ts`, `vitest.integration.config.ts` |
| **State Management** | Patient dashboard data fetching, form state in IntakeClient (1,444 lines), auth state propagation | `app/intake/IntakeClient.tsx`, `app/patient/dashboard/page.tsx` |

**Key Metrics H2 Tracks:**

| Metric | Current Baseline | Target | How to Measure |
|--------|-----------------|--------|----------------|
| Duplicate code modules | 3 pairs (encryption, stripe, audit) | 0 pairs | Manual audit |
| Dead/orphaned files | 4-5 identified | 0 | grep for unreferenced files |
| Largest file (lines) | 1,444 (`IntakeClient.tsx`) | <500 per component, <300 per API route | `wc -l` |
| lib/ module count | 86 files across 20 dirs | Stable or decreasing | `find lib/ -name "*.ts" \| wc -l` |
| Test file ratio | 14/422 = 3.3% | >20% (>84 test files) | `find tests/ -name "*.test.ts" \| wc -l` |
| API routes without Zod validation | Unknown | 0 | grep for routes missing `safeParse` |
| Components >500 lines | ~8 | 0 | `wc -l components/**/*.tsx` |
| Circular dependencies | Unknown | 0 | `npx madge --circular lib/` |

**Output Format:** Application Architecture Report with sections: Module Boundary Assessment, Dependency Graph Analysis, API Surface Audit, Dead Code Inventory, Testing Architecture Gap Analysis, Refactoring Recommendations.

---

### H3: Security & Compliance Architect

**Focus:** HIPAA architecture, encryption strategy, audit trail design, data retention, access control model.

**Primary Skills:**
- `/hipaa-review` (proposed in skills_matrix.md)
- `verification-before-completion`
- `systematic-debugging` (for security investigation)

**MCP Tools:**
- **Neon MCP:** `run_sql` (for encryption verification queries), `describe_table_schema` (for PHI field audit), `get_database_tables` (for schema review)
- **Perplexity:** `deep_research` (for HIPAA regulation updates, security advisory research)
- **Playwright MCP:** `browser_console_messages`, `browser_network_requests` (for PHI leak detection in client)

**What H3 Evaluates (RimalHealth-specific):**

| Concern Area | Concrete Aspects | Key Files |
|-------------|-----------------|-----------|
| **PHI Encryption Pipeline** | Three separate encryption modules with incompatible key formats (hex vs base64); Prisma extension uses `lib/encryption/phi.ts` with `PHI_ENCRYPTION_KEY`, but `lib/env-validation.ts` only validates `ENCRYPTION_KEY`; `lib/db/encryption.ts` purpose unclear | `lib/encryption/phi.ts`, `lib/hipaa/encryption.ts`, `lib/db/encryption.ts`, `lib/db/encryption-extension.ts`, `lib/db/encryption-middleware.ts`, `lib/env-validation.ts` |
| **Audit Trail Completeness** | Two audit loggers (724 lines + 660 lines) imported inconsistently; no automated verification that every PHI access path has audit logging; 28 PHI fields across 6 models need audit coverage | `lib/hipaa/audit-logger.ts`, `lib/audit/logger.ts`, `lib/audit/middleware.ts`, `lib/services/audit-service.ts` |
| **RBAC Architecture** | 39 permissions, 3 roles; Admin bypasses all checks (`if (role === Role.ADMIN) return true`); API routes excluded from middleware -- auth per-route via `requireAuth`/`requireRole`/`requirePermission`; no centralized route-to-permission mapping | `lib/auth/rbac.ts`, `lib/auth/require-auth.ts`, `middleware.ts` |
| **Data Retention** | 7-year HIPAA retention configured in constants but no automated enforcement (no cron, no data lifecycle job); soft delete grace period of 30 days defined but no cleanup process | `lib/constants.ts` (DATA_RETENTION), `lib/hipaa/data-retention.ts` |
| **Security Headers** | 11 security headers applied via `next.config.ts` including CSP, HSTS, CORP, COEP, COOP; API routes get stricter CSP (`default-src 'none'`) | `next.config.ts`, `lib/constants.ts` (SECURITY_HEADERS) |
| **Auth Flow Security** | Custom JWT (not NextAuth); 15-min access tokens, 7-day refresh tokens; httpOnly cookies; token version for invalidation; MFA (TOTP) implemented but optional; account lockout via Redis | `lib/auth/jwt.ts`, `lib/auth/session.ts`, `lib/auth/account-lockout.ts`, `lib/auth/mfa.ts` |
| **Rate Limiting** | Redis-backed: 5 login attempts/15 min, 100 req/min auth, 20 req/min unauth; two implementations (`lib/security/rate-limit.ts` and `lib/middleware/rate-limit.ts`) | `lib/security/rate-limit.ts`, `lib/middleware/rate-limit.ts` |
| **Secrets Management** | Hardcoded secrets risk in `settings.local.json` (flagged in skills_matrix.md risk register); env vars not all documented in `.env.example`; `ignoreBuildErrors` in CI suppresses type safety | `.claude/settings.local.json`, `.env.example`, `next.config.ts` line 271 |

**Key Metrics H3 Tracks:**

| Metric | Current Baseline | Target | How to Measure |
|--------|-----------------|--------|----------------|
| PHI fields without encryption | 0 (Prisma extension covers 28 fields) | 0 | Audit `encryption-extension.ts` PHI_FIELDS map vs schema |
| PHI access paths without audit logging | Unknown | 0 | grep API routes for PHI model access without `auditLogger`/`AuditService` |
| Encryption module count | 3 (should be 1) | 1 | Manual audit |
| Audit logger count | 2 (should be 1) | 1 | Manual audit |
| API routes without auth check | Unknown | 0 (except public routes) | grep `route.ts` for missing `requireAuth`/`requireRole` |
| Security header coverage | 11 headers | 11+ (add HPKP if applicable) | Check `next.config.ts` headers() |
| Missing env var documentation | 12 undocumented vars | 0 | Compare code references vs `.env.example` |
| `ignoreBuildErrors` in production | Yes (CI) | No | Check `next.config.ts` typescript config |

**Output Format:** Security & Compliance Architecture Report with sections: PHI Encryption Pipeline Assessment, Audit Trail Coverage Matrix, RBAC Architecture Review, Data Retention Compliance, Security Headers Audit, Auth Flow Security Assessment, Secrets Management Audit.

---

## 3. Custom Skills for Team H

### `/arch-review` Skill

**Location:** `.claude/skills/arch-review/SKILL.md`

**Trigger:** Before major features, quarterly review, after large refactors.

**Purpose:** Evaluate module coupling, dependency direction, API surface consistency, and error handling patterns against established conventions.

```markdown
# /arch-review

## When to Use
- Before starting a major feature that spans 3+ modules
- Quarterly architecture health check
- After a refactor touching 10+ files
- When PM requests architecture assessment

## Steps

### 1. Module Boundary Analysis
- List all `lib/` subdirectories and their file counts/line counts
- For each module, identify its imports from other `lib/` modules
- Flag any circular dependencies: `npx madge --circular --extensions ts lib/`
- Flag modules importing from "sibling" modules that should be independent
  - Expected dependency direction: routes -> services -> lib modules -> db/utils
  - Violations: lib/patient importing from lib/physician, lib/stripe importing from lib/integrations/stripe

### 2. Dual Implementation Audit
- Check for duplicate encryption modules:
  - `lib/encryption/phi.ts` vs `lib/hipaa/encryption.ts` vs `lib/db/encryption.ts`
  - Which modules import which? Are both actively used?
- Check for duplicate Stripe modules:
  - `lib/integrations/stripe.ts` vs `lib/stripe/stripe-server.ts`
  - Which API routes import which?
- Check for duplicate audit loggers:
  - `lib/hipaa/audit-logger.ts` vs `lib/audit/logger.ts`
  - Which modules import which?

### 3. API Surface Consistency
- Sample 10 API routes from different groups (auth, patient, physician, admin, stripe)
- Verify each follows the standard pattern from build_instructions.md Section 3.3:
  - Auth check at top (`requireAuth`/`requireRole`/`requirePermission`)
  - Zod validation for POST/PUT bodies
  - try/catch with generic error response (no PHI in errors)
  - Audit logging for PHI access
- Flag routes that deviate from the pattern

### 4. Error Handling Patterns
- grep for `catch (error)` blocks in API routes
- Verify error responses use consistent format: `{ error: string }` with appropriate status codes
- Check for PHI leakage in error messages

### 5. Dead Code Detection
- Check for orphaned pages not reachable via navigation or middleware
- Check for unused exports in lib/ modules
- Check for duplicate components (same name in different directories)

### 6. Compare Against Conventions
- Read `CLAUDE.md` and `build_instructions.md`
- Flag any code patterns that contradict documented conventions
- Flag documented conventions that are no longer accurate

## Output Format
Architecture Health Report:
- Overall score (1-5 per area)
- Module Boundary: score + violations
- API Consistency: score + deviations
- Dead Code: inventory with file paths and line counts
- Recommendations: prioritized P0-P3 with effort estimates
```

---

### `/infra-audit` Skill (NEW)

**Location:** `.claude/skills/infra-audit/SKILL.md`

**Trigger:** Quarterly, after CI/CD failures, after infrastructure changes, before scaling events.

**Purpose:** Audit the deployment pipeline, database configuration, cache setup, and infrastructure security.

```markdown
# /infra-audit

## When to Use
- Quarterly infrastructure health check
- After CI/CD pipeline failures
- Before expected traffic increases
- After infrastructure configuration changes
- After security incidents

## Steps

### 1. Deployment Pipeline Audit
- Read `.github/workflows/deploy.yml` and verify:
  - Test job has correct working directory (`premium-telehealth-website/my-app`)
  - All required env vars are injected into test, build, and deploy steps
  - `continue-on-error` is NOT set on critical steps (type-check should fail the build)
  - Security scan job has meaningful thresholds (not `continue-on-error: true` on npm audit)
  - Deploy job waits for test AND security jobs
  - Post-deploy health check has reasonable timeout
  - Smoke tests run against the correct URL
- Check for the `ignoreBuildErrors` flag in `next.config.ts`:
  - If `process.env.CI` causes type errors to be ignored, this is a P0 concern
- Verify deploy concurrency settings prevent overlapping deploys

### 2. Database Configuration Audit
- Use Neon MCP `get_database_tables` to list all tables
- Use Neon MCP `describe_table_schema` on core tables (User, PatientProfile, Intake, Review, Prescription, Message) to verify:
  - Primary keys are present
  - Foreign keys have indexes
  - PHI fields exist as expected (String type for encrypted values)
  - createdAt/updatedAt timestamps exist
- Use Neon MCP `list_slow_queries` to identify queries >100ms
- Use Neon MCP `explain_sql_statement` on any slow queries to check for missing indexes
- Verify connection pooling is configured (check Neon dashboard settings)
- Check for missing indexes on common query patterns:
  - `User.email` (login lookup)
  - `Intake.patientId` + `Intake.status` (patient intake lookup)
  - `Subscription.userId` + `Subscription.status` (subscription check)
  - `Message.threadId` + `Message.createdAt` (message thread sorting)
  - `AuditLog.userId` + `AuditLog.createdAt` (audit log queries)

### 3. Redis Configuration Audit
- Check `lib/redis/client.ts` for:
  - TLS configuration (REDIS_TLS_ENABLED should be true in production)
  - Connection retry strategy
  - Error handling (graceful degradation if Redis is down)
- Check for Redis key namespace collisions:
  - Session keys: `session:*`
  - Cache keys: `cache:*`
  - Rate limit keys: `ratelimit:*`
  - Account lockout keys: `auth:failed_attempts:*`, `auth:locked:*`
  - Notification retry keys: check `lib/redis/` for key patterns
- Assess memory usage patterns:
  - Are TTLs set on all cache keys?
  - Is there a max memory policy configured?
  - Could session storage grow unbounded?

### 4. Security Headers Verification
- Read `next.config.ts` headers() function
- Verify all OWASP recommended headers are present:
  - Content-Security-Policy (check for overly permissive `unsafe-inline`)
  - Strict-Transport-Security (verify max-age >= 31536000, includeSubDomains)
  - X-Frame-Options (DENY or SAMEORIGIN)
  - X-Content-Type-Options (nosniff)
  - Referrer-Policy (strict-origin-when-cross-origin or stricter)
  - Permissions-Policy (verify camera, microphone, geolocation are denied)
  - Cross-Origin-Embedder-Policy, Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy
- Check API routes get `no-store` cache control
- Verify `poweredByHeader: false` in next.config.ts

### 5. Bundle Size Assessment
- Run `npm run build` and capture output (page sizes, first load JS)
- Check `next.config.ts` for `optimizePackageImports` configuration
- Verify webpack splitChunks config creates appropriate vendor/common/ui chunks
- Flag any route with first-load JS > 200KB
- Check that marketing pages are statically generated (not dynamically rendered)

### 6. Single Points of Failure Analysis
- Identify components with no fallback:
  - Database (Neon): Does the app gracefully handle DB downtime? Check error boundaries.
  - Redis: Does rate limiting / session management degrade gracefully if Redis is down?
  - Stripe: Does the webhook handler retry on failure? What happens if webhook delivery fails?
  - SendGrid: Does email sending have retry logic? (Yes: Redis retry queue)
  - DNS: Single domain on SiteGround, deployed on Netlify -- what if either goes down?
- Check for health check endpoint coverage: Does `/api/health` check DB + Redis connectivity?

## Output Format
Infrastructure Audit Report:
- Pipeline Health: score (1-5) + specific issues
- Database Health: score + slow queries + missing indexes
- Cache Health: score + configuration gaps
- Security Headers: pass/fail per header
- Bundle Size: per-route sizes vs budget
- SPOF Analysis: risk matrix
- Recommendations: prioritized P0-P3
```

---

### `/dependency-review` Skill (NEW)

**Location:** `.claude/skills/dependency-review/SKILL.md`

**Trigger:** Monthly, before major upgrades, after `npm audit` findings, before deployments.

**Purpose:** Audit npm dependencies for security, freshness, license compliance, and bundle impact.

```markdown
# /dependency-review

## When to Use
- Monthly dependency health check
- Before upgrading major dependencies (Next.js, Prisma, Stripe SDK)
- After `npm audit` reports vulnerabilities
- When evaluating new dependencies to add
- Before production deployments

## Steps

### 1. Security Vulnerability Scan
- Run `npm audit --json` and parse results
- Categorize by severity: critical, high, moderate, low
- For each critical/high vulnerability:
  - Identify the vulnerable package and affected version range
  - Check if a patch is available (`npm audit fix --dry-run`)
  - Determine if the vulnerability is exploitable in RimalHealth's context
  - Flag if the vulnerable package is in a HIPAA-sensitive code path

### 2. Outdated Dependencies
- Run `npm outdated --json` and parse results
- Categorize updates:
  - **Patch updates** (safe to apply): minor bug fixes
  - **Minor updates** (review changelog): new features, possible behavior changes
  - **Major updates** (breaking changes): require migration effort
- Priority packages to track for RimalHealth:
  - `next` (16.1.6) -- App Router changes, middleware API
  - `@prisma/client` / `prisma` (7.4.1) -- query API, extension API
  - `stripe` (20.3.1) -- payment API changes
  - `zod` (4.3.6) -- schema API (already migrated v3->v4)
  - `react` / `react-dom` (19.2.3) -- hook changes, server components
  - `ioredis` (5.9.3) -- connection handling
  - `bcrypt` (6.0.0) -- security patches
  - `@sendgrid/mail` (8.1.6) -- email API

### 3. License Compliance
- Run `npx license-checker --json` (install if needed)
- Flag packages with:
  - GPL/AGPL licenses (copyleft risk for commercial SaaS)
  - Unknown or UNLICENSED packages
  - Custom/restrictive licenses
- RimalHealth acceptable licenses: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD

### 4. Unused Dependency Detection
- Run `npx depcheck --json` to find:
  - Dependencies listed in package.json but not imported anywhere
  - DevDependencies that could be removed
- Known potentially unused (from P2 analysis):
  - `STRIPE_PRODUCT_ACTIVE_TREATMENT` / `STRIPE_PRODUCT_MAINTENANCE` env vars reference Stripe product IDs not used in code
  - Check if `twilio` SDK is imported anywhere beyond `lib/integrations/twilio.ts` (Twilio is "not connected" per asset_manifest.md)

### 5. Bundle Impact Assessment
- For the top 10 largest production dependencies, estimate bundle contribution:
  - `framer-motion` (heavy animation library -- is it tree-shaken properly?)
  - `@aws-sdk/client-s3` (AWS SDK v3 -- is it only imported server-side?)
  - `stripe` (should only be server-side)
  - `ioredis` (should only be server-side)
  - `bcrypt` (should only be server-side, native module)
  - `lucide-react` (icon library -- `optimizePackageImports` configured)
  - `@radix-ui/*` (UI primitives -- `optimizePackageImports` configured)
- Verify server-only packages are NOT leaked into client bundles

### 6. Dependency Health Assessment
- For critical dependencies (Stripe, Prisma, SendGrid, ioredis), check:
  - Last publish date (stale if >6 months)
  - Open issue count and trend
  - Maintainer activity
  - Whether the package has been deprecated or superseded
- Flag any dependency that is:
  - Unmaintained (no commits in 12 months)
  - Has known unfixed security issues
  - Approaching end-of-life

## Output Format
Dependency Health Report:
- Security: critical/high/moderate/low counts + action items
- Freshness: major/minor/patch update counts + priority upgrades
- Licenses: any non-compliant packages
- Unused: packages safe to remove
- Bundle: estimated client-side impact of heavy dependencies
- Health: risk assessment for critical dependencies
```

---

### `/scale-assessment` Skill (NEW)

**Location:** `.claude/skills/scale-assessment/SKILL.md`

**Trigger:** Quarterly, before marketing pushes, when user count milestones are expected, after performance incidents.

**Purpose:** Evaluate the current architecture's ability to handle growth in users, data, and traffic.

```markdown
# /scale-assessment

## When to Use
- Quarterly scaling readiness review
- Before marketing campaigns that may drive traffic spikes
- When approaching user count milestones (100, 500, 1000, 5000 patients)
- After performance-related incidents
- When evaluating new features that change data access patterns

## Steps

### 1. Database Query Pattern Analysis
- Use Neon MCP `list_slow_queries` to identify queries >100ms
- Use Neon MCP `explain_sql_statement` on the 5 most frequent queries:
  - Patient dashboard data load (profile + intake + prescription + subscription)
  - Physician queue (all SUBMITTED intakes with patient profiles)
  - Message thread listing (messages by threadId with sender info)
  - Audit log queries (by userId + date range)
  - Admin physician listing (all physicians with status)
- Check for N+1 patterns:
  - API routes that fetch a list then loop to fetch related records
  - Prisma queries without `include` where relations are accessed
- Assess index effectiveness:
  - Foreign key columns should have indexes
  - Commonly filtered columns (status, createdAt, email) should be indexed
  - Composite indexes for common WHERE + ORDER BY combinations

### 2. API Response Time Budget
- Define response time targets by route type:
  - Health check: <100ms
  - Auth (login, refresh): <500ms
  - Patient data reads: <300ms
  - Physician queue/review: <500ms
  - Search endpoints: <1000ms
  - Webhook processing: <5000ms (async work)
- Identify routes likely to exceed budgets at scale:
  - Physician queue with 1000+ submitted intakes
  - Audit log queries with millions of rows
  - Message threads with 100+ messages

### 3. Caching Effectiveness
- Audit current caching strategy:
  - What is cached in Redis? (check `lib/redis/cache.ts` and `lib/middleware/api-cache.ts`)
  - What should be cached but isn't?
  - Cache invalidation patterns: how are stale entries cleared?
- Recommended caching additions:
  - Patient profile (changes infrequently, read on every dashboard load)
  - Physician list (changes only on admin actions)
  - Pharmacy search results (static data)
  - AUDIT-C scoring results (deterministic, can be memoized)

### 4. Static vs Dynamic Rendering Strategy
- Audit which pages are statically generated vs server-rendered:
  - Marketing pages (`app/(marketing)/`) should be static with ISR
  - Patient/physician portal pages must be dynamic (auth-gated)
  - Admin pages must be dynamic (data-driven)
- Check for `force-dynamic` usage and whether it's necessary
- Verify ISR (Incremental Static Regeneration) is configured for marketing pages
- Check `next.config.ts` caching headers:
  - Marketing pages: `public, max-age=60, stale-while-revalidate=300` (confirmed in next.config.ts)
  - API routes: `no-store, max-age=0, must-revalidate` (confirmed)
  - Static assets: `public, max-age=31536000, immutable` (confirmed)

### 5. CDN and Static Asset Strategy
- Verify Netlify CDN is serving static assets
- Check for assets that should be CDN-served but aren't:
  - Images in `public/` directory
  - Generated favicon and OG image
  - Font files
- Verify `Image` component from Next.js is used for responsive images with proper `sizes` attribute

### 6. Scaling Bottleneck Identification
- **Database:** Neon serverless Postgres scales compute automatically but connection limits exist. Check Prisma connection pool settings.
- **Redis:** Single Redis instance -- what's the memory ceiling? Is clustering needed?
- **Netlify Functions:** Serverless functions have 10s timeout by default, 26s max. Long-running operations (S3 uploads, DoseSpot API calls) could timeout.
- **Email/SMS:** SendGrid and Twilio have rate limits. Redis retry queue exists but capacity?
- **Stripe Webhooks:** Are webhooks idempotent? What happens on duplicate delivery?
- **PHI Encryption:** AES-256-GCM with scrypt key derivation adds latency per field. With 16 fields on PatientProfile, what's the read/write overhead at scale?

## Output Format
Scale Readiness Report:
- Current Load Estimate: users, data volume, request rate
- Database: query analysis + index recommendations
- API Latency: per-route budget vs estimated performance
- Caching: effectiveness + expansion recommendations
- Rendering: static vs dynamic audit
- Bottlenecks: ranked by severity with mitigation plans
- Growth Ceiling: estimated max users before architecture changes needed
```

---

## 4. Architecture Review Workflow

### 4.1 Trigger Points

| Trigger | Who Initiates | Mode | Response Time |
|---------|--------------|------|---------------|
| Before major feature (>3 files) | PM (Team E) | Standard (H1+H2+H3) | Before development starts |
| Quarterly review | PM or scheduled | Standard (H1+H2+H3) | Within 1 sprint |
| After large refactor (>10 files) | PM or Team F (code review) | Lightweight (H2 only) | Within 2 days |
| After production incident | PM | Incident (H1+H3) | Within 24 hours |
| Dependency security advisory | Team D (DevOps) | Targeted (H3) | Within 48 hours |
| Pre-scaling event | PM | Targeted (H1) | Within 1 week |

### 4.2 Parallel Assessment Process

When PM triggers a Standard review, H1/H2/H3 assess in parallel:

```
PM triggers Team H
        |
        +---> H1: /infra-audit
        |         - Pipeline reliability
        |         - Database query analysis (Neon MCP)
        |         - Redis configuration
        |         - Monitoring gaps
        |         - Bundle size
        |
        +---> H2: /arch-review + /dependency-review
        |         - Module boundary analysis
        |         - Dual implementation inventory
        |         - API surface audit
        |         - Dead code scan
        |         - Dependency health
        |
        +---> H3: HIPAA architecture review
                  - PHI encryption pipeline audit
                  - Audit trail coverage matrix
                  - RBAC architecture review
                  - Data retention compliance
                  - Secrets management
        |
        v
   H1 + H2 + H3 reports merge into
   Architecture Assessment Report
        |
        v
   PM reviews, converts to tasks.md items
```

### 4.3 Architecture Assessment Report Format

```markdown
# Architecture Assessment Report
**Date:** YYYY-MM-DD
**Mode:** Standard / Lightweight / Incident
**Agents:** H1 / H2 / H3 (as applicable)

## Executive Summary
- Overall architecture health: X/5
- Critical issues requiring immediate action: N
- Improvements recommended: N

## Current State Assessment

### Infrastructure (H1) -- Score: X/5
| Area | Score | Key Finding |
|------|-------|-------------|
| CI/CD Pipeline | X/5 | ... |
| Database | X/5 | ... |
| Caching | X/5 | ... |
| Monitoring | X/5 | ... |
| Performance | X/5 | ... |

### Application Architecture (H2) -- Score: X/5
| Area | Score | Key Finding |
|------|-------|-------------|
| Module Boundaries | X/5 | ... |
| Code Organization | X/5 | ... |
| API Consistency | X/5 | ... |
| Testing Architecture | X/5 | ... |
| Dependencies | X/5 | ... |

### Security & Compliance (H3) -- Score: X/5
| Area | Score | Key Finding |
|------|-------|-------------|
| PHI Encryption | X/5 | ... |
| Audit Trail | X/5 | ... |
| Access Control | X/5 | ... |
| Data Retention | X/5 | ... |
| Secrets Management | X/5 | ... |

## Identified Improvements

### P0 -- Critical (fix before next deploy)
| # | What to Change | How to Change | Effort | Risk | Benefit | Implementing Team | Depends On |
|---|---------------|--------------|--------|------|---------|-------------------|------------|
| 1 | ... | ... | S/M/L | L/M/H | ... | A/B/C/D | -- |

### P1 -- High (fix within 1 sprint)
| # | What to Change | How to Change | Effort | Risk | Benefit | Implementing Team | Depends On |
|---|---------------|--------------|--------|------|---------|-------------------|------------|

### P2 -- Medium (fix within 1 quarter)
| # | What to Change | How to Change | Effort | Risk | Benefit | Implementing Team | Depends On |
|---|---------------|--------------|--------|------|---------|-------------------|------------|

### P3 -- Low (backlog)
| # | What to Change | How to Change | Effort | Risk | Benefit | Implementing Team | Depends On |
|---|---------------|--------------|--------|------|---------|-------------------|------------|

## Dependency Map
(Which improvements must be done before others)

## Next Review
Recommended date for next assessment: YYYY-MM-DD
```

### 4.4 Scoring Rubric

| Score | Meaning | Action Required |
|-------|---------|----------------|
| **5/5** | Excellent -- follows best practices, no concerns | None |
| **4/5** | Good -- minor improvements possible, no risk | Backlog (P3) |
| **3/5** | Adequate -- some technical debt, manageable risk | Plan improvement (P2) |
| **2/5** | Concerning -- architectural drift, growing risk | Prioritize fix (P1) |
| **1/5** | Critical -- active risk to production, compliance, or security | Immediate action (P0) |

### 4.5 PM Conversion to tasks.md

After receiving the Architecture Assessment Report, the PM:

1. Reviews each recommendation and validates priority assignment
2. Creates `tasks.md` entries with the following format:
   ```
   ## Architecture Task: [Brief Title]
   - **Source:** Team H Assessment [date], item #N
   - **Priority:** P0/P1/P2/P3
   - **Assigned Team:** A/B/C/D
   - **Dependencies:** [other task IDs]
   - **Acceptance Criteria:** [specific, measurable outcome]
   - **Architecture Context:** [link to relevant section of assessment report]
   ```
3. Inserts P0 items at the top of the current sprint
4. Inserts P1 items into the next sprint planning
5. Adds P2/P3 items to the backlog with architecture tags

---

## 5. Current Architecture Concerns (from Codebase Analysis)

Based on the P2 codebase analysis, context_brief.md, asset_manifest.md, and direct file inspection, Team H would immediately flag these concerns:

### Concern 1: Dual Implementations (P1 -- Module Boundary Violation)

**What:** Three critical subsystems have duplicate implementations that create maintenance burden and divergence risk.

| Subsystem | Module A | Module B | Module C | Risk |
|-----------|----------|----------|----------|------|
| **Encryption** | `lib/encryption/phi.ts` (uses `PHI_ENCRYPTION_KEY`, hex format, scrypt) | `lib/hipaa/encryption.ts` (uses `ENCRYPTION_KEY`, base64 format) | `lib/db/encryption.ts` (unclear usage) | Data encrypted by one module cannot be decrypted by the other. Mixing them corrupts patient data. |
| **Stripe** | `lib/integrations/stripe.ts` (693 lines, older) | `lib/stripe/stripe-server.ts` + 3 files (1,292 lines, newer) | -- | Webhook handler uses new module; some API routes may still use old module. Behavior divergence on API version handling. |
| **Audit Logging** | `lib/hipaa/audit-logger.ts` (724 lines) | `lib/audit/logger.ts` (660 lines) | -- | Inconsistent audit coverage. Some modules log via one, some via the other. HIPAA requires comprehensive audit trail. |

**Recommendation:**
- **Encryption:** Consolidate to `lib/encryption/phi.ts` (the one used by Prisma extension). Deprecate `lib/hipaa/encryption.ts` and `lib/db/encryption.ts`. Add `PHI_ENCRYPTION_KEY` to `lib/env-validation.ts` as required. **Team A, effort: Medium, risk: High (must verify no data is encrypted with the deprecated module).**
- **Stripe:** Consolidate to `lib/stripe/` module. Remove `lib/integrations/stripe.ts` after verifying all API routes import from `lib/stripe/`. **Team A, effort: Small, risk: Medium.**
- **Audit Logging:** Consolidate to `lib/audit/logger.ts` (the singleton pattern). Update all imports from `lib/hipaa/audit-logger.ts` to use the canonical logger. **Team A, effort: Medium, risk: Low.**

---

### Concern 2: Testing Architecture Gap (P1)

**What:** 14 test files covering 422 source files (3.3% file coverage). Critical HIPAA-sensitive paths have zero tests.

| Missing Test Area | Source Files | Lines | HIPAA Risk |
|-------------------|-------------|-------|------------|
| Audit logging | `lib/audit/logger.ts`, `lib/hipaa/audit-logger.ts` | 1,384 | HIGH -- untested audit = compliance gap |
| Intake scoring (AUDIT-C) | `lib/intake/scoring.ts` | 389 | MEDIUM -- incorrect scoring = clinical risk |
| Notification service | `lib/services/notification-service.ts` | ~500 | LOW |
| S3 document storage | `lib/integrations/s3.ts` | 994 | MEDIUM -- PHI documents |
| Rate limiting | `lib/security/rate-limit.ts`, `lib/middleware/rate-limit.ts` | ~400 | MEDIUM -- brute force protection |
| CSRF protection | `lib/security/csrf.ts` | ~200 | MEDIUM |
| Component rendering | 140 component files | 31,906 | LOW |

**Additional issue:** `npm test` (root `vitest.config.ts`) only runs integration tests. Developers may believe they've run all tests when they haven't.

**Recommendation:**
- Fix `vitest.config.ts` to include both unit and integration tests, or rename `npm test` script to make the distinction clear. **Team C, effort: Small, risk: Low.**
- Prioritize test creation: audit logging > intake scoring > rate limiting > CSRF > S3. **Team C, effort: Large (ongoing), risk: Low.**
- Add React Testing Library for component tests. **Team C, effort: Medium.**

---

### Concern 3: Oversized Components and Files (P2)

**What:** Several files exceed reasonable size thresholds, indicating they handle too many responsibilities.

| File | Lines | Concern |
|------|-------|---------|
| `app/intake/IntakeClient.tsx` | 1,444 | Multi-step wizard with 8+ steps, form validation, auto-save, navigation, scoring display -- should be decomposed into step components |
| `app/physician/(portal)/messages/page.tsx` | 1,072 | Messaging page with thread list, message display, compose, reply -- should use composition |
| `lib/integrations/s3.ts` | 994 | S3 integration with presigned URLs, encryption, virus scanning, MIME detection -- could separate concerns |
| `prisma/schema.prisma` | 908 | 18 models + 17 enums in one file -- Prisma supports multi-file schemas since v5.15 |
| `lib/notifications/templates.ts` | 854 | 20 email + 7 SMS templates in one file -- could split by category |
| `components/physician/PatientDetailView.tsx` | 798 | Full patient view -- could decompose into section components |
| `app/profile/setup/page.tsx` | 793 | Likely orphaned (not in middleware public routes or navigation) |

**The `components/physician/` directory** contains 42 files (15,582 lines) -- the largest component group. Sub-module splitting is warranted:
- `components/physician/queue/` -- queue-related components
- `components/physician/review/` -- intake review components
- `components/physician/messaging/` -- messaging components (partially exists)
- `components/physician/patients/` -- patient management components
- `components/physician/prescriptions/` -- prescription components

**Recommendation:** Decompose files >500 lines into smaller, focused modules. Start with `IntakeClient.tsx` (extract step components) and `components/physician/` (create sub-directories). **Team B, effort: Large, risk: Low (refactoring, no logic change).**

---

### Concern 4: Middleware Separation of Concerns (P2)

**What:** `middleware.ts` at 313 lines handles 5 distinct responsibilities in a single file:

1. **Static route matching** (lines 1-30): Defines PUBLIC_ROUTES and STATIC_ROUTES
2. **Auth page redirect** (authenticated users visiting /login, /signup): Redirects to role-appropriate dashboard
3. **JWT extraction and verification** (from cookie or header)
4. **Role-based route access** (patient/physician/admin path matching)
5. **Header injection and cookie refresh** (x-user-id, x-user-role, x-user-email, accessToken cookie)

**Recommendation:** Extract into composable middleware functions:
```
middleware.ts (orchestrator, ~50 lines)
  -> lib/middleware/static-routes.ts (route matching)
  -> lib/middleware/auth-redirect.ts (auth page redirect)
  -> lib/middleware/jwt-verify.ts (token extraction)
  -> lib/middleware/role-guard.ts (role-based access)
  -> lib/middleware/header-inject.ts (header injection)
```
This makes each concern testable independently and reduces the cognitive load of modifying auth behavior. **Team A, effort: Medium, risk: Medium (middleware is critical path).**

---

### Concern 5: No Monitoring or Alerting Infrastructure (P1)

**What:** The application has zero runtime monitoring beyond a basic `/api/health` endpoint and deploy-time Slack notifications.

| Missing | Impact |
|---------|--------|
| **Application Performance Monitoring (APM)** | Cannot detect slow API routes, memory leaks, or error rate spikes in production |
| **Error Tracking** (Sentry/Datadog) | Errors only visible in Netlify function logs, no aggregation, no alerting |
| **Uptime Monitoring** | No external ping service verifying rimalhealth.com is up |
| **Database Monitoring** | No slow query alerts, no connection pool monitoring |
| **Redis Monitoring** | No memory usage alerts, no eviction monitoring |
| **Business Metric Monitoring** | No tracking of: signups/day, intake submissions, review SLA compliance |
| **PHI Access Anomaly Detection** | No alerting on unusual PHI access patterns (potential breach indicator) |

For a HIPAA-regulated healthcare application, this is a significant gap. HIPAA's Security Rule requires "audit controls" and "security incident procedures" -- both need monitoring.

**Recommendation:**
- **Phase 1 (P1):** Add Sentry for error tracking (free tier covers small apps). Instrument API routes with `@sentry/nextjs`. **Team D, effort: Small.**
- **Phase 2 (P2):** Add UptimeRobot or Checkly for external uptime monitoring of `/api/health`. **Team D, effort: Small.**
- **Phase 3 (P2):** Implement scheduled health checks via `schedule` skill that query Neon MCP `list_slow_queries` and alert on degradation. **Team D, effort: Medium.**
- **Phase 4 (P3):** Add business metric dashboard (intake count, review SLA, subscription churn). **Team A + Team B, effort: Large.**

---

### Concern 6: CI/CD Pipeline Weaknesses (P1)

**What:** The deploy workflow (`.github/workflows/deploy.yml`) has several issues:

| Issue | Location | Impact |
|-------|----------|--------|
| **`ignoreBuildErrors` in CI** | `next.config.ts` line 271: `ignoreBuildErrors: !!process.env.CI` | Type errors pass CI silently. Production could have runtime type errors that TypeScript would have caught. |
| **npm audit `continue-on-error: true`** | `deploy.yml` line 100 | Security vulnerabilities never block deployment. Critical vulns can ship to production. |
| **Missing working directory in test job** | `deploy.yml` (test job) | All commands run from repo root, not `premium-telehealth-website/my-app/`. This means `npm ci` installs wrong dependencies unless package.json is at root. |
| **Lint has no `continue-on-error`** | `deploy.yml` line 62 | Lint failures WILL block deploy (good), but type-check at line 65 runs `npx tsc --noEmit` without `continue-on-error` -- inconsistent with `ignoreBuildErrors`. |
| **Static 30s sleep before health check** | `deploy.yml` line 160 | Wastes CI time. Should use retry-with-backoff instead. |
| **Deprecated action** | `deploy.yml` line 294: `actions/create-release@v1` | `actions/create-release` is archived. Should use `softprops/action-gh-release` or `gh release create`. |

**Recommendation:**
- Remove `ignoreBuildErrors: !!process.env.CI` from `next.config.ts`. Fix any type errors that surface. **Team D + Team A, effort: Medium, risk: Medium.**
- Set `continue-on-error: false` on npm audit with `--audit-level=critical` (allow moderate, fail on critical). **Team D, effort: Small.**
- Add `working-directory: premium-telehealth-website/my-app` to test job steps. **Team D, effort: Small.**
- Replace 30s sleep with polling loop. **Team D, effort: Small.**

---

### Concern 7: Docker/Production Environment Parity (P3)

**What:** Docker setup exists (`docker/docker-compose.yml` with PostgreSQL, Redis, and App services) but CI deploys directly to Netlify using GitHub Actions services for PostgreSQL and Redis. Local dev may use either Docker or direct `npm run dev`.

This creates three distinct environments:
1. **Local dev:** macOS, possibly no Postgres/Redis, or Docker services
2. **CI (GitHub Actions):** Ubuntu, Postgres 15-alpine, Redis 7-alpine as services
3. **Production (Netlify):** Serverless functions, Neon Postgres, managed Redis

The Docker setup uses `Dockerfile` with a multi-stage build for standalone Next.js, but production uses Netlify's build (not standalone).

**Recommendation:** This is low priority since the app works in production. Document the intended local dev setup clearly. Consider removing the standalone output conditional in `next.config.ts` if Docker deployment is not planned. **Team D, effort: Small, risk: Low.**

---

### Concern 8: Env Var Documentation Drift (P2)

**What:** 12 environment variables are used in code but not documented in `.env.example`. Two variables are documented in `.env.example` but not used in code. The critical `PHI_ENCRYPTION_KEY` is not validated by `lib/env-validation.ts` despite being the key used by the Prisma encryption extension.

**Key risk:** If `PHI_ENCRYPTION_KEY` is missing, the Prisma encryption extension may fail silently or use a fallback, potentially storing PHI unencrypted.

**Recommendation:**
- Add `PHI_ENCRYPTION_KEY` to `lib/env-validation.ts` as required in all environments. **Team A, effort: Small, risk: Low. Priority: P0.**
- Update `.env.example` with all 12 missing variables. **Team D, effort: Small.**
- Remove unused `STRIPE_PRODUCT_*` entries from `.env.example`. **Team D, effort: Small.**

---

## 6. Integration with Existing Teams

### Team H vs Team E (Planning)

| Aspect | Team E (Planning) | Team H (Architecture) |
|--------|------------------|----------------------|
| **Focus** | WHAT to build, sprint planning, task prioritization | HOW it's built, structural patterns, technical debt |
| **Trigger** | Feature requests, user stories, PM decisions | Pre-feature review, quarterly audits, post-incident analysis |
| **Output** | `tasks.md` items, sprint plans, feature specifications | Architecture Assessment Reports, improvement recommendations |
| **Time horizon** | Current sprint + next sprint (2-4 weeks) | Quarter to year (architectural decisions have long-term impact) |
| **Skills** | `writing-plans`, `dispatching-parallel-agents`, `brainstorming` | `/arch-review`, `/infra-audit`, `/dependency-review`, `/scale-assessment` |

**Interaction model:** Team E consults Team H before planning features that require architectural changes. Team H provides recommendations that Team E incorporates into sprint planning. Team E never implements architecture changes directly -- it plans and assigns them to Teams A-D.

### How Team H Recommendations Feed into tasks.md

```
Team H Assessment Report
        |
        v
PM validates recommendations
        |
        v
P0 items -> Immediate tasks (current sprint, blocking)
P1 items -> Next sprint tasks (prioritized)
P2 items -> Backlog (architecture tag)
P3 items -> Backlog (low priority)
        |
        v
tasks.md entries with format:
  ## [Architecture] Brief Title
  Source: Team H Assessment [date] #N
  Priority: P0/P1/P2/P3
  Team: A/B/C/D
  Dependencies: [...]
  Criteria: [measurable outcome]
```

### How Team H Reviews Team F (Code Review) Findings

Team F (Code Review) operates at the individual PR/commit level. Team H looks for **systemic patterns** in Team F's findings:

| Team F Finding | Team H Pattern Recognition |
|---------------|---------------------------|
| "Missing audit logging on this route" | Systematic audit coverage gap -- how many routes are missing it? |
| "Inconsistent error response format" | API surface consistency problem -- need standardized error middleware? |
| "This file is too long" | Component architecture issue -- needs decomposition strategy |
| "Duplicate code between patient and physician messaging" | Module boundary violation -- shared messaging module needed? |
| "PHI in console.log" | Systematic PHI leak risk -- need automated scanning in CI? |

Team H reviews Team F's findings monthly to identify recurring themes. Recurring findings become architecture improvement recommendations.

### How Team H Informs Team E's Sprint Planning

Each quarter, Team H provides Team E with:

1. **Architecture Priority Stack:** A ranked list of architectural improvements, with estimated effort and dependencies, that Team E should weave into sprint planning alongside feature work.
2. **Architecture Tax Budget:** A recommendation for what percentage of sprint capacity should be allocated to architecture improvements (typical: 10-20%).
3. **Feature Architecture Assessment:** For each proposed feature in the sprint, Team H flags any architectural concerns or prerequisites.

---

## 7. PM Deployment Model

### Deployment Modes

| Mode | Agents | When to Use | Duration | Output |
|------|--------|------------|----------|--------|
| **Lightweight** | H2 only | Quick code organization check, post-refactor validation | 30-60 min | Brief assessment (1 page) |
| **Standard** | H1 + H2 + H3 | Quarterly review, pre-feature assessment | 2-4 hours | Full Architecture Assessment Report |
| **Incident** | H1 + H3 | After production incident, security advisory | 1-2 hours | Incident Architecture Review (focused) |
| **Targeted** | Any single agent | Specific concern (e.g., just dependency review, just DB performance) | 30-60 min | Single-area report |

### PM Dispatch Commands

The PM dispatches Team H agents using these patterns:

```
# Lightweight mode (H2 only)
"Run /arch-review on the current codebase. Focus on module boundaries
and dead code. Produce a brief assessment."

# Standard mode (H1+H2+H3 in parallel)
"Run full architecture review:
 - H1: /infra-audit
 - H2: /arch-review + /dependency-review
 - H3: HIPAA architecture review
Produce consolidated Architecture Assessment Report."

# Incident mode (H1+H3)
"After [incident description], run:
 - H1: /infra-audit focused on [affected component]
 - H3: Security assessment of [affected area]
Produce Incident Architecture Review with root cause analysis."

# Targeted mode (single agent)
"Run /scale-assessment. We're expecting 500 new patients next month
from marketing campaign. Assess database and API readiness."

"Run /dependency-review. npm audit flagged a critical vulnerability
in [package]. Assess impact and remediation."
```

### Combining Team H with Other Teams

Team H can be deployed alongside any combination of Teams A-E and Teams F/G:

| Scenario | Teams Deployed | How They Interact |
|----------|---------------|-------------------|
| **Major feature development** | E (plan) + H (arch review) + A (API) + B (UI) + C (QA) | E plans feature, H validates architecture before A/B start implementing, C writes tests |
| **Quarterly maintenance sprint** | H (full review) + A (fix architecture issues) + C (add tests) + D (fix CI/CD) | H identifies issues, PM assigns to A/C/D for implementation |
| **Post-incident response** | H (incident mode) + A (fix) + D (deploy fix) | H identifies root cause, A implements fix, D deploys |
| **Pre-deploy validation** | H (targeted: dependency review) + D (deploy) | H verifies dependencies are safe, D proceeds with deploy |
| **Code quality sprint** | F (code review) + H (pattern analysis) + A/B (fixes) | F reviews recent PRs, H identifies systemic patterns, A/B fix issues |

### Integration with Team Roster (Updated Matrix)

| Team | Role | Primary Skills | Interaction with Team H |
|------|------|---------------|------------------------|
| **A: API & Backend** | Implement backend changes | `systematic-debugging`, `test-driven-development` | Receives architecture improvement tasks from H; implements module consolidation, API standardization |
| **B: Frontend & UX** | Implement UI changes | `frontend-design`, `brainstorming` | Receives component decomposition tasks from H; implements UI architecture improvements |
| **C: Testing & QA** | Write tests, verify compliance | `test-driven-development`, `verification-before-completion` | Receives test architecture gap analysis from H; implements test coverage expansion |
| **D: DevOps & Deployment** | CI/CD, infra changes | `/deploy`, `/preflight`, `schedule` | Receives pipeline and infra improvements from H; implements monitoring, CI/CD fixes |
| **E: Planning** | Sprint planning, coordination | `writing-plans`, `dispatching-parallel-agents` | Consults H for architecture input on feature planning; converts H recommendations to tasks |
| **F: Code Review** | PR-level review | `requesting-code-review` | Feeds recurring findings to H for systemic analysis |
| **G: Documentation** | Docs maintenance | `revise-claude-md` | Updates CLAUDE.md and build_instructions.md when H recommendations change architectural patterns |
| **H: Architecture** | System design health | `/arch-review`, `/infra-audit`, `/dependency-review`, `/scale-assessment` | Produces Architecture Assessment Reports for PM; does not implement changes directly |

### Skill-to-Team Matrix (Extended with Team H)

| Skill | A | B | C | D | E | F | G | **H** |
|-------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-----:|
| `systematic-debugging` | **P** | - | S | S | - | - | - | S |
| `verification-before-completion` | S | S | **P** | - | - | S | - | S |
| `test-driven-development` | S | - | **P** | - | - | - | - | - |
| `writing-plans` | - | - | - | - | **P** | - | - | S |
| `brainstorming` | - | S | - | - | **P** | - | - | S |
| `frontend-design` | - | **P** | - | - | - | - | - | - |
| `requesting-code-review` | S | - | **P** | - | - | **P** | - | - |
| `dispatching-parallel-agents` | - | - | - | - | **P** | - | - | - |
| `/deploy` | - | - | - | **P** | - | - | - | - |
| `/preflight` | - | - | - | **P** | - | - | - | S |
| `/hipaa-review` | - | - | **P** | - | - | - | - | S |
| `/arch-review` | - | - | - | - | - | - | - | **P** |
| `/infra-audit` | - | - | - | S | - | - | - | **P** |
| `/dependency-review` | - | - | - | S | - | - | - | **P** |
| `/scale-assessment` | - | - | - | - | - | - | - | **P** |

**P** = Primary, **S** = Secondary, **-** = Not applicable

---

## Appendix A: Initial Architecture Assessment (Snapshot)

Based on the codebase analysis conducted during this team design, here is the initial assessment that Team H would produce if deployed today:

### Estimated Scores

| Area | Score | Rationale |
|------|-------|-----------|
| **CI/CD Pipeline** | 2/5 | `ignoreBuildErrors` in CI, `continue-on-error` on security scan, missing working directory, deprecated actions |
| **Database Design** | 4/5 | Well-structured schema with 18 models, proper relations, PHI encryption extension. Minor: no slow query monitoring. |
| **Caching** | 3/5 | Redis configured for sessions, rate limiting, retry queues. API cache middleware exists but effectiveness unknown. |
| **Monitoring** | 1/5 | No APM, no error tracking, no uptime monitoring, no alerting beyond deploy Slack. Critical gap for HIPAA. |
| **Module Boundaries** | 2/5 | Three dual implementations (encryption, Stripe, audit). Clean otherwise but duplicates create active risk. |
| **Code Organization** | 3/5 | Reasonable structure but several oversized files and component directories need decomposition. |
| **API Consistency** | 3/5 | Standard pattern documented but no automated enforcement. Unknown deviation rate across 76 routes. |
| **Testing Architecture** | 2/5 | 14 test files for 422 source files. HIPAA-critical paths untested. `npm test` config confusing. |
| **Dependencies** | 4/5 | Modern, maintained stack. No obvious abandoned packages. Bundle optimization configured. |
| **PHI Encryption** | 3/5 | Prisma extension works correctly for 28 fields across 6 models. Three encryption modules creates confusion risk. `PHI_ENCRYPTION_KEY` not validated at startup. |
| **Audit Trail** | 2/5 | Two audit loggers with inconsistent coverage. No automated verification that all PHI access is logged. |
| **Access Control** | 4/5 | 39 permissions, well-structured RBAC. Middleware + per-route auth. Admin bypass is intentional. |
| **Data Retention** | 3/5 | 7-year retention defined in constants. No automated enforcement (no cleanup jobs). |
| **Secrets Management** | 3/5 | 12 undocumented env vars. Hardcoded secrets risk in settings.local.json (flagged in risk register). |

### Overall Architecture Health: 2.8/5 (Concerning -- needs focused improvement)

### Top 5 Priorities

| # | Priority | Item | Effort | Team |
|---|----------|------|--------|------|
| 1 | **P0** | Add `PHI_ENCRYPTION_KEY` to env validation | Small | A |
| 2 | **P1** | Consolidate dual encryption modules | Medium | A |
| 3 | **P1** | Add error tracking (Sentry) | Small | D |
| 4 | **P1** | Remove `ignoreBuildErrors` from CI builds | Medium | D+A |
| 5 | **P1** | Consolidate dual audit loggers | Medium | A |

---

## Appendix B: File References

All paths relative to `/Users/sonuyadav/RimalHealth/premium-telehealth-website/my-app/` unless otherwise noted.

| Category | Key Files |
|----------|-----------|
| **CI/CD** | `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`, `.github/workflows/lighthouse.yml` |
| **Build Config** | `next.config.ts`, `tsconfig.json`, `vitest.config.ts`, `vitest.unit.config.ts`, `vitest.integration.config.ts`, `playwright.config.ts` |
| **Database** | `prisma/schema.prisma`, `lib/db/prisma.ts`, `lib/db/encryption-extension.ts` |
| **Encryption (dual)** | `lib/encryption/phi.ts`, `lib/hipaa/encryption.ts`, `lib/db/encryption.ts`, `lib/db/encryption-middleware.ts` |
| **Stripe (dual)** | `lib/integrations/stripe.ts`, `lib/stripe/stripe-server.ts`, `lib/stripe/stripe-client.ts`, `lib/stripe/stripe-webhooks.ts` |
| **Audit (dual)** | `lib/hipaa/audit-logger.ts`, `lib/audit/logger.ts`, `lib/audit/middleware.ts`, `lib/services/audit-service.ts` |
| **Auth** | `middleware.ts`, `lib/auth/jwt.ts`, `lib/auth/require-auth.ts`, `lib/auth/rbac.ts`, `lib/auth/session.ts`, `lib/auth/account-lockout.ts` |
| **Security** | `lib/security/rate-limit.ts`, `lib/security/csrf.ts`, `lib/security/headers.ts`, `lib/constants.ts` (SECURITY_HEADERS) |
| **Env Validation** | `lib/env-validation.ts`, `.env.example` |
| **Oversized Components** | `app/intake/IntakeClient.tsx` (1,444), `components/physician/PatientDetailView.tsx` (798), `app/profile/setup/page.tsx` (793) |
| **Docker** | `docker/docker-compose.yml`, `docker/Dockerfile` |
| **Redis** | `lib/redis/client.ts`, `lib/redis/cache.ts`, `lib/redis/session.ts` |
| **Reference Docs** | `/Users/sonuyadav/RimalHealth/CLAUDE.md`, `/Users/sonuyadav/RimalHealth/dev-setup/rimalhealth/build_instructions.md`, `/Users/sonuyadav/RimalHealth/dev-setup/rimalhealth/p2_codebase_analysis.md` |

---

*This document should be updated when new architecture concerns are identified, when concerns are resolved, or when the team structure changes.*
