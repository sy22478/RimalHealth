import type { Metadata } from 'next';
import { Suspense } from 'react';
import CheckoutPaymentClient from './CheckoutPaymentClient';

export const metadata: Metadata = {
  title: 'Checkout | Rimal Health',
  description: 'Complete your payment.',
};

export default function CheckoutPaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-8 w-48 bg-gray-200 rounded mx-auto mb-4"></div>
          <div className="h-4 w-32 bg-gray-200 rounded mx-auto"></div>
        </div>
      </div>
    }>
      <CheckoutPaymentClient />
    </Suspense>
  );
}
