'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Pill, 
  Clock, 
  Calendar, 
  MapPin, 
  RefreshCw,
  AlertCircle,
  ChevronRight,
  Phone,
  Plus,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PrescriptionStatus } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

interface Prescription {
  id: string;
  medicationName: string;
  genericName: string;
  dosage: string;
  quantity: number;
  refills: number;
  refillsRemaining: number;
  pharmacyName: string;
  status: PrescriptionStatus;
  lastRefillDate: Date | null;
  nextRefillAvailable: Date | null;
}

// ============================================================================
// Utility Functions
// ============================================================================

function getDaysRemaining(prescription: { quantity: number; lastRefillDate: Date | null }): number {
  const daysSupply = prescription.quantity;
  const daysSinceLastFill = prescription.lastRefillDate
    ? Math.floor((Date.now() - new Date(prescription.lastRefillDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  return Math.max(0, daysSupply - daysSinceLastFill);
}

function formatPrescriptionStatus(status: PrescriptionStatus): string {
  const statusMap: Record<PrescriptionStatus, string> = {
    PENDING: 'Pending',
    SENT: 'Sent to Pharmacy',
    RECEIVED_BY_PHARMACY: 'At Pharmacy',
    FILLED: 'Being Filled',
    READY_FOR_PICKUP: 'Ready for Pickup',
    PICKED_UP: 'Picked Up',
    CANCELLED: 'Cancelled',
    EXPIRED: 'Expired',
  };
  return statusMap[status] || status;
}

function getStatusColor(status: PrescriptionStatus): string {
  const colorMap: Record<PrescriptionStatus, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    SENT: 'bg-blue-100 text-blue-800 border-blue-200',
    RECEIVED_BY_PHARMACY: 'bg-purple-100 text-purple-800 border-purple-200',
    FILLED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    READY_FOR_PICKUP: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    PICKED_UP: 'bg-green-100 text-green-800 border-green-200',
    CANCELLED: 'bg-red-100 text-red-800 border-red-200',
    EXPIRED: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  return colorMap[status];
}

// ============================================================================
// Components
// ============================================================================

function PrescriptionCard({ 
  prescription, 
  onRequestRefill 
}: { 
  prescription: Prescription;
  onRequestRefill: (id: string) => void;
}) {
  const daysRemaining = getDaysRemaining(prescription);
  const percentage = (daysRemaining / prescription.quantity) * 100;

  const canRefill = prescription.refillsRemaining > 0 && 
    prescription.status !== 'CANCELLED' && 
    prescription.status !== 'EXPIRED' &&
    daysRemaining <= 7;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-ocean-50 rounded-lg">
                <Pill className="h-5 w-5 text-ocean-600" />
              </div>
              <div>
                <CardTitle className="text-lg">{prescription.medicationName}</CardTitle>
                <CardDescription>{prescription.genericName}</CardDescription>
                <p className="text-sm font-medium text-gray-700 mt-1">
                  {prescription.dosage}
                </p>
              </div>
            </div>
            <Badge variant="outline" className={cn('shrink-0', getStatusColor(prescription.status))}>
              {formatPrescriptionStatus(prescription.status)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {prescription.lastRefillDate && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">{daysRemaining} days remaining</span>
                <span className="text-sm text-gray-500">{prescription.quantity} day supply</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full transition-all duration-500',
                    percentage <= 20 ? 'bg-red-500' : percentage <= 40 ? 'bg-amber-500' : 'bg-ocean-500'
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600">
                {prescription.refillsRemaining} of {prescription.refills} refills left
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600 truncate">{prescription.pharmacyName}</span>
            </div>
            {prescription.lastRefillDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">
                  Filled {new Date(prescription.lastRefillDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
            {prescription.nextRefillAvailable && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className={cn(
                  'text-gray-600',
                  daysRemaining <= 7 && 'text-amber-600 font-medium'
                )}>
                  Refill {new Date(prescription.nextRefillAvailable).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onRequestRefill(prescription.id)}
              disabled={!canRefill}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Request Refill
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <Card className="text-center py-12">
      <CardContent>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 mb-4">
          <Pill className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No Prescriptions Yet
        </h3>
        <p className="text-gray-600 max-w-sm mx-auto mb-6">
          Once your physician reviews your intake and prescribes medication, 
          you&apos;ll see it here.
        </p>
        <Link href="/patient/dashboard">
          <Button variant="outline">
            Go to Dashboard
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Prescriptions Page
// ============================================================================

export default function PrescriptionsPage() {
  const [prescriptions, setPrescriptions] = React.useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadPrescriptions() {
      try {
        const res = await fetch('/api/patient/prescriptions', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load prescriptions');
        const data = await res.json();
        setPrescriptions(data.prescriptions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load prescriptions');
      } finally {
        setIsLoading(false);
      }
    }
    loadPrescriptions();
  }, []);

  const handleRequestRefill = async (prescriptionId: string) => {
    try {
      const res = await fetch(`/api/patient/prescriptions/${prescriptionId}/refill`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to request refill');
      }
      setError(null);
      // Reload prescriptions to show updated state
      const updated = await fetch('/api/patient/prescriptions', { credentials: 'include' });
      if (updated.ok) {
        const data = await updated.json();
        setPrescriptions(data.prescriptions || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request refill');
    }
  };

  const activePrescriptions = prescriptions.filter(
    (p) => p.status !== 'CANCELLED' && p.status !== 'EXPIRED'
  );
  
  const pastPrescriptions = prescriptions.filter(
    (p) => p.status === 'CANCELLED' || p.status === 'EXPIRED'
  );

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Prescriptions</h1>
          <p className="text-gray-600 mt-1">View and manage your medications</p>
        </div>
        <Link href="/patient/dashboard">
          <Button variant="outline" size="sm">
            Back to Dashboard
          </Button>
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {prescriptions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {activePrescriptions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Pill className="h-5 w-5 text-ocean-500" />
                Active Prescriptions
                <Badge variant="secondary" className="ml-2">
                  {activePrescriptions.length}
                </Badge>
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {activePrescriptions.map((prescription) => (
                  <PrescriptionCard
                    key={prescription.id}
                    prescription={prescription}
                    onRequestRefill={handleRequestRefill}
                  />
                ))}
              </div>
            </div>
          )}

          {pastPrescriptions.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-400" />
                Past Prescriptions
                <Badge variant="secondary" className="ml-2">
                  {pastPrescriptions.length}
                </Badge>
              </h2>
              <div className="grid gap-4 md:grid-cols-2 opacity-75">
                {pastPrescriptions.map((prescription) => (
                  <PrescriptionCard
                    key={prescription.id}
                    prescription={prescription}
                    onRequestRefill={handleRequestRefill}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Card className="mt-8 bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-100 rounded-lg shrink-0">
              <Phone className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-blue-900 mb-1">
                Need help with your prescriptions?
              </h3>
              <p className="text-sm text-blue-700 mb-4">
                If you have questions about your medications, side effects, or need 
                to request a new prescription, message your physician.
              </p>
              <Link href="/patient/messages">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Message Your Doctor
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
