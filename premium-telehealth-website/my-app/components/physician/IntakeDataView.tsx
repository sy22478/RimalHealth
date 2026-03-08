'use client';

import * as React from 'react';
import { User, MapPin, Heart, Pill, History, ClipboardCheck, Wine } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { IntakeFormData, IntakeScores, RiskAssessment, CONCERN_TYPE_LABELS, TREATMENT_GOAL_LABELS } from '@/types/intake';
import { cn } from '@/lib/utils';

interface IntakeDataViewProps {
  formData: IntakeFormData;
  scores?: IntakeScores;
  riskAssessment?: RiskAssessment;
}

interface DataRowProps {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}

function DataRow({ label, value, highlight }: DataRowProps) {
  return (
    <div className={cn('py-2', highlight && 'bg-amber-50 -mx-4 px-4 rounded')}>  
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium mt-0.5">{value || '-'}</dd>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * Intake Data View Component
 * 
 * Displays patient intake form data in an organized, readable format.
 * Used by physicians during intake review.
 * 
 * HIPAA: This component displays PHI - ensure proper access controls
 */
export function IntakeDataView({ formData, scores, riskAssessment }: IntakeDataViewProps) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatBoolean = (value: boolean) => (
    <Badge variant={value ? 'destructive' : 'secondary'}>
      {value ? 'Yes' : 'No'}
    </Badge>
  );

  const getAuditScoreInterpretation = (score?: number) => {
    if (score === undefined) return null;
    if (score <= 3) return { label: 'Low Risk', color: 'bg-success' };
    if (score <= 7) return { label: 'Moderate Risk', color: 'bg-warning' };
    return { label: 'High Risk', color: 'bg-destructive' };
  };

  const auditInterpretation = getAuditScoreInterpretation(scores?.auditScore);

  return (
    <div className="space-y-6">
      {/* Risk Assessment Banner */}
      {riskAssessment && (
        <Card
          className={cn(
            'border-l-4',
            riskAssessment.level === 'LOW' && 'border-l-success bg-success/5',
            riskAssessment.level === 'MODERATE' && 'border-l-warning bg-warning/5',
            riskAssessment.level === 'HIGH' && 'border-l-orange-500 bg-orange-50',
            riskAssessment.level === 'SEVERE' && 'border-l-destructive bg-destructive/5'
          )}
        >
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Risk Assessment</p>
                <p className="text-lg font-semibold">{riskAssessment.level} RISK</p>
                <p className="text-sm mt-1">{riskAssessment.description}</p>
              </div>
              <Badge
                variant={
                  riskAssessment.level === 'LOW'
                    ? 'default'
                    : riskAssessment.level === 'MODERATE'
                    ? 'secondary'
                    : 'destructive'
                }
                className="text-base px-3 py-1"
              >
                {scores?.riskScore ?? '-'} / 100
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Accordion type="multiple" defaultValue={['personal', 'medical']} className="space-y-4">
        {/* Personal Information */}
        <AccordionItem value="personal" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Personal Information</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-1">
              <DataRow label="Full Name" value={`${formData.firstName} ${formData.lastName}`} />
              <DataRow label="Date of Birth" value={formatDate(formData.dateOfBirth)} />
              <DataRow label="Phone" value={formData.phone} />
              <DataRow label="Email" value={formData.email} />
              <Separator className="my-2" />
              <DataRow
                label="Primary Concern"
                value={formData.primaryConcern ? CONCERN_TYPE_LABELS[formData.primaryConcern] : '-'}
              />
              <DataRow
                label="Treatment Goal"
                value={formData.treatmentGoal ? TREATMENT_GOAL_LABELS[formData.treatmentGoal] : '-'}
              />

            </dl>
          </AccordionContent>
        </AccordionItem>

        {/* Address */}
        <AccordionItem value="address" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Address</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-1">
              <DataRow label="Street" value={formData.addressStreet} />
              <DataRow label="City" value={formData.addressCity} />
              <DataRow label="State" value={formData.addressState} />
              <DataRow label="ZIP Code" value={formData.addressZip} />
            </dl>
          </AccordionContent>
        </AccordionItem>

        {/* Medical History */}
        <AccordionItem value="medical" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Medical History</span>
              {formData.isPregnant && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  Pregnant
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-1">
              <DataRow
                label="Pregnant"
                value={formatBoolean(formData.isPregnant)}
                highlight={formData.isPregnant}
              />
              {formData.isPregnant && formData.isPregnantDetails && (
                <DataRow label="Pregnancy Details" value={formData.isPregnantDetails} />
              )}
              <DataRow
                label="Seizure History"
                value={formatBoolean(formData.hasSeizureHistory)}
                highlight={formData.hasSeizureHistory}
              />
              {formData.hasSeizureHistory && formData.seizureDetails && (
                <DataRow label="Seizure Details" value={formData.seizureDetails} />
              )}
              <DataRow
                label="Psychiatric History"
                value={formatBoolean(formData.hasPsychiatricHistory)}
                highlight={formData.hasPsychiatricHistory}
              />
              {formData.hasPsychiatricHistory && formData.psychiatricDetails && (
                <DataRow label="Psychiatric Details" value={formData.psychiatricDetails} />
              )}
              <DataRow
                label="Liver Disease"
                value={formatBoolean(formData.hasLiverDisease)}
                highlight={formData.hasLiverDisease}
              />
              {formData.hasLiverDisease && formData.liverDiseaseDetails && (
                <DataRow label="Liver Disease Details" value={formData.liverDiseaseDetails} />
              )}
              <DataRow
                label="Kidney Disease"
                value={formatBoolean(formData.hasKidneyDisease)}
                highlight={formData.hasKidneyDisease}
              />
              {formData.hasKidneyDisease && formData.kidneyDiseaseDetails && (
                <DataRow label="Kidney Disease Details" value={formData.kidneyDiseaseDetails} />
              )}
              <DataRow
                label="Heart Condition"
                value={formatBoolean(formData.hasHeartCondition)}
                highlight={formData.hasHeartCondition}
              />
              {formData.hasHeartCondition && formData.heartConditionDetails && (
                <DataRow label="Heart Condition Details" value={formData.heartConditionDetails} />
              )}
              {formData.otherConditions && (
                <DataRow label="Other Conditions" value={formData.otherConditions} />
              )}
            </dl>
          </AccordionContent>
        </AccordionItem>

        {/* Current Medications */}
        <AccordionItem value="medications" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <Pill className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Current Medications</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-1">
              <DataRow
                label="Taking Medications"
                value={formatBoolean(formData.takingMedications)}
              />
              {formData.takingMedications && (
                <>
                  <DataRow label="Medication List" value={formData.medicationList} />
                  <DataRow label="Allergies" value={formData.medicationAllergies || 'None reported'} />
                </>
              )}
            </dl>
          </AccordionContent>
        </AccordionItem>

        {/* Alcohol Assessment */}
        {(formData.primaryConcern === 'ALCOHOL' || formData.primaryConcern === 'BOTH') && (
          <AccordionItem value="alcohol" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2">
                <Wine className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Alcohol Assessment</span>
                {scores?.auditScore !== undefined && (
                  <Badge
                    variant={scores.auditScore > 7 ? 'destructive' : 'secondary'}
                    className="ml-2 text-xs"
                  >
                    AUDIT-C: {scores.auditScore}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <dl className="space-y-1">
                {scores?.auditScore !== undefined && auditInterpretation && (
                  <>
                    <DataRow
                      label="AUDIT-C Score"
                      value={
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{scores.auditScore} / 12</span>
                          <Badge className={auditInterpretation.color}>
                            {auditInterpretation.label}
                          </Badge>
                        </div>
                      }
                    />
                    <Separator className="my-2" />
                  </>
                )}
                <DataRow label="How often drink alcohol" value={formData.audit_1} />
                <DataRow label="Drinks on typical day" value={formData.audit_2} />
                <DataRow label="How often 6+ drinks" value={formData.audit_3} />
                <DataRow label="Previous quit attempts" value={formData.alcoholQuitAttempts} />
                {formData.alcoholQuitDetails && (
                  <DataRow label="Quit attempt details" value={formData.alcoholQuitDetails} />
                )}
                <DataRow label="Concern level" value={formData.alcoholConcernLevel} />
              </dl>
            </AccordionContent>
          </AccordionItem>
        )}



        {/* Previous Treatment */}
        <AccordionItem value="previous" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Previous Treatment</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-1">
              <DataRow
                label="Previous treatment"
                value={formatBoolean(formData.previousTreatment)}
              />
              {formData.previousTreatment && (
                <>
                  <DataRow label="Treatment details" value={formData.previousTreatmentDetails} />
                  <DataRow label="Previous medications" value={formData.previousMedications} />
                </>
              )}
            </dl>
          </AccordionContent>
        </AccordionItem>

        {/* Consents */}
        <AccordionItem value="consents" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Consents</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-1">
              <DataRow
                label="HIPAA Consent"
                value={
                  <Badge variant={formData.hipaaConsent ? 'default' : 'destructive'}>
                    {formData.hipaaConsent ? 'Accepted' : 'Not Accepted'}
                  </Badge>
                }
              />
              <DataRow
                label="Terms of Service"
                value={
                  <Badge variant={formData.termsConsent ? 'default' : 'destructive'}>
                    {formData.termsConsent ? 'Accepted' : 'Not Accepted'}
                  </Badge>
                }
              />
              <DataRow
                label="Telehealth Consent"
                value={
                  <Badge variant={formData.telehealthConsent ? 'default' : 'destructive'}>
                    {formData.telehealthConsent ? 'Accepted' : 'Not Accepted'}
                  </Badge>
                }
              />
              <DataRow
                label="Treatment Consent"
                value={
                  <Badge variant={formData.treatmentConsent ? 'default' : 'destructive'}>
                    {formData.treatmentConsent ? 'Accepted' : 'Not Accepted'}
                  </Badge>
                }
              />
            </dl>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
