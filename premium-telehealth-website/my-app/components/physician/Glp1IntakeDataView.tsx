'use client';

import * as React from 'react';
import {
  User,
  MapPin,
  Heart,
  Pill,
  Activity,
  ShieldAlert,
  AlertTriangle,
  Eye,
  FlaskConical,
  Dumbbell,
  Scissors,
  Brain,
  Stethoscope,
  Scale,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { humanizeValue } from '@/lib/utils/labels';
import { MEDICAL_CONDITIONS } from '@/lib/intake/glp1/clinical-config';
import type {
  Glp1FormData,
  Glp1MedicationEntry,
  Disposition,
  EligibilityBand,
  Glp1Priority,
} from '@/lib/intake/glp1/types';

interface PreferredPharmacyInfo {
  name: string;
  phone: string | null;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

/**
 * The decision summary the GLP-1 submit route attaches to `formData` under the
 * `_glp1DecisionSummary` key (see `app/api/patient/intake/[id]/submit-glp1`).
 * All values are computed at submission from data the patient already supplied —
 * no new clinical thresholds are invented here, we only display them.
 */
interface Glp1DecisionSummary {
  bmi: number;
  eligibilityBand: EligibilityBand;
  contraindicationFlags: Array<{ condition: string; disposition: Disposition }>;
  emergencyFlags: Array<{ trigger: string; source: 'Q37' | 'Q56' }>;
  phq2Score: number;
  drugInteractionFlags: string[];
  priority: Glp1Priority;
  requiresUrgentReview: boolean;
}

interface Glp1IntakeDataViewProps {
  formData: Glp1FormData;
  /** Preferred pharmacy from patient profile (fallback when form data doesn't include pharmacy). */
  preferredPharmacy?: PreferredPharmacyInfo;
}

// ---------------------------------------------------------------------------
// Small presentational helpers (mirror IntakeDataView's DataRow / SectionCard)
// ---------------------------------------------------------------------------

const NOT_ANSWERED = <span className="text-muted-foreground italic">Not answered</span>;

interface DataRowProps {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}

function DataRow({ label, value, highlight }: DataRowProps) {
  // Render "Not answered" for blank values rather than crashing or showing "-".
  const isBlank =
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0);
  return (
    <div className={cn('py-2', highlight && 'bg-amber-50 -mx-4 px-4 rounded')}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium mt-0.5">{isBlank ? NOT_ANSWERED : value}</dd>
    </div>
  );
}

function YesNo({ value, highlightWhenYes = true }: { value: boolean | undefined; highlightWhenYes?: boolean }) {
  if (value === undefined || value === null) return NOT_ANSWERED;
  return (
    <Badge variant={value && highlightWhenYes ? 'destructive' : 'secondary'}>
      {value ? 'Yes' : 'No'}
    </Badge>
  );
}

// Build a value → label map for the ~40-item medical-condition checklist.
const CONDITION_LABELS: Record<string, string> = MEDICAL_CONDITIONS.reduce(
  (acc, c) => {
    acc[c.value] = c.label;
    return acc;
  },
  {} as Record<string, string>
);

function labelConditions(values: unknown): string {
  if (!Array.isArray(values) || values.length === 0) return '';
  return values
    .map((v) => CONDITION_LABELS[String(v)] || humanizeValue(v))
    .filter(Boolean)
    .join(', ');
}

function formatDob(dateStr: string | undefined): string {
  if (!dateStr) return '';
  // Parse YYYY-MM-DD as a local date to avoid a UTC day-shift in PST.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : dateStr.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const [y, m, d] = dateOnly.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  return dateStr;
}

const priorityBadgeVariant = (priority: Glp1Priority) =>
  priority === 'CONTRAINDICATED' || priority === 'URGENT'
    ? ('destructive' as const)
    : priority === 'ELEVATED'
      ? ('secondary' as const)
      : ('default' as const);

const eligibilityBadge = (band: EligibilityBand) => {
  switch (band) {
    case 'ELIGIBLE':
      return { label: 'Eligible (BMI)', className: 'bg-green-600' };
    case 'BORDERLINE':
      return { label: 'Borderline (BMI)', className: 'bg-amber-500' };
    case 'INELIGIBLE':
    default:
      return { label: 'Below BMI Threshold', className: 'bg-destructive' };
  }
};

/**
 * GLP-1 Weight-Management Intake — Physician Review View
 *
 * Renders the full GLP-1 intake (mirroring the 12 wizard steps) plus a Provider
 * Decision Summary surfaced BEFORE the physician's decision. Used in place of
 * `IntakeDataView` when `formData.primaryConcern === 'WEIGHT_MANAGEMENT'`.
 *
 * HIPAA: displays PHI — access is gated by the physician portal. No PHI logged.
 */
export function Glp1IntakeDataView({ formData: rawFormData, preferredPharmacy }: Glp1IntakeDataViewProps) {
  // Defensive: never assume the JSON column is a well-formed object.
  const formData = (rawFormData ?? {}) as Glp1FormData;
  const raw = formData as unknown as Record<string, unknown>;

  const summary = raw._glp1DecisionSummary as Glp1DecisionSummary | undefined;

  // BMI / eligibility fall back to the persisted form values if the summary is
  // absent (e.g. an older GLP-1 intake submitted before the summary existed).
  const bmi = summary?.bmi ?? (typeof formData.bmi === 'number' ? formData.bmi : undefined);
  const eligibilityBand = summary?.eligibilityBand;

  const hardStops = Array.isArray(summary?.contraindicationFlags)
    ? summary!.contraindicationFlags.filter((f) => f.disposition === 'HARD_STOP')
    : [];
  const physicianFlags = Array.isArray(summary?.contraindicationFlags)
    ? summary!.contraindicationFlags.filter((f) => f.disposition === 'PHYSICIAN_FLAG')
    : [];
  const emergencyFlags = Array.isArray(summary?.emergencyFlags) ? summary!.emergencyFlags : [];
  const drugInteractionFlags = Array.isArray(summary?.drugInteractionFlags)
    ? summary!.drugInteractionFlags
    : [];

  const medications: Glp1MedicationEntry[] = Array.isArray(formData.medicationList)
    ? formData.medicationList
    : [];

  const heightStr =
    formData.heightFeet != null || formData.heightInches != null
      ? `${formData.heightFeet ?? 0} ft ${formData.heightInches ?? 0} in`
      : undefined;

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------------------------
          GLP-1 Provider Decision Summary — surfaced BEFORE the decision.
          Hard-stop contraindications and emergency flags are visually loud.
         ------------------------------------------------------------------- */}
      {summary ? (
        <Card className="border-2 border-navy-200 bg-navy-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex flex-wrap items-center gap-2">
              <Activity className="h-5 w-5 text-navy-700 shrink-0" />
              <span className="break-words">GLP-1 Provider Decision Summary</span>
              <Badge variant={priorityBadgeVariant(summary.priority)} className="sm:ml-auto">
                {summary.priority}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* HARD STOPS — impossible to miss */}
            {hardStops.length > 0 && (
              <Alert variant="destructive" className="border-2">
                <ShieldAlert className="h-5 w-5" />
                <AlertTitle className="font-bold uppercase tracking-wide">
                  Hard-Stop Contraindication{hardStops.length > 1 ? 's' : ''}
                </AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    {hardStops.map((f, i) => (
                      <li key={i} className="text-sm font-medium">{f.condition}</li>
                    ))}
                  </ul>
                  <p className="text-sm mt-2 font-semibold">
                    GLP-1 therapy is contraindicated. Do not approve without resolving these.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* EMERGENCY flags (Q37 suicidal ideation / Q56 PHQ-2) */}
            {emergencyFlags.length > 0 && (
              <Alert variant="destructive" className="border-2">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle className="font-bold uppercase tracking-wide">
                  Emergency / Mental-Health Flag{emergencyFlags.length > 1 ? 's' : ''}
                </AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    {emergencyFlags.map((f, i) => (
                      <li key={i} className="text-sm font-medium">
                        {f.trigger} <span className="text-xs opacity-80">({f.source})</span>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* BMI + eligibility band */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Body Mass Index (BMI)</p>
                <p className="text-lg font-semibold">
                  {bmi != null ? bmi : '—'}
                  {eligibilityBand && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({humanizeValue(eligibilityBand)})
                    </span>
                  )}
                </p>
              </div>
              {eligibilityBand && (
                <Badge className={cn(eligibilityBadge(eligibilityBand).className, 'whitespace-normal text-left')}>
                  {eligibilityBadge(eligibilityBand).label}
                </Badge>
              )}
            </div>

            {/* Physician-flag contraindications (review, not block) */}
            {physicianFlags.length > 0 && (
              <Alert className="border-amber-300 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800">Contraindications — Physician Review</AlertTitle>
                <AlertDescription className="text-amber-700">
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    {physicianFlags.map((f, i) => (
                      <li key={i} className="text-sm">{f.condition}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Drug-interaction flags */}
            {drugInteractionFlags.length > 0 && (
              <Alert className="border-orange-300 bg-orange-50">
                <Pill className="h-4 w-4 text-orange-600" />
                <AlertTitle className="text-orange-800">Drug-Interaction Flags</AlertTitle>
                <AlertDescription className="text-orange-700">
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    {drugInteractionFlags.map((d, i) => (
                      <li key={i} className="text-sm">{d}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* PHQ-2 score */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-3 border">
                <p className="text-xs text-muted-foreground">PHQ-2 Depression Screen</p>
                <p className="text-xl font-bold">
                  {summary.phq2Score}
                  <span className="text-sm font-normal text-muted-foreground"> / 6</span>
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 border">
                <p className="text-xs text-muted-foreground">Urgent Review</p>
                <p className="text-xl font-bold">{summary.requiresUrgentReview ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Alert>
          <Activity className="h-4 w-4" />
          <AlertTitle>Decision summary unavailable</AlertTitle>
          <AlertDescription>
            This GLP-1 intake has no computed decision summary. Review the form data below directly.
          </AlertDescription>
        </Alert>
      )}

      <Accordion
        type="multiple"
        defaultValue={['contraindications', 'medical', 'labs']}
        className="space-y-4"
      >
        {/* Step 1 — Demographics + emergency contact */}
        <AccordionItem value="demographics" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Demographics &amp; Emergency Contact</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-1">
              <DataRow
                label="Full Name"
                value={`${formData.firstName || ''} ${formData.lastName || ''}`.trim()}
              />
              <DataRow label="Date of Birth" value={formatDob(formData.dateOfBirth)} />
              <DataRow
                label="Biological Sex"
                value={
                  formData.biologicalSex === 'OTHER' && formData.biologicalSexOther
                    ? formData.biologicalSexOther
                    : humanizeValue(formData.biologicalSex)
                }
              />
              <DataRow
                label="Gender Identity"
                value={
                  formData.genderIdentity === 'other' && formData.genderIdentityOther
                    ? formData.genderIdentityOther
                    : formData.genderIdentity
                      ? humanizeValue(formData.genderIdentity)
                      : ''
                }
              />
              <DataRow label="Phone" value={formData.phone} />
              <DataRow label="Occupation" value={formData.occupation} />
              <Separator className="my-2" />
              <DataRow label="Height" value={heightStr} />
              <DataRow label="Current Weight" value={formData.weightLbs ? `${formData.weightLbs} lbs` : ''} />
              <Separator className="my-2" />
              <DataRow label="Emergency Contact" value={formData.emergencyContactName} />
              <DataRow label="Emergency Contact Phone" value={formData.emergencyContactPhone} />
              <DataRow label="Relationship" value={formData.emergencyContactRelationship} />
            </dl>
          </AccordionContent>
        </AccordionItem>

        {/* Address + pharmacy */}
        <AccordionItem value="address" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Address &amp; Pharmacy</span>
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
                      {formData.pharmacyPhone && <DataRow label="Pharmacy Phone" value={formData.pharmacyPhone} />}
                    </>
                  ) : preferredPharmacy ? (
                    <>
                      <DataRow label="Pharmacy Name" value={preferredPharmacy.name} />
                      <DataRow label="Pharmacy Address" value={preferredPharmacy.address} />
                      <DataRow label="Pharmacy City" value={preferredPharmacy.city} />
                      <DataRow label="Pharmacy State" value={preferredPharmacy.state || 'CA'} />
                      <DataRow label="Pharmacy ZIP" value={preferredPharmacy.zipCode} />
                      {preferredPharmacy.phone && <DataRow label="Pharmacy Phone" value={preferredPharmacy.phone} />}
                    </>
                  ) : null}
                </dl>
              </>
            )}
            {formData.additionalPharmacyNotes && (
              <>
                <Separator className="my-2" />
                <dl><DataRow label="Additional Pharmacy Notes" value={formData.additionalPharmacyNotes} /></dl>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Step 2 — Weight history & goals */}
        <AccordionItem value="weight-history" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Weight History &amp; Goals</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-1">
              <DataRow
                label="Primary Medication Goal"
                value={
                  formData.primaryMedicationGoal === 'other' && formData.primaryMedicationGoalOther
                    ? formData.primaryMedicationGoalOther
                    : humanizeValue(formData.primaryMedicationGoal)
                }
              />
              <DataRow label="Current Weight" value={formData.weightLbs ? `${formData.weightLbs} lbs` : ''} />
              <DataRow label="Goal Weight" value={formData.goalWeightLbs ? `${formData.goalWeightLbs} lbs` : ''} />
              <DataRow
                label="Highest Adult Weight"
                value={formData.highestAdultWeightLbs ? `${formData.highestAdultWeightLbs} lbs` : ''}
              />
              <DataRow label="Time at Current Weight" value={humanizeValue(formData.timeAtCurrentWeight)} />
              <DataRow label="Weight Change Past Year" value={humanizeValue(formData.weightChangePastYear)} />
              <DataRow
                label="Weight-Loss Methods Tried"
                value={
                  Array.isArray(formData.weightLossMethodsTried)
                    ? formData.weightLossMethodsTried.map((v) => humanizeValue(v)).join(', ')
                    : ''
                }
              />
              <DataRow
                label="Prior Weight-Loss Medications"
                value={<YesNo value={formData.priorWeightLossMeds} highlightWhenYes={false} />}
              />
              {formData.priorWeightLossMeds && (
                <DataRow label="Prior Medications" value={formData.priorWeightLossMedsList} />
              )}
              <DataRow
                label="History of Bariatric Surgery"
                value={<YesNo value={formData.hadBariatricSurgery} />}
                highlight={!!formData.hadBariatricSurgery}
              />
              {formData.hadBariatricSurgery && (
                <DataRow label="Bariatric Surgery Details" value={formData.bariatricSurgeryDetails} />
              )}
            </dl>
          </AccordionContent>
        </AccordionItem>

        {/* Step 3 — Medical conditions */}
        <AccordionItem value="medical" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Medical Conditions</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-1">
              <DataRow
                label="Reported Conditions"
                value={labelConditions(formData.medicalConditions)}
                highlight={Array.isArray(formData.medicalConditions) && formData.medicalConditions.some((c) => c !== 'none')}
              />
              {formData.medicalConditionsOther && (
                <DataRow label="Other Conditions" value={formData.medicalConditionsOther} />
              )}
              <DataRow
                label="Recent Hospitalization"
                value={<YesNo value={formData.recentHospitalization} />}
                highlight={!!formData.recentHospitalization}
              />
              {formData.recentHospitalization && (
                <DataRow label="Hospitalization Details" value={formData.recentHospitalizationDetails} />
              )}
            </dl>
          </AccordionContent>
        </AccordionItem>

        {/* Step 4 — Diabetic eye screening */}
        <AccordionItem value="eye-screening" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Diabetic Eye Screening</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-1">
              <DataRow label="Diabetes Type" value={humanizeValue(formData.diabetesType)} />
              <DataRow label="Years Since Diagnosis" value={formData.yearsSinceDiabetesDiagnosis} />
              <DataRow label="Last A1c" value={formData.lastA1c} />
              <DataRow label="On Insulin" value={<YesNo value={formData.onInsulin} highlightWhenYes={false} />} />
              <Separator className="my-2" />
              <DataRow
                label="Retinopathy Severity"
                value={humanizeValue(formData.retinopathySeverity)}
                highlight={
                  formData.retinopathySeverity != null &&
                  formData.retinopathySeverity !== 'none'
                }
              />
              <DataRow
                label="Diabetic Macular Edema"
                value={<YesNo value={formData.diabeticMacularEdema} />}
                highlight={!!formData.diabeticMacularEdema}
              />
              <DataRow label="Last Eye Exam" value={humanizeValue(formData.lastEyeExam)} />
              <DataRow
                label="Recent Vision Changes"
                value={<YesNo value={formData.visionChanges} />}
                highlight={!!formData.visionChanges}
              />
              {formData.retinopathyTreatmentDetails && (
                <DataRow label="Retinopathy Treatment" value={formData.retinopathyTreatmentDetails} />
              )}
              <DataRow label="Treating Ophthalmologist" value={formData.ophthalmologistName} />
              <DataRow label="Ophthalmologist Phone" value={formData.ophthalmologistPhone} />
              <DataRow
                label="Acknowledged Retinopathy Monitoring"
                value={<YesNo value={formData.acknowledgeRetinopathyMonitoring} highlightWhenYes={false} />}
              />
            </dl>
          </AccordionContent>
        </AccordionItem>

        {/* Step 5 — Contraindication screen */}
        <AccordionItem value="contraindications" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Contraindication Screen</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-1">
              <DataRow label="Personal History of MTC" value={<YesNo value={formData.personalHistoryMTC} />} highlight={!!formData.personalHistoryMTC} />
              <DataRow label="Family History of MTC" value={<YesNo value={formData.familyHistoryMTC} />} highlight={!!formData.familyHistoryMTC} />
              <DataRow label="MEN2 Syndrome" value={<YesNo value={formData.men2Syndrome} />} highlight={!!formData.men2Syndrome} />
              <DataRow label="History of Pancreatitis" value={<YesNo value={formData.pancreatitisHistory} />} highlight={!!formData.pancreatitisHistory} />
              <DataRow label="Gallbladder Disease" value={<YesNo value={formData.gallbladderDisease} />} highlight={!!formData.gallbladderDisease} />
              <DataRow label="Severe Gastroparesis" value={<YesNo value={formData.severeGastroparesis} />} highlight={!!formData.severeGastroparesis} />
              <DataRow label="End-Stage Renal Disease" value={<YesNo value={formData.endStageRenalDisease} />} highlight={!!formData.endStageRenalDisease} />
              <DataRow
                label="Pregnancy Status"
                value={humanizeValue(formData.pregnancyStatus)}
                highlight={
                  formData.pregnancyStatus === 'pregnant' || formData.pregnancyStatus === 'trying-to-conceive'
                }
              />
              <DataRow
                label="Suicidal Ideation (Q37)"
                value={<YesNo value={formData.suicidalIdeation} />}
                highlight={!!formData.suicidalIdeation}
              />
            </dl>
          </AccordionContent>
        </AccordionItem>

        {/* Step 6 — Medications & drug-interaction answers */}
        <AccordionItem value="medications" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <Pill className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Medications &amp; Allergies</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-1">
              <DataRow
                label="Currently Taking Medications"
                value={<YesNo value={formData.currentlyTakingMedications} highlightWhenYes={false} />}
              />
              {medications.length > 0 ? (
                <div className="py-2">
                  <dt className="text-sm text-muted-foreground mb-1">Medication List</dt>
                  <dd>
                    <ul className="space-y-2">
                      {medications.map((med, i) => (
                        <li key={i} className="text-sm border rounded-md p-2 bg-white">
                          <span className="font-medium">{med.name || 'Unnamed'}</span>
                          {med.dosage && <span className="text-muted-foreground"> — {med.dosage}</span>}
                          {med.frequency && <span className="text-muted-foreground"> — {med.frequency}</span>}
                          {med.reason && <div className="text-xs text-muted-foreground mt-0.5">Reason: {med.reason}</div>}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : (
                <DataRow label="Medication List" value={undefined} />
              )}

              <Separator className="my-2" />
              <DataRow
                label="Drug Allergies"
                value={<YesNo value={formData.hasDrugAllergies} />}
                highlight={!!formData.hasDrugAllergies}
              />
              {formData.hasDrugAllergies && (
                <DataRow label="Allergy Details" value={formData.drugAllergiesList} />
              )}

              <Separator className="my-2" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
                Drug-Interaction Screen
              </p>
              <DataRow
                label="Taking Insulin or Sulfonylurea"
                value={<YesNo value={formData.takingInsulinOrSulfonylurea} />}
                highlight={!!formData.takingInsulinOrSulfonylurea}
              />
              <DataRow
                label="Taking Another GLP-1 / Incretin"
                value={<YesNo value={formData.takingOtherGlp1} />}
                highlight={!!formData.takingOtherGlp1}
              />
              <DataRow label="Oral Contraceptive" value={<YesNo value={formData.takingOralContraceptive} />} highlight={!!formData.takingOralContraceptive} />
              <DataRow label="Warfarin / Blood Thinner" value={<YesNo value={formData.takingWarfarin} />} highlight={!!formData.takingWarfarin} />
              <DataRow label="Cyclosporine / Tacrolimus" value={<YesNo value={formData.takingCyclosporineTacrolimus} />} highlight={!!formData.takingCyclosporineTacrolimus} />
              <DataRow label="Levothyroxine" value={<YesNo value={formData.takingLevothyroxine} />} highlight={!!formData.takingLevothyroxine} />
            </dl>
          </AccordionContent>
        </AccordionItem>

        {/* Step 7 — Labs & vitals */}
        <AccordionItem value="labs" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Labs &amp; Vitals</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-1">
              <DataRow
                label="Has Recent Labs"
                value={<YesNo value={formData.hasRecentLabs} highlightWhenYes={false} />}
              />
              <DataRow label="Lab Document Uploaded" value={<YesNo value={formData.labDocumentUploaded} highlightWhenYes={false} />} />
              <Separator className="my-2" />
              <div className="grid grid-cols-2 gap-x-4">
                <DataRow label="A1c" value={formData.labA1c} />
                <DataRow label="Fasting Glucose" value={formData.labFastingGlucose} />
                <DataRow label="Total Cholesterol" value={formData.labCholesterolTotal} />
                <DataRow label="Triglycerides" value={formData.labTriglycerides} />
                <DataRow label="LDL" value={formData.labLDL} />
                <DataRow label="HDL" value={formData.labHDL} />
                <DataRow label="ALT" value={formData.labAlt} />
                <DataRow label="AST" value={formData.labAST} />
                <DataRow label="Creatinine" value={formData.labCreatinine} />
                <DataRow label="TSH" value={formData.labTSH} />
                <DataRow label="Lipase" value={formData.labLipase} />
              </div>
              <Separator className="my-2" />
              <div className="grid grid-cols-2 gap-x-4">
                <DataRow label="Resting Heart Rate" value={formData.restingHeartRate} />
                <DataRow label="Blood Pressure" value={formData.bloodPressure} />
              </div>
            </dl>
          </AccordionContent>
        </AccordionItem>

        {/* Step 8 — Lifestyle */}
        <AccordionItem value="lifestyle" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Lifestyle</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-1">
              <DataRow label="Diet Pattern" value={formData.dietPattern} />
              <DataRow label="Exercise Frequency" value={humanizeValue(formData.exerciseFrequency)} />
              <DataRow label="Alcohol Use" value={humanizeValue(formData.alcoholUse)} />
              <DataRow label="Tobacco Use" value={humanizeValue(formData.tobaccoUse)} />
              <DataRow
                label="Recreational Substances"
                value={<YesNo value={formData.recreationalSubstances} />}
                highlight={!!formData.recreationalSubstances}
              />
              {formData.recreationalSubstances && (
                <DataRow label="Substance Details" value={formData.recreationalSubstancesDetails} />
              )}
              <DataRow label="Stress Level" value={humanizeValue(formData.stressLevel)} />
              <DataRow label="Emotional Eating" value={humanizeValue(formData.emotionalEating)} />
            </dl>
          </AccordionContent>
        </AccordionItem>

        {/* Step 9 — Procedures & surgery */}
        <AccordionItem value="procedures" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Procedures &amp; Surgery</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-1">
              <DataRow
                label="Upcoming Surgery"
                value={<YesNo value={formData.upcomingSurgery} />}
                highlight={!!formData.upcomingSurgery}
              />
              {formData.upcomingSurgery && (
                <>
                  <DataRow label="Surgery Details" value={formData.upcomingSurgeryDetails} />
                  <DataRow
                    label="Acknowledged Anesthesia Hold"
                    value={<YesNo value={formData.acknowledgeAnesthesiaHold} highlightWhenYes={false} />}
                  />
                </>
              )}
              <DataRow
                label="Past Abdominal / GI Surgery"
                value={<YesNo value={formData.pastGiSurgery} />}
                highlight={!!formData.pastGiSurgery}
              />
              {formData.pastGiSurgery && (
                <DataRow label="GI Surgery Details" value={formData.pastGiSurgeryDetails} />
              )}
            </dl>
          </AccordionContent>
        </AccordionItem>

        {/* Step 10 — Mental health (PHQ-2) */}
        <AccordionItem value="mental-health" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Mental Health</span>
              {summary && (
                <Badge
                  variant={summary.phq2Score >= 3 ? 'destructive' : 'secondary'}
                  className="ml-2 text-xs"
                >
                  PHQ-2: {summary.phq2Score}
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-1">
              <DataRow
                label="History of Eating Disorder"
                value={<YesNo value={formData.eatingDisorderHistory} />}
                highlight={!!formData.eatingDisorderHistory}
              />
              <DataRow label="PHQ-2 — Little Interest / Pleasure" value={formData.phq2Interest != null ? `${formData.phq2Interest} / 3` : undefined} />
              <DataRow label="PHQ-2 — Feeling Down / Depressed" value={formData.phq2Down != null ? `${formData.phq2Down} / 3` : undefined} />
              {summary && (
                <DataRow
                  label="PHQ-2 Total"
                  value={`${summary.phq2Score} / 6`}
                  highlight={summary.phq2Score >= 3}
                />
              )}
              <DataRow
                label="Mental Health Conditions"
                value={
                  Array.isArray(formData.mentalHealthConditions)
                    ? formData.mentalHealthConditions.map((v) => humanizeValue(v)).join(', ')
                    : ''
                }
              />
              <DataRow
                label="Currently in Mental-Health Treatment"
                value={<YesNo value={formData.currentMentalHealthTreatment} highlightWhenYes={false} />}
              />
              <DataRow label="Emotionally Ready for Change" value={humanizeValue(formData.emotionallyReady)} />
              {formData.emotionallyReadyConcerns && (
                <DataRow label="Readiness Concerns" value={formData.emotionallyReadyConcerns} />
              )}
            </dl>
          </AccordionContent>
        </AccordionItem>

        {/* Step 11 — Referral & care coordination */}
        <AccordionItem value="referral" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Referral &amp; Care Coordination</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-1">
              <DataRow
                label="Referral Source"
                value={
                  formData.referralSource === 'other' && formData.referralSourceOther
                    ? formData.referralSourceOther
                    : humanizeValue(formData.referralSource)
                }
              />
              <DataRow
                label="Has Primary Care Physician"
                value={<YesNo value={formData.hasPrimaryCarePhysician} highlightWhenYes={false} />}
              />
              {formData.hasPrimaryCarePhysician && (
                <>
                  <DataRow label="PCP Name" value={formData.pcpName} />
                  <DataRow label="PCP Phone" value={formData.pcpPhone} />
                  <DataRow label="PCP Fax / Email" value={formData.pcpFaxOrEmail} />
                  <DataRow
                    label="Consents to Coordinate with PCP"
                    value={<YesNo value={formData.consentToCoordinateWithPcp} highlightWhenYes={false} />}
                  />
                </>
              )}
            </dl>
          </AccordionContent>
        </AccordionItem>

        {/* Review acknowledgements */}
        <AccordionItem value="acknowledgements" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Patient Acknowledgements</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <dl className="space-y-1">
              <DataRow label="Information Accurate" value={<YesNo value={formData.ackInfoAccurate} highlightWhenYes={false} />} />
              <DataRow label="Understands Clinical Indication" value={<YesNo value={formData.ackClinicalIndication} highlightWhenYes={false} />} />
              <DataRow label="Agrees to Follow-Up Compliance" value={<YesNo value={formData.ackFollowUpCompliance} highlightWhenYes={false} />} />
            </dl>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
