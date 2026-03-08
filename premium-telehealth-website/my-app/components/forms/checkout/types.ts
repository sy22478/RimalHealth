"use client";

import * as z from "zod";

// ============================================================================
// Checkout Form Types & Validation Schemas
// ============================================================================

export const step1Schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z
    .string()
    .regex(
      /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/,
      "Use MM/DD/YYYY format"
    ),
  phone: z
    .string()
    .regex(/^\+?1?\d{10,14}$/, "Enter a valid phone number"),
});

export const step2Schema = z.object({
  addressStreet: z.string().min(1, "Street address is required"),
  addressCity: z.string().min(1, "City is required"),
  addressState: z.literal("CA"),
  addressZip: z
    .string()
    .regex(/^\d{5}(-\d{4})?$/, "Enter a valid ZIP code"),
  billingSameAsHome: z.boolean().default(true),
  billingStreet: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingZip: z.string().optional(),
}).refine(
  (data) => {
    if (!data.billingSameAsHome) {
      return !!(
        data.billingStreet?.trim() &&
        data.billingCity?.trim() &&
        data.billingState?.trim() &&
        data.billingZip?.trim()
      );
    }
    return true;
  },
  {
    message: "All billing address fields are required",
    path: ["billingStreet"],
  }
);

export const step3Schema = z.object({
  primaryConcern: z.enum(["ALCOHOL"], {
    message: "Please select your primary concern",
  }),
  treatmentGoal: z.enum(["QUIT", "REDUCE", "EXPLORE"], {
    message: "Please select your treatment goal",
  }),
});

export const step4Schema = z.object({
  privacyConsentGiven: z.boolean().refine((val) => val === true, {
    message: "You must consent to the Privacy Policy",
  }),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: "You must accept the Terms of Service",
  }),
});

// Combined schema for the full form
export const checkoutSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema);

// Type exports
export type Step1Data = z.infer<typeof step1Schema>;
export type Step2Data = z.infer<typeof step2Schema>;
export type Step3Data = z.infer<typeof step3Schema>;
export type Step4Data = z.infer<typeof step4Schema>;
export type CheckoutData = z.infer<typeof checkoutSchema>;

// Step configuration
export interface CheckoutStep {
  id: number;
  title: string;
  description: string;
}

export const checkoutSteps: CheckoutStep[] = [
  { id: 1, title: "Personal Info", description: "Your basic information" },
  { id: 2, title: "Address", description: "Home and billing address" },
  { id: 3, title: "Screening", description: "Treatment preferences" },
  { id: 4, title: "Review", description: "Review and confirm" },
];

// Context type for multi-step form state management
export interface CheckoutContextType {
  currentStep: number;
  formData: Partial<CheckoutData>;
  setCurrentStep: (step: number) => void;
  updateFormData: (data: Partial<CheckoutData>) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  goToStep: (step: number) => void;
  isStepValid: (step: number) => Promise<boolean>;
  isSubmitting: boolean;
  submitError: string | null;
  submitForm: () => Promise<void>;
}

// Primary concern options
export const primaryConcernOptions = [
  {
    value: "ALCOHOL" as const,
    label: "Alcohol Use",
    description: "I want help managing my alcohol consumption",
  },
];

// Treatment goal options
export const treatmentGoalOptions = [
  {
    value: "QUIT" as const,
    label: "Quit Completely",
    description: "I want to stop entirely",
  },
  {
    value: "REDUCE" as const,
    label: "Reduce Use",
    description: "I want to cut back gradually",
  },
  {
    value: "EXPLORE" as const,
    label: "Explore Options",
    description: "I'm not sure yet and want to discuss with a doctor",
  },
];
