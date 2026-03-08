"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, AlertCircle } from "lucide-react";
import { useFormContext, Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Question, shouldShowQuestion } from "@/lib/intake";


interface DynamicQuestionSetProps {
  questions: Question[];
  formData: Record<string, unknown>;
  sectionId: string;
}

export function DynamicQuestionSet({
  questions,
  formData,
  sectionId,
}: DynamicQuestionSetProps) {
  const {
    register,
    control,
    formState: { errors },
    watch,
  } = useFormContext();

  return (
    <div className="space-y-6">
      {questions.map((question, index) => {
        // Check if question should be shown based on dependencies
        const shouldShow = shouldShowQuestion(question, formData);
        
        return (
          <AnimatePresence key={question.id}>
            {shouldShow && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                className="overflow-hidden"
              >
                <QuestionField
                  question={question}
                  error={errors[question.id]?.message as string | undefined}
                  register={register}
                  control={control}
                  watch={watch}
                />
              </motion.div>
            )}
          </AnimatePresence>
        );
      })}
    </div>
  );
}

interface QuestionFieldProps {
  question: Question;
  error?: string;
  register: ReturnType<typeof useFormContext>['register'];
  control: ReturnType<typeof useFormContext>['control'];
  watch: ReturnType<typeof useFormContext>['watch'];
}

function QuestionField({
  question,
  error,
  register,
  control,
  watch,
}: QuestionFieldProps) {
  const { id, type, label, options, placeholder, required, helpText, min, max, step } = question;

  const renderLabel = () => (
    <div className="flex items-center gap-2 mb-2">
      <Label
        htmlFor={id}
        className={cn(
          "text-sm font-semibold text-gray-900",
          required && "after:content-['*'] after:ml-0.5 after:text-ocean-500"
        )}
      >
        {label}
      </Label>
      {helpText && (
        <button
          type="button"
          className="text-gray-400 hover:text-gray-600 focus:outline-none group relative"
          aria-label={`Help: ${label}`}
        >
          <HelpCircle className="w-4 h-4" />
          <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            {helpText}
            <span className="absolute left-1/2 -translate-x-1/2 top-full -mt-1 border-4 border-transparent border-t-gray-900" />
          </span>
        </button>
      )}
    </div>
  );

  const renderError = () =>
    error && (
      <p className="flex items-center gap-1 mt-1.5 text-sm text-red-500" role="alert">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
        {error}
      </p>
    );

  switch (type) {
    case "text":
      return (
        <div className="space-y-1">
          {renderLabel()}
          <Input
            id={id}
            type="text"
            placeholder={placeholder}
            {...register(id)}
            aria-invalid={!!error}
            className={cn(error && "border-red-400 focus-visible:ring-red-400/20")}
          />
          {renderError()}
        </div>
      );

    case "textarea":
      return (
        <div className="space-y-1">
          {renderLabel()}
          <Textarea
            id={id}
            placeholder={placeholder}
            {...register(id)}
            aria-invalid={!!error}
            className={cn(
              "min-h-[100px] resize-y",
              error && "border-red-400 focus-visible:ring-red-400/20"
            )}
          />
          {renderError()}
        </div>
      );

    case "number":
      return (
        <div className="space-y-1">
          {renderLabel()}
          <Input
            id={id}
            type="number"
            min={min}
            max={max}
            step={step}
            placeholder={placeholder}
            {...register(id, { valueAsNumber: true })}
            aria-invalid={!!error}
            className={cn(error && "border-red-400 focus-visible:ring-red-400/20")}
          />
          {renderError()}
        </div>
      );

    case "select":
      return (
        <div className="space-y-1">
          {renderLabel()}
          <select
            id={id}
            {...register(id)}
            aria-invalid={!!error}
            className={cn(
              "w-full h-10 px-3 rounded-md border bg-white text-sm",
              "focus:outline-none focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500",
              "transition-colors",
              error && "border-red-400 focus:ring-red-400/20 focus:border-red-400"
            )}
          >
            <option value="">{placeholder || "Select an option..."}</option>
            {options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {renderError()}
        </div>
      );

    case "radio":
      return (
        <div className="space-y-1">
          {renderLabel()}
          <div className="space-y-2">
            {options?.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                  "hover:bg-gray-50 hover:border-gray-300",
                  watch(id) === option.value
                    ? "border-ocean-500 bg-ocean-50/50"
                    : "border-gray-200 bg-white"
                )}
              >
                <input
                  type="radio"
                  value={option.value}
                  {...register(id)}
                  className="w-4 h-4 text-ocean-600 border-gray-300 focus:ring-ocean-500"
                />
                <span className="text-sm text-gray-900">{option.label}</span>
              </label>
            ))}
          </div>
          {renderError()}
        </div>
      );

    case "checkbox":
      return (
        <div className="space-y-1">
          {renderLabel()}
          <Controller
            name={id}
            control={control}
            render={({ field }) => (
              <div className="space-y-2">
                {options?.map((option) => {
                  const values = field.value || [];
                  const isChecked = values.includes(option.value);
                  
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        "hover:bg-gray-50 hover:border-gray-300",
                        isChecked
                          ? "border-ocean-500 bg-ocean-50/50"
                          : "border-gray-200 bg-white"
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            field.onChange([...values, option.value]);
                          } else {
                            field.onChange(values.filter((v: string) => v !== option.value));
                          }
                        }}
                      />
                      <span className="text-sm text-gray-900">{option.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          />
          {renderError()}
        </div>
      );

    default:
      return null;
  }
}
