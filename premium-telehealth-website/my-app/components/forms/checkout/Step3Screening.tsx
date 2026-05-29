"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Wine, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCheckout } from "./CheckoutContext";
import {
  Step3Data,
  step3Schema,
  primaryConcernOptions,
  treatmentGoalOptions,
} from "./types";

// ============================================================================
// Step 3: Screening Questions
// Collects primary concern and treatment goal preferences
// ============================================================================

const stepVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

const icons = {
  ALCOHOL: Wine,
  WEIGHT_MANAGEMENT: Scale,
};

export function Step3Screening() {
  const { formData, updateFormData, goToNextStep, goToPreviousStep } =
    useCheckout();

  const {
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      primaryConcern: formData.primaryConcern,
      treatmentGoal: formData.treatmentGoal,
    },
    mode: "onChange",
  });

  const primaryConcern = watch("primaryConcern");
  const treatmentGoal = watch("treatmentGoal");

  const onSubmit = async (data: Step3Data) => {
    updateFormData(data);
    await goToNextStep();
  };

  return (
    <motion.div
      key="step3"
      variants={stepVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="space-y-8">
        {/* Primary Concern Section */}
        <div>
          <Label className="text-base font-semibold">
            What would you like help with?{" "}
            <span className="text-destructive">*</span>
          </Label>
          <p className="text-sm text-muted-foreground mt-1">
            Select the primary reason you&apos;re seeking treatment
          </p>

          <div className="grid gap-3 mt-4">
            {primaryConcernOptions.map((option) => {
              const Icon = icons[option.value];
              const isSelected = primaryConcern === option.value;

              return (
                <label
                  key={option.value}
                  className={cn(
                    "relative flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200",
                    isSelected
                      ? "border-ocean-500 bg-ocean-50"
                      : "border-gray-200 hover:border-ocean-200 hover:bg-gray-50"
                  )}
                >
                  <input
                    type="radio"
                    value={option.value}
                    checked={isSelected}
                    onChange={() => setValue("primaryConcern", option.value)}
                    className="sr-only"
                    aria-label={option.label}
                  />
                  <div
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full shrink-0",
                      isSelected ? "bg-ocean-500 text-white" : "bg-gray-100"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <span
                      className={cn(
                        "block font-medium",
                        isSelected ? "text-ocean-900" : "text-gray-900"
                      )}
                    >
                      {option.label}
                    </span>
                    <span
                      className={cn(
                        "block text-sm mt-0.5",
                        isSelected ? "text-ocean-700" : "text-gray-500"
                      )}
                    >
                      {option.description}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                      isSelected
                        ? "border-ocean-500 bg-ocean-500"
                        : "border-gray-300"
                    )}
                  >
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                </label>
              );
            })}
          </div>
          {errors.primaryConcern && (
            <p className="text-sm text-destructive mt-2" role="alert">
              {errors.primaryConcern.message}
            </p>
          )}
        </div>

        {/* Treatment Goal Section */}
        <div>
          <Label className="text-base font-semibold">
            What is your goal? <span className="text-destructive">*</span>
          </Label>
          <p className="text-sm text-muted-foreground mt-1">
            This helps us match you with the right treatment approach
          </p>

          <div className="grid gap-3 mt-4">
            {treatmentGoalOptions.map((option) => {
              const isSelected = treatmentGoal === option.value;

              return (
                <label
                  key={option.value}
                  className={cn(
                    "relative flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all duration-200",
                    isSelected
                      ? "border-ocean-500 bg-ocean-50"
                      : "border-gray-200 hover:border-ocean-200 hover:bg-gray-50"
                  )}
                >
                  <input
                    type="radio"
                    value={option.value}
                    checked={isSelected}
                    onChange={() => setValue("treatmentGoal", option.value)}
                    className="sr-only"
                    aria-label={option.label}
                  />
                  <div className="flex-1">
                    <span
                      className={cn(
                        "block font-medium",
                        isSelected ? "text-ocean-900" : "text-gray-900"
                      )}
                    >
                      {option.label}
                    </span>
                    <span
                      className={cn(
                        "block text-sm mt-0.5",
                        isSelected ? "text-ocean-700" : "text-gray-500"
                      )}
                    >
                      {option.description}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                      isSelected
                        ? "border-ocean-500 bg-ocean-500"
                        : "border-gray-300"
                    )}
                  >
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                </label>
              );
            })}
          </div>
          {errors.treatmentGoal && (
            <p className="text-sm text-destructive mt-2" role="alert">
              {errors.treatmentGoal.message}
            </p>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={goToPreviousStep}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          <Button
            type="button"
            onClick={handleSubmit(onSubmit)}
            className="flex items-center gap-2 btn-primary"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
