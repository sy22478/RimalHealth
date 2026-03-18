import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/forms/LoginForm";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Rimal Health account to access your treatment plan and messages.",
};

export default function LoginPage() {
  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-navy-800 mb-2">
          Welcome Back
        </h1>
        <p className="text-muted-foreground">
          Sign in to continue your treatment journey
        </p>
      </div>

      {/* Login Form */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>

      {/* Help Section */}
      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          Having trouble signing in?{" "}
          <a 
            href="mailto:support@rimalhealth.com" 
            className="text-ocean-600 hover:text-ocean-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Contact Support
          </a>
        </p>
      </div>

      {/* Trust Badges */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <svg className="size-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Secure Login
        </span>
        <span className="flex items-center gap-1">
          <svg className="size-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Protected Data
        </span>
      </div>
    </div>
  );
}
