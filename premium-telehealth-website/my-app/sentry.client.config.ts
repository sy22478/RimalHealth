/**
 * Sentry client-side initialization.
 *
 * Loaded by the @sentry/nextjs webpack build plugin (getClientSentryConfigFile).
 * Sentry is OPT-IN: it stays disabled unless NEXT_PUBLIC_SENTRY_DSN is set, so
 * the app runs identically without monitoring configured.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
});
