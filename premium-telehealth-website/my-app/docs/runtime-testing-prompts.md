# Runtime Testing Prompts — Rimal Health

**Purpose:** Reusable prompts for Claude Code CLI runtime verification. Run after any significant code change.
**Method:** Playwright MCP browser testing (or manual with DevTools open).
**Pre-requisite:** Dev server running at localhost:3000 or deployed to staging.

---

## Prompt 1: Patient Portal Runtime Test

```
You are testing the Rimal Health patient portal at [URL]. Open a browser with DevTools Network tab visible. Set browser timezone to America/Los_Angeles (Pacific).
Test accounts:
- Patient: sonu.yadav@lindsey.edu / RimalHealth2026!
This is a RUNTIME VERIFICATION — you are checking actual rendered output, not source code.
---
### 1. SETUP
Before testing, verify:
- [ ] Browser timezone is Pacific (America/Los_Angeles)
- [ ] DevTools Network tab is open and recording
- [ ] Test at THREE viewport widths: 1024px, 1280px, 1920px (resize between sections)
---
### 2. AUTHENTICATION FLOW
1. Navigate to /login
2. Enter credentials, submit
3. VERIFY: Redirects to /patient/dashboard (not /login, not internal hostname)
4. VERIFY: URL in browser bar is the public domain (not ip-*.ec2.internal)
5. VERIFY: No console errors
---
### 3. DASHBOARD — HAPPY PATH + COPY AUDIT
1. On /patient/dashboard:
   - VERIFY: Welcome greeting matches time of day (morning/afternoon/evening)
   - VERIFY: No "[object Object]" anywhere on the page
   - VERIFY: No "undefined" or "null" rendered as visible text
   - READ all banner/alert text aloud. Flag any:
     * "Required" when referring to MFA (should be "Recommended")
     * Contradictions between status and description
     * References to features that don't exist
2. Check MFA banner:
   - VERIFY: Says "Recommended" not "Required"
   - VERIFY: Links to /patient/mfa-setup
3. Check intake status display:
   - If APPROVED: VERIFY physician's note is visible (full text, not truncated)
   - If REJECTED: VERIFY rejection reason is shown
4. Check prescription card:
   - If no prescription: VERIFY says "No Prescription Yet" (not "No Active Prescription")
   - If has prescription: VERIFY medication name, dosage, refills all populated (not blank)
**NETWORK CHECK:** Open the XHR response for /api/patient/dashboard (or whatever the data endpoint is). Verify:
- No field contains "[object Object]"
- clinicalNotes field is full length (not truncated at 120 chars)
- Date fields are YYYY-MM-DD format (not ISO with time component)
---
### 4. PROFILE PAGE — DATA SHAPE MATRIX
1. Navigate to /patient/profile (or /patient/profile/settings)
2. VERIFY: Page loads without error
3. CHECK medical conditions chips/badges:
   - VERIFY: Each chip shows a readable string (not "[object Object]")
   - VERIFY: If multiple conditions, they're comma-separated or in individual chips
4. CHECK medications display: same verification
5. CHECK allergies display: same verification
6. CHECK personal info:
   - VERIFY: DOB displayed matches what was entered in intake (NOTE THE EXACT DATE)
   - VERIFY: Address shows full city, state, ZIP
   - VERIFY: Phone number is masked appropriately
**DATA SHAPE TEST:** If you can access the API response (/api/patient/profile), verify:
- medicalConditions: should be a string or array of strings (NOT nested objects)
- currentMedications: same
- allergies: same
---
### 5. INTAKE GATE — NEGATIVE PATH
1. If intake is already SUBMITTED/APPROVED:
   - Navigate directly to /intake
   - VERIFY: Redirects to /patient/dashboard (NOT showing the form again)
   - VERIFY: Cannot resubmit a completed intake
2. If intake is DRAFT:
   - VERIFY: Form loads and is editable
---
### 6. BILLING PAGE
1. Navigate to /patient/billing
2. VERIFY: Default payment method shows card brand + last 4 digits
3. CHECK invoices:
   - If intake UNDER_REVIEW: VERIFY shows "Pending" with $50 amount (not $0)
   - If intake APPROVED: VERIFY shows completed charge of $50
   - If intake REJECTED: VERIFY shows canceled/voided
4. CHECK "Cancel Subscription" flow (do NOT actually cancel):
   - VERIFY: Modal says "access continues until [date]" (no proration language)
5. CHECK "Update Payment Method":
   - VERIFY: Opens Stripe Customer Portal (not broken link)
---
### 7. DOCUMENTS / ID UPLOAD
1. Navigate to /patient/documents
2. VERIFY: Page loads without error
3. CHECK date display on any existing documents:
   - VERIFY: All dates use same format (e.g., "Apr 21, 2026")
   - VERIFY: No date is off by one day
4. CHECK upload button:
   - VERIFY: "Upload" button is present and clickable
   - Click it — VERIFY: file picker opens OR upload modal appears (not 500 error)
---
### 8. SIGN OUT
1. Click Sign Out
2. VERIFY: Redirects to /login on the PUBLIC domain
3. VERIFY: URL does NOT contain "ec2.internal" or "172.31" or any private IP
4. VERIFY: Cannot navigate back to /patient/dashboard (should redirect to /login)
---
### 9. VIEWPORT SWEEP
Resize browser to 1024px width and repeat checks on:
- [ ] Dashboard: no horizontal scroll, no text overflow
- [ ] Profile: chips wrap properly, no clipping
- [ ] Billing: cards stack, no overflow
- [ ] Documents: table/cards responsive
---
### 10. SUMMARY REPORT
For each issue found, report:
| Page | Issue | Severity (P0/P1/P2) | Screenshot/Evidence |
Save findings to: premium-telehealth-website/my-app/reviews/runtime-patient-[date].md
```

---

## Prompt 2: Physician Portal Runtime Test

```
You are testing the Rimal Health physician portal at [URL]. Open a browser with DevTools Network tab visible. Set browser timezone to America/Los_Angeles (Pacific).
Test accounts:
- Physician: physician@rimalhealth.com / [password]
This is a RUNTIME VERIFICATION — you are checking actual rendered output, not source code.
---
### 1. SETUP
Before testing, verify:
- [ ] Browser timezone is Pacific (America/Los_Angeles)
- [ ] DevTools Network tab is open and recording
- [ ] Test at THREE viewport widths: 1024px, 1280px, 1920px
---
### 2. AUTHENTICATION FLOW
1. Navigate to /physician/login
2. Enter credentials, submit
3. VERIFY: Redirects to /physician/dashboard
4. VERIFY: No internal hostname in URL bar
5. VERIFY: No console errors
---
### 3. DASHBOARD
1. VERIFY: DashboardStats cards show (pending reviews, patients today, etc.)
2. VERIFY: Quick Links section present (links to Queue and Prescriptions)
3. VERIFY: NO redundant "Review Queue" widget or "Recent Prescriptions" widget
4. VERIFY: Sidebar tabs: Dashboard, Patient Queue, Review History, Patients, Prescriptions, Messages, Settings
---
### 4. PATIENT QUEUE
1. Navigate to /physician/queue
2. VERIFY: Header says "Auto-refreshes every 5 minutes"
3. CHECK sort dropdown:
   - VERIFY: Options are PRIORITY and WAIT_TIME only (no COMPLEXITY)
4. CHECK queue cards:
   - VERIFY: Each card shows: Priority badge, Wait Time, Patient Info, Concern Type, Risk score
   - VERIFY: NO complexity score displayed on cards
5. If queue has items:
   - Click a patient to open their intake review
---
### 5. INTAKE REVIEW — CROSS-ROLE DATA CHECK
1. Open an intake for review
2. CHECK patient data displayed:
   - VERIFY: DOB matches what patient entered (compare with patient portal if possible)
   - NOTE the exact DOB shown — write it down
3. CHECK pharmacy section:
   - VERIFY: Pharmacy name, address, city, state, ZIP all visible
   - VERIFY: Phone number shown
4. CHECK the Decision sidebar (right panel):
   - Resize to 1024px width
   - VERIFY: No text overflows the container
   - Select "Approve" as decision
   - VERIFY: Medication selector appears
   - VERIFY: Medication name text wraps (does not overflow)
   - VERIFY: Quantity and Refills fields are populated with defaults (30 and 5)
   - VERIFY: Warnings text wraps within container
   - Resize to 1280px — same checks
5. CHECK clinical notes field:
   - VERIFY: Text area present, required (min 10 chars)
   - Enter a long note (200+ characters) for later verification
---
### 6. REVIEW HISTORY — NOTE VISIBILITY
1. Navigate to /physician/reviews
2. Find a previously reviewed intake
3. CHECK clinical notes column:
   - VERIFY: Notes WRAP (not truncated with `...`)
   - VERIFY: Full note text is visible (or expandable)
4. Click on a reviewed intake to see detail:
   - VERIFY: Full clinical notes displayed (not truncated at 120 chars)
   - VERIFY: Decision (APPROVED/REJECTED/NEEDS_INFO) shown
   - VERIFY: Rejection reason shown (if rejected)
   - VERIFY: Alternative recommendation shown (if present)
   - VERIFY: Reviewer name and timestamp shown
---
### 7. PRESCRIPTIONS TAB
1. Navigate to /physician/prescriptions
2. CHECK each prescription row:
   - VERIFY: "View Profile" link present and working (opens patient profile)
   - If status is PENDING:
     - VERIFY: "Send" button present
     - VERIFY: Pharmacy name shown on the row
3. Click "Send" on a PENDING prescription (if safe to test):
   - VERIFY: Confirmation dialog appears
   - VERIFY: After confirm, status changes to SENT
   - VERIFY: Toast notification shows success
---
### 8. SIGN OUT
1. Click Sign Out
2. VERIFY: Redirects to /physician/login on PUBLIC domain
3. VERIFY: No internal hostname leak
---
### 9. VIEWPORT SWEEP (1024px)
At 1024px width, verify:
- [ ] Dashboard: no overflow
- [ ] Queue cards: readable, no clipping
- [ ] Intake review: decision sidebar usable (not collapsed to nothing)
- [ ] Prescriptions table: columns don't overlap
---
### 10. SUMMARY REPORT
| Page | Issue | Severity | Evidence |
Save findings to: premium-telehealth-website/my-app/reviews/runtime-physician-[date].md
```

---

## Prompt 3: Cross-Portal Data Integrity Test

```
You are testing DATA CONSISTENCY between the Patient and Physician portals at [URL]. This test verifies that data written in one role is correctly visible in the other.
Test accounts:
- Patient: sonu.yadav@lindsey.edu / RimalHealth2026!
- Physician: physician@rimalhealth.com / [password]
Set browser timezone to America/Los_Angeles (Pacific).
---
### 1. DOB ROUND-TRIP VERIFICATION
**As Patient:**
1. Log in as patient
2. Navigate to profile or intake
3. NOTE the exact DOB displayed (e.g., "April 3, 1999")
4. Log out
**As Physician:**
1. Log in as physician
2. Find the same patient in queue or patients list
3. Open their intake/profile
4. NOTE the exact DOB displayed
**COMPARE:** Do they match exactly? If one shows April 2 and the other April 3, the timezone bug is still present.
---
### 2. PHARMACY ADDRESS ROUND-TRIP
**As Patient:**
1. Log in as patient
2. Navigate to profile → check pharmacy section
3. NOTE: pharmacy name, address, city, state, ZIP (exact spelling + case)
4. Log out
**As Physician:**
1. Log in as physician
2. Open the same patient's intake review
3. NOTE: pharmacy name, address, city, state, ZIP
**COMPARE:**
- Exact same pharmacy name? (case-sensitive check: "CVS Pharmacy" vs "cvs pharmacy")
- Same address, city, state, ZIP?
- If patient pharmacy shows but physician pharmacy is blank → FK match failed
---
### 3. CLINICAL NOTE ROUND-TRIP
**As Physician:**
1. Log in as physician
2. Find a patient whose intake is SUBMITTED or UNDER_REVIEW
3. Review the intake → set decision → write a LONG clinical note (200+ chars)
4. Include a distinctive phrase: "VERIFICATION-TOKEN-XYZ123"
5. Submit the decision
6. Navigate to Review History
7. Find the review you just submitted
8. VERIFY: "VERIFICATION-TOKEN-XYZ123" is visible in full (not truncated)
9. Log out
**As Patient:**
1. Log in as the patient whose intake was just reviewed
2. Go to dashboard
3. VERIFY: Clinical note / rejection reason visible
4. VERIFY: "VERIFICATION-TOKEN-XYZ123" appears in the note (full, not cut off)
---
### 4. INTAKE DECISION NOTIFICATION
After physician approves/rejects (from step 3):
1. As patient, check dashboard
2. VERIFY: A banner/card shows the decision (APPROVED or REJECTED)
3. VERIFY: If REJECTED, rejection reason is shown
4. VERIFY: If APPROVED, clinical notes are shown
5. VERIFY: Alternative recommendation shown if physician provided one
---
### 5. PRESCRIPTION FLOW (end-to-end)
**As Physician:**
1. After approving an intake, check Prescriptions tab
2. VERIFY: Patient appears with status PENDING
3. VERIFY: Patient's pharmacy name is shown on the prescription row
4. Click "Send" → confirm
5. VERIFY: Status changes to SENT
6. Log out
**As Patient:**
1. Log in
2. VERIFY: Prescription card on dashboard shows medication details
3. VERIFY: Status indicates prescription has been sent
4. Check for notification (email or in-app) about prescription sent to pharmacy
---
### 6. DATE CONSISTENCY AUDIT
For ALL date displays, verify consistency:
1. As patient: note dates on dashboard, documents, billing, profile
2. As physician: note dates for same patient
3. ALL dates should be in the same format AND same timezone
Specific checks:
- [ ] Intake submission date: same in patient dashboard + physician queue
- [ ] DOB: same in patient profile + physician review
- [ ] Prescription date: same in both portals
- [ ] Document upload date: consistent format
---
### 7. EDGE CASE INPUTS (if a fresh intake is available)
If testing with a new intake submission:
1. Enter DOB as: **March 1, 2000** (beginning of month — most likely to shift back to Feb 29)
2. Enter pharmacy name in **lowercase**: "walgreens"
3. Enter ZIP as **ZIP+4**: "90210-1234"
4. Enter a long medical condition (200+ chars)
Then verify as physician:
- DOB shows March 1, 2000 (not Feb 29)
- Pharmacy appears (case-insensitive match worked)
- ZIP displays correctly (with +4)
- Medical condition is fully visible (not truncated)
---
### 8. SUMMARY REPORT
| Test | Expected | Actual | Pass/Fail |
Save findings to: premium-telehealth-website/my-app/reviews/runtime-cross-portal-[date].md
```

---

## Prompt 4: Post-Deploy Smoke Test (quick — run after every push to main)

```
Quick smoke test after deploy. Run at [URL]. Takes <5 minutes.
1. **Patient login** → /login → verify dashboard loads, no console errors
2. **Sign out** → verify redirect to /login on public domain (no internal hostname)
3. **Physician login** → /physician/login → verify dashboard loads
4. **Queue** → verify "Auto-refreshes every 5 minutes" text, no COMPLEXITY sort
5. **Sign out** → verify redirect to /physician/login on public domain
6. **Viewport** → resize to 1024px, verify no horizontal scrollbar on either dashboard
7. **Network** → check one API response (patient dashboard), verify no [object Object] in response body
Report: PASS or list of failures.
Save to: premium-telehealth-website/my-app/reviews/smoke-[date].md
```

---

## When to Use Which Prompt

| Scenario | Prompt(s) to run |
|----------|-----------------|
| Push to main (any change) | Prompt 4 (smoke) |
| Patient portal code change | Prompt 1 + Prompt 3 |
| Physician portal code change | Prompt 2 + Prompt 3 |
| Shared code change (API, middleware, schema) | Prompts 1 + 2 + 3 |
| Pre-launch / milestone review | All four |

Once your CLI has both files, commit with: `docs: add runtime testing gap analysis and reusable test prompts` and push to main.
