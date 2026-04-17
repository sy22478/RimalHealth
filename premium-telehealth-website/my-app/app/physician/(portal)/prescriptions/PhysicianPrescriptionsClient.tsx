'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PrescriptionList } from '@/components/physician/PrescriptionList';
import { PharmacySearch, type Pharmacy } from '@/components/physician/PharmacySearch';
import { Pill, Plus, Clock, CheckCircle } from 'lucide-react';
import type { PhysicianPrescriptionListItem } from '@/types/physician-dashboard';
import { PrescriptionStatus } from '@prisma/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type PendingAction =
  | { type: 'send'; prescriptionId: string; pharmacyName: string }
  | { type: 'active'; prescriptionId: string; patientName: string }
  | { type: 'completed'; prescriptionId: string; patientName: string };

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
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [pharmacyDialogRxId, setPharmacyDialogRxId] = React.useState<string | null>(null);
  const [settingPharmacy, setSettingPharmacy] = React.useState(false);

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

  const requestSendToPharmacy = (prescriptionId: string) => {
    const rx = prescriptions.find((p) => p.id === prescriptionId);
    if (!rx) return;

    if (rx.pharmacyName === 'Pending') {
      // Prompt the physician to set a pharmacy first instead of just erroring.
      setPharmacyDialogRxId(prescriptionId);
      return;
    }

    setPendingAction({ type: 'send', prescriptionId, pharmacyName: rx.pharmacyName });
  };

  const requestSetPharmacy = (prescriptionId: string) => {
    setPharmacyDialogRxId(prescriptionId);
  };

  const handlePharmacySelected = async (pharmacy: Pharmacy) => {
    if (!pharmacyDialogRxId) return;
    setSettingPharmacy(true);
    try {
      const res = await fetch(`/api/physician/prescriptions/${pharmacyDialogRxId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          // Keep status unchanged — the update endpoint requires a valid transition,
          // and setting the same status (PENDING -> PENDING) is not allowed. Instead,
          // pass the current status so the server only updates pharmacy fields.
          // The PUT handler only applies status transitions when they differ.
          status: 'PENDING',
          pharmacyName: pharmacy.name,
          pharmacyAddress: pharmacy.address,
          pharmacyCity: pharmacy.city,
          pharmacyState: pharmacy.state,
          pharmacyNcpdpId: pharmacy.ncpdpId,
          pharmacyPhone: pharmacy.phone,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update pharmacy');
      }

      setToast({
        message: `Pharmacy set to ${pharmacy.name}. You can now send the prescription.`,
        type: 'success',
      });
      setPharmacyDialogRxId(null);
      await refreshPrescriptions();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to update pharmacy',
        type: 'error',
      });
    } finally {
      setSettingPharmacy(false);
    }
  };

  const requestMarkActive = (prescriptionId: string) => {
    const rx = prescriptions.find((p) => p.id === prescriptionId);
    if (!rx) return;
    setPendingAction({ type: 'active', prescriptionId, patientName: rx.patientName });
  };

  const requestMarkCompleted = (prescriptionId: string) => {
    const rx = prescriptions.find((p) => p.id === prescriptionId);
    if (!rx) return;
    setPendingAction({ type: 'completed', prescriptionId, patientName: rx.patientName });
  };

  const runPendingAction = async () => {
    if (!pendingAction) return;
    setActionLoading(true);

    try {
      if (pendingAction.type === 'send') {
        const res = await fetch('/api/physician/prescriptions/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ prescriptionId: pendingAction.prescriptionId }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to send prescription');
        }

        setToast({
          message: `Prescription marked as sent to ${pendingAction.pharmacyName}. Patient notified.`,
          type: 'success',
        });
      } else {
        const nextStatus = pendingAction.type === 'active' ? 'ACTIVE' : 'COMPLETED';
        const res = await fetch(`/api/physician/prescriptions/${pendingAction.prescriptionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status: nextStatus }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to update prescription');
        }

        setToast({
          message:
            nextStatus === 'ACTIVE'
              ? 'Prescription marked as active'
              : 'Treatment marked as completed',
          type: 'success',
        });
      }

      await refreshPrescriptions();
      setPendingAction(null);
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Failed to update prescription',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
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
        onSendToPharmacy={requestSendToPharmacy}
        onSetPharmacy={requestSetPharmacy}
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
                      onClick={() => requestMarkActive(rx.id)}
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
                      onClick={() => requestMarkCompleted(rx.id)}
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

      {/* Pharmacy Search Dialog */}
      <Dialog
        open={pharmacyDialogRxId !== null}
        onOpenChange={(open) => {
          if (!open && !settingPharmacy) setPharmacyDialogRxId(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Set pharmacy for prescription</DialogTitle>
            <DialogDescription>
              Search for the patient&apos;s preferred pharmacy. The prescription cannot be
              sent until a pharmacy is assigned.
            </DialogDescription>
          </DialogHeader>
          <PharmacySearch onSelect={handlePharmacySelected} />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open && !actionLoading) setPendingAction(null);
        }}
      >
        <AlertDialogContent>
          {pendingAction?.type === 'send' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Send prescription to pharmacy?</AlertDialogTitle>
                <AlertDialogDescription>
                  This marks the prescription as sent to <strong>{pendingAction.pharmacyName}</strong>{' '}
                  and notifies the patient. Only confirm after you have actually transmitted the
                  prescription via your e-prescribing app, phone, or fax.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    runPendingAction();
                  }}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Sending…' : 'Confirm sent'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}

          {pendingAction?.type === 'active' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Mark prescription as active?</AlertDialogTitle>
                <AlertDialogDescription>
                  Confirm that {pendingAction.patientName} has picked up their medication and
                  started treatment. This updates the prescription status to ACTIVE.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    runPendingAction();
                  }}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Updating…' : 'Mark active'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}

          {pendingAction?.type === 'completed' && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Mark treatment as completed?</AlertDialogTitle>
                <AlertDialogDescription>
                  Confirm that {pendingAction.patientName}&apos;s treatment course is complete. This
                  updates the prescription status to COMPLETED.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    runPendingAction();
                  }}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Updating…' : 'Mark completed'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
