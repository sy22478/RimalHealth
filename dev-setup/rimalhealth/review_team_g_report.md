# Team G: Debugging Report -- RimalHealth
## Date: 2026-03-25

## Executive Summary

A comprehensive proactive bug hunt across the RimalHealth codebase revealed **11 confirmed bugs** and **8 risks**. The most critical findings are:

1. **P0: `GET /api/stripe/checkout-session` has NO authentication** -- anyone with a Stripe session ID can retrieve customer email, set-password tokens, and trigger account creation. This is an active security vulnerability.
2. **P0: `POST /api/intake` (public route) emails PHI in plaintext** to the clinical team via a generic email template, including patient name, email, phone, medical conditions, and medications.
3. **P1: `PhysicianMessage` model PHI fields are NOT encrypted** -- the `subject` and `body` fields are marked as encrypted in the Prisma schema comments but are not registered in the encryption extension's `PHI_FIELDS` map.
4. **P1: Webhook handler has NO database transaction** -- user creation, profile creation, and subscription creation are performed as separate queries. If any step fails, the database is left in an inconsistent state.
5. **P1: `PHI_ENCRYPTION_KEY` is never validated at startup** -- `lib/env-validation.ts` only validates `ENCRYPTION_KEY` (used by the dead `lib/hipaa/encryption.ts`), not `PHI_ENCRYPTION_KEY` (used by the actual Prisma encryption extension). If `PHI_ENCRYPTION_KEY` is missing, all PHI writes will throw at runtime.

---

## Bugs Found

### BUG-001: GET /api/stripe/checkout-session Requires No Authentication
- **Severity:** P0
- **Category:** Runtime / Security
- **Root Cause:** `app/api/stripe/checkout-session/route.ts` line 308 -- the `GET` handler has no `getAuthenticatedUser()` call or any other auth check. The `POST` handler on line 119 does authenticate, but the `GET` handler skips auth entirely. Since middleware skips `/api/*` routes (middleware.ts line 59-67, STATIC_ROUTES includes `/api`), there is zero authentication on this endpoint.
- **Impact:** Any actor who knows or guesses a Stripe session ID (`cs_...`) can:
  1. Retrieve the customer's email address (line 494: `customerEmail` in response).
  2. Retrieve a valid `setPasswordToken` (line 497) that allows setting the account password.
  3. Trigger fallback account creation (lines 354-454) if the webhook hasn't fired yet, auto-creating a user and sending a set-password email.
  This effectively allows account takeover or unauthorized account creation.
- **Fix Instructions:**
  1. In `app/api/stripe/checkout-session/route.ts`, the `GET` handler must either:
     - Add authentication (call `getAuthenticatedUser()` and reject if null), OR
     - Remove the `setPasswordToken` from the response and remove the fallback account creation logic (move it entirely to the webhook handler).
  2. The checkout success page (`app/checkout/success/CheckoutSuccessClient.tsx`) already calls this endpoint from the client side -- if auth is added, the page must pass the access token or use the cookie-based flow.
  3. **Recommended approach:** Since checkout/success is a public route (middleware.ts line 52), and the user may not have an account yet, the safest fix is to remove the `setPasswordToken` from the GET response and rely solely on the email-based set-password flow via the webhook.
- **Verification:** `curl https://rimalhealth.com/api/stripe/checkout-session?sessionId=cs_test_any_id` should return 401 or should NOT include `setPasswordToken` in response.
- **Implementing Team:** A (backend security fix)

### BUG-002: Public /api/intake Route Sends PHI via Plaintext Email
- **Severity:** P0
- **Category:** Data Integrity / HIPAA
- **Root Cause:** `app/api/intake/route.ts` lines 38-65 -- this is a public, unauthenticated API route (no `requireAuth` or `requireRole` call found) that:
  1. Accepts PHI directly in the request body (firstName, lastInitial, email, phone, medical conditions, medications).
  2. Sends all of this PHI in a plaintext HTML email to `CONTACT_FORM_TO_EMAIL` via the GENERIC_NOTIFICATION template.
  3. The email subject line includes the patient's name: `New intake: Alcohol -- {firstName} {lastInitial}.` (line 62).
  4. No audit logging of this PHI access.
  5. No encryption of this data at rest (it's not stored in the database, only emailed).
- **Impact:** PHI (patient name, email, phone, medical conditions, medications) is transmitted in email subject lines and body text. Email is not a HIPAA-compliant channel for PHI unless encrypted. This violates HIPAA transmission security requirements. Additionally, this route has no authentication -- anyone can submit data claiming to be any patient.
- **Fix Instructions:**
  1. Determine if this route is still needed (it appears to be a legacy "get started" intake form that predates the payment-first flow). If not needed, delete it.
  2. If needed, add authentication, remove PHI from the email subject line, use a secure notification method instead of raw email, and add audit logging.
  3. At minimum: remove patient name from the email subject, replace PHI in the email body with a link to the admin dashboard where the data can be viewed securely.
- **Verification:** Grep for `firstName` and `lastInitial` in the email subject construction. Confirm they are removed.
- **Implementing Team:** A

### BUG-003: PhysicianMessage Model PHI Fields Not Encrypted
- **Severity:** P1
- **Category:** Data Integrity / HIPAA
- **Root Cause:** `lib/db/encryption-extension.ts` lines 18-59 -- the `PHI_FIELDS` map includes 6 models (PatientProfile, Intake, Review, Prescription, Message, PhysicianNote) but does NOT include `PhysicianMessage`. The Prisma schema (`prisma/schema.prisma` lines 807-809) explicitly marks `PhysicianMessage.subject` and `PhysicianMessage.body` as `// Encrypted`, but they are not registered for automatic encryption.
- **Impact:** All doctor-to-doctor messages are stored as plaintext in the database. These messages may contain patient clinical information (the model even has a `patientId` field for patient-related discussions). This is a HIPAA violation for data at rest.
- **Fix Instructions:**
  1. In `lib/db/encryption-extension.ts`, add to `PHI_FIELDS`:
     ```typescript
     PhysicianMessage: ['subject', 'body'],
     ```
  2. Add to `NULLABLE_FIELDS`:
     ```typescript
     PhysicianMessage: new Set(['subject']),
     ```
  3. Run a data migration to encrypt existing plaintext PhysicianMessage records.
- **Verification:** Create a PhysicianMessage, query the database directly (bypassing Prisma), and confirm `subject`/`body` values start with `enc:v1:`.
- **Implementing Team:** A

### BUG-004: Stripe Webhook Handler Has No Database Transaction
- **Severity:** P1
- **Category:** Data Integrity
- **Root Cause:** `app/api/webhooks/stripe/route.ts` function `handleCheckoutComplete` (lines 145-341) -- creates User (line 177), PatientProfile (line 215), Subscription (line 249), and PasswordReset (line 276) as separate Prisma queries without a `prisma.$transaction()` wrapper.
- **Impact:** If user creation succeeds but PatientProfile creation fails (e.g., unique constraint violation, DB connection drop), the system has an orphaned User record with no profile. Similarly, if subscription creation fails after profile creation, the patient has an account but no subscription. The webhook returns 200 (line 135: `return NextResponse.json({ received: true, error: 'Processing error' })`) to prevent Stripe retries, so the inconsistency is never retried.
- **Fix Instructions:**
  1. Wrap the User creation, PatientProfile creation, and Subscription creation in `prisma.$transaction()`.
  2. If the transaction fails, return a 500 so Stripe retries the webhook.
  3. Alternatively, keep the idempotency checks (which are already present for subscription) and add idempotency checks for user and profile creation.
- **Verification:** Write an integration test that simulates a database failure during profile creation and verify no orphaned records exist.
- **Implementing Team:** A

### BUG-005: PHI_ENCRYPTION_KEY Not Validated at Startup
- **Severity:** P1
- **Category:** Runtime / Configuration
- **Root Cause:** `lib/env-validation.ts` line 13 -- the `REQUIRED_VARS` array contains `ENCRYPTION_KEY` but NOT `PHI_ENCRYPTION_KEY`. The actual encryption system (`lib/encryption/phi.ts` line 33) reads `process.env.PHI_ENCRYPTION_KEY`. The `lib/hipaa/encryption.ts` module that uses `ENCRYPTION_KEY` is dead code (zero imports found via grep).
- **Impact:** If `PHI_ENCRYPTION_KEY` is not set in the environment but `ENCRYPTION_KEY` is, the server starts without error. The first attempt to write or read any PHI field will throw `"PHI_ENCRYPTION_KEY environment variable is required"` at runtime, causing a 500 error for the user. This could happen after a fresh deployment where someone sets `ENCRYPTION_KEY` (as documented in `.env.example`) but not `PHI_ENCRYPTION_KEY`.
- **Fix Instructions:**
  1. In `lib/env-validation.ts`, change `ENCRYPTION_KEY` to `PHI_ENCRYPTION_KEY` in the `REQUIRED_VARS` array, OR add `PHI_ENCRYPTION_KEY` alongside it.
  2. Update `.env.example` to document `PHI_ENCRYPTION_KEY` with the correct format (hex string, 64+ characters).
  3. If `ENCRYPTION_KEY` is truly dead code, remove it from `REQUIRED_VARS` to avoid confusion.
- **Verification:** Start the server without `PHI_ENCRYPTION_KEY` set and confirm it fails at startup with a clear error message (not at runtime).
- **Implementing Team:** A

### BUG-006: Dual Stripe Client -- Old Module Uses Build-Time Placeholder Key
- **Severity:** P2
- **Category:** Integration
- **Root Cause:** `lib/integrations/stripe.ts` lines 45-61 -- `createStripeClient()` creates a Stripe client with `'sk_test_placeholder'` when `STRIPE_SECRET_KEY` is missing (for build-time safety). This client is assigned to `export const stripe = createStripeClient()` (line 61), which is a module-level singleton. If this module is imported and the env var is missing, the placeholder client is used -- and it will fail on the first API call with a Stripe authentication error, but the error message will be confusing ("Invalid API Key provided: sk_test_********der").

  In contrast, `lib/stripe/stripe-server.ts` line 71-73 correctly throws `Error('STRIPE_SECRET_KEY environment variable is not configured')`.

  The billing routes (`api/patient/billing/route.ts`, `api/patient/billing/portal/route.ts`, `api/patient/billing/cancel/route.ts`, `api/patient/billing/invoices/[id]/download/route.ts`) all import from the old module and use the placeholder-capable client.
- **Impact:** If `STRIPE_SECRET_KEY` is not set, billing routes will fail with a cryptic Stripe error instead of a clear configuration error. The checkout route (line 126) lazy-imports the old module and checks `isStripeConfigured()` first, but the billing routes import `stripe` directly and may not always check.
- **Fix Instructions:**
  1. Migrate all billing routes to import from `lib/stripe/stripe-server.ts` instead of `lib/integrations/stripe.ts`.
  2. Or, fix `createStripeClient()` to throw instead of using a placeholder.
  3. Long-term: consolidate to a single Stripe module.
- **Verification:** Remove `STRIPE_SECRET_KEY` from env, hit a billing endpoint, and confirm a clear 503 error.
- **Implementing Team:** A

### BUG-007: `lib/hipaa/audit-logger.ts` Uses In-Memory Storage by Default
- **Severity:** P2
- **Category:** Data Integrity / HIPAA
- **Root Cause:** `lib/hipaa/audit-logger.ts` line 157 -- `let storage: AuditLogStorage = new InMemoryAuditStorage()`. The HIPAA audit logger uses in-memory storage by default (capped at 10,000 events, line 98). It only switches to persistent storage if `initAuditStorage()` is explicitly called. No initialization code was found that calls this function for the HIPAA logger.

  Meanwhile, `lib/audit/logger.ts` (the "new" audit logger) writes directly to the Prisma AuditLog table (line 80). This is the one used by all API routes (67 files import from `@/lib/audit`).
- **Impact:** The `lib/hipaa/audit-logger.ts` module is effectively dead code. However, the Stripe webhook handler (line 324) uses `auditLogger.logPHIAccess()` which comes from `@/lib/audit` (the new logger), so the webhook IS properly logging. The risk is if anyone imports from `lib/hipaa/audit-logger.ts` thinking it persists to the database -- it does not. Zero files currently import it, so this is low-severity dead code.
- **Fix Instructions:**
  1. Mark `lib/hipaa/audit-logger.ts` as deprecated with a clear comment.
  2. Add a `@deprecated` JSDoc tag to all exported functions.
  3. Optionally remove the file entirely and update any references.
- **Verification:** `grep -r "lib/hipaa/audit-logger" --include='*.ts'` should return no import statements.
- **Implementing Team:** B (code cleanup)

### BUG-008: `lib/hipaa/encryption.ts` Is Dead Code With Incompatible Key Format
- **Severity:** P2
- **Category:** Data Integrity
- **Root Cause:** `lib/hipaa/encryption.ts` lines 78-98 -- reads `ENCRYPTION_KEY` as base64, expects exactly 32 bytes. `lib/encryption/phi.ts` lines 33-49 -- reads `PHI_ENCRYPTION_KEY` as hex, expects 64+ characters, derives key via scrypt. These two modules are completely incompatible: data encrypted by one cannot be decrypted by the other. No files import `lib/hipaa/encryption.ts` (confirmed by grep).
- **Impact:** Currently no impact since the HIPAA encryption module is unused. The risk is that a future developer sees `ENCRYPTION_KEY` in env-validation and `.env.example`, sets it, and thinks encryption is working -- when actually `PHI_ENCRYPTION_KEY` is what's needed.
- **Fix Instructions:**
  1. Remove `ENCRYPTION_KEY` from `lib/env-validation.ts` REQUIRED_VARS.
  2. Add `PHI_ENCRYPTION_KEY` to REQUIRED_VARS.
  3. Mark `lib/hipaa/encryption.ts` as deprecated or remove it.
  4. Update `.env.example` to document `PHI_ENCRYPTION_KEY` with the hex format requirement.
- **Verification:** Confirm `PHI_ENCRYPTION_KEY` is validated at startup and `ENCRYPTION_KEY` is no longer required.
- **Implementing Team:** A

### BUG-009: `npm test` Only Runs Integration Tests
- **Severity:** P3
- **Category:** Runtime / Developer Experience
- **Root Cause:** `vitest.config.ts` line 16 -- `include: ['tests/integration/**/*.test.ts']`. The root vitest config only includes integration tests. Running `npm test` (which invokes `vitest run`) skips all unit tests in `tests/unit/` and `lib/**/*.test.ts`. Unit tests require `npm run test:unit` explicitly.
- **Impact:** Developers running `npm test` may believe all tests pass when unit tests are not being run. CI may also only run integration tests if it uses `npm test`.
- **Fix Instructions:**
  1. Rename `vitest.config.ts` to `vitest.integration.config.ts` (or it may already exist as a copy).
  2. Create a new `vitest.config.ts` that includes both unit and integration test patterns.
  3. Or, update the `test` script in `package.json` to run both: `vitest run --config vitest.unit.config.ts && vitest run --config vitest.config.ts`.
- **Verification:** Run `npm test` and confirm both unit and integration tests execute.
- **Implementing Team:** C (testing)

### BUG-010: DoseSpot Prescription Send Always Uses Mock in Production
- **Severity:** P2
- **Category:** Integration
- **Root Cause:** `app/api/physician/prescriptions/send/route.ts` lines 134-147 -- the "real DoseSpot" code path (line 140-147) still returns `{ success: true, mock: true }` with a warning log. The actual `sendPrescription` import from DoseSpot is commented out (line 19). Even when DoseSpot credentials are configured in production, prescriptions are never actually sent to the DoseSpot API.
- **Impact:** Physicians believe prescriptions are being sent to pharmacies, but they are not. Patients receive a "Prescription Sent" notification (line 185) but the prescription never arrives at the pharmacy. The response includes `_mock: true` (line 199) but the UI may not display this.
- **Fix Instructions:**
  1. Uncomment the DoseSpot import on line 19.
  2. In the production path (line 140-147), call the actual DoseSpot `sendPrescription()` function.
  3. Add proper error handling for DoseSpot API failures.
  4. Remove the mock fallback in the production code path.
- **Verification:** Send a prescription in a staging environment with DoseSpot sandbox credentials and verify it appears in the DoseSpot portal.
- **Implementing Team:** A

### BUG-011: Subscription Cancellation Email Not Implemented
- **Severity:** P3
- **Category:** Integration
- **Root Cause:** `app/api/patient/billing/cancel/route.ts` line 193 -- `// TODO: Implement email notification`. The `SUBSCRIPTION_CANCELLED` email template exists and is fully defined in `lib/notifications/templates.ts` (line 577), but the cancel route never calls `sendEmail()` with it.
- **Impact:** Patients who cancel their subscription receive no email confirmation. They see a success message in the UI but have no email record of the cancellation or the end date of their access.
- **Fix Instructions:**
  1. Import `sendEmail` from `lib/integrations/sendgrid` and `EmailTemplate` from `lib/notifications/templates`.
  2. After the successful cancellation (line 196), call:
     ```typescript
     await sendEmail({
       to: user.email,
       template: EmailTemplate.SUBSCRIPTION_CANCELLED,
       data: {
         firstName: profile.firstName || 'there',
         endDate: updatedSubscription.currentPeriodEnd.toLocaleDateString(),
         dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/patient/dashboard`,
       },
     });
     ```
- **Verification:** Cancel a test subscription and confirm the cancellation email is received.
- **Implementing Team:** A

---

## Risks Identified (not bugs yet, but could become bugs)

### RISK-001: Checkout Session GET Fallback Creates Race Condition With Webhook
- **Severity:** Medium
- **Category:** Data Integrity
- **File:** `app/api/stripe/checkout-session/route.ts` lines 354-454
- **Description:** The GET endpoint includes fallback logic that creates a user, profile, subscription, and password reset token if the webhook hasn't fired yet. This creates a race condition: both the webhook handler and the GET endpoint can attempt to create the same user simultaneously, potentially causing unique constraint violations on `User.email`.
- **Mitigation:** The webhook has idempotency checks for subscription (line 196-203) but not for user creation. Add a `try/catch` around user creation in the GET fallback that handles unique constraint violations gracefully, or remove the fallback entirely.

### RISK-002: DoseSpot Mock Mode Can Be Enabled in Production
- **Severity:** Medium
- **Category:** Integration
- **File:** `lib/integrations/dosespot.ts` lines 545-547
- **Description:** The production safety guard for DoseSpot mock mode only logs a `console.warn` -- it does not prevent mock mode from being used. If `DOSESPOT_MOCK_MODE=true` is accidentally set in Netlify production env vars, all prescriptions will silently use mock mode.
- **Mitigation:** Change the guard to throw an error or refuse to initialize in production with mock mode enabled. The prescription send route (line 115-132) does have some production guards, but they only apply when credentials are missing AND mock mode is not explicitly enabled.

### RISK-003: Email Templates May Include PHI in Preview Text
- **Severity:** Medium
- **Category:** HIPAA
- **File:** `lib/notifications/templates.ts`
- **Description:** The `MESSAGE_RECEIVED` template (line 498) includes a `{{preview}}` field in the email body that contains a preview of the doctor's message. If this preview contains PHI (e.g., medical advice, diagnoses), it appears in the email body which may be visible in email notification previews on phones/desktops. The `INTAKE_REJECTED` template (line 359) includes a `reason` field that could contain clinical information.
- **Mitigation:** Limit preview text length and avoid clinical details. Add documentation requiring callers to sanitize preview content before passing it to templates.

### RISK-004: Stripe Checkout Session Accepts Arbitrary URLs
- **Severity:** Medium
- **Category:** Security
- **File:** `app/api/stripe/public-checkout-session/route.ts` lines 16-20
- **Description:** The `successUrl` and `cancelUrl` fields only validate that they are valid URLs (`z.string().url()`), not that they belong to the `rimalhealth.com` domain. An attacker could pass `successUrl: 'https://evil.com/phishing'` to redirect users to a phishing page after payment.
- **Mitigation:** Add URL validation to ensure `successUrl` and `cancelUrl` start with `process.env.NEXT_PUBLIC_APP_URL`.

### RISK-005: Two Audit Logging Systems Create Coverage Confusion
- **Severity:** Low
- **Category:** HIPAA / Code Quality
- **Files:** `lib/hipaa/audit-logger.ts` (724 lines), `lib/audit/logger.ts` (660 lines)
- **Description:** Two separate audit logging systems exist. The `lib/audit/logger.ts` (new) is used by all 67 importing files and writes to the database. The `lib/hipaa/audit-logger.ts` (old) uses in-memory storage and has zero imports. This creates confusion about which system to use and risks future developers using the wrong one.
- **Mitigation:** Delete or clearly deprecate `lib/hipaa/audit-logger.ts`.

### RISK-006: Encryption Salt Is Hardcoded
- **Severity:** Low
- **Category:** Security
- **File:** `lib/encryption/phi.ts` line 53
- **Description:** `scryptSync(key, 'phi_encryption_salt_v1', KEY_LENGTH)` uses a hardcoded salt. While the code comments note this is "acceptable since the input key is already high-entropy," this reduces the benefit of using scrypt for key derivation. If the same `PHI_ENCRYPTION_KEY` is used across environments, the derived key is identical.
- **Mitigation:** Consider deriving the salt from a separate environment variable, or document that `PHI_ENCRYPTION_KEY` must be unique per environment.

### RISK-007: `encryptPHI` Generates Random Salt But Ignores It During Decryption
- **Severity:** Low (cosmetic -- no actual bug)
- **Category:** Code Quality
- **File:** `lib/encryption/phi.ts` lines 87-88
- **Description:** `encryptPHI` generates a random salt on every call (line 88: `const salt = randomBytes(SALT_LENGTH)`) and includes it in the encrypted format (line 107), but `decryptPHI` reads the salt (line 166: `const salt = Buffer.from(saltB64, 'base64')`) but never uses it -- the key derivation always uses the hardcoded salt from `getEncryptionKey()`. The random salt in the encrypted format serves no cryptographic purpose. This is not a bug (the data is still encrypted correctly) but it adds 32 bytes of unnecessary overhead per encrypted field and could confuse future developers into thinking salt-per-record key derivation is happening.
- **Mitigation:** Either remove the random salt from the format (breaking change requiring data migration) or use it in key derivation (would require re-encrypting all data).

### RISK-008: `lib/db/encryption-extension.ts` Silently Swallows Decryption Errors
- **Severity:** Medium
- **Category:** Data Integrity
- **File:** `lib/db/encryption-extension.ts` lines 167-180
- **Description:** Both `decryptField` (lines 175-180 for strings, 166-171 for JSON) catch all decryption errors and return the value as-is. If the encryption key changes or data is corrupted, the application silently returns encrypted ciphertext to the user instead of throwing an error. This means a key rotation mistake would cause garbled data to appear in the UI without any error indication.
- **Mitigation:** At minimum, log a warning when decryption fails. Consider adding a configuration option to throw on decryption failure in production.

---

## Integration Health Status

| Integration | Status | Issues |
|---|---|---|
| **Stripe (Payments)** | Degraded | Two implementations (`lib/integrations/stripe.ts` and `lib/stripe/stripe-server.ts`), 4 billing routes use the old module. API versions are in sync (`2026-01-28.clover`). Old module uses placeholder key at build time. |
| **SendGrid (Email)** | Functional | Subscription cancellation email TODO not implemented (BUG-011). Templates are HIPAA-safe (no PHI in subjects except legacy intake route). |
| **DoseSpot (e-Prescribing)** | Not Functional | All prescription sends use mock mode (BUG-010). Real API integration code is commented out. Production safety guard only warns, doesn't block. |
| **AWS S3 (Documents)** | Not Verified | No bugs found in code review. Not tested end-to-end. |
| **Twilio (SMS)** | Not Verified | No bugs found in code review. Not tested end-to-end. |
| **Redis (Cache/Sessions)** | Functional | Health check handles Redis failure gracefully (degraded mode). |
| **PostgreSQL/Neon (Database)** | Functional | PHI encryption extension works but missing PhysicianMessage coverage. |
| **Prisma Encryption Extension** | Partial Coverage | 6 of 7 PHI-bearing models covered. PhysicianMessage missing. Silent error swallowing on decryption failure. |
| **HIPAA Audit Logging** | Functional (new) / Dead (old) | `lib/audit/logger.ts` is the active system (67 importers). `lib/hipaa/audit-logger.ts` is dead code with in-memory storage. |

---

## Summary of Findings by Severity

| Severity | Count | Bug IDs |
|---|---|---|
| **P0** (Critical) | 2 | BUG-001, BUG-002 |
| **P1** (High) | 3 | BUG-003, BUG-004, BUG-005 |
| **P2** (Medium) | 4 | BUG-006, BUG-007, BUG-008, BUG-010 |
| **P3** (Low) | 2 | BUG-009, BUG-011 |
| **Risks** | 8 | RISK-001 through RISK-008 |

## Recommended Fix Priority

1. **Immediate (BUG-001):** Remove `setPasswordToken` and fallback account creation from the unauthenticated GET endpoint.
2. **Immediate (BUG-002):** Remove PHI from the `/api/intake` email or deprecate/delete the route.
3. **This Sprint (BUG-003):** Add PhysicianMessage to encryption extension and migrate existing data.
4. **This Sprint (BUG-004):** Wrap webhook handler in `$transaction`.
5. **This Sprint (BUG-005):** Fix env-validation to require `PHI_ENCRYPTION_KEY`.
6. **This Sprint (BUG-010):** Implement real DoseSpot integration or clearly mark the feature as unavailable.
7. **Next Sprint:** Clean up dead code (BUG-007, BUG-008), fix Stripe consolidation (BUG-006), implement cancellation email (BUG-011), fix test config (BUG-009).
