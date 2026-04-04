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
  Phone,
  Plus,
  FileText,
  CheckCircle,
  Send,
  ClipboardList,
  MessageSquare,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { IntakeStatus } from '@prisma/client';
import { PrescriptionSummary, getPrescriptionStatusDisplay, canRequestRefill } from '@/types/prescriptions';

// ============================================================================
// Types
// ============================================================================

interface PrescriptionsApiResponse {
  prescriptions: PrescriptionSummary[];
  intakeStatus: IntakeStatus | null;
  intakeSubmittedAt: string | null;
}

// ============================================================================
// Status-Dependent Content Components
// ============================================================================

function NoIntakeState() {
  return (
    <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
      <CardContent className="p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 mb-4">
          <ClipboardList className="h-8 w-8 text-amber-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Your intake form has not been submitted yet
        </h3>
        <p className="text-gray-600 max-w-md mx-auto mb-6">
          Please complete your intake form so our medical team can review your case.
        </p>
        <Link href="/intake">
          <Button className="bg-amber-600 hover:bg-amber-700 text-white">
            <ClipboardList className="h-4 w-4 mr-2" />
            Complete Intake Form
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function UnderReviewState() {
  return (
    <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-ocean-50">
      <CardContent className="p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mb-4">
          <Clock className="h-8 w-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Your intake is under review
        </h3>
        <p className="text-gray-600 max-w-md mx-auto">
          Our medical team is reviewing your intake form. Once approved, your subscription will activate
          and your physician will send your prescription. You will not be charged until approval.
          This typically takes less than 24 hours.
        </p>
      </CardContent>
    </Card>
  );
}

function RejectedState() {
  return (
    <Card className="border-red-200 bg-gradient-to-r from-red-50 to-orange-50">
      <CardContent className="p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
          <XCircle className="h-8 w-8 text-red-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Your intake was not approved
        </h3>
        <p className="text-gray-600 max-w-md mx-auto mb-4">
          Your physician has reviewed your intake and determined that this treatment is not appropriate
          at this time. No charges have been applied to your payment method.
        </p>
        <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
          Your account will remain accessible for 30 days. Please check your messages for details from your physician.
        </p>
        <Link href="/patient/messages">
          <Button className="bg-ocean-500 hover:bg-ocean-600 text-white">
            <MessageSquare className="h-4 w-4 mr-2" />
            Message Your Doctor
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function PrescriptionStatusCard({ prescription }: { prescription: PrescriptionSummary }) {
  const statusDisplay = getPrescriptionStatusDisplay(prescription.status);
  const isRefillEligible = canRequestRefill(prescription);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn('border', statusDisplay.color)}>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                {prescription.status === 'PENDING' && <Clock className="h-5 w-5 text-amber-600" />}
                {prescription.status === 'SENT' && <Send className="h-5 w-5 text-blue-600" />}
                {(prescription.status === 'ACTIVE' || prescription.status === 'PICKED_UP') && <Pill className="h-5 w-5 text-green-600" />}
                {prescription.status === 'COMPLETED' && <CheckCircle className="h-5 w-5 text-gray-600" />}
                {(prescription.status === 'CANCELLED' || prescription.status === 'DENIED') && <XCircle className="h-5 w-5 text-red-600" />}
                {!['PENDING', 'SENT', 'ACTIVE', 'PICKED_UP', 'COMPLETED', 'CANCELLED', 'DENIED'].includes(prescription.status) && (
                  <Pill className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg">{statusDisplay.label}</CardTitle>
                <CardDescription className="mt-1">{statusDisplay.description}</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Medication Info — safe to show (Naltrexone is on the public marketing site) */}
          {prescription.status === 'ACTIVE' && (
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <p className="text-sm text-gray-500">Medication</p>
              <p className="font-semibold text-gray-900">Naltrexone 50mg</p>
            </div>
          )}

          {/* Pharmacy Info */}
          {prescription.pharmacyName && prescription.pharmacyName !== 'Pending' && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">{prescription.pharmacyName}</p>
                {prescription.pharmacyAddress && (
                  <p className="text-sm text-gray-500">{prescription.pharmacyAddress}</p>
                )}
              </div>
            </div>
          )}

          {prescription.pharmacyName === 'Pending' && prescription.status === 'PENDING' && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700">Pharmacy not yet assigned</p>
            </div>
          )}

          {/* Sent date */}
          {prescription.sentAt && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">
                Sent on {new Date(prescription.sentAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}

          {/* Refill info for ACTIVE prescriptions */}
          {prescription.status === 'ACTIVE' && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Refills remaining</span>
                <span className="font-medium text-gray-900">
                  {prescription.refillsRemaining} of {prescription.refills}
                </span>
              </div>

              {prescription.nextRefillAvailable && (
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Next refill available:{' '}
                    {new Date(prescription.nextRefillAvailable).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}

              {isRefillEligible && (
                <Button className="w-full bg-ocean-500 hover:bg-ocean-600 text-white">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Request Refill
                </Button>
              )}
            </>
          )}

          {/* CTA for completed/cancelled */}
          {(prescription.status === 'COMPLETED' || prescription.status === 'CANCELLED' || prescription.status === 'DENIED') && (
            <Link href="/patient/messages">
              <Button variant="outline" className="w-full">
                <MessageSquare className="h-4 w-4 mr-2" />
                Message Your Doctor
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================================================
// Main Prescriptions Page
// ============================================================================

export default function PrescriptionsPage() {
  const [prescriptions, setPrescriptions] = React.useState<PrescriptionSummary[]>([]);
  const [intakeStatus, setIntakeStatus] = React.useState<IntakeStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadPrescriptions() {
      try {
        const res = await fetch('/api/patient/prescriptions', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load prescriptions');
        const data: PrescriptionsApiResponse = await res.json();
        setPrescriptions(Array.isArray(data.prescriptions) ? data.prescriptions : []);
        setIntakeStatus(data.intakeStatus);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load prescriptions');
      } finally {
        setIsLoading(false);
      }
    }
    loadPrescriptions();
  }, []);

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

  // Determine what to show based on intake/prescription state
  const hasIntake = intakeStatus !== null;
  const intakeSubmitted = intakeStatus === 'SUBMITTED' || intakeStatus === 'UNDER_REVIEW';
  const intakeRejected = intakeStatus === 'REJECTED';
  const intakeNeedsInfo = intakeStatus === 'NEEDS_INFO';
  const activePrescriptions = prescriptions.filter(
    (p) => !['CANCELLED', 'EXPIRED', 'COMPLETED', 'DENIED'].includes(p.status)
  );
  const pastPrescriptions = prescriptions.filter(
    (p) => ['CANCELLED', 'EXPIRED', 'COMPLETED', 'DENIED'].includes(p.status)
  );

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

      {/* No intake submitted yet */}
      {(!hasIntake || intakeStatus === 'DRAFT') && prescriptions.length === 0 && (
        <NoIntakeState />
      )}

      {/* Intake submitted but not reviewed */}
      {intakeSubmitted && prescriptions.length === 0 && (
        <UnderReviewState />
      )}

      {/* Intake rejected */}
      {intakeRejected && prescriptions.length === 0 && (
        <RejectedState />
      )}

      {/* Intake needs info */}
      {intakeNeedsInfo && prescriptions.length === 0 && (
        <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 mb-4">
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Additional information needed
            </h3>
            <p className="text-gray-600 max-w-md mx-auto mb-6">
              Your physician needs more information to complete your review. Please check your messages.
            </p>
            <Link href="/patient/messages">
              <Button className="bg-ocean-500 hover:bg-ocean-600 text-white">
                <MessageSquare className="h-4 w-4 mr-2" />
                Check Messages
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Prescriptions exist — show status cards */}
      {prescriptions.length > 0 && (
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
              <div className="grid gap-4">
                {activePrescriptions.map((prescription) => (
                  <PrescriptionStatusCard key={prescription.id} prescription={prescription} />
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
              <div className="grid gap-4 opacity-75">
                {pastPrescriptions.map((prescription) => (
                  <PrescriptionStatusCard key={prescription.id} prescription={prescription} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Help Card */}
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
