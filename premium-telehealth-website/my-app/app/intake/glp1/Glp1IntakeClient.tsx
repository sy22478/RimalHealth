'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useForm,
  FormProvider,
  useFormContext,
  useFieldArray,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Save,
  Shield,
  Info,
  LogOut,
  ClipboardCheck,
  Scale,
  Plus,
  Trash2,
  Eye,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { LoadingButton } from '@/components/ui/LoadingButton';
import { DocumentUpload } from '@/components/patient/DocumentUpload';
import { CrisisBanner } from '@/components/intake/CrisisBanner';
import {
  MEDICAL_CONDITIONS,
  DIABETIC_EYE_SCREENING_TRIGGERS,
  MAX_MEDICATION_ENTRIES,
  CONTRAINDICATIONS,
  DRUG_INTERACTION_NOTES,
} from '@/lib/intake/glp1/clinical-config';
import { calculateBmi, evaluateContraindications } from '@/lib/intake/glp1/scoring';
import type { Glp1FormData } from '@/lib/intake/glp1/types';

// ============================================================================
// Validation Schema — mirrors Glp1FormData (lib/intake/glp1/types.ts) and the
// server schema (lib/validation/glp1-schemas.ts). Field names/types match the
// authoritative contract exactly.
// ============================================================================

const glp1MedicationEntrySchema = z.object({
  name: z.string().max(200),
  dosage: z.string().max(100),
  frequency: z.string().max(100),
  reason: z.string().max(200),
});

const glp1IntakeFormSchema = z.object({
  // Step 1: Demographics
  firstName: z.string().min(1, { message: 'First name is required' }),
  lastName: z.string().min(1, { message: 'Last name is required' }),
  dateOfBirth: z
    .string()
    .min(1, { message: 'Date of birth is required' })
    .refine((dob) => {
      let birthDate: Date;
      if (/^\d{4}-\d{2}-\d{2}/.test(dob)) {
        const [y, m, d] = dob.split('-').map(Number);
        birthDate = new Date(y, m - 1, d);
      } else {
        birthDate = new Date(dob);
      }
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age >= 18;
    }, { message: 'You must be at least 18 years old to use our services' }),
  biologicalSex: z.enum(['MALE', 'FEMALE', 'OTHER'], { message: 'Please select your biological sex' }),
  biologicalSexOther: z.string().max(100).optional(),
  genderIdentity: z.enum(['male', 'female', 'transgender_male', 'transgender_female', 'non_binary', 'prefer_not_to_say', 'other']).optional(),
  genderIdentityOther: z.string().max(100).optional(),
  occupation: z.string().max(100).optional(),
  phone: z.string().min(10, { message: 'Valid phone number required' }),
  addressStreet: z.string().min(1, { message: 'Street address is required' }),
  addressCity: z
    .string()
    .min(2, { message: 'City name is required' })
    .max(100, { message: 'City name is too long' })
    .regex(/^[a-zA-Z\s\-'.]+$/, { message: 'City name contains invalid characters' }),
  addressState: z.literal('CA', { message: 'Service is only available in California' }),
  addressZip: z
    .string()
    .regex(/^\d{5}$/, { message: 'Must be a 5-digit ZIP code' })
    .refine((zip) => {
      const n = parseInt(zip, 10);
      return n >= 90001 && n <= 96162;
    }, { message: 'Must be a valid California ZIP code (90001-96162)' }),
  heightFeet: z.number({ message: 'Height (feet) is required' }).min(1, { message: 'Enter your height in feet' }).max(8, { message: 'Please enter a valid height' }),
  heightInches: z.number({ message: 'Height (inches) is required' }).min(0).max(11, { message: 'Inches must be 0-11' }),
  weightLbs: z.number({ message: 'Weight is required' }).min(50, { message: 'Please enter a valid weight' }).max(1500, { message: 'Please enter a valid weight' }),
  bmi: z.number().optional(),
  // Emergency contact (required per PDF spec)
  emergencyContactName: z.string().min(1, { message: 'Emergency contact name is required' }).max(100),
  emergencyContactPhone: z.string().min(10, { message: 'Valid phone number required' }).max(20),
  emergencyContactRelationship: z.string().min(1, { message: 'Relationship is required' }).max(50),

  // Step 2: Weight history
  highestAdultWeightLbs: z.number({ message: 'Highest adult weight is required' }).min(50, { message: 'Please enter a valid weight' }).max(1500, { message: 'Please enter a valid weight' }),
  goalWeightLbs: z.number({ message: 'Goal weight is required' }).min(50, { message: 'Please enter a valid weight' }).max(1500, { message: 'Please enter a valid weight' }),
  weightLossMethodsTried: z.array(z.string()),
  weightChangePastYear: z.enum(['gained', 'lost', 'stable'], { message: 'Please select your weight change over the past year' }),
  hadBariatricSurgery: z.boolean({ message: 'Please indicate if you have had bariatric surgery' }),
  bariatricSurgeryDetails: z.string().max(1000).optional(),
  priorWeightLossMeds: z.boolean({ message: 'Please indicate if you have taken prior weight-loss medications' }),
  priorWeightLossMedsList: z.string().max(1000).optional(),
  primaryMedicationGoal: z.enum(['weight_loss', 'blood_sugar_control', 'both', 'other']).optional(),
  primaryMedicationGoalOther: z.string().max(200).optional(),
  timeAtCurrentWeight: z.enum(['less_than_6_months', '6_to_12_months', '1_to_2_years', '2_to_5_years', 'over_5_years']).optional(),

  // Step 3: Medical history
  medicalConditions: z.array(z.string()),
  medicalConditionsOther: z.string().max(1000).optional(),
  recentHospitalization: z.boolean({ message: 'Please indicate any recent hospitalization' }),
  recentHospitalizationDetails: z.string().max(1000).optional(),

  // Step 4: Diabetic eye screening (conditional → all optional)
  diabetesType: z.enum(['type-1', 'type-2', 'pre-diabetes', 'gestational', 'none']).optional(),
  yearsSinceDiabetesDiagnosis: z.string().max(50).optional(),
  lastA1c: z.string().max(50).optional(),
  onInsulin: z.boolean().optional(),
  retinopathySeverity: z.enum(['none', 'mild_npdr', 'moderate_npdr', 'severe_npdr', 'pdr']).optional(),
  diabeticMacularEdema: z.boolean().optional(),
  ophthalmologistName: z.string().max(100).optional(),
  ophthalmologistPhone: z.string().max(20).optional(),
  lastEyeExam: z.enum(['within-1-year', '1-2-years', 'over-2-years', 'never']).optional(),
  visionChanges: z.boolean().optional(),
  retinopathyTreatmentDetails: z.string().max(500).optional(),
  acknowledgeRetinopathyMonitoring: z.boolean().optional(),

  // Step 5: Contraindications
  personalHistoryMTC: z.boolean({ message: 'Please answer this question' }),
  familyHistoryMTC: z.boolean({ message: 'Please answer this question' }),
  men2Syndrome: z.boolean({ message: 'Please answer this question' }),
  pancreatitisHistory: z.boolean({ message: 'Please answer this question' }),
  gallbladderDisease: z.boolean({ message: 'Please answer this question' }),
  severeGastroparesis: z.boolean({ message: 'Please answer this question' }),
  pregnancyStatus: z.enum(['pregnant', 'trying-to-conceive', 'breastfeeding', 'none'], { message: 'Please select your pregnancy status' }),
  endStageRenalDisease: z.boolean({ message: 'Please answer this question' }),
  suicidalIdeation: z.boolean({ message: 'Please answer this question' }),

  // Step 6: Medications & allergies
  currentlyTakingMedications: z.boolean({ message: 'Please indicate if you take any medications' }),
  medicationList: z.array(glp1MedicationEntrySchema).max(MAX_MEDICATION_ENTRIES),
  hasDrugAllergies: z.boolean({ message: 'Please indicate if you have drug allergies' }),
  drugAllergiesList: z.string().max(1000).optional(),
  takingInsulinOrSulfonylurea: z.boolean({ message: 'Please answer this question' }),
  takingOtherGlp1: z.boolean({ message: 'Please answer this question' }),
  takingOralContraceptive: z.boolean().optional(),
  takingWarfarin: z.boolean().optional(),
  takingCyclosporineTacrolimus: z.boolean().optional(),
  takingLevothyroxine: z.boolean().optional(),

  // Step 7: Labs & vitals (self-reported → optional)
  hasRecentLabs: z.boolean({ message: 'Please indicate if you have recent labs' }),
  labA1c: z.string().max(50).optional(),
  labFastingGlucose: z.string().max(50).optional(),
  labCholesterolTotal: z.string().max(50).optional(),
  labTriglycerides: z.string().max(50).optional(),
  labCreatinine: z.string().max(50).optional(),
  labAlt: z.string().max(50).optional(),
  labLDL: z.string().max(10).optional(),
  labHDL: z.string().max(10).optional(),
  labAST: z.string().max(10).optional(),
  labTSH: z.string().max(10).optional(),
  labLipase: z.string().max(10).optional(),
  restingHeartRate: z.string().max(50).optional(),
  bloodPressure: z.string().max(50).optional(),
  labDocumentUploaded: z.boolean().optional(),

  // Step 8: Lifestyle
  dietPattern: z.string().min(1, { message: 'Please describe your typical diet' }).max(200),
  exerciseFrequency: z.enum(['none', '1-2-week', '3-4-week', '5-plus-week'], { message: 'Please select how often you exercise' }),
  alcoholUse: z.enum(['none', 'occasional', 'moderate', 'heavy'], { message: 'Please select your alcohol use' }),
  tobaccoUse: z.enum(['never', 'former', 'current'], { message: 'Please select your tobacco use' }),
  recreationalSubstances: z.boolean({ message: 'Please answer this question' }),
  recreationalSubstancesDetails: z.string().max(1000).optional(),
  stressLevel: z.enum(['low', 'moderate', 'high'], { message: 'Please select your stress level' }),
  emotionalEating: z.enum(['never', 'sometimes', 'often'], { message: 'Please select how often you eat emotionally' }),

  // Step 9: Procedures & surgery
  upcomingSurgery: z.boolean({ message: 'Please answer this question' }),
  upcomingSurgeryDetails: z.string().max(1000).optional(),
  acknowledgeAnesthesiaHold: z.boolean().optional(),
  pastGiSurgery: z.boolean().optional(),
  pastGiSurgeryDetails: z.string().max(300).optional(),

  // Step 10: Mental health
  eatingDisorderHistory: z.boolean({ message: 'Please answer this question' }),
  phq2Interest: z.enum(['0', '1', '2', '3'], { message: 'Please answer this question' }),
  phq2Down: z.enum(['0', '1', '2', '3'], { message: 'Please answer this question' }),
  mentalHealthConditions: z.array(z.string()),
  currentMentalHealthTreatment: z.boolean({ message: 'Please answer this question' }),
  emotionallyReady: z.enum(['yes', 'somewhat', 'no', 'unsure']).optional(),
  emotionallyReadyConcerns: z.string().max(500).optional(),

  // Step 11: Referral & care coordination
  referralSource: z.enum(['internet_search', 'social_media', 'physician_referral', 'friend_family', 'insurance', 'other']).optional(),
  referralSourceOther: z.string().max(200).optional(),
  hasPrimaryCarePhysician: z.boolean({ message: 'Please answer this question' }),
  pcpName: z.string().max(100).optional(),
  pcpPhone: z.string().max(20).optional(),
  pcpFaxOrEmail: z.string().max(100).optional(),
  consentToCoordinateWithPcp: z.boolean().optional(),
  additionalPharmacyNotes: z.string().max(500).optional(),

  // Step 12: Review & consent acknowledgements
  ackInfoAccurate: z.literal(true, { message: 'You must confirm this to submit' }),
  ackClinicalIndication: z.literal(true, { message: 'You must confirm this to submit' }),
  ackFollowUpCompliance: z.literal(true, { message: 'You must confirm this to submit' }),

  // Pharmacy (CA-only; optional)
  pharmacyName: z.string().max(255).optional(),
  pharmacyAddress: z.string().max(255).optional(),
  pharmacyCity: z.string().max(100).optional(),
  pharmacyState: z.literal('CA').optional(),
  pharmacyZip: z.string().regex(/^\d{5}$/, { message: 'Must be a 5-digit ZIP code' }).optional(),
  pharmacyPhone: z.string().max(20).optional(),
});

type Glp1IntakeFormData = z.infer<typeof glp1IntakeFormSchema>;

// ============================================================================
// Scroll to first error helper
// ============================================================================

function scrollToFirstError(): void {
  setTimeout(() => {
    const firstError = document.querySelector('[role="alert"]');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const fieldContainer = firstError.closest('[role="group"], .space-y-2, .space-y-3');
      const focusable = fieldContainer?.querySelector<HTMLElement>('input, select, textarea');
      if (focusable) focusable.focus();
    }
  }, 100);
}

// ============================================================================
// Step Error Summary
// ============================================================================

function StepErrorSummary({ stepFields }: { stepFields: string[] }): React.ReactElement | null {
  const { formState: { errors } } = useFormContext<Glp1IntakeFormData>();

  const stepErrorCount = stepFields.filter(
    (field) => errors[field as keyof Glp1IntakeFormData]
  ).length;

  if (stepErrorCount === 0) return null;

  return (
    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
      <p className="text-sm font-medium text-red-800">
        {stepErrorCount} {stepErrorCount === 1 ? 'question needs' : 'questions need'} your attention
      </p>
    </div>
  );
}

// ============================================================================
// Boolean Radio Group (Yes/No)
// ============================================================================

function BooleanRadio({
  fieldKey,
  label,
}: {
  fieldKey: keyof Glp1IntakeFormData;
  label?: string;
}): React.ReactElement {
  const { watch, setValue, formState: { errors } } = useFormContext<Glp1IntakeFormData>();
  const value = watch(fieldKey);
  const hasError = !!errors[fieldKey];
  const errorId = `${fieldKey}-error`;

  return (
    <div
      role="radiogroup"
      aria-label={label || `${String(fieldKey)} selection`}
      aria-required="true"
      aria-describedby={hasError ? errorId : undefined}
    >
      <div className="flex gap-4">
        <div className="flex items-center space-x-2 min-h-[44px]">
          <input
            type="radio"
            id={`${fieldKey}-yes`}
            name={String(fieldKey)}
            checked={value === true}
            onChange={() => setValue(fieldKey, true as never, { shouldValidate: true, shouldDirty: true })}
            className="w-5 h-5 min-w-[44px] min-h-[44px] text-ocean-600 border-gray-300 focus:ring-ocean-500 cursor-pointer"
          />
          <Label htmlFor={`${fieldKey}-yes`} className="text-sm font-normal cursor-pointer">Yes</Label>
        </div>
        <div className="flex items-center space-x-2 min-h-[44px]">
          <input
            type="radio"
            id={`${fieldKey}-no`}
            name={String(fieldKey)}
            checked={value === false}
            onChange={() => setValue(fieldKey, false as never, { shouldValidate: true, shouldDirty: true })}
            className="w-5 h-5 min-w-[44px] min-h-[44px] text-ocean-600 border-gray-300 focus:ring-ocean-500 cursor-pointer"
          />
          <Label htmlFor={`${fieldKey}-no`} className="text-sm font-normal cursor-pointer">No</Label>
        </div>
      </div>
      {hasError && (
        <p id={errorId} className="text-sm text-red-500 mt-1" role="alert">{(errors[fieldKey]?.message as string) || 'Required'}</p>
      )}
    </div>
  );
}

// ============================================================================
// Reusable select field
// ============================================================================

function SelectField({
  fieldKey,
  options,
  placeholder = 'Select an option',
}: {
  fieldKey: keyof Glp1IntakeFormData;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}): React.ReactElement {
  const { register, formState: { errors } } = useFormContext<Glp1IntakeFormData>();
  const hasError = !!errors[fieldKey];

  return (
    <>
      <select
        {...register(fieldKey)}
        id={String(fieldKey)}
        aria-required="true"
        aria-describedby={hasError ? `${fieldKey}-error` : undefined}
        className={cn(
          'w-full px-3 py-2 min-h-[44px] border rounded-md focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none',
          hasError && 'border-red-500'
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {hasError && (
        <p id={`${fieldKey}-error`} className="text-sm text-red-500" role="alert">{errors[fieldKey]?.message as string}</p>
      )}
    </>
  );
}

// ============================================================================
// Step 1: Demographics + live BMI
// ============================================================================

function DemographicsStep(): React.ReactElement {
  const { register, watch, setValue, formState: { errors } } = useFormContext<Glp1IntakeFormData>();
  const biologicalSex = watch('biologicalSex');
  const genderIdentity = watch('genderIdentity');

  const heightFeet = watch('heightFeet');
  const heightInches = watch('heightInches');
  const weightLbs = watch('weightLbs');

  const bmi = React.useMemo(
    () => calculateBmi(Number(heightFeet), Number(heightInches), Number(weightLbs)),
    [heightFeet, heightInches, weightLbs]
  );

  // Persist the computed BMI into the form so it is saved/submitted.
  React.useEffect(() => {
    setValue('bmi', bmi, { shouldDirty: false });
  }, [bmi, setValue]);

  return (
    <section aria-label="Step 1: Demographics" className="space-y-6">
      <StepErrorSummary stepFields={['firstName', 'lastName', 'dateOfBirth', 'biologicalSex', 'phone', 'addressStreet', 'addressCity', 'addressState', 'addressZip', 'heightFeet', 'heightInches', 'weightLbs', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelationship']} />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
        <p className="text-sm text-gray-600">Please confirm or update the details below.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input id="firstName" {...register('firstName')} placeholder="Enter your first name" />
          {errors.firstName && <p className="text-sm text-red-500" role="alert">{errors.firstName.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input id="lastName" {...register('lastName')} placeholder="Enter your last name" />
          {errors.lastName && <p className="text-sm text-red-500" role="alert">{errors.lastName.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">Date of Birth *</Label>
          <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
          {errors.dateOfBirth && <p className="text-sm text-red-500" role="alert">{errors.dateOfBirth.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number *</Label>
          <Input id="phone" type="tel" {...register('phone')} placeholder="(555) 555-5555" />
          {errors.phone && <p className="text-sm text-red-500" role="alert">{errors.phone.message}</p>}
        </div>
      </div>

      {/* Biological sex */}
      <div className="space-y-3">
        <Label className="text-base font-medium">What is your biological sex? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <div className="space-y-2" role="radiogroup" aria-label="Biological sex" aria-required="true">
          {[
            { value: 'MALE', label: 'Male' },
            { value: 'FEMALE', label: 'Female' },
            { value: 'OTHER', label: 'Prefer to self-describe' },
          ].map((option) => (
            <label key={option.value} className="flex items-center gap-3 p-3 min-h-[44px] border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                value={option.value}
                {...register('biologicalSex')}
                className="w-5 h-5 min-w-[44px] min-h-[44px] text-ocean-600 border-gray-300 focus:ring-ocean-500 cursor-pointer"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
        {errors.biologicalSex && <p className="text-sm text-red-500" role="alert">{errors.biologicalSex.message}</p>}
        <AnimatePresence>
          {biologicalSex === 'OTHER' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <Input {...register('biologicalSexOther')} placeholder="Please describe..." aria-label="Self-describe biological sex" className="mt-2" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Gender identity — distinct from biological sex */}
      <div className="space-y-2">
        <Label htmlFor="genderIdentity" className="text-base font-medium">What is your gender identity? <span className="text-sm font-normal text-gray-500">(optional)</span></Label>
        <SelectField
          fieldKey="genderIdentity"
          placeholder="Select (optional)"
          options={[
            { value: 'male', label: 'Man' },
            { value: 'female', label: 'Woman' },
            { value: 'transgender_male', label: 'Transgender man' },
            { value: 'transgender_female', label: 'Transgender woman' },
            { value: 'non_binary', label: 'Non-binary / gender non-conforming' },
            { value: 'prefer_not_to_say', label: 'Prefer not to say' },
            { value: 'other', label: 'Prefer to self-describe' },
          ]}
        />
        <AnimatePresence>
          {genderIdentity === 'other' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <Input {...register('genderIdentityOther')} placeholder="Please describe..." aria-label="Self-describe gender identity" className="mt-2" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Address */}
      <div className="pt-4 border-t">
        <h4 className="text-md font-medium text-gray-900 mb-3">Home Address</h4>
        <p className="text-sm text-gray-500 mb-4">Rimal Health currently serves California residents only.</p>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="addressStreet">Street Address *</Label>
            <Input id="addressStreet" {...register('addressStreet')} placeholder="123 Main St" />
            {errors.addressStreet && <p className="text-sm text-red-500" role="alert">{errors.addressStreet.message}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="addressCity">City *</Label>
              <Input id="addressCity" {...register('addressCity')} placeholder="Los Angeles" />
              {errors.addressCity && <p className="text-sm text-red-500" role="alert">{errors.addressCity.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressStateDisplay">State</Label>
              <Input id="addressStateDisplay" value="California" disabled className="bg-gray-50" />
              <input type="hidden" value="CA" {...register('addressState')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressZip">ZIP Code *</Label>
              <Input id="addressZip" {...register('addressZip')} placeholder="90001" maxLength={5} />
              {errors.addressZip && <p className="text-sm text-red-500" role="alert">{errors.addressZip.message}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Occupation (optional) */}
      <div className="space-y-2">
        <Label htmlFor="occupation">Occupation <span className="text-sm font-normal text-gray-500">(optional)</span></Label>
        <Input id="occupation" {...register('occupation')} placeholder="e.g., Teacher" />
      </div>

      {/* Height / weight / BMI */}
      <div className="pt-4 border-t">
        <h4 className="text-md font-medium text-gray-900 mb-3">Height &amp; Weight</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="heightFeet">Height (feet) *</Label>
            <Input id="heightFeet" type="number" min={1} max={8} {...register('heightFeet', { valueAsNumber: true })} placeholder="5" />
            {errors.heightFeet && <p className="text-sm text-red-500" role="alert">{errors.heightFeet.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="heightInches">Height (inches) *</Label>
            <Input id="heightInches" type="number" min={0} max={11} {...register('heightInches', { valueAsNumber: true })} placeholder="8" />
            {errors.heightInches && <p className="text-sm text-red-500" role="alert">{errors.heightInches.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="weightLbs">Weight (lbs) *</Label>
            <Input id="weightLbs" type="number" min={50} max={1500} {...register('weightLbs', { valueAsNumber: true })} placeholder="200" />
            {errors.weightLbs && <p className="text-sm text-red-500" role="alert">{errors.weightLbs.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="bmiDisplay">BMI (auto-calculated)</Label>
            <Input id="bmiDisplay" value={bmi > 0 ? bmi.toFixed(1) : ''} placeholder="—" readOnly disabled className="bg-gray-50 font-semibold" />
          </div>
        </div>
        {bmi > 0 && (
          <p className="mt-2 text-sm text-gray-600" aria-live="polite">
            Your calculated BMI is <strong>{bmi.toFixed(1)}</strong>. Eligibility is determined by the prescribing physician.
          </p>
        )}
      </div>

      {/* Emergency contact (required) */}
      <div className="pt-4 border-t">
        <h4 className="text-md font-medium text-gray-900 mb-3">Emergency Contact</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="emergencyContactName">Full name *</Label>
            <Input id="emergencyContactName" {...register('emergencyContactName')} placeholder="Jane Doe" />
            {errors.emergencyContactName && <p className="text-sm text-red-500" role="alert">{errors.emergencyContactName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergencyContactPhone">Phone *</Label>
            <Input id="emergencyContactPhone" type="tel" {...register('emergencyContactPhone')} placeholder="(555) 555-5555" />
            {errors.emergencyContactPhone && <p className="text-sm text-red-500" role="alert">{errors.emergencyContactPhone.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergencyContactRelationship">Relationship *</Label>
            <Input id="emergencyContactRelationship" {...register('emergencyContactRelationship')} placeholder="e.g., Spouse" />
            {errors.emergencyContactRelationship && <p className="text-sm text-red-500" role="alert">{errors.emergencyContactRelationship.message}</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Step 2: Weight history
// ============================================================================

function WeightHistoryStep(): React.ReactElement {
  const { register, watch, formState: { errors } } = useFormContext<Glp1IntakeFormData>();
  const hadBariatricSurgery = watch('hadBariatricSurgery');
  const priorWeightLossMeds = watch('priorWeightLossMeds');
  const primaryMedicationGoal = watch('primaryMedicationGoal');

  const methodOptions = [
    { id: 'diet', label: 'Diet / calorie restriction' },
    { id: 'exercise', label: 'Exercise programs' },
    { id: 'commercial-program', label: 'Commercial program (Weight Watchers, Noom, etc.)' },
    { id: 'meal-replacement', label: 'Meal replacements / shakes' },
    { id: 'otc-supplements', label: 'Over-the-counter supplements' },
    { id: 'prescription-meds', label: 'Prescription weight-loss medications' },
    { id: 'none', label: 'None of the above' },
  ];

  return (
    <section aria-label="Step 2: Weight History" className="space-y-6">
      <StepErrorSummary stepFields={['highestAdultWeightLbs', 'goalWeightLbs', 'weightChangePastYear', 'hadBariatricSurgery', 'priorWeightLossMeds']} />

      <div className="space-y-2">
        <Label htmlFor="primaryMedicationGoal" className="text-base font-medium">What is your primary goal with this medication? <span className="text-sm font-normal text-gray-500">(optional)</span></Label>
        <SelectField
          fieldKey="primaryMedicationGoal"
          placeholder="Select (optional)"
          options={[
            { value: 'weight_loss', label: 'Weight loss' },
            { value: 'blood_sugar_control', label: 'Blood sugar control' },
            { value: 'both', label: 'Both weight loss and blood sugar control' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <AnimatePresence>
          {primaryMedicationGoal === 'other' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <Input {...register('primaryMedicationGoalOther')} placeholder="Please describe your goal..." aria-label="Other primary goal" className="mt-2" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-2">
        <Label htmlFor="timeAtCurrentWeight" className="text-base font-medium">How long have you been at or above your current weight? <span className="text-sm font-normal text-gray-500">(optional)</span></Label>
        <SelectField
          fieldKey="timeAtCurrentWeight"
          placeholder="Select (optional)"
          options={[
            { value: 'less_than_6_months', label: 'Less than 6 months' },
            { value: '6_to_12_months', label: '6 to 12 months' },
            { value: '1_to_2_years', label: '1 to 2 years' },
            { value: '2_to_5_years', label: '2 to 5 years' },
            { value: 'over_5_years', label: 'More than 5 years' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="highestAdultWeightLbs">Highest adult weight (lbs) *</Label>
          <Input id="highestAdultWeightLbs" type="number" min={50} max={1500} {...register('highestAdultWeightLbs', { valueAsNumber: true })} placeholder="240" />
          {errors.highestAdultWeightLbs && <p className="text-sm text-red-500" role="alert">{errors.highestAdultWeightLbs.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="goalWeightLbs">Goal weight (lbs) *</Label>
          <Input id="goalWeightLbs" type="number" min={50} max={1500} {...register('goalWeightLbs', { valueAsNumber: true })} placeholder="180" />
          {errors.goalWeightLbs && <p className="text-sm text-red-500" role="alert">{errors.goalWeightLbs.message}</p>}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-base font-medium">Which weight-loss methods have you tried? <span className="text-sm font-normal text-gray-500 block mt-1">Select all that apply</span></Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {methodOptions.map((option) => (
            <label key={option.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                value={option.id}
                {...register('weightLossMethodsTried')}
                className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-primary text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="weightChangePastYear" className="text-base font-medium">Over the past year, your weight has: <span className="text-red-500" aria-hidden="true">*</span></Label>
        <SelectField
          fieldKey="weightChangePastYear"
          options={[
            { value: 'gained', label: 'Increased (gained weight)' },
            { value: 'lost', label: 'Decreased (lost weight)' },
            { value: 'stable', label: 'Stayed about the same' },
          ]}
        />
      </div>

      <div className="space-y-3">
        <Label className="text-base font-medium">Have you had bariatric (weight-loss) surgery? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <BooleanRadio fieldKey="hadBariatricSurgery" />
        <AnimatePresence>
          {hadBariatricSurgery === true && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pl-4">
              <Label htmlFor="bariatricSurgeryDetails" className="text-sm">Please describe the type and approximate date of surgery:</Label>
              <Textarea id="bariatricSurgeryDetails" {...register('bariatricSurgeryDetails')} placeholder="e.g., Gastric sleeve, 2019" className="mt-2" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-3">
        <Label className="text-base font-medium">Have you taken prescription weight-loss medications before? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <BooleanRadio fieldKey="priorWeightLossMeds" />
        <AnimatePresence>
          {priorWeightLossMeds === true && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pl-4">
              <Label htmlFor="priorWeightLossMedsList" className="text-sm">Please list the medications and your experience:</Label>
              <Textarea id="priorWeightLossMedsList" {...register('priorWeightLossMedsList')} placeholder="e.g., Phentermine — helped briefly, regained weight" className="mt-2" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

// ============================================================================
// Step 3: Medical history
// ============================================================================

function MedicalHistoryStep(): React.ReactElement {
  const { register, watch, formState: { errors } } = useFormContext<Glp1IntakeFormData>();
  const medicalConditions = watch('medicalConditions') || [];
  const recentHospitalization = watch('recentHospitalization');

  const hasEyeScreeningTrigger = Array.isArray(medicalConditions)
    && medicalConditions.some((c) => DIABETIC_EYE_SCREENING_TRIGGERS.includes(c));

  return (
    <section aria-label="Step 3: Medical History" className="space-y-6">
      <StepErrorSummary stepFields={['medicalConditions', 'recentHospitalization']} />

      <div className="space-y-3">
        <Label className="text-base font-medium">Do you have any of the following conditions? <span className="text-sm font-normal text-gray-500 block mt-1">Select all that apply</span></Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {MEDICAL_CONDITIONS.map((option) => (
            <label key={option.value} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                value={option.value}
                {...register('medicalConditions')}
                className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-primary text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
        {errors.medicalConditions && <p className="text-sm text-red-500" role="alert">{errors.medicalConditions.message as string}</p>}
      </div>

      <AnimatePresence>
        {hasEyeScreeningTrigger && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <Alert className="bg-blue-50 border-blue-200">
              <Eye className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Because you indicated a diabetes-related condition, we will ask a few additional eye-health questions in the next step.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        <Label htmlFor="medicalConditionsOther" className="text-base font-medium">Any other significant conditions not listed above?</Label>
        <Textarea id="medicalConditionsOther" {...register('medicalConditionsOther')} placeholder="Describe any other conditions..." />
      </div>

      <div className="space-y-3">
        <Label className="text-base font-medium">Have you been hospitalized in the past 12 months? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <BooleanRadio fieldKey="recentHospitalization" />
        <AnimatePresence>
          {recentHospitalization === true && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pl-4">
              <Label htmlFor="recentHospitalizationDetails" className="text-sm">Please describe the reason and approximate date:</Label>
              <Textarea id="recentHospitalizationDetails" {...register('recentHospitalizationDetails')} placeholder="e.g., Pneumonia, March 2026" className="mt-2" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

// ============================================================================
// Step 4: Diabetic eye screening (conditional)
// ============================================================================

function DiabeticEyeScreeningStep(): React.ReactElement {
  const { register, watch } = useFormContext<Glp1IntakeFormData>();
  const retinopathySeverity = watch('retinopathySeverity');
  const showRetinopathyDetail = !!retinopathySeverity && retinopathySeverity !== 'none';

  return (
    <section aria-label="Step 4: Diabetic Eye Screening" className="space-y-6">
      <StepErrorSummary stepFields={[]} />

      <Alert className="bg-amber-50 border-amber-200">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800">Retinopathy monitoring</AlertTitle>
        <AlertDescription className="text-amber-700">
          Rapid improvement in blood sugar with GLP-1 therapy can temporarily worsen diabetic retinopathy.
          These questions help your physician decide if eye monitoring is needed before starting.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label htmlFor="diabetesType" className="text-base font-medium">What type of diabetes do you have?</Label>
        <SelectField
          fieldKey="diabetesType"
          options={[
            { value: 'type-1', label: 'Type 1 diabetes' },
            { value: 'type-2', label: 'Type 2 diabetes' },
            { value: 'pre-diabetes', label: 'Pre-diabetes / insulin resistance' },
            { value: 'gestational', label: 'Gestational diabetes' },
            { value: 'none', label: 'None / not sure' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="yearsSinceDiabetesDiagnosis">Years since diagnosis</Label>
          <Input id="yearsSinceDiabetesDiagnosis" {...register('yearsSinceDiabetesDiagnosis')} placeholder="e.g., 5" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastA1c">Most recent A1c (if known)</Label>
          <Input id="lastA1c" {...register('lastA1c')} placeholder="e.g., 7.2%" />
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-base font-medium">Are you currently taking insulin?</Label>
        <BooleanRadio fieldKey="onInsulin" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="retinopathySeverity" className="text-base font-medium">Have you been diagnosed with diabetic retinopathy? If so, what stage?</Label>
        <SelectField
          fieldKey="retinopathySeverity"
          placeholder="Select severity"
          options={[
            { value: 'none', label: 'None — not diagnosed' },
            { value: 'mild_npdr', label: 'Mild NPDR (non-proliferative)' },
            { value: 'moderate_npdr', label: 'Moderate NPDR' },
            { value: 'severe_npdr', label: 'Severe NPDR' },
            { value: 'pdr', label: 'PDR (proliferative diabetic retinopathy)' },
          ]}
        />
      </div>

      <div className="space-y-3">
        <Label className="text-base font-medium">Have you been diagnosed with diabetic macular edema (DME)?</Label>
        <BooleanRadio fieldKey="diabeticMacularEdema" />
      </div>

      <AnimatePresence>
        {showRetinopathyDetail && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ophthalmologistName">Eye doctor / practice <span className="text-sm font-normal text-gray-500">(optional)</span></Label>
                <Input id="ophthalmologistName" {...register('ophthalmologistName')} placeholder="Dr. Smith / Vision Care" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ophthalmologistPhone">Eye doctor phone <span className="text-sm font-normal text-gray-500">(optional)</span></Label>
                <Input id="ophthalmologistPhone" type="tel" {...register('ophthalmologistPhone')} placeholder="(555) 555-5555" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="retinopathyTreatmentDetails">Describe any treatments you have had:</Label>
              <Textarea id="retinopathyTreatmentDetails" {...register('retinopathyTreatmentDetails')} placeholder="Describe any treatments (laser, anti-VEGF injection, vitrectomy, etc.)" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        <Label htmlFor="lastEyeExam" className="text-base font-medium">When was your last dilated eye exam?</Label>
        <SelectField
          fieldKey="lastEyeExam"
          options={[
            { value: 'within-1-year', label: 'Within the past year' },
            { value: '1-2-years', label: '1-2 years ago' },
            { value: 'over-2-years', label: 'More than 2 years ago' },
            { value: 'never', label: 'Never / not sure' },
          ]}
        />
      </div>

      <div className="space-y-3">
        <Label className="text-base font-medium">Have you noticed any recent changes in your vision?</Label>
        <BooleanRadio fieldKey="visionChanges" />
      </div>

      <div className="space-y-3 p-4 border border-amber-200 rounded-lg bg-amber-50/50">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            {...register('acknowledgeRetinopathyMonitoring')}
            className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-primary text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
          />
          <span className="text-sm text-gray-700">
            I understand that GLP-1 therapy may require eye monitoring, and I will follow my physician&apos;s recommendations for retinopathy screening.
          </span>
        </label>
      </div>
    </section>
  );
}

// ============================================================================
// Step 5: Contraindications
// ============================================================================

function ContraindicationsStep(): React.ReactElement {
  const { watch } = useFormContext<Glp1IntakeFormData>();
  const suicidalIdeation = watch('suicidalIdeation');
  const watchedValues = watch();

  // Data-driven hard-stop detection: reuse the same config + evaluator the
  // server scoring uses, then surface each HARD_STOP's patient-facing message.
  // Patients may still submit (a physician confirms ineligibility / alternatives);
  // the prescription pathway is what's blocked, server-side (priority CONTRAINDICATED).
  const hardStops = React.useMemo(() => {
    const messageByCondition = new Map(CONTRAINDICATIONS.map((c) => [c.condition, c.message]));
    return evaluateContraindications(watchedValues as unknown as Glp1FormData)
      .filter((f) => f.disposition === 'HARD_STOP')
      .map((f) => ({ condition: f.condition, message: messageByCondition.get(f.condition) ?? '' }));
  }, [watchedValues]);

  const questions: Array<{ key: keyof Glp1IntakeFormData; label: string }> = [
    { key: 'personalHistoryMTC', label: 'Have you ever been diagnosed with medullary thyroid carcinoma (MTC)?' },
    { key: 'familyHistoryMTC', label: 'Does anyone in your family have a history of medullary thyroid carcinoma (MTC)?' },
    { key: 'men2Syndrome', label: 'Have you been diagnosed with Multiple Endocrine Neoplasia syndrome type 2 (MEN2)?' },
    { key: 'pancreatitisHistory', label: 'Have you ever had pancreatitis (inflammation of the pancreas)?' },
    { key: 'gallbladderDisease', label: 'Do you have gallbladder disease or gallstones?' },
    { key: 'severeGastroparesis', label: 'Have you been diagnosed with severe gastroparesis (delayed stomach emptying)?' },
    { key: 'endStageRenalDisease', label: 'Do you have end-stage renal (kidney) disease or are you on dialysis?' },
  ];

  return (
    <section aria-label="Step 5: Safety Screening" className="space-y-6">
      <StepErrorSummary stepFields={['personalHistoryMTC', 'familyHistoryMTC', 'men2Syndrome', 'pancreatitisHistory', 'gallbladderDisease', 'severeGastroparesis', 'pregnancyStatus', 'endStageRenalDisease', 'suicidalIdeation']} />

      <Alert className="bg-amber-50 border-amber-200">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          These questions screen for conditions that affect the safety of GLP-1 medications. Please answer honestly.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {questions.map((q) => (
          <div key={q.key} className="p-4 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-900 mb-3">{q.label} <span className="text-red-500" aria-hidden="true">*</span></p>
            <BooleanRadio fieldKey={q.key} label={q.label} />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="pregnancyStatus" className="text-base font-medium">What is your current pregnancy status? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <SelectField
          fieldKey="pregnancyStatus"
          options={[
            { value: 'pregnant', label: 'Currently pregnant' },
            { value: 'trying-to-conceive', label: 'Trying to conceive' },
            { value: 'breastfeeding', label: 'Currently breastfeeding' },
            { value: 'none', label: 'None of the above / not applicable' },
          ]}
        />
      </div>

      <div className="p-4 border border-gray-200 rounded-lg">
        <p className="text-sm text-gray-900 mb-3">
          In the past 2 weeks, have you had thoughts that you would be better off dead, or of hurting yourself in some way? <span className="text-red-500" aria-hidden="true">*</span>
        </p>
        <BooleanRadio fieldKey="suicidalIdeation" label="Suicidal ideation screen" />
      </div>

      <AnimatePresence>
        {suicidalIdeation === true && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <CrisisBanner />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {hardStops.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div role="alert" className="rounded-xl border-2 border-red-300 bg-red-50 p-5">
              <p className="text-sm font-semibold text-red-800">
                This medication may not be appropriate for you
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
                {hardStops.map((h) => (
                  <li key={h.condition}>{h.message || h.condition}</li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-red-700">
                You can still submit this intake — a physician will review it and follow up.
                We also recommend discussing alternatives with your primary care provider.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ============================================================================
// Step 6: Medications & allergies (useFieldArray)
// ============================================================================

function MedicationsAllergiesStep(): React.ReactElement {
  const { register, watch, control } = useFormContext<Glp1IntakeFormData>();
  const currentlyTakingMedications = watch('currentlyTakingMedications');
  const hasDrugAllergies = watch('hasDrugAllergies');

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'medicationList',
  });

  // Explicit drug-interaction questions (Q39–Q42). The clinical notes are
  // TODO(clinical): confirm wording.
  const interactionQuestions: Array<{ key: keyof Glp1IntakeFormData; label: string; note: string }> = [
    { key: 'takingOralContraceptive', label: 'Are you taking an oral contraceptive (birth control pill)?', note: DRUG_INTERACTION_NOTES.oralContraceptive },
    { key: 'takingWarfarin', label: 'Are you taking warfarin or another blood thinner?', note: DRUG_INTERACTION_NOTES.warfarin },
    { key: 'takingCyclosporineTacrolimus', label: 'Are you taking cyclosporine, tacrolimus, or another transplant / immunosuppressant medication?', note: DRUG_INTERACTION_NOTES.cyclosporineTacrolimus },
    { key: 'takingLevothyroxine', label: 'Are you taking levothyroxine or another thyroid medication?', note: DRUG_INTERACTION_NOTES.levothyroxine },
  ];

  return (
    <section aria-label="Step 6: Medications & Allergies" className="space-y-6">
      <StepErrorSummary stepFields={['currentlyTakingMedications', 'hasDrugAllergies', 'takingInsulinOrSulfonylurea', 'takingOtherGlp1']} />

      <div className="space-y-3">
        <Label className="text-base font-medium">Are you currently taking any prescription or over-the-counter medications? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <BooleanRadio fieldKey="currentlyTakingMedications" />
      </div>

      <AnimatePresence>
        {currentlyTakingMedications === true && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4">
            <Label className="text-sm font-medium">List your current medications (up to {MAX_MEDICATION_ENTRIES}):</Label>
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-3 border border-gray-200 rounded-lg">
                <div className="md:col-span-4 space-y-1">
                  <Label htmlFor={`med-name-${index}`} className="text-xs">Medication</Label>
                  <Input id={`med-name-${index}`} {...register(`medicationList.${index}.name` as const)} placeholder="e.g., Metformin" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label htmlFor={`med-dosage-${index}`} className="text-xs">Dosage</Label>
                  <Input id={`med-dosage-${index}`} {...register(`medicationList.${index}.dosage` as const)} placeholder="500 mg" />
                </div>
                <div className="md:col-span-3 space-y-1">
                  <Label htmlFor={`med-frequency-${index}`} className="text-xs">Frequency</Label>
                  <Input id={`med-frequency-${index}`} {...register(`medicationList.${index}.frequency` as const)} placeholder="Twice daily" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <Label htmlFor={`med-reason-${index}`} className="text-xs">Reason</Label>
                  <Input id={`med-reason-${index}`} {...register(`medicationList.${index}.reason` as const)} placeholder="Diabetes" />
                </div>
                <div className="md:col-span-1 flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} aria-label="Remove medication" className="text-red-500 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {fields.length < MAX_MEDICATION_ENTRIES && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ name: '', dosage: '', frequency: '', reason: '' })}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add medication
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drug interactions — explicit yes/no (Q39–Q42), shown when taking meds */}
      <AnimatePresence>
        {currentlyTakingMedications === true && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4">
            <div>
              <h4 className="text-md font-medium text-gray-900">Drug interactions</h4>
              <p className="text-sm text-gray-500">GLP-1 medications can interact with some common medications. Please answer the following.</p>
            </div>
            {interactionQuestions.map((q) => (
              <div key={q.key} className="p-4 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-900 mb-1">{q.label}</p>
                <p className="text-xs text-gray-500 mb-3">{q.note}</p>
                <BooleanRadio fieldKey={q.key} label={q.label} />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        <Label className="text-base font-medium">Do you have any known drug allergies? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <BooleanRadio fieldKey="hasDrugAllergies" />
        <AnimatePresence>
          {hasDrugAllergies === true && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pl-4">
              <Label htmlFor="drugAllergiesList" className="text-sm">Which medication(s), and what reaction?</Label>
              <Textarea id="drugAllergiesList" {...register('drugAllergiesList')} placeholder="e.g., Penicillin — rash" className="mt-2" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-3">
        <Label className="text-base font-medium">Are you currently taking insulin or a sulfonylurea (e.g., glipizide, glyburide)? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <BooleanRadio fieldKey="takingInsulinOrSulfonylurea" />
      </div>

      <div className="space-y-3">
        <Label className="text-base font-medium">Are you currently taking another GLP-1 medication (e.g., Ozempic, Wegovy, Mounjaro)? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <BooleanRadio fieldKey="takingOtherGlp1" />
      </div>
    </section>
  );
}

// ============================================================================
// Step 7: Labs & vitals
// ============================================================================

function LabsVitalsStep(): React.ReactElement {
  const { register, watch, setValue } = useFormContext<Glp1IntakeFormData>();
  const hasRecentLabs = watch('hasRecentLabs');
  const labDocumentUploaded = watch('labDocumentUploaded');

  const labFields: Array<{ key: keyof Glp1IntakeFormData; label: string; placeholder: string }> = [
    { key: 'labA1c', label: 'A1c (%)', placeholder: '5.7' },
    { key: 'labFastingGlucose', label: 'Fasting glucose (mg/dL)', placeholder: '95' },
    { key: 'labCholesterolTotal', label: 'Total cholesterol (mg/dL)', placeholder: '190' },
    { key: 'labLDL', label: 'LDL cholesterol (mg/dL)', placeholder: '100' },
    { key: 'labHDL', label: 'HDL cholesterol (mg/dL)', placeholder: '50' },
    { key: 'labTriglycerides', label: 'Triglycerides (mg/dL)', placeholder: '120' },
    { key: 'labCreatinine', label: 'Creatinine (mg/dL)', placeholder: '0.9' },
    { key: 'labAlt', label: 'ALT (U/L)', placeholder: '30' },
    { key: 'labAST', label: 'AST (U/L)', placeholder: '25' },
    { key: 'labTSH', label: 'TSH (mIU/L)', placeholder: '2.0' },
    { key: 'labLipase', label: 'Lipase (U/L)', placeholder: '40' },
    { key: 'restingHeartRate', label: 'Resting heart rate (bpm)', placeholder: '72' },
    { key: 'bloodPressure', label: 'Blood pressure (mmHg)', placeholder: '120/80' },
  ];

  return (
    <section aria-label="Step 7: Labs & Vitals" className="space-y-6">
      <StepErrorSummary stepFields={['hasRecentLabs']} />

      <Alert className="bg-blue-50 border-blue-200">
        <Activity className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Recent labs help your physician make a safe prescribing decision. Self-reported values below are optional, and you can also upload a lab report.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        <Label className="text-base font-medium">Do you have lab results from the past 12 months? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <BooleanRadio fieldKey="hasRecentLabs" />
      </div>

      <AnimatePresence>
        {hasRecentLabs === true && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {labFields.map((f) => (
                <div key={String(f.key)} className="space-y-1">
                  <Label htmlFor={String(f.key)} className="text-sm">{f.label}</Label>
                  <Input id={String(f.key)} {...register(f.key)} placeholder={f.placeholder} />
                </div>
              ))}
            </div>

            <div className="pt-2">
              <Label className="text-sm font-medium mb-2 block">Upload your lab report (optional)</Label>
              {labDocumentUploaded ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-800">Lab document uploaded.</span>
                </div>
              ) : (
                <DocumentUpload onUploadComplete={() => setValue('labDocumentUploaded', true, { shouldDirty: true })} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ============================================================================
// Step 8: Lifestyle
// ============================================================================

function LifestyleStep(): React.ReactElement {
  const { register, watch, formState: { errors } } = useFormContext<Glp1IntakeFormData>();
  const recreationalSubstances = watch('recreationalSubstances');

  return (
    <section aria-label="Step 8: Lifestyle" className="space-y-6">
      <StepErrorSummary stepFields={['dietPattern', 'exerciseFrequency', 'alcoholUse', 'tobaccoUse', 'recreationalSubstances', 'stressLevel', 'emotionalEating']} />

      <div className="space-y-2">
        <Label htmlFor="dietPattern" className="text-base font-medium">How would you describe your typical diet? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <Textarea id="dietPattern" {...register('dietPattern')} placeholder="e.g., Mostly home-cooked, high carb, eat out 2-3x per week" />
        {errors.dietPattern && <p className="text-sm text-red-500" role="alert">{errors.dietPattern.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="exerciseFrequency" className="text-base font-medium">How often do you exercise? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <SelectField
          fieldKey="exerciseFrequency"
          options={[
            { value: 'none', label: 'Rarely or never' },
            { value: '1-2-week', label: '1-2 times per week' },
            { value: '3-4-week', label: '3-4 times per week' },
            { value: '5-plus-week', label: '5 or more times per week' },
          ]}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="alcoholUse" className="text-base font-medium">How would you describe your alcohol use? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <SelectField
          fieldKey="alcoholUse"
          options={[
            { value: 'none', label: 'None' },
            { value: 'occasional', label: 'Occasional (a few drinks per month)' },
            { value: 'moderate', label: 'Moderate (a few drinks per week)' },
            { value: 'heavy', label: 'Heavy (daily or near-daily)' },
          ]}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tobaccoUse" className="text-base font-medium">Do you use tobacco or nicotine products? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <SelectField
          fieldKey="tobaccoUse"
          options={[
            { value: 'never', label: 'Never used' },
            { value: 'former', label: 'Former user' },
            { value: 'current', label: 'Current user' },
          ]}
        />
      </div>

      <div className="space-y-3">
        <Label className="text-base font-medium">Do you use any recreational substances? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <BooleanRadio fieldKey="recreationalSubstances" />
        <AnimatePresence>
          {recreationalSubstances === true && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pl-4">
              <Label htmlFor="recreationalSubstancesDetails" className="text-sm">Please specify:</Label>
              <Textarea id="recreationalSubstancesDetails" {...register('recreationalSubstancesDetails')} placeholder="e.g., Cannabis, occasionally" className="mt-2" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-2">
        <Label htmlFor="stressLevel" className="text-base font-medium">How would you rate your current stress level? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <SelectField
          fieldKey="stressLevel"
          options={[
            { value: 'low', label: 'Low' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'high', label: 'High' },
          ]}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="emotionalEating" className="text-base font-medium">How often do you eat in response to emotions (stress, boredom, etc.)? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <SelectField
          fieldKey="emotionalEating"
          options={[
            { value: 'never', label: 'Never' },
            { value: 'sometimes', label: 'Sometimes' },
            { value: 'often', label: 'Often' },
          ]}
        />
      </div>
    </section>
  );
}

// ============================================================================
// Step 9: Procedures & surgery
// ============================================================================

function ProceduresSurgeryStep(): React.ReactElement {
  const { register, watch } = useFormContext<Glp1IntakeFormData>();
  const upcomingSurgery = watch('upcomingSurgery');
  const pastGiSurgery = watch('pastGiSurgery');

  return (
    <section aria-label="Step 9: Procedures & Surgery" className="space-y-6">
      <StepErrorSummary stepFields={['upcomingSurgery']} />

      <div className="space-y-3">
        <Label className="text-base font-medium">Do you have any surgery or procedure scheduled in the next 3 months? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <BooleanRadio fieldKey="upcomingSurgery" />
      </div>

      <AnimatePresence>
        {upcomingSurgery === true && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4">
            <div className="pl-4">
              <Label htmlFor="upcomingSurgeryDetails" className="text-sm">Please describe the procedure and approximate date:</Label>
              <Textarea id="upcomingSurgeryDetails" {...register('upcomingSurgeryDetails')} placeholder="e.g., Knee arthroscopy, July 2026" className="mt-2" />
            </div>

            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Anesthesia hold</AlertTitle>
              <AlertDescription className="text-amber-700">
                Because GLP-1 medications slow stomach emptying, anesthesia guidelines (ASA) may require holding the medication
                before surgery to reduce the risk of aspiration. Please tell your surgical and anesthesia teams that you take a GLP-1.
              </AlertDescription>
            </Alert>

            <div className="p-4 border border-amber-200 rounded-lg bg-amber-50/50">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('acknowledgeAnesthesiaHold')}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-primary text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
                <span className="text-sm text-gray-700">
                  I understand that I may need to hold my GLP-1 medication before surgery and will inform my surgical and anesthesia teams.
                </span>
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        <Label className="text-base font-medium">Have you had any abdominal or gastrointestinal surgery in the past? <span className="text-sm font-normal text-gray-500">(optional)</span></Label>
        <BooleanRadio fieldKey="pastGiSurgery" />
        <AnimatePresence>
          {pastGiSurgery === true && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pl-4">
              <Label htmlFor="pastGiSurgeryDetails" className="text-sm">Please describe the type and approximate year:</Label>
              <Textarea id="pastGiSurgeryDetails" {...register('pastGiSurgeryDetails')} placeholder="e.g., Gallbladder removal, 2018" className="mt-2" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

// ============================================================================
// Step 10: Mental health (PHQ-2)
// ============================================================================

function MentalHealthStep(): React.ReactElement {
  const { register, watch, formState: { errors } } = useFormContext<Glp1IntakeFormData>();
  const phq2Interest = watch('phq2Interest');
  const phq2Down = watch('phq2Down');
  const emotionallyReady = watch('emotionallyReady');

  const phq2Score = Number(phq2Interest || 0) + Number(phq2Down || 0);
  const phq2Positive = phq2Score >= 3;

  const phq2Options = [
    { value: '0', label: 'Not at all' },
    { value: '1', label: 'Several days' },
    { value: '2', label: 'More than half the days' },
    { value: '3', label: 'Nearly every day' },
  ];

  const mentalHealthOptions = [
    { id: 'depression', label: 'Depression' },
    { id: 'anxiety', label: 'Anxiety' },
    { id: 'bipolar', label: 'Bipolar disorder' },
    { id: 'ptsd', label: 'PTSD' },
    { id: 'adhd', label: 'ADHD' },
    { id: 'ocd', label: 'OCD' },
    { id: 'other', label: 'Other' },
    { id: 'none', label: 'None of the above' },
  ];

  return (
    <section aria-label="Step 10: Mental Health" className="space-y-6">
      <StepErrorSummary stepFields={['eatingDisorderHistory', 'phq2Interest', 'phq2Down', 'currentMentalHealthTreatment']} />

      <div className="space-y-3">
        <Label className="text-base font-medium">Do you have a current or past history of an eating disorder? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <BooleanRadio fieldKey="eatingDisorderHistory" />
      </div>

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Over the <strong>last 2 weeks</strong>, how often have you been bothered by the following problems?
        </AlertDescription>
      </Alert>

      {/* PHQ-2 item 1 */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Little interest or pleasure in doing things? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <div className="space-y-2" role="radiogroup" aria-label="PHQ-2 interest" aria-required="true">
          {phq2Options.map((option) => (
            <label key={option.value} className="flex items-center gap-3 p-3 min-h-[44px] border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="radio" value={option.value} {...register('phq2Interest')} className="w-5 h-5 min-w-[44px] min-h-[44px] text-ocean-600 border-gray-300 focus:ring-ocean-500 cursor-pointer" />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
        {errors.phq2Interest && <p className="text-sm text-red-500" role="alert">{errors.phq2Interest.message}</p>}
      </div>

      {/* PHQ-2 item 2 */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Feeling down, depressed, or hopeless? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <div className="space-y-2" role="radiogroup" aria-label="PHQ-2 down" aria-required="true">
          {phq2Options.map((option) => (
            <label key={option.value} className="flex items-center gap-3 p-3 min-h-[44px] border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="radio" value={option.value} {...register('phq2Down')} className="w-5 h-5 min-w-[44px] min-h-[44px] text-ocean-600 border-gray-300 focus:ring-ocean-500 cursor-pointer" />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
        {errors.phq2Down && <p className="text-sm text-red-500" role="alert">{errors.phq2Down.message}</p>}
      </div>

      <AnimatePresence>
        {phq2Positive && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <CrisisBanner />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-3">
        <Label className="text-base font-medium">Have you been diagnosed with any of the following? <span className="text-sm font-normal text-gray-500 block mt-1">Select all that apply</span></Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {mentalHealthOptions.map((option) => (
            <label key={option.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input type="checkbox" value={option.id} {...register('mentalHealthConditions')} className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-primary text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2" />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-base font-medium">Are you currently receiving treatment for a mental health condition? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <BooleanRadio fieldKey="currentMentalHealthTreatment" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="emotionallyReady" className="text-base font-medium">Do you feel emotionally ready to make sustainable lifestyle changes alongside medication? <span className="text-sm font-normal text-gray-500">(optional)</span></Label>
        <SelectField
          fieldKey="emotionallyReady"
          placeholder="Select (optional)"
          options={[
            { value: 'yes', label: 'Yes — I feel ready' },
            { value: 'somewhat', label: 'Somewhat ready' },
            { value: 'no', label: 'No — not yet' },
            { value: 'unsure', label: 'Unsure' },
          ]}
        />
        <AnimatePresence>
          {(emotionallyReady === 'no' || emotionallyReady === 'unsure') && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <Label htmlFor="emotionallyReadyConcerns" className="text-sm">What concerns do you have? <span className="text-gray-500">(optional)</span></Label>
              <Textarea id="emotionallyReadyConcerns" {...register('emotionallyReadyConcerns')} placeholder="Share anything you'd like your care team to know..." className="mt-2" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

// ============================================================================
// Step 11: Referral & care coordination
// ============================================================================

function ReferralCareStep(): React.ReactElement {
  const { register, watch } = useFormContext<Glp1IntakeFormData>();
  const referralSource = watch('referralSource');
  const hasPrimaryCarePhysician = watch('hasPrimaryCarePhysician');

  return (
    <section aria-label="Step 11: Referral & Care Coordination" className="space-y-6">
      <StepErrorSummary stepFields={['hasPrimaryCarePhysician']} />

      <div className="space-y-2">
        <Label htmlFor="referralSource" className="text-base font-medium">How did you hear about us? <span className="text-sm font-normal text-gray-500">(optional)</span></Label>
        <SelectField
          fieldKey="referralSource"
          placeholder="Select (optional)"
          options={[
            { value: 'internet_search', label: 'Internet search' },
            { value: 'social_media', label: 'Social media' },
            { value: 'physician_referral', label: 'Physician referral' },
            { value: 'friend_family', label: 'Friend or family' },
            { value: 'insurance', label: 'Insurance provider' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <AnimatePresence>
          {referralSource === 'other' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <Input {...register('referralSourceOther')} placeholder="Please describe..." aria-label="Other referral source" className="mt-2" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-3">
        <Label className="text-base font-medium">Do you have a primary care physician? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <BooleanRadio fieldKey="hasPrimaryCarePhysician" />
        <AnimatePresence>
          {hasPrimaryCarePhysician === true && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 pl-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pcpName">Physician name / practice <span className="text-sm font-normal text-gray-500">(optional)</span></Label>
                  <Input id="pcpName" {...register('pcpName')} placeholder="Dr. Smith / Valley Medical" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pcpPhone">Physician phone <span className="text-sm font-normal text-gray-500">(optional)</span></Label>
                  <Input id="pcpPhone" type="tel" {...register('pcpPhone')} placeholder="(555) 555-5555" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pcpFaxOrEmail">Physician fax or email <span className="text-sm font-normal text-gray-500">(optional)</span></Label>
                <Input id="pcpFaxOrEmail" {...register('pcpFaxOrEmail')} placeholder="Fax or email for records" />
              </div>
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/50">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('consentToCoordinateWithPcp')}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-primary text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                  <span className="text-sm text-gray-700">
                    I authorize Rimal Health to coordinate my care with my primary care physician.
                  </span>
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-2">
        <Label htmlFor="additionalPharmacyNotes" className="text-base font-medium">Anything else we should know about your pharmacy or care preferences? <span className="text-sm font-normal text-gray-500">(optional)</span></Label>
        <Textarea id="additionalPharmacyNotes" {...register('additionalPharmacyNotes')} placeholder="e.g., preferred pharmacy notes, delivery preferences..." />
      </div>
    </section>
  );
}

// ============================================================================
// Step 12: Review & consent
// ============================================================================

function ReviewStep({ onEditSection }: { onEditSection: (index: number) => void }): React.ReactElement {
  const { getValues, register, formState: { errors } } = useFormContext<Glp1IntakeFormData>();
  const values = getValues();

  const formatBoolean = (val: boolean | undefined): string => (val === true ? 'Yes' : val === false ? 'No' : 'Not answered');
  const formatEnum = (val: string | undefined, labels: Record<string, string>): string => {
    if (!val) return 'Not answered';
    return labels[val] || val;
  };

  const sexLabels: Record<string, string> = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' };
  const weightChangeLabels: Record<string, string> = { gained: 'Gained', lost: 'Lost', stable: 'Stable' };
  const pregnancyLabels: Record<string, string> = { pregnant: 'Pregnant', 'trying-to-conceive': 'Trying to conceive', breastfeeding: 'Breastfeeding', none: 'None / N/A' };
  const exerciseLabels: Record<string, string> = { none: 'Rarely/never', '1-2-week': '1-2x/week', '3-4-week': '3-4x/week', '5-plus-week': '5+x/week' };
  const alcoholLabels: Record<string, string> = { none: 'None', occasional: 'Occasional', moderate: 'Moderate', heavy: 'Heavy' };
  const tobaccoLabels: Record<string, string> = { never: 'Never', former: 'Former', current: 'Current' };
  const stressLabels: Record<string, string> = { low: 'Low', moderate: 'Moderate', high: 'High' };
  const emotionalLabels: Record<string, string> = { never: 'Never', sometimes: 'Sometimes', often: 'Often' };
  const diabetesLabels: Record<string, string> = { 'type-1': 'Type 1', 'type-2': 'Type 2', 'pre-diabetes': 'Pre-diabetes', gestational: 'Gestational', none: 'None' };
  const eyeExamLabels: Record<string, string> = { 'within-1-year': 'Within 1 year', '1-2-years': '1-2 years', 'over-2-years': 'Over 2 years', never: 'Never' };
  const retinopathyLabels: Record<string, string> = { none: 'None', mild_npdr: 'Mild NPDR', moderate_npdr: 'Moderate NPDR', severe_npdr: 'Severe NPDR', pdr: 'PDR' };
  const genderLabels: Record<string, string> = { male: 'Man', female: 'Woman', transgender_male: 'Transgender man', transgender_female: 'Transgender woman', non_binary: 'Non-binary', prefer_not_to_say: 'Prefer not to say', other: 'Self-described' };
  const referralLabels: Record<string, string> = { internet_search: 'Internet search', social_media: 'Social media', physician_referral: 'Physician referral', friend_family: 'Friend/family', insurance: 'Insurance', other: 'Other' };
  const readyLabels: Record<string, string> = { yes: 'Yes', somewhat: 'Somewhat', no: 'No', unsure: 'Unsure' };

  const conditionLabel = (value: string): string => MEDICAL_CONDITIONS.find((c) => c.value === value)?.label || value;

  const medicalConditions = Array.isArray(values.medicalConditions) ? values.medicalConditions : [];
  const weightMethods = Array.isArray(values.weightLossMethodsTried) ? values.weightLossMethodsTried : [];
  const mentalConditions = Array.isArray(values.mentalHealthConditions) ? values.mentalHealthConditions : [];
  const medList = Array.isArray(values.medicationList) ? values.medicationList : [];
  const hasEyeScreening = medicalConditions.some((c) => DIABETIC_EYE_SCREENING_TRIGGERS.includes(c));

  const phq2Score = Number(values.phq2Interest || 0) + Number(values.phq2Down || 0);

  const sections: Array<{ title: string; index: number; items: string[] }> = [
    {
      title: 'Step 1: Demographics',
      index: 0,
      items: [
        `Name: ${values.firstName || 'Not answered'} ${values.lastName || ''}`.trim(),
        `Date of birth: ${values.dateOfBirth || 'Not answered'}`,
        `Biological sex: ${formatEnum(values.biologicalSex, sexLabels)}${values.biologicalSex === 'OTHER' && values.biologicalSexOther ? ` (${values.biologicalSexOther})` : ''}`,
        ...(values.genderIdentity ? [`Gender identity: ${formatEnum(values.genderIdentity, genderLabels)}`] : []),
        `Phone: ${values.phone || 'Not answered'}`,
        `Address: ${values.addressStreet || 'Not answered'}, ${values.addressCity || ''}, CA ${values.addressZip || ''}`.trim(),
        ...(values.occupation ? [`Occupation: ${values.occupation}`] : []),
        `Height: ${values.heightFeet ?? '?'}'${values.heightInches ?? '?'}" — Weight: ${values.weightLbs ?? '?'} lbs — BMI: ${values.bmi ? Number(values.bmi).toFixed(1) : 'N/A'}`,
        `Emergency contact: ${values.emergencyContactName || 'Not answered'}${values.emergencyContactRelationship ? ` (${values.emergencyContactRelationship})` : ''}${values.emergencyContactPhone ? ` — ${values.emergencyContactPhone}` : ''}`,
      ],
    },
    {
      title: 'Step 2: Weight History',
      index: 1,
      items: [
        `Highest adult weight: ${values.highestAdultWeightLbs ?? 'Not answered'} lbs`,
        `Goal weight: ${values.goalWeightLbs ?? 'Not answered'} lbs`,
        `Methods tried: ${weightMethods.length > 0 ? weightMethods.join(', ') : 'None'}`,
        `Weight change (past year): ${formatEnum(values.weightChangePastYear, weightChangeLabels)}`,
        `Bariatric surgery: ${formatBoolean(values.hadBariatricSurgery)}`,
        `Prior weight-loss meds: ${formatBoolean(values.priorWeightLossMeds)}`,
      ],
    },
    {
      title: 'Step 3: Medical History',
      index: 2,
      items: [
        `Conditions: ${medicalConditions.length > 0 ? medicalConditions.map(conditionLabel).join(', ') : 'None'}`,
        ...(values.medicalConditionsOther ? [`Other: ${values.medicalConditionsOther}`] : []),
        `Recent hospitalization: ${formatBoolean(values.recentHospitalization)}`,
      ],
    },
    ...(hasEyeScreening
      ? [{
          title: 'Step 4: Diabetic Eye Screening',
          index: 3,
          items: [
            `Diabetes type: ${formatEnum(values.diabetesType, diabetesLabels)}`,
            `On insulin: ${formatBoolean(values.onInsulin)}`,
            `Retinopathy: ${formatEnum(values.retinopathySeverity, retinopathyLabels)}`,
            `Macular edema (DME): ${formatBoolean(values.diabeticMacularEdema)}`,
            `Last eye exam: ${formatEnum(values.lastEyeExam, eyeExamLabels)}`,
            `Vision changes: ${formatBoolean(values.visionChanges)}`,
          ],
        }]
      : []),
    {
      title: 'Step 5: Safety Screening',
      index: hasEyeScreening ? 4 : 3,
      items: [
        `Personal MTC history: ${formatBoolean(values.personalHistoryMTC)}`,
        `Family MTC history: ${formatBoolean(values.familyHistoryMTC)}`,
        `MEN2 syndrome: ${formatBoolean(values.men2Syndrome)}`,
        `Pancreatitis: ${formatBoolean(values.pancreatitisHistory)}`,
        `Gallbladder disease: ${formatBoolean(values.gallbladderDisease)}`,
        `Severe gastroparesis: ${formatBoolean(values.severeGastroparesis)}`,
        `Pregnancy status: ${formatEnum(values.pregnancyStatus, pregnancyLabels)}`,
        `End-stage renal disease: ${formatBoolean(values.endStageRenalDisease)}`,
      ],
    },
    {
      title: 'Step 6: Medications & Allergies',
      index: hasEyeScreening ? 5 : 4,
      items: [
        `Currently taking medications: ${formatBoolean(values.currentlyTakingMedications)}`,
        ...(medList.length > 0 ? [`Medications: ${medList.map((m) => m.name).filter(Boolean).join(', ') || 'Listed'}`] : []),
        `Drug allergies: ${formatBoolean(values.hasDrugAllergies)}`,
        `Insulin/sulfonylurea: ${formatBoolean(values.takingInsulinOrSulfonylurea)}`,
        `Other GLP-1: ${formatBoolean(values.takingOtherGlp1)}`,
      ],
    },
    {
      title: 'Step 7: Labs & Vitals',
      index: hasEyeScreening ? 6 : 5,
      items: [
        `Recent labs: ${formatBoolean(values.hasRecentLabs)}`,
        ...(values.labA1c ? [`A1c: ${values.labA1c}`] : []),
        ...(values.bloodPressure ? [`Blood pressure: ${values.bloodPressure}`] : []),
        `Lab document uploaded: ${formatBoolean(values.labDocumentUploaded)}`,
      ],
    },
    {
      title: 'Step 8: Lifestyle',
      index: hasEyeScreening ? 7 : 6,
      items: [
        `Diet: ${values.dietPattern || 'Not answered'}`,
        `Exercise: ${formatEnum(values.exerciseFrequency, exerciseLabels)}`,
        `Alcohol: ${formatEnum(values.alcoholUse, alcoholLabels)}`,
        `Tobacco: ${formatEnum(values.tobaccoUse, tobaccoLabels)}`,
        `Recreational substances: ${formatBoolean(values.recreationalSubstances)}`,
        `Stress level: ${formatEnum(values.stressLevel, stressLabels)}`,
        `Emotional eating: ${formatEnum(values.emotionalEating, emotionalLabels)}`,
      ],
    },
    {
      title: 'Step 9: Procedures & Surgery',
      index: hasEyeScreening ? 8 : 7,
      items: [
        `Upcoming surgery: ${formatBoolean(values.upcomingSurgery)}`,
        `Past GI surgery: ${formatBoolean(values.pastGiSurgery)}`,
      ],
    },
    {
      title: 'Step 10: Mental Health',
      index: hasEyeScreening ? 9 : 8,
      items: [
        `Eating disorder history: ${formatBoolean(values.eatingDisorderHistory)}`,
        `PHQ-2 score: ${phq2Score} of 6`,
        `Conditions: ${mentalConditions.length > 0 ? mentalConditions.join(', ') : 'None'}`,
        `Current treatment: ${formatBoolean(values.currentMentalHealthTreatment)}`,
        ...(values.emotionallyReady ? [`Emotionally ready: ${formatEnum(values.emotionallyReady, readyLabels)}`] : []),
      ],
    },
    {
      title: 'Step 11: Referral & Care Coordination',
      index: hasEyeScreening ? 10 : 9,
      items: [
        ...(values.referralSource ? [`Heard about us: ${formatEnum(values.referralSource, referralLabels)}`] : []),
        `Has primary care physician: ${formatBoolean(values.hasPrimaryCarePhysician)}`,
        ...(values.hasPrimaryCarePhysician && values.pcpName ? [`PCP: ${values.pcpName}`] : []),
        ...(values.consentToCoordinateWithPcp ? ['Authorized care coordination with PCP'] : []),
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200">
        <ClipboardCheck className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Please review your answers below before submitting. Click &ldquo;Edit&rdquo; on any section to make changes.
          Once submitted, your intake form cannot be changed.
        </AlertDescription>
      </Alert>

      {sections.map((section) => (
        <div key={section.title} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
            <Button type="button" variant="ghost" size="sm" onClick={() => onEditSection(section.index)} className="text-ocean-600 hover:text-ocean-700 text-xs">
              Edit
            </Button>
          </div>
          <div className="px-4 py-3 space-y-1">
            {section.items.map((item, i) => (
              <p key={i} className="text-sm text-gray-700">{item}</p>
            ))}
          </div>
        </div>
      ))}

      {/*
        Consent acknowledgements.
        These 3 intake acknowledgements — Accuracy of Information, Clinical
        Indication, and Follow-up Compliance — combine with the 9 GLP-1 consent
        items collected at /checkout/consent (telehealth nature, side effects,
        retinopathy monitoring, emergency situations, mental-health warning,
        surgery notification, long-term therapy, pharmacy/prescribing, and
        California location) to complete all 12 required consent points of the
        PDF questionnaire's Section 12. No additional acknowledgements are needed
        here; do not duplicate the checkout-consent items.
      */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-semibold text-gray-900">Acknowledgements</h3>
        {[
          { key: 'ackInfoAccurate' as const, label: 'I confirm that the information I have provided is accurate and complete to the best of my knowledge.' },
          { key: 'ackClinicalIndication' as const, label: 'I understand that GLP-1 therapy is prescribed only when clinically appropriate, and that a physician may decline to prescribe based on my responses.' },
          { key: 'ackFollowUpCompliance' as const, label: 'I agree to attend follow-up visits and report any side effects or concerns to my care team.' },
        ].map((ack) => (
          <div key={ack.key} className="p-4 border border-gray-200 rounded-lg">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register(ack.key)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-primary text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
              <span className="text-sm text-gray-700">{ack.label}</span>
            </label>
            {errors[ack.key] && <p className="text-sm text-red-500 mt-1" role="alert">{errors[ack.key]?.message as string}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Progress Indicator
// ============================================================================

function ProgressTracker({
  currentStep,
  totalSteps,
  stepLabels,
}: {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
}): React.ReactElement {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-700">
          Step {currentStep + 1} of {totalSteps}
          <span className="hidden sm:inline"> &middot; {stepLabels[currentStep]}</span>
        </span>
        <span className="text-sm font-medium text-gray-600">
          {Math.round(((currentStep + 1) / totalSteps) * 100)}%
        </span>
      </div>
      <p className="sm:hidden text-xs text-ocean-600 font-medium mb-2">{stepLabels[currentStep]}</p>
      <div
        className="h-3 bg-gray-200 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={currentStep + 1}
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-label={`Intake form progress: step ${currentStep + 1} of ${totalSteps}, ${stepLabels[currentStep]}`}
      >
        <motion.div
          className="h-full bg-gradient-to-r from-navy-500 to-ocean-500"
          initial={{ width: 0 }}
          animate={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <div aria-live="polite" className="sr-only">
        Step {currentStep + 1} of {totalSteps}: {stepLabels[currentStep]}
      </div>
    </div>
  );
}

// ============================================================================
// Submit Confirmation Modal
// ============================================================================

function SubmitConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  isSubmitting,
}: {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}): React.ReactElement | null {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Submit Intake Form?</h3>
        <p className="text-sm text-gray-600 mb-6">
          Are you sure you want to submit your intake form? Once submitted, your answers cannot be changed.
          A physician will review your responses within 24 hours.
        </p>
        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Go Back
          </Button>
          <LoadingButton
            type="button"
            loading={isSubmitting}
            onClick={onConfirm}
            className="bg-gradient-to-r from-navy-500 to-ocean-500 hover:from-navy-600 hover:to-ocean-600 text-white"
          >
            Submit Intake
          </LoadingButton>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================================================
// Main wizard
// ============================================================================

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

interface SaveState {
  status: SaveStatus;
  lastSavedAt: Date | null;
}

interface StepDef {
  id: string;
  title: string;
  sectionTitle: string;
  component: React.ComponentType | null;
}

export default function Glp1IntakeClient(): React.ReactElement {
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [saveState, setSaveState] = React.useState<SaveState>({ status: 'idle', lastSavedAt: null });
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);
  const [intakeId, setIntakeId] = React.useState<string | null>(null);
  const [submitBlockedMessage, setSubmitBlockedMessage] = React.useState<string | null>(null);
  const savedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const methods = useForm<Glp1IntakeFormData>({
    resolver: zodResolver(glp1IntakeFormSchema),
    defaultValues: {
      // Step 1
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      biologicalSex: undefined,
      biologicalSexOther: '',
      genderIdentity: undefined,
      genderIdentityOther: '',
      occupation: '',
      phone: '',
      addressStreet: '',
      addressCity: '',
      addressState: 'CA',
      addressZip: '',
      heightFeet: undefined,
      heightInches: undefined,
      weightLbs: undefined,
      bmi: undefined,
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelationship: '',
      // Step 2
      highestAdultWeightLbs: undefined,
      goalWeightLbs: undefined,
      weightLossMethodsTried: [],
      weightChangePastYear: undefined,
      hadBariatricSurgery: undefined,
      bariatricSurgeryDetails: '',
      priorWeightLossMeds: undefined,
      priorWeightLossMedsList: '',
      primaryMedicationGoal: undefined,
      primaryMedicationGoalOther: '',
      timeAtCurrentWeight: undefined,
      // Step 3
      medicalConditions: [],
      medicalConditionsOther: '',
      recentHospitalization: undefined,
      recentHospitalizationDetails: '',
      // Step 4 (conditional)
      diabetesType: undefined,
      yearsSinceDiabetesDiagnosis: '',
      lastA1c: '',
      onInsulin: undefined,
      retinopathySeverity: undefined,
      diabeticMacularEdema: undefined,
      ophthalmologistName: '',
      ophthalmologistPhone: '',
      lastEyeExam: undefined,
      visionChanges: undefined,
      retinopathyTreatmentDetails: '',
      acknowledgeRetinopathyMonitoring: false,
      // Step 5
      personalHistoryMTC: undefined,
      familyHistoryMTC: undefined,
      men2Syndrome: undefined,
      pancreatitisHistory: undefined,
      gallbladderDisease: undefined,
      severeGastroparesis: undefined,
      pregnancyStatus: undefined,
      endStageRenalDisease: undefined,
      suicidalIdeation: undefined,
      // Step 6
      currentlyTakingMedications: undefined,
      medicationList: [],
      hasDrugAllergies: undefined,
      drugAllergiesList: '',
      takingInsulinOrSulfonylurea: undefined,
      takingOtherGlp1: undefined,
      takingOralContraceptive: undefined,
      takingWarfarin: undefined,
      takingCyclosporineTacrolimus: undefined,
      takingLevothyroxine: undefined,
      // Step 7
      hasRecentLabs: undefined,
      labA1c: '',
      labFastingGlucose: '',
      labCholesterolTotal: '',
      labTriglycerides: '',
      labCreatinine: '',
      labAlt: '',
      labLDL: '',
      labHDL: '',
      labAST: '',
      labTSH: '',
      labLipase: '',
      restingHeartRate: '',
      bloodPressure: '',
      labDocumentUploaded: false,
      // Step 8
      dietPattern: '',
      exerciseFrequency: undefined,
      alcoholUse: undefined,
      tobaccoUse: undefined,
      recreationalSubstances: undefined,
      recreationalSubstancesDetails: '',
      stressLevel: undefined,
      emotionalEating: undefined,
      // Step 9
      upcomingSurgery: undefined,
      upcomingSurgeryDetails: '',
      acknowledgeAnesthesiaHold: false,
      pastGiSurgery: undefined,
      pastGiSurgeryDetails: '',
      // Step 10
      eatingDisorderHistory: undefined,
      phq2Interest: undefined,
      phq2Down: undefined,
      mentalHealthConditions: [],
      currentMentalHealthTreatment: undefined,
      emotionallyReady: undefined,
      emotionallyReadyConcerns: '',
      // Step 11: Referral & care coordination
      referralSource: undefined,
      referralSourceOther: '',
      hasPrimaryCarePhysician: undefined,
      pcpName: '',
      pcpPhone: '',
      pcpFaxOrEmail: '',
      consentToCoordinateWithPcp: false,
      additionalPharmacyNotes: '',
      // Step 12: Review & consent
      ackInfoAccurate: undefined,
      ackClinicalIndication: undefined,
      ackFollowUpCompliance: undefined,
    } as never,
    mode: 'onBlur',
  });

  const { handleSubmit, trigger, formState: { isDirty }, getValues, watch } = methods;

  // The diabetic eye-screening step (Step 4) only appears when a diabetes-related
  // condition is selected. Build the step list dynamically so navigation,
  // validation, and the review-edit jumps all use consistent indices.
  const medicalConditionsWatch = watch('medicalConditions');
  const includeEyeStep = React.useMemo(() => {
    const conditions = Array.isArray(medicalConditionsWatch) ? medicalConditionsWatch : [];
    return conditions.some((c) => DIABETIC_EYE_SCREENING_TRIGGERS.includes(c));
  }, [medicalConditionsWatch]);

  const steps: StepDef[] = React.useMemo(() => {
    const base: StepDef[] = [
      { id: 'demographics', title: 'Demographics', sectionTitle: 'Step 1: Demographics', component: DemographicsStep },
      { id: 'weight-history', title: 'Weight History', sectionTitle: 'Step 2: Weight History', component: WeightHistoryStep },
      { id: 'medical-history', title: 'Medical History', sectionTitle: 'Step 3: Medical History', component: MedicalHistoryStep },
    ];
    if (includeEyeStep) {
      base.push({ id: 'diabetic-eye-screening', title: 'Eye Screening', sectionTitle: 'Step 4: Diabetic Eye Screening', component: DiabeticEyeScreeningStep });
    }
    base.push(
      { id: 'contraindications', title: 'Safety', sectionTitle: 'Safety Screening', component: ContraindicationsStep },
      { id: 'medications-allergies', title: 'Medications', sectionTitle: 'Medications & Allergies', component: MedicationsAllergiesStep },
      { id: 'labs-vitals', title: 'Labs & Vitals', sectionTitle: 'Labs & Vitals', component: LabsVitalsStep },
      { id: 'lifestyle', title: 'Lifestyle', sectionTitle: 'Lifestyle', component: LifestyleStep },
      { id: 'procedures-surgery', title: 'Procedures', sectionTitle: 'Procedures & Surgery', component: ProceduresSurgeryStep },
      { id: 'mental-health', title: 'Mental Health', sectionTitle: 'Mental Health', component: MentalHealthStep },
      { id: 'referral-care', title: 'Referral', sectionTitle: 'Referral & Care Coordination', component: ReferralCareStep },
      { id: 'review-consent', title: 'Review', sectionTitle: 'Review & Consent', component: null },
    );
    return base;
  }, [includeEyeStep]);

  // Clamp currentStep if the step list shrinks (e.g. user deselects diabetes).
  React.useEffect(() => {
    if (currentStep > steps.length - 1) {
      setCurrentStep(steps.length - 1);
    }
  }, [steps.length, currentStep]);

  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  React.useEffect(() => {
    const subscription = watch(() => setHasUnsavedChanges(true));
    return () => subscription.unsubscribe();
  }, [watch]);

  // Server-side auto-save: save draft every 30s if dirty.
  const saveDraft = React.useCallback(async (): Promise<boolean> => {
    setSaveState((prev) => ({ ...prev, status: 'saving' }));
    try {
      const formData = getValues();
      const response = await fetch('/api/patient/intake?product=weight-management', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryConcern: 'WEIGHT_MANAGEMENT',
          formData,
        }),
      });

      if (response.ok) {
        const result = await response.json().catch((err) => {
          console.error('GLP-1 draft save: failed to parse response:', err instanceof Error ? err.message : 'Unknown error');
          return {} as { intake?: { id?: string } };
        });
        if (result.intake?.id) {
          setIntakeId(result.intake.id);
        }
        setSaveState({ status: 'saved', lastSavedAt: new Date() });
        setHasUnsavedChanges(false);
        setSubmitBlockedMessage(null);
        return true;
      }
      if (response.status === 409) {
        const existing = await response.json().catch((err) => {
          console.error('GLP-1 draft save 409: failed to parse response:', err instanceof Error ? err.message : 'Unknown error');
          return {} as { intakeId?: string };
        });
        if (existing.intakeId) setIntakeId(existing.intakeId);
        setSaveState({ status: 'saved', lastSavedAt: new Date() });
        setHasUnsavedChanges(false);
        setSubmitBlockedMessage(null);
        return true;
      }
      setSaveState((prev) => ({ ...prev, status: 'failed' }));
      return false;
    } catch (err) {
      console.error('GLP-1 draft save failed:', err instanceof Error ? err.message : 'Unknown error');
      setSaveState((prev) => ({ ...prev, status: 'failed' }));
      return false;
    }
  }, [getValues]);

  // Auto-clear the "saved" badge after 3s, leave "failed" persistent.
  React.useEffect(() => {
    if (saveState.status !== 'saved') return;
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(
      () => setSaveState((prev) => (prev.status === 'saved' ? { ...prev, status: 'idle' } : prev)),
      3000
    );
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, [saveState.status]);

  React.useEffect(() => {
    if (!isDirty) return;
    const interval = setInterval(() => {
      void saveDraft();
    }, 30000);
    return () => clearInterval(interval);
  }, [isDirty, saveDraft]);

  const formatSavedTime = (d: Date): string =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  // Per-step required fields (the diabetic eye step is intentionally not gated —
  // all its fields are optional in the contract).
  const STEP_FIELDS: Record<string, Array<keyof Glp1IntakeFormData>> = {
    demographics: ['firstName', 'lastName', 'dateOfBirth', 'biologicalSex', 'phone', 'addressStreet', 'addressCity', 'addressState', 'addressZip', 'heightFeet', 'heightInches', 'weightLbs'],
    'weight-history': ['highestAdultWeightLbs', 'goalWeightLbs', 'weightChangePastYear', 'hadBariatricSurgery', 'priorWeightLossMeds'],
    'medical-history': ['recentHospitalization'],
    'diabetic-eye-screening': [],
    contraindications: ['personalHistoryMTC', 'familyHistoryMTC', 'men2Syndrome', 'pancreatitisHistory', 'gallbladderDisease', 'severeGastroparesis', 'pregnancyStatus', 'endStageRenalDisease', 'suicidalIdeation'],
    'medications-allergies': ['currentlyTakingMedications', 'hasDrugAllergies', 'takingInsulinOrSulfonylurea', 'takingOtherGlp1'],
    'labs-vitals': ['hasRecentLabs'],
    lifestyle: ['dietPattern', 'exerciseFrequency', 'alcoholUse', 'tobaccoUse', 'recreationalSubstances', 'stressLevel', 'emotionalEating'],
    'procedures-surgery': ['upcomingSurgery'],
    'mental-health': ['eatingDisorderHistory', 'phq2Interest', 'phq2Down', 'currentMentalHealthTreatment'],
    'referral-care': ['hasPrimaryCarePhysician'],
    'review-consent': [],
  };

  const validateCurrentStep = async (): Promise<boolean> => {
    const fields = STEP_FIELDS[steps[currentStep].id] || [];
    if (fields.length === 0) return true;
    return await trigger(fields);
  };

  const handleNext = async (): Promise<void> => {
    const isValid = await validateCurrentStep();
    if (!isValid) {
      scrollToFirstError();
      return;
    }
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      void saveDraft();
    }
  };

  const handleBack = (): void => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleEditSection = (index: number): void => {
    if (index < 0 || index > steps.length - 1) return;
    setCurrentStep(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = async (data: Glp1IntakeFormData): Promise<void> => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let currentIntakeId = intakeId;

      if (!currentIntakeId) {
        const createResponse = await fetch('/api/patient/intake?product=weight-management', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            primaryConcern: 'WEIGHT_MANAGEMENT',
            formData: data,
          }),
        });

        if (createResponse.status === 409) {
          const existing = await createResponse.json().catch((err) => {
            console.error('GLP-1 submit create 409: failed to parse:', err instanceof Error ? err.message : 'Unknown error');
            return {} as { intakeId?: string };
          });
          currentIntakeId = existing.intakeId ?? null;
        } else if (!createResponse.ok) {
          const error = await createResponse.json().catch((err) => {
            console.error('GLP-1 submit create: failed to parse error:', err instanceof Error ? err.message : 'Unknown error');
            return {} as { message?: string; error?: string };
          });
          throw new Error(error.message || error.error || 'Failed to create intake form');
        } else {
          const createResult = await createResponse.json();
          currentIntakeId = createResult.intake?.id ?? null;
        }
      }

      if (!currentIntakeId) {
        throw new Error('No intake ID returned from server');
      }

      const submitResponse = await fetch(`/api/patient/intake/${currentIntakeId}/submit-glp1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData: data }),
      });

      if (!submitResponse.ok) {
        const error = await submitResponse.json().catch((err) => {
          console.error('GLP-1 submit: failed to parse error:', err instanceof Error ? err.message : 'Unknown error');
          return {} as { message?: string; error?: string };
        });
        throw new Error(error.message || error.error || 'Failed to submit intake form');
      }

      router.push('/intake/success');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An unexpected error occurred');
      setIsSubmitting(false);
      setShowConfirmModal(false);
    }
  };

  const handleSubmitClick = async (): Promise<void> => {
    if (saveState.status === 'failed' || hasUnsavedChanges) {
      const saved = await saveDraft();
      if (!saved) {
        setSubmitBlockedMessage("Your changes couldn't be saved. Please retry before submitting.");
        return;
      }
    }
    setSubmitBlockedMessage(null);

    const allValid = await trigger();
    if (!allValid) {
      scrollToFirstError();
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = (): void => {
    void handleSubmit(onSubmit)();
  };

  const CurrentStepComponent = steps[currentStep].component;
  const isReviewStep = currentStep === steps.length - 1;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Weight Management Intake</h1>
            <p className="text-gray-600 mt-1">Complete your medical intake for GLP-1 weight-management treatment</p>
          </div>
          <Button
            variant="outline"
            type="button"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            onClick={async () => {
              try {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
              } catch (err) {
                console.error('Logout request failed:', err instanceof Error ? err.message : 'Unknown error');
              }
              window.location.assign('/login');
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>

        <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm">
          <Scale className="h-4 w-4" />
          Weight Management - GLP-1 Treatment
        </div>

        <FormProvider {...methods}>
          <form
            onSubmit={(e) => e.preventDefault()}
            onKeyDown={(e: React.KeyboardEvent) => {
              if (e.key === 'Escape' && currentStep > 0) {
                e.preventDefault();
                handleBack();
              }
            }}
            aria-label="Weight management intake form"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <ProgressTracker
                    currentStep={currentStep}
                    totalSteps={steps.length}
                    stepLabels={steps.map((s) => s.title)}
                  />
                  <div className="text-sm flex-shrink-0 ml-4 flex items-center gap-2">
                    {saveState.status === 'saving' && (
                      <span className="text-ocean-600 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Saving...
                      </span>
                    )}
                    {saveState.status === 'saved' && saveState.lastSavedAt && (
                      <span className="text-green-600 flex items-center gap-1">
                        <Save className="h-3 w-3" />
                        Saved at {formatSavedTime(saveState.lastSavedAt)}
                      </span>
                    )}
                    {saveState.status === 'idle' && saveState.lastSavedAt && (
                      <span className="text-gray-500 flex items-center gap-1">
                        <Save className="h-3 w-3" />
                        Last saved at {formatSavedTime(saveState.lastSavedAt)}
                      </span>
                    )}
                    {saveState.status === 'failed' && (
                      <>
                        <span className="text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Save failed
                        </span>
                        <Button type="button" variant="outline" size="sm" onClick={() => { void saveDraft(); }} className="h-7 px-2 text-xs">
                          Retry save
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <CardTitle>{steps[currentStep].sectionTitle}</CardTitle>
                <CardDescription>
                  {isReviewStep ? 'Review all your answers before submitting' : 'Please answer all questions honestly'}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {submitError && (
                  <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{submitError}</AlertDescription>
                  </Alert>
                )}

                {submitBlockedMessage && (
                  <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{submitBlockedMessage}</AlertDescription>
                  </Alert>
                )}

                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {isReviewStep ? (
                    <ReviewStep onEditSection={handleEditSection} />
                  ) : (
                    CurrentStepComponent && <CurrentStepComponent />
                  )}
                </motion.div>

                <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                  {currentStep > 0 ? (
                    <Button type="button" variant="outline" onClick={handleBack} className="flex items-center gap-2">
                      <ChevronLeft className="h-4 w-4" />
                      Back
                    </Button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { void saveDraft(); }}
                      disabled={saveState.status === 'saving'}
                      className="flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Save draft
                    </Button>
                    {isReviewStep ? (
                      <LoadingButton
                        type="button"
                        loading={isSubmitting}
                        onClick={handleSubmitClick}
                        className="flex items-center gap-2 bg-gradient-to-r from-navy-500 to-ocean-500 hover:from-navy-600 hover:to-ocean-600 text-white"
                      >
                        Submit Intake
                        <CheckCircle className="h-4 w-4" />
                      </LoadingButton>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleNext}
                        className="flex items-center gap-2 bg-gradient-to-r from-navy-500 to-ocean-500 hover:from-navy-600 hover:to-ocean-600 text-white"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </form>
        </FormProvider>

        <p className="text-center text-sm text-gray-500 mt-6 flex items-center justify-center gap-2">
          <Shield className="h-4 w-4" />
          Your information is encrypted and HIPAA-compliant
        </p>
      </div>

      <SubmitConfirmModal
        isOpen={showConfirmModal}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setShowConfirmModal(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
