/**
 * Next.js Instrumentation
 * Runs once when the server starts. Used for environment validation,
 * Sentry initialization, and other one-time startup tasks.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * @module instrumentation
 */

import * as Sentry from '@sentry/nextjs';

export async function register(): Promise<void> {
  // Only validate on the server (not during Edge runtime or build)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvironment } = await import('@/lib/env-validation');
    validateEnvironment();
    // Initialize Sentry for the Node.js server runtime. No-op without SENTRY_DSN.
    await import('./sentry.server.config');
  }

  // Initialize Sentry for the Edge runtime (middleware, edge handlers).
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Capture errors thrown in server components, route handlers, and other
// nested React Server Component work (Next.js 15+ instrumentation hook).
// No-op when Sentry is not configured.
export const onRequestError = Sentry.captureRequestError;
