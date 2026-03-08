# Rimal Health - Operations Runbook

> **Version:** 1.0  
> **Last Updated:** 2026-02-24  
> **On-Call:** engineering-oncall@rimalhealth.com

---

## Table of Contents

1. [Incident Response](#incident-response)
2. [Monitoring & Alerting](#monitoring--alerting)
3. [Common Procedures](#common-procedures)
4. [Emergency Contacts](#emergency-contacts)

---

## Incident Response

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| P0 - Critical | Complete outage, data loss | 15 minutes | Site down, payment failures, PHI breach |
| P1 - High | Major functionality impaired | 1 hour | Login broken, prescriptions not sending |
| P2 - Medium | Partial functionality affected | 4 hours | Slow page loads, intermittent errors |
| P3 - Low | Minor issues, workarounds exist | 24 hours | UI glitches, non-critical feature broken |

### Incident Response Process

```
1. DETECT  → Monitoring alert or user report
2. ACK      → Acknowledge incident in PagerDuty/Slack
3. ASSESS   → Determine severity and scope
4. RESPOND  → Execute appropriate runbook procedure
5. COMM     → Update status page and notify stakeholders
6. RESOLVE  → Confirm fix and close incident
7. REVIEW   → Post-incident review within 48 hours
```

### P0 Incident Response

**If site is completely down:**

1. **Immediate Actions (0-5 min)**
   ```bash
   # Check Vercel status
   curl -s https://www.vercel-status.com/api/v2/status.json
   
   # Check health endpoint
   curl -sf https://rimalhealth.com/api/health || echo "DOWN"
   
   # Acknowledge in Slack
   /pager trigger "Rimal Health P0: Site Down"
   ```

2. **Assess (5-10 min)**
   - Check Vercel Dashboard for deployment issues
   - Check database connectivity
   - Check error logs in Sentry
   - Determine if rollback needed

3. **Execute Rollback if needed (10-15 min)**
   ```bash
   # Emergency rollback
   vercel --token=$VERCEL_TOKEN rollback
   
   # Notify
   curl -X POST $SLACK_WEBHOOK_URL \
     -d '{"text":"🚨 ROLLBACK EXECUTED - P0 Incident"}'
   ```

4. **Communication**
   - Post in #incidents Slack channel
   - Update status page: https://status.rimalhealth.com
   - Notify leadership for PHI-related incidents

---

## Monitoring & Alerting

### Key Metrics Dashboard

Access at: https://vercel.com/dashboard

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Error Rate | > 1% | > 5% | Check Sentry logs |
| Response Time | > 500ms | > 2s | Scale resources |
| CPU Usage | > 70% | > 90% | Investigate load |
| Database Connections | > 80% | > 95% | Check connection pool |
| Failed Logins | > 10/min | > 50/min | Potential attack |

### Health Check Endpoint

```bash
# Check system health
curl https://rimalhealth.com/api/health

# Expected response:
{
  "status": "healthy",
  "checks": {
    "database": true,
    "redis": true,
    "timestamp": "2026-02-24T10:00:00.000Z"
  },
  "version": "0.1.0"
}
```

### Log Locations

| Service | Log Location |
|---------|--------------|
| Application | Vercel Dashboard → Functions → Logs |
| Database | AWS RDS Console / Supabase Dashboard |
| Redis | Upstash Dashboard |
| API Errors | Sentry → Issues |
| Access Logs | Vercel Analytics |

---

## Common Procedures

### Restart Application

```bash
# Redeploy current version (no downtime)
vercel --token=$VERCEL_TOKEN --force

# Or trigger rebuild from GitHub Actions
gh workflow run deploy.yml
```

### Clear Redis Cache

```bash
# Via CLI (requires Redis CLI)
redis-cli -u $REDIS_URL FLUSHDB

# Or via application
# This will clear all cached sessions and data
```

### Database Maintenance

#### Check Connection Pool

```bash
# Check active connections
psql $DATABASE_URL -c "
  SELECT count(*), state 
  FROM pg_stat_activity 
  GROUP BY state;
"
```

#### Kill Long-Running Queries

```bash
# Find long-running queries (> 5 minutes)
psql $DATABASE_URL -c "
  SELECT pid, now() - query_start AS duration, query 
  FROM pg_stat_activity 
  WHERE state = 'active' 
  AND now() - query_start > interval '5 minutes';
"

# Kill specific query (use PID from above)
psql $DATABASE_URL -c "SELECT pg_terminate_backend(<PID>);"
```

#### Manual Database Backup

```bash
# Run backup script
./scripts/backup.sh full

# Or manual pg_dump
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### SSL Certificate Issues

```bash
# Check certificate expiry
echo | openssl s_client -servername rimalhealth.com \
  -connect rimalhealth.com:443 2>/dev/null | \
  openssl x509 -noout -dates

# Check certificate chain
echo | openssl s_client -servername rimalhealth.com \
  -connect rimalhealth.com:443 2>/dev/null | \
  openssl x509 -noout -text
```

### Reset User Password

```bash
# Via Prisma Studio
npx prisma studio

# Or via script
node scripts/reset-password.js <user-email>
```

### Unlock User Account

```bash
# Clear failed login attempts from Redis
redis-cli -u $REDIS_URL DEL "login_attempts:<user-email>"

# Or run unlock script
node scripts/unlock-user.js <user-email>
```

---

## Emergency Contacts

### Internal Team

| Role | Contact | PagerDuty |
|------|---------|-----------|
| Engineering Lead | eng-lead@rimalhealth.com | Yes |
| DevOps | devops@rimalhealth.com | Yes |
| Security | security@rimalhealth.com | Yes |
| Product | product@rimalhealth.com | No |
| CEO | ceo@rimalhealth.com | P0 only |

### External Vendors

| Service | Support | Emergency |
|---------|---------|-----------|
| Vercel | support@vercel.com | status.vercel.com |
| AWS | AWS Support Console | 1-800-555-0199 |
| Stripe | support.stripe.com | +1-888-963-8442 |
| SendGrid | support.sendgrid.com | - |
| Twilio | support.twilio.com | +1-888-341-4005 |
| DoseSpot | support@dosespot.com | - |
| Upstash | support@upstash.com | - |

### Escalation Path

```
1. On-Call Engineer (First Response)
   ↓ (If unresolved in 15 min OR P0)
2. Engineering Lead
   ↓ (If unresolved in 30 min)
3. CTO / VP Engineering
   ↓ (If PHI breach or major outage)
4. CEO + Legal + Compliance
```

---

## Security Incidents

### PHI Breach Response

1. **Immediate (0-15 min)**
   - Isolate affected systems
   - Preserve evidence (don't delete logs)
   - Notify Security team
   - Document timeline

2. **Assessment (15-60 min)**
   - Determine scope of breach
   - Identify affected patients
   - Assess data accessed

3. **Containment (1-4 hours)**
   - Revoke compromised credentials
   - Rotate all API keys
   - Enable additional monitoring

4. **Notification (within 72 hours)**
   - HIPAA requires breach notification
   - Notify affected patients
   - Report to HHS
   - Notify media if > 500 affected

### DDoS Attack Response

```bash
# Enable Vercel DDoS protection (automatic)
# Check Vercel Analytics for traffic patterns

# If using AWS WAF:
# - Enable rate limiting rules
# - Block offending IPs
# - Contact AWS Shield for large attacks
```

### Ransomware/Malware Response

1. Disconnect affected systems
2. Do NOT pay ransom
3. Restore from clean backups
4. Full security audit
5. Report to FBI IC3

---

## Maintenance Windows

### Scheduled Maintenance

- **Time:** Sundays 2:00 AM - 4:00 AM PST
- **Frequency:** Bi-weekly
- **Notification:** 48 hours advance notice

### Maintenance Checklist

```bash
# 1. Pre-maintenance
./scripts/health-check.sh
./scripts/backup.sh full
# Notify users of maintenance window

# 2. During maintenance
# Put site in maintenance mode (if needed)
# Execute maintenance tasks
# Run tests

# 3. Post-maintenance
./scripts/health-check.sh
./scripts/test-smoke.sh
# Notify users maintenance complete
```

---

## Post-Incident Review Template

```markdown
## Incident Review: [INCIDENT-ID]

**Date:** YYYY-MM-DD  
**Severity:** P0/P1/P2/P3  
**Duration:** XX minutes  
**On-Call:** @engineer

### Summary
Brief description of what happened

### Timeline
- 00:00 - Issue detected
- 00:05 - Engineer acknowledged
- 00:15 - Root cause identified
- 00:30 - Fix deployed
- 00:45 - Service restored

### Root Cause
What caused the issue

### Impact
- Users affected: XXX
- Revenue impact: $XXX
- Data loss: Yes/No

### Resolution
How was it fixed

### Lessons Learned
What could have been done better

### Action Items
- [ ] @owner - Task description (Due: YYYY-MM-DD)
```

---

## Quick Reference Commands

```bash
# Health check
./scripts/health-check.sh

# Backup database
./scripts/backup.sh full

# Deploy
./scripts/deploy.sh production

# View logs
vercel logs --token=$VERCEL_TOKEN

# Database console
npx prisma studio

# Redis CLI
redis-cli -u $REDIS_URL

# Emergency rollback
vercel --token=$VERCEL_TOKEN rollback
```

---

**Remember:** When in doubt, escalate. Patient safety and data security are our top priorities.
