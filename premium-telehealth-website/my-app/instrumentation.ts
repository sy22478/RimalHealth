/**
 * Next.js Instrumentation
 * Runs once when the server starts. Used for environment validation
 * and other one-time startup tasks.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * @module instrumentation
 */

export async function register(): Promise<void> {
  // Only validate on the server (not during Edge runtime or build)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvironment } = await import('@/lib/env-validation');
    validateEnvironment();
  }
}
