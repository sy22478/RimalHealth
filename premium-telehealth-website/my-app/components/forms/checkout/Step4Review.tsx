"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCheckout } from "./CheckoutContext";
import {
  Step4Data,
  step4Schema,
  primaryConcernOptions,
  treatmentGoalOptions,
} from "./types";

// ============================================================================
// Step 4: Review and Confirm
// Displays all collected data and requires consent checkboxes
// ============================================================================

const stepVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

interface ReviewSectionProps {
  title: string;
  stepNumber: number;
  onEdit: () => void;
  children: React.ReactNode;
}

function ReviewSection({
  title,
  stepNumber,
  onEdit,
  children,
}: ReviewSectionProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-ocean-600 hover:text-ocean-700 font-medium underline"
        >
          Edit
        </button>
      </div>
      <div className="text-sm text-gray-700">{children}</div>
    </div>
  );
}

export function Step4Review() {
  const {
    formData,
    goToPreviousStep,
    goToStep,
    submitForm,
    isSubmitting,
    submitError,
  } = useCheckout();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Step4Data>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      privacyConsentGiven: formData.privacyConsentGiven || false,
      termsAccepted: formData.termsAccepted || false,
    },
    mode: "onChange",
  });

  const privacyConsentGiven = watch("privacyConsentGiven");
  const termsAccepted = watch("termsAccepted");

  const onSubmit = async () => {
    await submitForm();
  };

  const primaryConcernLabel =
    primaryConcernOptions.find((o) => o.value === formData.primaryConcern)
      ?.label || formData.primaryConcern;

  const treatmentGoalLabel =
    treatmentGoalOptions.find((o) => o.value === formData.treatmentGoal)
      ?.label || formData.treatmentGoal;

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(
        6
      )}`;
    }
    return phone;
  };

  return (
    <motion.div
      key="step4"
      variants={stepVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="space-y-6">
        {/* Review Sections */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Review Your Information
          </h2>
          <p className="text-sm text-gray-600">
            Please review your information below. Click &quot;Edit&quot; to make
            changes.
          </p>

          {/* Personal Info */}
          <ReviewSection
            title="Personal Information"
            stepNumber={1}
            onEdit={() => goToStep(1)}
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-500">Name:</span>
                <p className="font-medium">
                  {formData.firstName} {formData.lastName}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Date of Birth:</span>
                <p className="font-medium">{formData.dateOfBirth}</p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Phone:</span>
                <p className="font-medium">
                  {formData.phone ? formatPhone(formData.phone) : "-"}
                </p>
              </div>
            </div>
          </ReviewSection>

          {/* Address */}
          <ReviewSection
            title="Home Address"
            stepNumber={2}
            onEdit={() => goToStep(2)}
          >
            <div>
              <p className="font-medium">{formData.addressStreet}</p>
              <p>
                {formData.addressCity}, {formData.addressState}{" "}
                {formData.addressZip}
              </p>
            </div>
          </ReviewSection>

          {/* Billing Address */}
          <ReviewSection
            title="Billing Address"
            stepNumber={2}
            onEdit={() => goToStep(2)}
          >
            {formData.billingSameAsHome ? (
              <p className="text-gray-600 italic">Same as home address</p>
            ) : (
              <div>
                <p className="font-medium">{formData.billingStreet}</p>
                <p>
                  {formData.billingCity}, {formData.billingState}{" "}
                  {formData.billingZip}
                </p>
              </div>
            )}
          </ReviewSection>

          {/* Screening */}
          <ReviewSection
            title="Treatment Preferences"
            stepNumber={3}
            onEdit={() => goToStep(3)}
          >
            <div className="space-y-1">
              <p>
                <span className="text-gray-500">Primary Concern:</span>{" "}
                <span className="font-medium">{primaryConcernLabel}</span>
              </p>
              <p>
                <span className="text-gray-500">Treatment Goal:</span>{" "}
                <span className="font-medium">{treatmentGoalLabel}</span>
              </p>
            </div>
          </ReviewSection>
        </div>

        {/* Consent Section */}
        <div className="pt-4 border-t space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Consent & Agreements
          </h3>

          {/* HIPAA Consent */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="privacyConsentGiven"
              checked={privacyConsentGiven}
              onCheckedChange={(checked) =>
                setValue("privacyConsentGiven", checked === true)
              }
              aria-invalid={!!errors.privacyConsentGiven}
            />
            <div className="flex-1">
              <Label
                htmlFor="privacyConsentGiven"
                className="text-sm font-normal cursor-pointer leading-relaxed"
              >
                I consent to the collection and use of my health information as
                described in the{" "}
                <a
                  href="/privacy"
                  className="text-ocean-600 underline hover:text-ocean-700 font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>{" "}
                and{" "}
                <a
                  href="/hipaa"
                  className="text-ocean-600 underline hover:text-ocean-700 font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  HIPAA Notice
                </a>
                . <span className="text-destructive">*</span>
              </Label>
              {errors.privacyConsentGiven && (
                <p className="text-sm text-destructive mt-1" role="alert">
                  {errors.privacyConsentGiven.message}
                </p>
              )}
            </div>
          </div>

          {/* Terms Acceptance */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="termsAccepted"
              checked={termsAccepted}
              onCheckedChange={(checked) =>
                setValue("termsAccepted", checked === true)
              }
              aria-invalid={!!errors.termsAccepted}
            />
            <div className="flex-1">
              <Label
                htmlFor="termsAccepted"
                className="text-sm font-normal cursor-pointer leading-relaxed"
              >
                I agree to the{" "}
                <a
                  href="/terms"
                  className="text-ocean-600 underline hover:text-ocean-700 font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Terms of Service
                </a>{" "}
                and understand that Rimal Health provides telehealth services
                only to California residents.{" "}
                <span className="text-destructive">*</span>
              </Label>
              {errors.termsAccepted && (
                <p className="text-sm text-destructive mt-1" role="alert">
                  {errors.termsAccepted.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {submitError && (
          <div
            className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-start gap-3"
            role="alert"
          >
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{submitError}</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={goToPreviousStep}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          <Button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className={cn(
              "flex items-center gap-2 btn-primary min-w-[160px]",
              isSubmitting && "opacity-70 cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Proceed to Payment
                <Check className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
