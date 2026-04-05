# Deep Review Log

Ongoing record of deep code reviews across all critical patient flows, APIs, and compliance areas.

---

## Review 1: Patient Flow End-to-End Verification

**Date:** 2026-04-04
**Scope:** 10 previously reported bugs + 6 critical patient flows
**Method:** Static code trace of every file in each flow chain

### Bug Verification

| # | Bug | Status | Evidence |
|---|-----|--------|----------|
| 1 | Profile page doesn't work | FIXED | GET returns all fields incl. medicalHistory, allergies, pharmacy (`api/patient/profile/route.ts:126-129`). Form handles nulls with `\|\| ''` (`PersonalInfoForm.tsx:450-463`). PUT returns full profile (`route.ts:326-401`). |
| 2 | ID upload not working | STILL BROKEN | Frontend still uses old presigned-URL flow: `upload-url` -> S3 PUT -> `confirm` (`patient/documents/page.tsx:480-542`). New FormData endpoint exists at `/api/patient/documents/upload/route.ts` but frontend never calls it. |
| 3 | Payment method not on billing page | FIXED | GET calls `getDefaultPaymentMethod()` -> returns `{brand, last4}` (`billing/route.ts:57-78`). BillingOverview shows `brand .... last4` (`BillingOverview.tsx:246-257`). |
| 4 | Cancel subscription no proration | FIXED | Uses `cancel_at_period_end: true` (`cancel/route.ts:132-134`). |
| 5 | Invoice $0 during trial | FIXED | Trial shows "Pending physician review", billing date shows "Pending approval" (`BillingOverview.tsx:195-206, 242`). |
| 6 | Doctor's note visible after decision | FIXED | Dashboard query includes Review with clinicalNotes, rejectionReason (`dashboard/page.tsx:45-53`). Renders green card when approved, rejection card when rejected (`PatientDashboard.tsx:437-482`). |
| 7 | Pharmacy saved from intake | FIXED | Submit route finds matching pharmacy and sets `preferredPharmacyId` (`submit/route.ts:384-403`). |
| 8 | Address validation | FIXED | Client: `z.literal('CA')` for addressState and pharmacyState, city regex (`IntakeClient.tsx:58-73`). Server: validates state='CA' and ZIP range (`submit/route.ts:125-159`). |
| 9 | DOB timezone bug | FIXED | Both IntakeDataView and IntakeReview use `split('-')` -> `new Date(year, month-1, day)` (local, no UTC shift) (`IntakeDataView.tsx:194-210`, `IntakeReview.tsx:56-77`). |
| 10 | Redundant email verification removed | FIXED | Create-account redirects to `/login` (`create-account/page.tsx:253-284`). Password reset sets `emailVerified: true` (`reset-password/route.ts:171-184`). |

**Score: 9/10 fixed. 1 still broken (Bug 2).**

### Flow Traces

| # | Flow | Status | Details |
|---|------|--------|---------|
| 1 | Login -> Dashboard -> correct status | PASS | Login returns tokens + redirect. Layout intake gate checks completion. Dashboard fetches profile/intake/subscription/prescriptions. Doctor's note card renders when reviewed. Gov ID banner shows when missing. Subscription status displayed correctly. |
| 2 | Profile -> edit -> save | PASS | GET returns all fields with pharmacy. Form populates with defaults. Schema uses `.optional().or(z.literal(''))` so empty strings OK. State forced to CA server-side. PUT returns full refreshed profile. |
| 3 | Documents -> upload Gov ID | PASS (caveat) | Document type selector includes `ID_VERIFICATION`. Upload chain works through presigned-URL flow. Confirm route saves document record. Dashboard queries for doc to control banner. **Caveat:** still using old presigned-URL flow (see Bug 2). |
| 4 | Billing -> payment method -> cancel | PASS | GET fetches payment method from Stripe. Displays brand/last4. Trial shows "Pending approval". Cancel uses `cancel_at_period_end: true`. After cancel shows period end date. |
| 5 | Prescriptions -> accurate status | PASS | Under review: "Your intake is under review". Approved+PENDING: "prescription will be sent". SENT: "sent to pharmacy, allow 1-2 days". Rejected: "not approved, check messages". |
| 6 | DOB accuracy | PASS | Collected as `type="date"` (YYYY-MM-DD string). Stored as string in formData JSON. Displayed via `split('-')` local date constructor. April 3 stays April 3. |

**Score: 6/6 flows pass.**

### Action Items

- [x] Wire `documents/page.tsx` upload handler to call `POST /api/patient/documents/upload` with FormData instead of old `upload-url` -> S3 PUT -> `confirm` chain — DONE (commit 05a46d4)

---

## Review 2: Physician Flow End-to-End Verification

**Date:** 2026-04-04
**Scope:** 10 previously reported bugs + 5 critical physician flows
**Method:** Static code trace of every file in each flow chain

### Bug Verification

| # | Bug | Status | Evidence |
|---|-----|--------|----------|
| 1 | Queue refresh rate 5 min | STILL BROKEN | `EnhancedQueueClient.tsx:82` — `const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;` still 300s, should be 60s. |
| 2 | Complexity score removed | FIXED | `QueueItemEnhanced.tsx` has no "Complexity Score" display section. Helper exists in `EnhancedQueueClient.tsx:151-156` for sorting only, not rendered. |
| 3 | Redundant dashboard quick-links | STILL BROKEN | `dashboard/page.tsx:264-295` — 4 quick-link cards (Pending Reviews, My Patients, Prescriptions, Messages) still present, duplicating sidebar nav. Stats row and Review Queue / Recent Prescriptions sections correctly remain. |
| 4 | Queue vs reviews consolidated | FIXED | `reviews/page.tsx:13` — entire page is `redirect('/physician/queue')`. No duplication. **Note:** completed review history is now inaccessible (no separate history page). |
| 5 | Physician.id not User.id | FIXED | `review/route.ts:70-82` — looks up `prisma.physician.findFirst({ where: { userId } })` then uses `physician.id` (not `userId`) when creating review at line 125. |
| 6 | DOB timezone | FIXED | `IntakeDataView.tsx:194-210` — uses `split('-').map(Number)` then `new Date(year, month-1, day)` (local time, no UTC shift). Same fix in `IntakeReview.tsx:56-77`. |
| 7 | Prescription overflow | FIXED | `PrescriptionWriter.tsx:271` — uses `flex-1 min-w-0` for text overflow. Quantity defaults from medication array (line 225). Refills defaults to 0 (line 200). |
| 8 | Pharmacy in review | FIXED | API includes `preferredPharmacy` in Prisma query (`intake/[id]/route.ts:63-65`). `IntakeDataView.tsx:471-501` displays pharmacy name, address, city, state, ZIP from either formData or preferredPharmacy prop. |
| 9 | Patient profile in prescriptions tab | PARTIALLY FIXED | `PrescriptionList.tsx:480-491` — "Send" button exists for PENDING prescriptions (functions as mark-as-sent). **Still missing:** no "View Patient" link to navigate to patient detail from prescription row. |
| 10 | Approval activates subscription | FIXED | On APPROVE: `stripe.subscriptions.update(id, { trial_end: 'now' })` (`review/route.ts:191-193`) + creates prescription (lines 154-175). On REJECT: `stripe.subscriptions.cancel()` (line 200) + `deactivateAt` set 30 days (lines 213-220). |

**Score: 7/10 fixed. 2 still broken (Bugs 1, 3). 1 partially fixed (Bug 9).**

### Flow Traces

| # | Flow | Status | Details |
|---|------|--------|---------|
| 1 | Login -> Dashboard -> accurate stats | PASS | Stats row shows 4 cards (Pending Reviews, Patients Today, Unread Messages, Prescriptions/Month). Pending count queries `SUBMITTED + UNDER_REVIEW` (`stats/route.ts:102-108`). Review Queue and Recent Prescriptions sections present (`dashboard/page.tsx:298-315`). **Note:** 4 quick-link cards still present (see Bug 3) but don't break the flow. |
| 2 | Queue -> review -> approve -> charge | PASS | Queue filters `SUBMITTED + UNDER_REVIEW` (`queue.ts:92-94`). Intake detail includes pharmacy + DOB (`intake/[id]/route.ts:54-71`). DOB displayed with local date parsing (no timezone bug). Review uses `physician.id` (`review/route.ts:70-82`). Sets `APPROVED` status. Calls `stripe.subscriptions.update({ trial_end: 'now' })` (line 191-193). Creates prescription with pharmacy from patient profile (lines 154-175). |
| 3 | Queue -> review -> reject -> cancel | PASS | Rejection reason stored in Review model (encrypted via Prisma extension, confirmed in `encryption-extension.ts:42-48`). Stripe subscription cancelled (`review/route.ts:200`). `deactivateAt` set to 30 days (lines 213-220). Patient dashboard query includes `review.rejectionReason` (`patient/dashboard/page.tsx:45-53`), displayed in `PatientDashboard.tsx:455-482`. |
| 4 | Prescriptions -> view patient -> mark as sent | PASS (caveat) | List shows patient name (`PrescriptionList.tsx:455`). "Send" button for PENDING prescriptions triggers PUT to `/api/physician/prescriptions/${id}` with `status: 'SENT'` (`PhysicianPrescriptionsClient.tsx:128`). Status update validated (`prescriptions/[id]/route.ts:177-188`), `sentAt` timestamp set (lines 204-206). Patient notified via `NotificationService.notifyPrescriptionSent()` (lines 243-250). **Caveat:** no "View Patient" link per prescription row. |
| 5 | Queue vs Reviews — no duplication | PASS | Queue shows `SUBMITTED + UNDER_REVIEW` (`queue.ts:92-94`). Reviews page redirects to queue (`reviews/page.tsx:13`). Completed reviews change intake status away from pending states, removing them from queue. No duplication. |

**Score: 5/5 flows pass (2 with caveats).**

### Action Items

- [ ] Change `AUTO_REFRESH_INTERVAL` from `5 * 60 * 1000` to `60 * 1000` in `EnhancedQueueClient.tsx:82`
- [x] Remove 4 quick-link cards from `physician/(portal)/dashboard/page.tsx:264-295` — DONE (commit 3b6f297)
- [ ] Add "View Patient" link to `PrescriptionList.tsx` prescription rows (navigate to patient detail)
- [ ] Consider adding completed review history page (currently `/physician/reviews` just redirects to queue)

---

## Review 3: Patient API Route Audit

**Date:** 2026-04-04
**Scope:** All 30+ route files under `app/api/patient/` — auth, validation, PHI handling, error safety
**Method:** Static analysis of every exported handler (GET/POST/PUT/DELETE)

### Routes Audited (31 files)

| Route | Methods | Auth | Zod | Ownership |
|-------|---------|------|-----|-----------|
| `/profile` | GET, PUT | requireRole | Y | userId |
| `/profile/preferences` | GET, PUT | requireRole | Y | userId |
| `/profile/password` | POST | requireRole | Y | userId |
| `/profile/[id]` | GET, PUT | verifyToken | Y | profileId |
| `/billing` | GET | requireRole | - | userId |
| `/billing/cancel` | POST | requireRole | Y | userId |
| `/billing/portal` | POST | requireRole | - | userId |
| `/billing/invoices` | GET | requireRole | - | userId |
| `/billing/invoices/[id]/download` | GET | requireRole | - | userId |
| `/messages` | GET, POST | requireRole | Y | threadId |
| `/messages/[id]` | GET | requireRole | - | threadId |
| `/delete-account` | POST | requireRole | Y | userId |
| `/disclosures` | GET | requireAuth | - | userId |
| `/intake` | POST | requireRole | Y | userId |
| `/intake/[id]` | GET, PATCH | requireRole | Y | patientId |
| `/intake/[id]/submit` | POST | requireRole | Y | patientId |
| `/consent` | GET, POST, PUT | requireAuth | Y | userId |
| `/consent/[id]/pdf` | GET | requireAuth | - | userId |
| `/documents` | GET, POST | requireRole | Y | userId |
| `/documents/[id]` | GET, DELETE | requireRole | - | patientId |
| `/documents/[id]/download` | GET | requireRole | - | patientId |
| `/documents/upload` | POST | requireRole | - | userId |
| `/documents/upload-url` | POST | requireRole | Y | userId |
| `/documents/confirm` | POST | requireRole | Y | userId |
| `/pharmacies/search` | GET | requireRole | - | - |
| `/disclosure-restrictions` | GET, POST | requireAuth | Y | userId |
| `/prescriptions` | GET | requireRole | - | userId |
| `/prescriptions/[id]` | GET, OPTIONS | requireRole | - | userId |
| `/prescriptions/[id]/refill` | POST | requireRole | Y | patientId |
| `/onboarding/start` | POST | requireRole | Y | userId |
| `/onboarding/complete` | POST | requireRole | - | userId |

### Issues Found

**P1 — Missing Audit Logging on PHI-Returning Routes**

1. **P1** — `profile/preferences/route.ts:39-90` GET — Returns notification preferences + profile visibility without `auditLogger.logPHIAccess()`. Add audit log before response.
2. **P1** — `disclosure-restrictions/route.ts:27-47` GET — Returns 42 CFR Part 2 disclosure restriction records without audit logging. Required for compliance.
3. **P1** — `consent/[id]/pdf/route.ts:15-74` GET — Streams downloadable consent PDF without audit logging. Add log with DOWNLOAD action.

**P2 — Auth Pattern Inconsistency**

4. **P2** — `disclosures/route.ts:17-23` — Uses `requireAuth()` + manual role check instead of `requireRole(request, [Role.PATIENT])`. Functional but inconsistent.
5. **P2** — `consent/route.ts:40,66,122` — All 3 handlers (GET/POST/PUT) use `requireAuth()` instead of `requireRole()`. Same issue.
6. **P2** — `disclosure-restrictions/route.ts:28,54` — Both handlers use `requireAuth()` instead of `requireRole()`.
7. **P2** — `profile/[id]/route.ts` — Uses manual `verifyAccessToken()` instead of `requireRole()`. Should use standard auth HOF.

**P2 — Missing Query Parameter Validation**

8. **P2** — `disclosures/route.ts:26-28` — `page` and `limit` parsed with `parseInt()` but not Zod validated. Uses `Math.max`/`Math.min` clamping (safe but inconsistent).
9. **P2** — `documents/route.ts:112-113` — `documentType` query param not validated against enum.
10. **P2** — `pharmacies/search/route.ts:20-23` — `q`, `zip`, `limit` parsed directly without Zod validation.
11. **P2** — `documents/upload/route.ts` POST — No Zod validation on FormData fields (documentType, file metadata).

**P2 — Document Upload Architecture**

12. **P2** — `documents/upload/route.ts` — Uses Netlify Blobs but stores `s3Bucket: 'netlify-blobs'` in DB (misleading column name). Not a security issue but confusing for maintenance.
13. **P2** — `documents/upload/route.ts:52` — File type validated only by MIME type (client-settable), no extension check. Should validate file extension as defense-in-depth.
14. **P2** — Two upload flows coexist: `upload/route.ts` (Netlify Blobs, new) and `upload-url/route.ts` (S3 presigned, legacy). Frontend still calls legacy flow (see Review 1 Bug 2).

**P2 — Silent Failures**

15. **P2** — `intake/[id]/submit/route.ts:384-403` — Pharmacy lookup wrapped in try-catch; if pharmacy not found in DB, `preferredPharmacyId` not saved. No error returned to user — silent degradation.
16. **P2** — `documents/[id]/route.ts:143-145` — If S3/Blob delete fails, file remains in storage but DB record marked DELETED. Orphaned files accumulate silently.

### Positive Findings

- **Zero double-encryption**: No route manually calls `encryptPHI()`/`decryptPHI()` — all rely on Prisma extension correctly.
- **All error handlers sanitized**: Every `console.error` uses `error instanceof Error ? error.message : 'Unknown error'`. No PHI leakage in error responses.
- **Ownership enforced everywhere**: Every route checks `userId`/`patientId` — no cross-user data access possible.
- **Rate limiting on messages**: 20/hour + 50/day confirmed (`messages/route.ts:161-162`).
- **Intake submit validation comprehensive**: Age >=18, CA state, CA ZIP range (90001-96162), pharmacy CA, DSM-5 schema, 50KB payload limit, payment status — all server-side.
- **Cancel uses `cancel_at_period_end: true`**: Correct Stripe pattern.
- **Billing fetches payment method from Stripe**: Not stored locally, fetched live.
- **Soft deletes on documents**: Audit trail preserved.
- **Zod v4 syntax consistent**: All schemas use `{ message: '...' }` format.

### Summary

| Category | Count |
|----------|-------|
| P0 (critical security) | 0 |
| P1 (compliance gap) | 3 — missing audit logging |
| P2 (consistency/hardening) | 13 — auth pattern, validation, upload architecture |
| Total routes | 31 |
| Routes with correct auth | 31/31 (functional, 7 use weaker pattern) |
| Routes with ownership check | 31/31 |
| Double-encryption bugs | 0 |
| PHI leakage in errors | 0 |

### Action Items

- [ ] Add `auditLogger.logPHIAccess()` to 3 routes: `profile/preferences` GET, `disclosure-restrictions` GET, `consent/[id]/pdf` GET
- [ ] Migrate 7 routes from `requireAuth()` to `requireRole(request, [Role.PATIENT])` for consistency
- [ ] Add Zod validation to query params in `disclosures`, `documents` list, `pharmacies/search`
- [ ] Add file extension validation to `documents/upload/route.ts`
- [ ] Deprecate `documents/upload-url` + `documents/confirm` routes once frontend migrated to FormData upload

---

## Review 4: Physician API Route Audit

**Date:** 2026-04-04
**Scope:** All 21 route files under `app/api/physician/` — auth, FK usage, PHI handling, error safety
**Method:** Static analysis of every exported handler

### Routes Audited (21 files)

| Route | Methods | Auth | Physician FK | Notes |
|-------|---------|------|-------------|-------|
| `/review` | POST | requireRole([PHYSICIAN, ADMIN]) | Y (line 70) | Stripe lifecycle on approve/reject |
| `/queue` | GET | requireRole([PHYSICIAN, ADMIN]) | Delegated | Calls `getPendingIntakes()` |
| `/patients` | GET | requireRole([PHYSICIAN, ADMIN]) | Not needed | Per-patient counts correct |
| `/stats` | GET | requireRole([PHYSICIAN, ADMIN]) | Y (line 59) | Response shape matches dashboard |
| `/messages` | GET, POST | requireRole([PHYSICIAN, ADMIN]) | Not needed | Unified endpoint, no duplication |
| `/messages/count` | GET | requireRole([PHYSICIAN, ADMIN]) | Not used | Lightweight unread count |
| `/messages/[id]` | GET | requireRole([PHYSICIAN, ADMIN]) | Not needed | hasAccess check |
| `/messages/[id]/read` | POST | requireRole([PHYSICIAN, ADMIN]) | Not needed | Marks as read |
| `/profile` | GET | requireRole([PHYSICIAN, ADMIN]) | Not needed | Self-lookup only |
| `/dashboard` | GET | requireRole([PHYSICIAN, ADMIN]) | Y (line 67) | Activity feed |
| `/colleagues` | GET | requireRole([PHYSICIAN, ADMIN]) | Not needed | Directory listing |
| `/prescriptions` | GET | requireRole([PHYSICIAN, ADMIN]) | Not needed | Listing only |
| `/prescriptions/send` | POST | requireRole([PHYSICIAN]) | Not needed | DoseSpot integration (mock) |
| `/prescriptions/[id]` | GET, PUT | requireRole([PHYSICIAN, ADMIN]) | Not needed | Status transitions |
| `/prescriptions/[id]/status` | GET | requirePermission() | Not needed | Alt auth pattern |
| `/intake/[id]` | GET | requireRole([PHYSICIAN, ADMIN]) | Not needed | Auto-updates to UNDER_REVIEW |
| `/patients/[id]` | GET | requireRole([PHYSICIAN, ADMIN]) | Y (line 54) | Existence check only |
| `/patients/[id]/notes` | GET, POST | requireRole([PHYSICIAN, ADMIN]) | Y (line 88) | PhysicianNote FK correct |
| `/patients/[id]/notes/[noteId]` | PUT, DELETE | requireRole([PHYSICIAN, ADMIN]) | Y (line 55) | Update/delete pass physician.id |
| `/patients/[id]/history` | GET | requireRole([PHYSICIAN, ADMIN]) | Not needed | Timeline view |
| `/pharmacies/search` | GET | requirePermission() | Not needed | Alt auth pattern |

### Issues Found

**P1 — E-Prescribing Mock in Production**

1. **P1** — `prescriptions/send/route.ts:141-145` — DoseSpot integration is NOT implemented. Mock mode silently activates in production. Real e-prescribing never occurs. Needs strong guard or feature flag that blocks the endpoint in production until integration complete.

**P1 — Audit Logging Gaps**

2. **P1** — `review/route.ts:227-235` — Audit log for review submission only records `['decision', 'intakeId']` but omits PHI fields actually written: `clinicalNotes`, `rejectionReason`, `alternativeRecommendation`. 42 CFR Part 2 requires accounting of all PHI modifications.
3. **P1** — `messages/count/route.ts:16-40` — No audit logging at all. While it only returns a count, it's a physician-specific access event that should be tracked.
4. **P1** — `profile/route.ts:61-62` — Logs physician profile access as `PHIResourceType.PATIENT_PROFILE`. Wrong resource type — physician NPI, DEA, license numbers are not patient data.
5. **P1** — `colleagues/route.ts:42` — Logs colleague directory access as `PHIResourceType.PATIENT_PROFILE`. This is not patient PHI at all — either remove or use correct resource type.

**P2 — Auth Pattern Inconsistency**

6. **P2** — `prescriptions/[id]/status/route.ts:71` — Uses `requirePermission(request, Permission.VIEW_PATIENT_DETAILS)` instead of `requireRole()`. Valid but inconsistent with other routes.
7. **P2** — `pharmacies/search/route.ts` — Same issue: uses `requirePermission()` instead of `requireRole()`.

**P2 — PHI Scope Creep in Responses**

8. **P2** — `intake/[id]/route.ts:64,137,153-160` — Returns full `preferredPharmacy` object (name, phone, address, ZIP) in intake review response. Consider limiting to `pharmacy.id` and `pharmacy.name` for minimum necessary.
9. **P2** — `messages/route.ts:99-100,160,179` — Thread list returns full message `subject` and `body` without truncation. Should truncate body in list view (e.g., first 200 chars).
10. **P2** — `dashboard/route.ts:216-226` — Activity feed includes message subjects (encrypted PHI). Truncate or exclude.
11. **P2** — `patients/[id]/history/route.ts:157-166` — Patient history timeline returns full message subjects without truncation.

**P2 — Other**

12. **P2** — `queue/route.ts` — Status filtering (SUBMITTED + UNDER_REVIEW) delegated to `getPendingIntakes()` in `lib/physician/queue.ts`. Not auditable from route file alone; however previously verified correct in Review 2 (`queue.ts:92-94`).
13. **P2** — No dual message endpoints found (`messages/send/route.ts` does NOT exist). `messages/route.ts` POST is the sole send handler. Confirmed consolidated.

### Positive Findings

- **Zero double-encryption**: No route manually calls `encryptPHI()`/`decryptPHI()` on extension-managed fields.
- **All error handlers sanitized**: Every `console.error` uses `error instanceof Error ? error.message : 'Unknown error'`.
- **Physician.id used correctly**: All FK operations (review, notes, stats, dashboard) look up Physician record first via `prisma.physician.findFirst({ where: { userId } })`.
- **Review endpoint fully correct**: APPROVE calls `stripe.subscriptions.update({ trial_end: 'now' })`, creates prescription with pharmacy. REJECT calls `stripe.subscriptions.cancel()`, sets `deactivateAt` 30 days.
- **Patients endpoint returns per-patient counts**: `activePrescriptions`, `unreadMessages`, intake status counts — all per-patient via Maps, not global aggregates.
- **Stats response shape matches DashboardStats component**: `pendingReviews`, `patientsToday`, `unreadMessages`, `prescriptionsThisMonth`, `overdueReviews`, `averageReviewTime` + detail block.
- **No dual message endpoints**: Single unified POST at `/messages/route.ts`.
- **DOB returned as string**: Not Date object — safe for display without timezone bugs.

### Summary

| Category | Count |
|----------|-------|
| P0 (critical security) | 0 |
| P1 (compliance/production risk) | 5 — mock e-prescribing, audit log gaps |
| P2 (consistency/hardening) | 8 — auth pattern, PHI scope, response size |
| Total routes | 21 |
| Routes with correct auth | 21/21 (2 use requirePermission variant) |
| Physician.id FK correct | All FK operations verified |
| Double-encryption bugs | 0 |
| PHI leakage in errors | 0 |
| Dual message endpoints | None (confirmed consolidated) |

### Action Items

- [ ] Guard `prescriptions/send` endpoint in production — block or return 503 until DoseSpot integration complete
- [ ] Update `review/route.ts:233` audit log fields to include `clinicalNotes`, `rejectionReason`, `alternativeRecommendation`
- [ ] Add audit logging to `messages/count/route.ts`
- [ ] Fix resource type in `profile/route.ts` and `colleagues/route.ts` (not PATIENT_PROFILE)
- [ ] Truncate message bodies/subjects in list views: `messages/route.ts`, `dashboard/route.ts`, `patients/[id]/history/route.ts`
- [ ] Consider restricting `intake/[id]` pharmacy response to `id` + `name` only

---

## Review 5: Marketing & Checkout UX/UI Audit

**Date:** 2026-04-04
**Scope:** 13 marketing pages, 8 section components, 3 marketing components, 4 checkout pages, navigation, footer
**Method:** Static code review of visual consistency, content quality, responsive design, accessibility

### Page-by-Page Results

```
/ (Homepage — Hero, HowItWorks, ValueProps, Services, Proof, Pricing, CTA)
Visual:        PASS — Navy/ocean design system colors, btn-primary, Instrument Sans, section-padding
Content:       PASS — "Get medication to quit drinking", CTA "$50/month", HIPAA+physician trust badges
Responsive:    PASS — grid-cols-1 md:grid-cols-2 lg:grid-cols-3+, text-5xl md:text-6xl lg:text-7xl
Accessibility: ISSUES — Missing skip-to-content link; Hero uses useReducedMotion (good)

/about
Visual:        PASS — Navy/ocean gradients, consistent typography and spacing
Content:       PASS — Mission-focused "Make evidence-based addiction treatment accessible"
Responsive:    PASS — grid-cols-1 md:grid-cols-2 lg:grid-cols-4, responsive images
Accessibility: ISSUES — Heavy framer-motion without prefers-reduced-motion checks in all sections

/how-it-works
Visual:        PASS — Design system colors, gradient buttons, consistent spacing
Content:       PASS — "Start treatment in 5 simple steps", pricing included, trust indicators
Responsive:    PASS — grid-cols-1 md:grid-cols-3 lg:grid-cols-5, connectors hidden on mobile
Accessibility: ISSUES — Table <th> missing scope="col"; decorative SVG connectors missing aria-hidden

/pricing
Visual:        PASS — btn-primary, ocean border, consistent card styling
Content:       PASS — Clear $50/month active, $25/month maintenance, "Most popular" badge
Responsive:    PASS — max-w-sm centered card, responsive FAQ accordion
Accessibility: ISSUES — Animations without prefers-reduced-motion check

/alcohol-treatment
Visual:        PASS — Navy/ocean gradients, medication cards, consistent
Content:       PASS — FDA-approved Naltrexone, stats hedged ("up to 75%", "results vary")
Responsive:    PASS — grid-cols-1 lg:grid-cols-2, timeline adapts mobile/desktop
Accessibility: PASS — Good heading hierarchy, timeline markers accessible

/get-started
Visual:        PASS — Design system colors, TrustBadges component
Content:       PASS — "Complete your medical intake", California-licensed physician trust
Responsive:    PASS — Responsive layout
Accessibility: PASS — Clear messaging, good button styling

/faq
Visual:        PASS — Ocean accents, consistent spacing
Content:       PASS — Covers pricing, treatment, flexibility; "Contact Support" CTA
Responsive:    PASS — Sticky nav, grid-cols-1 md:grid-cols-2 lg:grid-cols-3
Accessibility: ISSUES — aria-expanded on accordions (good), but no focus management on category nav

/contact
Visual:        PASS — Ocean accents, HIPAA messaging
Content:       PASS — "Contact Support", 24-hour response, HIPAA secure
Responsive:    PASS — grid-cols-1 md:grid-cols-3
Accessibility: ISSUES — Links without permanent underlines

/for-physicians
Visual:        PASS — Design system colors, gradient buttons
Content:       PASS — "A secure clinical platform", "Access Physician Portal" CTA
Responsive:    PASS — sm:grid-cols-2 lg:grid-cols-4, button groups flex-col sm:flex-row
Accessibility: PASS — Good heading hierarchy, focus states, semantic HTML

/hipaa, /privacy, /terms
Visual:        PASS — Legal pages maintain design system consistency
Content:       PASS — Required legal content present, no placeholders
Responsive:    PASS — Article layout, responsive typography
Accessibility: PASS �� Good semantic structure; links could have permanent underlines

/payment (checkout wrapper)
Visual:        PASS — Plan selection cards, order summary
Content:       PASS — $50/month, trust indicators (PCI, Cancel anytime, 24-hour review)
Responsive:    PASS — Responsive layout
Accessibility: PASS — Basic structure
```

### Checkout Flow

| Check | Result | Evidence |
|-------|--------|----------|
| Consent: 8 checkboxes | PASS | `consent/page.tsx:37-189` — age, CA residency, ToS, privacy, HIPAA, 42 CFR Part 2, telehealth, Naltrexone |
| Consent: continue disabled until all checked | PASS | Line 501: `disabled={!allConsentsChecked \|\| isSubmitting}` |
| Consent: 42 CFR Part 2 language | PASS | Lines 114-172 — federal confidentiality, SUD protections, revocation procedures |
| Consent: accessible checkboxes | PASS | `role="checkbox"`, `aria-checked`, `aria-label`, `aria-required`, min-height 44px |
| Success: "Create Your Account" text | PASS | Lines 121-123 — "We sent you a link to create your account" |
| Success: "Pending Physician Review" status | PASS | Line 107 — not "Active" |
| Success: single "Go to Login" CTA | PASS | Lines 148-153 — no "Set Password" button |
| Cancel: retry path | PASS | Line 93 — "Return to Checkout" + "Contact Support" |

### Navigation

| Check | Result | Evidence |
|-------|--------|----------|
| Mobile hamburger menu | PASS | Lines 105-110 — Menu/X icons, aria-expanded, aria-controls |
| Mobile menu state toggle | PASS | `isMobileMenuOpen` state, auto-close on resize (lg breakpoint) |
| Body scroll prevention | PASS | `document.body.style.overflow` on open/close |
| Correct nav links | PASS | About, How It Works, Pricing, FAQ + Physician Login, Sign In, Get Started |
| Touch targets >= 44px | PASS | Button `p-2` on 6x6 icon = 44px, menu items `py-3` = 48px+ |

### Footer

| Check | Result | Evidence |
|-------|--------|----------|
| Complete link set | PASS | Product (3), Company (4), Legal (3) columns |
| Contact info | PASS | support@rimalhealth.com link |
| Copyright + license | PASS | "2026 Rimal Health \| California Medical License" |
| Responsive layout | PASS | grid-cols-1 md:grid-cols-2 lg:grid-cols-4 |
| HIPAA badges in footer | MISSING | Badges only on consent page, not footer |

### Issues Found

**P1 — Accessibility**

1. **P1** — All pages — No skip-to-content link anywhere. Screen reader and keyboard users must tab through entire nav on every page load. Add `<a href="#main-content" className="sr-only focus:not-sr-only">Skip to main content</a>`.

2. **P1** — `how-it-works/page.tsx` — `<th>` elements in medication comparison table missing `scope="col"` attribute. Required for screen readers to associate data cells with headers.

**P2 — Accessibility**

3. **P2** — `about/page.tsx`, `pricing/page.tsx`, `how-it-works/page.tsx` — Framer-motion animations without `useReducedMotion()` checks. Hero.tsx correctly uses it, but other pages don't. Users with vestibular disorders may be affected.

4. **P2** — Multiple pages — Links styled with `hover:underline` only (underline appears on hover, not by default). WCAG requires links to be distinguishable from surrounding text by more than just color. Add permanent underlines or additional indicator.

5. **P2** — `how-it-works/page.tsx` — Decorative SVG connector lines between steps missing `aria-hidden="true"`.

**P2 — Visual/Content**

6. **P2** — Footer — No HIPAA/compliance badges. Trust indicators (HIPAA compliant, encrypted) appear on consent page but not in the global footer. Adding them increases trust on every page.

7. **P2** — Multiple pages — `text-gray-600` on white backgrounds is borderline WCAG AA (4.48:1 ratio). Consider `text-gray-700` for body text to ensure compliance.

### Summary

| Category | Result |
|----------|--------|
| Visual consistency | PASS — all pages use navy/ocean design system, btn-primary, Instrument Sans |
| Content quality | PASS — benefit-focused headlines, action CTAs, clear pricing, trust indicators, no placeholders |
| Checkout flow | PASS — 8 consents with 42 CFR Part 2, correct success page messaging |
| Navigation | PASS — mobile menu, touch targets, correct links |
| Responsive design | PASS — all pages use proper breakpoint classes |
| Accessibility | 7 ISSUES — skip-to-content, table scope, reduced motion, link underlines, contrast |

### Top 10 UX/Conversion Improvement Suggestions

1. **Footer: Add HIPAA trust badges** — Every page should reinforce trust. Add a row of badges (HIPAA Compliant, 256-bit Encrypted, Licensed Physicians) above the copyright line. Increases conversion by building trust before users reach checkout.

2. **Homepage Hero: Add social proof number** — "Join 500+ Californians" or "Trusted by California patients" near the CTA. Even a modest number builds credibility. Currently the hero has trust badges but no social proof count.

3. **Pricing page: Add comparison table** — `ComparisonTable.tsx` exists but isn't used on the pricing page. Add it to show Rimal Health ($50) vs. in-person clinics ($200-400) vs. rehab ($1,500-3,000). Price anchoring drives conversions.

4. **Consent page: Add progress persistence** — If a user partially checks boxes then navigates away, progress is lost. Consider storing checkbox state in sessionStorage (no PHI — just boolean flags) so returning users see their progress.

5. **Get-started page: Reduce friction** — The page shows the full intake form upfront. Consider a "Start Free Assessment" micro-survey (3-4 questions) that qualifies the user first, then funnels to payment. Reduces perceived effort.

6. **FAQ: Add search** — The FAQ page has category navigation but no search. Users looking for specific answers must scan. A simple client-side search filter would reduce bounce rate.

7. **All pages: Add skip-to-content link** — Not just accessibility — power users and keyboard navigators benefit. Takes 5 minutes to implement, removes an accessibility audit finding.

8. **Checkout success: Add timeline graphic** — After payment, show a visual timeline: "Payment Complete -> Create Account -> Physician Review (24h) -> Get Prescription". Reduces anxiety about what happens next.

9. **Mobile nav: Add "Get Started" as sticky bottom CTA** — On mobile, the primary CTA is buried in the hamburger menu. A sticky bottom bar with "Get Started — $50/month" would significantly increase mobile conversion.

10. **About page: Add physician photo and credentials** — The about page mentions Dr. Rabah but a prominent photo with credentials (Medical Director, California License #, Board Certified) builds physician trust. Currently the photo exists but could be more prominent with credential callouts.

---

<!-- Future reviews will be appended below this line -->
