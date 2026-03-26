/**
 * GET /api/csrf
 *
 * Generates a CSRF token pair and sets the cookie token as an httpOnly cookie.
 * Returns the form token in the JSON response for inclusion in subsequent
 * state-changing requests (POST, PUT, DELETE) via the X-CSRF-Token header.
 *
 * This endpoint is intentionally open to authenticated users only (middleware
 * already injects x-user-id for protected routes, but CSRF tokens may also
 * be needed on public form pages like consent). Rate-limited by IP.
 *
 * @module app/api/csrf/route
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateCSRFToken,
  createCSRFTokenCookieOptions,
} from '@/lib/security/csrf';
import { SESSION_SECURITY } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const tokenPair = generateCSRFToken();
  const cookieOptions = createCSRFTokenCookieOptions();

  const response = NextResponse.json({
    csrfToken: tokenPair.formToken,
  });

  // Set the cookie token (used for server-side validation via double-submit)
  response.cookies.set({
    name: SESSION_SECURITY.CSRF_TOKEN_COOKIE,
    value: tokenPair.cookieToken,
    ...cookieOptions,
    httpOnly: true, // Override: cookie token must NOT be readable by JS
  });

  // Set the form token in a JS-readable cookie so client-side fetch helpers
  // can automatically attach it via the withCSRFHeader() utility.
  response.cookies.set({
    name: `${SESSION_SECURITY.CSRF_TOKEN_COOKIE}_form`,
    value: tokenPair.formToken,
    ...cookieOptions,
    httpOnly: false,
  });

  return response;
}
