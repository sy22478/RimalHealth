import type { Metadata } from 'next';
import { Suspense } from 'react';
import IntakeClient from './IntakeClient';

export const metadata: Metadata = {
  title: 'Treatment Intake | Rimal Health',
  description: 'Complete your medical intake form to begin treatment.',
};

export default function IntakePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-8 w-48 bg-gray-200 rounded mx-auto mb-4"></div>
          <div className="h-4 w-32 bg-gray-200 rounded mx-auto"></div>
        </div>
      </div>
    }>
      <IntakeClient />
    </Suspense>
  );
}
