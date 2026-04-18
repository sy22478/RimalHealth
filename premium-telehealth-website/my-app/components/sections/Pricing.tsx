"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Link from "next/link";
import { SectionWrapper } from "@/components/sections/SectionWrapper";

export function Pricing() {
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
          Simple pricing
        </h2>
        <p className="text-lg md:text-xl text-gray-600">
          No hidden fees. Cancel anytime.
        </p>
      </motion.div>

      <div className="flex justify-center">
        {/* Active Treatment Plan */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="border-2 border-ocean-500 rounded-xl p-8 md:p-10 bg-white relative w-full max-w-sm"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Active Treatment
          </h3>

          <div className="mb-2">
            <span className="text-5xl font-bold text-gray-900">$50</span>
            <span className="text-lg text-gray-600">/month</span>
          </div>

          <p className="text-sm text-gray-600 mt-2 mb-8">During treatment</p>

          <ul className="space-y-2">
            <li className="flex items-center gap-3 text-base text-gray-900 py-2">
              <Check className="text-emerald-500 flex-shrink-0" size={18} />
              <span>Physician intake review</span>
            </li>
            <li className="flex items-center gap-3 text-base text-gray-900 py-2">
              <Check className="text-emerald-500 flex-shrink-0" size={18} />
              <span>Prescription management</span>
            </li>
            <li className="flex items-center gap-3 text-base text-gray-900 py-2">
              <Check className="text-emerald-500 flex-shrink-0" size={18} />
              <span>Unlimited messaging</span>
            </li>
            <li className="flex items-center gap-3 text-base text-gray-900 py-2">
              <Check className="text-emerald-500 flex-shrink-0" size={18} />
              <span>Medication refills</span>
            </li>
            <li className="flex items-center gap-3 text-base text-gray-900 py-2">
              <Check className="text-emerald-500 flex-shrink-0" size={18} />
              <span>Adjustments included</span>
            </li>
          </ul>

          <Link href="/checkout/consent?plan=active-treatment" className="btn-primary w-full mt-8 block text-center">
            Get Started
          </Link>
        </motion.div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="text-sm text-gray-600 text-center mt-8"
      >
        Medication costs separate: typically $10–50/month with insurance
      </motion.p>
    </SectionWrapper>
  );
}
