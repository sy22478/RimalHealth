# Stripe Payment Integration

> **Task:** T-016 - Integrate Stripe Payment Processing  
> **Status:** ✅ COMPLETE  
> **Last Updated:** 2026-02-24

---

## Overview

This integration provides HIPAA-compliant payment processing for Rimal Health using Stripe. All payment data is handled by Stripe (PCI compliant) - we only store Stripe IDs locally.

## Features

- ✅ Stripe Checkout hosted payment pages
- ✅ Subscription management (create, cancel, resume)
- ✅ Automatic invoice generation
- ✅ Webhook handling for payment lifecycle
- ✅ Retry logic with exponential backoff (Pattern INT-001)
- ✅ Comprehensive audit logging
- ✅ Email notifications for payment events

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser)                        │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │  Checkout Form  │  │      Payment Page               │  │
│  │  (4 steps)      │→ │  (/checkout/payment)            │  │
│  └─────────────────┘  └─────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │ POST /api/stripe/checkout-session
                               ↓
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Routes                       │
│  ┌──────────────────────┐  ┌────────────────────────────┐  │
│  │ /api/stripe/         │  │ /api/webhooks/stripe       │  │
│  │   checkout-session   │  │                            │  │
│  │   subscription       │  │ Handles Stripe webhooks:   │  │
│  │                      │  │ - checkout.session.completed│  │
│  │ GET, POST, DELETE,   │  │ - invoice.payment_succeeded │  │
│  │ PATCH endpoints      │  │ - invoice.payment_failed    │  │
│  └──────────────────────┘  │ - customer.subscription.*   │  │
└──────────────────────────┬──┴────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  Stripe Integration Layer                   │
│              (lib/integrations/stripe.ts)                   │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Customer   │  │ Subscription│  │  Checkout Session   │ │
│  │  Management │  │  Management │  │      Creation       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Retry Logic (Pattern INT-001)          │   │
│  │   - Exponential backoff with jitter                 │   │
│  │   - Automatic retries for network errors            │   │
│  │   - Max 3 retries for transient failures            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Configuration

### Environment Variables

```bash
# Stripe API Keys (from https://dashboard.stripe.com/apikeys)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (from https://dashboard.stripe.com/products)
STRIPE_PRICE_ACTIVE_TREATMENT=price_...
STRIPE_PRICE_MAINTENANCE=price_...
```

### Pricing Setup

1. Create products in Stripe Dashboard:
   - **Active Treatment**: $50/month recurring
   - **Maintenance**: $25/month recurring

2. Copy the price IDs to your environment variables.

### Webhook Configuration

1. In Stripe Dashboard, go to Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Select events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

---

## API Endpoints

### Create Checkout Session
```
POST /api/stripe/checkout-session
Authorization: Bearer <access_token>

{
  "planType": "ACTIVE_TREATMENT" | "MAINTENANCE",
  "successUrl": "https://.../checkout/success?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://.../checkout/cancel"
}

Response:
{
  "sessionId": "cs_...",
  "url": "https://checkout.stripe.com/..."
}
```

### Get Subscription Details
```
GET /api/stripe/subscription
Authorization: Bearer <access_token>

Response:
{
  "subscriptions": [...],
  "hasActiveSubscription": true
}
```

### Cancel Subscription
```
DELETE /api/stripe/subscription
Authorization: Bearer <access_token>

{
  "immediate": false  // true = immediate, false = at period end
}
```

### Resume Subscription
```
PATCH /api/stripe/subscription
Authorization: Bearer <access_token>

{
  "action": "resume"
}
```

---

## Frontend Flow

### 1. Checkout Form (4 Steps)
- Personal info
- Address
- Screening questions
- Review & consent

### 2. Payment Page
```tsx
// User selects plan and clicks "Proceed to Payment"
// Creates checkout session → redirects to Stripe
```

### 3. Stripe Hosted Checkout
- User enters payment details
- Stripe handles PCI compliance
- Redirects back to success/cancel URL

### 4. Success Page
- Verifies session status
- Shows confirmation
- Links to dashboard

---

## Webhook Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create subscription record, update intake, send welcome email |
| `invoice.payment_succeeded` | Create invoice record, update subscription dates, send receipt |
| `invoice.payment_failed` | Mark subscription past_due, notify user |
| `customer.subscription.updated` | Sync status changes to database |
| `customer.subscription.deleted` | Mark cancelled, notify user |

---

## HIPAA Compliance

### Data Storage
- ✅ **Never store**: Credit card numbers, CVV, full card details
- ✅ **Store only**: Stripe IDs (`cus_...`, `sub_...`, `pi_...`)
- ✅ **Encryption**: All database records encrypted at rest
- ✅ **Audit logs**: All payment events logged with context

### Security
- ✅ Webhook signature verification
- ✅ Authentication required for all payment APIs
- ✅ HTTPS only
- ✅ PCI compliance via Stripe Checkout

---

## Testing

### Test Cards

| Card Number | Scenario |
|-------------|----------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 3220` | 3D Secure required |

Use any future expiry date and any 3-digit CVC.

### Webhook Testing (Local)

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Copy the webhook signing secret to .env.local
```

---

## Error Handling

### Retry Logic (Pattern INT-001)
```typescript
// Automatic retries for:
- Network errors (connection timeout, DNS failure)
- Rate limit errors (429)
- Server errors (5xx)

// Exponential backoff: 1s, 2s, 4s + jitter
// Max 3 retries
```

### Graceful Degradation (Pattern ERR-001)
```typescript
// User-friendly error messages
// Never expose internal errors to client
// Log detailed errors server-side
```

---

## Files Created/Modified

```
lib/integrations/
├── stripe.ts                    # NEW - Stripe client & utilities
└── STRIPE.md                    # NEW - This documentation

app/api/stripe/
├── checkout-session/
│   └── route.ts                 # NEW - Checkout session API
└── subscription/
    └── route.ts                 # NEW - Subscription management API

app/api/webhooks/stripe/
└── route.ts                     # NEW - Webhook handler

app/(patient)/checkout/
├── payment/
│   └── page.tsx                 # NEW - Payment page
├── success/
│   └── page.tsx                 # NEW - Success page
└── cancel/
    └── page.tsx                 # NEW - Cancel page

.env.example                     # MODIFIED - Added Stripe env vars
```

---

## Usage Examples

### Create Checkout Session
```typescript
const response = await fetch("/api/stripe/checkout-session", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    planType: "ACTIVE_TREATMENT",
    successUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${window.location.origin}/checkout/cancel`,
  }),
});

const { url } = await response.json();
window.location.href = url;
```

### Cancel Subscription
```typescript
const response = await fetch("/api/stripe/subscription", {
  method: "DELETE",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ immediate: false }),
});
```

---

## Dependencies

```json
{
  "dependencies": {
    "stripe": "^17.x",
    "@stripe/stripe-js": "^5.x"
  }
}
```

---

## References

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Checkout](https://stripe.com/docs/payments/checkout)
- [Stripe Subscriptions](https://stripe.com/docs/billing/subscriptions/overview)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [PCI Compliance](https://stripe.com/docs/security/guide)

---

## Maintenance Notes

### Future Enhancements
- [ ] Support for annual billing (discount)
- [ ] Proration when changing plans
- [ ] Payment method management UI
- [ ] Invoice PDF generation
- [ ] Tax calculation (Stripe Tax)

### Known Limitations
- Webhook idempotency uses in-memory cache (use Redis in production)
- Plan changes not yet implemented (requires Stripe Schedule)
- No refund API (manual via Stripe Dashboard)
