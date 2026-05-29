/**
 * Sentry Edge runtime initialization (middleware, edge route handlers).
 *
 * Loaded from instrumentation.ts register() when NEXT_RUNTIME === 'edge'.
 * Sentry is OPT-IN via SENTRY_DSN; disabled (no-op) when unset.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.05,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.SENTRY_DSN,
});
