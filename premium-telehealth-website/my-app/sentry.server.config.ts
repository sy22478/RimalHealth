/**
 * Sentry server-side (Node.js runtime) initialization.
 *
 * Loaded from instrumentation.ts register() when NEXT_RUNTIME === 'nodejs'.
 * Sentry is OPT-IN via SENTRY_DSN; disabled (no-op) when unset.
 *
 * HIPAA: this app handles PHI and 42 CFR Part 2 SUD records. We MUST NOT send
 * PHI to Sentry. The hooks below redact request bodies and strip query/detail
 * from patient API breadcrumbs. Err on the side of over-redaction.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.SENTRY_DSN,
  // HIPAA: never send PHI to Sentry. Request bodies may contain intake answers,
  // health data, names, etc. — redact wholesale.
  beforeSend(event) {
    if (event.request?.data) {
      event.request.data = '[REDACTED]';
    }
    return event;
  },
  // Strip everything but the bare URL from patient-API fetch breadcrumbs so no
  // request/response payloads or query strings (which may carry PHI) leak.
  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.category === 'fetch' && breadcrumb.data?.url?.includes('/api/patient/')) {
      breadcrumb.data = { url: breadcrumb.data.url };
    }
    return breadcrumb;
  },
});
