"use client";

import { useState, forwardRef } from "react";
import { Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SmartInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  validate?: (value: string) => { valid: boolean; message?: string };
  errorMessage?: string;
  successMessage?: string;
}

/**
 * Self-contained input with real-time validation feedback.
 * Shows a green check on success, red error with message on failure.
 * Integrates with react-hook-form via `ref` forwarding.
 */
export const SmartInput = forwardRef<HTMLInputElement, SmartInputProps>(
  (
    {
      label,
      validate,
      errorMessage,
      successMessage = "Looks good!",
      className,
      required,
      ...props
    },
    ref
  ) => {
    const [touched, setTouched] = useState(false);
    const [value, setInternalValue] = useState("");

    const validation =
      validate && touched && value.length > 0 ? validate(value) : null;
    const showSuccess = validation?.valid === true;
    const showError =
      errorMessage && touched
        ? true
        : validation?.valid === false && value.length > 0;
    const errorText = errorMessage ?? validation?.message;

    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-gray-900">
          {label}
          {required && (
            <span className="text-ocean-500 ml-1" aria-hidden>
              *
            </span>
          )}
        </label>

        <div className="relative">
          <input
            ref={ref}
            value={value}
            onChange={(e) => {
              setInternalValue(e.target.value);
              props.onChange?.(e);
            }}
            onBlur={(e) => {
              setTouched(true);
              props.onBlur?.(e);
            }}
            className={cn(
              "w-full px-4 py-3 rounded-lg border transition-all duration-200",
              "text-base text-gray-900 placeholder:text-gray-400",
              "focus:outline-none focus:ring-[3px]",
              showError
                ? "border-red-400 focus:border-red-400 focus:ring-red-400/10"
                : showSuccess
                ? "border-success focus:border-success focus:ring-success/10"
                : "border-gray-200 focus:border-ocean-500 focus:ring-ocean-500/10",
              className
            )}
            aria-invalid={showError ? "true" : "false"}
            {...props}
          />

          {showSuccess && (
            <Check
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-success"
              aria-hidden
            />
          )}
        </div>

        {showError && errorText && (
          <p className="flex items-center gap-1.5 text-sm text-red-500" role="alert">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden />
            {errorText}
          </p>
        )}

        {showSuccess && (
          <p className="flex items-center gap-1.5 text-sm text-success">
            <Check className="w-4 h-4 flex-shrink-0" aria-hidden />
            {successMessage}
          </p>
        )}
      </div>
    );
  }
);
SmartInput.displayName = "SmartInput";
