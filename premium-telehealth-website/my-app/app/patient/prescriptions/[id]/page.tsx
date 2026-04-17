'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Pill,
  MapPin,
  Phone,
  Calendar,
  RefreshCw,
  ChevronLeft,
  AlertCircle,
  FileText,
  Loader2,
  CheckCircle,
  Clock,
  Send,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Prescription,
  RefillRequest,
  getPrescriptionStatusDisplay,
  canRequestRefill,
  getDaysUntilRefill,
  formatRefillStatus,
  refillStatusVariants,
} from '@/types/prescriptions';
import { MedicalTerm } from '@/components/patient/MedicalTerm';

interface ApiResponse {
  prescription: Prescription & {
    lastRefillDate: string | null;
    nextRefillAvailable: string | null;
    sentAt: string | null;
    createdAt: string;
  };
  recentRefillRequests: Array<RefillRequest & { requestedAt: string; respondedAt: string | null }>;
}

function TimelineItem({
  icon,
  label,
  date,
  active,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  date?: string | null;
  active: boolean;
  last?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
            active ? 'bg-ocean-500 text-white' : 'bg-gray-200 text-gray-400'
          )}
        >
          {icon}
        </div>
        {!last && <div className={cn('w-px flex-1 mt-1', active ? 'bg-ocean-500' : 'bg-gray-200')} />}
      </div>
      <div className="pb-6">
        <p className={cn('font-medium', active ? 'text-gray-900' : 'text-gray-400')}>{label}</p>
        {date && <p className="text-xs text-gray-500 mt-0.5">{date}</p>}
      </div>
    </div>
  );
}

export default function PrescriptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  const [data, setData] = React.useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [refillLoading, setRefillLoading] = React.useState(false);
  const [refillMessage, setRefillMessage] = React.useState<
    { type: 'success' | 'error'; text: string } | null
  >(null);

  const load = React.useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/patient/prescriptions/${id}`, { credentials: 'include' });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error('Failed to load prescription');
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prescription');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleRefillRequest = async () => {
    if (!data) return;
    setRefillLoading(true);
    setRefillMessage(null);
    try {
      const res = await fetch(`/api/patient/prescriptions/${data.prescription.id}/refill`, {
        method: 'POST',
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRefillMessage({
          type: 'error',
          text: (body as { error?: string }).error || 'Failed to submit refill request. Please try again.',
        });
        return;
      }
      setRefillMessage({
        type: 'success',
        text: 'Refill request submitted. Your physician will review it shortly.',
      });
      await load();
    } catch (err) {
      setRefillMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Network error. Please try again.',
      });
    } finally {
      setRefillLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-40" />
          <div className="h-64 bg-gray-200 rounded" />
          <div className="h-40 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/patient/prescriptions"
          className="inline-flex items-center text-sm text-ocean-600 hover:text-ocean-700 mb-6"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Prescriptions
        </Link>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h2 className="text-lg font-semibold text-gray-900">Prescription not found</h2>
            <p className="text-sm text-gray-600 mt-2">
              We couldn&apos;t find this prescription. It may have been removed or you may not have access.
            </p>
            <Button className="mt-4" onClick={() => router.push('/patient/prescriptions')}>
              Return to Prescriptions
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" size="sm" onClick={load} className="mt-3">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { prescription, recentRefillRequests } = data;
  const statusDisplay = getPrescriptionStatusDisplay(prescription.status);
  const isRefillEligible = canRequestRefill({
    nextRefillAvailable: prescription.nextRefillAvailable ? new Date(prescription.nextRefillAvailable) : null,
    refillsRemaining: prescription.refillsRemaining,
    status: prescription.status,
  });

  const daysUntil = prescription.nextRefillAvailable
    ? getDaysUntilRefill(new Date(prescription.nextRefillAvailable))
    : null;

  // Timeline steps
  const statusOrder = [
    { key: 'PENDING', label: 'Prescription created', icon: <FileText className="h-4 w-4" /> },
    { key: 'SENT', label: 'Sent to pharmacy', icon: <Send className="h-4 w-4" /> },
    { key: 'RECEIVED_BY_PHARMACY', label: 'At pharmacy', icon: <MapPin className="h-4 w-4" /> },
    { key: 'FILLED', label: 'Filled', icon: <Pill className="h-4 w-4" /> },
    { key: 'READY_FOR_PICKUP', label: 'Ready for pickup', icon: <CheckCircle className="h-4 w-4" /> },
    { key: 'PICKED_UP', label: 'Picked up', icon: <CheckCircle className="h-4 w-4" /> },
  ];
  const currentIndex = statusOrder.findIndex((s) => s.key === prescription.status);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Link
        href="/patient/prescriptions"
        className="inline-flex items-center text-sm text-ocean-600 hover:text-ocean-700"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to Prescriptions
      </Link>

      <Card className={cn('border', statusDisplay.color)}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Pill className="h-5 w-5 text-ocean-500" />
                <MedicalTerm term={prescription.medicationName.toLowerCase()}>
                  {prescription.medicationName}
                </MedicalTerm>{' '}
                {prescription.dosage}
              </CardTitle>
              <CardDescription className="mt-1">{statusDisplay.label}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-700">{statusDisplay.description}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Generic name</p>
              <p className="text-sm font-medium text-gray-900">{prescription.genericName || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Quantity</p>
              <p className="text-sm font-medium text-gray-900">{prescription.quantity}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Refills remaining</p>
              <p className="text-sm font-medium text-gray-900">
                {prescription.refillsRemaining} of {prescription.refills}
              </p>
            </div>
            {prescription.sentAt && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Sent</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(prescription.sentAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
            )}
          </div>

          {prescription.instructions && (
            <div className="rounded-lg border border-gray-200 p-4 bg-white">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                Instructions (SIG)
              </p>
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{prescription.instructions}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pharmacy Info */}
      {prescription.pharmacyName && prescription.pharmacyName !== 'Pending' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-ocean-500" />
              Pharmacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium text-gray-900">{prescription.pharmacyName}</p>
            {prescription.pharmacyAddress && (
              <p className="text-gray-600">{prescription.pharmacyAddress}</p>
            )}
            {prescription.pharmacyPhone && (
              <p className="text-gray-600 flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                <a href={`tel:${prescription.pharmacyPhone}`} className="hover:text-ocean-600">
                  {prescription.pharmacyPhone}
                </a>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {currentIndex >= 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-ocean-500" />
              Status Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusOrder.map((step, i) => (
              <TimelineItem
                key={step.key}
                icon={step.icon}
                label={step.label}
                active={i <= currentIndex}
                last={i === statusOrder.length - 1}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Refills */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-ocean-500" />
            Refills
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {prescription.nextRefillAvailable && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4 text-gray-400" />
              Next refill available{' '}
              {new Date(prescription.nextRefillAvailable).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
              {daysUntil !== null && daysUntil > 0 && ` (${daysUntil} days)`}
            </div>
          )}

          {isRefillEligible ? (
            <div className="space-y-2">
              <Button
                className="bg-ocean-500 hover:bg-ocean-600 text-white"
                disabled={refillLoading}
                onClick={handleRefillRequest}
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', refillLoading && 'animate-spin')} />
                {refillLoading ? 'Submitting…' : 'Request Refill'}
              </Button>
              {refillMessage && (
                <p
                  className={cn(
                    'text-sm',
                    refillMessage.type === 'success' ? 'text-green-700' : 'text-red-700'
                  )}
                >
                  {refillMessage.text}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <AlertCircle className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <p className="text-sm text-gray-600">
                {prescription.refillsRemaining <= 0
                  ? 'No refills remaining. Contact your doctor for a new prescription.'
                  : prescription.nextRefillAvailable
                    ? 'You can request a refill within 7 days of the next refill date.'
                    : 'Contact your doctor about refills.'}
              </p>
            </div>
          )}

          {recentRefillRequests.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                Recent requests
              </p>
              <ul className="space-y-2">
                {recentRefillRequests.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-600">
                      {new Date(r.requestedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium border',
                        refillStatusVariants[r.status]
                      )}
                    >
                      {formatRefillStatus(r.status)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {(prescription.status === 'CANCELLED' ||
        prescription.status === 'DENIED' ||
        prescription.status === 'COMPLETED') && (
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-4 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-gray-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-gray-900">This prescription is no longer active.</p>
              <p className="text-sm text-gray-600 mt-1">
                Message your physician if you have questions about next steps.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
