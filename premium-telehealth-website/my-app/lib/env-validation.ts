/**
 * Environment Variable Validation
 * Validates that all required environment variables are present at runtime.
 *
 * Called from instrumentation.ts during server startup. Never runs at build
 * time, so it won't break CI builds that lack secrets.
 *
 * @module lib/env-validation
 */

/** Variables required in every environment */
const REQUIRED_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'PHI_ENCRYPTION_KEY',
] as const;

/** Variables additionally required in production */
const REQUIRED_IN_PRODUCTION = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SENDGRID_API_KEY',
  'REDIS_URL',
] as const;

/**
 * Validate that all required environment variables are set.
 * Throws an Error listing every missing variable.
 */
export function validateEnvironment(): void {
  const missing: string[] = [];

  for (const v of REQUIRED_VARS) {
    if (!process.env[v]) missing.push(v);
  }

  if (process.env.NODE_ENV === 'production') {
    for (const v of REQUIRED_IN_PRODUCTION) {
      if (!process.env[v]) missing.push(v);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}
