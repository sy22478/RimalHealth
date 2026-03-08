# Rimal Health API Specification

Comprehensive API reference for the Rimal Health telehealth platform. All endpoints are served under `/api/`.

**Base URL:** `https://app.rimalhealth.com/api` (production) or `http://localhost:3000/api` (development)

**Authentication:** Custom JWT via `Authorization: Bearer <token>` header or `accessToken` httpOnly cookie. The middleware injects `x-user-id`, `x-user-role`, and `x-user-email` headers for downstream API routes.

**Content-Type:** All request and response bodies are `application/json` unless otherwise noted.

---

## Table of Contents

1. [Auth](#1-auth)
2. [Patient](#2-patient)
3. [Physician](#3-physician)
4. [Admin](#4-admin)
5. [Stripe / Billing](#5-stripe--billing)
6. [Webhooks](#6-webhooks)
7. [Health](#7-health)
8. [Public](#8-public)

---

## 1. Auth

### POST /api/auth/login

Authenticate a user and receive JWT tokens.

**Auth:** None required
**Rate Limit:** 30 requests per 60 seconds per IP; account lockout after 5 failed attempts (15-minute lock)

**Request Body:**
- `email` (string, required) -- valid email address
- `password` (string, required) -- minimum 1 character
- `secretKey` (string, optional) -- required for physician first login (INVITED status)

**Response (200):**
```json
{
  "user": { "id": "uuid", "email": "string", "role": "PATIENT|PHYSICIAN|ADMIN" },
  "accessToken": "jwt-string",
  "refreshToken": "jwt-string",
  "expiresIn": 900,
  "redirectUrl": "/patient/dashboard | /physician/queue | /admin/dashboard"
}
```

**Cookies Set:**
- `accessToken` (httpOnly, secure, strict, 15 min)
- `refreshToken` (httpOnly, secure, strict, 7 days)

**Errors:**
- `400 VALIDATION_ERROR` -- invalid email/password format
- `401 INVALID_CREDENTIALS` -- wrong email or password (generic to prevent enumeration)
- `401 SECRET_KEY_REQUIRED` -- physician INVITED status, secretKey not provided
- `401 INVALID_SECRET_KEY` -- wrong secret key for physician
- `403 ACCOUNT_LOCKED` -- too many failed attempts
- `403 PHYSICIAN_PENDING` -- physician not yet authorized
- `403 PHYSICIAN_INACTIVE` -- physician suspended
- `403 EMAIL_NOT_VERIFIED` -- email not verified (when REQUIRE_EMAIL_VERIFICATION=true)
- `429 RATE_LIMITED` -- IP rate limit exceeded
- `500 INTERNAL_ERROR` -- server error

---

### POST /api/auth/register

Register a new patient account.

**Auth:** None required
**Rate Limit:** Planned (5 requests per 15 min)

**Request Body:**
- `email` (string, required) -- valid email address
- `password` (string, required) -- minimum 8 characters
- `confirmPassword` (string, required) -- must match password
- `termsAccepted` (boolean, required) -- must be true

**Response (201):**
```json
{
  "user": { "id": "uuid", "email": "string", "role": "PATIENT" },
  "accessToken": "jwt-string",
  "refreshToken": "jwt-string",
  "expiresIn": 900
}
```

**Cookies Set:** `accessToken`, `refreshToken` (same as login)

**Errors:**
- `400 VALIDATION_ERROR` -- field validation failures
- `400 WEAK_PASSWORD` -- password does not meet strength requirements (uppercase, lowercase, number, special char)
- `409 REGISTRATION_ERROR` -- email already exists (generic message to prevent enumeration)
- `500 INTERNAL_ERROR` -- server error

---

### POST /api/auth/logout

Logout current session, clear cookies.

**Auth:** Optional (extracts userId from token for audit)

**Request Body:** None

**Response:** Redirects to `/login` (302)

**Cookies Cleared:** `accessToken`, `refreshToken`

---

### DELETE /api/auth/logout

Logout from all devices by incrementing token version.

**Auth:** Required (any role)

**Request Body:** None

**Response (200):**
```json
{ "success": true, "message": "Logged out from all devices" }
```

**Errors:**
- `401 UNAUTHORIZED` -- no valid token
- `500 LOGOUT_FAILED` -- server error

---

### POST /api/auth/refresh

Refresh access token using a refresh token.

**Auth:** None (uses refresh token)
**Rate Limit:** Planned (10 requests per 1 min)

**Request Body:**
- `refreshToken` (string, optional) -- falls back to `refreshToken` cookie if not provided

**Response (200):**
```json
{
  "accessToken": "jwt-string",
  "refreshToken": "jwt-string",
  "expiresIn": 900
}
```

**Cookies Set:** `accessToken`, `refreshToken` (updated)

**Errors:**
- `400 VALIDATION_ERROR` -- no refresh token provided
- `401 INVALID_TOKEN` -- expired or invalid refresh token
- `401 SESSION_INVALIDATED` -- token version mismatch (all sessions revoked)
- `401 USER_NOT_FOUND` -- user no longer exists
- `500 INTERNAL_ERROR` -- server error

---

### GET /api/auth/me

Get the current authenticated user's basic info from the access token cookie.

**Auth:** Required (accessToken cookie)

**Response (200):**
```json
{
  "user": { "id": "uuid", "email": "string", "role": "PATIENT|PHYSICIAN|ADMIN" }
}
```

**Errors:**
- `401 UNAUTHORIZED` -- no token or invalid/expired token

---

### POST /api/auth/forgot-password

Request a password reset email. Always returns success to prevent enumeration.

**Auth:** None
**Rate Limit:** Planned (3 requests per 1 hour)

**Request Body:**
- `email` (string, required) -- valid email address

**Response (200):**
```json
{
  "success": true,
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

**Errors:**
- `400 VALIDATION_ERROR` -- invalid email format

---

### POST /api/auth/reset-password

Complete a password reset using the emailed token.

**Auth:** None
**Rate Limit:** Planned (5 requests per 1 hour)

**Request Body:**
- `token` (string, required) -- password reset token from email
- `password` (string, required) -- minimum 8 characters, strength requirements apply
- `confirmPassword` (string, required) -- must match password

**Response (200):**
```json
{
  "success": true,
  "message": "Password has been reset successfully. Please log in with your new password."
}
```

**Errors:**
- `400 VALIDATION_ERROR` -- field validation failures
- `400 WEAK_PASSWORD` -- password does not meet strength requirements
- `400 INVALID_TOKEN` -- invalid or expired reset token
- `500 INTERNAL_ERROR` -- server error

---

### POST /api/auth/physician/verify-key

Verify a physician's secret key for first-time setup.

**Auth:** None
**Rate Limit:** 5 attempts per hour per IP+email combination

**Request Body:**
- `email` (string, required) -- physician's email
- `secretKey` (string, required) -- secret key from invitation email

**Response (200):**
```json
{
  "valid": true,
  "message": "Key valid. Proceed to set password.",
  "physicianId": "uuid"
}
```

**Errors:**
- `400` -- invalid request data
- `401` -- invalid or expired key, user not found (generic `Invalid or expired key`)
- `401 KEY_EXPIRED` -- key has expired
- `403 ALREADY_ACTIVE` -- physician already activated
- `429` -- rate limit exceeded
- `500 INTERNAL_ERROR` -- server error

---

## 2. Patient

All patient endpoints require `PATIENT` role unless otherwise noted.

### GET /api/patient/profile

Retrieve the authenticated patient's profile with decrypted PHI.

**Auth:** PATIENT role

**Response (200):**
```json
{
  "profile": {
    "id": "uuid",
    "email": "string",
    "firstName": "string",
    "lastName": "string",
    "dateOfBirth": "string",
    "phone": "string",
    "addressStreet": "string",
    "addressCity": "string",
    "addressState": "CA",
    "addressZip": "string",
    "primaryConcern": "ALCOHOL|null",
    "treatmentGoal": "QUIT|REDUCE|EXPLORE|null",
    "notificationPreferences": {},
    "privacyConsent": { "given": true, "date": "ISO", "version": "1.0" },
    "termsAccepted": { "accepted": true, "date": "ISO" },
    "createdAt": "ISO",
    "updatedAt": "ISO"
  }
}
```

**Errors:**
- `401` / `403` -- unauthorized or wrong role
- `404 NOT_FOUND` -- profile not found
- `500 INTERNAL_ERROR`

---

### PUT /api/patient/profile

Update the authenticated patient's profile fields.

**Auth:** PATIENT role

**Request Body (all optional):**
- `firstName` (string)
- `lastName` (string)
- `phone` (string)
- `addressStreet` (string)
- `addressCity` (string)
- `addressZip` (string)
- `notificationPreferences` (object)

**Response (200):**
```json
{
  "success": true,
  "profile": { "id": "uuid", "updatedAt": "ISO" }
}
```

**Errors:**
- `400 VALIDATION_ERROR` -- invalid data
- `401` / `403` -- unauthorized
- `500 INTERNAL_ERROR`

---

### GET /api/patient/profile/[id]

Get a specific patient profile by profile ID.

**Auth:** PATIENT (own profile only), PHYSICIAN or ADMIN (any profile)

**Response (200):**
```json
{ "success": true, "profile": { ... } }
```

**Errors:**
- `403` -- unauthorized access
- `404` -- profile not found
- `500` -- server error

---

### PUT /api/patient/profile/[id]

Update a specific patient profile. Only the owning patient can update.

**Auth:** PATIENT (own profile only)

**Request Body (all optional):**
- `phone`, `addressStreet`, `addressCity`, `addressZip` (string)
- `billingSameAsHome` (boolean)
- `billingStreet`, `billingCity`, `billingState`, `billingZip` (string, nullable)
- `medicalHistory`, `currentMedications`, `allergies` (object)
- `insuranceProvider`, `insuranceMemberId`, `insuranceGroupNumber` (string, nullable)

**Response (200):**
```json
{ "success": true, "message": "Profile updated successfully", "profile": { ... } }
```

**Errors:**
- `400` -- validation failed or invalid JSON
- `403` -- not authorized (physicians/admins cannot use this endpoint)
- `404` -- profile not found
- `500` -- server error

---

### POST /api/patient/profile/password

Change the authenticated patient's password.

**Auth:** PATIENT role

**Request Body:**
- `currentPassword` (string, required)
- `newPassword` (string, required) -- min 8, max 128, must contain uppercase, lowercase, number, special char
- `confirmPassword` (string, required) -- must match newPassword

**Response (200):**
```json
{
  "success": true,
  "message": "Password changed successfully. Please log in again with your new password.",
  "requireReLogin": true
}
```

**Errors:**
- `400 VALIDATION_ERROR` -- field validation failures
- `400 SAME_PASSWORD` -- new password same as current
- `401 UNAUTHORIZED` -- not authenticated
- `401 INVALID_PASSWORD` -- current password incorrect
- `404 NOT_FOUND` -- user not found
- `500 INTERNAL_ERROR`

---

### GET /api/patient/profile/preferences

Get the patient's notification and privacy preferences.

**Auth:** PATIENT role

**Response (200):**
```json
{
  "success": true,
  "preferences": {
    "emailNotifications": true,
    "smsNotifications": false,
    "marketingEmails": false,
    "appointmentReminders": true,
    "prescriptionAlerts": true,
    "messageAlerts": true,
    "profileVisibility": "PROVIDERS_ONLY",
    "shareDataForResearch": false
  }
}
```

**Errors:**
- `401 UNAUTHORIZED`
- `404 NOT_FOUND` -- profile not found
- `500 INTERNAL_ERROR`

---

### PUT /api/patient/profile/preferences

Update notification and privacy preferences.

**Auth:** PATIENT role

**Request Body (all optional with defaults):**
- `emailNotifications` (boolean, default true)
- `smsNotifications` (boolean, default false)
- `marketingEmails` (boolean, default false)
- `appointmentReminders` (boolean, default true)
- `prescriptionAlerts` (boolean, default true)
- `messageAlerts` (boolean, default true)
- `profileVisibility` ("PRIVATE" | "PROVIDERS_ONLY", default "PROVIDERS_ONLY")
- `shareDataForResearch` (boolean, default false)

**Response (200):**
```json
{ "success": true, "message": "Preferences updated successfully", "preferences": { ... } }
```

**Errors:**
- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `404 NOT_FOUND`
- `500 INTERNAL_ERROR`

---

### POST /api/patient/intake

Create a new intake draft.

**Auth:** PATIENT role

**Request Body:**
- `primaryConcern` (string, required)
- `formData` (object, optional) -- partial intake form data

**Response (201):**
```json
{
  "success": true,
  "intake": { "id": "uuid", "status": "DRAFT", "createdAt": "ISO" }
}
```

**Errors:**
- `400 VALIDATION_ERROR`
- `409 ACTIVE_INTAKE_EXISTS` -- patient already has a DRAFT, SUBMITTED, or UNDER_REVIEW intake
- `500 INTERNAL_ERROR`

---

### GET /api/patient/intake/[id]

Retrieve an intake draft/submission by ID.

**Auth:** PATIENT role (must own the intake)

**Response (200):**
```json
{
  "intake": {
    "id": "uuid",
    "status": "DRAFT|SUBMITTED|UNDER_REVIEW|APPROVED|REJECTED|NEEDS_INFO",
    "formData": {},
    "paymentStatus": "PENDING|COMPLETED",
    "riskScore": 0,
    "complexityScore": 0,
    "createdAt": "ISO",
    "updatedAt": "ISO",
    "submittedAt": "ISO|null"
  }
}
```

**Errors:**
- `400 INVALID_ID` -- invalid UUID format
- `403 ACCESS_DENIED` -- patient does not own this intake
- `404 NOT_FOUND`
- `500 INTERNAL_ERROR`

---

### PATCH /api/patient/intake/[id]

Update an intake draft (auto-save).

**Auth:** PATIENT role (must own, must be DRAFT status)

**Request Body:**
- `formData` (object, required) -- updated form data
- `isDraft` (boolean, optional) -- indicates if this is a draft save

**Response (200):**
```json
{
  "success": true,
  "intake": { "id": "uuid", "status": "DRAFT", "updatedAt": "ISO" }
}
```

**Errors:**
- `400 VALIDATION_ERROR` / `INVALID_ID`
- `403 ACCESS_DENIED`
- `404 NOT_FOUND`
- `409 INTAKE_ALREADY_SUBMITTED` -- cannot update non-DRAFT intake
- `500 INTERNAL_ERROR`

---

### POST /api/patient/intake/[id]/submit

Submit a completed intake for physician review. Calculates risk and complexity scores.

**Auth:** PATIENT role (must own, must be DRAFT status)

**Request Body:**
- `formData` (object, required) -- complete intake form data including personal info, medical history, consents

**Response (200):**
```json
{
  "success": true,
  "intake": {
    "id": "uuid",
    "status": "SUBMITTED",
    "submittedAt": "ISO",
    "riskScore": 5,
    "complexityScore": 3
  }
}
```

**Errors:**
- `400 VALIDATION_ERROR` / `INVALID_ID`
- `402 PAYMENT_REQUIRED` -- payment not completed (production only)
- `403 ACCESS_DENIED`
- `404 NOT_FOUND`
- `409 INTAKE_ALREADY_SUBMITTED`
- `500 INTERNAL_ERROR`

---

### GET /api/patient/messages

List message threads or get messages in a specific thread.

**Auth:** PATIENT role

**Query Parameters:**
- `threadId` (string, optional) -- if provided, returns messages in that thread
- `limit` (number, optional)
- `offset` (number, optional)

**Response (200) -- thread list:**
```json
{ "threads": [...], "limit": 20, "offset": 0 }
```

**Response (200) -- single thread:**
```json
{ "thread": { ... } }
```

**Errors:**
- `400 VALIDATION_ERROR`
- `403 ACCESS_DENIED` -- thread does not belong to patient
- `404 NOT_FOUND`
- `500 INTERNAL_ERROR`

---

### POST /api/patient/messages

Send a message in an existing thread.

**Auth:** PATIENT role

**Request Body:**
- `threadId` (string, required)
- `body` (string, required) -- message content
- `subject` (string, optional)

**Response (201):**
```json
{
  "success": true,
  "message": { "id": "uuid", "threadId": "string", "body": "string", "sentAt": "ISO" }
}
```

**Errors:**
- `400 VALIDATION_ERROR` / `INVALID_THREAD`
- `403 ACCESS_DENIED`
- `500 INTERNAL_ERROR`

---

### GET /api/patient/messages/[id]

Get full message thread by thread ID. Marks unread messages as read.

**Auth:** PATIENT role (must own thread)

**Response (200):**
```json
{ "thread": { ... } }
```

**Errors:**
- `403` -- access denied
- `404` -- thread not found
- `500`

---

### GET /api/patient/prescriptions

List all prescriptions for the authenticated patient.

**Auth:** PATIENT role

**Response (200):**
```json
{ "prescriptions": [...] }
```

**Errors:**
- `401` / `403`
- `500 INTERNAL_ERROR`

---

### GET /api/patient/prescriptions/[id]

Get detailed information about a specific prescription, including recent refill requests.

**Auth:** PATIENT role

**Response (200):**
```json
{
  "prescription": {
    "id": "uuid",
    "medicationName": "string",
    "dosage": "string",
    "quantity": 30,
    "refills": 3,
    "status": "PENDING|SENT|FILLED|...",
    "lastRefillDate": "ISO|null",
    "nextRefillAvailable": "ISO|null",
    "sentAt": "ISO|null",
    "createdAt": "ISO"
  },
  "recentRefillRequests": [...]
}
```

**Errors:**
- `404` -- prescription not found
- `500 INTERNAL_ERROR`

---

### POST /api/patient/prescriptions/[id]/refill

Request a prescription refill.

**Auth:** PATIENT role (must own prescription)

**Request Body:** None

**Response (200):**
```json
{
  "success": true,
  "refillRequest": { ... },
  "message": "Refill request submitted successfully"
}
```

**Errors:**
- `400 INVALID_ID` / `REFILL_FAILED` -- refill not eligible (e.g., too early, no refills remaining)
- `404 NOT_FOUND`
- `500 INTERNAL_ERROR`

---

### GET /api/patient/documents

List the patient's uploaded documents.

**Auth:** PATIENT role

**Query Parameters:**
- `type` (string, optional) -- filter by document type

**Response (200):**
```json
{ "documents": [...] }
```

---

### POST /api/patient/documents

Generate a presigned S3 upload URL for a new document.

**Auth:** PATIENT role

**Request Body:**
- `fileName` (string, required)
- `fileType` (string, required) -- MIME type
- `documentType` (string, required) -- "ID_VERIFICATION" | "INSURANCE_CARD" | "MEDICAL_RECORD" | "CONSENT_FORM" | "OTHER"
- `fileSize` (number, required) -- in bytes

**Response (200):**
```json
{
  "success": true,
  "uploadUrl": "https://s3.amazonaws.com/...",
  "key": "documents/...",
  "expiresAt": "ISO"
}
```

**Errors:**
- `400 VALIDATION_ERROR`
- `500 INTERNAL_ERROR`

---

### POST /api/patient/documents/upload-url

Alternative endpoint to generate presigned upload URL.

**Auth:** Required (via middleware x-user-id header)

**Request Body:**
- `fileName` (string, required)
- `contentType` (string, required) -- MIME type
- `documentType` (enum, required) -- ID_VERIFICATION | INSURANCE_CARD | MEDICAL_RECORD | CONSENT_FORM | OTHER
- `fileSize` (number, required, positive)

**Response (200):**
```json
{
  "uploadUrl": "string",
  "key": "string",
  "expiresAt": "ISO"
}
```

**Errors:**
- `400` -- validation failed, file type not allowed, file too large
- `401` -- not authenticated
- `404` -- patient profile not found
- `500`

---

### POST /api/patient/documents/confirm

Confirm an S3 upload and create a database record.

**Auth:** Required (via middleware x-user-id header)

**Request Body:**
- `key` (string, required) -- S3 key from upload-url response
- `documentType` (enum, required) -- ID_VERIFICATION | INSURANCE_CARD | MEDICAL_RECORD | CONSENT_FORM | OTHER

**Response (201):**
```json
{
  "success": true,
  "document": { "id": "uuid", "documentType": "string", "fileName": "string", ... },
  "message": "Document uploaded successfully"
}
```

**Errors:**
- `400` -- validation failed
- `401` -- not authenticated
- `404` -- patient profile or S3 file not found
- `500`

---

### GET /api/patient/documents/[id]

Get details of a specific document.

**Auth:** Required (via middleware x-user-id header, must own document)

**Response (200):**
```json
{ "document": { "id": "uuid", "documentType": "string", "fileName": "string", ... } }
```

**Errors:**
- `401` -- not authenticated
- `404` -- document or profile not found
- `500`

---

### DELETE /api/patient/documents/[id]

Soft-delete a document (marks as DELETED, removes from S3).

**Auth:** Required (via middleware x-user-id header, must own document)

**Response (200):**
```json
{ "success": true, "message": "Document deleted successfully" }
```

**Errors:**
- `401` -- not authenticated
- `404` -- document not found
- `500`

---

### GET /api/patient/documents/[id]/download

Generate a presigned download URL for a document (5-minute expiry).

**Auth:** Required (via middleware x-user-id header, must own document)

**Response (200):**
```json
{
  "downloadUrl": "https://s3.amazonaws.com/...",
  "fileName": "string",
  "mimeType": "string",
  "expiresAt": "ISO"
}
```

**Errors:**
- `401` -- not authenticated
- `404` -- document or profile not found
- `500`

---

### GET /api/patient/billing

Get subscription details and billing summary.

**Auth:** PATIENT role

**Response (200):**
```json
{
  "subscription": {
    "id": "uuid",
    "planType": "ACTIVE_TREATMENT|MAINTENANCE",
    "status": "ACTIVE|PAST_DUE|CANCELLED|...",
    "amount": 5000,
    "currentPeriodStart": "ISO",
    "currentPeriodEnd": "ISO",
    "cancelAtPeriodEnd": false,
    "paymentMethod": { "brand": "visa", "last4": "4242", "expMonth": 12, "expYear": 2027 }
  },
  "summary": { "totalPaid": 15000, "nextBillingDate": "ISO|null" }
}
```

Returns `subscription: null` if no subscription exists.

**Errors:**
- `401` -- unauthorized
- `403` -- not patient role
- `500`

---

### GET /api/patient/billing/invoices

List invoices for the authenticated patient (newest first).

**Auth:** PATIENT role

**Response (200):**
```json
{
  "invoices": [
    {
      "id": "uuid",
      "amount": 5000,
      "status": "PAID|PENDING|FAILED",
      "stripeInvoiceId": "string",
      "pdfUrl": "string|null",
      "createdAt": "ISO",
      "paidAt": "ISO|null"
    }
  ]
}
```

**Errors:**
- `401` / `403`
- `500`

---

### GET /api/patient/billing/invoices/[id]/download

Get a download URL for an invoice PDF.

**Auth:** PATIENT role (must own invoice)

**Response (200):**
```json
{
  "downloadUrl": "https://...",
  "filename": "INV-202603-ABC123.pdf",
  "expiresAt": "ISO"
}
```

**Errors:**
- `401` / `403` -- unauthorized or not own invoice
- `404` -- invoice not found or PDF not available
- `500`

---

### POST /api/patient/billing/portal

Create a Stripe Customer Portal session for payment method management.

**Auth:** PATIENT role

**Request Body:** None

**Response (200):**
```json
{ "portalUrl": "https://billing.stripe.com/...", "expiresAt": "ISO" }
```

**Errors:**
- `401` / `403`
- `404` -- no subscription found
- `500`

---

### POST /api/patient/billing/cancel

Cancel the patient's subscription at period end.

**Auth:** PATIENT role

**Request Body (optional):**
- `reason` (string, optional)
- `feedback` (string, optional)

**Response (200):**
```json
{
  "success": true,
  "message": "Your subscription has been scheduled for cancellation.",
  "periodEnd": "ISO",
  "cancelAtPeriodEnd": true
}
```

**Errors:**
- `400` -- subscription already set to cancel or invalid body
- `401` / `403`
- `404` -- no active subscription found
- `500`

---

### POST /api/patient/onboarding/start

Store checkout data temporarily in Redis during the payment process.

**Auth:** Required (any authenticated user, typically PATIENT)

**Request Body:**
- `firstName` (string, required)
- `lastName` (string, required)
- `dateOfBirth` (string, required) -- MM/DD/YYYY format
- `phone` (string, required) -- valid phone number
- `addressStreet` (string, required)
- `addressCity` (string, required)
- `addressState` (literal "CA", required)
- `addressZip` (string, required) -- valid ZIP code
- `billingSameAsHome` (boolean, required)
- `billingStreet`, `billingCity`, `billingState`, `billingZip` (string, optional)
- `primaryConcern` (literal "ALCOHOL", required)
- `treatmentGoal` ("QUIT" | "REDUCE" | "EXPLORE", required)
- `privacyConsentGiven` (literal true, required)
- `termsAccepted` (literal true, required)

**Response (200):**
```json
{ "success": true, "message": "Checkout data stored successfully", "redirectUrl": "/checkout/payment" }
```

**Errors:**
- `400` -- validation failed
- `401` -- not authenticated
- `500`

---

### POST /api/patient/onboarding/complete

Mark onboarding as complete after intake form submission.

**Auth:** Required (any authenticated user)

**Request Body:** None

**Response (200):**
```json
{ "success": true, "message": "Onboarding completed successfully", "redirectUrl": "/dashboard" }
```

**Errors:**
- `401` -- not authenticated
- `404` -- patient profile not found
- `500`

---

## 3. Physician

All physician endpoints require `PHYSICIAN` or `ADMIN` role unless otherwise noted.

### GET /api/physician/profile

Get the authenticated physician's profile.

**Auth:** PHYSICIAN or ADMIN

**Response (200):**
```json
{
  "success": true,
  "physician": {
    "id": "uuid",
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "npiNumber": "string",
    "licenseNumber": "string",
    "licenseState": "CA",
    "deaNumber": "string",
    "specialty": "string",
    "status": "ACTIVE|INVITED|PENDING|INACTIVE",
    "totalReviews": 0,
    "createdAt": "ISO"
  }
}
```

**Errors:**
- `401` / `403`
- `404 NOT_FOUND`
- `500 INTERNAL_ERROR`

---

### GET /api/physician/dashboard

Get dashboard statistics: pending reviews, completed today, unread messages, recent activity.

**Auth:** PHYSICIAN or ADMIN

**Response (200):**
```json
{
  "success": true,
  "data": {
    "pendingReviews": 5,
    "completedToday": 3,
    "unreadMessages": 2,
    "assignedToday": 4,
    "totalPatients": 45,
    "recentActivity": [
      { "id": "uuid", "type": "REVIEW|MESSAGE|NOTE", "description": "string", "timestamp": "ISO" }
    ]
  }
}
```

**Errors:**
- `401` / `403`
- `500 INTERNAL_ERROR`

---

### GET /api/physician/queue

Get pending intake review queue with filtering and sorting.

**Auth:** PHYSICIAN or ADMIN

**Query Parameters:**
- `status` (string, optional) -- filter by intake status
- `concernType` (string, optional) -- ALCOHOL
- `sortBy` (string, optional) -- field to sort by
- `sortOrder` (string, optional) -- asc/desc

**Response (200):**
```json
{
  "queue": [...],
  "stats": { ... },
  "filters": { "status": "...", "concernType": "...", "sortBy": "...", "sortOrder": "..." }
}
```

**Errors:**
- `400 VALIDATION_ERROR`
- `401` / `403`
- `500 INTERNAL_ERROR`

---

### GET /api/physician/stats

Get physician performance statistics for a time period.

**Auth:** PHYSICIAN or ADMIN

**Query Parameters:**
- `period` ("today" | "week" | "month", optional, default "today")

**Response (200):**
```json
{
  "period": "today",
  "queue": { "pendingIntakes": 5, "overdueIntakes": 1, "averageWaitHours": 4.2 },
  "reviews": { "completed": 3, "averageTimeMinutes": 12, "approvalRate": 85 },
  "prescriptions": { "sent": 2, "pendingRefills": 1 },
  "patients": { "new": 3 },
  "messages": { "unread": 2 }
}
```

**Errors:**
- `400 VALIDATION_ERROR`
- `401` / `403`
- `500 INTERNAL_ERROR`

---

### GET /api/physician/intake/[id]

Get intake details for physician review. Automatically sets status to UNDER_REVIEW if SUBMITTED.

**Auth:** PHYSICIAN or ADMIN

**Response (200):**
```json
{
  "intake": {
    "id": "uuid",
    "status": "UNDER_REVIEW",
    "formData": { ... },
    "patient": {
      "firstName": "string",
      "lastName": "string",
      "dateOfBirth": "string",
      "phone": "string",
      "email": "string",
      "address": { ... },
      "primaryConcern": "ALCOHOL",
      "treatmentGoal": "QUIT"
    },
    "medicalHistory": { ... },
    "riskScore": 5,
    "complexityScore": 3,
    "submittedAt": "ISO",
    "createdAt": "ISO"
  }
}
```

**Errors:**
- `400 INVALID_ID`
- `404 NOT_FOUND`
- `409 INTAKE_NOT_AVAILABLE` -- intake not in SUBMITTED or UNDER_REVIEW status
- `500 INTERNAL_ERROR`

---

### POST /api/physician/review

Submit an intake review decision. Creates prescription if approved.

**Auth:** PHYSICIAN or ADMIN

**Request Body:**
- `intakeId` (string, required) -- UUID of the intake
- `decision` ("APPROVED" | "DECLINED" | "NEEDS_INFO", required)
- `notes` (string, optional) -- clinical notes
- `prescriptionDetails` (object, optional, required if APPROVED):
  - `medicationName` (string)
  - `genericName` (string)
  - `dosage` (string)
  - `quantity` (number)
  - `refills` (number)
  - `instructions` (string)
- `rejectionReason` (string, optional) -- if DECLINED
- `alternativeRecommendation` (string, optional) -- if DECLINED

**Response (200):**
```json
{
  "success": true,
  "review": {
    "id": "uuid",
    "intakeId": "uuid",
    "decision": "APPROVED",
    "completedAt": "ISO"
  },
  "prescription": { "id": "uuid", "medicationName": "string", "status": "PENDING" }
}
```

**Errors:**
- `400 VALIDATION_ERROR`
- `404 NOT_FOUND` -- intake not found
- `409 INTAKE_NOT_AVAILABLE` -- intake not in reviewable status
- `500 INTERNAL_ERROR`

---

### GET /api/physician/patients

List all patients with pagination and search. Returns decrypted PHI.

**Auth:** PHYSICIAN or ADMIN

**Query Parameters:**
- `search` (string, optional) -- search by name or email
- `limit` (number, optional, default 20)
- `offset` (number, optional, default 0)

**Response (200):**
```json
{
  "patients": [
    {
      "id": "uuid",
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "dateOfBirth": "string",
      "primaryConcern": "ALCOHOL",
      "treatmentGoal": "QUIT",
      "createdAt": "ISO"
    }
  ],
  "pagination": { "total": 100, "limit": 20, "offset": 0, "hasMore": true }
}
```

**Errors:**
- `400 VALIDATION_ERROR`
- `401` / `403`
- `500 INTERNAL_ERROR`

---

### GET /api/physician/patients/[id]

Get comprehensive patient record including profile, intakes, prescriptions, documents, notes, and messages (all decrypted).

**Auth:** PHYSICIAN or ADMIN

**Response (200):**
```json
{
  "patient": {
    "id": "uuid",
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "dateOfBirth": "string",
    "phone": "string",
    "address": { ... },
    "medicalHistory": { ... },
    "currentMedications": { ... },
    "intakes": [...],
    "prescriptions": [...],
    "documents": [...],
    "notes": [...],
    "messages": [...],
    "createdAt": "ISO"
  }
}
```

**Errors:**
- `400 INVALID_ID`
- `404 NOT_FOUND` -- patient or physician profile not found
- `500 INTERNAL_ERROR`

---

### GET /api/physician/patients/[id]/history

Get comprehensive patient history as a timeline of events.

**Auth:** PHYSICIAN or ADMIN (via Bearer token)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "patientId": "uuid",
    "totalEvents": 15,
    "events": [
      { "type": "intake|prescription|message|note|review|refill", "date": "ISO", "title": "string", "description": "string", "metadata": {} }
    ],
    "summary": { "intakes": 2, "prescriptions": 1, "messages": 5, "notes": 3, "reviews": 2, "refills": 0 }
  }
}
```

**Errors:**
- `403` -- not authorized
- `500`

---

### GET /api/physician/patients/[id]/notes

List clinical notes for a patient.

**Auth:** PHYSICIAN or ADMIN

**Response (200):**
```json
{
  "success": true,
  "notes": [
    {
      "id": "uuid",
      "patientId": "uuid",
      "physicianId": "uuid",
      "content": "decrypted string",
      "physician": { "firstName": "string", "lastName": "string" },
      "createdAt": "ISO",
      "updatedAt": "ISO"
    }
  ]
}
```

**Errors:**
- `400 INVALID_ID`
- `404 NOT_FOUND` -- patient not found
- `500 INTERNAL_ERROR`

---

### POST /api/physician/patients/[id]/notes

Create a clinical note for a patient.

**Auth:** PHYSICIAN or ADMIN

**Request Body:**
- `content` (string, required, max 10000 chars)
- `type` ("CLINICAL" | "ADMINISTRATIVE", optional, default "CLINICAL")

**Response (201):**
```json
{
  "success": true,
  "note": {
    "id": "uuid",
    "patientId": "uuid",
    "physicianId": "uuid",
    "content": "string",
    "type": "CLINICAL",
    "createdAt": "ISO",
    "physician": { "firstName": "string", "lastName": "string" }
  },
  "message": "Note created successfully"
}
```

**Errors:**
- `400 VALIDATION_ERROR` / `INVALID_ID`
- `404 NOT_FOUND` -- patient or physician not found
- `500 INTERNAL_ERROR`

---

### PUT /api/physician/patients/[id]/notes/[noteId]

Update an existing clinical note. Physicians can only edit their own notes.

**Auth:** PHYSICIAN or ADMIN (via Bearer token)

**Request Body:**
- `content` (string, required, max 10000 chars)

**Response (200):**
```json
{ "success": true, "data": { ... }, "message": "Clinical note updated successfully" }
```

**Errors:**
- `400` -- validation failed
- `403` -- not authorized
- `404` -- note not found or no permission
- `500`

---

### DELETE /api/physician/patients/[id]/notes/[noteId]

Delete a clinical note. Physicians can only delete their own notes.

**Auth:** PHYSICIAN or ADMIN (via Bearer token)

**Response (200):**
```json
{ "success": true, "message": "Clinical note deleted successfully" }
```

**Errors:**
- `403` -- not authorized
- `404` -- note not found or no permission
- `500`

---

### GET /api/physician/messages

List message threads or get messages in a specific thread.

**Auth:** PHYSICIAN or ADMIN

**Query Parameters:**
- `threadId` (string, optional) -- get messages in thread
- `patientId` (string, optional) -- filter by patient
- `limit` (number, optional)
- `offset` (number, optional)

**Response (200) -- thread list:**
```json
{
  "threads": [
    {
      "threadId": "string",
      "patientId": "uuid",
      "patientName": "string",
      "lastMessage": { "body": "string", "sentAt": "ISO", "senderType": "PATIENT|PHYSICIAN" },
      "unreadCount": 2,
      "totalMessages": 10
    }
  ]
}
```

**Response (200) -- single thread:**
```json
{
  "messages": [
    { "id": "uuid", "threadId": "string", "body": "string", "senderType": "PATIENT|PHYSICIAN", "senderName": "string", "sentAt": "ISO", "readAt": "ISO|null" }
  ],
  "threadId": "string"
}
```

---

### POST /api/physician/messages

Send a message to a patient.

**Auth:** PHYSICIAN or ADMIN

**Request Body:**
- `patientId` (string, required)
- `threadId` (string, required)
- `body` (string, required)
- `subject` (string, optional)

**Response (201):**
```json
{
  "success": true,
  "message": { "id": "uuid", "threadId": "string", "body": "string", "sentAt": "ISO" }
}
```

**Errors:**
- `400 VALIDATION_ERROR`
- `500 INTERNAL_ERROR`

---

### GET /api/physician/messages/[id]

Get full message thread by thread ID. Marks unread messages as read.

**Auth:** PHYSICIAN or ADMIN

**Response (200):**
```json
{ "thread": { ... } }
```

**Errors:**
- `403` -- access denied (physician not part of thread)
- `404` -- thread not found
- `500`

---

### POST /api/physician/messages/[id]/read

Mark all messages in a thread as read for the physician.

**Auth:** PHYSICIAN or ADMIN

**Response (200):**
```json
{ "success": true, "markedAsRead": 3 }
```

**Errors:**
- `500`

---

### POST /api/physician/messages/send

Alternative endpoint to send a reply message to a patient.

**Auth:** PHYSICIAN or ADMIN

**Request Body:**
- `threadId` (string, required, UUID)
- `patientId` (string, required, UUID)
- `body` (string, required, 1-2000 chars)
- `subject` (string, optional, max 200 chars)

**Response (201):**
```json
{
  "success": true,
  "message": {
    "id": "uuid",
    "threadId": "string",
    "body": "string",
    "senderType": "PHYSICIAN",
    "senderName": "Dr. Smith",
    "sentAt": "ISO"
  }
}
```

**Errors:**
- `400` -- validation failed
- `404` -- patient not found
- `500`

---

### POST /api/physician/prescriptions/send

Send a prescription to a pharmacy via DoseSpot.

**Auth:** PHYSICIAN role only

**Request Body:**
- `prescriptionId` (string, required)
- `pharmacyId` (string, optional)
- `pharmacyNcpdpId` (string, optional)

**Response (200):**
```json
{
  "success": true,
  "prescription": {
    "id": "uuid",
    "status": "SENT",
    "sentAt": "ISO",
    "pharmacyName": "string"
  },
  "_mock": true
}
```

**Errors:**
- `400 VALIDATION_ERROR`
- `404 NOT_FOUND`
- `409 PRESCRIPTION_NOT_SENDABLE` -- prescription not in PENDING status
- `500 INTERNAL_ERROR`

---

### GET /api/physician/prescriptions/[id]/status

Check prescription status from DoseSpot/Surescripts.

**Auth:** Permission `VIEW_PATIENT_DETAILS` (PHYSICIAN or ADMIN)

**Response (200):**
```json
{
  "success": true,
  "prescriptionId": "uuid",
  "status": "SENT|RECEIVED_BY_PHARMACY|FILLED|...",
  "surescriptsRxId": "string",
  "history": [...],
  "estimatedReadyTime": "ISO|null",
  "lastUpdated": "ISO"
}
```

**Errors:**
- `400 VALIDATION_ERROR` -- invalid prescription ID
- `404 NOT_FOUND`
- `502` -- DoseSpot status check failed (returns local status as fallback)
- `500 INTERNAL_ERROR`

---

### GET /api/physician/pharmacies/search

Search for pharmacies by ZIP code.

**Auth:** Permission `SEND_PRESCRIPTION` (PHYSICIAN)

**Query Parameters:**
- `zip` (string, required) -- 5-digit ZIP code
- `name` (string, optional) -- pharmacy name filter
- `radius` (number, optional, 1-50, default 10) -- miles
- `limit` (number, optional, 1-50, default 20)

**Response (200):**
```json
{
  "success": true,
  "pharmacies": [...],
  "totalCount": 15,
  "query": { "zip": "90210", "name": null, "radius": 10 }
}
```

**Errors:**
- `400 VALIDATION_ERROR`
- `502 SEARCH_ERROR` -- DoseSpot search failed
- `500 INTERNAL_ERROR`

---

## 4. Admin

All admin endpoints require `ADMIN` role.

### GET /api/admin/physicians

List physicians with filtering, search, and pagination.

**Auth:** ADMIN role

**Query Parameters:**
- `status` ("PENDING" | "INVITED" | "ACTIVE" | "INACTIVE" | "ALL", default "ALL")
- `search` (string, optional) -- search by name, NPI, license, email
- `page` (number, min 1, default 1)
- `limit` (number, 1-100, default 20)

**Response (200):**
```json
{
  "physicians": [
    {
      "id": "uuid",
      "userId": "uuid",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "npiNumber": "string",
      "licenseNumber": "string",
      "status": "PENDING|INVITED|ACTIVE|INACTIVE",
      "stats": { "reviewCount": 10, "noteCount": 5 },
      "createdAt": "ISO"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 50, "totalPages": 3, "hasNext": true, "hasPrev": false }
}
```

**Errors:**
- `400 VALIDATION_ERROR`
- `401` / `403`
- `500 INTERNAL_ERROR`

---

### GET /api/admin/physicians/[id]

Get detailed physician profile with recent reviews and authorization history.

**Auth:** ADMIN role

**Response (200):**
```json
{
  "physician": {
    "id": "uuid",
    "user": { "id": "uuid", "email": "string", "lastLoginAt": "ISO|null" },
    "credentials": { "npiNumber": "string", "licenseNumber": "string", "deaNumber": "string" },
    "profile": { "firstName": "string", "lastName": "string", "specialty": "string" },
    "status": { "current": "ACTIVE", "authorizedBy": "uuid", "authorizedAt": "ISO" },
    "stats": { "totalReviews": 50, "avgReviewTimeMin": 12 },
    "recentReviews": [...],
    "authorizationHistory": [
      { "id": "uuid", "action": "AUTHORIZED|SUSPENDED|REACTIVATED|REJECTED", "reason": "string", "createdAt": "ISO" }
    ]
  }
}
```

**Errors:**
- `404 NOT_FOUND`
- `500 INTERNAL_ERROR`

---

### POST /api/admin/physicians/[id]/authorize

Authorize a pending physician, generate and email a secret key.

**Auth:** ADMIN role

**Request Body:** None

**Response (200):**
```json
{
  "success": true,
  "secretKey": "generated-key-string",
  "physician": {
    "id": "uuid",
    "status": "INVITED",
    "authorizedAt": "ISO",
    "secretKeyExpiry": "ISO"
  },
  "message": "Physician authorized successfully. Secret key has been sent via email."
}
```

**Errors:**
- `400 INVALID_STATUS` -- physician not in PENDING status
- `404 NOT_FOUND`
- `500 INTERNAL_ERROR`

---

### POST /api/admin/physicians/[id]/suspend

Suspend an active or invited physician. Revokes all sessions.

**Auth:** ADMIN role

**Request Body:**
- `reason` (string, required, max 1000 chars)

**Response (200):**
```json
{
  "success": true,
  "physician": { "id": "uuid", "status": "INACTIVE", "isActive": false },
  "sessionsRevoked": 0,
  "message": "Physician suspended successfully. All sessions revoked."
}
```

**Errors:**
- `400 VALIDATION_ERROR` / `INVALID_STATUS` -- physician not ACTIVE or INVITED
- `404 NOT_FOUND`
- `500 INTERNAL_ERROR`

---

### POST /api/admin/physicians/[id]/reject

Reject a pending or invited physician application.

**Auth:** ADMIN role

**Request Body:**
- `reason` (string, required, max 1000 chars)

**Response (200):**
```json
{
  "success": true,
  "physician": { "id": "uuid", "status": "INACTIVE", "isActive": false },
  "message": "Physician rejected successfully."
}
```

**Errors:**
- `400 VALIDATION_ERROR` / `INVALID_STATUS` -- physician not PENDING or INVITED
- `404 NOT_FOUND`
- `500 INTERNAL_ERROR`

---

### POST /api/admin/physicians/[id]/reactivate

Reactivate a suspended (INACTIVE) physician.

**Auth:** ADMIN role

**Request Body:** None

**Response (200):**
```json
{
  "success": true,
  "physician": { "id": "uuid", "status": "ACTIVE", "isActive": true },
  "message": "Physician reactivated successfully."
}
```

**Errors:**
- `400 INVALID_STATUS` -- physician not in INACTIVE status
- `404 NOT_FOUND`
- `500 INTERNAL_ERROR`

---

### POST /api/admin/physicians/[id]/reset-key

Reset a physician's secret key. If physician was ACTIVE, sets back to INVITED.

**Auth:** ADMIN role

**Request Body:** None

**Response (200):**
```json
{
  "success": true,
  "secretKey": "new-generated-key-string",
  "physician": { "id": "uuid", "status": "INVITED|ACTIVE", "secretKeyExpiry": "ISO" },
  "message": "Secret key reset successfully. New key has been sent via email."
}
```

**Errors:**
- `400 INVALID_STATUS` -- physician not INVITED or ACTIVE
- `404 NOT_FOUND`
- `500 INTERNAL_ERROR`

---

## 5. Stripe / Billing

### POST /api/stripe/checkout-session

Create a Stripe Checkout session for subscription signup.

**Auth:** Required (any authenticated user)

**Request Body:**
- `planType` ("ACTIVE_TREATMENT", required) -- currently only active treatment
- `successUrl` (string, required, valid URL) -- redirect after success, use `{CHECKOUT_SESSION_ID}` placeholder
- `cancelUrl` (string, required, valid URL) -- redirect on cancel

**Response (200):**
```json
{ "sessionId": "cs_...", "url": "https://checkout.stripe.com/..." }
```

**Errors:**
- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `404 USER_NOT_FOUND`
- `500 CHECKOUT_ERROR`
- `503 STRIPE_NOT_CONFIGURED`

---

### GET /api/stripe/checkout-session

Retrieve a checkout session by ID (verify payment status after redirect).

**Auth:** None (public, but requires session ID)

**Query Parameters:**
- `sessionId` (string, required) -- Stripe checkout session ID

**Response (200):**
```json
{
  "sessionId": "cs_...",
  "status": "complete|open|expired",
  "paymentStatus": "paid|unpaid|no_payment_required",
  "subscriptionId": "sub_...",
  "customerId": "cus_...",
  "metadata": {}
}
```

**Errors:**
- `400 MISSING_SESSION_ID`
- `500 RETRIEVE_ERROR`
- `503 STRIPE_NOT_CONFIGURED`

---

### POST /api/stripe/subscription

Create a subscription directly (alternative to Checkout flow).

**Auth:** Required (any authenticated user)

**Request Body:**
- `planType` ("ACTIVE_TREATMENT" | "MAINTENANCE", required)
- `paymentMethodId` (string, optional)

**Response (201):**
```json
{
  "subscription": {
    "id": "uuid",
    "planType": "ACTIVE_TREATMENT",
    "status": "ACTIVE",
    "amount": 5000,
    "currentPeriodEnd": "ISO"
  },
  "stripeSubscriptionId": "sub_..."
}
```

**Errors:**
- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `404 USER_NOT_FOUND`
- `409 SUBSCRIPTION_EXISTS` -- already has active subscription
- `500 SUBSCRIPTION_ERROR`
- `503 STRIPE_NOT_CONFIGURED`

---

### GET /api/stripe/subscription

Get the user's subscription details including Stripe data.

**Auth:** Required (any authenticated user)

**Response (200):**
```json
{
  "subscriptions": [
    {
      "id": "uuid",
      "planType": "ACTIVE_TREATMENT",
      "status": "ACTIVE",
      "amount": 5000,
      "currentPeriodStart": "ISO",
      "currentPeriodEnd": "ISO",
      "cancelAtPeriodEnd": false
    }
  ],
  "hasActiveSubscription": true,
  "stripeDetails": { "cancelAtPeriodEnd": false, "defaultPaymentMethod": "pm_..." }
}
```

**Errors:**
- `401 UNAUTHORIZED`
- `500 FETCH_ERROR`
- `503 STRIPE_NOT_CONFIGURED`

---

### DELETE /api/stripe/subscription

Cancel the user's subscription.

**Auth:** Required (any authenticated user)

**Request Body (optional):**
- `immediate` (boolean, default false) -- true for immediate cancellation, false for end of period

**Response (200):**
```json
{
  "message": "Subscription will be cancelled at the end of the billing period",
  "subscription": { "id": "uuid", "status": "ACTIVE", "cancelAtPeriodEnd": true, "currentPeriodEnd": "ISO" }
}
```

**Errors:**
- `401 UNAUTHORIZED`
- `404 NO_SUBSCRIPTION`
- `500 CANCEL_ERROR`
- `503 STRIPE_NOT_CONFIGURED`

---

### PATCH /api/stripe/subscription

Update subscription (resume cancellation or change plan).

**Auth:** Required (any authenticated user)

**Request Body:**
- `action` ("resume" | "change_plan", required)
- `planType` ("ACTIVE_TREATMENT" | "MAINTENANCE", optional, required for change_plan)

**Response (200) -- resume:**
```json
{
  "message": "Subscription resumed successfully",
  "subscription": { "id": "uuid", "status": "ACTIVE", "cancelAtPeriodEnd": false }
}
```

**Errors:**
- `400 VALIDATION_ERROR` / `NOT_SCHEDULED` / `INVALID_ACTION`
- `401 UNAUTHORIZED`
- `404 NO_SUBSCRIPTION`
- `500 UPDATE_ERROR`
- `501 NOT_IMPLEMENTED` -- change_plan not yet implemented
- `503 STRIPE_NOT_CONFIGURED`

---

### POST /api/stripe/customer-portal

Create a Stripe Customer Portal session for self-service billing management.

**Auth:** Required (any authenticated user)

**Request Body:**
- `returnUrl` (string, required, valid URL)

**Response (200):**
```json
{ "url": "https://billing.stripe.com/session/..." }
```

**Errors:**
- `400 VALIDATION_ERROR`
- `401 UNAUTHORIZED`
- `404 USER_NOT_FOUND` / `NO_SUBSCRIPTION`
- `500 PORTAL_ERROR`
- `503 STRIPE_NOT_CONFIGURED`

---

## 6. Webhooks

### POST /api/webhooks/stripe

Handle Stripe webhook events. Verifies webhook signature using `STRIPE_WEBHOOK_SECRET`.

**Auth:** Stripe signature verification (not JWT)

**Headers:**
- `stripe-signature` (string, required) -- Stripe webhook signature

**Events Handled:**
- `checkout.session.completed` -- creates patient profile and subscription, sends welcome email
- `invoice.payment_succeeded` -- updates subscription to ACTIVE, records invoice
- `invoice.payment_failed` -- marks subscription as PAST_DUE, creates notification
- `customer.subscription.created` -- logged (main logic in checkout.session.completed)
- `customer.subscription.updated` -- updates subscription status, plan, period dates
- `customer.subscription.deleted` -- marks subscription as CANCELLED, creates notification

**Response (200):**
```json
{ "received": true }
```

**Errors:**
- `400` -- missing or invalid signature

---

### POST /api/webhooks/dosespot

Handle DoseSpot e-prescribing webhook events.

**Auth:** DoseSpot signature verification (placeholder)

**Request Body:**
- `eventType` ("PRESCRIPTION_SENT" | "PRESCRIPTION_FILLED" | other)
- `prescriptionId` (string)
- `status` (string)

**Events Handled:**
- `PRESCRIPTION_SENT` -- updates prescription status to SENT
- `PRESCRIPTION_FILLED` -- updates prescription status to FILLED with refill date

**Response (200):**
```json
{ "received": true }
```

**Errors:**
- `500` -- webhook processing failed

---

## 7. Health

### GET /api/health

Comprehensive health check returning database, cache, and performance status. Results cached for 5 seconds.

**Auth:** None (public)

**Response (200):**
```json
{
  "status": "healthy|degraded|unhealthy",
  "timestamp": "ISO",
  "version": "0.1.0",
  "services": {
    "database": { "status": "healthy|unhealthy", "latency": 5 },
    "cache": { "status": "healthy|unhealthy", "connected": true, "ready": true }
  },
  "performance": { "recentP95": 150, "errorRate": 0.01, "activeRequests": 3 },
  "memory": { "used": 128, "total": 256, "rss": 300 }
}
```

**Status Codes:**
- `200` -- healthy or degraded
- `503` -- unhealthy (database or cache down)

---

### HEAD /api/health

Lightweight health check returning only a status code. Used by load balancers.

**Auth:** None

**Response:** `200` if healthy, `503` if unhealthy

---

### OPTIONS /api/health

CORS preflight response.

**Response:** `204` with CORS headers

---

## 8. Public

### POST /api/contact

Submit a contact form. Sends email via Resend API.

**Auth:** None (public)

**Request Body:**
- `name` (string, required, min 2 chars)
- `email` (string, required, valid email)
- `subject` ("general" | "billing" | "technical" | "medical", required)
- `message` (string, required, 10-1000 chars)

**Response (200):**
```json
{ "success": true }
```

**Errors:**
- `400` -- invalid form data (Zod validation)
- `500` -- failed to send message

---

### POST /api/intake

Public intake form submission (marketing site). Sends intake notification to clinical team and confirmation to patient via Resend API.

**Auth:** None (public)

**Request Body:**
- `firstName` (string, required, min 1)
- `lastInitial` (string, required, exactly 1 char)
- `email` (string, required, valid email)
- `phone` (string, optional)
- `ageRange` (string, required)
- `state` (literal "California", required)
- `treatmentType` (literal "Alcohol", required)
- `drinksPerWeek` (string, optional)
- `alcoholGoal` (string, optional)
- `triedQuitting` (string, optional)
- `currentMedications` (string, optional)
- `medicalConditions` (string, optional)
- `hipaaConsent` (literal true, required)
- `termsConsent` (literal true, required)
- `telehealthConsent` (literal true, required)

**Response (200):**
```json
{ "success": true }
```

**Errors:**
- `400` -- invalid form data
- `500` -- failed to submit intake

---

## Common Error Response Format

All error responses follow this structure:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": {}
}
```

**Standard Error Codes:**
- `VALIDATION_ERROR` -- request body/query validation failed
- `UNAUTHORIZED` -- missing or invalid authentication
- `ACCESS_DENIED` -- authenticated but not authorized for this resource
- `NOT_FOUND` -- resource does not exist
- `INTERNAL_ERROR` -- unexpected server error
- `RATE_LIMITED` -- too many requests

## Authentication Flows

### Patient Registration Flow
1. `POST /api/auth/register` -- create account, receive tokens
2. `POST /api/patient/onboarding/start` -- submit personal info
3. `POST /api/stripe/checkout-session` -- start payment
4. Stripe Webhook: `checkout.session.completed` -- creates profile + subscription
5. `POST /api/patient/onboarding/complete` -- finalize onboarding

### Physician Onboarding Flow
1. Admin creates physician record in database
2. `POST /api/admin/physicians/[id]/authorize` -- admin authorizes, generates secret key
3. Physician receives email with secret key
4. `POST /api/auth/login` with `secretKey` -- first login activates account

### Token Refresh Flow
1. Access token expires (15 minutes)
2. Client calls `POST /api/auth/refresh` with refresh token
3. Receives new access + refresh token pair (token rotation)
