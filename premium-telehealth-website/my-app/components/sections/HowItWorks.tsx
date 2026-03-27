"use client";

import { motion } from "framer-motion";
import { Sparkles, CreditCard, FileText, UserCheck, Pill } from "lucide-react";
import { SectionWrapper } from "@/components/sections/SectionWrapper";

const steps = [
  {
    number: "01",
    title: "Choose your plan",
    description: "Select the Active Treatment Plan that fits your needs. $50/month, cancel anytime.",
    icon: Sparkles,
    accent: "from-ocean-500/10 to-blue-500/10",
    iconColor: "text-ocean-500",
    ringColor: "ring-ocean-500/20",
  },
  {
    number: "02",
    title: "Complete checkout",
    description: "Secure payment processing. Use credit card, HSA, or FSA funds.",
    icon: CreditCard,
    accent: "from-blue-500/10 to-indigo-500/10",
    iconColor: "text-blue-500",
    ringColor: "ring-blue-500/20",
  },
  {
    number: "03",
    title: "Fill out intake",
    description: "Complete your medical questionnaire in about 10 minutes — on your schedule, no appointment needed.",
    icon: FileText,
    accent: "from-indigo-500/10 to-purple-500/10",
    iconColor: "text-indigo-500",
    ringColor: "ring-indigo-500/20",
  },
  {
    number: "04",
    title: "Physician reviews",
    description: "A California-licensed physician reviews your intake within 24 hours and approves your treatment.",
    icon: UserCheck,
    accent: "from-purple-500/10 to-emerald-500/10",
    iconColor: "text-purple-500",
    ringColor: "ring-purple-500/20",
  },
  {
    number: "05",
    title: "Start treatment",
    description: "Prescription sent to your pharmacy. Pick up your medication and begin your journey.",
    icon: Pill,
    accent: "from-emerald-500/10 to-ocean-500/10",
    iconColor: "text-emerald-500",
    ringColor: "ring-emerald-500/20",
  },
];

export function HowItWorks() {
  return (
    <section className="bg-white">
      <SectionWrapper>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ocean-500/10 border border-ocean-500/20 text-sm font-semibold text-ocean-600 mb-6">
            How It Works
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            Start treatment in 5 simple steps
          </h2>
          <p className="text-lg text-gray-600 mt-4 max-w-2xl mx-auto">
            From plan selection to pharmacy pickup — we&apos;ve streamlined the process so you can focus on your recovery
          </p>
        </motion.div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="relative">
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.55, delay: index * 0.1, ease: "easeOut" }}
                  className="group relative bg-white border border-gray-100 rounded-2xl p-6 hover:border-gray-200 hover:shadow-[0_8px_30px_rgba(15,23,42,0.07)] transition-all duration-300 h-full"
                >
                  {/* Step number — decorative, top-right */}
                  <span className="absolute top-4 right-4 text-3xl font-black text-gray-100 select-none leading-none">
                    {step.number}
                  </span>

                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.accent} ring-1 ${step.ringColor} flex items-center justify-center mb-4`}>
                    <Icon className={step.iconColor} size={22} />
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                </motion.div>

                {/* Connector arrow — desktop only, except for last item */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:flex absolute top-10 left-[calc(100%+0.5rem)] w-6 items-center justify-center pointer-events-none z-10">
                    <svg className="w-5 h-5 text-gray-200" fill="none" viewBox="0 0 32 32">
                      <path d="M6 16h20M20 10l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}

                {/* Mobile vertical connector - shown between steps */}
                {index < steps.length - 1 && (
                  <div className="lg:hidden flex justify-center py-2">
                    <div className="w-0.5 h-8 bg-gradient-to-b from-ocean-300 to-ocean-100 rounded-full" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Payment indicator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-emerald-700">
              Payment required before intake • Cancel anytime
            </span>
          </div>
        </motion.div>
      </SectionWrapper>
    </section>
  );
}
