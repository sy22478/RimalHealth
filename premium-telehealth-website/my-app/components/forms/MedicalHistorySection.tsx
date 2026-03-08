"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HeartPulse, AlertCircle, Baby, Brain, Activity } from "lucide-react";
import { useFormContext, Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const medicalConditions = [
  {
    id: "isPregnant",
    label: "Are you currently pregnant or planning to become pregnant?",
    icon: Baby,
    color: "pink",
    detailsId: "isPregnantDetails",
    detailsLabel: "Please provide details about your pregnancy",
    detailsPlaceholder: "How far along are you? Any complications?",
  },
  {
    id: "hasSeizureHistory",
    label: "Have you ever been diagnosed with a seizure disorder or epilepsy?",
    icon: Activity,
    color: "red",
    detailsId: "seizureDetails",
    detailsLabel: "Please provide details about your seizure history",
    detailsPlaceholder: "When was your last seizure? What medications are you on?",
    alert: "Important for medication safety",
  },
  {
    id: "hasPsychiatricHistory",
    label: "Have you ever been diagnosed with depression, anxiety, bipolar disorder, or other mental health conditions?",
    icon: Brain,
    color: "purple",
    detailsId: "psychiatricDetails",
    detailsLabel: "Please provide details about your mental health history",
    detailsPlaceholder: "What conditions have you been diagnosed with? Are you currently receiving treatment?",
  },
  {
    id: "hasLiverDisease",
    label: "Have you ever been diagnosed with liver disease or liver problems?",
    icon: HeartPulse,
    color: "orange",
    detailsId: "liverDiseaseDetails",
    detailsLabel: "Please provide details about your liver condition",
    detailsPlaceholder: "What type of liver disease? Any current treatment?",
    alert: "Important for alcohol use disorder treatment",
  },
  {
    id: "hasKidneyDisease",
    label: "Have you ever been diagnosed with kidney disease?",
    icon: HeartPulse,
    color: "blue",
    detailsId: "kidneyDiseaseDetails",
    detailsLabel: "Please provide details about your kidney condition",
    detailsPlaceholder: "What stage? Any dialysis or treatment?",
  },
  {
    id: "hasHeartCondition",
    label: "Do you have any heart conditions or cardiovascular disease?",
    icon: HeartPulse,
    color: "red",
    detailsId: "heartConditionDetails",
    detailsLabel: "Please provide details about your heart condition",
    detailsPlaceholder: "What conditions? Any current medications?",
  },
];

const colorClasses: Record<string, { bg: string; text: string; border: string; lightBg: string }> = {
  pink: { bg: "bg-pink-100", text: "text-pink-600", border: "border-pink-200", lightBg: "bg-pink-50" },
  red: { bg: "bg-red-100", text: "text-red-600", border: "border-red-200", lightBg: "bg-red-50" },
  purple: { bg: "bg-purple-100", text: "text-purple-600", border: "border-purple-200", lightBg: "bg-purple-50" },
  orange: { bg: "bg-orange-100", text: "text-orange-600", border: "border-orange-200", lightBg: "bg-orange-50" },
  blue: { bg: "bg-blue-100", text: "text-blue-600", border: "border-blue-200", lightBg: "bg-blue-50" },
};

export function MedicalHistorySection() {
  const { control, watch, formState: { errors } } = useFormContext();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="p-2 bg-ocean-100 rounded-lg">
          <HeartPulse className="w-6 h-6 text-ocean-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Medical History</h3>
          <p className="text-sm text-gray-600 mt-1">
            Please answer honestly about your medical history. This information helps us 
            prescribe safely and choose the most appropriate treatment for you.
          </p>
        </div>
      </div>

      {/* Conditions */}
      <div className="space-y-4">
        {medicalConditions.map((condition) => {
          const value = watch(condition.id);
          const colors = colorClasses[condition.color];
          const Icon = condition.icon;
          const showDetails = value === "true" || value === true;
          const hasError = errors[condition.id];

          return (
            <div
              key={condition.id}
              className={cn(
                "rounded-lg border transition-colors",
                showDetails ? colors.border : "border-gray-200",
                showDetails && colors.lightBg
              )}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn("p-2 rounded-lg flex-shrink-0", colors.bg)}>
                    <Icon className={cn("w-5 h-5", colors.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Label className="text-sm font-medium text-gray-900">
                      {condition.label}
                      <span className="text-ocean-500 ml-0.5">*</span>
                    </Label>
                    {condition.alert && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {condition.alert}
                      </p>
                    )}
                  </div>
                </div>

                <Controller
                  name={condition.id}
                  control={control}
                  render={({ field }) => (
                    <div className="flex gap-3 mt-3 ml-14">
                      <label
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all",
                          field.value === "true" || field.value === true
                            ? cn("border-current bg-current/10", colors.text)
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        )}
                      >
                        <input
                          type="radio"
                          value="true"
                          checked={field.value === "true" || field.value === true}
                          onChange={() => field.onChange("true")}
                          className={cn(
                            "w-4 h-4 border-gray-300 focus:ring-offset-0",
                            colors.text.replace("text-", "text-") // Keep the color
                          )}
                        />
                        <span className="text-sm font-medium">Yes</span>
                      </label>
                      <label
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all",
                          field.value === "false" || field.value === false
                            ? "border-ocean-500 bg-ocean-50 text-ocean-700"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        )}
                      >
                        <input
                          type="radio"
                          value="false"
                          checked={field.value === "false" || field.value === false}
                          onChange={() => field.onChange("false")}
                          className="w-4 h-4 text-ocean-600 border-gray-300"
                        />
                        <span className="text-sm font-medium">No</span>
                      </label>
                    </div>
                  )}
                />

                {hasError && (
                  <p className="text-sm text-red-500 mt-2 ml-14">
                    {hasError.message as string}
                  </p>
                )}
              </div>

              {/* Details Textarea */}
              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 ml-14">
                      <Label
                        htmlFor={condition.detailsId}
                        className="text-sm font-medium text-gray-700"
                      >
                        {condition.detailsLabel}
                      </Label>
                      <Controller
                        name={condition.detailsId}
                        control={control}
                        render={({ field }) => (
                          <Textarea
                            {...field}
                            id={condition.detailsId}
                            placeholder={condition.detailsPlaceholder}
                            className="mt-2 min-h-[80px] resize-y"
                          />
                        )}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Other Conditions */}
      <div className="pt-4 border-t border-gray-200">
        <Label className="text-sm font-medium text-gray-900">
          Any other medical conditions we should know about?
        </Label>
        <Controller
          name="otherConditions"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              placeholder="List any other conditions, surgeries, or health concerns"
              className="mt-2 min-h-[100px] resize-y"
            />
          )}
        />
      </div>
    </div>
  );
}
