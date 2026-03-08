/**
 * Physician Settings Page
 *
 * Profile overview and account settings for physicians.
 * Fetches physician profile data server-side.
 *
 * @module app/physician/settings/page
 */

import * as React from 'react';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Settings } from 'lucide-react';
import { PhysicianSettingsClient } from './PhysicianSettingsClient';

export const metadata: Metadata = {
  title: 'Settings | Physician Portal',
  description: 'Manage your physician account settings.',
};

export default async function PhysicianSettingsPage() {
  let physician = null;

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (token) {
      const res = await fetch(`${appUrl}/api/physician/profile`, {
        headers: { Cookie: `accessToken=${token}` },
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        physician = data.physician ?? null;
      }
    }
  } catch {
    // API unavailable
  }

  if (!physician) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Settings
          </h1>
        </div>
        <p className="text-muted-foreground">Unable to load profile. Please refresh the page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="w-6 h-6" />
          Settings
        </h1>
        <p className="text-muted-foreground">Manage your account and security settings</p>
      </div>

      <PhysicianSettingsClient physician={physician} />
    </div>
  );
}
