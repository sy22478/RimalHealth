/**
 * Prescriptions Page
 *
 * Prescription management page for physicians.
 * Shows all prescriptions with status tracking and refill management.
 * Fetches data from /api/physician/prescriptions on the server.
 *
 * @module app/physician/prescriptions/page
 */

import * as React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PrescriptionList } from '@/components/physician/PrescriptionList';
import { Badge } from '@/components/ui/badge';
import { Pill, Plus, Clock } from 'lucide-react';
import type { PhysicianPrescriptionListItem } from '@/types/physician-dashboard';
import { PrescriptionStatus } from '@prisma/client';

// ============================================================================
// Metadata
// ============================================================================

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Prescriptions | Physician Portal',
  description: 'Manage patient prescriptions and e-prescribing.',
};

// ============================================================================
// Stats Component
// ============================================================================

function PrescriptionStats({
  prescriptions,
}: {
  prescriptions: PhysicianPrescriptionListItem[];
}) {
  const stats = {
    total: prescriptions.length,
    pending: prescriptions.filter((p) => p.status === 'PENDING').length,
    sent: prescriptions.filter((p) =>
      (['SENT', 'RECEIVED_BY_PHARMACY', 'FILLED'] as PrescriptionStatus[]).includes(p.status)
    ).length,
    ready: prescriptions.filter((p) => p.status === 'READY_FOR_PICKUP').length,
    pickedUp: prescriptions.filter((p) => p.status === 'PICKED_UP').length,
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">In Process</p>
          <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Ready</p>
          <p className="text-2xl font-bold text-green-600">{stats.ready}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Picked Up</p>
          <p className="text-2xl font-bold text-gray-600">{stats.pickedUp}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default async function PrescriptionsPage() {
  let prescriptions: PhysicianPrescriptionListItem[] = [];

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('accessToken')?.value;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (token) {
      const res = await fetch(`${appUrl}/api/physician/prescriptions`, {
        headers: { Cookie: `accessToken=${token}` },
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.prescriptions)) {
          prescriptions = data.prescriptions;
        }
      }
    }
  } catch {
    // API unavailable — keep empty array
  }

  const pendingCount = prescriptions.filter((p) => p.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Pill className="w-6 h-6" />
            Prescriptions
          </h1>
          <p className="text-muted-foreground">
            Manage patient prescriptions and e-prescribing
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge variant="secondary" className="px-3 py-1">
              <Clock className="w-4 h-4 mr-1" />
              {pendingCount} pending
            </Badge>
          )}
          <Button asChild>
            <Link href="/physician/queue">
              <Plus className="w-4 h-4 mr-2" />
              Review & Prescribe
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <PrescriptionStats prescriptions={prescriptions} />

      {/* Pending Alert */}
      {pendingCount > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900">Pending Prescriptions</h3>
                <p className="text-sm text-amber-700">
                  You have {pendingCount} prescription{pendingCount > 1 ? 's' : ''} ready to
                  send to the pharmacy.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Prescription List */}
      <PrescriptionList prescriptions={prescriptions} />
    </div>
  );
}
