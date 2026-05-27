'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronLeft, Stethoscope, Clock, Calendar, CheckCircle2, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LoadingButton } from '@/components/ui/LoadingButton';
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
import { IntakeDataView } from './IntakeDataView';
import { DecisionForm, DecisionFormData } from './DecisionForm';
import { IntakeWithPatient } from '@/lib/physician/review-types';
import { IntakeFormData, IntakeScores, RiskAssessment } from '@/types/intake';
import { cn } from '@/lib/utils';
import { maskPhone, maskEmail } from '@/lib/utils/string-helpers';
import { formatClinicDateTime } from '@/lib/utils/date-helpers';

interface IntakeReviewProps {
  intake: IntakeWithPatient;
  physicianId: string;
  physicianName: string;
  isDeactivated?: boolean;
  /** When true, hide the decision form (e.g. viewing an already-decided intake from the review history). */
  isReadOnly?: boolean;
}

interface SubmissionState {
  status: 'idle' | 'submitting' | 'success' | 'error';
  error?: string;
  reviewId?: string;
  /** Decision the submission settled on — used to tailor the success message. */
  decision?: 'APPROVE' | 'REJECT' | 'NEEDS_INFO' | null;
  /** Medication name shown in the approval success message. */
  medicationName?: string;
}

/**
 * Intake Review Component
 * 
 * Main component for physicians to review patient intakes.
 * Combines patient data display with decision workflow.
 * 
 * HIPAA: All PHI handling follows strict access controls
 */
export function IntakeReview({ intake, physicianId, physicianName, isDeactivated = false, isReadOnly = false }: IntakeReviewProps) {
  const router = useRouter();
  const [submission, setSubmission] = React.useState<SubmissionState>({ status: 'idle' });
  const [decisionData, setDecisionData] = React.useState<DecisionFormData>({
    decision: null,
    clinicalNotes: '',
    medication: null,
    rejectionReason: '',
    alternativeRecommendation: '',
    requestedInfo: '',
  });
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});
  const [approveConfirmOpen, setApproveConfirmOpen] = React.useState(false);

  // Calculate patient age
  const patientAge = React.useMemo(() => {
    if (!intake.patient.dateOfBirth) return null;
    // Parse YYYY-MM-DD as local date to avoid timezone shift
    const dobStr = String(intake.patient.dateOfBirth);
    let dob: Date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) {
      const [y, m, d] = dobStr.split('-').map(Number);
      dob = new Date(y, m - 1, d);
    } else {
      dob = new Date(dobStr);
    }
    if (isNaN(dob.getTime())) return null;
    // Sentinel value: epoch (1970) means DOB is unknown
    if (dob.getTime() === 0) return null;
    // Reject clearly invalid dates (before 1900 or in the future)
    const today = new Date();
    if (dob.getFullYear() < 1900 || dob > today) return null;
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }, [intake.patient.dateOfBirth]);

  // Format submitted date in the clinic timezone so it matches the review
  // history table and is identical across physicians' browsers (PORTAL-02).
  const submittedDate = React.useMemo(() => {
    if (!intake.submittedAt) return 'Unknown';
    return formatClinicDateTime(intake.submittedAt);
  }, [intake.submittedAt]);

  // Calculate SLA deadline (24 hours from submission)
  const slaStatus = React.useMemo(() => {
    if (!intake.submittedAt) return null;
    const submitted = new Date(intake.submittedAt);
    const deadline = new Date(submitted.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    const hoursRemaining = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60));

    return {
      deadline,
      hoursRemaining,
      isOverdue: hoursRemaining < 0,
      isUrgent: hoursRemaining < 4 && hoursRemaining >= 0,
    };
  }, [intake.submittedAt]);

  // Validate form before submission
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!decisionData.decision) {
      errors.decision = 'Please select a decision';
    }

    if (!decisionData.clinicalNotes || decisionData.clinicalNotes.length < 10) {
      errors.clinicalNotes = 'Clinical notes are required (minimum 10 characters)';
    }

    if (decisionData.decision === 'APPROVE') {
      if (!decisionData.medication) {
        errors.medication = 'Please select a medication';
      }
    }

    if (decisionData.decision === 'REJECT') {
      if (!decisionData.rejectionReason) {
        errors.rejectionReason = 'Please select a rejection reason';
      }
    }

    if (decisionData.decision === 'NEEDS_INFO') {
      if (!decisionData.requestedInfo || decisionData.requestedInfo.length < 10) {
        errors.requestedInfo = 'Please specify what information is needed';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmission({ status: 'submitting' });

    try {
      // Map component decision values to API expected values
      const decisionMap: Record<string, string> = {
        APPROVE: 'APPROVED',
        REJECT: 'DECLINED',
        NEEDS_INFO: 'NEEDS_INFO',
      };

      const response = await fetch('/api/physician/review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intakeId: intake.id,
          decision: decisionMap[decisionData.decision || ''] || decisionData.decision,
          notes: decisionData.clinicalNotes,
          prescriptionDetails: decisionData.medication ? {
            medicationName: decisionData.medication.name,
            genericName: decisionData.medication.genericName,
            dosage: decisionData.medication.dosage,
            frequency: 'Once daily',
            quantity: decisionData.medication.quantity,
            refills: decisionData.medication.refills,
            instructions: decisionData.medication.instructions,
          } : undefined,
          rejectionReason: decisionData.rejectionReason || undefined,
          alternativeRecommendation: decisionData.alternativeRecommendation || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Surface validation details if available
        const details = data.details
          ? ` (${Array.isArray(data.details) ? data.details.map((d: { message?: string; path?: string[] }) => d.message || d.path?.join('.')).join(', ') : JSON.stringify(data.details)})`
          : '';
        throw new Error((data.error || 'Failed to submit review') + details);
      }

      setSubmission({
        status: 'success',
        reviewId: data.review?.id || data.reviewId,
        decision: decisionData.decision,
        medicationName: decisionData.medication?.name,
      });

      // Redirect after successful submission.
      // Approvals go to the prescriptions list (the newly created Rx will be
      // at the top, awaiting "Send to pharmacy"). The per-prescription detail
      // page doesn't exist yet, so the old /physician/prescriptions/{id}
      // redirect 404'd.
      setTimeout(() => {
        if (decisionData.decision === 'APPROVE') {
          router.push('/physician/prescriptions');
        } else {
          router.push('/physician/dashboard');
        }
      }, 2000);
    } catch (error) {
      setSubmission({
        status: 'error',
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    }
  };

  // Get concern type from form data
  const concernType = (intake.formData?.primaryConcern as string) || 'ALCOHOL';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/physician/dashboard')}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                <span className="font-semibold text-lg">Intake Review</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {physicianName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:inline">{physicianName}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Alerts (hidden for already-reviewed intakes) */}
        {!isReadOnly && slaStatus?.isOverdue && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>SLA Overdue</AlertTitle>
            <AlertDescription>
              This intake is past the 24-hour review deadline. Please complete the review immediately.
            </AlertDescription>
          </Alert>
        )}

        {!isReadOnly && slaStatus?.isUrgent && (
          <Alert className="mb-6 border-warning bg-warning/10">
            <Clock className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning-foreground">SLA Warning</AlertTitle>
            <AlertDescription className="text-warning-foreground">
              {slaStatus.hoursRemaining} hours remaining to meet 24-hour review SLA.
            </AlertDescription>
          </Alert>
        )}

        {isDeactivated && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="font-medium">Account Deactivated</p>
                <p className="text-sm mt-1">
                  This patient&apos;s account has been deactivated. You can still complete this review
                  if it was in progress before deactivation.
                </p>
              </div>
            </div>
          </div>
        )}

        {submission.status === 'success' && (
          <Alert className="mb-6 border-success bg-success/10">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertTitle className="text-success-foreground">
              {submission.decision === 'APPROVE'
                ? 'Intake Approved'
                : submission.decision === 'REJECT'
                  ? 'Intake Declined'
                  : 'Review Submitted'}
            </AlertTitle>
            <AlertDescription className="text-success-foreground">
              {submission.decision === 'APPROVE' && submission.medicationName
                ? `Prescription created for ${submission.medicationName}. Redirecting to prescriptions…`
                : submission.decision === 'APPROVE'
                  ? 'Prescription created. Redirecting to prescriptions…'
                  : 'Your review has been recorded. The patient will be notified.'}
            </AlertDescription>
          </Alert>
        )}

        {submission.status === 'error' && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Submission Failed</AlertTitle>
            <AlertDescription>{submission.error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8">
          {/* Left Sidebar - Patient Summary */}
          <div className="md:col-span-4 lg:col-span-3 space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Patient Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <Avatar className="h-20 w-20 mx-auto mb-3">
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                      {intake.patient.firstName?.[0] ?? ''}
                      {intake.patient.lastName?.[0] ?? ''}
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="font-semibold text-lg">
                    {intake.patient.firstName} {intake.patient.lastName}
                  </h3>
                  <p className="text-sm text-muted-foreground">{patientAge !== null ? `${patientAge} years old` : 'Age unknown'}</p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Submitted:</span>
                    <span className="font-medium ml-auto" suppressHydrationWarning>{submittedDate}</span>
                  </div>

                  {/* SLA pill is meaningless once an intake is decided — hide it
                      when viewing a read-only/already-reviewed intake.
                      suppressHydrationWarning: hoursRemaining is computed from
                      `new Date()` at render time and can shift between SSR and
                      hydration. */}
                  {!isReadOnly && (
                    <div className="flex items-center gap-2 text-sm" suppressHydrationWarning>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">SLA:</span>
                      <Badge
                        variant={slaStatus?.isOverdue ? 'destructive' : slaStatus?.isUrgent ? 'secondary' : 'default'}
                        className="ml-auto"
                      >
                        {slaStatus?.isOverdue
                          ? 'Overdue'
                          : slaStatus?.hoursRemaining != null
                          ? `${slaStatus.hoursRemaining}h left`
                          : 'N/A'}
                      </Badge>
                    </div>
                  )}

                  {isReadOnly && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant="secondary" className="ml-auto">
                        Reviewed
                      </Badge>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <p className="text-sm font-medium break-all">{maskEmail(intake.patient.email)}</p>
                  <p className="text-sm font-medium">{maskPhone(intake.patient.phone)}</p>
                </div>

                {intake.patient.address && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="text-sm">{intake.patient.address.street}</p>
                      <p className="text-sm">
                        {intake.patient.address.city}, {intake.patient.address.state}{' '}
                        {intake.patient.address.zipCode}
                      </p>
                    </div>
                  </>
                )}

                {intake.patient.preferredPharmacy && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        Preferred Pharmacy
                      </p>
                      <p className="text-sm font-medium">{intake.patient.preferredPharmacy.name}</p>
                      <p className="text-sm">{intake.patient.preferredPharmacy.address}</p>
                      <p className="text-sm">
                        {intake.patient.preferredPharmacy.city}, {intake.patient.preferredPharmacy.state || 'CA'}{' '}
                        {intake.patient.preferredPharmacy.zipCode}
                      </p>
                      {intake.patient.preferredPharmacy.phone && (
                        <p className="text-sm text-ocean-600">{intake.patient.preferredPharmacy.phone}</p>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Quick Reference Card */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-blue-900">Quick Reference</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-blue-900">24-Hour SLA</p>
                  <p className="text-blue-800">
                    All intakes must be reviewed within 24 hours of submission.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-blue-900">Documentation</p>
                  <p className="text-blue-800">
                    Clinical notes are required for all decisions and become part of the medical
                    record.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-blue-900">Notifications</p>
                  <p className="text-blue-800">
                    Patients are automatically notified of review decisions.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className={cn(
            'md:col-span-8 space-y-6',
            decisionData.decision === 'APPROVE' ? 'lg:col-span-4' : 'lg:col-span-5'
          )}>
            {/* Intake Data */}
            <Card>
              <CardHeader>
                <CardTitle>Intake Form Data</CardTitle>
              </CardHeader>
              <CardContent>
                <IntakeDataView
                  formData={intake.formData as IntakeFormData}
                  scores={intake.scores as IntakeScores | undefined}
                  riskAssessment={intake.riskAssessment as RiskAssessment | undefined}
                  preferredPharmacy={intake.patient.preferredPharmacy ?? undefined}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar - Decision Form (hidden when viewing an already-reviewed intake) */}
          <div className={cn(
            'md:col-span-12',
            decisionData.decision === 'APPROVE' ? 'lg:col-span-5' : 'lg:col-span-4'
          )}>
            {isReadOnly ? (
              <Card className="lg:sticky lg:top-24 bg-gray-50">
                <CardHeader>
                  <CardTitle className="text-base">Review Decision</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Decision
                    </p>
                    <Badge variant="secondary" className="text-sm">
                      {(intake.review?.decision || intake.status).replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  {intake.review?.clinicalNotes && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Clinical Notes
                      </p>
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {intake.review.clinicalNotes}
                      </p>
                    </div>
                  )}

                  {intake.review?.rejectionReason && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Rejection Reason
                      </p>
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {intake.review.rejectionReason}
                      </p>
                    </div>
                  )}

                  {intake.review?.alternativeRecommendation && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Alternative Recommendation
                      </p>
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {intake.review.alternativeRecommendation}
                      </p>
                    </div>
                  )}

                  {(intake.review?.completedAt || intake.review?.physicianName) && (
                    <div className="pt-2 border-t border-gray-200 space-y-1 text-xs text-muted-foreground">
                      {intake.review?.completedAt && (
                        <p>
                          Reviewed:{' '}
                          {formatClinicDateTime(intake.review.completedAt)}
                        </p>
                      )}
                      {intake.review?.physicianName && (
                        <p>By: {intake.review.physicianName}</p>
                      )}
                    </div>
                  )}

                  {!intake.review && (
                    <p className="text-sm text-muted-foreground">
                      This intake has already been reviewed. Review details are not available.
                    </p>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => router.push('/physician/reviews')}
                  >
                    Back to Review History
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="lg:sticky lg:top-24">
                <CardHeader>
                  <CardTitle className="text-base">Review Decision</CardTitle>
                </CardHeader>
                <CardContent>
                  <DecisionForm
                    value={decisionData}
                    onChange={setDecisionData}
                    concernType={concernType}
                    formData={intake.formData as IntakeFormData}
                    disabled={submission.status === 'submitting' || submission.status === 'success'}
                    errors={validationErrors}
                  />
                </CardContent>
                <CardFooter className="flex-col gap-3">
                  <LoadingButton
                    onClick={() => {
                      if (decisionData.decision === 'APPROVE') {
                        if (!validateForm()) return;
                        setApproveConfirmOpen(true);
                        return;
                      }
                      handleSubmit();
                    }}
                    loading={submission.status === 'submitting'}
                    disabled={submission.status === 'success'}
                    className="w-full"
                  >
                    Submit Review
                  </LoadingButton>
                  <p className="text-xs text-muted-foreground text-center">
                    This action is logged and cannot be undone.
                  </p>
                </CardFooter>
              </Card>
            )}
          </div>
        </div>
      </main>

      <AlertDialog
        open={approveConfirmOpen}
        onOpenChange={(open) => {
          if (!open && submission.status !== 'submitting') setApproveConfirmOpen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this intake?</AlertDialogTitle>
            <AlertDialogDescription>
              Approving this intake will charge the patient&apos;s saved payment method, create a
              prescription record for the selected medication, and notify the patient. This action
              is logged and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submission.status === 'submitting'}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setApproveConfirmOpen(false);
                void handleSubmit();
              }}
              disabled={submission.status === 'submitting'}
            >
              {submission.status === 'submitting' ? 'Submitting…' : 'Confirm & Approve'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


