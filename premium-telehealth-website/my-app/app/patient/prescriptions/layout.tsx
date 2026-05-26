import type { Metadata } from 'next';

// Sibling layout so page.tsx can stay a client component while still getting
// a per-route title. The root layout's template appends " | Rimal Health".
export const metadata: Metadata = {
  title: 'Prescriptions',
};

export default function PrescriptionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
