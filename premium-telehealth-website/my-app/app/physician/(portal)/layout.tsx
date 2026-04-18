/**
 * Physician Portal Layout
 *
 * Main layout for the physician portal with sidebar navigation,
 * mobile-responsive design, and real-time message notifications.
 *
 * @module app/physician/layout
 */

import * as React from 'react';
import { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Sidebar, MobileHeader, MobileNav } from './PhysicianNavClient';
import { MessageNotifications } from '@/components/physician/MessageNotifications';
import { TokenRefreshProvider } from '@/components/auth/TokenRefreshProvider';
import { verifyAccessToken } from '@/lib/auth/jwt';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Physician Portal',
  description: 'Manage patients, reviews, prescriptions, and messages.',
};

// ============================================================================
// Layout
// ============================================================================

export default async function PhysicianLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Prefer middleware-injected headers (already verified, survives inline refresh)
  const headerStore = await headers();
  const middlewareUserId = headerStore.get('x-user-id');
  const middlewareRole = headerStore.get('x-user-role');

  if (middlewareUserId && middlewareRole) {
    // Middleware already verified the token (or refreshed it inline)
    if (middlewareRole !== 'PHYSICIAN' && middlewareRole !== 'ADMIN') {
      redirect('/unauthorized');
    }
  } else {
    // Fallback: verify access token cookie directly
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;

    if (!token) {
      redirect('/physician/login');
    }

    try {
      const payload = await verifyAccessToken(token);
      if (payload.role !== 'PHYSICIAN' && payload.role !== 'ADMIN') {
        redirect('/unauthorized');
      }
    } catch {
      redirect('/physician/login');
    }
  }

  return (
    <TokenRefreshProvider loginPath="/physician/login">
      <div className="min-h-screen bg-gray-50">
        <div className="flex">
          {/* Sidebar - Desktop */}
          <Sidebar />

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Mobile Header */}
            <MobileHeader />

            {/* Page Content */}
            <div className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
              {children}
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <MobileNav />

        {/* Real-time Message Notifications */}
        <MessageNotifications />
      </div>
    </TokenRefreshProvider>
  );
}
