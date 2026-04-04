'use client';

import * as React from 'react';
import { User, MapPin, Heart, Pill, History, ClipboardCheck, Wine, ShieldAlert, AlertTriangle, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { IntakeFormData, IntakeScores, RiskAssessment, CONCERN_TYPE_LABELS, TREATMENT_GOAL_LABELS } from '@/types/intake';
import { cn } from '@/lib/utils';
import type { ProviderDecisionSummary } from '@/lib/intake/scoring';

interface PreferredPharmacyInfo {
  name: string;
  phone: string | null;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

interface IntakeDataViewProps {
  formData: IntakeFormData;
  scores?: IntakeScores;
  riskAssessment?: RiskAssessment;
  /** Preferred pharmacy from patient profile (fallback when form data doesn't include pharmacy) */
  preferredPharmacy?: PreferredPharmacyInfo;
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

// Label mappings for DSM-5 enum values
const GOAL_LABELS: Record<string, string> = {
  abstinence: 'Stop completely (abstinence)',
  'harm-reduction': 'Reduce use (harm reduction)',
  unsure: 'Unsure / exploring options',
};

const MOTIVATION_LABELS: Record<string, string> = {
  very: 'Very motivated',
  somewhat: 'Somewhat motivated',
  unsure: 'Unsure',
};

const SUPPORT_LABELS: Record<string, string> = {
  strong: 'Strong support system',
  limited: 'Limited support',
  none: 'No support system',
};

const PREGNANCY_LABELS: Record<string, string> = {
  pregnant: 'Currently pregnant',
  breastfeeding: 'Currently breastfeeding',
  'planning-pregnancy': 'Planning pregnancy',
  none: 'Not applicable',
};

const LIVER_LABELS: Record<string, string> = {
  cirrhosis: 'Cirrhosis',
  'acute-hepatitis': 'Acute hepatitis',
  'liver-failure': 'Liver failure',
  'elevated-enzymes': 'Elevated liver enzymes',
  none: 'None',
};

const LIVER_TEST_LABELS: Record<string, string> = {
  normal: 'Normal',
  'mild-elevated': 'Mildly elevated',
  'significant-elevated': 'Significantly elevated',
  'no-tests': 'No recent tests',
};

const ALLERGY_LABELS: Record<string, string> = {
  naltrexone: 'Naltrexone allergy',
  other: 'Other medication allergy',
  none: 'No known allergies',
};

const DRINKING_DAYS_LABELS: Record<string, string> = {
  '1-2': '1-2 days per week',
  '3-4': '3-4 days per week',
  '5-6': '5-6 days per week',
  everyday: 'Every day',
};

const DRINKS_PER_DAY_LABELS: Record<string, string> = {
  '1-2': '1-2 drinks',
  '3-4': '3-4 drinks',
  '5-6': '5-6 drinks',
  '7+': '7 or more drinks',
};

const LAST_DRINK_LABELS: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '2-7days': '2-7 days ago',
  'more-than-week': 'More than a week ago',
};

function formatMedicalCondition(condition: string): string {
  const labels: Record<string, string> = {
    depression: 'Depression',
    anxiety: 'Anxiety',
    bipolar: 'Bipolar disorder',
    schizophrenia: 'Schizophrenia',
    ptsd: 'PTSD',
    seizures: 'Seizure history',
    heart: 'Heart condition',
    hypertension: 'Hypertension',
    kidney: 'Kidney disease',
    diabetes: 'Diabetes',
    thyroid: 'Thyroid condition',
  };
  return labels[condition] || condition;
}

function formatTreatmentType(treatment: string): string {
  const labels: Record<string, string> = {
    'inpatient-rehab': 'Inpatient rehab',
    'outpatient-program': 'Outpatient program',
    'aa-12step': 'AA / 12-step program',
    medication: 'Medication-assisted treatment',
    counseling: 'Counseling / therapy',
    detox: 'Medical detox',
    none: 'None',
  };
  return labels[treatment] || treatment;
}

/**
 * Intake Data View Component
 *
 * Displays patient intake form data in an organized, readable format.
 * Used by physicians during intake review.
 * Supports both DSM-5 format (current) and legacy AUDIT-C format.
 *
 * HIPAA: This component displays PHI - ensure proper access controls
 */
export function IntakeDataView({ formData: rawFormData, scores, riskAssessment, preferredPharmacy }: IntakeDataViewProps) {
  // Defensive: ensure formData is always an object even if null/undefined from DB
  const formData = (rawFormData ?? {}) as IntakeFormData;

  // Extract provider decision summary if available (attached by review.ts)
  const providerSummary = (formData as unknown as Record<string, unknown>)?._providerDecisionSummary as ProviderDecisionSummary | undefined;

  // Detect whether this is DSM-5 format (has dsm5Q1) or legacy AUDIT-C format
  const isDsm5Format = formData.dsm5Q1 !== undefined;

  // Derive medical flags from both formats
  const isPregnant = !!formData.isPregnant ||
    (formData.pregnancyStatus !== undefined && formData.pregnancyStatus !== 'none');
  const hasLiverDisease = !!formData.hasLiverDisease ||
    (formData.liverCondition !== undefined && formData.liverCondition !== 'none');
  const isTakingMeds = !!formData.takingMedications || !!formData.currentMedications;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    // Parse YYYY-MM-DD as local date to avoid timezone shift (e.g. DOB)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    }
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
      {/* 42 CFR Part 2 Redisclosure Notice */}
      <Alert className="border-amber-400 bg-amber-50">
        <ShieldAlert className="h-4 w-4 text-amber-700" />
        <AlertTitle className="text-amber-900 font-semibold">
          42 CFR Part 2 -- Federal Confidentiality Notice
        </AlertTitle>
        <AlertDescription className="text-amber-800 text-sm leading-relaxed">
          NOTICE: This record is protected by federal confidentiality rules (42
          CFR Part 2). It may not be re-disclosed without the patient&apos;s
          written consent or as otherwise permitted by 42 CFR Part 2.
        </AlertDescription>
      </Alert>

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

      {/* Provider Decision Summary */}
      {providerSummary && (
        <Card className="border-2 border-navy-200 bg-navy-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-5 w-5 text-navy-700" />
              Provider Decision Summary
              <Badge
                variant={
                  providerSummary.priority === 'CONTRAINDICATED' ? 'destructive' :
                  providerSummary.priority === 'URGENT' ? 'destructive' :
                  providerSummary.priority === 'ELEVATED' ? 'secondary' :
                  'default'
                }
                className="ml-auto"
              >
                {providerSummary.priority}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* DSM-5 Score */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">DSM-5 AUD Score</p>
                <p className="text-lg font-semibold">
                  {providerSummary.dsm5.score} / 11
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({providerSummary.dsm5.severity})
                  </span>
                </p>
              </div>
              <Badge
                variant={
                  providerSummary.dsm5.severity === 'SEVERE' ? 'destructive' :
                  providerSummary.dsm5.severity === 'MODERATE' ? 'secondary' :
                  providerSummary.dsm5.severity === 'MILD' ? 'outline' :
                  'default'
                }
                className="text-sm px-3 py-1"
              >
                {providerSummary.dsm5.meetsCriteria ? 'Meets AUD Criteria' : 'Below Threshold'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{providerSummary.dsm5.interpretation}</p>

            <Separator />

            {/* Naltrexone Eligibility */}
            <div className="flex items-center gap-2">
              {providerSummary.eligibleForNaltrexone ? (
                <Badge variant="default" className="bg-green-600">Eligible for Naltrexone</Badge>
              ) : (
                <Badge variant="destructive">NOT Eligible for Naltrexone</Badge>
              )}
            </div>

            {/* Absolute Contraindications */}
            {providerSummary.contraindications.hasAbsoluteContraindication &&
              Array.isArray(providerSummary.contraindications.absolute) && (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Absolute Contraindications</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    {providerSummary.contraindications.absolute.map((item, i) => (
                      <li key={i} className="text-sm">{item}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Relative Contraindications */}
            {providerSummary.contraindications.hasRelativeContraindication &&
              Array.isArray(providerSummary.contraindications.relative) && (
              <Alert className="border-amber-300 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800">Relative Contraindications</AlertTitle>
                <AlertDescription className="text-amber-700">
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    {providerSummary.contraindications.relative.map((item, i) => (
                      <li key={i} className="text-sm">{item}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Withdrawal Risk */}
            {providerSummary.withdrawalRisk.isElevated &&
              Array.isArray(providerSummary.withdrawalRisk.riskFactors) && (
              <Alert className="border-orange-300 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertTitle className="text-orange-800">Elevated Withdrawal Risk</AlertTitle>
                <AlertDescription className="text-orange-700">
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    {providerSummary.withdrawalRisk.riskFactors.map((factor, i) => (
                      <li key={i} className="text-sm">{factor}</li>
                    ))}
                  </ul>
                  <p className="text-sm mt-2 font-medium">{providerSummary.withdrawalRisk.recommendation}</p>
                </AlertDescription>
              </Alert>
            )}

            {/* Risk & Complexity Scores */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-3 border">
                <p className="text-xs text-muted-foreground">Risk Score</p>
                <p className="text-xl font-bold">{providerSummary.riskScore}<span className="text-sm font-normal text-muted-foreground"> / 100</span></p>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <p className="text-xs text-muted-foreground">Complexity Score</p>
                <p className="text-xl font-bold">{providerSummary.complexityScore}<span className="text-sm font-normal text-muted-foreground"> / 100</span></p>
              </div>
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
              <DataRow
                label="Full Name"
                value={
                  formData.firstName || formData.lastName
                    ? `${formData.firstName || ''} ${formData.lastName || ''}`.trim()
                    : undefined
                }
              />
              <DataRow label="Date of Birth" value={formData.dateOfBirth ? formatDate(formData.dateOfBirth) : undefined} />
              <DataRow label="Phone" value={formData.phone} />
              {formData.email && <DataRow label="Email" value={formData.email} />}
              {formData.age && <DataRow label="Age" value={formData.age} />}
              {formData.biologicalSex && (
                <DataRow
                  label="Biological Sex"
                  value={
                    formData.biologicalSex === 'OTHER' && formData.biologicalSexOther
                      ? formData.biologicalSexOther
                      : formData.biologicalSex
                  }
                />
              )}
              <Separator className="my-2" />
              <DataRow
                label="Primary Concern"
                value={formData.primaryConcern ? CONCERN_TYPE_LABELS[formData.primaryConcern] : 'Alcohol Use'}
              />
              <DataRow
                label="Treatment Goal"
                value={
                  formData.treatmentGoal
                    ? TREATMENT_GOAL_LABELS[formData.treatmentGoal]
                    : formData.primaryGoal
                    ? GOAL_LABELS[formData.primaryGoal] || formData.primaryGoal
                    : '-'
                }
              />
              {formData.motivationLevel && (
                <DataRow label="Motivation Level" value={MOTIVATION_LABELS[formData.motivationLevel] || formData.motivationLevel} />
              )}
              {formData.supportSystem && (
                <DataRow label="Support System" value={SUPPORT_LABELS[formData.supportSystem] || formData.supportSystem} />
              )}
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
              <DataRow label="State" value={formData.addressState || 'CA'} />
              <DataRow label="ZIP Code" value={formData.addressZip} />
            </dl>
            {(formData.pharmacyName || preferredPharmacy) && (
              <>
                <Separator className="my-3" />
                <p className="text-sm font-medium text-muted-foreground mb-2">Preferred Pharmacy</p>
                <dl className="space-y-1">
                  {formData.pharmacyName ? (
                    <>
                      <DataRow label="Pharmacy Name" value={formData.pharmacyName} />
                      <DataRow label="Pharmacy Address" value={formData.pharmacyAddress} />
                      <DataRow label="Pharmacy City" value={formData.pharmacyCity} />
                      <DataRow label="Pharmacy State" value={formData.pharmacyState || 'CA'} />
                      <DataRow label="Pharmacy ZIP" value={formData.pharmacyZip} />
                      {formData.pharmacyPhone && (
                        <DataRow label="Pharmacy Phone" value={formData.pharmacyPhone} />
                      )}
                    </>
                  ) : preferredPharmacy ? (
                    <>
                      <DataRow label="Pharmacy Name" value={preferredPharmacy.name} />
                      <DataRow label="Pharmacy Address" value={preferredPharmacy.address} />
                      <DataRow label="Pharmacy City" value={preferredPharmacy.city} />
                      <DataRow label="Pharmacy State" value={preferredPharmacy.state || 'CA'} />
                      <DataRow label="Pharmacy ZIP" value={preferredPharmacy.zipCode} />
                      {preferredPharmacy.phone && (
                        <DataRow label="Pharmacy Phone" value={preferredPharmacy.phone} />
                      )}
                    </>
                  ) : null}
                </dl>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Medical History */}
        <AccordionItem value="medical" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Medical History</span>
              {isPregnant && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  Pregnant
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-1">
              {/* Pregnancy status -- DSM-5 or legacy format */}
              <DataRow
                label="Pregnancy / Breastfeeding Status"
                value={
                  formData.pregnancyStatus
                    ? PREGNANCY_LABELS[formData.pregnancyStatus] || formData.pregnancyStatus
                    : formData.isPregnant !== undefined
                    ? formatBoolean(!!formData.isPregnant)
                    : undefined
                }
                highlight={isPregnant}
              />
              {formData.isPregnant && formData.isPregnantDetails && (
                <DataRow label="Pregnancy Details" value={formData.isPregnantDetails} />
              )}

              {/* Liver condition -- DSM-5 or legacy */}
              <DataRow
                label="Liver Condition"
                value={
                  formData.liverCondition
                    ? LIVER_LABELS[formData.liverCondition] || formData.liverCondition
                    : formData.hasLiverDisease !== undefined
                    ? formatBoolean(!!formData.hasLiverDisease)
                    : undefined
                }
                highlight={hasLiverDisease}
              />
              {formData.liverTests && (
                <DataRow label="Liver Test Results" value={LIVER_TEST_LABELS[formData.liverTests] || formData.liverTests} />
              )}
              {formData.hasLiverDisease && formData.liverDiseaseDetails && (
                <DataRow label="Liver Disease Details" value={formData.liverDiseaseDetails} />
              )}

              {/* Medical history items -- DSM-5 array format */}
              {Array.isArray(formData.medicalHistory) && formData.medicalHistory.length > 0 && (
                <DataRow
                  label="Medical Conditions"
                  value={formData.medicalHistory.map(formatMedicalCondition).join(', ')}
                />
              )}

              {/* Legacy fields */}
              {formData.hasSeizureHistory !== undefined && (
                <DataRow
                  label="Seizure History"
                  value={formatBoolean(!!formData.hasSeizureHistory)}
                  highlight={!!formData.hasSeizureHistory}
                />
              )}
              {formData.hasSeizureHistory && formData.seizureDetails && (
                <DataRow label="Seizure Details" value={formData.seizureDetails} />
              )}
              {formData.hasPsychiatricHistory !== undefined && (
                <DataRow
                  label="Psychiatric History"
                  value={formatBoolean(!!formData.hasPsychiatricHistory)}
                  highlight={!!formData.hasPsychiatricHistory}
                />
              )}
              {formData.hasPsychiatricHistory && formData.psychiatricDetails && (
                <DataRow label="Psychiatric Details" value={formData.psychiatricDetails} />
              )}
              {formData.hasKidneyDisease !== undefined && (
                <DataRow
                  label="Kidney Disease"
                  value={formatBoolean(!!formData.hasKidneyDisease)}
                  highlight={!!formData.hasKidneyDisease}
                />
              )}
              {formData.hasKidneyDisease && formData.kidneyDiseaseDetails && (
                <DataRow label="Kidney Disease Details" value={formData.kidneyDiseaseDetails} />
              )}
              {formData.hasHeartCondition !== undefined && (
                <DataRow
                  label="Heart Condition"
                  value={formatBoolean(!!formData.hasHeartCondition)}
                  highlight={!!formData.hasHeartCondition}
                />
              )}
              {formData.hasHeartCondition && formData.heartConditionDetails && (
                <DataRow label="Heart Condition Details" value={formData.heartConditionDetails} />
              )}
              {formData.otherConditions && (
                <DataRow label="Other Conditions" value={formData.otherConditions} />
              )}

              {/* Drug allergies -- DSM-5 */}
              {formData.drugAllergies && (
                <DataRow
                  label="Drug Allergies"
                  value={ALLERGY_LABELS[formData.drugAllergies] || formData.drugAllergies}
                  highlight={formData.drugAllergies !== 'none'}
                />
              )}

              {/* Seeing therapist -- DSM-5 */}
              {formData.seeingTherapist !== undefined && (
                <DataRow
                  label="Currently Seeing Therapist/Counselor"
                  value={formatBoolean(formData.seeingTherapist)}
                />
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
                value={formatBoolean(isTakingMeds)}
              />
              {isTakingMeds && formData.medicationList && (
                <DataRow label="Medication List" value={formData.medicationList} />
              )}
              {formData.medicationAllergies && (
                <DataRow label="Allergies" value={formData.medicationAllergies} />
              )}

              {/* Opioid use -- DSM-5 Naltrexone safety screening */}
              {Array.isArray(formData.opioidUse) && formData.opioidUse.length > 0 && (
                <DataRow
                  label="Opioid Use"
                  value={formData.opioidUse.join(', ')}
                  highlight={formData.opioidUse.some(v => v !== 'none')}
                />
              )}
              {formData.opioidMaintenance !== undefined && (
                <DataRow
                  label="In Opioid Maintenance Program"
                  value={formatBoolean(formData.opioidMaintenance)}
                  highlight={formData.opioidMaintenance}
                />
              )}
            </dl>
          </AccordionContent>
        </AccordionItem>

        {/* Alcohol Assessment -- show for both DSM-5 and legacy formats */}
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

              {/* DSM-5 drinking pattern fields */}
              {formData.drinkingDaysPerWeek && (
                <DataRow label="Drinking days per week" value={DRINKING_DAYS_LABELS[formData.drinkingDaysPerWeek] || formData.drinkingDaysPerWeek} />
              )}
              {formData.drinksPerDay && (
                <DataRow label="Drinks per day" value={DRINKS_PER_DAY_LABELS[formData.drinksPerDay] || formData.drinksPerDay} />
              )}
              {formData.lastDrink && (
                <DataRow label="Last drink" value={LAST_DRINK_LABELS[formData.lastDrink] || formData.lastDrink} />
              )}
              {formData.bingeDrinking && (
                <DataRow label="Binge drinking episodes" value={formData.bingeDrinking === 'yes' ? 'Yes' : 'No'} />
              )}

              {/* Legacy AUDIT-C fields (fallback) */}
              {formData.audit_1 && <DataRow label="How often drink alcohol" value={formData.audit_1} />}
              {formData.audit_2 && <DataRow label="Drinks on typical day" value={formData.audit_2} />}
              {formData.audit_3 && <DataRow label="How often 6+ drinks" value={formData.audit_3} />}
              {formData.alcoholQuitAttempts && (
                <DataRow label="Previous quit attempts" value={formData.alcoholQuitAttempts} />
              )}
              {formData.alcoholQuitDetails && (
                <DataRow label="Quit attempt details" value={formData.alcoholQuitDetails} />
              )}
              {formData.alcoholConcernLevel && (
                <DataRow label="Concern level" value={formData.alcoholConcernLevel} />
              )}
            </dl>
          </AccordionContent>
        </AccordionItem>

        {/* Withdrawal Risk Assessment -- DSM-5 format */}
        {isDsm5Format && (
          <AccordionItem value="withdrawal" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Withdrawal Risk Assessment</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <dl className="space-y-1">
                <DataRow
                  label="History of seizures during withdrawal"
                  value={formatBoolean(!!formData.withdrawalSeizure)}
                  highlight={!!formData.withdrawalSeizure}
                />
                <DataRow
                  label="History of delirium tremens (DTs)"
                  value={formatBoolean(!!formData.withdrawalDTs)}
                  highlight={!!formData.withdrawalDTs}
                />
                <DataRow
                  label="Hospitalized for alcohol detox"
                  value={formatBoolean(!!formData.withdrawalHospitalized)}
                  highlight={!!formData.withdrawalHospitalized}
                />
                <DataRow
                  label="Drinks in the morning to avoid withdrawal"
                  value={formatBoolean(!!formData.morningDrinking)}
                  highlight={!!formData.morningDrinking}
                />
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
              {/* DSM-5 format: previousTreatments is an array of strings */}
              {Array.isArray(formData.previousTreatments) && formData.previousTreatments.length > 0 ? (
                <DataRow
                  label="Previous treatments"
                  value={formData.previousTreatments.map(formatTreatmentType).join(', ')}
                />
              ) : formData.previousTreatment !== undefined ? (
                <>
                  <DataRow
                    label="Previous treatment"
                    value={formatBoolean(!!formData.previousTreatment)}
                  />
                  {formData.previousTreatment && (
                    <>
                      {formData.previousTreatmentDetails && (
                        <DataRow label="Treatment details" value={formData.previousTreatmentDetails} />
                      )}
                      {formData.previousMedications && (
                        <DataRow label="Previous medications" value={formData.previousMedications} />
                      )}
                    </>
                  )}
                </>
              ) : (
                <DataRow label="Previous treatment" value="None reported" />
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
            <p className="text-sm text-muted-foreground">
              All required consents (HIPAA, Terms of Service, Telehealth, Treatment, and 42 CFR Part 2) were accepted during checkout prior to payment. Consent records are stored separately in the audit log.
            </p>
            <Badge variant="default" className="mt-2">
              Consents Accepted at Checkout
            </Badge>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
