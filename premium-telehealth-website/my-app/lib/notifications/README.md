# Notification Service

HIPAA-compliant notification service for Rimal Health telehealth platform.

## Features

- **Email Notifications**: SendGrid integration with HTML/text templates
- **SMS Notifications**: Twilio integration with template support
- **Redis Queue**: Priority-based job queue with retry logic
- **Scheduled Notifications**: Send notifications at specific times
- **Error Handling**: Graceful failures with automatic retry
- **HIPAA Compliance**: No PHI in logs, encrypted transmission

## Installation

```bash
npm install @sendgrid/mail twilio
npm install -D @types/twilio
```

## Environment Variables

```bash
# SendGrid
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=noreply@rimalhealth.com
SENDGRID_FROM_NAME="Rimal Health"

# Twilio
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1xxx

# Redis (already configured in lib/redis/client.ts)
REDIS_URL=redis://localhost:6379
```

## Quick Start

```typescript
import { 
  sendEmail, 
  sendSMS, 
  notificationQueue,
  EmailTemplate,
  SMSTemplate 
} from '@/lib/notifications';

// Send email immediately
await sendEmail({
  to: 'patient@example.com',
  template: EmailTemplate.WELCOME,
  data: { firstName: 'John', dashboardUrl: 'https://...' },
});

// Send SMS immediately
await sendSMS({
  to: '+1234567890',
  template: SMSTemplate.VERIFICATION_CODE,
  data: { code: '123456' },
});

// Queue for background processing
await notificationQueue.add({
  type: 'email',
  priority: 'high',
  payload: {
    to: 'patient@example.com',
    template: EmailTemplate.INTAKE_APPROVED,
    data: { firstName: 'John', pharmacyName: 'CVS' },
  },
});
```

## Email Templates

- `WELCOME` - New user welcome
- `EMAIL_VERIFICATION` - Verify email address
- `PASSWORD_RESET` - Reset password link
- `INTAKE_SUBMITTED` - Intake form received
- `INTAKE_APPROVED` - Intake approved
- `INTAKE_REJECTED` - Intake rejected
- `PRESCRIPTION_SENT` - Prescription sent to pharmacy
- `MESSAGE_RECEIVED` - New message notification
- `PAYMENT_RECEIPT` - Payment receipt
- `SUBSCRIPTION_CANCELLED` - Subscription cancellation

## SMS Templates

- `VERIFICATION_CODE` - 2FA verification code
- `INTAKE_APPROVED` - Intake approval notification
- `PRESCRIPTION_READY` - Prescription ready
- `APPOINTMENT_REMINDER` - Appointment reminder
- `MESSAGE_NOTIFICATION` - New message alert

## Queue Processing

Run queue processing in a background worker:

```typescript
import { processAllQueues } from '@/lib/notifications';

// Process all queues every 5 seconds
setInterval(() => processAllQueues(), 5000);
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│    Queue    │────▶│   Worker    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                   │
                           ▼                   ▼
                    ┌─────────────┐     ┌─────────────┐
                    │    Redis    │     │  SendGrid/  │
                    │             │     │   Twilio    │
                    └─────────────┘     └─────────────┘
```

## Redis Schema

- `notifications:pending` - Priority sorted set of pending jobs
- `notifications:processing` - Hash of jobs being processed
- `notifications:scheduled` - Sorted set of scheduled jobs (timestamp score)
- `notifications:completed` - List of completed job IDs
- `notifications:failed` - List of failed job IDs
- `notifications:job:{id}` - Hash with full job data
- `notifications:email:retry` - Sorted set for email retry queue
- `notifications:sms:retry` - Sorted set for SMS retry queue
- `notifications:stats` - Hash with notification statistics

## Error Handling

All notification functions are fire-and-forget:
- Never throw errors
- Log errors without PHI
- Queue for retry on transient failures
- Max 3 retries with exponential backoff
- Failed jobs moved to dead letter queue

## HIPAA Compliance

- No PHI in logs or error messages
- Recipient identifiers not logged
- TLS encryption for all transmissions
- Click tracking disabled in emails
- Phone numbers formatted to E.164
