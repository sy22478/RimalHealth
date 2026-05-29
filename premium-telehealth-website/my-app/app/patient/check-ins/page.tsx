import type { Metadata } from 'next';
import CheckInsClient from './CheckInsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Check-ins | Rimal Health',
  description: 'Complete your weight-management check-ins for physician review.',
};

export default function CheckInsPage() {
  return <CheckInsClient />;
}
