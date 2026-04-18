/**
 * Admin Panel Layout
 * 
 * Main layout for the admin portal with sidebar navigation
 * and mobile-responsive design.
 * 
 * @module app/admin/layout
 */

import * as React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Role } from '@prisma/client';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { AdminNav } from '@/components/admin/AdminNav';

// ============================================================================
// Metadata
// ============================================================================

export const metadata: Metadata = {
  title: 'Admin Panel',
  description: 'Administrative dashboard for Rimal Health platform',
};

// ============================================================================
// Auth Check
// ============================================================================

/**
 * Validate admin session from cookies
 * Redirects to login if not authenticated or not admin
 */
async function validateAdminSession(): Promise<{ userId: string; email: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;

    if (!token) {
      return null;
    }

    const payload = await verifyAccessToken(token);

    // Check if user has admin role
    if (payload.role !== Role.ADMIN) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Layout
// ============================================================================

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check admin authentication
  const session = await validateAdminSession();

  if (!session) {
    redirect('/login?from=/admin/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav>{children}</AdminNav>
    </div>
  );
}
