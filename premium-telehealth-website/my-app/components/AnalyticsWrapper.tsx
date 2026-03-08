'use client';

import dynamic from 'next/dynamic';

const Analytics = dynamic(() => import("@/components/Analytics").then(mod => mod.Analytics), {
  ssr: false,
  loading: () => null,
});

export default function AnalyticsWrapper() {
  return <Analytics />;
}
