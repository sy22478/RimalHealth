'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, FormProvider, useFormContext, useWatch } from 'react-hook-form';
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
  FileText,
  Wine,
  AlertTriangle,
  Info,
  Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { LoadingButton } from '@/components/ui/LoadingButton';

// ============================================================================
// Types & Enums
// ============================================================================

type ConcernType = 'ALCOHOL';
type TreatmentGoal = 'QUIT' | 'REDUCE' | 'EXPLORE';

// ============================================================================
// Validation Schema
// ============================================================================

const intakeFormSchema = z.object({
  // Personal Info
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  email: z.string().email('Valid email is required'),
  biologicalSex: z.enum(['MALE', 'FEMALE', 'OTHER']),
  age: z.string().min(1, 'Age is required'),

  // SECTION 1: DSM-5 AUD Screening (Questions 1-11)
  dsm5Q1: z.boolean({ message: 'Please select Yes or No' }),
  dsm5Q2: z.boolean({ message: 'Please select Yes or No' }),
  dsm5Q3: z.boolean({ message: 'Please select Yes or No' }),
  dsm5Q4: z.boolean({ message: 'Please select Yes or No' }),
  dsm5Q5: z.boolean({ message: 'Please select Yes or No' }),
  dsm5Q6: z.boolean({ message: 'Please select Yes or No' }),
  dsm5Q7: z.boolean({ message: 'Please select Yes or No' }),
  dsm5Q8: z.boolean({ message: 'Please select Yes or No' }),
  dsm5Q9: z.boolean({ message: 'Please select Yes or No' }),
  dsm5Q10: z.boolean({ message: 'Please select Yes or No' }),
  dsm5Q11: z.boolean({ message: 'Please select Yes or No' }),

  // SECTION 2: Current Drinking Pattern (Questions 12-15)
  drinkingDaysPerWeek: z.enum(['1-2', '3-4', '5-6', 'everyday'], { message: 'Please select an option' }),
  drinksPerDay: z.enum(['1-2', '3-4', '5-6', '7+'], { message: 'Please select an option' }),
  lastDrink: z.enum(['today', 'yesterday', '2-7days', 'more-than-week'], { message: 'Please select an option' }),
  bingeDrinking: z.enum(['yes', 'no'], { message: 'Please select Yes or No' }),

  // SECTION 3: Withdrawal Risk Assessment (Questions 16-19)
  withdrawalSeizure: z.boolean({ message: 'Please select Yes or No' }),
  withdrawalDTs: z.boolean({ message: 'Please select Yes or No' }),
  withdrawalHospitalized: z.boolean({ message: 'Please select Yes or No' }),
  morningDrinking: z.boolean({ message: 'Please select Yes or No' }),

  // SECTION 4: Naltrexone Safety Screening (Questions 20-25)
  opioidUse: z.array(z.string()),
  opioidMaintenance: z.boolean({ message: 'Please select Yes or No' }),
  liverCondition: z.enum(['cirrhosis', 'acute-hepatitis', 'liver-failure', 'elevated-enzymes', 'none'], { message: 'Please select an option' }),
  liverTests: z.enum(['normal', 'mild-elevated', 'significant-elevated', 'no-tests'], { message: 'Please select an option' }),
  pregnancyStatus: z.enum(['pregnant', 'breastfeeding', 'planning-pregnancy', 'none'], { message: 'Please select an option' }),
  drugAllergies: z.enum(['naltrexone', 'other', 'none'], { message: 'Please select an option' }),

  // SECTION 5: Medical & Psychiatric History (Questions 26-29)
  medicalHistory: z.array(z.string()),
  currentMedications: z.boolean({ message: 'Please select Yes or No' }),
  medicationList: z.string().optional(),
  previousTreatments: z.array(z.string()),
  seeingTherapist: z.boolean({ message: 'Please select Yes or No' }),

  // SECTION 6: Treatment Goals & Readiness (Questions 30-32)
  primaryGoal: z.enum(['abstinence', 'harm-reduction', 'unsure'], { message: 'Please select an option' }),
  motivationLevel: z.enum(['very', 'somewhat', 'unsure'], { message: 'Please select an option' }),
  supportSystem: z.enum(['strong', 'limited', 'none'], { message: 'Please select an option' }),

  // Consent
  hipaaConsent: z.boolean().refine((val) => val === true, {
    message: 'You must consent to HIPAA privacy practices',
  }),
  termsConsent: z.boolean().refine((val) => val === true, {
    message: 'You must agree to the terms of service',
  }),
  telehealthConsent: z.boolean().refine((val) => val === true, {
    message: 'You must consent to telehealth services',
  }),
  treatmentConsent: z.boolean().refine((val) => val === true, {
    message: 'You must consent to treatment',
  }),

  // Feedback Loop
  feedbackNotes: z.string().optional(),
  concernsQuestions: z.string().optional(),
});

type IntakeFormData = z.infer<typeof intakeFormSchema>;

// ============================================================================
// Boolean Radio Group (Yes/No) — uses setValue to set proper booleans
// ============================================================================

function BooleanRadio({ fieldKey }: { fieldKey: keyof IntakeFormData }) {
  const { watch, setValue } = useFormContext<IntakeFormData>();
  const value = watch(fieldKey);
  return (
    <div className="flex gap-4">
      <div className="flex items-center space-x-2">
        <input
          type="radio"
          id={`${fieldKey}-yes`}
          name={fieldKey}
          checked={value === true}
          onChange={() => setValue(fieldKey, true as never)}
          className="w-4 h-4 text-ocean-600 border-gray-300 focus:ring-ocean-500"
        />
        <Label htmlFor={`${fieldKey}-yes`} className="text-sm font-normal cursor-pointer">Yes</Label>
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="radio"
          id={`${fieldKey}-no`}
          name={fieldKey}
          checked={value === false}
          onChange={() => setValue(fieldKey, false as never)}
          className="w-4 h-4 text-ocean-600 border-gray-300 focus:ring-ocean-500"
        />
        <Label htmlFor={`${fieldKey}-no`} className="text-sm font-normal cursor-pointer">No</Label>
      </div>
    </div>
  );
}

// ============================================================================
// Feedback Loop Component
// ============================================================================

function FeedbackLoop({ 
  stepId, 
  showFeedback,
  onFeedbackSubmit 
}: { 
  stepId: string;
  showFeedback: boolean;
  onFeedbackSubmit: (feedback: string) => void;
}) {
  const [feedback, setFeedback] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  if (!showFeedback) return null;

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg"
      >
        <div className="flex items-center gap-2 text-green-700">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Thank you for your feedback!</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="mt-6 pt-4 border-t border-gray-200"
    >
      <p className="text-sm text-gray-600 mb-2">How are we doing? Your feedback helps us improve.</p>
      <Textarea
        placeholder="Any questions or concerns about this section?"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        className="text-sm mb-2"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          if (feedback.trim()) {
            onFeedbackSubmit(feedback);
            setSubmitted(true);
          }
        }}
        disabled={!feedback.trim()}
      >
        Submit Feedback
      </Button>
    </motion.div>
  );
}

// ============================================================================
// Section 1: DSM-5 AUD Screening
// ============================================================================

function DSM5ScreeningStep() {
  const { register, watch, formState: { errors }, setValue } = useFormContext<IntakeFormData>();
  const [feedbackSubmitted, setFeedbackSubmitted] = React.useState(false);

  const dsm5Questions = [
    { key: 'dsm5Q1', label: 'Have you had times when you drank more, or longer, than you intended?' },
    { key: 'dsm5Q2', label: 'Have you wanted to cut down or stop drinking but found you couldn\'t?' },
    { key: 'dsm5Q3', label: 'Do you spend a lot of time drinking or recovering from drinking?' },
    { key: 'dsm5Q4', label: 'Have you felt a strong urge or craving to drink?' },
    { key: 'dsm5Q5', label: 'Has drinking interfered with work, school, or family responsibilities?' },
    { key: 'dsm5Q6', label: 'Do you continue to drink even though it causes problems with family or friends?' },
    { key: 'dsm5Q7', label: 'Have you given up or reduced activities you enjoy because of drinking?' },
    { key: 'dsm5Q8', label: 'Have you continued to drink in physically dangerous situations (e.g., driving)?' },
    { key: 'dsm5Q9', label: 'Do you continue to drink even though it causes or worsens depression, anxiety, or other health problems?' },
    { key: 'dsm5Q10', label: 'Do you need to drink more than before to get the same effect (tolerance)?' },
    { key: 'dsm5Q11', label: 'Have you experienced withdrawal symptoms when you stopped or cut back (sweating, shaking, nausea, anxiety, or seizures)?' },
  ];

  // Calculate score for feedback
  const formValues = watch();
  const yesCount = [
    formValues.dsm5Q1,
    formValues.dsm5Q2,
    formValues.dsm5Q3,
    formValues.dsm5Q4,
    formValues.dsm5Q5,
    formValues.dsm5Q6,
    formValues.dsm5Q7,
    formValues.dsm5Q8,
    formValues.dsm5Q9,
    formValues.dsm5Q10,
    formValues.dsm5Q11,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Answer Yes or No for each question based on your experience in the past 12 months.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {dsm5Questions.map((q, index) => (
          <div key={q.key} className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-ocean-100 text-ocean-700 text-xs font-medium flex items-center justify-center">
              {index + 1}
            </span>
            <div className="flex-1">
              <p className="text-sm text-gray-900 mb-2">{q.label}</p>
              <BooleanRadio fieldKey={q.key as keyof IntakeFormData} />
            </div>
          </div>
        ))}
      </div>

      {/* Live Score Feedback */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-700">
          Questions answered Yes: {yesCount} of 11
        </p>
        {yesCount >= 2 && (
          <p className="text-sm text-green-600 mt-1">
            Your responses indicate you may benefit from naltrexone treatment.
          </p>
        )}
      </div>

      <FeedbackLoop 
        stepId="dsm5" 
        showFeedback={yesCount > 0}
        onFeedbackSubmit={(feedback) => {
          setFeedbackSubmitted(true);
          console.log('DSM-5 Feedback:', feedback);
        }}
      />
    </div>
  );
}

// ============================================================================
// Section 2: Current Drinking Pattern
// ============================================================================

function DrinkingPatternStep() {
  const { register, formState: { errors } } = useFormContext<IntakeFormData>();

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-base font-medium">
            12. How many days per week do you typically drink? <span className="text-red-500">*</span>
          </Label>
          <select 
            {...register('drinkingDaysPerWeek')}
            className={cn(
              "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none",
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
            <p className="text-sm text-red-500">{errors.drinkingDaysPerWeek.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-base font-medium">
            13. On a typical drinking day, how many standard drinks do you have? <span className="text-red-500">*</span>
          </Label>
          <select 
            {...register('drinksPerDay')}
            className={cn(
              "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none",
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
            <p className="text-sm text-red-500">{errors.drinksPerDay.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-base font-medium">
            14. When did you last have a drink? <span className="text-red-500">*</span>
          </Label>
          <select 
            {...register('lastDrink')}
            className={cn(
              "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none",
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
            <p className="text-sm text-red-500">{errors.lastDrink.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-base font-medium">
            15. In the past month, have you had 5 or more drinks in a day (men) or 4 or more drinks in a day (women)? <span className="text-red-500">*</span>
          </Label>
          <select 
            {...register('bingeDrinking')}
            className={cn(
              "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none",
              errors.bingeDrinking && 'border-red-500'
            )}
          >
            <option value="">Select an option</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
          {errors.bingeDrinking && (
            <p className="text-sm text-red-500">{errors.bingeDrinking.message}</p>
          )}
        </div>
      </div>

      <FeedbackLoop 
        stepId="drinking-pattern"
        showFeedback={true}
        onFeedbackSubmit={(feedback) => console.log('Drinking Pattern Feedback:', feedback)}
      />
    </div>
  );
}

// ============================================================================
// Section 3: Withdrawal Risk Assessment
// ============================================================================

function WithdrawalRiskStep() {
  const { register, watch } = useFormContext<IntakeFormData>();
  
  const withdrawalSeizure = watch('withdrawalSeizure');
  const withdrawalDTs = watch('withdrawalDTs');
  const withdrawalHospitalized = watch('withdrawalHospitalized');
  const morningDrinking = watch('morningDrinking');
  
  const hasWithdrawalRisk = withdrawalSeizure || withdrawalDTs || withdrawalHospitalized || morningDrinking;

  const questions = [
    { key: 'withdrawalSeizure', label: '16. Have you ever had a seizure related to alcohol withdrawal?' },
    { key: 'withdrawalDTs', label: '17. Have you ever had delirium tremens (DTs) -- severe shaking, confusion, or hallucinations when stopping alcohol?' },
    { key: 'withdrawalHospitalized', label: '18. Have you ever been hospitalized specifically for alcohol detox or withdrawal?' },
    { key: 'morningDrinking', label: '19. Do you drink first thing in the morning to avoid feeling shaky, anxious, or sick?' },
  ];

  return (
    <div className="space-y-6">
      <Alert className="bg-amber-50 border-amber-200">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          This section helps us assess your safety for starting naltrexone. Please answer honestly.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {questions.map((q) => (
          <div key={q.key} className="p-4 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-900 mb-3">{q.label}</p>
            <BooleanRadio fieldKey={q.key as keyof IntakeFormData} />
          </div>
        ))}
      </div>

      {/* Warning for withdrawal risk */}
      <AnimatePresence>
        {hasWithdrawalRisk && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert variant="destructive" className="border-red-300 bg-red-50">
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

      <FeedbackLoop 
        stepId="withdrawal-risk"
        showFeedback={hasWithdrawalRisk}
        onFeedbackSubmit={(feedback) => console.log('Withdrawal Risk Feedback:', feedback)}
      />
    </div>
  );
}

// ============================================================================
// Section 4: Naltrexone Safety Screening
// ============================================================================

function SafetyScreeningStep() {
  const { register, watch, formState: { errors } } = useFormContext<IntakeFormData>();
  
  const opioidUse = watch('opioidUse') || [];
  const hasOpioidUse = opioidUse.length > 0 && !opioidUse.includes('none');
  const pregnancyStatus = watch('pregnancyStatus');
  const liverCondition = watch('liverCondition');

  return (
    <div className="space-y-6">
      {/* Question 20: Opioid Use */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          20. Are you currently using, or have you used in the past 7-10 days, any of the following? <span className="text-red-500">*</span>
          <span className="text-sm font-normal text-gray-500 block mt-1">Select all that apply</span>
        </Label>
        <div className="space-y-2">
          {[
            { id: 'opioid-prescription', label: 'Prescription opioids (e.g., oxycodone, hydrocodone, codeine, morphine)' },
            { id: 'opioid-mat', label: 'Buprenorphine / Suboxone / Methadone' },
            { id: 'opioid-heroin', label: 'Heroin' },
            { id: 'opioid-fentanyl', label: 'Fentanyl or suspected fentanyl (street drugs, counterfeit pressed pills)' },
            { id: 'none', label: 'None of the above' },
          ].map((option) => (
            <label key={option.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <Checkbox
                id={option.id}
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

      {/* Question 21: Opioid Maintenance */}
      <div className="space-y-2">
        <Label className="text-base font-medium">
          21. Are you currently enrolled in a methadone or buprenorphine maintenance program? <span className="text-red-500">*</span>
        </Label>
        <BooleanRadio fieldKey="opioidMaintenance" />
      </div>

      {/* Question 22: Liver Condition */}
      <div className="space-y-2">
        <Label className="text-base font-medium">
          22. Have you ever been diagnosed with any of the following liver conditions? <span className="text-red-500">*</span>
        </Label>
        <select 
          {...register('liverCondition')}
          className={cn(
            "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none",
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

      {/* Question 23: Liver Tests */}
      <div className="space-y-2">
        <Label className="text-base font-medium">
          23. Have you had liver blood tests (LFTs) done in the past 6 months? <span className="text-red-500">*</span>
        </Label>
        <select 
          {...register('liverTests')}
          className={cn(
            "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none",
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

      {/* Question 24: Pregnancy */}
      <div className="space-y-2">
        <Label className="text-base font-medium">
          24. Are you currently pregnant or breastfeeding? <span className="text-red-500">*</span>
        </Label>
        <select 
          {...register('pregnancyStatus')}
          className={cn(
            "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none",
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

      {/* Question 25: Drug Allergies */}
      <div className="space-y-2">
        <Label className="text-base font-medium">
          25. Do you have any known allergies to medications? <span className="text-red-500">*</span>
        </Label>
        <select 
          {...register('drugAllergies')}
          className={cn(
            "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none",
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

      <FeedbackLoop 
        stepId="safety-screening"
        showFeedback={true}
        onFeedbackSubmit={(feedback) => console.log('Safety Screening Feedback:', feedback)}
      />
    </div>
  );
}

// ============================================================================
// Section 5: Medical & Psychiatric History
// ============================================================================

function MedicalHistoryStep() {
  const { register, watch } = useFormContext<IntakeFormData>();
  const currentMedications = watch('currentMedications');

  return (
    <div className="space-y-6">
      {/* Question 26: Medical History */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          26. Do you have a history of any of the following? <span className="text-red-500">*</span>
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
                id={option.id}
                value={option.id}
                {...register('medicalHistory')}
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Question 27: Current Medications */}
      <div className="space-y-3">
        <Label className="text-base font-medium">27. Are you currently taking any prescription medications?</Label>
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

      {/* Question 28: Previous Treatments */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          28. Have you tried any of the following for alcohol use before? <span className="text-red-500">*</span>
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
                id={option.id}
                value={option.id}
                {...register('previousTreatments')}
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Question 29: Seeing Therapist */}
      <div className="space-y-3">
        <Label className="text-base font-medium">29. Are you currently seeing a therapist, counselor, or psychiatrist?</Label>
        <BooleanRadio fieldKey="seeingTherapist" />
      </div>

      <FeedbackLoop 
        stepId="medical-history"
        showFeedback={true}
        onFeedbackSubmit={(feedback) => console.log('Medical History Feedback:', feedback)}
      />
    </div>
  );
}

// ============================================================================
// Section 6: Treatment Goals & Readiness
// ============================================================================

function TreatmentGoalsStep() {
  const { register, formState: { errors } } = useFormContext<IntakeFormData>();

  return (
    <div className="space-y-6">
      {/* Question 30: Primary Goal */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          30. What is your primary treatment goal? <span className="text-red-500">*</span>
        </Label>
        <div className="space-y-2">
          {[
            { value: 'abstinence', label: 'Stop drinking completely (full abstinence)', description: 'Complete sobriety from alcohol' },
            { value: 'harm-reduction', label: 'Significantly reduce how much I drink (harm reduction / Sinclair Method)', description: 'Take naltrexone 1-2 hours before drinking' },
            { value: 'unsure', label: 'I am not sure yet -- I want guidance from my provider', description: 'Our provider will help determine the best approach' },
          ].map((option) => (
            <label key={option.value} className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-ocean-300 transition-all">
              <input
                type="radio"
                value={option.value}
                {...register('primaryGoal')}
                className="mt-1 w-4 h-4 text-ocean-600 border-gray-300 focus:ring-ocean-500"
              />
              <div>
                <span className="font-medium text-gray-900 block">{option.label}</span>
                <span className="text-sm text-gray-500">{option.description}</span>
              </div>
            </label>
          ))}
        </div>
        {errors.primaryGoal && (
          <p className="text-sm text-red-500">{errors.primaryGoal.message}</p>
        )}
      </div>

      {/* Question 31: Motivation Level */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          31. How motivated are you to change your drinking right now? <span className="text-red-500">*</span>
        </Label>
        <div className="space-y-2">
          {[
            { value: 'very', label: 'Very motivated -- I am ready to start' },
            { value: 'somewhat', label: 'Somewhat motivated -- I have some hesitation' },
            { value: 'unsure', label: 'Unsure -- I am still exploring my options' },
          ].map((option) => (
            <label key={option.value} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                value={option.value}
                {...register('motivationLevel')}
                className="w-4 h-4 text-ocean-600 border-gray-300 focus:ring-ocean-500"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
        {errors.motivationLevel && (
          <p className="text-sm text-red-500">{errors.motivationLevel.message}</p>
        )}
      </div>

      {/* Question 32: Support System */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          32. Do you have a support system at home (family, friends, sponsor, or therapist)? <span className="text-red-500">*</span>
        </Label>
        <div className="space-y-2">
          {[
            { value: 'strong', label: 'Yes -- strong support' },
            { value: 'limited', label: 'Somewhat -- limited support' },
            { value: 'none', label: 'No -- I am managing this on my own' },
          ].map((option) => (
            <label key={option.value} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                value={option.value}
                {...register('supportSystem')}
                className="w-4 h-4 text-ocean-600 border-gray-300 focus:ring-ocean-500"
              />
              <span className="text-sm text-gray-700">{option.label}</span>
            </label>
          ))}
        </div>
        {errors.supportSystem && (
          <p className="text-sm text-red-500">{errors.supportSystem.message}</p>
        )}
      </div>

      {/* Additional Feedback */}
      <div className="space-y-2 pt-4 border-t border-gray-200">
        <Label className="text-base font-medium">Any additional concerns or questions for your provider?</Label>
        <Textarea
          {...register('concernsQuestions')}
          placeholder="Share any concerns, questions, or information you think your provider should know..."
          rows={4}
        />
      </div>

      <FeedbackLoop 
        stepId="treatment-goals"
        showFeedback={true}
        onFeedbackSubmit={(feedback) => console.log('Treatment Goals Feedback:', feedback)}
      />
    </div>
  );
}

// ============================================================================
// Personal Info Step
// ============================================================================

function PersonalInfoStep() {
  const { register, formState: { errors } } = useFormContext<IntakeFormData>();
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            {...register('firstName')}
            placeholder="John"
            className={cn(errors.firstName && 'border-red-500')}
          />
          {errors.firstName && (
            <p className="text-sm text-red-500">{errors.firstName.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            {...register('lastName')}
            placeholder="Doe"
            className={cn(errors.lastName && 'border-red-500')}
          />
          {errors.lastName && (
            <p className="text-sm text-red-500">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dateOfBirth">Date of Birth *</Label>
        <Input
          id="dateOfBirth"
          type="date"
          {...register('dateOfBirth')}
          className={cn(errors.dateOfBirth && 'border-red-500')}
        />
        {errors.dateOfBirth && (
          <p className="text-sm text-red-500">{errors.dateOfBirth.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="age">Age *</Label>
        <Input
          id="age"
          type="number"
          {...register('age')}
          placeholder="35"
          className={cn(errors.age && 'border-red-500')}
        />
        {errors.age && (
          <p className="text-sm text-red-500">{errors.age.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="biologicalSex">Biological Sex *</Label>
        <select
          id="biologicalSex"
          {...register('biologicalSex')}
          className={cn(
            "w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-ocean-500 focus:border-ocean-500 outline-none",
            errors.biologicalSex && 'border-red-500'
          )}
        >
          <option value="">Select one</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Prefer to self-describe</option>
        </select>
        {errors.biologicalSex && (
          <p className="text-sm text-red-500">{errors.biologicalSex.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number *</Label>
        <Input
          id="phone"
          type="tel"
          {...register('phone')}
          placeholder="(555) 123-4567"
          className={cn(errors.phone && 'border-red-500')}
        />
        {errors.phone && (
          <p className="text-sm text-red-500">{errors.phone.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email Address *</Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          placeholder="john.doe@example.com"
          className={cn(errors.email && 'border-red-500')}
        />
        {errors.email && (
          <p className="text-sm text-red-500">{errors.email.message}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Consent Step
// ============================================================================

function ConsentStep() {
  const { watch, setValue, formState: { errors } } = useFormContext<IntakeFormData>();

  const consentItems = [
    {
      id: 'hipaaConsent' as const,
      label: 'HIPAA Privacy Consent',
      description: 'I consent to the collection and use of my health information as described in the Privacy Policy and HIPAA Notice.',
      required: true,
    },
    {
      id: 'termsConsent' as const,
      label: 'Terms of Service',
      description: 'I agree to the Terms of Service and understand this is a telehealth service.',
      required: true,
    },
    {
      id: 'telehealthConsent' as const,
      label: 'Telehealth Consent',
      description: 'I consent to receive telehealth services from a California-licensed physician.',
      required: true,
    },
    {
      id: 'treatmentConsent' as const,
      label: 'Treatment Consent',
      description: 'I consent to receive treatment for substance use disorder through Rimal Health. I understand that naltrexone is prescribed based on my responses to this intake form and provider review.',
      required: true,
    },
  ];

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200">
        <Shield className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          Please review and consent to the following before submitting your intake form. Your responses will be reviewed by a licensed physician.
        </AlertDescription>
      </Alert>

      {consentItems.map((item) => (
        <div key={item.id} className="space-y-2">
          <div className="flex items-start gap-3">
            <Checkbox
              id={item.id}
              checked={watch(item.id) === true}
              onCheckedChange={(checked) => setValue(item.id, checked === true)}
              className={cn(errors[item.id] && 'border-red-500')}
            />
            <div className="flex-1">
              <Label htmlFor={item.id} className="font-medium cursor-pointer">
                {item.label}
                {item.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <p className="text-sm text-gray-500 mt-1">{item.description}</p>
            </div>
          </div>
          {errors[item.id] && (
            <p className="text-sm text-red-500 pl-7">
              {errors[item.id]?.message as string}
            </p>
          )}
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
  stepLabels 
}: { 
  currentStep: number; 
  totalSteps: number;
  stepLabels: string[];
}) {
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
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-ocean-500"
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
    </div>
  );
}

// ============================================================================
// Main Intake Page
// ============================================================================

export default function IntakePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saving' | 'saved'>('idle');
  const [totalFeedbackItems, setTotalFeedbackItems] = React.useState(0);

  // Get concern from URL
  const concern = (searchParams.get('concern') as ConcernType) || 'ALCOHOL';
  const goal = (searchParams.get('goal') as TreatmentGoal) || 'QUIT';

  const steps = [
    { id: 'personal', title: 'Personal Info', component: PersonalInfoStep },
    { id: 'dsm5', title: 'AUD Screening', component: DSM5ScreeningStep },
    { id: 'drinking', title: 'Drinking Pattern', component: DrinkingPatternStep },
    { id: 'withdrawal', title: 'Withdrawal Risk', component: WithdrawalRiskStep },
    { id: 'safety', title: 'Safety Screening', component: SafetyScreeningStep },
    { id: 'medical', title: 'Medical History', component: MedicalHistoryStep },
    { id: 'goals', title: 'Treatment Goals', component: TreatmentGoalsStep },
    { id: 'consent', title: 'Consent', component: ConsentStep },
  ];

  const methods = useForm<IntakeFormData>({
    resolver: zodResolver(intakeFormSchema),
    defaultValues: {
      // Personal
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      age: '',
      biologicalSex: undefined,
      phone: '',
      email: '',
      // DSM-5 — no pre-selection, patient must explicitly choose
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
      // SECTION 2: Current Drinking Pattern — no pre-selection
      drinkingDaysPerWeek: undefined,
      drinksPerDay: undefined,
      lastDrink: undefined,
      bingeDrinking: undefined,
      // SECTION 3: Withdrawal — no pre-selection
      withdrawalSeizure: undefined,
      withdrawalDTs: undefined,
      withdrawalHospitalized: undefined,
      morningDrinking: undefined,
      // SECTION 4: Safety — no pre-selection
      opioidUse: [],
      opioidMaintenance: undefined,
      liverCondition: undefined,
      liverTests: undefined,
      pregnancyStatus: undefined,
      drugAllergies: undefined,
      // SECTION 5: Medical — no pre-selection
      medicalHistory: [],
      currentMedications: undefined,
      previousTreatments: [],
      seeingTherapist: undefined,
      // SECTION 6: Treatment Goals — no pre-selection
      primaryGoal: undefined,
      motivationLevel: undefined,
      supportSystem: undefined,
      // Consent
      hipaaConsent: false,
      termsConsent: false,
      telehealthConsent: false,
      treatmentConsent: false,
    },
    mode: 'onBlur',
  });

  const { handleSubmit, trigger, formState: { isDirty, errors } } = methods;

  // Auto-save draft
  React.useEffect(() => {
    if (!isDirty) return;

    const interval = setInterval(() => {
      setSaveStatus('saving');
      // Simulate save - in production, this would save to backend
      setTimeout(() => setSaveStatus('saved'), 1000);
      setTimeout(() => setSaveStatus('idle'), 3000);
    }, 30000);

    return () => clearInterval(interval);
  }, [isDirty]);

  const validateCurrentStep = async (): Promise<boolean> => {
    const stepFields: Record<string, string[]> = {
      personal: ['firstName', 'lastName', 'dateOfBirth', 'age', 'biologicalSex', 'phone', 'email'],
      dsm5: ['dsm5Q1', 'dsm5Q2', 'dsm5Q3', 'dsm5Q4', 'dsm5Q5', 'dsm5Q6', 'dsm5Q7', 'dsm5Q8', 'dsm5Q9', 'dsm5Q10', 'dsm5Q11'],
      drinking: ['drinkingDaysPerWeek', 'drinksPerDay', 'lastDrink', 'bingeDrinking'],
      withdrawal: ['withdrawalSeizure', 'withdrawalDTs', 'withdrawalHospitalized', 'morningDrinking'],
      safety: ['liverCondition', 'liverTests', 'pregnancyStatus', 'drugAllergies'],
      medical: ['medicalHistory', 'previousTreatments'],
      goals: ['primaryGoal', 'motivationLevel', 'supportSystem'],
      consent: ['hipaaConsent', 'termsConsent', 'telehealthConsent', 'treatmentConsent'],
    };

    const fields = stepFields[steps[currentStep].id] || [];
    if (fields.length === 0) return true;

    return await trigger(fields as Array<keyof IntakeFormData>);
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (isValid && currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const onSubmit = async (data: IntakeFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/patient/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryConcern: concern || 'ALCOHOL',
          formData: {
            ...data,
            treatmentType: concern,
            treatmentGoal: goal,
            feedbackLoop: {
              totalFeedbackItems,
              completedAt: new Date().toISOString(),
            },
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to submit intake form');
      }

      router.push('/intake/success');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'An unexpected error occurred');
      setIsSubmitting(false);
    }
  };

  const CurrentStepComponent = steps[currentStep].component;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Treatment Intake Form
          </h1>
          <p className="text-gray-600 mt-2">
            Complete your medical intake for naltrexone treatment
          </p>
          {concern === 'ALCOHOL' && (
            <div className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm">
              <Wine className="h-4 w-4" />
              Alcohol Use Disorder - Naltrexone Treatment
            </div>
          )}
        </div>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <ProgressTracker
                    currentStep={currentStep}
                    totalSteps={steps.length}
                    stepLabels={steps.map((s) => s.title)}
                  />
                  
                  {/* Save Status */}
                  <div className="text-sm">
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
                  </div>
                </div>

                <CardTitle>{steps[currentStep].title}</CardTitle>
                <CardDescription>
                  Please answer all questions honestly
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
                  <CurrentStepComponent />
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

                  {currentStep < steps.length - 1 ? (
                    <Button
                      type="button"
                      onClick={handleNext}
                      className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-ocean-500 hover:from-blue-600 hover:to-ocean-600 text-white"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <LoadingButton
                      type="submit"
                      loading={isSubmitting}
                      className="flex items-center gap-2"
                    >
                      Submit Intake
                      <CheckCircle className="h-4 w-4" />
                    </LoadingButton>
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
    </div>
  );
}
