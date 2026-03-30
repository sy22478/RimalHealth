'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    console.error('Checkout error:', error.digest);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <h2 className="text-2xl font-bold text-navy mb-4">Checkout Error</h2>
        <p className="text-gray-600 mb-6">
          Something went wrong during checkout. Your payment has not been processed.
          Please try again or contact support.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="btn-primary px-6 py-2.5 text-sm"
          >
            Try Again
          </button>
          <Link
            href="/checkout/consent"
            className="px-6 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Start Over
          </Link>
        </div>
        <p className="mt-6 text-sm text-gray-400">
          Need help? Email{' '}
          <a href="mailto:support@rimalhealth.com" className="text-ocean hover:underline">
            support@rimalhealth.com
          </a>
        </p>
      </div>
    </div>
  );
}
