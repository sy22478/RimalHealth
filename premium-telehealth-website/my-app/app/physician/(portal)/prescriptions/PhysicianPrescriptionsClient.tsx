'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PrescriptionList } from '@/components/physician/PrescriptionList';
import { Pill, Plus, Clock, CheckCircle } from 'lucide-react';
import type { PhysicianPrescriptionListItem } from '@/types/physician-dashboard';
import { PrescriptionStatus } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface PhysicianPrescriptionsClientProps {
  initialPrescriptions: PhysicianPrescriptionListItem[];
}

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
    active: prescriptions.filter((p) => p.status === 'ACTIVE' || p.status === 'PICKED_UP').length,
    completed: prescriptions.filter((p) => p.status === 'COMPLETED').length,
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
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold text-gray-600">{stats.completed}</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Main Client Component
// ============================================================================

export function PhysicianPrescriptionsClient({ initialPrescriptions }: PhysicianPrescriptionsClientProps) {
  const [prescriptions, setPrescriptions] = React.useState(initialPrescriptions);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Auto-dismiss toast
  React.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const refreshPrescriptions = async () => {
    try {
      const res = await fetch('/api/physician/prescriptions', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.prescriptions)) {
          setPrescriptions(data.prescriptions);
        }
      }
    } catch {
      // Silently fail — data will be stale
    }
  };

  const handleSendToPharmacy = async (prescriptionId: string) => {
    const rx = prescriptions.find((p) => p.id === prescriptionId);
    if (!rx) return;

    // If pharmacy is 'Pending', show error — physician needs to assign pharmacy first via review
    if (rx.pharmacyName === 'Pending') {
      setToast({
        message: 'This prescription has no pharmacy assigned. Please update the pharmacy before sending.',
        type: 'error',
      });
      return;
    }

    const confirmed = confirm(
      `This will notify the patient that their prescription has been sent to ${rx.pharmacyName}.\n\nHave you sent the prescription through your e-prescribing app?`
    );
    if (!confirmed) return;

    try {
      const res = await fetch('/api/physician/prescriptions/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prescriptionId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send prescription');
      }

      setToast({ message: `Prescription marked as sent to ${rx.pharmacyName}. Patient notified.`, type: 'success' });
      await refreshPrescriptions();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to send prescription',
        type: 'error',
      });
    }
  };

  const handleMarkActive = async (prescriptionId: string) => {
    const rx = prescriptions.find((p) => p.id === prescriptionId);
    if (!rx) return;

    if (!confirm('Confirm this patient has started their medication?')) {
      return;
    }

    try {
      const res = await fetch(`/api/physician/prescriptions/${prescriptionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'ACTIVE' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update prescription');
      }

      setToast({ message: 'Prescription marked as active', type: 'success' });
      await refreshPrescriptions();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to update prescription',
        type: 'error',
      });
    }
  };

  const handleMarkCompleted = async (prescriptionId: string) => {
    if (!confirm('Confirm this treatment course is complete?')) {
      return;
    }

    try {
      const res = await fetch(`/api/physician/prescriptions/${prescriptionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'COMPLETED' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update prescription');
      }

      setToast({ message: 'Treatment marked as completed', type: 'success' });
      await refreshPrescriptions();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to update prescription',
        type: 'error',
      });
    }
  };

  const pendingCount = prescriptions.filter((p) => p.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border max-w-sm animate-in fade-in slide-in-from-top-2 ${
            toast.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Pill className="w-6 h-6" />
            Prescriptions
          </h1>
          <p className="text-muted-foreground">
            Manage patient prescriptions — mark as sent after sending to pharmacy
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
                <h3 className="font-semibold text-amber-900">Prescriptions Ready to Send</h3>
                <p className="text-sm text-amber-700">
                  You have {pendingCount} prescription{pendingCount > 1 ? 's' : ''} to send to the
                  pharmacy. After sending via phone, fax, or another system, click &quot;Send&quot; to update the
                  status.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Prescription List */}
      <PrescriptionList
        prescriptions={prescriptions}
        onSendToPharmacy={handleSendToPharmacy}
        onRefresh={refreshPrescriptions}
      />

      {/* Additional Actions for SENT and ACTIVE prescriptions */}
      {prescriptions.some((p) => p.status === 'SENT' || p.status === 'ACTIVE') && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Status Updates</h3>
            <div className="space-y-3">
              {prescriptions
                .filter((p) => p.status === 'SENT')
                .map((rx) => (
                  <div
                    key={rx.id}
                    className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100"
                  >
                    <div>
                      <p className="font-medium text-sm">{rx.patientName}</p>
                      <p className="text-xs text-gray-500">
                        {rx.medicationName} {rx.dosage} — sent to {rx.pharmacyName}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-300 text-green-700 hover:bg-green-50"
                      onClick={() => handleMarkActive(rx.id)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Mark Active
                    </Button>
                  </div>
                ))}
              {prescriptions
                .filter((p) => p.status === 'ACTIVE')
                .map((rx) => (
                  <div
                    key={rx.id}
                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100"
                  >
                    <div>
                      <p className="font-medium text-sm">{rx.patientName}</p>
                      <p className="text-xs text-gray-500">
                        {rx.medicationName} {rx.dosage} — active treatment
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-gray-300 text-gray-700 hover:bg-gray-50"
                      onClick={() => handleMarkCompleted(rx.id)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Mark Completed
                    </Button>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
