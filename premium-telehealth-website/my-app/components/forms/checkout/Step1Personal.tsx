"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCheckout } from "./CheckoutContext";
import { Step1Data, step1Schema } from "./types";

// ============================================================================
// Step 1: Personal Information
// Collects first name, last name, date of birth, and phone number
// ============================================================================

const stepVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export function Step1Personal() {
  const { formData, updateFormData, goToNextStep } = useCheckout();
  const [validationErrors, setValidationErrors] = React.useState<
    Record<string, string>
  >({});

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      firstName: formData.firstName || "",
      lastName: formData.lastName || "",
      dateOfBirth: formData.dateOfBirth || "",
      phone: formData.phone || "",
    },
    mode: "onBlur",
  });

  const onSubmit = async (data: Step1Data) => {
    updateFormData(data);
    await goToNextStep();
  };

  // Format phone number as user types
  const formatPhoneNumber = (value: string) => {
    const phone = value.replace(/\D/g, "");
    if (phone.length <= 3) return phone;
    if (phone.length <= 6) return `(${phone.slice(0, 3)}) ${phone.slice(3)}`;
    return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6, 10)}`;
  };

  return (
    <motion.div
      key="step1"
      variants={stepVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="space-y-6">
        {/* First Name */}
        <div>
          <Label htmlFor="firstName">
            First Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="firstName"
            {...register("firstName")}
            placeholder="John"
            aria-invalid={!!errors.firstName}
            className={cn(
              "mt-1.5",
              errors.firstName && "border-destructive"
            )}
          />
          {errors.firstName && (
            <p className="text-sm text-destructive mt-1.5" role="alert">
              {errors.firstName.message}
            </p>
          )}
        </div>

        {/* Last Name */}
        <div>
          <Label htmlFor="lastName">
            Last Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="lastName"
            {...register("lastName")}
            placeholder="Doe"
            aria-invalid={!!errors.lastName}
            className={cn(
              "mt-1.5",
              errors.lastName && "border-destructive"
            )}
          />
          {errors.lastName && (
            <p className="text-sm text-destructive mt-1.5" role="alert">
              {errors.lastName.message}
            </p>
          )}
        </div>

        {/* Date of Birth */}
        <div>
          <Label htmlFor="dateOfBirth">
            Date of Birth <span className="text-destructive">*</span>
          </Label>
          <Input
            id="dateOfBirth"
            {...register("dateOfBirth")}
            placeholder="MM/DD/YYYY"
            aria-invalid={!!errors.dateOfBirth}
            className={cn(
              "mt-1.5",
              errors.dateOfBirth && "border-destructive"
            )}
          />
          {errors.dateOfBirth ? (
            <p className="text-sm text-destructive mt-1.5" role="alert">
              {errors.dateOfBirth.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1.5">
              Format: MM/DD/YYYY
            </p>
          )}
        </div>

        {/* Phone Number */}
        <div>
          <Label htmlFor="phone">
            Phone Number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            {...register("phone")}
            placeholder="(555) 555-5555"
            aria-invalid={!!errors.phone}
            className={cn("mt-1.5", errors.phone && "border-destructive")}
          />
          {errors.phone ? (
            <p className="text-sm text-destructive mt-1.5" role="alert">
              {errors.phone.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1.5">
              We&apos;ll use this for appointment reminders and updates
            </p>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-end pt-6 border-t">
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
