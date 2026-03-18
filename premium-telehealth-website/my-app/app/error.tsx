'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    console.error('Application error:', error.digest);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="text-4xl font-bold text-navy mb-4">Something went wrong</h1>
        <p className="text-gray-600 mb-8">
          We encountered an unexpected error. Please try again or contact support if the problem persists.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={reset}
            className="btn-primary px-6 py-3"
          >
            Try Again
          </button>
          <Link href="/" className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            Go Home
          </Link>
        </div>
        <p className="mt-8 text-sm text-gray-400">
          Need help? Email{' '}
          <a href="mailto:support@rimalhealth.com" className="text-ocean hover:underline">
            support@rimalhealth.com
          </a>
        </p>
      </div>
    </div>
  );
}
