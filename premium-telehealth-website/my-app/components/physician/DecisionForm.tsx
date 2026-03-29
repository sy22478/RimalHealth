'use client';

import * as React from 'react';
import { CheckCircle2, XCircle, HelpCircle, AlertTriangle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { REJECTION_REASONS } from '@/lib/physician/review-types';
import { MedicationSelector, MedicationSelection } from './MedicationSelector';
import { ClinicalNotes } from './ClinicalNotes';
import { IntakeFormData } from '@/types/intake';

type DecisionType = 'APPROVE' | 'REJECT' | 'NEEDS_INFO' | null;

interface DecisionFormData {
  decision: DecisionType;
  clinicalNotes: string;
  medication: MedicationSelection | null;
  rejectionReason: string;
  alternativeRecommendation: string;
  requestedInfo: string;
}

interface DecisionFormProps {
  value: DecisionFormData;
  onChange: (value: DecisionFormData) => void;
  concernType: string;
  formData: IntakeFormData;
  disabled?: boolean;
  errors?: Record<string, string>;
}

interface DecisionOption {
  value: Exclude<DecisionType, null>;
  label: string;
  description: string;
  icon: React.ReactNode;
  variant: 'default' | 'destructive' | 'secondary';
}

const DECISION_OPTIONS: DecisionOption[] = [
  {
    value: 'APPROVE',
    label: 'Approve',
    description: 'Approve intake and prescribe medication',
    icon: <CheckCircle2 className="h-5 w-5" />,
    variant: 'default',
  },
  {
    value: 'REJECT',
    label: 'Reject',
    description: 'Reject intake with reason',
    icon: <XCircle className="h-5 w-5" />,
    variant: 'destructive',
  },
  {
    value: 'NEEDS_INFO',
    label: 'Needs Info',
    description: 'Request additional information from patient',
    icon: <HelpCircle className="h-5 w-5" />,
    variant: 'secondary',
  },
];

/**
 * Decision Form Component
 * 
 * Main form for physicians to make intake review decisions.
 * Shows different fields based on decision type.
 * 
 * HIPAA: All decision data is encrypted and logged
 */
export function DecisionForm({
  value,
  onChange,
  concernType,
  formData,
  disabled = false,
  errors = {},
}: DecisionFormProps) {
  const handleDecisionChange = (decision: Exclude<DecisionType, null>) => {
    onChange({
      ...value,
      decision,
      // Clear conditional fields when decision changes
      medication: decision === 'APPROVE' ? value.medication : null,
      rejectionReason: decision === 'REJECT' ? value.rejectionReason : '',
      requestedInfo: decision === 'NEEDS_INFO' ? value.requestedInfo : '',
    });
  };

  const handleFieldChange = (field: keyof DecisionFormData, fieldValue: unknown) => {
    onChange({
      ...value,
      [field]: fieldValue,
    });
  };

  return (
    <div className="space-y-6">
      {/* Decision Selection */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">
          Review Decision
          <span className="text-destructive ml-1">*</span>
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {DECISION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleDecisionChange(option.value)}
              disabled={disabled}
              className={cn(
                'relative flex flex-col items-center p-4 rounded-lg border-2 transition-all text-center overflow-hidden',
                value.decision === option.value
                  ? option.variant === 'default'
                    ? 'border-success bg-success/5'
                    : option.variant === 'destructive'
                    ? 'border-destructive bg-destructive/5'
                    : 'border-secondary bg-secondary/20'
                  : 'border-border hover:border-primary/50 hover:bg-accent',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div
                className={cn(
                  'mb-2 shrink-0',
                  option.variant === 'default' && 'text-success',
                  option.variant === 'destructive' && 'text-destructive',
                  option.variant === 'secondary' && 'text-muted-foreground'
                )}
              >
                {option.icon}
              </div>
              <span className="font-medium text-sm">{option.label}</span>
              <span className="text-xs text-muted-foreground mt-1 break-words leading-tight w-full">
                {option.description}
              </span>
              {value.decision === option.value && (
                <Badge
                  variant={option.variant === 'default' ? 'default' : 'secondary'}
                  className="absolute top-2 right-2"
                >
                  Selected
                </Badge>
              )}
            </button>
          ))}
        </div>
        {errors.decision && (
          <p className="text-sm text-destructive" role="alert">
            {errors.decision}
          </p>
        )}
      </div>

      <Separator />

      {/* Conditional Fields Based on Decision */}
      {value.decision === 'APPROVE' && (
        <Card className="border-success/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-success">
              <CheckCircle2 className="h-4 w-4" />
              Prescription Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MedicationSelector
              value={value.medication}
              onChange={(medication) => handleFieldChange('medication', medication)}
              concernType={concernType}
              formData={formData}
              disabled={disabled}
            />
            {errors.medication && (
              <p className="text-sm text-destructive mt-2" role="alert">
                {errors.medication}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {value.decision === 'REJECT' && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              Rejection Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Rejection Reason */}
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">
                Reason for Rejection
                <span className="text-destructive ml-1">*</span>
              </Label>
              <select
                id="rejection-reason"
                value={value.rejectionReason}
                onChange={(e) => handleFieldChange('rejectionReason', e.target.value)}
                disabled={disabled}
                className={cn(
                  'w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  errors.rejectionReason && 'border-destructive',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <option value="">Select a reason...</option>
                {REJECTION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
              {errors.rejectionReason && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.rejectionReason}
                </p>
              )}
            </div>

            {/* Alternative Recommendation */}
            <div className="space-y-2">
              <Label htmlFor="alternative-recommendation">
                Alternative Recommendation (Optional)
              </Label>
              <Textarea
                id="alternative-recommendation"
                value={value.alternativeRecommendation}
                onChange={(e) =>
                  handleFieldChange('alternativeRecommendation', e.target.value)
                }
                placeholder="Suggest alternative treatments or resources for the patient..."
                disabled={disabled}
                className="min-h-[100px]"
              />
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800">
                  The patient will be notified of this rejection and provided with next steps.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {value.decision === 'NEEDS_INFO' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Information Request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="requested-info">
                Information Needed
                <span className="text-destructive ml-1">*</span>
              </Label>
              <Textarea
                id="requested-info"
                value={value.requestedInfo}
                onChange={(e) => handleFieldChange('requestedInfo', e.target.value)}
                placeholder="Describe what additional information is needed from the patient..."
                disabled={disabled}
                className={cn(
                  'min-h-[150px]',
                  errors.requestedInfo && 'border-destructive'
                )}
              />
              {errors.requestedInfo && (
                <p className="text-sm text-destructive" role="alert">
                  {errors.requestedInfo}
                </p>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <HelpCircle className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-sm text-blue-800">
                  The patient will receive a notification and can submit the requested information.
                  The intake will remain pending until they respond.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Clinical Notes (Always Required) */}
      <ClinicalNotes
        value={value.clinicalNotes}
        onChange={(notes) => handleFieldChange('clinicalNotes', notes)}
        error={errors.clinicalNotes}
        disabled={disabled}
      />
    </div>
  );
}

export type { DecisionFormData, DecisionType };
