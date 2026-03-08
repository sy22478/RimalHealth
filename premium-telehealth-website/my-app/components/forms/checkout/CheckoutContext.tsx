"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckoutContextType,
  CheckoutData,
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  checkoutSteps,
  type CheckoutStep,
} from "./types";

// ============================================================================
// Checkout Form Context Provider
// Manages multi-step form state with localStorage persistence
// ============================================================================

const CheckoutContext = React.createContext<CheckoutContextType | undefined>(
  undefined
);

const LOCAL_STORAGE_KEY = "rimal_checkout_data";

interface CheckoutProviderProps {
  children: React.ReactNode;
}

export function CheckoutProvider({ children }: CheckoutProviderProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [formData, setFormData] = React.useState<Partial<CheckoutData>>({
    addressState: "CA",
    billingSameAsHome: true,
  });

  // Load saved data from localStorage on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setFormData((prev) => ({ ...prev, ...parsed.formData }));
        setCurrentStep(parsed.currentStep || 1);
      }
    } catch {
      // Ignore localStorage errors (privacy mode, etc.)
    }
  }, []);

  // Save to localStorage whenever data changes
  React.useEffect(() => {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({ formData, currentStep })
      );
    } catch {
      // Ignore localStorage errors
    }
  }, [formData, currentStep]);

  const updateFormData = React.useCallback((data: Partial<CheckoutData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  }, []);

  const isStepValid = React.useCallback(
    async (step: number): Promise<boolean> => {
      try {
        switch (step) {
          case 1:
            await step1Schema.parseAsync(formData);
            return true;
          case 2:
            await step2Schema.parseAsync(formData);
            return true;
          case 3:
            await step3Schema.parseAsync(formData);
            return true;
          case 4:
            await step4Schema.parseAsync(formData);
            return true;
          default:
            return false;
        }
      } catch {
        return false;
      }
    },
    [formData]
  );

  const goToNextStep = React.useCallback(async () => {
    const isValid = await isStepValid(currentStep);
    if (isValid && currentStep < 4) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    return isValid;
  }, [currentStep, isStepValid]);

  const goToPreviousStep = React.useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [currentStep]);

  const goToStep = React.useCallback(
    async (step: number) => {
      // Can only go to steps that have been completed or the next available step
      if (step < currentStep) {
        setCurrentStep(step);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return true;
      }

      // For forward navigation, validate current step first
      if (step > currentStep) {
        for (let i = currentStep; i < step; i++) {
          const isValid = await isStepValid(i);
          if (!isValid) return false;
        }
        setCurrentStep(step);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return true;
      }

      return true;
    },
    [currentStep, isStepValid]
  );

  const submitForm = React.useCallback(async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Validate all steps before submitting
      const allValid = await Promise.all([
        isStepValid(1),
        isStepValid(2),
        isStepValid(3),
        isStepValid(4),
      ]);

      if (!allValid.every(Boolean)) {
        setSubmitError("Please complete all required fields");
        setIsSubmitting(false);
        return;
      }

      // Submit to API
      const response = await fetch("/api/patient/onboarding/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.message || "Failed to submit. Please try again."
        );
      }

      // Clear localStorage on successful submission
      localStorage.removeItem(LOCAL_STORAGE_KEY);

      // Redirect to payment
      router.push("/checkout/payment");
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, isStepValid, router]);

  const value = React.useMemo(
    () => ({
      currentStep,
      formData,
      setCurrentStep,
      updateFormData,
      goToNextStep,
      goToPreviousStep,
      goToStep,
      isStepValid,
      isSubmitting,
      submitError,
      submitForm,
    }),
    [
      currentStep,
      formData,
      updateFormData,
      goToNextStep,
      goToPreviousStep,
      goToStep,
      isStepValid,
      isSubmitting,
      submitError,
      submitForm,
    ]
  );

  return (
    <CheckoutContext.Provider value={value}>
      {children}
    </CheckoutContext.Provider>
  );
}

// Custom hook for consuming the context
export function useCheckout(): CheckoutContextType {
  const context = React.useContext(CheckoutContext);
  if (context === undefined) {
    throw new Error("useCheckout must be used within a CheckoutProvider");
  }
  return context;
}
