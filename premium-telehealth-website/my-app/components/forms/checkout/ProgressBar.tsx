"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCheckout } from "./CheckoutContext";
import { checkoutSteps } from "./types";

// ============================================================================
// Checkout Progress Bar Component
// Shows current step with visual indicator and clickable navigation
// ============================================================================

export function ProgressBar() {
  const { currentStep, goToStep, isStepValid } = useCheckout();

  const handleStepClick = async (stepId: number) => {
    if (stepId < currentStep) {
      await goToStep(stepId);
    }
  };

  return (
    <div className="mb-8">
      <div className="relative flex items-start justify-between">
        {/* Connecting track behind the circles */}
        <div
          className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 mx-[calc(theme(spacing.5))]"
          aria-hidden
        />

        {/* Animated fill */}
        <motion.div
          className="absolute top-5 left-0 h-0.5 bg-ocean-500 transition-all duration-500 ease-out mx-[calc(theme(spacing.5))]"
          initial={false}
          animate={{
            width:
              currentStep === 1
                ? "0%"
                : `${((currentStep - 1) / (checkoutSteps.length - 1)) * 100}%`,
          }}
          aria-hidden
        />

        {checkoutSteps.map((step) => {
          const isCompleted = currentStep > step.id;
          const isActive = currentStep === step.id;
          const isClickable = step.id < currentStep;

          return (
            <div
              key={step.id}
              className="relative flex flex-col items-center gap-2 z-10"
            >
              <button
                type="button"
                onClick={() => handleStepClick(step.id)}
                disabled={!isClickable}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center",
                  "border-2 transition-all duration-300",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-2",
                  isCompleted
                    ? "bg-ocean-500 border-ocean-500 cursor-pointer hover:bg-ocean-600 hover:border-ocean-600"
                    : isActive
                    ? "bg-white border-ocean-500 ring-4 ring-ocean-500/15"
                    : "bg-white border-gray-200",
                  !isClickable && !isActive && "cursor-not-allowed"
                )}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Step ${step.id}: ${step.title}${
                  isClickable ? " - Click to go back" : ""
                }`}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5 text-white" aria-hidden />
                ) : (
                  <span
                    className={cn(
                      "text-sm font-bold",
                      isActive ? "text-ocean-500" : "text-gray-400"
                    )}
                  >
                    {step.id}
                  </span>
                )}
              </button>
              <div className="text-center">
                <span
                  className={cn(
                    "text-xs font-semibold block whitespace-nowrap",
                    isCompleted || isActive
                      ? "text-ocean-600"
                      : "text-gray-400"
                  )}
                >
                  {step.title}
                </span>
                <span className="text-[10px] text-gray-400 hidden sm:block">
                  {step.description}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
