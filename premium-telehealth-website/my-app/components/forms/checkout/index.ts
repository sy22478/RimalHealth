// Barrel export for checkout form components
// Pattern FILE-001: Centralized exports for clean imports

export { CheckoutForm } from "./CheckoutForm";
export { CheckoutProvider, useCheckout } from "./CheckoutContext";
export { ProgressBar } from "./ProgressBar";
export { Step1Personal } from "./Step1Personal";
export { Step2Address } from "./Step2Address";
export { Step3Screening } from "./Step3Screening";
export { Step4Review } from "./Step4Review";

// Type exports
export type {
  CheckoutData,
  CheckoutStep,
  CheckoutContextType,
  Step1Data,
  Step2Data,
  Step3Data,
  Step4Data,
} from "./types";

export {
  checkoutSteps,
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  checkoutSchema,
  primaryConcernOptions,
  treatmentGoalOptions,
} from "./types";
