import Link from "next/link";
import { redirect } from "next/navigation";
import { IntakeForm } from "@/components/forms/IntakeForm";
import { TrustBadges } from "@/components/TrustBadges";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { ArrowRight, Lock, CreditCard, FileText } from "lucide-react";

export const metadata = {
  title: "Get Started | Rimal Health",
  description:
    "Complete your medical intake. A California-licensed physician will review within 24 hours.",
};

// In production, this would check for an active subscription in the database
// For now, we show the page with a notice about the payment workflow
export default function GetStartedPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Check if user has an active subscription (mock - would check session/database in production)
  const hasActiveSubscription = searchParams?.subscribed === "true";

  // If no subscription, show notice and link to pricing
  if (!hasActiveSubscription) {
    return (
      <div className="pt-28 pb-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          {/* Payment Required Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 md:p-12">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CreditCard className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Subscription required
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              To begin your treatment, please select a plan and complete checkout first. 
              Once your subscription is active, you&apos;ll be able to complete your medical intake.
            </p>

            {/* Steps */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left mb-8">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-ocean-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  1
                </div>
                <div>
                  <p className="font-medium text-gray-900">Choose plan</p>
                  <p className="text-sm text-gray-600">$50/month</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-ocean-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  2
                </div>
                <div>
                  <p className="font-medium text-gray-900">Checkout</p>
                  <p className="text-sm text-gray-600">Secure payment</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-ocean-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                  3
                </div>
                <div>
                  <p className="font-medium text-gray-900">Complete intake</p>
                  <p className="text-sm text-gray-600">10 minutes</p>
                </div>
              </div>
            </div>

            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-navy-500 to-ocean-500 text-white font-semibold rounded-lg shadow-lg shadow-navy-500/20 hover:shadow-xl hover:shadow-navy-500/30 hover:-translate-y-0.5 transition-all duration-200"
            >
              View Pricing & Plans
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          {/* Alternative: Already subscribed? */}
          <div className="mt-8 p-6 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-900">Already subscribed?</span>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              If you&apos;ve already completed checkout, please log in to access your intake form.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-ocean-600 font-medium hover:text-ocean-700 transition-colors"
            >
              Log in to your account
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // User has subscription - show the intake form
  return (
    <div className="pt-28 pb-20 px-4">
      <div className="max-w-xl mx-auto text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-600 mb-6">
          <FileText className="w-4 h-4" />
          Subscription active
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Complete your medical intake
        </h1>
        <p className="text-lg text-gray-600">
          Fill out this form in about 10 minutes. A California-licensed
          physician will review your intake within 24 hours.
        </p>
        <div className="mt-6">
          <TrustBadges />
        </div>
      </div>

      <IntakeForm 
        primaryConcern="ALCOHOL"
        treatmentGoal="QUIT"
      />

      <div className="max-w-xl mx-auto mt-12">
        <MedicalDisclaimer />
      </div>
    </div>
  );
}
