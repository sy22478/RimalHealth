'use client';

/**
 * Global error boundary — the catch-all for errors thrown in the ROOT layout
 * itself, which the route-level error.tsx files cannot recover from. Without
 * this file Next.js renders a blank white page on a root-layout crash.
 *
 * Because the root layout has failed, this component renders its own
 * <html>/<body> and cannot rely on shared providers, fonts, or the Tailwind
 * @layer classes injected via globals.css — so it uses inline styles only.
 *
 * HIPAA: never render error details (message/stack) to the user — they may
 * contain PHI. We show a generic message and report the error to Sentry
 * (a no-op when Sentry is not configured).
 */
import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    // Report to Sentry if configured; the digest correlates with server logs.
    Sentry.captureException(error);
    console.error('Global application error:', error.digest);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          backgroundColor: '#f9fafb',
        }}
      >
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div style={{ maxWidth: '28rem', width: '100%', textAlign: 'center' }}>
            <h1
              style={{
                fontSize: '2.25rem',
                fontWeight: 700,
                color: '#0A2540',
                marginBottom: '1rem',
              }}
            >
              Something went wrong
            </h1>
            <p style={{ color: '#4b5563', marginBottom: '2rem', lineHeight: 1.6 }}>
              We encountered an unexpected error. Please try again, or contact
              support if the problem persists.
            </p>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                alignItems: 'center',
              }}
            >
              <button
                onClick={reset}
                style={{
                  backgroundColor: '#0284C7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
              <a
                href="mailto:support@rimalhealth.com"
                style={{ color: '#0284C7', textDecoration: 'none', fontSize: '0.875rem' }}
              >
                Contact support@rimalhealth.com
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
