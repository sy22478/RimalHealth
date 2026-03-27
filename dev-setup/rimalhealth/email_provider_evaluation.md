# Email Provider Evaluation: HIPAA BAA Compliance

> **Date:** 2026-03-25
> **Author:** AutoDream Agent (Task 8)
> **Context:** RimalHealth is a HIPAA-regulated telehealth platform for AUD treatment. All transactional emails (welcome, set-password, intake notifications, billing) flow through SendGrid today. A signed Business Associate Agreement (BAA) is required for any vendor that may process, transmit, or store Protected Health Information (PHI).

---

## 1. Current State

**Provider:** Twilio SendGrid
**Integration file:** `lib/integrations/sendgrid.ts`
**Templates:** `lib/notifications/templates.ts` (8+ templates)
**Retry queue:** `processRetryQueue()` in sendgrid.ts, backed by Redis sorted set
**Usage:** Transactional only (no marketing campaigns). ~50-200 emails/month at current scale.

The integration uses the `@sendgrid/mail` npm package, calls `sgMail.send()`, disables click tracking for HIPAA, and avoids logging PHI. The email content itself may reference patient names or appointment details in the body, which constitutes PHI in transit.

---

## 2. Provider Comparison

### 2.1 Twilio SendGrid

| Attribute | Detail |
|-----------|--------|
| **BAA Available?** | **NO.** Twilio explicitly states that SendGrid is not HIPAA-compliant and will not sign a BAA for SendGrid. Other Twilio products (Programmable Messaging, Voice) can operate under a BAA on Enterprise plans, but SendGrid is excluded. |
| **Official statement** | "SendGrid is not natively HIPAA compliant and does not offer encryption or security measures beyond SMTP." — [Twilio SendGrid HIPAA docs](https://www.twilio.com/docs/sendgrid/ui/account-and-settings/hipaa-compliant) |
| **Pricing** | Free tier: 100 emails/day. Essentials: $19.95/mo (50K). Pro: $89.95/mo (100K). |
| **Integration effort** | Already integrated (zero effort). |
| **Verdict** | **Cannot be used for PHI-containing emails.** Must either (a) ensure zero PHI in email bodies (difficult given patient names, intake details), or (b) migrate to a BAA-capable provider. |

### 2.2 Amazon SES (Simple Email Service)

| Attribute | Detail |
|-----------|--------|
| **BAA Available?** | **YES.** Amazon SES is a HIPAA Eligible Service. Self-service BAA available through AWS Artifact console at no additional cost. |
| **Official statement** | "Amazon SES is a HIPAA Eligible Service and can be used for HIPAA-regulated workloads when a BAA is in place." — [AWS HIPAA Compliance](https://aws.amazon.com/compliance/hipaa-compliance/) |
| **Pricing** | $0.10 per 1,000 emails. At 200 emails/month = ~$0.02/month. Even at 10,000 emails/month = $1.00/month. First 3,000/month free for 12 months on new accounts. |
| **Integration effort** | **Moderate.** Replace `@sendgrid/mail` with `@aws-sdk/client-ses`. One file changes (`sendgrid.ts` becomes `ses.ts`). The `SendEmailOptions` interface, retry queue, and template system remain identical. Estimated: 2-4 hours. |
| **Pros** | Cheapest option. BAA included. Already using AWS for S3 (shared credentials). Excellent deliverability. No vendor lock-in on email templates. |
| **Cons** | No built-in template editor (not needed -- we use code templates). Must manage SES sending identity verification (domain/DKIM). Raw infrastructure -- no analytics dashboard (acceptable for transactional email). |

### 2.3 Postmark

| Attribute | Detail |
|-----------|--------|
| **BAA Available?** | **NO.** Postmark will not sign a BAA. Their official support article states: "Postmark is not HIPAA-compliant and cannot sign any Business Associate Agreements around HIPAA." |
| **Official statement** | [Postmark HIPAA Support Article](https://postmarkapp.com/support/article/1041-is-postmark-hipaa-compliant) |
| **Pricing** | $15/month for 10,000 emails. |
| **Integration effort** | Moderate (similar to SES). |
| **Verdict** | **Not viable** for a HIPAA-regulated platform. |

### 2.4 Mailgun (Bonus)

| Attribute | Detail |
|-----------|--------|
| **BAA Available?** | **YES.** Mailgun will sign a BAA and encrypts messages at rest and in transit. Available on paid plans. |
| **Official statement** | Mailgun advertises BAA signing and HIPAA compliance on their compliance page. |
| **Pricing** | Foundation: $35/month (50K emails). Scale: $90/month (100K). |
| **Integration effort** | Moderate. Replace `@sendgrid/mail` with Mailgun's `mailgun.js` SDK. Same scope of changes as SES. |
| **Verdict** | Viable alternative, but more expensive than SES with no significant advantage for transactional-only use. |

### 2.5 Paubox (Healthcare-Specific)

| Attribute | Detail |
|-----------|--------|
| **BAA Available?** | **YES.** BAA signed for all customers. HITRUST CSF certified. Purpose-built for healthcare email. |
| **Pricing** | Starts at $29/user/month. Designed for user-facing email (Outlook/Gmail integration), not transactional API. |
| **Integration effort** | High. Paubox is primarily a secure email gateway, not a transactional email API. Would require significant architectural changes. |
| **Verdict** | Overkill for transactional API emails. Better suited for provider-to-patient direct email communication. |

---

## 3. Files That Would Change (SES Migration)

If migrating from SendGrid to AWS SES, the following files would need updates:

| File | Change |
|------|--------|
| `lib/integrations/sendgrid.ts` | Rewrite to use `@aws-sdk/client-ses`. Rename to `ses.ts` or keep filename. |
| `lib/notifications/index.ts` | Update imports from sendgrid to new module. |
| `lib/notifications/templates.ts` | No change (templates are provider-agnostic). |
| `lib/notifications/queue.ts` | No change (queue is provider-agnostic). |
| `lib/services/notification-service.ts` | No change (calls `sendEmail` which is re-exported). |
| `package.json` | Remove `@sendgrid/mail`, add `@aws-sdk/client-ses`. |
| `.env.example` | Replace `SENDGRID_*` vars with `AWS_SES_REGION`, `AWS_SES_FROM_EMAIL`. Can reuse existing `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`. |
| Netlify env vars | Add SES config, optionally remove SendGrid keys. |

**Total estimated effort:** 3-4 hours for implementation + 1-2 hours for testing.

---

## 4. Cost Comparison (at 500 emails/month)

| Provider | Monthly Cost | BAA? | Notes |
|----------|:----------:|:----:|-------|
| SendGrid (Free) | $0 | No | 100/day limit |
| SendGrid (Essentials) | $19.95 | No | -- |
| **AWS SES** | **~$0.05** | **Yes** | $0.10/1K emails |
| Mailgun (Foundation) | $35 | Yes | Minimum tier |
| Paubox | $29+/user | Yes | Not API-oriented |
| Postmark | $15 | No | -- |

---

## 5. Recommendation

### **Migrate from SendGrid to AWS SES.**

**Rationale:**

1. **SendGrid cannot sign a BAA.** This is a hard blocker for HIPAA compliance. Even if current email templates are carefully written, the risk of PHI leaking into email content (patient names, intake status, appointment details) makes a BAA essential.

2. **AWS SES is the clear winner** for this use case:
   - BAA available at no extra cost (self-service via AWS Artifact)
   - Cheapest option by far ($0.05/month vs $35+/month for Mailgun)
   - RimalHealth already uses AWS for S3 document storage, so AWS credentials and billing are already configured
   - Integration effort is minimal (one file rewrite, same interfaces)
   - Excellent deliverability and SLA

3. **Mailgun is a viable backup** if AWS SES proves problematic (e.g., sending limits, domain verification issues), but at 70x the cost.

### Migration Priority

This should be treated as **P0** — it is a HIPAA compliance gap. Until migration is complete, ensure email templates contain **zero PHI** (use generic language like "Log in to view your update" rather than including patient names or medical details in the email body).

### Immediate Mitigation (Before Migration)

Review all email templates in `lib/notifications/templates.ts` and ensure:
- No patient names in email body (use "Dear Patient" or first name only if acceptable under your privacy policy)
- No medical details, diagnosis, or treatment information
- All actionable content directs users to log in to the portal
- Click tracking is disabled (already done)

---

## Sources

- [Twilio SendGrid HIPAA Docs](https://www.twilio.com/docs/sendgrid/ui/account-and-settings/hipaa-compliant)
- [Is Twilio SendGrid HIPAA Compliant? (Paubox)](https://www.paubox.com/blog/twilio-sendgrid-hipaa-compliant)
- [Is SendGrid HIPAA Compliant? (HIPAA Journal)](https://www.hipaajournal.com/sendgrid-hipaa-compliant/)
- [Twilio and HIPAA](https://www.twilio.com/en-us/hipaa)
- [AWS HIPAA Compliance](https://aws.amazon.com/compliance/hipaa-compliance/)
- [Is Amazon SES HIPAA Compliant? (Paubox)](https://www.paubox.com/blog/amazon-ses-hipaa-compliant)
- [AWS Self-Service BAA](https://aws.amazon.com/blogs/security/introducing-the-self-service-business-associate-addendum/)
- [Postmark HIPAA Support](https://postmarkapp.com/support/article/1041-is-postmark-hipaa-compliant)
- [Is Postmark HIPAA Compliant? (HIPAA Journal)](https://www.hipaajournal.com/postmark-hipaa-compliant/)
- [Amazon SES Pricing 2026](https://blog.campaignhq.co/amazon-ses-pricing-2026)
- [AWS SES vs SendGrid Comparison (Courier)](https://www.courier.com/integrations/compare/amazon-ses-vs-sendgrid)
