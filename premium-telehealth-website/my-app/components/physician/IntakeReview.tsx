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
import { IntakeDataView } from './IntakeDataView';
import { DecisionForm, DecisionFormData } from './DecisionForm';
import { IntakeWithPatient } from '@/lib/physician/review-types';
import { IntakeFormData, IntakeScores, RiskAssessment } from '@/types/intake';
import { cn } from '@/lib/utils';

interface IntakeReviewProps {
  intake: IntakeWithPatient;
  physicianId: string;
  physicianName: string;
}

interface SubmissionState {
  status: 'idle' | 'submitting' | 'success' | 'error';
  error?: string;
  reviewId?: string;
}

/**
 * Intake Review Component
 * 
 * Main component for physicians to review patient intakes.
 * Combines patient data display with decision workflow.
 * 
 * HIPAA: All PHI handling follows strict access controls
 */
export function IntakeReview({ intake, physicianId, physicianName }: IntakeReviewProps) {
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

  // Calculate patient age
  const patientAge = React.useMemo(() => {
    if (!intake.patient.dateOfBirth) return null;
    const dob = new Date(intake.patient.dateOfBirth);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }, [intake.patient.dateOfBirth]);

  // Format submitted date
  const submittedDate = React.useMemo(() => {
    if (!intake.submittedAt) return 'Unknown';
    return new Date(intake.submittedAt).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
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
        throw new Error(data.error || 'Failed to submit review');
      }

      setSubmission({
        status: 'success',
        reviewId: data.review?.id || data.reviewId,
      });

      // Redirect after successful submission
      setTimeout(() => {
        const prescriptionId = data.prescription?.id || data.prescriptionId;
        if (decisionData.decision === 'APPROVE' && prescriptionId) {
          router.push(`/physician/prescriptions/${prescriptionId}`);
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
        {/* Status Alerts */}
        {slaStatus?.isOverdue && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>SLA Overdue</AlertTitle>
            <AlertDescription>
              This intake is past the 24-hour review deadline. Please complete the review immediately.
            </AlertDescription>
          </Alert>
        )}

        {slaStatus?.isUrgent && (
          <Alert className="mb-6 border-warning bg-warning/10">
            <Clock className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning-foreground">SLA Warning</AlertTitle>
            <AlertDescription className="text-warning-foreground">
              {slaStatus.hoursRemaining} hours remaining to meet 24-hour review SLA.
            </AlertDescription>
          </Alert>
        )}

        {submission.status === 'success' && (
          <Alert className="mb-6 border-success bg-success/10">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertTitle className="text-success-foreground">Review Submitted</AlertTitle>
            <AlertDescription className="text-success-foreground">
              Your review has been recorded. The patient will be notified.
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar - Patient Summary */}
          <div className="lg:col-span-3 space-y-6">
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
                    <span className="font-medium ml-auto">{submittedDate}</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">SLA:</span>
                    <Badge
                      variant={slaStatus?.isOverdue ? 'destructive' : slaStatus?.isUrgent ? 'secondary' : 'default'}
                      className="ml-auto"
                    >
                      {slaStatus?.isOverdue
                        ? 'Overdue'
                        : slaStatus?.hoursRemaining
                        ? `${slaStatus.hoursRemaining}h left`
                        : 'N/A'}
                    </Badge>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <p className="text-sm font-medium">{intake.patient.email}</p>
                  <p className="text-sm font-medium">{intake.patient.phone}</p>
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
                        {intake.patient.preferredPharmacy.city}, {intake.patient.preferredPharmacy.state}{' '}
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
          <div className="lg:col-span-6 space-y-6">
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
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar - Decision Form */}
          <div className="lg:col-span-3">
            <Card className="sticky top-24">
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
                  onClick={handleSubmit}
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
          </div>
        </div>
      </main>
    </div>
  );
}


