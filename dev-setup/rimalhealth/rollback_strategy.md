# Rollback Strategy — RimalHealth Flow Redesign Sprint

> Last updated: 2026-03-25

This document describes how to roll back the payment-first patient flow and related changes if something breaks in production.

---

## 1. Key Commits (Newest First)

| Commit | Description |
|--------|-------------|
| `97d271c` | P2 infrastructure + performance + P3 quick wins |
| `581283a` | Patient MFA + 72 encryption/audit tests |
| `734f6c9` | Stripe consolidation, webhook dedup, consent linkage, 50 new tests |
| `cde5754` | Login verification flow — rate limit, resend button, a11y |
| `9827362` | HIPAA hardening, 42 CFR Part 2, accessibility, CSRF, tests |
| `d5dd52a` | Intake gate + 34-question DSM-5 intake form |
| `0b7653e` | Redesign post-payment flow with email verification |
| `870365d` | Security: fix all P0 critical vulnerabilities |

The flow redesign itself landed primarily in `0b7653e` (post-payment flow) and `d5dd52a` (intake form). Reverting further than `870365d` would also undo P0 security fixes, which is not recommended.

---

## 2. Quick Rollback — Revert a Single Feature

If only one area is broken, revert the most specific commit:

```bash
# Example: revert the intake form changes only
git revert d5dd52a --no-edit

# Example: revert the payment flow changes only
git revert 0b7653e --no-edit
```

After reverting, check for merge conflicts in:
- `app/api/webhooks/stripe/route.ts` (webhook handler auto-creates users)
- `app/intake/IntakeClient.tsx` (multi-step intake form)
- `middleware.ts` (public route list)

---

## 3. Full Rollback — Return to Pre-Sprint State

To roll back all sprint changes:

```bash
# Create a rollback branch from pre-sprint state
git checkout -b rollback/pre-sprint 870365d~1

# Or revert each commit in reverse order on main
git revert 97d271c 581283a 734f6c9 cde5754 9827362 d5dd52a 0b7653e --no-edit
```

**Warning:** This undoes security hardening (MFA, CSRF, webhook dedup). Only do this as a last resort.

---

## 4. Database Considerations

### Forward-Only Migrations

The following Prisma models were added during this sprint:

- **`WebhookEvent`** — Stores processed Stripe webhook event IDs for deduplication. The `stripeEventId` column has a unique constraint.
- **`ConsentRecord`** (if created) — Links 42 CFR Part 2 consent to users.

**These migrations are forward-only.** Rolling back the code does NOT roll back the database schema. The extra tables/columns will remain but be harmlessly unused by older code.

If you must drop the tables (strongly discouraged in production):

```sql
-- Only if absolutely necessary and data loss is acceptable
DROP TABLE IF EXISTS "WebhookEvent";
```

### PHI Encryption

Field-level encryption (`encryptPHI`/`decryptPHI`) has not changed format during this sprint. Encrypted data written by sprint code is still readable by pre-sprint code as long as `PHI_ENCRYPTION_KEY` is unchanged.

---

## 5. Feature Flags / Kill Switches

### REQUIRE_EMAIL_VERIFICATION (removed)

The `REQUIRE_EMAIL_VERIFICATION` environment variable was removed during the flow redesign because email verification is now mandatory in the payment-first flow. To re-add it as a kill switch:

1. Add `REQUIRE_EMAIL_VERIFICATION=false` to Netlify env vars.
2. In `middleware.ts`, restore the conditional check:
   ```typescript
   if (process.env.REQUIRE_EMAIL_VERIFICATION !== 'false') {
     // enforce email verification gate
   }
   ```
3. This allows disabling email verification without a code deploy.

### Stripe Webhook User Auto-Creation

If the Stripe webhook is failing to auto-create users, the quickest fix is:

1. Set `DISABLE_WEBHOOK_USER_CREATION=true` in Netlify env vars.
2. Add a check at the top of `app/api/webhooks/stripe/route.ts`:
   ```typescript
   if (process.env.DISABLE_WEBHOOK_USER_CREATION === 'true') {
     // Log the event but skip user creation
   }
   ```
3. Manually create patient accounts until the issue is resolved.

### In-Memory Rate Limit Fallback

If the new in-memory rate limiter causes issues (e.g., false positives on serverless with cold starts), set `useMemoryFallback: false` on the auth/strict presets in `lib/middleware/rate-limit.ts` and redeploy. This reverts to the previous fail-open behavior.

---

## 6. Monitoring After Rollback

After any rollback, verify:

1. **Stripe webhooks** — Check Stripe dashboard for failed webhook deliveries.
2. **Login flow** — Test patient and physician login end-to-end.
3. **Intake form** — Submit a test intake and verify physician notification.
4. **Billing** — Verify `/patient/billing` loads correctly.
5. **Audit logs** — Check `AuditLog` table for recent entries (ensures audit logging still works).
6. **Health endpoint** — `GET /api/health` returns 200.

---

## 7. Contact

If production is down and you need to rollback immediately:

1. Deploy the previous known-good commit via Netlify:
   ```bash
   cd premium-telehealth-website/my-app
   git checkout 870365d
   netlify deploy --prod
   ```
2. This bypasses CI and deploys directly. Revert on `main` afterward.
