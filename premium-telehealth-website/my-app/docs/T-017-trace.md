# T-017: Patient Profile on Payment Success - Implementation Trace

## Summary

Completed implementation of Task T-017: Create Patient Profile on Payment Success. This task creates the backend infrastructure for managing patient profiles when a user completes payment through Stripe.

## Files Created

### Library Files (`lib/patient/`)

1. **`lib/patient/profile.ts`** - Core patient profile CRUD operations
   - `createPatientProfile()` - Creates a new patient profile
   - `getPatientProfileByUserId()` - Fetches profile by user ID
   - `getPatientProfileById()` - Fetches profile by profile ID
   - `updatePatientProfile()` - Updates allowed fields
   - `patientProfileExists()` - Checks if profile exists
   - `extractSafeProfileFields()` - Extracts non-PHI fields for logging
   - Utility functions: `isValidCaliforniaAddress()`, `formatPhoneForDisplay()`, `getPatientFullName()`

2. **`lib/patient/onboarding.ts`** - Onboarding workflow management
   - `storeCheckoutData()` - Temporarily stores checkout data in Redis (1 hour TTL)
   - `getCheckoutData()` - Retrieves checkout data for profile creation
   - `clearCheckoutData()` - Clears temporary data after profile creation
   - `updateOnboardingStatus()` - Tracks onboarding progress
   - `validateCheckoutData()` - Validates checkout data structure
   - `checkoutDataToProfileData()` - Converts checkout data to profile format

3. **`lib/patient/index.ts`** - Module exports

### API Routes (`app/api/`)

4. **`app/api/patient/onboarding/start/route.ts`** - Starts onboarding process
   - Authenticates user via JWT
   - Validates checkout form data
   - Stores data temporarily in Redis
   - Returns redirect URL for payment

5. **`app/api/patient/profile/route.ts`** - Profile management
   - `GET` - Get current user's profile
   - `POST` - Create profile (admin/system use)

6. **`app/api/patient/profile/[id]/route.ts`** - Individual profile operations
   - `GET` - Get specific profile (with authorization checks)
   - `PUT` - Update profile (patients can only update own profile)

7. **`app/api/webhooks/stripe/route.ts`** - Stripe webhook handler
   - `checkout.session.completed` - Creates profile, subscription, sends welcome email
   - `invoice.payment_succeeded` - Updates subscription, creates invoice record
   - `invoice.payment_failed` - Marks subscription as past due
   - `customer.subscription.deleted` - Handles cancellation
   - `customer.subscription.updated` - Updates subscription details

8. **`app/api/patient/onboarding/complete/route.ts`** - Completes onboarding
   - Marks onboarding as complete after intake submission
   - Sends intake submitted confirmation email
   - Clears temporary onboarding data

### Updated Files

9. **`lib/notifications/templates.ts`** - Added `ADMIN_ALERT` email template

## Data Flow

```
1. User completes checkout form
   └─> POST /api/patient/onboarding/start
       └─> Store checkout data in Redis (1 hour TTL)
           └─> Redirect to Stripe payment

2. User completes Stripe payment
   └─> Stripe webhook fires
       └─> POST /api/webhooks/stripe
           └─> checkout.session.completed handler
               ├─> Get checkout data from Redis
               ├─> Create PatientProfile (PHI encrypted)
               ├─> Create Subscription record
               ├─> Queue welcome email
               ├─> Queue payment receipt email
               ├─> Audit log profile creation
               └─> Clear Redis checkout data

3. User completes intake form
   └─> POST /api/patient/onboarding/complete
       └─> Mark onboarding complete
           └─> Queue intake submitted email
               └─> Redirect to dashboard
```

## HIPAA Compliance Implementation

### PHI Encryption
- All PHI fields are automatically encrypted by the Prisma extension (`lib/db/encryption-extension.ts`)
- Uses AES-256-GCM encryption via `lib/encryption/phi.ts`
- No manual encryption/decryption needed in API routes

### Audit Logging
- All profile access is logged via `auditLogger.logPHIAccess()`
- Create, view, and update operations are logged with:
  - User ID and role
  - Resource type and ID
  - IP address and user agent
  - Timestamp
- Uses `extractSafeProfileFields()` to avoid logging PHI

### Temporary Data Storage
- Checkout data stored in Redis with 1-hour TTL
- Keys use user ID only (no PHI in keys)
- Data cleared immediately after profile creation
- Onboarding status tracked separately with 24-hour TTL

### Authorization
- Patients can only access their own profile
- Physicians and admins can access any profile (for clinical/admin purposes)
- JWT token verification on all protected endpoints

## Environment Variables Required

Add to `.env.local`:

```bash
# Stripe (required for webhooks)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# Redis (required for temporary storage)
REDIS_URL=redis://localhost:6379
REDIS_TLS_ENABLED=false
REDIS_PASSWORD= # optional

# App URL (for email links)
NEXT_PUBLIC_APP_URL=https://rimalhealth.com
```

## Testing Checklist

- [ ] PatientProfile created on checkout.session.completed webhook
- [ ] All checkout data copied correctly to profile
- [ ] HIPAA consent recorded with timestamp
- [ ] Terms acceptance recorded
- [ ] Welcome email queued via notificationQueue
- [ ] Payment receipt email queued
- [ ] Audit log entry created
- [ ] Subscription record created with Stripe IDs
- [ ] Temporary checkout data cleared from Redis
- [ ] User can GET their own profile
- [ ] User can PUT update allowed fields
- [ ] Users cannot access other users' profiles
- [ ] TypeScript strict mode compliance

## Integration with Other Tasks

### T-015 (Checkout Form)
- Checkout form submits to `/api/patient/onboarding/start`
- Uses CheckoutData type from `lib/patient/onboarding.ts`

### T-016 (Stripe Integration)
- Webhook handler at `/api/webhooks/stripe`
- Creates profile after checkout.session.completed
- Stores Stripe customer and subscription IDs

### T-010 (Audit Logging)
- Uses `auditLogger.logPHIAccess()` for all PHI operations
- Logs stored in AuditLog table

### T-011 (Notifications)
- Uses `notificationQueue.add()` for welcome email
- Uses `EmailTemplate.WELCOME` and `EmailTemplate.PAYMENT_RECEIPT`

### T-004 (PHI Encryption)
- Prisma extension automatically encrypts/decrypts PHI
- No manual encryption needed in API routes

## Challenges & Solutions

### Challenge 1: Temporary PHI Storage
**Problem**: Checkout data contains PHI but needs to be stored temporarily before payment.

**Solution**: 
- Store in Redis with short TTL (1 hour)
- Use user ID in key (not PHI)
- Clear immediately after profile creation
- Data expires automatically if payment fails

### Challenge 2: Stripe Webhook Idempotency
**Problem**: Stripe may send webhooks multiple times.

**Solution**:
- Check if profile already exists before creating
- Use user ID as unique constraint
- Return early if profile exists

### Challenge 3: Audit Context in Webhooks
**Problem**: Webhooks don't have request context for audit logging.

**Solution**:
- Use 'stripe-webhook' as IP address
- Use 'stripe' as user agent
- Log the actual user ID from the database lookup

### Challenge 4: Type Safety with Prisma Extension
**Problem**: Prisma extension for encryption changes return types.

**Solution**:
- Use inferred types from Prisma client
- Extension handles encryption/decryption transparently
- No type changes needed in API code

## Future Improvements

1. **Retry Logic**: Add retry mechanism for failed profile creations
2. **Webhook Verification**: Add signature verification for Stripe webhooks
3. **Monitoring**: Add alerts for failed webhook processing
4. **Admin Dashboard**: Add endpoint for admins to list/search patient profiles
5. **Data Export**: Add GDPR-compliant data export for patient profiles

## References

- Prisma Client Extensions: https://www.prisma.io/docs/concepts/components/prisma-client/client-extensions
- Stripe Webhooks: https://stripe.com/docs/webhooks
- HIPAA Audit Requirements: https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html
