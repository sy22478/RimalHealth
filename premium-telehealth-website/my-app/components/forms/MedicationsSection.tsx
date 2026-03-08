"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pill, AlertCircle, Info } from "lucide-react";
import { useFormContext, Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function MedicationsSection() {
  const { control, watch, formState: { errors } } = useFormContext();
  
  const takingMedications = watch("takingMedications");
  const showMedications = takingMedications === "true" || takingMedications === true;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg">
        <div className="p-2 bg-green-100 rounded-lg">
          <Pill className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h3 className="font-semibold text-green-900">Current Medications</h3>
          <p className="text-sm text-green-700 mt-1">
            Tell us about any medications you&apos;re taking. This includes prescription 
            medications, over-the-counter drugs, vitamins, and supplements.
          </p>
        </div>
      </div>

      {/* Taking Medications Question */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-gray-900">
          Are you currently taking any medications?
          <span className="text-ocean-500 ml-0.5">*</span>
        </Label>
        
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
          <Info className="w-4 h-4 flex-shrink-0" />
          <p>Your physician needs this information to avoid drug interactions.</p>
        </div>
        
        <Controller
          name="takingMedications"
          control={control}
          render={({ field }) => (
            <div className="flex gap-3">
              <label
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all",
                  field.value === "true" || field.value === true
                    ? "border-ocean-500 bg-ocean-50 text-ocean-700"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                )}
              >
                <input
                  type="radio"
                  value="true"
                  checked={field.value === "true" || field.value === true}
                  onChange={() => field.onChange("true")}
                  className="w-4 h-4 text-ocean-600 border-gray-300"
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
        
        {errors.takingMedications && (
          <p className="text-sm text-red-500 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {errors.takingMedications.message as string}
          </p>
        )}
      </div>

      {/* Medication List */}
      <AnimatePresence>
        {showMedications && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 pl-4 border-l-2 border-ocean-200">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-900">
                  Please list all current medications
                  <span className="text-ocean-500 ml-0.5">*</span>
                </Label>
                <p className="text-sm text-gray-500">
                  Include medication name, dosage, and how often you take it
                </p>
                <Controller
                  name="medicationList"
                  control={control}
                  render={({ field }) => (
                    <Textarea
                      {...field}
                      placeholder={`Example:
- Lisinopril 10mg - once daily for blood pressure
- Multivitamin - once daily
- Ibuprofen 200mg - as needed for headaches`}
                      className={cn(
                        "min-h-[150px] resize-y font-mono text-sm",
                        errors.medicationList && "border-red-400"
                      )}
                    />
                  )}
                />
                {errors.medicationList && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.medicationList.message as string}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Medication Allergies */}
      <div className="space-y-3 pt-4 border-t border-gray-200">
        <Label className="text-sm font-medium text-gray-900">
          Do you have any medication allergies?
        </Label>
        <p className="text-sm text-gray-500">
          List any medications you are allergic to and describe the reaction
        </p>
        <Controller
          name="medicationAllergies"
          control={control}
          render={({ field }) => (
            <Textarea
              {...field}
              placeholder={`Example:
- Penicillin - causes rash and hives
- Sulfa drugs - causes nausea`}
              className="min-h-[100px] resize-y font-mono text-sm"
            />
          )}
        />
      </div>

      {/* Privacy Note */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-900 font-medium">Your information is secure</p>
          <p className="text-sm text-blue-700 mt-1">
            Your medication list is encrypted and only accessible to your treating physician. 
            We use this information solely to ensure safe prescribing.
          </p>
        </div>
      </div>
    </div>
  );
}
