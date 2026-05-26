import * as React from 'react';
import type { Metadata } from 'next';
import { ProfileSettings } from '@/components/patient/ProfileSettings';

// Title is just the page name — the root layout's title.template ("%s | Rimal Health")
// appends the suffix. Setting "Profile Settings | Rimal Health" here would duplicate it.
export const metadata: Metadata = {
  title: 'Profile Settings',
  description: 'Manage your personal information, password, notifications, and privacy settings.',
};

export default function ProfileSettingsPage(): React.ReactElement {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your personal information, security, and notification preferences.
        </p>
      </div>
      <ProfileSettings />
    </div>
  );
}
