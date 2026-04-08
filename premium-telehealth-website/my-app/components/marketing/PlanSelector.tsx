"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

interface PlanSelectorProps {
  plans: Plan[];
  onSelect?: (planId: string) => void;
}

export function PlanSelector({ plans, onSelect }: PlanSelectorProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleSelect = (planId: string) => {
    setSelectedPlan(planId);
    onSelect?.(planId);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
      {plans.map((plan, index) => (
        <motion.div
          key={plan.id}
          className={`relative rounded-2xl p-6 cursor-pointer transition-all duration-200 ${
            selectedPlan === plan.id
              ? "bg-white border-2 border-ocean-500 shadow-xl shadow-ocean-500/10"
              : plan.highlighted
              ? "bg-white border-2 border-ocean-500/50 shadow-lg hover:shadow-xl"
              : "bg-white border-2 border-gray-200 hover:border-gray-300"
          }`}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: index * 0.1, ease: "easeOut" }}
          onClick={() => handleSelect(plan.id)}
          role="radio"
          aria-checked={selectedPlan === plan.id}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleSelect(plan.id);
            }
          }}
        >
          {/* Badge */}
          {plan.badge && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-ocean-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                {plan.badge}
              </span>
            </div>
          )}

          {/* Selection indicator */}
          <div className="absolute top-4 right-4">
            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                selectedPlan === plan.id
                  ? "bg-ocean-500 border-ocean-500"
                  : "border-gray-300"
              }`}
            >
              {selectedPlan === plan.id && (
                <Check className="w-4 h-4 text-white" />
              )}
            </div>
          </div>

          {/* Plan header */}
          <div className="mb-4">
            <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-4xl font-bold text-gray-900">
                ${plan.price}
              </span>
              <span className="text-gray-500">{plan.period}</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">{plan.description}</p>
          </div>

          {/* Features */}
          <ul className="space-y-2 mb-6">
            {plan.features.map((feature, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-ocean-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">{feature}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      ))}

      {/* Continue button */}
      {selectedPlan && (
        <motion.div
          className="md:col-span-2 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link
            href={`/payment?plan=${selectedPlan}`}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-ocean-500 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all duration-200"
          >
            Continue with selected plan
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      )}
    </div>
  );
}

// Default plans for Rimal Health
export const rimalPlans: Plan[] = [
  {
    id: "active-treatment",
    name: "Active Treatment Plan",
    price: 50,
    period: "/month",
    description: "For patients currently in treatment",
    highlighted: true,
    badge: "Most Popular",
    features: [
      "Physician consultation & intake review",
      "Prescription management & e-prescribing",
      "24/7 secure messaging with your doctor",
      "Treatment progress tracking",
      "Monthly check-ins & adjustments",
      "Automatic prescription refills",
      "Cancel anytime",
    ],
  },
];
