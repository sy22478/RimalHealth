# 42 CFR Part 2 Compliance Gap Analysis & Implementation Plan

**RimalHealth -- Substance Use Disorder Record Protections**
**Prepared:** March 25, 2026
**Compliance Deadline:** February 16, 2026 (ALREADY PAST -- enforcement active)
**Regulation:** 42 CFR Part 2, as amended by the 2024 Final Rule (89 FR 12472, effective April 16, 2024)
**Applicability:** RimalHealth provides medication-assisted treatment for Alcohol Use Disorder (AUD) with Naltrexone -- this is substance use disorder treatment and all patient records are Part 2 records.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Regulatory Background](#2-regulatory-background)
3. [Compliance Gap Analysis](#3-compliance-gap-analysis)
4. [Consent Page Updates (Exact Language)](#4-consent-page-updates)
5. [Privacy Page Updates (Exact Language)](#5-privacy-page-updates)
6. [Phased Implementation Plan](#6-phased-implementation-plan)
7. [Sources & Citations](#7-sources--citations)

---

## 1. Executive Summary

RimalHealth treats Alcohol Use Disorder (AUD), which is a federally recognized substance use disorder. This means **all patient records** created or maintained by RimalHealth are subject to 42 CFR Part 2, in addition to HIPAA. The 2024 Final Rule (published February 8, 2024) substantially amended Part 2 to align with HIPAA while retaining extra protections for SUD records. The compliance deadline was **February 16, 2026**. HHS Office for Civil Rights (OCR) began accepting complaints on that date.

**Current risk level: HIGH.** RimalHealth has basic HIPAA compliance infrastructure (encryption, audit logging, privacy notices) but lacks several Part 2-specific requirements. The platform does not currently obtain the specific written consent required by 42 CFR 2.31, does not include redisclosure notices with disclosures, and the privacy notices do not adequately describe Part 2 protections.

### Key Gaps Identified

| # | Gap | Severity | Current State |
|---|-----|----------|---------------|
| 1 | Part 2-compliant written consent | CRITICAL | Consent page has general HIPAA/telehealth consent but lacks 42 CFR 2.31 required elements |
| 2 | Redisclosure notice on disclosures | CRITICAL | Not implemented -- physician portal shows patient SUD data without any redisclosure warning |
| 3 | Privacy notice / NPP updates | HIGH | HIPAA NPP mentions Part 2 briefly but does not meet 42 CFR 2.22 patient notice requirements |
| 4 | Accounting of disclosures | HIGH | Audit logger tracks access but lacks patient-facing accounting of disclosures feature |
| 5 | Patient right to request restrictions | MEDIUM | HIPAA NPP mentions the right but no mechanism exists to submit or enforce restriction requests |
| 6 | BAA/QSOA status with vendors | HIGH | No documented verification that vendor agreements cover Part 2 records |
| 7 | Breach notification for Part 2 records | MEDIUM | HIPAA breach processes exist conceptually but Part 2 breach definition is broader |

---

## 2. Regulatory Background

### What is 42 CFR Part 2?

42 CFR Part 2 is a federal regulation that protects the confidentiality of substance use disorder (SUD) patient records. Originally enacted in the 1970s, it provides protections **above and beyond HIPAA** for records created by programs that specialize in SUD treatment. The core principle: SUD records cannot be disclosed without specific patient consent, and they cannot be used against patients in legal proceedings.

### The 2024 Final Rule (CARES Act Section 3221)

The Substance Abuse and Mental Health Services Administration (SAMHSA) and HHS published a final rule on February 8, 2024 (89 FR 12472) that made significant changes:

1. **Single consent for TPO** -- Patients can now provide a single written consent for all future uses and disclosures for treatment, payment, and health care operations (TPO), rather than requiring separate consent for each disclosure. (42 CFR 2.31)

2. **HIPAA alignment** -- Part 2 consent requirements were aligned with HIPAA authorization requirements, and HIPAA covered entities and business associates that receive Part 2 records under TPO consent may redisclose in accordance with HIPAA regulations. (42 CFR 2.31, 2.33)

3. **Breach notification** -- The HIPAA Breach Notification Rule now applies to Part 2 records. Part 2 programs must report breaches of Part 2 records using the same timeline and process as HIPAA breaches. (42 CFR 2.16)

4. **Civil enforcement** -- OCR now has authority to investigate and impose civil monetary penalties for Part 2 violations, using the same enforcement framework as HIPAA. State attorneys general also gained enforcement authority. (42 CFR 2.4)

5. **Patient rights** -- Two new patient rights were added, mirroring HIPAA: the right to an accounting of disclosures (for up to 3 years prior) and the right to request restrictions on disclosures. (42 CFR 2.24, 2.26)

6. **Legal proceedings protection retained** -- SUD records still cannot be used in civil, criminal, administrative, or legislative proceedings against the patient without specific consent or court order. (42 CFR 2.12)

7. **SUD counseling notes** -- New category analogous to psychotherapy notes; requires separate consent and cannot be disclosed under broad TPO consent. (42 CFR 2.31(b))

### Why RimalHealth is Subject to Part 2

RimalHealth meets the definition of a "Part 2 program" under 42 CFR 2.11 because it:
- Is a program or activity that provides substance use disorder diagnosis, treatment, or referral for treatment (AUD treatment with Naltrexone)
- Holds itself out as providing SUD treatment (the website and marketing materials describe AUD treatment as the primary service)
- Receives patient records that are created in connection with SUD treatment

**All records** maintained by RimalHealth are Part 2 records because the program's primary purpose is SUD treatment. This includes intake forms, medical histories, prescriptions, messages, physician notes, and even billing records to the extent they identify a patient as receiving SUD treatment.

---

## 3. Compliance Gap Analysis

### 3.1 Consent Requirements (42 CFR 2.31) -- CRITICAL GAP

**Regulatory requirement:** Before disclosing Part 2 records for TPO, a Part 2 program must obtain written consent that includes specific elements defined in 42 CFR 2.31(a).

**Required elements for Part 2 written consent (42 CFR 2.31(a)):**

1. The name or general designation of the Part 2 program making the disclosure
2. The name or other specific identification of the person(s), or class of persons, authorized to make the requested use or disclosure
3. The name(s) of the person(s), or class of persons, to which a disclosure is to be made (recipients)
4. A description of the Part 2 records to be disclosed, in a specific and meaningful fashion
5. A description of each purpose of the requested use or disclosure (for TPO consent: "for treatment, payment, and health care operations" is sufficient)
6. A statement of the patient's right to revoke the consent in writing, and how to do so, except to the extent the program has already acted in reliance on it
7. An expiration date or expiration event related to the patient or the purpose of the disclosure
8. The signature of the patient (or authorized representative) and the date
9. For TPO consent specifically:
   - A statement that records disclosed pursuant to the consent may be subject to redisclosure by the recipient and no longer protected by Part 2
   - A statement about the consequences to the patient of refusing to sign the consent

**Current state in RimalHealth:**

The consent page at `app/checkout/consent/page.tsx` has 7 consent items:
- Age confirmation (18+)
- California residency
- Terms of Service agreement
- Privacy Policy agreement
- HIPAA Notice of Privacy Practices agreement
- Telehealth consent (general)
- Informed consent (Naltrexone treatment)

**Gaps:**
- **No Part 2-specific consent item.** None of the 7 items specifically address consent to use and disclose SUD records for TPO purposes as required by 42 CFR 2.31.
- **No identification of recipients.** The consent does not identify who will receive the records (treating physicians, pharmacy, payment processors).
- **No description of records to be disclosed.** The consent does not describe what specific information will be shared.
- **No right-to-revoke statement.** The consent does not inform patients of their right to revoke consent or how to do so.
- **No expiration date/event.** The consent has no stated duration.
- **No redisclosure warning.** Required for TPO consent under 42 CFR 2.31(a)(4)(iii)(A).
- **No consequences-of-refusal statement.** Required for TPO consent under 42 CFR 2.31(a)(4)(iii)(B).
- **Consent is not separately trackable.** The API (`/api/checkout/consent`) records all 7 consents as a single audit log entry, with no distinct Part 2 consent record.

### 3.2 Accounting of Disclosures (42 CFR 2.24) -- HIGH GAP

**Regulatory requirement:** Patients have the right to receive an accounting of disclosures of their Part 2 records made with written consent for up to **three years** prior to the date the accounting is requested. This is broader than HIPAA's standard accounting requirement (which excludes TPO disclosures for most covered entities).

**What the accounting must include (per HIPAA alignment at 45 CFR 164.528):**
- Date of each disclosure
- Name of the entity or person who received the records, and address if known
- A brief description of the records disclosed
- A brief statement of the purpose of the disclosure, or a copy of the request

**Current state in RimalHealth:**

The audit logger (`lib/audit/logger.ts`) tracks:
- WHO accessed records (userId, userRole)
- WHAT was accessed (resourceType, resourceId)
- WHEN (timestamp)
- WHERE (ipAddress, userAgent)
- WHY (eventType, metadata)

The audit logger also has `queryLogs()` and `exportAuditLogs()` methods for retrieving audit data.

**Gaps:**
- **No patient-facing disclosure accounting endpoint.** There is no API route that allows a patient to request an accounting of disclosures of their records. The existing `queryLogs()` is admin-only.
- **No tracking of external disclosures.** The audit log tracks internal access (physician viewing records) but does not specifically track disclosures to external parties (pharmacy via DoseSpot, payment processors).
- **No distinction between "access" and "disclosure."** The audit log tracks all PHI access events identically. Part 2 requires tracking disclosures specifically -- instances where records were shared outside the program.
- **3-year lookback window.** The audit log retains data for 6+ years (HIPAA requirement), which satisfies the Part 2 3-year lookback. However, the data is not structured for patient-facing accounting reports.
- **No "purpose of disclosure" field.** The audit log metadata could contain this, but it is not standardized.

### 3.3 Privacy Notices (42 CFR 2.22) -- HIGH GAP

**Regulatory requirement:** Part 2 programs must provide a "Part 2 Patient Notice" that can be combined with the HIPAA Notice of Privacy Practices (NPP), provided it includes all required information under both 45 CFR 164.520 (HIPAA NPP) and 42 CFR 2.22 (Part 2 Patient Notice).

**Part 2 Patient Notice must inform patients that:**
- The program creates, receives, or maintains SUD records protected by 42 CFR Part 2
- Part 2 records generally cannot be used or disclosed without specific written patient consent
- Part 2 records cannot be used in legal proceedings against the patient without consent or court order
- How Part 2 records may be used and disclosed (including TPO with consent)
- The patient's right to an accounting of disclosures
- The patient's right to request restrictions on disclosures
- How to file a complaint with OCR

**Current state in RimalHealth:**

The HIPAA NPP page (`app/(marketing)/hipaa/page.tsx`) has:
- A brief mention of 42 CFR Part 2 in the "Uses and Disclosures Requiring Authorization" section (line 101: "Substance use disorder treatment records (42 CFR Part 2)")
- A short "Special Protections for Substance Use Disorder Records" section (lines 110-118) that states records are "subject to additional federal protections under 42 CFR Part 2, which generally prohibits disclosure without your specific written consent except in limited circumstances."

The Privacy Policy page (`app/(marketing)/privacy/page.tsx`) references HIPAA but has **no mention of 42 CFR Part 2**.

**Gaps:**
- **HIPAA NPP is insufficient.** The current mention of Part 2 is brief and does not meet all requirements of 42 CFR 2.22. Missing: specific statement about legal proceedings protection, description of how Part 2 records are used/disclosed differently from other PHI, patient's right to accounting of disclosures of Part 2 records specifically, patient's right to request restrictions on Part 2 disclosures.
- **Privacy Policy page has no Part 2 mention.** The general privacy policy (`/privacy`) does not mention Part 2 at all. While the NPP is the primary legal document, the privacy policy should at minimum reference Part 2 protections since patients see it during the consent flow.
- **No combined NPP + Part 2 notice.** HHS permits combining these documents, but the current NPP does not contain all required Part 2 notice elements.
- **Accounting of disclosures right is HIPAA-limited.** The NPP states patients can request "a list of disclosures of your PHI made in the past six years for purposes other than treatment, payment, or operations." Under Part 2, the accounting right covers disclosures made **with consent** (including for TPO) for up to **three years**. The current language is HIPAA-only and incorrect for Part 2 records.

### 3.4 Redisclosure Notice (42 CFR 2.32) -- CRITICAL GAP

**Regulatory requirement:** Each disclosure of Part 2 records made with written consent must be accompanied by one of the following written statements:

**Option A (full notice):**
> "This record which has been disclosed to you is protected by federal confidentiality rules (42 CFR part 2). The federal rules prohibit you from making any further disclosure of information in this record that identifies a patient as having or having had a substance use disorder either directly, by reference to publicly available information, or through verification of such identification by another person unless further disclosure is expressly permitted by the written consent of the individual whose information is being disclosed or as otherwise permitted by 42 CFR part 2. A general authorization for the release of medical or other information is NOT sufficient for this purpose (see 42 CFR 2.31). The federal rules restrict any use of the information to investigate or prosecute with regard to a crime any patient with a substance use disorder, except as provided at 42 CFR 2.12(c)(5) and 2.65."

**Option B (abbreviated notice):**
> "42 CFR part 2 prohibits unauthorized use or disclosure of these records."

Additionally, each consent-based disclosure must include either a copy of the patient's consent or a clear explanation of the scope of the consent.

**Current state in RimalHealth:**

- **Physician portal** (`app/physician/(portal)/`) displays patient intake data, prescriptions, messages, and medical history to physicians with **no redisclosure notice**.
- **DoseSpot integration** (`lib/integrations/dosespot.ts`) sends prescription data to pharmacies with **no Part 2 redisclosure notice** attached.
- **SendGrid emails** (`lib/integrations/sendgrid.ts`) send notifications that may reference SUD treatment with **no redisclosure notice**.
- **The checkout/consent API** records consent but does not generate a consent document that can accompany disclosures.

**Gaps:**
- **No redisclosure notice in physician portal.** When a physician views patient SUD records, there should be a visible notice that the records are Part 2 protected and cannot be redisclosed without consent.
- **No redisclosure notice in external disclosures.** Prescriptions sent via DoseSpot, communications via SendGrid -- any transmission of Part 2 records to external parties must include the redisclosure notice.
- **No consent copy accompanies disclosures.** 42 CFR 2.32 requires that each disclosure include either a copy of the consent or a clear explanation of scope.

### 3.5 Patient Right to Request Restrictions (42 CFR 2.26) -- MEDIUM GAP

**Regulatory requirement:** Patients have the right to request restrictions on uses and disclosures of their Part 2 records, similar to HIPAA's right under 45 CFR 164.522. The Part 2 program is not required to agree to all restrictions, but must have a process for receiving and responding to requests.

**Current state in RimalHealth:**

The HIPAA NPP page states: "You may request restrictions on how we use or disclose your PHI. We are not required to agree, but will notify you of our decision."

**Gaps:**
- **No mechanism to submit restriction requests.** There is no form, API endpoint, or documented process for patients to submit restriction requests through the platform.
- **No tracking of restriction requests.** There is no database model or audit trail for restriction requests and their outcomes.
- **No enforcement mechanism.** Even if a restriction were agreed to, there is no system-level enforcement to prevent disclosures that violate an agreed restriction.

### 3.6 Business Associate / Qualified Service Organization Agreements -- HIGH GAP

**Regulatory requirement:** Under the amended Part 2, HIPAA BAA requirements apply to Part 2 records. However, for entities that are not HIPAA covered entities but receive Part 2 records, a Qualified Service Organization Agreement (QSOA) may be required. For entities that are both HIPAA covered entities and Part 2 programs (like RimalHealth), a combined BAA that addresses Part 2 obligations is recommended.

**Key Part 2-specific BAA/QSOA requirements beyond standard HIPAA BAA:**
- Must include obligation to resist in judicial proceedings any efforts to obtain Part 2 records unless expressly permitted
- Must include prohibition on using records to investigate or prosecute patients
- Must limit disclosure to information necessary for the permitted purpose (more restrictive than HIPAA minimum necessary)

**Current state in RimalHealth:**

Per the research findings in `research_improvements.md`:

| Vendor | BAA Status | Part 2 Coverage |
|--------|-----------|-----------------|
| Neon (PostgreSQL) | BAA available, status unconfirmed | Unknown -- standard BAA may not address Part 2 |
| Netlify | Enterprise only, status unconfirmed | Unknown |
| SendGrid | Enterprise only, HIGH RISK | Unknown |
| AWS S3 | BAA available | Unknown |
| Redis provider | Depends on hosting | Unknown |
| DoseSpot | Unknown | Unknown -- this is the highest risk since prescription data directly identifies patients as having SUD |
| Stripe | Available | Unknown |

**Gaps:**
- **No confirmed signed BAAs with any vendor.** The research report flags this as "Action needed" for all vendors.
- **No Part 2-specific language in vendor agreements.** Even if standard HIPAA BAAs are signed, they may not include Part 2 obligations (judicial proceedings resistance, prosecution prohibition, enhanced minimum necessary).
- **DoseSpot is highest risk.** DoseSpot receives prescription data that directly identifies patients as having AUD/SUD. If DoseSpot's agreement does not address Part 2, this is a significant compliance exposure.

### 3.7 Breach Notification (42 CFR 2.16) -- MEDIUM GAP

**Regulatory requirement:** The 2024 Final Rule applies the HIPAA Breach Notification Rule (45 CFR 164.400-414) to Part 2 records. The Part 2 breach definition is **broader** than HIPAA's: it includes any use or disclosure that violates Part 2, even if it would not violate HIPAA.

**Example:** A physician at RimalHealth shares a patient's SUD treatment information with another provider outside of RimalHealth without the patient's Part 2 consent. Under HIPAA alone, this might be permissible as a TPO disclosure. Under Part 2, if the patient did not consent to that specific disclosure or class of disclosures, it is a breach.

**Breach notification requirements (aligned with HIPAA):**
- Individual notification within 60 days of discovery
- HHS Secretary notification (within 60 days for 500+ individuals; annual log for fewer)
- Media notification for 500+ individuals in a state/jurisdiction
- Notification must describe the breach, types of information involved, steps individuals should take, what the entity is doing to investigate/mitigate, and contact information

**Current state in RimalHealth:**

- The HIPAA NPP mentions duty to "notify you in the event of a breach of your unsecured PHI."
- No documented breach notification procedures or incident response plan.
- No technical mechanism for breach detection specific to Part 2 violations.

**Gaps:**
- **No Part 2-specific breach detection.** The system would need to detect disclosures that violate Part 2 (e.g., access without valid consent) even if they would be permitted under HIPAA.
- **No documented incident response plan.** There is no written procedure for breach investigation, notification, and reporting.
- **Broader breach definition not accounted for.** Staff/physicians may not understand that Part 2 breaches have a lower threshold than HIPAA breaches.

---

## 4. Consent Page Updates

The following is the **exact consent language** that must be added as a new checkbox item to the consent page at `app/checkout/consent/page.tsx`. This should be added as the 8th consent item in the `CONSENT_ITEMS` array, positioned after the HIPAA notice item and before the telehealth consent item.

### New Consent Item: 42 CFR Part 2 -- SUD Records Consent

**Checkbox ID:** `part2_sud_consent`

**Label text (plain language + legal requirements combined):**

```
I consent to the use and disclosure of my substance use disorder (SUD)
treatment records by Rimal Health for the purposes of treatment, payment,
and health care operations (TPO), as described below.

I understand that:

- My records are protected by federal confidentiality rules under
  42 CFR Part 2, which provide special protections for substance use
  disorder treatment records beyond standard HIPAA protections.

- By signing this consent, I authorize Rimal Health and its treating
  physicians to use and disclose my SUD treatment records to: my treating
  providers within Rimal Health, pharmacies designated for my prescriptions,
  payment processors for billing purposes, and other entities as necessary
  for treatment, payment, and health care operations.

- Records disclosed pursuant to this consent may be redisclosed by the
  recipient and may no longer be protected by 42 CFR Part 2.

- I may revoke this consent at any time by submitting a written request to
  support@rimalhealth.com, except to the extent that Rimal Health has
  already acted in reliance on my consent. Revocation of this consent may
  result in Rimal Health being unable to continue providing treatment
  services to me.

- This consent remains in effect until I revoke it in writing or until my
  treatment relationship with Rimal Health ends, whichever occurs first.

- My SUD treatment records cannot be used in legal proceedings against me
  without my specific consent or a court order meeting the requirements of
  42 CFR Part 2.

- I am not required to sign this consent. However, if I choose not to sign,
  Rimal Health may be unable to provide treatment services, as the program
  cannot share necessary treatment information with my care team and pharmacy
  without my authorization.
```

### Implementation Notes for the Consent Page

1. **This must be a separate, individually checkable consent item.** It cannot be bundled into the general HIPAA or telehealth consent. Part 2 consent must be distinct and individually acknowledged.

2. **The consent record must be stored with a version identifier.** Update the consent API at `app/api/checkout/consent/route.ts` to include `part2_sud_consent` in the schema and track consent version `3.0` (current is `2.0`).

3. **A downloadable PDF of the consent should be generated.** Per best practices and 42 CFR 2.32's requirement to provide a copy of consent with disclosures, RimalHealth should generate a timestamped PDF of the patient's consent that can be: (a) downloaded by the patient, (b) attached to disclosures.

4. **The consent should be re-obtainable.** If a patient revokes consent and later wants to resume treatment, a new consent must be obtained. The patient portal should have a mechanism for this.

5. **The Zod schema for the consent API must be updated:**

```typescript
// Add to consentSchema in app/api/checkout/consent/route.ts
consents: z.object({
  age: z.boolean().refine((v) => v === true, { message: 'Age confirmation is required' }),
  california: z.boolean().refine((v) => v === true, { message: 'California residency confirmation is required' }),
  terms: z.boolean().refine((v) => v === true, { message: 'Terms of Service agreement is required' }),
  privacy: z.boolean().refine((v) => v === true, { message: 'Privacy Policy agreement is required' }),
  hipaa: z.boolean().refine((v) => v === true, { message: 'HIPAA Notice agreement is required' }),
  part2_sud_consent: z.boolean().refine((v) => v === true, { message: '42 CFR Part 2 SUD consent is required' }),
  telehealth: z.boolean().refine((v) => v === true, { message: 'Telehealth consent is required' }),
  informed: z.boolean().refine((v) => v === true, { message: 'Informed consent is required' }),
}),
```

---

## 5. Privacy Page Updates

### 5.1 HIPAA Notice of Privacy Practices (`/hipaa`) Updates

The existing "Special Protections for Substance Use Disorder Records" section at `app/(marketing)/hipaa/page.tsx` (lines 109-119) must be replaced with a comprehensive Part 2 notice that satisfies 42 CFR 2.22. The following section should replace the current brief paragraph:

```
Special Protections for Substance Use Disorder Records (42 CFR Part 2)

Rimal Health is a substance use disorder (SUD) treatment program. As such,
your treatment records are protected by federal confidentiality regulations
at 42 CFR Part 2, in addition to the HIPAA Privacy Rule. These regulations
provide heightened protections for your SUD treatment records.

How 42 CFR Part 2 Protects Your Records:

- Consent Required for Most Disclosures: Generally, Rimal Health cannot
  disclose your SUD treatment records without your specific written consent,
  except in limited circumstances such as a medical emergency, to qualified
  personnel for audit or evaluation purposes, or as required by a court order
  that meets the requirements of 42 CFR Part 2.

- Single Consent for Treatment, Payment, and Operations: With your written
  consent, Rimal Health may use and disclose your SUD treatment records for
  treatment, payment, and health care operations (TPO). This consent covers
  future disclosures for these purposes and remains in effect until you revoke
  it or your treatment relationship ends.

- Protection in Legal Proceedings: Your SUD treatment records cannot be used
  in any civil, criminal, administrative, or legislative proceeding against you
  unless you provide specific written consent or a court issues an order meeting
  the requirements of 42 CFR Part 2 (Subpart E). This protection applies even
  if your records are subpoenaed.

- Redisclosure Limitations: When your records are disclosed with your consent,
  recipients are notified that the records are protected by 42 CFR Part 2 and
  that unauthorized redisclosure is prohibited. However, once records are
  disclosed pursuant to your TPO consent, recipients who are HIPAA covered
  entities or business associates may further use and disclose the records in
  accordance with HIPAA regulations.

Your Rights Under 42 CFR Part 2:

- Right to Revoke Consent: You may revoke your consent to use and disclose your
  SUD treatment records at any time by submitting a written request to
  support@rimalhealth.com. Revocation is not effective for disclosures already
  made in reliance on your consent. Please note that revoking consent may affect
  our ability to continue providing treatment.

- Right to an Accounting of Disclosures: You have the right to receive a list
  of disclosures of your SUD treatment records made with your written consent
  for up to three (3) years prior to your request. To request an accounting,
  contact us at support@rimalhealth.com.

- Right to Request Restrictions: You may request that Rimal Health restrict
  certain uses or disclosures of your SUD treatment records. We are not required
  to agree to all restrictions, but we will consider your request and notify you
  of our decision. To request a restriction, contact us at
  support@rimalhealth.com.

Complaints:

If you believe your rights under 42 CFR Part 2 have been violated, you may
file a complaint with:

- Rimal Health at support@rimalhealth.com
- The U.S. Department of Health and Human Services, Office for Civil Rights,
  at https://www.hhs.gov/hipaa/filing-a-complaint/index.html

We will not retaliate against you for filing a complaint.
```

Additionally, the "Right to an Accounting of Disclosures" item in the "Your Rights" section should be updated from:

> "You may request a list of disclosures of your PHI made in the past six years for purposes other than treatment, payment, or operations."

To:

> "You may request a list of disclosures of your PHI. For general health information, this covers disclosures made in the past six years for purposes other than treatment, payment, or operations. For substance use disorder treatment records protected by 42 CFR Part 2, you may request an accounting of disclosures made with your written consent for up to three years prior to your request, including disclosures for treatment, payment, and operations."

### 5.2 Privacy Policy Page (`/privacy`) Updates

The following new section should be added to the Privacy Policy page at `app/(marketing)/privacy/page.tsx`, inserted as a new Section 5 (between the current "HIPAA Compliance" section 4 and "Information Sharing" section 5, with subsequent sections renumbered):

```
5. Substance Use Disorder Record Protections (42 CFR Part 2)

Because Rimal Health provides treatment for substance use disorders, your
treatment records receive additional federal protections under 42 CFR Part 2,
the Confidentiality of Substance Use Disorder Patient Records regulation.

These protections mean:

- We will not disclose your SUD treatment records without your specific written
  consent, except in limited circumstances permitted by law (such as medical
  emergencies or qualified audits).

- Your SUD records cannot be used against you in any legal proceeding without
  your consent or a qualifying court order.

- When we share your records with your consent (for example, with your pharmacy
  or treating physician), we include a notice prohibiting unauthorized
  redisclosure.

- You have the right to an accounting of disclosures of your SUD records and
  the right to request restrictions on how your records are used or disclosed.

For full details on these protections, please review our HIPAA Notice of
Privacy Practices, which includes our 42 CFR Part 2 Patient Notice.

These protections apply in addition to, and not in place of, the general
privacy protections described elsewhere in this Privacy Policy. Where 42 CFR
Part 2 provides greater protection than HIPAA, the more protective standard
applies to your SUD treatment records.
```

---

## 6. Phased Implementation Plan

### Phase 1: Immediate Legal Compliance (Week 1-2) -- IN PROGRESS

These items address the highest-risk gaps where enforcement is already active.

| # | Task | Files Affected | Effort | Priority |
|---|------|---------------|--------|----------|
| 1.1 | **Add 42 CFR Part 2 consent item to consent page** -- Add the Part 2-specific consent checkbox with all required 42 CFR 2.31 elements as detailed in Section 4. | `app/checkout/consent/page.tsx`, `app/api/checkout/consent/route.ts` | Medium | P0 |
| 1.2 | **Update HIPAA NPP with Part 2 notice** -- Replace the brief Part 2 mention with the comprehensive notice as detailed in Section 5.1. | `app/(marketing)/hipaa/page.tsx` | Low | P0 |
| 1.3 | **Update Privacy Policy with Part 2 section** -- Add the new section as detailed in Section 5.2. | `app/(marketing)/privacy/page.tsx` | Low | P0 |
| 1.4 | **Add redisclosure notice to physician portal** -- Display a persistent banner or notice on all pages within `app/physician/(portal)/` that displays Part 2-protected records (intake review, patient details, messages, prescriptions) with the abbreviated redisclosure notice: "42 CFR part 2 prohibits unauthorized use or disclosure of these records." | `app/physician/(portal)/layout.tsx` or individual pages (`intake/[id]/page.tsx`, `patients/page.tsx`, `messages/page.tsx`) | Low | P0 |
| 1.5 | **Add redisclosure notice to DoseSpot transmissions** -- Ensure the redisclosure notice text is included in prescription data sent to DoseSpot/pharmacies. | `lib/integrations/dosespot.ts` | Low | P0 |

### Phase 2: Core Infrastructure (Weeks 3-4)

These items build the infrastructure needed for ongoing Part 2 compliance.

| # | Task | Files Affected | Effort | Priority |
|---|------|---------------|--------|----------|
| 2.1 | **Implement accounting of disclosures endpoint** -- Create `GET /api/patient/disclosures` that queries audit logs for the authenticated patient's records, filtered to disclosure events (physician access, pharmacy transmission, etc.) for the past 3 years. Return structured data per 45 CFR 164.528. | New: `app/api/patient/disclosures/route.ts` | Medium | P1 |
| 2.2 | **Add disclosure tracking to audit logger** -- Extend the audit logger to distinguish between internal "access" and external "disclosure" events. Add a `disclosureRecipient` field to audit metadata for Part 2 accounting purposes. | `lib/audit/types.ts`, `lib/audit/logger.ts` | Medium | P1 |
| 2.3 | **Add patient-facing accounting UI** -- Add a "Record Disclosures" page to the patient portal where patients can view and download their accounting of disclosures. | New: `app/patient/disclosures/page.tsx` | Medium | P1 |
| 2.4 | **Implement restriction request mechanism** -- Add a form/page in the patient portal for submitting disclosure restriction requests, and an admin/physician interface for reviewing and responding to them. Create a `RestrictionRequest` model in Prisma. | New: `app/patient/restrictions/page.tsx`, `prisma/schema.prisma`, new API route | High | P1 |
| 2.5 | **Verify BAA/QSOA status with all vendors** -- Contact each vendor (Neon, Netlify, SendGrid, AWS S3, Redis provider, DoseSpot, Stripe) to confirm BAA is signed and includes Part 2 provisions. Document status. If SendGrid BAA is not available, evaluate switching to AWS SES or Postmark. | Documentation / vendor outreach | Low (effort) but High (importance) | P1 |
| 2.6 | **Generate downloadable consent PDF** -- When a patient completes the consent flow, generate a timestamped PDF of their consent that can be stored and provided to the patient via the portal. | New: `lib/consent/pdf-generator.ts`, patient portal page | Medium | P1 |

### Phase 3: Hardening & Additional Requirements (Weeks 5-8)

| # | Task | Files Affected | Effort | Priority |
|---|------|---------------|--------|----------|
| 3.1 | **Patient MFA** -- Implement MFA for patient accounts. The 2026 HIPAA Security Rule (expected finalization May 2026) will mandate MFA for all ePHI access, including patient portals. | `lib/auth/mfa.ts`, `middleware.ts`, patient settings page | Medium | P1 |
| 3.2 | **WCAG 2.1 AA accessibility audit** -- Required by HHS by May 11, 2026. Focus on intake form (`app/intake/IntakeClient.tsx`) and patient portal. Add ARIA attributes, ensure keyboard navigation, verify 44x44px tap targets. | Multiple component files | High | P1 |
| 3.3 | **Breach notification procedures** -- Document an incident response plan covering Part 2 breaches (broader than HIPAA). Include: detection, investigation, notification templates, HHS reporting process, 60-day timeline tracking. | New documentation | Medium | P2 |
| 3.4 | **Consent revocation workflow** -- Implement the ability for patients to revoke their Part 2 consent through the patient portal. Upon revocation: flag the patient's records, notify treating physician, document that treatment may be discontinued. | New: `app/api/patient/consent/revoke/route.ts`, patient portal UI | Medium | P2 |
| 3.5 | **Staff training documentation** -- Create training materials for physicians explaining Part 2 obligations: no redisclosure without consent, legal proceedings protections, consequences of violations. | New documentation | Low | P2 |
| 3.6 | **Part 2-specific breach detection** -- Extend the audit system to flag potential Part 2 violations: access to records without valid consent, disclosures to unauthorized recipients, consent expiration without renewal. | `lib/audit/`, new monitoring logic | High | P2 |

---

## 7. Sources & Citations

### Primary Regulatory Sources

- [HHS Fact Sheet: 42 CFR Part 2 Final Rule](https://www.hhs.gov/hipaa/for-professionals/regulatory-initiatives/fact-sheet-42-cfr-part-2-final-rule/index.html) -- Official HHS summary of the 2024 Final Rule changes
- [42 CFR Part 2 -- Full Regulatory Text (eCFR)](https://www.ecfr.gov/current/title-42/chapter-I/subchapter-A/part-2) -- Current text of the regulation as amended
- [42 CFR 2.31 -- Consent Requirements (eCFR)](https://www.ecfr.gov/current/title-42/chapter-I/subchapter-A/part-2/subpart-C/section-2.31) -- Specific consent form element requirements
- [42 CFR 2.32 -- Notice and Copy of Consent to Accompany Disclosure (eCFR)](https://www.ecfr.gov/current/title-42/chapter-I/subchapter-A/part-2/subpart-C/section-2.32) -- Redisclosure notice requirements
- [Federal Register: Confidentiality of SUD Patient Records (89 FR 12472)](https://www.federalregister.gov/documents/2024/02/16/2024-02544/confidentiality-of-substance-use-disorder-sud-patient-records) -- Full Federal Register publication of the 2024 Final Rule
- [HHS: Understanding Part 2](https://www.hhs.gov/hipaa/part-2/index.html) -- HHS overview of Part 2 protections

### Legal Analysis & Implementation Guidance

- [Network for Public Health Law: Summary of 42 CFR Part 2 Final Rule](https://www.networkforphl.org/wp-content/uploads/2024/03/Summary-of-42-CFR-Part-2-Confidentiality-of-Substance-Use-Disorder-Patient-Records-Final-Rule.pdf) -- Detailed summary of all changes
- [Network for Public Health Law: Understanding and Implementing the Updates](https://www.networkforphl.org/wp-content/uploads/2025/02/Understanding-and-Implementing-the-Updates-to-42-CFR-Part-2-Confidentiality-of-Substance-Use-Disorder-Patient-Records.pdf) -- Implementation guidance published February 2025
- [3 Key Steps for Implementing Part 2 Changes](https://coephi.org/app/uploads/2025/02/implementation-fact-sheet-2025.pdf) -- Practical implementation steps
- [Snell & Wilmer: 42 CFR Part 2 and Privacy Rule Compliance -- Action Required by February 16, 2026](https://www.swlaw.com/publication/42-cfr-part-2-and-privacy-rule-compliance-action-required-by-february-16-2026/) -- Legal analysis of compliance obligations
- [Huntleigh: Redisclosure Tracking Under 42 CFR Part 2](https://huntleigh.com/redisclosure-tracking-under-42-cfr-part-2-what-you-must-do-by-2026/) -- Redisclosure notice implementation guidance
- [Hunton Andrews Kurth: HHS Final Rule Requires Targeted Updates to HIPAA Privacy Notices](https://www.hunton.com/privacy-and-cybersecurity-law-blog/hhs-final-rule-on-42-cfr-part-2-requires-targeted-updates-to-hipaa-privacy-notices) -- NPP update requirements
- [Faegre Drinker: Required Updates to HIPAA NPP and Part 2 Patient Notice](https://www.faegredrinker.com/en/insights/publications/2025/7/reminder-required-updates-to-hipaa-notice-of-privacy-practices-and-distribution-of-part-2-patient-notice) -- Reminder of NPP update obligations
- [HIPAA Journal: February 16, 2026 Compliance Deadline](https://www.hipaajournal.com/february-16-2026-compliance-deadline-part-2-final-rule/) -- Compliance deadline analysis
- [Foley Hoag: 42 CFR Part 2 Civil Enforcement Is Here](https://foleyhoag.com/news-and-insights/blogs/security-privacy-and-the-law/2026/february/42-c-f-r-part-2-civil-enforcement-is-here-what-substance-use-disorder-providers-need-to-know/) -- Enforcement landscape as of February 2026

### BAA / Vendor Compliance

- [AccountableHQ: HIPAA Notice of Privacy Practices Update Deadline](https://www.accountablehq.com/post/hipaa-notice-of-privacy-practices-update-deadline-february-16-2026-requirements-and-next-steps) -- NPP update deadline and steps
- [AccountableHQ: 42 CFR Part 2 Final Rule Changes -- What's New and How to Comply](https://www.accountablehq.com/post/42-cfr-part-2-final-rule-changes-2024-what-s-new-and-how-to-comply) -- Comprehensive compliance guide
- [Legal HIE: Beware! New Breach Reporting Obligations Under 42 CFR Part 2](https://www.legalhie.com/beware-new-breach-reporting-obligations-under-42-cfr-part-2-even-when-hipaa-wouldnt-require-it/) -- Part 2 breach notification analysis
- [Psychiatry.org: Final Rule -- 42 CFR Part 2](https://www.psychiatry.org/psychiatrists/practice/practice-management/hipaa/42-cfr-part-2) -- APA guidance for practitioners

### Specialty & Telehealth Context

- [Telehealth.org: Understanding the Newly Updated 42 CFR Part 2](https://telehealth.org/news/42-cfr/) -- Telehealth-specific Part 2 guidance
- [Center for Health Care Strategies: Changes to SUD Confidentiality Regulations](https://www.chcs.org/resource/changes-to-substance-use-disorder-confidentiality-regulations/) -- Health care strategy perspective

---

## Appendix A: Regulatory Cross-Reference

| 42 CFR Part 2 Section | Requirement | RimalHealth Status |
|----------------------|-------------|-------------------|
| 2.11 | Program definition (applicability) | APPLIES -- AUD treatment program |
| 2.12(c)(5) | Legal proceedings restrictions | NOT COMMUNICATED to patients |
| 2.13 | Confidentiality restrictions and safeguards | PARTIAL -- encryption/access controls exist |
| 2.16 | Breach notification | GAP -- no Part 2-specific breach procedures |
| 2.22 | Patient notice (combined with NPP) | GAP -- current NPP insufficient |
| 2.23 | Patient access and restrictions | GAP -- no restriction request mechanism |
| 2.24 | Accounting of disclosures | GAP -- no patient-facing accounting |
| 2.31 | Consent requirements | CRITICAL GAP -- no Part 2-compliant consent |
| 2.32 | Redisclosure notice with disclosures | CRITICAL GAP -- not implemented |
| 2.33 | Redisclosure by recipients | NOT ADDRESSED in vendor agreements |
| 2.35 | Medical emergencies exception | Not explicitly documented |
| 2.36 | Audit and evaluation exception | Not explicitly documented |

## Appendix B: Consent Page Consent Item Array Entry

For direct implementation, the new consent item to add to the `CONSENT_ITEMS` array in `app/checkout/consent/page.tsx`:

```tsx
{
  id: 'part2_sud_consent',
  label: (
    <>
      <strong>Substance Use Disorder Records Consent (42 CFR Part 2):</strong>{' '}
      I consent to the use and disclosure of my substance use disorder treatment
      records by Rimal Health for treatment, payment, and health care operations.
      I understand that: (1) my records are protected by federal confidentiality
      rules under 42 CFR Part 2; (2) records disclosed may be redisclosed by
      recipients and may no longer be protected; (3) I may{' '}
      <strong>revoke this consent at any time</strong> by writing to{' '}
      <a
        href="mailto:support@rimalhealth.com"
        className="text-ocean font-medium underline underline-offset-2 hover:text-ocean-600 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        support@rimalhealth.com
      </a>
      ; (4) this consent remains in effect until revoked or until my treatment
      relationship ends; (5) my records <strong>cannot be used in legal
      proceedings against me</strong> without my consent or a qualifying court
      order; and (6) refusal to sign may prevent Rimal Health from providing
      treatment services. See our{' '}
      <a
        href="/hipaa"
        target="_blank"
        rel="noopener noreferrer"
        className="text-ocean font-medium underline underline-offset-2 hover:text-ocean-600 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        HIPAA &amp; Part 2 Notice
      </a>{' '}
      for full details.
    </>
  ),
  icon: <Shield className="h-4 w-4 text-ocean" />,
},
```

---

*This document is for compliance planning purposes. Legal counsel specializing in healthcare privacy law should review all consent language, privacy notices, and vendor agreements before deployment. RimalHealth should consult with a healthcare attorney to confirm these recommendations meet the specific circumstances of the program.*
