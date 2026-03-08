"use client";

import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckoutProvider, useCheckout } from "./CheckoutContext";
import { ProgressBar } from "./ProgressBar";
import { Step1Personal } from "./Step1Personal";
import { Step2Address } from "./Step2Address";
import { Step3Screening } from "./Step3Screening";
import { Step4Review } from "./Step4Review";
import { checkoutSteps } from "./types";
import { Announcer } from "@/components/a11y/Announcer";

// Re-export types and utilities
export type {
  CheckoutData,
  CheckoutStep,
  CheckoutContextType,
  Step1Data,
  Step2Data,
  Step3Data,
  Step4Data,
} from "./types";

export {
  checkoutSteps,
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  checkoutSchema,
  primaryConcernOptions,
  treatmentGoalOptions,
} from "./types";

export { CheckoutProvider, useCheckout } from "./CheckoutContext";

// ============================================================================
// Checkout Form Component
// Main orchestrator for the multi-step checkout flow
// ============================================================================

function CheckoutFormContent() {
  const { currentStep } = useCheckout();

  const currentStepInfo = checkoutSteps[currentStep - 1];

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Screen reader announcement for step changes */}
      <Announcer
        message={`Step ${currentStep} of ${checkoutSteps.length}: ${currentStepInfo.title}`}
      />

      <Card className="border-gray-200 shadow-lg">
        <CardHeader className="pb-0">
          <ProgressBar />
        </CardHeader>

        <CardContent className="pt-6">
          {/* Step Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">
              {currentStepInfo.title}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {currentStepInfo.description}
            </p>
          </div>

          {/* Step Content with Animation */}
          <AnimatePresence mode="wait">
            {currentStep === 1 && <Step1Personal key="step1" />}
            {currentStep === 2 && <Step2Address key="step2" />}
            {currentStep === 3 && <Step3Screening key="step3" />}
            {currentStep === 4 && <Step4Review key="step4" />}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* HIPAA Notice */}
      <p className="text-xs text-center text-gray-400 mt-6 px-4">
        Your information is protected by HIPAA. We encrypt all data and never
        share it without your consent.
      </p>
    </div>
  );
}

export function CheckoutForm() {
  return (
    <CheckoutProvider>
      <CheckoutFormContent />
    </CheckoutProvider>
  );
}
