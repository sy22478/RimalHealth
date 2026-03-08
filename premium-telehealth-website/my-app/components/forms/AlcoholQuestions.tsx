"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Wine, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useFormContext, Controller } from "react-hook-form";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AUDIT_C_QUESTIONS, ALCOHOL_SPECIFIC_QUESTIONS, calculateAuditCScore } from "@/lib/intake";

export function AlcoholQuestions() {
  const { control, watch, formState: { errors } } = useFormContext();
  
  // Watch AUDIT-C answers for real-time scoring
  const audit1 = watch("audit_1");
  const audit2 = watch("audit_2");
  const audit3 = watch("audit_3");
  
  // Calculate live score
  const auditResult = React.useMemo(() => {
    if (audit1 && audit2 && audit3) {
      return calculateAuditCScore({
        audit_1: audit1,
        audit_2: audit2,
        audit_3: audit3,
      });
    }
    return null;
  }, [audit1, audit2, audit3]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Wine className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-blue-900">AUDIT-C Assessment</h3>
          <p className="text-sm text-blue-700 mt-1">
            These 3 questions help us understand your alcohol use patterns. 
            Your answers are confidential and help us determine the most appropriate treatment.
          </p>
        </div>
      </div>

      {/* Live Score Display */}
      {auditResult && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-lg border",
            auditResult.riskLevel === "LOW" && "bg-green-50 border-green-200",
            auditResult.riskLevel === "MODERATE" && "bg-yellow-50 border-yellow-200",
            auditResult.riskLevel === "HIGH" && "bg-orange-50 border-orange-200",
            auditResult.riskLevel === "SEVERE" && "bg-red-50 border-red-200"
          )}
        >
          <div className="flex items-center gap-3">
            {auditResult.riskLevel === "LOW" ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className={cn(
                "w-5 h-5",
                auditResult.riskLevel === "MODERATE" && "text-yellow-600",
                auditResult.riskLevel === "HIGH" && "text-orange-600",
                auditResult.riskLevel === "SEVERE" && "text-red-600"
              )} />
            )}
            <div>
              <p className={cn(
                "font-medium",
                auditResult.riskLevel === "LOW" && "text-green-900",
                auditResult.riskLevel === "MODERATE" && "text-yellow-900",
                auditResult.riskLevel === "HIGH" && "text-orange-900",
                auditResult.riskLevel === "SEVERE" && "text-red-900"
              )}>
                Score: {auditResult.score}/12 - {auditResult.riskLevel} Risk
              </p>
              <p className="text-sm text-gray-600 mt-0.5">
                {auditResult.interpretation}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* AUDIT-C Questions */}
      <div className="space-y-6">
        {AUDIT_C_QUESTIONS.map((question, index) => (
          <div key={question.id} className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-ocean-100 text-ocean-700 rounded-full text-xs font-medium">
                {index + 1}
              </span>
              <Label className="text-sm font-medium text-gray-900">
                {question.label}
                {question.required && <span className="text-ocean-500 ml-0.5">*</span>}
              </Label>
            </div>
            
            {question.helpText && (
              <p className="text-xs text-gray-500 ml-8">{question.helpText}</p>
            )}
            
            <Controller
              name={question.id}
              control={control}
              render={({ field }) => (
                <div className="ml-8 space-y-2">
                  {question.options?.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        "hover:border-ocean-300 hover:bg-ocean-50/30",
                        field.value === option.value
                          ? "border-ocean-500 bg-ocean-50 shadow-sm"
                          : "border-gray-200 bg-white"
                      )}
                    >
                      <input
                        type="radio"
                        value={option.value}
                        checked={field.value === option.value}
                        onChange={() => field.onChange(option.value)}
                        className="w-4 h-4 text-ocean-600 border-gray-300 focus:ring-ocean-500"
                      />
                      <span className="text-sm text-gray-900 flex-1">{option.label}</span>
                      {option.score !== undefined && (
                        <span className="text-xs text-gray-400">({option.score} pts)</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            />
            
            {errors[question.id] && (
              <p className="text-sm text-red-500 ml-8">
                {errors[question.id]?.message as string}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Additional Alcohol Questions */}
      <div className="pt-6 border-t border-gray-200">
        <h4 className="font-medium text-gray-900 mb-4">Additional Information</h4>
        
        {ALCOHOL_SPECIFIC_QUESTIONS.filter(q => q.id !== 'alcoholConcernLevel').map((question) => (
          <div key={question.id} className="space-y-3 mb-6">
            <Label className="text-sm font-medium text-gray-900">
              {question.label}
              {question.required && <span className="text-ocean-500 ml-0.5">*</span>}
            </Label>
            
            {question.type === "select" ? (
              <Controller
                name={question.id}
                control={control}
                render={({ field }) => (
                  <select
                    {...field}
                    className={cn(
                      "w-full h-10 px-3 rounded-md border bg-white text-sm",
                      "focus:outline-none focus:ring-2 focus:ring-ocean-500/20 focus:border-ocean-500",
                      errors[question.id] && "border-red-400"
                    )}
                  >
                    <option value="">Select an option...</option>
                    {question.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              />
            ) : (
              <Controller
                name={question.id}
                control={control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    placeholder={question.placeholder}
                    className={cn(
                      "min-h-[100px] resize-y",
                      errors[question.id] && "border-red-400"
                    )}
                  />
                )}
              />
            )}
            
            {errors[question.id] && (
              <p className="text-sm text-red-500">
                {errors[question.id]?.message as string}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
