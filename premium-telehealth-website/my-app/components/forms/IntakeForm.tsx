"use client";

import * as React from "react";
import { useForm, FormProvider, useFormContext, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Save, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { ConcernType, TreatmentGoal } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Announcer } from "@/components/a11y/Announcer";
import { ProgressTracker } from "./ProgressTracker";
import { MedicalHistorySection } from "./MedicalHistorySection";
import { MedicationsSection } from "./MedicationsSection";
import { AlcoholQuestions } from "./AlcoholQuestions";
import {
  draftIntakeSchema,
  createIntakeSchema,
  createAutoSaveHandler,
  calculateProgress,
  calculateIntakeScores,
  generateRiskAssessment,
  type DraftIntakeData,
} from "@/lib/intake";

// ============================================================================
// Types
// ============================================================================

interface IntakeFormProps {
  intakeId?: string;
  primaryConcern: ConcernType;
  treatmentGoal: TreatmentGoal;
  initialData?: Partial<DraftIntakeData>;
  onSubmitSuccess?: () => void;
}

interface FormSection {
  id: string;
  title: string;
  description: string;
  isOptional?: boolean;
  component: React.ReactNode;
}

// ============================================================================
// Helper: Get sections based on concern type
// ============================================================================

function getFormSections(primaryConcern: ConcernType): FormSection[] {
  const baseSections: FormSection[] = [
    {
      id: "medical",
      title: "Medical History",
      description: "Important health information",
      component: <MedicalHistorySection />,
    },
    {
      id: "medications",
      title: "Medications",
      description: "Current medications and allergies",
      isOptional: true,
      component: <MedicationsSection />,
    },
  ];

  const previousTreatmentSection: FormSection = {
    id: "previous",
    title: "Previous Treatment",
    description: "Have you tried to quit before?",
    isOptional: true,
    component: <PreviousTreatmentSection />,
  };

  const consentSection: FormSection = {
    id: "consent",
    title: "Consent",
    description: "Review and agree to treatment terms",
    component: <ConsentSection />,
  };

  // Alcohol treatment is the only service we offer
  return [
    ...baseSections,
    {
      id: "alcohol",
      title: "Alcohol Assessment",
      description: "AUDIT-C questionnaire",
      component: <AlcoholQuestions />,
    },
    previousTreatmentSection,
    consentSection,
  ];
}

// ============================================================================
// Sub-components
// ============================================================================

function PreviousTreatmentSection() {
  const { control, watch } = useFormContext();
  const previousTreatment = watch("previousTreatment");
  const showDetails = previousTreatment === "true" || previousTreatment === true;

  return (
    <div className="space-y-6">
      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-900">Previous Treatment</h3>
        <p className="text-sm text-gray-600 mt-1">
          Understanding what you&apos;ve tried before helps us recommend the most 
          effective approach for you.
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-900">
          Have you previously tried to quit drinking?
        </label>
        <Controller
          name="previousTreatment"
          control={control}
          render={({ field }) => (
            <div className="flex gap-3">
              <label
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all",
                  field.value === "true"
                    ? "border-ocean-500 bg-ocean-50 text-ocean-700"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                )}
              >
                <input
                  type="radio"
                  value="true"
                  checked={field.value === "true"}
                  onChange={() => field.onChange("true")}
                  className="w-4 h-4 text-ocean-600"
                />
                <span className="text-sm font-medium">Yes</span>
              </label>
              <label
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all",
                  field.value === "false"
                    ? "border-ocean-500 bg-ocean-50 text-ocean-700"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                )}
              >
                <input
                  type="radio"
                  value="false"
                  checked={field.value === "false"}
                  onChange={() => field.onChange("false")}
                  className="w-4 h-4 text-ocean-600"
                />
                <span className="text-sm font-medium">No</span>
              </label>
            </div>
          )}
        />
      </div>

      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 pl-4 border-l-2 border-ocean-200">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">
                  Tell us about your previous quit attempts
                </label>
                <Controller
                  name="previousTreatmentDetails"
                  control={control}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      placeholder="What methods did you try? What worked or didn't work? Why did you start again?"
                      className="w-full min-h-[100px] p-3 rounded-lg border border-gray-200 focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500/20 resize-y"
                    />
                  )}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">
                  Have you tried any medications for quitting in the past?
                </label>
                <Controller
                  name="previousMedications"
                  control={control}
                  render={({ field }) => (
                    <textarea
                      {...field}
                      placeholder="Examples: Chantix, Zyban, Naltrexone, Antabuse, etc."
                      className="w-full min-h-[80px] p-3 rounded-lg border border-gray-200 focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500/20 resize-y"
                    />
                  )}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ConsentSection() {
  const { control, formState: { errors } } = useFormContext();

  const consentItems = [
    {
      id: "hipaaConsent",
      label: "HIPAA Privacy Consent",
      description: "I consent to the collection and use of my health information as described in the",
      link: { text: "Privacy Policy", href: "/privacy" },
      link2: { text: "HIPAA Notice", href: "/hipaa" },
    },
    {
      id: "termsConsent",
      label: "Terms of Service",
      description: "I agree to the",
      link: { text: "Terms of Service", href: "/terms" },
      additional: "and understand this is a telehealth service.",
    },
    {
      id: "telehealthConsent",
      label: "Telehealth Consent",
      description: "I consent to receive telehealth services from a California-licensed physician. I understand that telehealth involves the use of electronic communications to enable healthcare providers at different locations to share individual patient medical information for the purpose of improving patient care.",
    },
    {
      id: "treatmentConsent",
      label: "Treatment Consent",
      description: "I consent to receive treatment for substance use disorder through Rimal Health. I understand that treatment may involve prescription medications, and I agree to follow my physician's instructions carefully.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900">Consent & Agreement</h3>
        <p className="text-sm text-blue-700 mt-1">
          Please review and consent to the following before submitting your intake form.
        </p>
      </div>

      <div className="space-y-4">
        {consentItems.map((item) => (
          <Controller
            key={item.id}
            name={item.id}
            control={control}
            render={({ field }) => (
              <label
                className={cn(
                  "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all",
                  field.value
                    ? "border-ocean-500 bg-ocean-50"
                    : "border-gray-200 hover:border-gray-300 bg-white",
                  errors[item.id] && "border-red-400 bg-red-50"
                )}
              >
                <input
                  type="checkbox"
                  checked={field.value ?? false}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="w-5 h-5 mt-0.5 text-ocean-600 border-gray-300 rounded focus:ring-ocean-500"
                />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.label}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {item.description}{" "}
                    {item.link && (
                      <>
                        <a href={item.link.href} className="text-ocean-600 hover:underline" target="_blank" rel="noopener noreferrer">
                          {item.link.text}
                        </a>
                        {item.link2 && (
                          <>
                            {" "}and{" "}
                            <a href={item.link2.href} className="text-ocean-600 hover:underline" target="_blank" rel="noopener noreferrer">
                              {item.link2.text}
                            </a>
                          </>
                        )}
                      </>
                    )}
                    {item.additional && ` ${item.additional}`}
                  </p>
                  {errors[item.id] && (
                    <p className="text-sm text-red-500 mt-2">{errors[item.id]?.message as string}</p>
                  )}
                </div>
              </label>
            )}
          />
        ))}
      </div>

      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
        <p className="text-sm text-amber-800">
          <strong>Important:</strong> By submitting this form, you confirm that all information provided 
          is accurate and complete to the best of your knowledge. Providing false information may 
          result in inappropriate treatment and could be harmful to your health.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Main IntakeForm Component
// ============================================================================

export function IntakeForm({
  intakeId: initialIntakeId,
  primaryConcern,
  treatmentGoal,
  initialData = {},
  onSubmitSuccess,
}: IntakeFormProps) {
  const [currentSection, setCurrentSection] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [intakeId, setIntakeId] = React.useState<string | undefined>(initialIntakeId);
  
  // Auto-save state
  const [saveStatus, setSaveStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);

  const sections = React.useMemo(() => getFormSections(primaryConcern), [primaryConcern]);

  // Initialize form with validation schema
  const methods = useForm<DraftIntakeData>({
    resolver: zodResolver(draftIntakeSchema as Parameters<typeof zodResolver>[0]) as Resolver<DraftIntakeData>,
    defaultValues: {
      primaryConcern,
      treatmentGoal,
      addressState: "CA",
      // Consent checkboxes - initialize to false to prevent uncontrolled/controlled warning
      hipaaConsent: false,
      termsConsent: false,
      telehealthConsent: false,
      treatmentConsent: false,
      ...initialData,
    },
    mode: "onBlur",
  });

  const { handleSubmit, watch, trigger, formState: { isDirty } } = methods;
  const formData = watch();

  // Calculate progress
  const progress = React.useMemo(() => {
    return calculateProgress(formData, primaryConcern as "ALCOHOL");
  }, [formData, primaryConcern]);

  // Setup auto-save
  const autoSaveHandler = React.useMemo(() => {
    return createAutoSaveHandler({
      intakeId,
      primaryConcern,
      onSave: (newIntakeId) => {
        setIntakeId(newIntakeId);
        setSaveStatus("saved");
        setLastSaved(new Date());
        setTimeout(() => setSaveStatus("idle"), 2000);
      },
      onError: (error) => {
        console.error("Auto-save error:", error);
        setSaveStatus("error");
      },
    });
  }, [intakeId, primaryConcern]);

  // Auto-save effect
  React.useEffect(() => {
    if (!isDirty || isSubmitted) return;

    const interval = setInterval(() => {
      if (isDirty) {
        setSaveStatus("saving");
        autoSaveHandler.scheduleSave(formData);
      }
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(interval);
  }, [isDirty, formData, autoSaveHandler, isSubmitted]);

  // Save on field blur
  const handleFieldBlur = React.useCallback(() => {
    if (isDirty && !isSubmitted) {
      setSaveStatus("saving");
      autoSaveHandler.scheduleSave(formData);
    }
  }, [isDirty, formData, autoSaveHandler, isSubmitted]);

  // Validate current section before proceeding
  const validateCurrentSection = async (): Promise<boolean> => {
    const section = sections[currentSection];
    if (!section) return true;

    // Map section IDs to validation schemas (simplified)
    const sectionValidations: Record<string, string[]> = {
      medical: ["isPregnant", "hasSeizureHistory", "hasPsychiatricHistory", "hasLiverDisease"],
      medications: ["takingMedications"],
      alcohol: ["audit_1", "audit_2", "audit_3"],
      // smoking section removed — platform now focuses exclusively on alcohol use disorder
      consent: ["hipaaConsent", "termsConsent", "telehealthConsent", "treatmentConsent"],
    };

    const fieldsToValidate = sectionValidations[section.id] || [];
    if (fieldsToValidate.length === 0) return true;

    const result = await trigger(fieldsToValidate as Parameters<typeof trigger>[0]);
    return result;
  };

  const handleNext = async () => {
    const isValid = await validateCurrentSection();
    if (isValid && currentSection < sections.length - 1) {
      setCurrentSection(currentSection + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSectionClick = (index: number) => {
    if (index <= currentSection + 1 || progress.completedSections.includes(sections[index].id)) {
      setCurrentSection(index);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const onSubmit = async (data: DraftIntakeData) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Calculate scores
      const scores = calculateIntakeScores(data);
      const riskAssessment = generateRiskAssessment(scores);

      // Submit the intake
      const response = await fetch(`/api/patient/intake/${intakeId || ''}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData: data,
          scores,
          riskAssessment,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to submit intake form");
      }

      setIsSubmitted(true);
      autoSaveHandler.clearSavedData();
      onSubmitSuccess?.();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (isSubmitted) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 max-w-2xl mx-auto">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Intake Form Submitted!
          </h2>
          <p className="text-gray-600 mb-6">
            Thank you for completing your intake form. A California-licensed physician 
            will review your information within 24 hours.
          </p>
          <div className="bg-blue-50 rounded-lg p-4 text-left">
            <h3 className="font-medium text-blue-900 mb-2">What happens next?</h3>
            <ul className="text-sm text-blue-800 space-y-2 list-disc list-inside">
              <li>Your physician will review your intake and medical history</li>
              <li>You&apos;ll receive a message with your personalized treatment plan</li>
              <li>If prescribed, your medication will be sent to your pharmacy</li>
              <li>You can message your physician anytime with questions</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl mx-auto">
        {/* Screen reader announcement */}
        <Announcer
          message={`Section ${currentSection + 1} of ${sections.length}: ${sections[currentSection]?.title}`}
        />

        {/* Header with save status */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Treatment Intake Form</h1>
            <p className="text-sm text-gray-600 mt-1">
              Help us understand your needs to provide the best care
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {saveStatus === "saving" && (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-ocean-500" />
                <span className="text-ocean-600">Saving...</span>
              </>
            )}
            {saveStatus === "saved" && (
              <>
                <Save className="w-4 h-4 text-green-500" />
                <span className="text-green-600">Saved</span>
              </>
            )}
            {saveStatus === "error" && (
              <>
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-red-600">Save failed</span>
              </>
            )}
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <ProgressTracker
            sections={sections}
            currentSection={currentSection}
            completedSections={progress.completedSections}
            percentComplete={progress.percent}
            onSectionClick={handleSectionClick}
          />
        </div>

        {/* Current Section */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSection}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              onBlur={handleFieldBlur}
            >
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {sections[currentSection]?.title}
                </h2>
                <p className="text-gray-600 mt-1">
                  {sections[currentSection]?.description}
                </p>
                {sections[currentSection]?.isOptional && (
                  <span className="inline-block mt-2 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded">
                    Optional Section
                  </span>
                )}
              </div>

              <div className="min-h-[300px]">
                {sections[currentSection]?.component}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
            {currentSection > 0 ? (
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

            {currentSection < sections.length - 1 ? (
              <Button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-ocean-500 hover:from-blue-600 hover:to-ocean-600 text-white"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <div className="w-full max-w-md space-y-3">
                {submitError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{submitError}</p>
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-blue-500 to-ocean-500 hover:from-blue-600 hover:to-ocean-600 text-white disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </span>
                  ) : (
                    "Submit Intake Form"
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Last saved indicator */}
        {lastSaved && (
          <p className="text-center text-xs text-gray-400 mt-4">
            Last saved: {lastSaved.toLocaleTimeString()}
          </p>
        )}
      </form>
    </FormProvider>
  );
}
