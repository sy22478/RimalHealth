"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Link from "next/link";
import { SectionWrapper } from "@/components/sections/SectionWrapper";
import { TrustBadges } from "@/components/TrustBadges";
import { getPlans } from "@/lib/stripe/stripe-client";

// Map each plan to its product-gated consent funnel (one shared funnel with
// the rest of the marketing CTAs). GLP-1 uses the lowercase product slug.
const PLAN_CTA: Record<string, { href: string; label: string }> = {
  ACTIVE_TREATMENT: {
    href: "/checkout/consent?plan=active-treatment",
    label: "Get Started — $50/month",
  },
  WEIGHT_MANAGEMENT: {
    href: "/checkout/consent?plan=weight-management&product=weight-management",
    label: "Get Started — $50/month",
  },
};

export function Pricing() {
  const plans = getPlans();

  return (
    <SectionWrapper className="bg-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-center mb-14"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Simple pricing — two treatments
        </h2>
        <p className="text-lg md:text-xl text-gray-600">
          One flat fee per treatment. No hidden fees. Cancel anytime.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
        {plans.map((plan, index) => {
          const cta = PLAN_CTA[plan.id];
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 + index * 0.1 }}
              className="border-2 border-ocean-500 rounded-xl p-8 md:p-10 bg-white relative flex flex-col"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {plan.name}
              </h3>

              <div className="mb-2">
                <span className="text-5xl font-bold text-gray-900">{plan.formattedAmount}</span>
                <span className="text-lg text-gray-600">/{plan.interval}</span>
              </div>

              <p className="text-sm text-gray-600 mt-2 mb-8">{plan.description}</p>

              <ul className="space-y-2 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-base text-gray-900 py-2">
                    <Check className="text-emerald-500 flex-shrink-0 mt-0.5" size={18} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href={cta.href} className="btn-primary w-full mt-8 block text-center">
                {cta.label}
              </Link>
            </motion.div>
          );
        })}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="text-sm text-gray-600 text-center mt-8"
      >
        Medication is billed separately at your pharmacy and varies by treatment.
      </motion.p>

      <div className="mt-10 flex justify-center">
        <TrustBadges />
      </div>
    </SectionWrapper>
  );
}
