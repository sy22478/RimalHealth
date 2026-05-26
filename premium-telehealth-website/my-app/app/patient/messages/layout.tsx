import type { Metadata } from 'next';

// Sibling layout so page.tsx can stay a client component while still getting
// a per-route title. The root layout's template appends " | Rimal Health".
export const metadata: Metadata = {
  title: 'Messages',
};

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
