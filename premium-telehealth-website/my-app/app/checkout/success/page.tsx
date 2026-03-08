import type { Metadata } from 'next';
import { Suspense } from 'react';
import CheckoutSuccessClient from './CheckoutSuccessClient';

export const metadata: Metadata = {
  title: 'Payment Successful | Rimal Health',
  description: 'Your payment has been processed successfully.',
};

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-8 w-48 bg-gray-200 rounded mx-auto mb-4"></div>
          <div className="h-4 w-32 bg-gray-200 rounded mx-auto"></div>
        </div>
      </div>
    }>
      <CheckoutSuccessClient />
    </Suspense>
  );
}
