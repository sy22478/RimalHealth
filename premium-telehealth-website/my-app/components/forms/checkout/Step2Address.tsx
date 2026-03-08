"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCheckout } from "./CheckoutContext";
import { Step2Data, step2Schema } from "./types";

// ============================================================================
// Step 2: Address Information
// Collects home address (CA only) and optional billing address
// ============================================================================

const stepVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export function Step2Address() {
  const { formData, updateFormData, goToNextStep, goToPreviousStep } =
    useCheckout();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      addressStreet: formData.addressStreet || "",
      addressCity: formData.addressCity || "",
      addressState: "CA" as const,
      addressZip: formData.addressZip || "",
      billingSameAsHome:
        formData.billingSameAsHome !== undefined
          ? formData.billingSameAsHome
          : true,
      billingStreet: formData.billingStreet || "",
      billingCity: formData.billingCity || "",
      billingState: formData.billingState || "",
      billingZip: formData.billingZip || "",
    },
    mode: "onBlur",
  });

  const billingSameAsHome = watch("billingSameAsHome");

  const onSubmit = async (data: unknown) => {
    updateFormData(data as Step2Data);
    await goToNextStep();
  };

  return (
    <motion.div
      key="step2"
      variants={stepVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="space-y-6">
        {/* Home Address Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">
            Home Address
          </h3>

          {/* Street Address */}
          <div>
            <Label htmlFor="addressStreet">
              Street Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="addressStreet"
              {...register("addressStreet")}
              placeholder="123 Main Street"
              aria-invalid={!!errors.addressStreet}
              className={cn(
                "mt-1.5",
                errors.addressStreet && "border-destructive"
              )}
            />
            {errors.addressStreet && (
              <p className="text-sm text-destructive mt-1.5" role="alert">
                {errors.addressStreet.message}
              </p>
            )}
          </div>

          {/* City */}
          <div>
            <Label htmlFor="addressCity">
              City <span className="text-destructive">*</span>
            </Label>
            <Input
              id="addressCity"
              {...register("addressCity")}
              placeholder="Los Angeles"
              aria-invalid={!!errors.addressCity}
              className={cn(
                "mt-1.5",
                errors.addressCity && "border-destructive"
              )}
            />
            {errors.addressCity && (
              <p className="text-sm text-destructive mt-1.5" role="alert">
                {errors.addressCity.message}
              </p>
            )}
          </div>

          {/* State & ZIP */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="addressState">State</Label>
              <Input
                id="addressState"
                {...register("addressState")}
                disabled
                className="mt-1.5 bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                California only
              </p>
            </div>

            <div>
              <Label htmlFor="addressZip">
                ZIP Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="addressZip"
                {...register("addressZip")}
                placeholder="90210"
                aria-invalid={!!errors.addressZip}
                className={cn(
                  "mt-1.5",
                  errors.addressZip && "border-destructive"
                )}
              />
              {errors.addressZip && (
                <p className="text-sm text-destructive mt-1.5" role="alert">
                  {errors.addressZip.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Billing Address Section */}
        <div className="pt-4 border-t space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="billingSameAsHome"
              checked={billingSameAsHome}
              onCheckedChange={(checked) =>
                setValue("billingSameAsHome", checked === true)
              }
            />
            <Label
              htmlFor="billingSameAsHome"
              className="text-sm font-normal cursor-pointer"
            >
              Billing address is the same as home address
            </Label>
          </div>

          <AnimatePresence>
            {!billingSameAsHome && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 overflow-hidden"
              >
                <h3 className="text-sm font-semibold text-gray-900">
                  Billing Address
                </h3>

                {/* Billing Street */}
                <div>
                  <Label htmlFor="billingStreet">
                    Street Address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="billingStreet"
                    {...register("billingStreet")}
                    placeholder="123 Main Street"
                    aria-invalid={!!errors.billingStreet}
                    className={cn(
                      "mt-1.5",
                      errors.billingStreet && "border-destructive"
                    )}
                  />
                  {errors.billingStreet && (
                    <p
                      className="text-sm text-destructive mt-1.5"
                      role="alert"
                    >
                      {errors.billingStreet.message}
                    </p>
                  )}
                </div>

                {/* Billing City */}
                <div>
                  <Label htmlFor="billingCity">
                    City <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="billingCity"
                    {...register("billingCity")}
                    placeholder="Los Angeles"
                    aria-invalid={!!errors.billingCity}
                    className={cn(
                      "mt-1.5",
                      errors.billingCity && "border-destructive"
                    )}
                  />
                  {errors.billingCity && (
                    <p
                      className="text-sm text-destructive mt-1.5"
                      role="alert"
                    >
                      {errors.billingCity.message}
                    </p>
                  )}
                </div>

                {/* Billing State & ZIP */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="billingState">
                      State <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="billingState"
                      {...register("billingState")}
                      placeholder="CA"
                      aria-invalid={!!errors.billingState}
                      className={cn(
                        "mt-1.5",
                        errors.billingState && "border-destructive"
                      )}
                    />
                    {errors.billingState && (
                      <p
                        className="text-sm text-destructive mt-1.5"
                        role="alert"
                      >
                        {errors.billingState.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="billingZip">
                      ZIP Code <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="billingZip"
                      {...register("billingZip")}
                      placeholder="90210"
                      aria-invalid={!!errors.billingZip}
                      className={cn(
                        "mt-1.5",
                        errors.billingZip && "border-destructive"
                      )}
                    />
                    {errors.billingZip && (
                      <p
                        className="text-sm text-destructive mt-1.5"
                        role="alert"
                      >
                        {errors.billingZip.message}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
