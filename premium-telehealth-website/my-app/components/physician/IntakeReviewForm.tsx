/**
 * IntakeReviewForm Component
 * 
 * Form for physicians to review patient intakes, make decisions,
 * add diagnoses, and prescribe medications.
 * 
 * @module components/physician/IntakeReviewForm
 */

'use client';

import * as React from 'react';
import { useState } from 'react';
import { useForm, useFieldArray, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  XCircle,
  HelpCircle,
  Plus,
  X,
  AlertTriangle,
  FileText,
  User,
  Activity,
  Pill,
} from 'lucide-react';
import {
  ReviewQueueItem,
  IntakeReviewFormData,
  DiagnosisCode,
  ReviewDecision,
  TREATMENT_TYPE_LABELS,
  ReviewPrescription,
} from '@/types/physician-dashboard';
import { RiskBadge } from '@/components/shared/StatusBadge';
import { PrescriptionWriter } from './PrescriptionWriter';

// ============================================================================
// Validation Schema
// ============================================================================

const diagnosisSchema = z.object({
  code: z.string().min(1, 'ICD-10 code is required'),
  description: z.string().min(1, 'Description is required'),
});

const reviewFormSchema = z.discriminatedUnion('decision', [
  // Approved schema
  z.object({
    decision: z.literal('APPROVED'),
    notes: z.string().min(1, 'Clinical notes are required'),
    internalNotes: z.string().optional(),
    diagnosis: z.array(diagnosisSchema).min(1, 'At least one diagnosis is required'),
    prescription: z.object({
      medicationName: z.string().min(1, 'Medication is required'),
      dosage: z.string().min(1, 'Dosage is required'),
      frequency: z.string().min(1, 'Frequency is required'),
      quantity: z.number().min(1, 'Quantity must be at least 1'),
      refills: z.number().min(0, 'Refills cannot be negative'),
      instructions: z.string().optional(),
    }).optional(),
  }),
  // Declined schema
  z.object({
    decision: z.literal('DECLINED'),
    notes: z.string().min(1, 'Please provide a reason for declining'),
    internalNotes: z.string().optional(),
    diagnosis: z.array(diagnosisSchema).optional(),
    declineReason: z.string().min(1, 'Decline reason is required'),
  }),
  // Needs info schema
  z.object({
    decision: z.literal('NEEDS_INFO'),
    notes: z.string().min(1, 'Please specify what information is needed'),
    internalNotes: z.string().optional(),
    diagnosis: z.array(diagnosisSchema).optional(),
    informationRequested: z.string().min(1, 'Please specify what information is needed'),
  }),
]);

type ReviewFormValues = z.infer<typeof reviewFormSchema>;

// Extended errors type to handle discriminated union fields
type ReviewFormErrors = FieldErrors<ReviewFormValues> & {
  declineReason?: { message?: string };
  informationRequested?: { message?: string };
};

// ============================================================================
// Props Interface
// ============================================================================

interface IntakeReviewFormProps {
  /** Queue item being reviewed */
  queueItem: ReviewQueueItem;
  /** Full intake data */
  intakeData?: {
    formData: Record<string, unknown>;
    scores?: {
      auditScore?: number;
      /** @deprecated Smoking cessation removed from platform 2026-02-28 */
      fagerstromScore?: number;
      riskScore: number;
    };
    medicalHistory?: {
      conditions: string[];
      medications: string[];
      allergies: string[];
    };
  };
  /** Submit handler */
  onSubmit: (data: IntakeReviewFormData) => Promise<void>;
  /** Cancel handler */
  onCancel: () => void;
  /** Loading state */
  isSubmitting?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Common ICD-10 Codes for Addiction Treatment
// ============================================================================

const commonDiagnoses = [
  { code: 'F10.20', description: 'Alcohol dependence, uncomplicated' },
  { code: 'F10.21', description: 'Alcohol dependence, in remission' },
  { code: 'F10.10', description: 'Alcohol abuse, uncomplicated' },
];

// ============================================================================
// Component
// ============================================================================

/**
 * IntakeReviewForm for reviewing patient intakes
 * 
 * @example
 * ```tsx
 * <IntakeReviewForm
 *   queueItem={queueItem}
 *   intakeData={intakeData}
 *   onSubmit={async (data) => await submitReview(data)}
 *   onCancel={() => router.back()}
 * />
 * ```
 */
export function IntakeReviewForm({
  queueItem,
  intakeData,
  onSubmit,
  onCancel,
  isSubmitting = false,
  className,
}: IntakeReviewFormProps) {
  const [selectedDecision, setSelectedDecision] = useState<ReviewDecision | null>(null);
  const [showPrescriptionWriter, setShowPrescriptionWriter] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors: rawErrors },
  } = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      decision: undefined,
      notes: '',
      internalNotes: '',
      diagnosis: [],
    },
  });

  const errors = rawErrors as ReviewFormErrors;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'diagnosis',
  });

  const decision = watch('decision');
  const diagnosisList = watch('diagnosis');

  const handleDecisionSelect = (decision: ReviewDecision) => {
    setSelectedDecision(decision);
    setValue('decision', decision);
  };

  const handleFormSubmit = async (values: ReviewFormValues) => {
    await onSubmit(values as IntakeReviewFormData);
  };

  const addDiagnosis = (code: string, description: string) => {
    if (!diagnosisList?.some((d) => d.code === code)) {
      append({ code, description });
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Patient Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Patient Summary
              </CardTitle>
              <CardDescription>
                Review the patient information before making a decision
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {TREATMENT_TYPE_LABELS[queueItem.treatmentType]}
              </Badge>
              <RiskBadge level={queueItem.riskLevel} score={queueItem.riskScore} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{queueItem.patientName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Age</p>
              <p className="font-medium">{queueItem.patientAge} years</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Submitted</p>
              <p className="font-medium">
                {new Date(queueItem.submittedAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Wait Time</p>
              <p className={cn('font-medium', queueItem.isOverdue && 'text-red-600')}>
                {Math.round(queueItem.waitTimeHours)}h
              </p>
            </div>
          </div>

          {/* Assessment Scores */}
          {intakeData?.scores && (
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Assessment Scores
              </h4>
              <div className="grid grid-cols-3 gap-4">
                {intakeData.scores.auditScore !== undefined && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">AUDIT-C Score</p>
                    <p className="text-lg font-semibold">{intakeData.scores.auditScore}/12</p>
                  </div>
                )}
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Risk Score</p>
                  <p className="text-lg font-semibold">{intakeData.scores.riskScore}/100</p>
                </div>
              </div>
            </div>
          )}

          {/* Medical History Summary */}
          {intakeData?.medicalHistory && (
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Medical History Summary
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Conditions</p>
                  <p>{intakeData.medicalHistory.conditions.join(', ') || 'None reported'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Current Medications</p>
                  <p>{intakeData.medicalHistory.medications.join(', ') || 'None reported'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Allergies</p>
                  <p>{intakeData.medicalHistory.allergies.join(', ') || 'None reported'}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Review Decision</CardTitle>
          <CardDescription>Select your decision for this intake</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => handleDecisionSelect('APPROVED')}
              className={cn(
                'flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-all',
                selectedDecision === 'APPROVED'
                  ? 'border-green-500 bg-green-50'
                  : 'border-border hover:border-green-300'
              )}
            >
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-center">
                <p className="font-semibold">Approve</p>
                <p className="text-sm text-muted-foreground">Approve and prescribe</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleDecisionSelect('NEEDS_INFO')}
              className={cn(
                'flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-all',
                selectedDecision === 'NEEDS_INFO'
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-border hover:border-amber-300'
              )}
            >
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <HelpCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div className="text-center">
                <p className="font-semibold">Request Info</p>
                <p className="text-sm text-muted-foreground">Ask for more information</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleDecisionSelect('DECLINED')}
              className={cn(
                'flex flex-col items-center gap-3 p-6 rounded-lg border-2 transition-all',
                selectedDecision === 'DECLINED'
                  ? 'border-red-500 bg-red-50'
                  : 'border-border hover:border-red-300'
              )}
            >
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="text-center">
                <p className="font-semibold">Decline</p>
                <p className="text-sm text-muted-foreground">Not a candidate for treatment</p>
              </div>
            </button>
          </div>

          {errors.decision && (
            <p className="text-sm text-destructive mt-2">Please select a decision</p>
          )}
        </CardContent>
      </Card>

      {/* Decision Form */}
      {selectedDecision && (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Diagnosis Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Diagnosis (ICD-10)
              </CardTitle>
              <CardDescription>
                Add diagnosis codes for this patient
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Quick Add Common Diagnoses */}
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  Common Diagnoses
                </Label>
                <div className="flex flex-wrap gap-2">
                  {commonDiagnoses.map((dx) => (
                    <button
                      key={dx.code}
                      type="button"
                      onClick={() => addDiagnosis(dx.code, dx.description)}
                      disabled={diagnosisList?.some((d) => d.code === dx.code)}
                      className={cn(
                        'px-3 py-1.5 text-sm rounded-full border transition-colors',
                        diagnosisList?.some((d) => d.code === dx.code)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'hover:bg-muted'
                      )}
                    >
                      {dx.code}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Entry */}
              <div className="flex gap-2">
                <Input
                  placeholder="ICD-10 Code"
                  className="w-32"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const code = e.currentTarget.value;
                      const desc = (e.currentTarget.nextElementSibling as HTMLInputElement)?.value;
                      if (code && desc) {
                        addDiagnosis(code, desc);
                        e.currentTarget.value = '';
                        (e.currentTarget.nextElementSibling as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
                <Input
                  placeholder="Description"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={(e) => {
                    const inputs = (e.currentTarget.parentElement as HTMLElement).querySelectorAll('input');
                    const code = inputs[0].value;
                    const desc = inputs[1].value;
                    if (code && desc) {
                      addDiagnosis(code, desc);
                      inputs[0].value = '';
                      inputs[1].value = '';
                    }
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Selected Diagnoses */}
              {fields.length > 0 && (
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-3 p-3 bg-muted rounded-lg"
                    >
                      <Badge variant="secondary">{field.code}</Badge>
                      <span className="flex-1">{field.description}</span>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {errors.diagnosis && (
                <p className="text-sm text-destructive">{errors.diagnosis.message}</p>
              )}
            </CardContent>
          </Card>

          {/* Conditional Fields Based on Decision */}
          {selectedDecision === 'APPROVED' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="w-5 h-5" />
                  Prescription
                </CardTitle>
                <CardDescription>
                  Write a prescription for this patient (optional)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {showPrescriptionWriter ? (
                  <PrescriptionWriter
                    onSave={(rx) => {
                      setValue('prescription', rx);
                      setShowPrescriptionWriter(false);
                    }}
                    onCancel={() => setShowPrescriptionWriter(false)}
                  />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPrescriptionWriter(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Prescription
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {selectedDecision === 'DECLINED' && (
            <Card>
              <CardHeader>
                <CardTitle>Decline Reason</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  {...register('declineReason')}
                  placeholder="Explain why this patient is not a candidate for treatment..."
                  className="min-h-[100px]"
                />
                {errors.declineReason && (
                  <p className="text-sm text-destructive mt-2">
                    {errors.declineReason?.message}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {selectedDecision === 'NEEDS_INFO' && (
            <Card>
              <CardHeader>
                <CardTitle>Information Requested</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  {...register('informationRequested')}
                  placeholder="Specify what additional information you need from the patient..."
                  className="min-h-[100px]"
                />
                {errors.informationRequested && (
                  <p className="text-sm text-destructive mt-2">
                    {errors.informationRequested?.message}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Notes Section */}
          <Card>
            <CardHeader>
              <CardTitle>Clinical Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="notes">Notes (Visible to Patient)</Label>
                <Textarea
                  id="notes"
                  {...register('notes')}
                  placeholder="Enter your clinical notes..."
                  className="min-h-[100px] mt-1.5"
                />
                {errors.notes && (
                  <p className="text-sm text-destructive mt-2">{errors.notes.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="internalNotes">Internal Notes (Not Visible to Patient)</Label>
                <Textarea
                  id="internalNotes"
                  {...register('internalNotes')}
                  placeholder="Enter internal notes (optional)..."
                  className="min-h-[100px] mt-1.5"
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
