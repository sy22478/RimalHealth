import type { Metadata } from "next";
import { SignUpForm } from "@/components/forms/SignUpForm";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your Rimal Health account to start your addiction treatment journey.",
};

export default function SignUpPage() {
  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-navy-800 mb-2">
          Create Your Account
        </h1>
        <p className="text-muted-foreground">
          Start your journey to recovery with personalized treatment
        </p>
      </div>

      {/* HIPAA Notice */}
      <div className="mb-6 p-4 rounded-lg bg-ocean-50 border border-ocean-100">
        <p className="text-sm text-navy-700">
          <span className="font-semibold">🔒 HIPAA Compliant:</span>{" "}
          Your information is encrypted and securely stored. We never share your 
          data without your consent.
        </p>
      </div>

      {/* Sign Up Form */}
      <SignUpForm />

      {/* Trust Badges */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <svg className="size-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          SSL Encrypted
        </span>
        <span className="flex items-center gap-1">
          <svg className="size-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          HIPAA Compliant
        </span>
        <span className="flex items-center gap-1">
          <svg className="size-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          California Only
        </span>
      </div>
    </div>
  );
}
