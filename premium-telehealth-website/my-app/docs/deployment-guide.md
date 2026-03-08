# Rimal Health - Production Deployment Guide

> **Version:** 1.0  
> **Last Updated:** 2026-02-24  
> **Environment:** Production  

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Deployment Methods](#deployment-methods)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Rollback Procedures](#rollback-procedures)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20.x | Runtime |
| npm | 10.x | Package manager |
| Git | 2.x+ | Version control |
| Vercel CLI | Latest | Deployment |
| PostgreSQL | 15.x | Database |
| Redis | 7.x | Cache |

### Required Accounts

- [ ] Vercel account with project configured
- [ ] AWS account (for S3 backups)
- [ ] SendGrid account (for email)
- [ ] Twilio account (for SMS)
- [ ] Stripe account (for payments)
- [ ] DoseSpot account (for e-prescribing)
- [ ] GitHub repository with secrets configured

---

## Environment Setup

### 1. Clone and Configure Repository

```bash
# Clone the repository
git clone https://github.com/your-org/rimal-health.git
cd rimal-health/premium-telehealth-website/my-app

# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate
```

### 2. Configure Environment Variables

Create `.env.local` file:

```bash
cp .env.example .env.local
```

Required environment variables:

```bash
# =============================================================================
# REQUIRED - Core Application
# =============================================================================
NEXT_PUBLIC_APP_URL=https://rimalhealth.com
NEXT_PUBLIC_APP_NAME="Rimal Health"
JWT_SECRET=<generate-32-char-random-string>

# =============================================================================
# REQUIRED - Database (PostgreSQL)
# =============================================================================
DATABASE_URL=postgresql://user:password@host:5432/rimalhealth?schema=public

# =============================================================================
# REQUIRED - PHI Encryption (AES-256-GCM)
# Generate with: openssl rand -base64 32
# =============================================================================
PHI_ENCRYPTION_KEY=<32-char-base64-encoded-key>

# =============================================================================
# REQUIRED - Redis (Upstash or self-hosted)
# =============================================================================
REDIS_URL=rediss://default:password@host:6379

# =============================================================================
# REQUIRED - Email (SendGrid)
# =============================================================================
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@rimalhealth.com
CONTACT_FORM_TO_EMAIL=admin@rimalhealth.com

# =============================================================================
# REQUIRED - SMS (Twilio)
# =============================================================================
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx

# =============================================================================
# REQUIRED - Payments (Stripe LIVE MODE)
# ⚠️  Use LIVE keys for production!
# =============================================================================
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PRICE_ID_ACTIVE=price_xxxxxxxxxxxxxxxx
STRIPE_PRICE_ID_MAINTENANCE=price_xxxxxxxxxxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxx

# =============================================================================
# REQUIRED - Storage (AWS S3)
# =============================================================================
AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=us-west-2
AWS_S3_BUCKET_NAME=rimalhealth-documents

# =============================================================================
# REQUIRED - E-Prescribing (DoseSpot Production)
# =============================================================================
DOSESPOT_API_URL=https://api.dosespot.com
DOSESPOT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
DOSESPOT_CLIENT_SECRET=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
DOSESPOT_CLINIC_ID=xxxxx
DOSESPOT_USER_ID=xxxxx
DOSESPOT_MOCK_MODE=false

# =============================================================================
# OPTIONAL - Monitoring & Analytics
# =============================================================================
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/xxx/xxx
```

### 3. Configure GitHub Secrets

Navigate to **Settings → Secrets and variables → Actions** and add:

| Secret Name | Description |
|-------------|-------------|
| `VERCEL_TOKEN` | Vercel authentication token |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |
| `DATABASE_URL` | Production database connection string |
| `DATABASE_URL_TEST` | Test database connection string |
| `JWT_SECRET` | JWT signing secret |
| `PHI_ENCRYPTION_KEY` | PHI encryption key |
| `REDIS_URL` | Redis connection string |
| `SENDGRID_API_KEY` | SendGrid API key |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `STRIPE_SECRET_KEY` | Stripe live secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `SLACK_WEBHOOK_URL` | Slack webhook for notifications |

---

## Deployment Methods

### Method 1: Automated Deployment (GitHub Actions) [Recommended]

The preferred method for production deployments.

```bash
# 1. Merge changes to main branch
git checkout main
git pull origin main
git merge develop

# 2. Push to trigger deployment
git push origin main

# 3. Monitor deployment in GitHub Actions
# https://github.com/your-org/rimal-health/actions
```

**What happens automatically:**
1. ✅ Runs linting and type checking
2. ✅ Runs unit and integration tests
3. ✅ Runs security audit
4. ✅ Builds application
5. ✅ Deploys to Vercel
6. ✅ Runs database migrations
7. ✅ Performs health checks
8. ✅ Runs smoke tests
9. ✅ Sends Slack notification

### Method 2: Manual Deployment (Vercel CLI)

For emergency hotfixes or when GitHub Actions is unavailable.

```bash
# 1. Ensure you have Vercel CLI
npm install -g vercel

# 2. Login to Vercel
vercel login

# 3. Set environment variables locally
export VERCEL_TOKEN=your_token
export DATABASE_URL=your_database_url

# 4. Run deployment script
./scripts/deploy.sh production

# Or manually:
vercel --prod
npx prisma migrate deploy
```

### Method 3: Docker Deployment

For on-premise or custom infrastructure.

```bash
# 1. Build Docker image
docker-compose -f docker/docker-compose.yml build

# 2. Start services
docker-compose -f docker/docker-compose.yml up -d

# 3. Run migrations
docker-compose -f docker/docker-compose.yml exec app npx prisma migrate deploy

# 4. Health check
./scripts/health-check.sh http://localhost:3000
```

---

## Post-Deployment Verification

### 1. Health Check

```bash
# Run automated health check
./scripts/health-check.sh https://rimalhealth.com

# Or manually check endpoints
curl https://rimalhealth.com/api/health
curl https://rimalhealth.com/
curl https://rimalhealth.com/login
```

### 2. Verify Database Migrations

```bash
# Check migration status
npx prisma migrate status

# View current schema version
npx prisma migrate resolve --applied "migration_name"
```

### 3. Smoke Tests

```bash
# Run automated smoke tests
npm run test:smoke

# Or manual checks:
# - Homepage loads
# - Login page accessible
# - Contact form works
# - API health endpoint returns 200
```

### 4. Verify Integrations

| Integration | Verification Step |
|-------------|-------------------|
| Stripe | Check webhook endpoints in Stripe Dashboard |
| SendGrid | Send test email from contact form |
| Twilio | Send test SMS notification |
| DoseSpot | Verify API connectivity |
| AWS S3 | Upload test document |

### 5. Monitoring Checklist

- [ ] Application logs in Vercel Dashboard
- [ ] Database metrics in PostgreSQL monitoring
- [ ] Redis metrics in Upstash Dashboard
- [ ] Error tracking (Sentry/DataDog)
- [ ] Uptime monitoring (Pingdom/UptimeRobot)

---

## Rollback Procedures

### Quick Rollback (Vercel)

```bash
# 1. List recent deployments
vercel --token=$VERCEL_TOKEN ls

# 2. Get deployment ID
# Copy the deployment ID from the list

# 3. Rollback to previous deployment
vercel --token=$VERCEL_TOKEN rollback <deployment-id>

# Or use Vercel Dashboard:
# https://vercel.com/dashboard → Project → Deployments → Promote
```

### Database Rollback

⚠️ **WARNING:** Database rollbacks can cause data loss. Use with extreme caution.

```bash
# 1. Identify the last good migration
npx prisma migrate status

# 2. Create a down migration (if not exists)
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma \
  --script > down-migration.sql

# 3. Apply down migration (MANUAL REVIEW REQUIRED!)
# psql $DATABASE_URL < down-migration.sql

# 4. Mark migration as rolled back
npx prisma migrate resolve --rolled-back "migration_name"
```

### Emergency Rollback Script

```bash
#!/bin/bash
# emergency-rollback.sh

echo "🚨 EMERGENCY ROLLBACK INITIATED"

# Rollback Vercel deployment
vercel --token=$VERCEL_TOKEN rollback

# Notify team
curl -X POST $SLACK_WEBHOOK_URL \
  -H 'Content-type: application/json' \
  --data '{"text":"🚨 EMERGENCY ROLLBACK EXECUTED"}'

echo "✅ Rollback complete"
```

---

## Troubleshooting

### Common Issues

#### 1. Build Failures

```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build

# Check for type errors
npx tsc --noEmit
```

#### 2. Database Connection Issues

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1;"

# Check connection pool limits
# (Check your database provider dashboard)
```

#### 3. Environment Variables Missing

```bash
# Pull Vercel environment variables
vercel env pull .env.local

# Verify all required variables are set
./scripts/verify-env.sh
```

#### 4. Migration Failures

```bash
# Check migration status
npx prisma migrate status

# Reset database (DANGEROUS - DATA LOSS)
npx prisma migrate reset

# Mark migration as resolved manually
npx prisma migrate resolve --applied 20240101000000_migration_name
```

#### 5. Memory Issues During Build

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

### Getting Help

1. **Check logs:** Vercel Dashboard → Project → Functions → Logs
2. **Check monitoring:** Sentry, DataDog, or your monitoring tool
3. **Contact team:** Post in #engineering Slack channel
4. **Escalate:** Page on-call engineer for production issues

---

## Security Checklist

Before each production deployment:

- [ ] All environment variables are production values (not test/sandbox)
- [ ] Stripe keys are LIVE mode (`sk_live_`, `pk_live_`)
- [ ] DoseSpot is configured for production API
- [ ] PHI encryption key is properly set
- [ ] No debug/test data in database
- [ ] All secrets rotated if compromised
- [ ] Security audit passes (`npm audit`)

---

## Post-Deployment Checklist

- [ ] Deployment successful notification received
- [ ] Health check endpoint returns 200
- [ ] Homepage loads without errors
- [ ] Login page accessible
- [ ] Contact form submits successfully
- [ ] Stripe webhooks responding correctly
- [ ] Database migrations applied
- [ ] Smoke tests passing
- [ ] Error monitoring shows no new issues
- [ ] Performance metrics within acceptable range
