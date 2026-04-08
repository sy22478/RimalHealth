"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Lock, Shield, CreditCard } from "lucide-react";
import { TrustBadges } from "@/components/TrustBadges";

export default function PaymentClient() {
  const searchParams = useSearchParams();
  const planId = searchParams?.get("plan");
  const [isLoading, setIsLoading] = useState(false);

  // Plan details based on selection
  const planDetails = {
    "active-treatment": {
      name: "Active Treatment Plan",
      price: 50,
      period: "/month",
      features: [
        "Physician consultation & intake review",
        "Prescription management & e-prescribing",
        "24/7 secure messaging",
        "Monthly check-ins & adjustments",
        "Automatic refills",
      ],
    },
  };

  const selectedPlan = planId && planDetails[planId as keyof typeof planDetails] 
    ? planDetails[planId as keyof typeof planDetails] 
    : planDetails["active-treatment"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Stripe integration would go here
    // For now, just simulate a delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsLoading(false);
    // Redirect to intake form after successful payment
    window.location.href = "/get-started?subscribed=true";
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-20">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back link */}
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-ocean-600 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to pricing
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Payment Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-ocean-500/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-ocean-500" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Complete checkout</h1>
                  <p className="text-sm text-gray-600">Secure payment processing</p>
                </div>
              </div>

              {/* Plan Summary */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{selectedPlan.name}</span>
                  <span className="font-bold text-gray-900">
                    ${selectedPlan.price}<span className="text-gray-500 font-normal text-sm">{selectedPlan.period}</span>
                  </span>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  {selectedPlan.features.slice(0, 3).map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-1" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Payment Form Placeholder */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email address
                  </label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500/20 outline-none transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Card information
                  </label>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <input
                      type="text"
                      placeholder="Card number"
                      className="w-full px-4 py-3 border-b border-gray-200 outline-none"
                    />
                    <div className="flex">
                      <input
                        type="text"
                        placeholder="MM/YY"
                        className="flex-1 px-4 py-3 border-r border-gray-200 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="CVC"
                        className="w-24 px-4 py-3 outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name on card
                  </label>
                  <input
                    type="text"
                    placeholder="Full name"
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500/20 outline-none transition-all"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 bg-gradient-to-r from-navy-500 to-ocean-500 text-white font-semibold rounded-lg shadow-lg shadow-navy-500/20 hover:shadow-xl hover:shadow-navy-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Pay ${selectedPlan.price} and start treatment
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6">
                <TrustBadges />
              </div>
            </div>
          </motion.div>

          {/* Order Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:sticky lg:top-24 h-fit"
          >
            <div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8">
              <h2 className="text-lg font-bold text-gray-900 mb-6">Order summary</h2>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-ocean-500/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-ocean-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{selectedPlan.name}</p>
                    <p className="text-sm text-gray-600">Monthly subscription</p>
                  </div>
                  <span className="ml-auto font-medium">${selectedPlan.price}/mo</span>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4 mb-6">
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>Total today</span>
                  <span>${selectedPlan.price}.00</span>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  Then ${selectedPlan.price}/month. Cancel anytime.
                </p>
              </div>

              {/* Whats included */}
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <p className="font-medium text-gray-900 mb-3">What&apos;s included:</p>
                <ul className="space-y-2">
                  {selectedPlan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Security notice */}
              <div className="flex items-start gap-3 text-sm text-gray-600">
                <Shield className="w-5 h-5 text-ocean-500 flex-shrink-0" />
                <p>
                  Your payment information is securely processed. We use industry-standard 
                  encryption and never store your full card details.
                </p>
              </div>

              {/* Guarantee */}
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800">
                  <strong>30-day money-back guarantee:</strong> Not satisfied? 
                  Get a full refund within 30 days, no questions asked.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
