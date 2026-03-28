'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Save,
  Shield,
  Wine,
  AlertTriangle,
  Info,
  LogOut,
  ClipboardCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { LoadingButton } from '@/components/ui/LoadingButton';

// ============================================================================
// Validation Schema -- 8 Sections, 34 Questions + Personal Info (no consent)
// ============================================================================

const intakeFormSchema = z.object({
  // SECTION 0: Personal Information
  firstName: z.string().min(1, { message: 'First name is required' }),
  lastName: z.string().min(1, { message: 'Last name is required' }),
  dateOfBirth: z.string().min(1, { message: 'Date of birth is required' }),
  phone: z.string().min(10, { message: 'Valid phone number required' }),
  addressStreet: z.string().min(1, { message: 'Street address is required' }),
  addressCity: z.string().min(1, { message: 'City is required' }),
  addressZip: z.string().regex(/^9\d{4}$/, { message: 'Must be a valid California ZIP code (starts with 9)' }),
  pharmacyName: z.string().min(1, { message: 'Pharmacy name is required' }),
  pharmacyAddress: z.string().min(1, { message: 'Pharmacy address is required' }),
  pharmacyCity: z.string().min(1, { message: 'Pharmacy city is required' }),
  pharmacyZip: z.string().regex(/^9\d{4}$/, { message: 'Must be a valid California ZIP code' }),
  pharmacyPhone: z.string().optional(),

  // SECTION 1: DSM-5 AUD Screening (Q1-Q11)
  dsm5Q1: z.boolean({ message: 'Please indicate if you drank more or longer than intended' }),
  dsm5Q2: z.boolean({ message: 'Please indicate if you wanted to cut down but couldn\'t' }),
  dsm5Q3: z.boolean({ message: 'Please indicate if you spend significant time drinking or recovering' }),
  dsm5Q4: z.boolean({ message: 'Please indicate if you experience cravings to drink' }),
  dsm5Q5: z.boolean({ message: 'Please indicate if drinking interfered with responsibilities' }),
  dsm5Q6: z.boolean({ message: 'Please indicate if drinking causes problems with family or friends' }),
  dsm5Q7: z.boolean({ message: 'Please indicate if you reduced activities due to drinking' }),
  dsm5Q8: z.boolean({ message: 'Please indicate if you drank in dangerous situations' }),
  dsm5Q9: z.boolean({ message: 'Please indicate if drinking worsens health problems' }),
  dsm5Q10: z.boolean({ message: 'Please indicate if you developed tolerance' }),
  dsm5Q11: z.boolean({ message: 'Please indicate if you experienced withdrawal symptoms' }),

  // SECTION 2: Current Drinking Pattern (Q12-Q15)
  drinkingDaysPerWeek: z.enum(['1-2', '3-4', '5-6', 'everyday'], { message: 'Please select how many days per week you drink' }),
  drinksPerDay: z.enum(['1-2', '3-4', '5-6', '7+'], { message: 'Please select how many drinks per day' }),
  lastDrink: z.enum(['today', 'yesterday', '2-7days', 'more-than-week'], { message: 'Please select when you last had a drink' }),
  bingeDrinking: z.enum(['yes', 'no'], { message: 'Please indicate if you have had binge drinking episodes' }),

  // SECTION 3: Withdrawal Risk Assessment (Q16-Q19)
  withdrawalSeizure: z.boolean({ message: 'Please indicate if you have a history of seizures' }),
  withdrawalDTs: z.boolean({ message: 'Please indicate if you have experienced delirium tremens' }),
  withdrawalHospitalized: z.boolean({ message: 'Please indicate if you were hospitalized for detox' }),
  morningDrinking: z.boolean({ message: 'Please indicate if you drink in the morning to avoid withdrawal' }),

  // SECTION 4: Naltrexone Safety Screening (Q20-Q25)
  opioidUse: z.array(z.string()),
  opioidMaintenance: z.boolean({ message: 'Please indicate if you are in an opioid maintenance program' }),
  liverCondition: z.enum(['cirrhosis', 'acute-hepatitis', 'liver-failure', 'elevated-enzymes', 'none'], { message: 'Please select your liver condition status' }),
  liverTests: z.enum(['normal', 'mild-elevated', 'significant-elevated', 'no-tests'], { message: 'Please select your liver test results' }),
  pregnancyStatus: z.enum(['pregnant', 'breastfeeding', 'planning-pregnancy', 'none'], { message: 'Please select your pregnancy or breastfeeding status' }),
  drugAllergies: z.enum(['naltrexone', 'other', 'none'], { message: 'Please select your medication allergy status' }),

  // SECTION 5: Medical & Psychiatric History (Q26-Q29)
  medicalHistory: z.array(z.string()),
  currentMedications: z.boolean({ message: 'Please indicate if you take prescription medications' }),
  medicationList: z.string().optional(),
  previousTreatments: z.array(z.string()),
  seeingTherapist: z.boolean({ message: 'Please indicate if you are seeing a therapist or counselor' }),

  // SECTION 6: Treatment Goals & Readiness (Q30-Q32)
  primaryGoal: z.enum(['abstinence', 'harm-reduction', 'unsure'], { message: 'Please select your primary treatment goal' }),
  motivationLevel: z.enum(['very', 'somewhat', 'unsure'], { message: 'Please select your motivation level' }),
  supportSystem: z.enum(['strong', 'limited', 'none'], { message: 'Please select your level of support' }),

  // SECTION 7: Demographics (Q33-Q34)
  biologicalSex: z.enum(['MALE', 'FEMALE', 'OTHER'], { message: 'Please select your biological sex' }),
  biologicalSexOther: z.string().optional(),
  age: z.string().min(1, { message: 'Age is required' }),
});

type IntakeFormData = z.infer<typeof intakeFormSchema>;

// ============================================================================
// Scroll to first error helper
// ============================================================================

function scrollToFirstError(): void {
  setTimeout(() => {
    const firstError = document.querySelector('[role="alert"]');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Focus the closest focusable input sibling or parent field
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
  const { formState: { errors } } = useFormContext<IntakeFormData>();

  const stepErrorCount = stepFields.filter(
    (field) => errors[field as keyof IntakeFormData]
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

function BooleanRadio({ fieldKey, label }: { fieldKey: keyof IntakeFormData; label?: string }) {
  const { watch, setValue, formState: { errors } } = useFormContext<IntakeFormData>();
  const value = watch(fieldKey);
  const hasError = !!errors[fieldKey];
  const errorId = `${fieldKey}-error`;

  return (
    <div
      role="group"
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
            onChange={() => setValue(fieldKey, true as never)}
            className="w-5 h-5 min-w-[44px] min-h-[44px] text-ocean-600 border-gray-300 focus:ring-ocean-500 cursor-pointer"
            aria-required="true"
          />
          <Label htmlFor={`${fieldKey}-yes`} className="text-sm font-normal cursor-pointer">Yes</Label>
        </div>
        <div className="flex items-center space-x-2 min-h-[44px]">
          <input
            type="radio"
            id={`${fieldKey}-no`}
            name={String(fieldKey)}
            checked={value === false}
            onChange={() => setValue(fieldKey, false as never)}
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
// Section 0: Personal Information
// ============================================================================

function PersonalInfoStep(): React.ReactElement {
  const { register, formState: { errors } } = useFormContext<IntakeFormData>();

  return (
    <section aria-label="Section 0: Personal Information" className="space-y-6">
      <StepErrorSummary stepFields={['firstName', 'lastName', 'dateOfBirth', 'phone', 'addressStreet', 'addressCity', 'addressZip', 'pharmacyName', 'pharmacyAddress', 'pharmacyCity', 'pharmacyZip']} />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
        <p className="text-sm text-gray-600">This information is required for your treatment.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* First Name */}
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input id="firstName" {...register('firstName')} placeholder="Enter your first name" />
          {errors.firstName && <p className="text-sm text-red-500" role="alert">{errors.firstName.message}</p>}
        </div>
        {/* Last Name */}
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input id="lastName" {...register('lastName')} placeholder="Enter your last name" />
          {errors.lastName && <p className="text-sm text-red-500" role="alert">{errors.lastName.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Date of Birth */}
        <div className="space-y-2">
          <Label htmlFor="dateOfBirth">Date of Birth *</Label>
          <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
          {errors.dateOfBirth && <p className="text-sm text-red-500" role="alert">{errors.dateOfBirth.message}</p>}
        </div>
        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number *</Label>
          <Input id="phone" type="tel" {...register('phone')} placeholder="(555) 555-5555" />
          {errors.phone && <p className="text-sm text-red-500" role="alert">{errors.phone.message}</p>}
        </div>
      </div>

      {/* Address section */}
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
              <Label htmlFor="addressState">State</Label>
              <Input id="addressState" value="California" disabled className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressZip">ZIP Code *</Label>
              <Input id="addressZip" {...register('addressZip')} placeholder="90001" maxLength={5} />
              {errors.addressZip && <p className="text-sm text-red-500" role="alert">{errors.addressZip.message}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Pharmacy section */}
      <div className="pt-4 border-t">
        <h4 className="text-md font-medium text-gray-900 mb-3">Preferred Pharmacy</h4>
        <p className="text-sm text-gray-500 mb-4">Where would you like prescriptions sent?</p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pharmacyName">Pharmacy Name *</Label>
            <Input id="pharmacyName" {...register('pharmacyName')} placeholder="CVS Pharmacy" />
            {errors.pharmacyName && <p className="text-sm text-red-500" role="alert">{errors.pharmacyName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pharmacyAddress">Pharmacy Address *</Label>
            <Input id="pharmacyAddress" {...register('pharmacyAddress')} placeholder="456 Oak Ave" />
            {errors.pharmacyAddress && <p className="text-sm text-red-500" role="alert">{errors.pharmacyAddress.message}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pharmacyCity">City *</Label>
              <Input id="pharmacyCity" {...register('pharmacyCity')} placeholder="Los Angeles" />
              {errors.pharmacyCity && <p className="text-sm text-red-500" role="alert">{errors.pharmacyCity.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pharmacyZip">ZIP Code *</Label>
              <Input id="pharmacyZip" {...register('pharmacyZip')} placeholder="90001" maxLength={5} />
              {errors.pharmacyZip && <p className="text-sm text-red-500" role="alert">{errors.pharmacyZip.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pharmacyPhone">Phone (optional)</Label>
              <Input id="pharmacyPhone" {...register('pharmacyPhone')} placeholder="(555) 555-5555" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Section 1: DSM-5 AUD Screening (Q1-Q11)
// ============================================================================

function DSM5ScreeningStep(): React.ReactElement {
  const { watch } = useFormContext<IntakeFormData>();

  const dsm5Questions = [
    { key: 'dsm5Q1' as const, num: 'Q1', label: 'Have you had times when you drank more, or longer, than you intended?' },
    { key: 'dsm5Q2' as const, num: 'Q2', label: 'Have you wanted to cut down or stop drinking but found you couldn\'t?' },
    { key: 'dsm5Q3' as const, num: 'Q3', label: 'Do you spend a lot of time drinking or recovering from drinking?' },
    { key: 'dsm5Q4' as const, num: 'Q4', label: 'Have you felt a strong urge or craving to drink?' },
    { key: 'dsm5Q5' as const, num: 'Q5', label: 'Has drinking interfered with work, school, or family responsibilities?' },
    { key: 'dsm5Q6' as const, num: 'Q6', label: 'Do you continue to drink even though it causes problems with family or friends?' },
    { key: 'dsm5Q7' as const, num: 'Q7', label: 'Have you given up or reduced activities you enjoy because of drinking?' },
    { key: 'dsm5Q8' as const, num: 'Q8', label: 'Have you continued to drink in physically dangerous situations (e.g., driving)?' },
    { key: 'dsm5Q9' as const, num: 'Q9', label: 'Do you continue to drink even though it causes or worsens depression, anxiety, or other health problems?' },
    { key: 'dsm5Q10' as const, num: 'Q10', label: 'Do you need to drink more than before to get the same effect (tolerance)?' },
    { key: 'dsm5Q11' as const, num: 'Q11', label: 'Have you experienced withdrawal symptoms when you stopped or cut back (sweating, shaking, nausea, anxiety, or seizures)?' },
  ];

  const formValues = watch();
  const yesCount = dsm5Questions.filter(q => formValues[q.key] === true).length;

  return (
    <section aria-label="Section 1: DSM-5 AUD Screening" className="space-y-6">
      <StepErrorSummary stepFields={['dsm5Q1', 'dsm5Q2', 'dsm5Q3', 'dsm5Q4', 'dsm5Q5', 'dsm5Q6', 'dsm5Q7', 'dsm5Q8', 'dsm5Q9', 'dsm5Q10', 'dsm5Q11']} />

      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription id="dsm5-help" className="text-blue-800">
          Answer Yes or No for each question based on your experience in the <strong>past 12 months</strong>.
        </AlertDescription>
      </Alert>

      <div className="space-y-4" aria-describedby="dsm5-help">
        {dsm5Questions.map((q) => (
          <div key={q.key} className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-ocean-100 text-ocean-700 text-xs font-semibold flex items-center justify-center" aria-hidden="true">
              {q.num}
            </span>
            <div className="flex-1">
              <p id={`${q.key}-label`} className="text-sm text-gray-900 mb-2">{q.label}</p>
              <BooleanRadio fieldKey={q.key} label={q.label} />
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200" aria-live="polite">
        <p className="text-sm font-medium text-gray-700">
          Questions answered Yes: {yesCount} of 11
        </p>
        {yesCount >= 2 && (
          <p className="text-sm text-green-600 mt-1">
            Your responses indicate you may benefit from naltrexone treatment.
          </p>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Section 2: Current Drinking Pattern (Q12-Q15)
// ============================================================================

function DrinkingPatternStep(): React.ReactElement {
  const { register, formState: { errors } } = useFormContext<IntakeFormData>();

  return (
    <section aria-label="Section 2: Current Drinking Pattern" className="space-y-6">
      <StepErrorSummary stepFields={['drinkingDaysPerWeek', 'drinksPerDay', 'lastDrink', 'bingeDrinking']} />

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="drinkingDaysPerWeek" className="text-base font-medium">
            Q12. How many days per week do you typically drink? <span className="text-red-500" aria-hidden="true">*</span>
          </Label>
          <select
            {...register('drinkingDaysPerWeek')}
            id="drinkingDaysPerWeek"
            aria-required="true"
            aria-describedby={errors.drinkingDaysPerWeek ? 'drinkingDaysPerWeek-error' : undefined}
            className={cn(
              'w-full px-3 py-2 min-h-[44px] border rounded-md focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none',
              errors.drinkingDaysPerWeek && 'border-red-500'
            )}
          >
            <option value="">Select an option</option>
            <option value="1-2">1-2 days</option>
            <option value="3-4">3-4 days</option>
            <option value="5-6">5-6 days</option>
            <option value="everyday">Every day</option>
          </select>
          {errors.drinkingDaysPerWeek && (
            <p id="drinkingDaysPerWeek-error" className="text-sm text-red-500" role="alert">{errors.drinkingDaysPerWeek.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="drinksPerDay" className="text-base font-medium">
            Q13. On a typical drinking day, how many standard drinks do you have? <span className="text-red-500" aria-hidden="true">*</span>
          </Label>
          <select
            {...register('drinksPerDay')}
            id="drinksPerDay"
            aria-required="true"
            aria-describedby={errors.drinksPerDay ? 'drinksPerDay-error' : undefined}
            className={cn(
              'w-full px-3 py-2 min-h-[44px] border rounded-md focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none',
              errors.drinksPerDay && 'border-red-500'
            )}
          >
            <option value="">Select an option</option>
            <option value="1-2">1-2 drinks</option>
            <option value="3-4">3-4 drinks</option>
            <option value="5-6">5-6 drinks</option>
            <option value="7+">7 or more drinks</option>
          </select>
          {errors.drinksPerDay && (
            <p id="drinksPerDay-error" className="text-sm text-red-500" role="alert">{errors.drinksPerDay.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastDrink" className="text-base font-medium">
            Q14. When did you last have a drink? <span className="text-red-500" aria-hidden="true">*</span>
          </Label>
          <select
            {...register('lastDrink')}
            id="lastDrink"
            aria-required="true"
            aria-describedby={errors.lastDrink ? 'lastDrink-error' : undefined}
            className={cn(
              'w-full px-3 py-2 min-h-[44px] border rounded-md focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none',
              errors.lastDrink && 'border-red-500'
            )}
          >
            <option value="">Select an option</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="2-7days">2-7 days ago</option>
            <option value="more-than-week">More than 1 week ago</option>
          </select>
          {errors.lastDrink && (
            <p id="lastDrink-error" className="text-sm text-red-500" role="alert">{errors.lastDrink.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="bingeDrinking" className="text-base font-medium">
            Q15. In the past month, have you had 5 or more drinks in a day (men) or 4 or more drinks in a day (women)? <span className="text-red-500" aria-hidden="true">*</span>
          </Label>
          <select
            {...register('bingeDrinking')}
            id="bingeDrinking"
            aria-required="true"
            aria-describedby={errors.bingeDrinking ? 'bingeDrinking-error' : undefined}
            className={cn(
              'w-full px-3 py-2 min-h-[44px] border rounded-md focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none',
              errors.bingeDrinking && 'border-red-500'
            )}
          >
            <option value="">Select an option</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
          {errors.bingeDrinking && (
            <p id="bingeDrinking-error" className="text-sm text-red-500" role="alert">{errors.bingeDrinking.message}</p>
          )}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Section 3: Withdrawal Risk Assessment (Q16-Q19)
// ============================================================================

function WithdrawalRiskStep(): React.ReactElement {
  const { watch } = useFormContext<IntakeFormData>();

  const withdrawalSeizure = watch('withdrawalSeizure');
  const withdrawalDTs = watch('withdrawalDTs');
  const withdrawalHospitalized = watch('withdrawalHospitalized');
  const morningDrinking = watch('morningDrinking');

  const hasWithdrawalRisk = withdrawalSeizure || withdrawalDTs || withdrawalHospitalized || morningDrinking;

  const questions = [
    { key: 'withdrawalSeizure' as const, num: 'Q16', label: 'Have you ever had a seizure related to alcohol withdrawal?' },
    { key: 'withdrawalDTs' as const, num: 'Q17', label: 'Have you ever had delirium tremens (DTs) -- severe shaking, confusion, or hallucinations when stopping alcohol?' },
    { key: 'withdrawalHospitalized' as const, num: 'Q18', label: 'Have you ever been hospitalized specifically for alcohol detox or withdrawal?' },
    { key: 'morningDrinking' as const, num: 'Q19', label: 'Do you drink first thing in the morning to avoid feeling shaky, anxious, or sick?' },
  ];

  return (
    <section aria-label="Section 3: Withdrawal Risk Assessment" className="space-y-6">
      <StepErrorSummary stepFields={['withdrawalSeizure', 'withdrawalDTs', 'withdrawalHospitalized', 'morningDrinking']} />

      <Alert className="bg-amber-50 border-amber-200">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription id="withdrawal-help" className="text-amber-800">
          This section helps us assess your safety for starting naltrexone. Please answer honestly.
        </AlertDescription>
      </Alert>

      <div className="space-y-4" aria-describedby="withdrawal-help">
        {questions.map((q) => (
          <div key={q.key} className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-start gap-3 mb-3">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold flex items-center justify-center" aria-hidden="true">
                {q.num}
              </span>
              <p className="text-sm text-gray-900">{q.label}</p>
            </div>
            <div className="pl-11">
              <BooleanRadio fieldKey={q.key} label={q.label} />
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {hasWithdrawalRisk && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert variant="destructive" className="border-red-300 bg-red-50" role="alert">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-red-800">Important Safety Information</AlertTitle>
              <AlertDescription className="text-red-700">
                Your answers indicate you may be at risk for alcohol withdrawal. Our medical team will review your responses carefully.
                You may need supervised detox before starting naltrexone. Do not stop drinking abruptly without medical supervision.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ============================================================================
// Section 4: Naltrexone Safety Screening (Q20-Q25)
// ============================================================================

function SafetyScreeningStep(): React.ReactElement {
  const { register, watch, formState: { errors } } = useFormContext<IntakeFormData>();

  const opioidUse = watch('opioidUse') || [];
  const hasOpioidUse = opioidUse.length > 0 && !opioidUse.includes('none');
  const opioidMaintenance = watch('opioidMaintenance');
  const pregnancyStatus = watch('pregnancyStatus');

  const opioidOptions = [
    { id: 'opioid-prescription', label: 'Prescription opioids (e.g., oxycodone, hydrocodone, codeine, morphine)' },
    { id: 'opioid-mat', label: 'Buprenorphine / Suboxone / Methadone' },
    { id: 'opioid-heroin', label: 'Heroin' },
    { id: 'opioid-fentanyl', label: 'Fentanyl or suspected fentanyl (street drugs, counterfeit pressed pills)' },
    { id: 'none', label: 'None of the above' },
  ];

  return (
    <section aria-label="Section 4: Naltrexone Safety Screening" className="space-y-6">
      <StepErrorSummary stepFields={['opioidUse', 'opioidMaintenance', 'liverCondition', 'liverTests', 'pregnancyStatus', 'drugAllergies']} />

      {/* Q20: Opioid Use */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          Q20. Are you currently using, or have you used in the past 7-10 days, any of the following? <span className="text-red-500">*</span>
          <span className="text-sm font-normal text-gray-500 block mt-1">Select all that apply</span>
        </Label>
        <div className="space-y-2">
          {opioidOptions.map((option) => (
            <label key={option.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <Checkbox
                id={`opioid-${option.id}`}
                value={option.id}
                {...register('opioidUse')}
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {hasOpioidUse && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert variant="destructive" className="border-red-300 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-red-800">Absolute Contraindication</AlertTitle>
              <AlertDescription className="text-red-700">
                You must be opioid-free for a minimum of 7-10 days before starting naltrexone.
                Taking naltrexone while opioids are in your system can cause severe withdrawal.
                Our medical team will discuss alternative options with you.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Q21: Opioid Maintenance */}
      <div className="space-y-2">
        <Label className="text-base font-medium">
          Q21. Are you currently enrolled in a methadone or buprenorphine maintenance program? <span className="text-red-500">*</span>
        </Label>
        <BooleanRadio fieldKey="opioidMaintenance" />
      </div>

      <AnimatePresence>
        {opioidMaintenance === true && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert variant="destructive" className="border-red-300 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-red-800">Absolute Contraindication</AlertTitle>
              <AlertDescription className="text-red-700">
                Naltrexone cannot be prescribed while enrolled in an opioid maintenance program.
                Our medical team will discuss alternative treatment options.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Q22: Liver Condition */}
      <div className="space-y-2">
        <Label className="text-base font-medium">
          Q22. Have you ever been diagnosed with any of the following liver conditions? <span className="text-red-500">*</span>
        </Label>
        <select
          {...register('liverCondition')}
          className={cn(
            'w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none',
            errors.liverCondition && 'border-red-500'
          )}
        >
          <option value="">Select one</option>
          <option value="cirrhosis">Cirrhosis (advanced liver scarring)</option>
          <option value="acute-hepatitis">Acute hepatitis (sudden liver inflammation)</option>
          <option value="liver-failure">Liver failure</option>
          <option value="elevated-enzymes">Elevated liver enzymes only -- no formal liver diagnosis</option>
          <option value="none">None of the above / Unknown</option>
        </select>
        {errors.liverCondition && (
          <p className="text-sm text-red-500">{errors.liverCondition.message}</p>
        )}
      </div>

      {/* Q23: Liver Tests */}
      <div className="space-y-2">
        <Label className="text-base font-medium">
          Q23. Have you had liver blood tests (LFTs) done in the past 6 months? <span className="text-red-500">*</span>
        </Label>
        <select
          {...register('liverTests')}
          className={cn(
            'w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none',
            errors.liverTests && 'border-red-500'
          )}
        >
          <option value="">Select one</option>
          <option value="normal">Yes -- results were normal</option>
          <option value="mild-elevated">Yes -- results were mildly elevated</option>
          <option value="significant-elevated">Yes -- results were significantly elevated</option>
          <option value="no-tests">No / Unknown</option>
        </select>
        {errors.liverTests && (
          <p className="text-sm text-red-500">{errors.liverTests.message}</p>
        )}
      </div>

      {/* Q24: Pregnancy */}
      <div className="space-y-2">
        <Label className="text-base font-medium">
          Q24. Are you currently pregnant or breastfeeding? <span className="text-red-500">*</span>
        </Label>
        <select
          {...register('pregnancyStatus')}
          className={cn(
            'w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none',
            errors.pregnancyStatus && 'border-red-500'
          )}
        >
          <option value="">Select one</option>
          <option value="pregnant">Yes -- currently pregnant</option>
          <option value="breastfeeding">Yes -- currently breastfeeding</option>
          <option value="planning-pregnancy">I am planning to become pregnant in the next 12 months</option>
          <option value="none">No / Not applicable</option>
        </select>
        {errors.pregnancyStatus && (
          <p className="text-sm text-red-500">{errors.pregnancyStatus.message}</p>
        )}
      </div>

      <AnimatePresence>
        {(pregnancyStatus === 'pregnant' || pregnancyStatus === 'breastfeeding') && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert className="bg-amber-50 border-amber-200">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800">Pregnancy/Breastfeeding Consideration</AlertTitle>
              <AlertDescription className="text-amber-700">
                Naltrexone requires individualized risk-benefit discussion during pregnancy or breastfeeding.
                Our provider will consult with you about the best approach for your situation.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Q25: Drug Allergies */}
      <div className="space-y-2">
        <Label className="text-base font-medium">
          Q25. Do you have any known allergies to medications? <span className="text-red-500">*</span>
        </Label>
        <select
          {...register('drugAllergies')}
          className={cn(
            'w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none',
            errors.drugAllergies && 'border-red-500'
          )}
        >
          <option value="">Select one</option>
          <option value="naltrexone">Yes -- including to naltrexone or similar medications</option>
          <option value="other">Yes -- other medications only</option>
          <option value="none">No known drug allergies</option>
        </select>
        {errors.drugAllergies && (
          <p className="text-sm text-red-500">{errors.drugAllergies.message}</p>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Section 5: Medical & Psychiatric History (Q26-Q29)
// ============================================================================

function MedicalHistoryStep(): React.ReactElement {
  const { register, watch } = useFormContext<IntakeFormData>();
  const currentMedications = watch('currentMedications');

  return (
    <section aria-label="Section 5: Medical and Psychiatric History" className="space-y-6">
      <StepErrorSummary stepFields={['medicalHistory', 'currentMedications', 'previousTreatments', 'seeingTherapist']} />

      {/* Q26: Medical History */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          Q26. Do you have a history of any of the following? <span className="text-red-500">*</span>
          <span className="text-sm font-normal text-gray-500 block mt-1">Select all that apply</span>
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { id: 'depression-anxiety', label: 'Depression or anxiety' },
            { id: 'bipolar', label: 'Bipolar disorder' },
            { id: 'ptsd', label: 'PTSD or trauma history' },
            { id: 'kidney-disease', label: 'Kidney disease or chronic kidney condition' },
            { id: 'chronic-pain', label: 'Chronic pain requiring opioid medication' },
            { id: 'other-medical', label: 'Other significant medical conditions' },
            { id: 'none', label: 'None of the above' },
          ].map((option) => (
            <label key={option.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <Checkbox
                id={`medical-${option.id}`}
                value={option.id}
                {...register('medicalHistory')}
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Q27: Current Medications */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Q27. Are you currently taking any prescription medications? <span className="text-red-500">*</span></Label>
        <BooleanRadio fieldKey="currentMedications" />

        <AnimatePresence>
          {currentMedications && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="pl-4"
            >
              <Label className="text-sm">If yes, please list:</Label>
              <Textarea
                {...register('medicationList')}
                placeholder="List your current medications..."
                className="mt-2"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Q28: Previous Treatments */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          Q28. Have you tried any of the following for alcohol use before? <span className="text-red-500">*</span>
          <span className="text-sm font-normal text-gray-500 block mt-1">Select all that apply</span>
        </Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            { id: 'naltrexone', label: 'Naltrexone (oral pill)' },
            { id: 'vivitrol', label: 'Vivitrol (naltrexone injection)' },
            { id: 'acamprosate', label: 'Acamprosate (Campral)' },
            { id: 'disulfiram', label: 'Disulfiram (Antabuse)' },
            { id: 'therapy', label: 'Individual therapy or counseling' },
            { id: 'aa', label: 'AA / 12-step program' },
            { id: 'rehab', label: 'Inpatient or residential rehab' },
            { id: 'none', label: 'None -- this is my first time seeking treatment' },
          ].map((option) => (
            <label key={option.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <Checkbox
                id={`treatment-${option.id}`}
                value={option.id}
                {...register('previousTreatments')}
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Q29: Seeing Therapist */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Q29. Are you currently seeing a therapist, counselor, or psychiatrist? <span className="text-red-500" aria-hidden="true">*</span></Label>
        <BooleanRadio fieldKey="seeingTherapist" label="Are you currently seeing a therapist, counselor, or psychiatrist?" />
      </div>
    </section>
  );
}

// ============================================================================
// Section 6: Treatment Goals & Readiness (Q30-Q32)
// ============================================================================

function TreatmentGoalsStep(): React.ReactElement {
  const { register, formState: { errors } } = useFormContext<IntakeFormData>();

  return (
    <section aria-label="Section 6: Treatment Goals and Readiness" className="space-y-6">
      <StepErrorSummary stepFields={['primaryGoal', 'motivationLevel', 'supportSystem']} />

      {/* Q30: Primary Goal */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          Q30. What is your primary treatment goal? <span className="text-red-500" aria-hidden="true">*</span>
        </Label>
        <div className="space-y-2" role="group" aria-label="Primary treatment goal" aria-required="true">
          {[
            { value: 'abstinence', label: 'Stop drinking completely (full abstinence)', description: 'Complete sobriety from alcohol' },
            { value: 'harm-reduction', label: 'Significantly reduce how much I drink (harm reduction / Sinclair Method)', description: 'Take naltrexone 1-2 hours before drinking' },
            { value: 'unsure', label: 'I am not sure yet -- I want guidance from my provider', description: 'Our provider will help determine the best approach' },
          ].map((option) => (
            <label key={option.value} className="flex items-start gap-3 p-4 min-h-[44px] border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-ocean-300 transition-all">
              <input
                type="radio"
                value={option.value}
                {...register('primaryGoal')}
                aria-required="true"
                className="mt-1 w-5 h-5 min-w-[44px] min-h-[44px] text-ocean-600 border-gray-300 focus:ring-ocean-500 cursor-pointer"
              />
              <div>
                <span className="font-medium text-gray-900 block">{option.label}</span>
                <span className="text-sm text-gray-500">{option.description}</span>
              </div>
            </label>
          ))}
        </div>
        {errors.primaryGoal && (
          <p className="text-sm text-red-500" role="alert">{errors.primaryGoal.message}</p>
        )}
      </div>

      {/* Q31: Motivation Level */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          Q31. How motivated are you to change your drinking right now? <span className="text-red-500" aria-hidden="true">*</span>
        </Label>
        <div className="space-y-2" role="group" aria-label="Motivation level" aria-required="true">
          {[
            { value: 'very', label: 'Very motivated -- I am ready to start' },
            { value: 'somewhat', label: 'Somewhat motivated -- I have some hesitation' },
            { value: 'unsure', label: 'Unsure -- I am still exploring my options' },
          ].map((option) => (
            <label key={option.value} className="flex items-center gap-3 p-3 min-h-[44px] border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                value={option.value}
                {...register('motivationLevel')}
                aria-required="true"
                className="w-5 h-5 min-w-[44px] min-h-[44px] text-ocean-600 border-gray-300 focus:ring-ocean-500 cursor-pointer"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
        {errors.motivationLevel && (
          <p className="text-sm text-red-500" role="alert">{errors.motivationLevel.message}</p>
        )}
      </div>

      {/* Q32: Support System */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          Q32. Do you have a support system at home (family, friends, sponsor, or therapist)? <span className="text-red-500" aria-hidden="true">*</span>
        </Label>
        <div className="space-y-2" role="group" aria-label="Support system" aria-required="true">
          {[
            { value: 'strong', label: 'Yes -- strong support' },
            { value: 'limited', label: 'Somewhat -- limited support' },
            { value: 'none', label: 'No -- I am managing this on my own' },
          ].map((option) => (
            <label key={option.value} className="flex items-center gap-3 p-3 min-h-[44px] border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                value={option.value}
                {...register('supportSystem')}
                aria-required="true"
                className="w-5 h-5 min-w-[44px] min-h-[44px] text-ocean-600 border-gray-300 focus:ring-ocean-500 cursor-pointer"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
        {errors.supportSystem && (
          <p className="text-sm text-red-500" role="alert">{errors.supportSystem.message}</p>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Section 7: Demographics (Q33-Q34)
// ============================================================================

function DemographicsStep(): React.ReactElement {
  const { register, watch, formState: { errors } } = useFormContext<IntakeFormData>();
  const biologicalSex = watch('biologicalSex');

  return (
    <section aria-label="Section 7: Demographics" className="space-y-6">
      <StepErrorSummary stepFields={['biologicalSex', 'age']} />

      {/* Q33: Biological Sex */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          Q33. What is your biological sex? <span className="text-red-500" aria-hidden="true">*</span>
        </Label>
        <div className="space-y-2" role="group" aria-label="Biological sex" aria-required="true">
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
                aria-required="true"
                className="w-5 h-5 min-w-[44px] min-h-[44px] text-ocean-600 border-gray-300 focus:ring-ocean-500 cursor-pointer"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
        {errors.biologicalSex && (
          <p className="text-sm text-red-500" role="alert">{errors.biologicalSex.message}</p>
        )}

        <AnimatePresence>
          {biologicalSex === 'OTHER' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Input
                {...register('biologicalSexOther')}
                placeholder="Please describe..."
                aria-label="Self-describe biological sex"
                className="mt-2"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Q34: Age */}
      <div className="space-y-2">
        <Label htmlFor="age-input" className="text-base font-medium">
          Q34. What is your age? <span className="text-red-500" aria-hidden="true">*</span>
        </Label>
        <Input
          id="age-input"
          type="number"
          min="18"
          max="120"
          {...register('age')}
          placeholder="e.g., 35"
          aria-required="true"
          aria-describedby={errors.age ? 'age-error' : undefined}
          className={cn('max-w-[200px] min-h-[44px]', errors.age && 'border-red-500')}
        />
        {errors.age && (
          <p id="age-error" className="text-sm text-red-500" role="alert">{errors.age.message}</p>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// Review / Summary Step
// ============================================================================

function ReviewStep({ onEditSection }: { onEditSection: (index: number) => void }): React.ReactElement {
  const { getValues } = useFormContext<IntakeFormData>();
  const values = getValues();

  // DSM-5 summary
  const dsm5Keys = ['dsm5Q1', 'dsm5Q2', 'dsm5Q3', 'dsm5Q4', 'dsm5Q5', 'dsm5Q6', 'dsm5Q7', 'dsm5Q8', 'dsm5Q9', 'dsm5Q10', 'dsm5Q11'] as const;
  const dsm5YesCount = dsm5Keys.filter(k => values[k] === true).length;

  const formatBoolean = (val: boolean | undefined): string => val === true ? 'Yes' : val === false ? 'No' : 'Not answered';
  const formatEnum = (val: string | undefined, labels: Record<string, string>): string => {
    if (!val) return 'Not answered';
    return labels[val] || val;
  };

  const drinkingLabels: Record<string, string> = {
    '1-2': '1-2 days', '3-4': '3-4 days', '5-6': '5-6 days', 'everyday': 'Every day',
  };
  const drinksLabels: Record<string, string> = {
    '1-2': '1-2 drinks', '3-4': '3-4 drinks', '5-6': '5-6 drinks', '7+': '7+ drinks',
  };
  const lastDrinkLabels: Record<string, string> = {
    'today': 'Today', 'yesterday': 'Yesterday', '2-7days': '2-7 days ago', 'more-than-week': 'More than 1 week ago',
  };
  const liverLabels: Record<string, string> = {
    'cirrhosis': 'Cirrhosis', 'acute-hepatitis': 'Acute hepatitis', 'liver-failure': 'Liver failure',
    'elevated-enzymes': 'Elevated enzymes', 'none': 'None',
  };
  const liverTestLabels: Record<string, string> = {
    'normal': 'Normal', 'mild-elevated': 'Mildly elevated', 'significant-elevated': 'Significantly elevated', 'no-tests': 'No tests / Unknown',
  };
  const pregnancyLabels: Record<string, string> = {
    'pregnant': 'Pregnant', 'breastfeeding': 'Breastfeeding', 'planning-pregnancy': 'Planning pregnancy', 'none': 'No / N/A',
  };
  const allergyLabels: Record<string, string> = {
    'naltrexone': 'Naltrexone allergy', 'other': 'Other medications', 'none': 'No allergies',
  };
  const goalLabels: Record<string, string> = {
    'abstinence': 'Full abstinence', 'harm-reduction': 'Harm reduction', 'unsure': 'Unsure',
  };
  const motivationLabels: Record<string, string> = {
    'very': 'Very motivated', 'somewhat': 'Somewhat', 'unsure': 'Unsure',
  };
  const supportLabels: Record<string, string> = {
    'strong': 'Strong support', 'limited': 'Limited support', 'none': 'No support',
  };
  const sexLabels: Record<string, string> = {
    'MALE': 'Male', 'FEMALE': 'Female', 'OTHER': 'Other',
  };

  const sections = [
    {
      title: 'Personal Information',
      index: 0,
      items: [
        `Name: ${values.firstName || 'Not answered'} ${values.lastName || ''}`.trim(),
        `Date of birth: ${values.dateOfBirth || 'Not answered'}`,
        `Phone: ${values.phone || 'Not answered'}`,
        `Address: ${values.addressStreet || 'Not answered'}, ${values.addressCity || ''}, CA ${values.addressZip || ''}`.trim(),
        `Pharmacy: ${values.pharmacyName || 'Not answered'}${values.pharmacyAddress ? `, ${values.pharmacyAddress}` : ''}${values.pharmacyCity ? `, ${values.pharmacyCity}` : ''}${values.pharmacyZip ? ` ${values.pharmacyZip}` : ''}`,
      ],
    },
    {
      title: 'Section 1: DSM-5 AUD Screening',
      index: 1,
      items: [`${dsm5YesCount} of 11 questions answered Yes`],
    },
    {
      title: 'Section 2: Current Drinking Pattern',
      index: 2,
      items: [
        `Days per week: ${formatEnum(values.drinkingDaysPerWeek, drinkingLabels)}`,
        `Drinks per day: ${formatEnum(values.drinksPerDay, drinksLabels)}`,
        `Last drink: ${formatEnum(values.lastDrink, lastDrinkLabels)}`,
        `Binge drinking: ${values.bingeDrinking === 'yes' ? 'Yes' : values.bingeDrinking === 'no' ? 'No' : 'Not answered'}`,
      ],
    },
    {
      title: 'Section 3: Withdrawal Risk',
      index: 3,
      items: [
        `Seizure history: ${formatBoolean(values.withdrawalSeizure)}`,
        `Delirium tremens: ${formatBoolean(values.withdrawalDTs)}`,
        `Hospitalized for detox: ${formatBoolean(values.withdrawalHospitalized)}`,
        `Morning drinking: ${formatBoolean(values.morningDrinking)}`,
      ],
    },
    {
      title: 'Section 4: Naltrexone Safety',
      index: 4,
      items: [
        `Opioid use: ${values.opioidUse?.length > 0 ? values.opioidUse.join(', ') : 'None'}`,
        `Opioid maintenance: ${formatBoolean(values.opioidMaintenance)}`,
        `Liver condition: ${formatEnum(values.liverCondition, liverLabels)}`,
        `Liver tests: ${formatEnum(values.liverTests, liverTestLabels)}`,
        `Pregnancy: ${formatEnum(values.pregnancyStatus, pregnancyLabels)}`,
        `Drug allergies: ${formatEnum(values.drugAllergies, allergyLabels)}`,
      ],
    },
    {
      title: 'Section 5: Medical & Psychiatric History',
      index: 5,
      items: [
        `Conditions: ${values.medicalHistory?.length > 0 ? values.medicalHistory.join(', ') : 'None'}`,
        `Taking medications: ${formatBoolean(values.currentMedications)}`,
        ...(values.currentMedications && values.medicationList ? [`Medications: ${values.medicationList}`] : []),
        `Previous treatments: ${values.previousTreatments?.length > 0 ? values.previousTreatments.join(', ') : 'None'}`,
        `Seeing therapist: ${formatBoolean(values.seeingTherapist)}`,
      ],
    },
    {
      title: 'Section 6: Treatment Goals',
      index: 6,
      items: [
        `Primary goal: ${formatEnum(values.primaryGoal, goalLabels)}`,
        `Motivation: ${formatEnum(values.motivationLevel, motivationLabels)}`,
        `Support system: ${formatEnum(values.supportSystem, supportLabels)}`,
      ],
    },
    {
      title: 'Section 7: Demographics',
      index: 7,
      items: [
        `Biological sex: ${formatEnum(values.biologicalSex, sexLabels)}${values.biologicalSex === 'OTHER' && values.biologicalSexOther ? ` (${values.biologicalSexOther})` : ''}`,
        `Age: ${values.age || 'Not answered'}`,
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onEditSection(section.index)}
              className="text-ocean-600 hover:text-ocean-700 text-xs"
            >
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
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">
          Step {currentStep + 1} of {totalSteps}
        </span>
        <span className="text-sm font-medium text-gray-600">
          {Math.round(((currentStep + 1) / totalSteps) * 100)}%
        </span>
      </div>
      <div
        className="h-2 bg-gray-200 rounded-full overflow-hidden"
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
      <div className="flex justify-between mt-2">
        {stepLabels.map((label, index) => (
          <span
            key={index}
            className={cn(
              'text-xs hidden sm:block',
              index <= currentStep ? 'text-ocean-600 font-medium' : 'text-gray-400'
            )}
          >
            {label}
          </span>
        ))}
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
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
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
// Main Intake Page
// ============================================================================

export default function IntakePage(): React.ReactElement {
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);
  const [intakeId, setIntakeId] = React.useState<string | null>(null);
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const steps = [
    { id: 'personal', title: 'Personal Info', sectionTitle: 'Personal Information', component: PersonalInfoStep },
    { id: 'dsm5', title: 'AUD Screening', sectionTitle: 'Section 1: DSM-5 Alcohol Use Disorder Screening', component: DSM5ScreeningStep },
    { id: 'drinking', title: 'Drinking Pattern', sectionTitle: 'Section 2: Current Drinking Pattern', component: DrinkingPatternStep },
    { id: 'withdrawal', title: 'Withdrawal Risk', sectionTitle: 'Section 3: Withdrawal Risk Assessment', component: WithdrawalRiskStep },
    { id: 'safety', title: 'Safety Screening', sectionTitle: 'Section 4: Naltrexone Safety Screening', component: SafetyScreeningStep },
    { id: 'medical', title: 'Medical History', sectionTitle: 'Section 5: Medical & Psychiatric History', component: MedicalHistoryStep },
    { id: 'goals', title: 'Treatment Goals', sectionTitle: 'Section 6: Treatment Goals & Readiness', component: TreatmentGoalsStep },
    { id: 'demographics', title: 'Demographics', sectionTitle: 'Section 7: Demographics', component: DemographicsStep },
    { id: 'review', title: 'Review', sectionTitle: 'Review Your Answers', component: null },
  ];

  const methods = useForm<IntakeFormData>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      phone: '',
      addressStreet: '',
      addressCity: '',
      addressZip: '',
      pharmacyName: '',
      pharmacyAddress: '',
      pharmacyCity: '',
      pharmacyZip: '',
      pharmacyPhone: '',
      dsm5Q1: undefined,
      dsm5Q2: undefined,
      dsm5Q3: undefined,
      dsm5Q4: undefined,
      dsm5Q5: undefined,
      dsm5Q6: undefined,
      dsm5Q7: undefined,
      dsm5Q8: undefined,
      dsm5Q9: undefined,
      dsm5Q10: undefined,
      dsm5Q11: undefined,
      drinkingDaysPerWeek: undefined,
      drinksPerDay: undefined,
      lastDrink: undefined,
      bingeDrinking: undefined,
      withdrawalSeizure: undefined,
      withdrawalDTs: undefined,
      withdrawalHospitalized: undefined,
      morningDrinking: undefined,
      opioidUse: [],
      opioidMaintenance: undefined,
      liverCondition: undefined,
      liverTests: undefined,
      pregnancyStatus: undefined,
      drugAllergies: undefined,
      medicalHistory: [],
      currentMedications: undefined,
      previousTreatments: [],
      seeingTherapist: undefined,
      primaryGoal: undefined,
      motivationLevel: undefined,
      supportSystem: undefined,
      biologicalSex: undefined,
      biologicalSexOther: '',
      age: '',
    },
    mode: 'onBlur',
  });

  const { handleSubmit, trigger, formState: { isDirty }, getValues } = methods;

  // Server-side auto-save: save draft to backend every 30 seconds if dirty
  const saveDraft = React.useCallback(async () => {
    try {
      setSaveStatus('saving');
      const formData = getValues();

      const response = await fetch('/api/patient/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryConcern: 'ALCOHOL',
          formData: {
            ...formData,
            treatmentType: 'ALCOHOL',
            primaryConcern: 'ALCOHOL',
          },
        }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.intake?.id) {
          setIntakeId(result.intake.id);
        }
        setSaveStatus('saved');
      } else if (response.status === 409) {
        // Existing intake -- get its ID
        const existing = await response.json().catch(() => ({}));
        if (existing.intakeId) {
          setIntakeId(existing.intakeId);
        }
        setSaveStatus('saved');
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    }

    // Reset status after 3 seconds
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
  }, [getValues]);

  React.useEffect(() => {
    if (!isDirty) return;

    const interval = setInterval(() => {
      saveDraft();
    }, 30000);

    return () => clearInterval(interval);
  }, [isDirty, saveDraft]);

  // Validate current step fields before proceeding
  const validateCurrentStep = async (): Promise<boolean> => {
    const stepFields: Record<string, string[]> = {
      personal: ['firstName', 'lastName', 'dateOfBirth', 'phone', 'addressStreet', 'addressCity', 'addressZip', 'pharmacyName', 'pharmacyAddress', 'pharmacyCity', 'pharmacyZip'],
      dsm5: ['dsm5Q1', 'dsm5Q2', 'dsm5Q3', 'dsm5Q4', 'dsm5Q5', 'dsm5Q6', 'dsm5Q7', 'dsm5Q8', 'dsm5Q9', 'dsm5Q10', 'dsm5Q11'],
      drinking: ['drinkingDaysPerWeek', 'drinksPerDay', 'lastDrink', 'bingeDrinking'],
      withdrawal: ['withdrawalSeizure', 'withdrawalDTs', 'withdrawalHospitalized', 'morningDrinking'],
      safety: ['liverCondition', 'liverTests', 'pregnancyStatus', 'drugAllergies', 'opioidUse', 'opioidMaintenance'],
      medical: ['medicalHistory', 'previousTreatments', 'currentMedications', 'seeingTherapist'],
      goals: ['primaryGoal', 'motivationLevel', 'supportSystem'],
      demographics: ['biologicalSex', 'age'],
      review: [],
    };

    const fields = stepFields[steps[currentStep].id] || [];
    if (fields.length === 0) return true;

    return await trigger(fields as Array<keyof IntakeFormData>);
  };

  const handleNext = async (): Promise<void> => {
    const isValid = await validateCurrentStep();
    if (isValid && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Save draft on section completion
      saveDraft();
    } else if (!isValid) {
      scrollToFirstError();
    }
  };

  const handleBack = (): void => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleEditSection = (index: number): void => {
    setCurrentStep(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = async (data: IntakeFormData): Promise<void> => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Step 1: Create or reuse intake draft
      let currentIntakeId = intakeId;

      if (!currentIntakeId) {
        const createResponse = await fetch('/api/patient/intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            primaryConcern: 'ALCOHOL',
            formData: {
              ...data,
              treatmentType: 'ALCOHOL',
              primaryConcern: 'ALCOHOL',
            },
          }),
        });

        if (createResponse.status === 409) {
          const existing = await createResponse.json().catch(() => ({}));
          currentIntakeId = existing.intakeId;
        } else if (!createResponse.ok) {
          const error = await createResponse.json().catch(() => ({}));
          throw new Error(error.message || error.error || 'Failed to create intake form');
        } else {
          const createResult = await createResponse.json();
          currentIntakeId = createResult.intake?.id;
        }
      }

      if (!currentIntakeId) {
        throw new Error('No intake ID returned from server');
      }

      // Step 2: Submit intake for physician review
      const submitResponse = await fetch(`/api/patient/intake/${currentIntakeId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: {
            ...data,
            treatmentType: 'ALCOHOL',
            primaryConcern: 'ALCOHOL',
          },
        }),
      });

      if (!submitResponse.ok) {
        const error = await submitResponse.json().catch(() => ({}));
        throw new Error(error.message || error.error || 'Failed to submit intake form');
      }

      // Redirect to patient dashboard (gate will now pass since intake is SUBMITTED)
      router.push('/patient/dashboard');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An unexpected error occurred');
      setIsSubmitting(false);
      setShowConfirmModal(false);
    }
  };

  const handleSubmitClick = async (): Promise<void> => {
    // Validate all fields before showing confirmation
    const allValid = await trigger();
    if (allValid) {
      setShowConfirmModal(true);
    } else {
      scrollToFirstError();
    }
  };

  const handleConfirmSubmit = (): void => {
    handleSubmit(onSubmit)();
  };

  const CurrentStepComponent = steps[currentStep].component;
  const isReviewStep = currentStep === steps.length - 1;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header with Sign Out */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Treatment Intake Form
            </h1>
            <p className="text-gray-600 mt-1">
              Complete your medical intake for naltrexone treatment
            </p>
          </div>
          <form action="/api/auth/logout" method="POST">
            <Button
              variant="outline"
              type="submit"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </form>
        </div>

        <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm">
          <Wine className="h-4 w-4" />
          Alcohol Use Disorder - Naltrexone Treatment
        </div>

        <FormProvider {...methods}>
          <form
            onSubmit={(e) => e.preventDefault()}
            onKeyDown={(e: React.KeyboardEvent) => {
              // Allow keyboard navigation: Escape to go back
              if (e.key === 'Escape' && currentStep > 0) {
                e.preventDefault();
                handleBack();
              }
            }}
            aria-label="Treatment intake form"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <ProgressTracker
                    currentStep={currentStep}
                    totalSteps={steps.length}
                    stepLabels={steps.map((s) => s.title)}
                  />

                  {/* Save Status */}
                  <div className="text-sm flex-shrink-0 ml-4">
                    {saveStatus === 'saving' && (
                      <span className="text-ocean-600 flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Saving...
                      </span>
                    )}
                    {saveStatus === 'saved' && (
                      <span className="text-green-600 flex items-center gap-1">
                        <Save className="h-3 w-3" />
                        Saved
                      </span>
                    )}
                    {saveStatus === 'error' && (
                      <span className="text-amber-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Save failed
                      </span>
                    )}
                  </div>
                </div>

                <CardTitle>{steps[currentStep].sectionTitle}</CardTitle>
                <CardDescription>
                  {isReviewStep
                    ? 'Review all your answers before submitting'
                    : 'Please answer all questions honestly'}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {submitError && (
                  <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{submitError}</AlertDescription>
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

                {/* Navigation */}
                <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                  {currentStep > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleBack}
                      className="flex items-center gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Back
                    </Button>
                  ) : (
                    <div />
                  )}

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
              </CardContent>
            </Card>
          </form>
        </FormProvider>

        {/* Security Note */}
        <p className="text-center text-sm text-gray-500 mt-6 flex items-center justify-center gap-2">
          <Shield className="h-4 w-4" />
          Your information is encrypted and HIPAA-compliant
        </p>
      </div>

      {/* Submit Confirmation Modal */}
      <SubmitConfirmModal
        isOpen={showConfirmModal}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setShowConfirmModal(false)}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
