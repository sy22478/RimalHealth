"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, X, ArrowRight, Pill, Clock, MessageSquare, ShieldCheck } from "lucide-react";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { SectionWrapper } from "@/components/sections/SectionWrapper";

export default function AlcoholTreatmentPage() {
  return (
    <>
        {/* Hero Section */}
        <SectionWrapper className="pt-28 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[70vh]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" as const }}
            >
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
                Medication to quit or reduce drinking
              </h1>
              {/* TASK-A01: physician-prescribed + California-licensed qualifier */}
              <p className="text-lg text-gray-600 mt-4">
                Physician-prescribed Naltrexone, Acamprosate, or Disulfiram. California-licensed physician review. $50/month.
              </p>
              {/* TASK-B03: geographic restriction near primary CTA */}
              <p className="text-sm text-gray-500 mt-2">
                Currently serving California residents only. Patient must be physically located in California during each visit.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mt-8">
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-navy-500 to-ocean-500 text-white font-semibold rounded-lg hover:shadow-lg transition-shadow"
                >
                  Start treatment — $50/month
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-200 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                >
                  View pricing
                </Link>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" as const }}
              className="bg-gradient-to-br from-ocean-500/10 to-blue-500/10 rounded-2xl p-8 md:p-10"
            >
              <div className="text-sm font-semibold uppercase tracking-wide text-ocean-600 mb-4">
                What&apos;s included
              </div>
              <ul className="space-y-4">
                {[
                  {
                    icon: Pill,
                    title: "Physician-selected medication",
                    detail:
                      "Naltrexone, Acamprosate, or Disulfiram — chosen by a California-licensed physician.",
                  },
                  {
                    icon: Clock,
                    title: "Prescription in 24 hours",
                    detail:
                      "Asynchronous review. No appointments, no video calls.",
                  },
                  {
                    icon: MessageSquare,
                    title: "Unlimited physician messaging",
                    detail:
                      "Follow-up questions, dose adjustments, and refills included.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "HIPAA-compliant & confidential",
                    detail:
                      "42 CFR Part 2 protections for all substance-use records.",
                  },
                ].map((item) => (
                  <li key={item.title} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                      <item.icon className="w-5 h-5 text-ocean-500" />
                    </div>
                    <div>
                      <div className="text-base font-semibold text-gray-900">
                        {item.title}
                      </div>
                      <div className="text-sm text-gray-600 mt-0.5">
                        {item.detail}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </SectionWrapper>

        {/* Statistics Section */}
        <SectionWrapper className="py-16 bg-gray-50">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut" as const }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {[
              /* Source: SAMHSA NSDUH 2022 State Tables — California, Table 5.7B */
              {
                value: "2.1 million",
                label: "Californians with alcohol use disorder",
              },
              /* Source: COMBINE study, Anton et al., JAMA 2006; doi:10.1001/jama.295.17.2003 */
              {
                value: "75%",
                /* TASK-A02: clarify the stat refers to medication-assisted treatment */
                label: "average reduction in drinks per week after 12 months with medication",
              },
              /* Source: SAMHSA NSDUH 2022 State Tables — California */
              {
                value: "Less than 8%",
                label: "currently receive treatment",
              },
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                  ease: "easeOut" as const,
                }}
                className="bg-white border border-gray-200 rounded-xl p-8 text-center"
              >
                <div className="text-3xl md:text-4xl font-bold text-gray-900">
                  {stat.value}
                </div>
                <div className="text-base text-gray-600 mt-2">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </SectionWrapper>

        {/* How It Works Section */}
        <SectionWrapper className="py-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut" as const }}
            className="text-3xl md:text-4xl font-bold text-center mb-12"
          >
            How alcohol treatment works
          </motion.h2>
          <div className="max-w-3xl mx-auto space-y-8">
            {[
              {
                number: 1,
                title: "Complete intake",
                description:
                  "Answer questions about your drinking patterns, medical history, and goals.",
              },
              {
                number: 2,
                /* TASK-A09, TASK-C01: physician-prescribed language */
                title: "Physician prescribes medication",
                description:
                  "Naltrexone, Acamprosate, or Disulfiram chosen based on your needs. Prescription sent to pharmacy in 24 hours.",
              },
              {
                number: 3,
                title: "Start reducing cravings",
                /* TASK-A09, TASK-B01: clarify pharmacy insurance vs. service fee */
                description:
                  "Pick up medication at your pharmacy (pharmacy may bill your insurance separately). Most patients notice reduced cravings within 1–2 weeks.",
              },
              {
                number: 4,
                title: "Ongoing support",
                /* TASK-C01: physician not doctor */
                description:
                  "Message your physician anytime. Refills automatic. Adjust medications as needed.",
              },
            ].map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                  ease: "easeOut" as const,
                }}
                className="flex gap-4 items-start"
              >
                <div className="w-8 h-8 rounded-full bg-ocean-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {step.number}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {step.title}
                  </h3>
                  <p className="text-base text-gray-600 mt-1">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </SectionWrapper>

        {/* Medications Section */}
        <SectionWrapper className="py-20 bg-gray-50">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut" as const }}
            className="text-3xl md:text-4xl font-bold text-center mb-12"
          >
            Medications for alcohol treatment
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: "Naltrexone",
                howItWorks:
                  "Blocks the euphoric effects of alcohol, making drinking less pleasurable and reducing cravings.",
                bestFor:
                  "People who want to reduce or quit drinking. Works well for both moderation and abstinence goals.",
                dosage: "50mg daily (oral) or 380mg monthly (injection)",
                /* TASK-A03, TASK-B01: pharmacy billing clarification */
                cost: "$10–40/month at pharmacy (pharmacy may bill your insurance separately)",
              },
              {
                name: "Acamprosate",
                howItWorks:
                  "Reduces withdrawal symptoms and helps maintain abstinence by normalizing brain chemistry disrupted by alcohol.",
                bestFor:
                  "People committed to complete abstinence who struggle with cravings and withdrawal.",
                dosage: "666mg three times daily",
                /* TASK-A04, TASK-B01: pharmacy billing clarification */
                cost: "$15–50/month at pharmacy (pharmacy may bill your insurance separately)",
              },
              {
                name: "Disulfiram",
                howItWorks:
                  "Causes unpleasant reaction (nausea, flushing) if you drink alcohol. Acts as a deterrent.",
                bestFor:
                  "Highly motivated individuals who want an extra layer of accountability.",
                dosage: "250mg daily",
                /* TASK-A05, TASK-B01: pharmacy billing clarification */
                cost: "$10–30/month at pharmacy (pharmacy may bill your insurance separately)",
              },
            ].map((med, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1,
                  ease: "easeOut" as const,
                }}
                className="bg-white border border-gray-200 rounded-xl p-6 md:p-8"
              >
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  {med.name}
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-1">
                      How it works:
                    </div>
                    <p className="text-sm text-gray-600">{med.howItWorks}</p>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-1">
                      Best for:
                    </div>
                    <p className="text-sm text-gray-600">{med.bestFor}</p>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-1">
                      Dosage:
                    </div>
                    <p className="text-sm text-gray-600">{med.dosage}</p>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 mb-1">
                      Typical cost:
                    </div>
                    <p className="text-sm text-gray-600">{med.cost}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </SectionWrapper>

        {/* Flexible Goals Section */}
        <SectionWrapper className="py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut" as const }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Your goal, your choice
            </h2>
            <p className="text-lg text-gray-600 mt-4">
              We support both complete abstinence and harm reduction.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: "easeOut" as const }}
              className="bg-white border border-gray-200 rounded-xl p-6 md:p-8"
            >
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                Complete sobriety
              </h3>
              <p className="text-base text-gray-600 mb-4">
                Stop drinking entirely. Best for severe dependence or when
                health requires it.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mt-4">
                <div className="text-sm font-semibold text-gray-900 mb-1">
                  Recommended medication:
                </div>
                <p className="text-sm text-gray-600">
                  Naltrexone or Acamprosate
                </p>
              </div>
              {/* TASK-A06, TASK-C03: hedge the outcome stat */}
              {/* Source: COMBINE study + Krystal et al. NEJM 2001; doi:10.1056/NEJM200112063452301 */}
              <div className="mt-4">
                <div className="text-lg font-bold text-ocean-500">
                  In clinical studies, up to 65% of patients maintained abstinence at 12 months.
                </div>
                <div className="text-sm text-gray-500 mt-1">Results vary. Individual outcomes depend on treatment adherence and personal factors.</div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.5,
                delay: 0.1,
                ease: "easeOut" as const,
              }}
              className="bg-white border border-gray-200 rounded-xl p-6 md:p-8"
            >
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                Reduce drinking
              </h3>
              <p className="text-base text-gray-600 mb-4">
                Cut back to healthy levels. Drink occasionally in social
                settings without excess.
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mt-4">
                <div className="text-sm font-semibold text-gray-900 mb-1">
                  Recommended medication:
                </div>
                <p className="text-sm text-gray-600">Naltrexone</p>
              </div>
              {/* TASK-A06, TASK-C03: hedge the outcome stat */}
              {/* Source: COMBINE study, Anton et al., JAMA 2006; doi:10.1001/jama.295.17.2003 */}
              <div className="mt-4">
                <div className="text-lg font-bold text-ocean-500">
                  Many patients experience up to 75% reduction in drinks per week at 12 months.
                </div>
                <div className="text-sm text-gray-500 mt-1">Individual results vary.</div>
              </div>
            </motion.div>
          </div>
        </SectionWrapper>

        {/* Timeline Section */}
        <SectionWrapper className="py-20 bg-gray-50">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut" as const }}
            className="text-3xl md:text-4xl font-bold text-center mb-12"
          >
            What to expect: Your first 12 weeks
          </motion.h2>
          <div className="max-w-5xl mx-auto">
            <div className="hidden md:flex justify-between items-start relative">
              {/* Connecting line */}
              <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-200 z-0" />
              {[
                {
                  week: "Week 1",
                  title: "Start medication",
                  detail: "Notice initial effects",
                },
                {
                  week: "Week 4",
                  title: "Reduced cravings",
                  detail: "New habits forming",
                },
                {
                  week: "Week 8",
                  title: "Significant improvement",
                  /* TASK-A07, TASK-C03: hedge the 75% milestone */
                  detail: "Up to 75% reduction for many patients",
                },
                {
                  week: "Week 12",
                  title: "Sustained progress",
                  detail: "Long-term success",
                },
              ].map((milestone, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.5,
                    delay: index * 0.1,
                    ease: "easeOut" as const,
                  }}
                  className="flex flex-col items-center relative z-10 flex-1"
                >
                  <div className="w-3 h-3 rounded-full bg-ocean-500 mb-4" />
                  <div className="text-sm font-semibold text-gray-900 text-center">
                    {milestone.week}
                  </div>
                  <div className="text-sm text-gray-600 text-center mt-1">
                    {milestone.title}
                  </div>
                  <div className="text-sm text-gray-600 text-center">
                    {milestone.detail}
                  </div>
                </motion.div>
              ))}
            </div>
            {/* Mobile view */}
            <div className="flex md:hidden flex-col space-y-6">
              {[
                {
                  week: "Week 1",
                  title: "Start medication",
                  detail: "Notice initial effects",
                },
                {
                  week: "Week 4",
                  title: "Reduced cravings",
                  detail: "New habits forming",
                },
                {
                  week: "Week 8",
                  title: "Significant improvement",
                  /* TASK-A07, TASK-C03: hedge the 75% milestone */
                  detail: "Up to 75% reduction for many patients",
                },
                {
                  week: "Week 12",
                  title: "Sustained progress",
                  detail: "Long-term success",
                },
              ].map((milestone, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.5,
                    delay: index * 0.1,
                    ease: "easeOut" as const,
                  }}
                  className="flex items-start gap-4"
                >
                  <div className="w-3 h-3 rounded-full bg-ocean-500 mt-1 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {milestone.week}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {milestone.title}
                    </div>
                    <div className="text-sm text-gray-600">
                      {milestone.detail}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </SectionWrapper>

        {/* Who It's For Section */}
        <SectionWrapper className="py-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut" as const }}
            className="text-3xl md:text-4xl font-bold text-center mb-12"
          >
            Who this is for
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, ease: "easeOut" as const }}
              className="bg-white border-2 border-emerald-500/20 rounded-xl p-6 md:p-8"
            >
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">
                Good fit
              </h3>
              <ul className="space-y-4">
                {[
                  "Mild to moderate alcohol use disorder",
                  "Motivated to change drinking habits",
                  /* TASK-A08: add no acute withdrawal risk qualifier */
                  "Can safely reduce at home (no acute withdrawal risk)",
                  "Stable living situation",
                  "California resident",
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span className="text-base text-gray-600">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.5,
                delay: 0.1,
                ease: "easeOut" as const,
              }}
              className="bg-white border border-gray-200 rounded-xl p-6 md:p-8"
            >
              <h3 className="text-2xl font-semibold text-gray-900 mb-6">
                Not a good fit
              </h3>
              <ul className="space-y-4">
                {[
                  /* TASK-A08: spell out DTs in full */
                  "Severe withdrawal symptoms (seizures, delirium tremens)",
                  "Need medical detox supervision",
                  "Unstable housing",
                  "Active suicidal ideation",
                  "Require 24/7 medical care",
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <X className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="text-base text-gray-600">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.5,
              delay: 0.2,
              ease: "easeOut" as const,
            }}
            className="text-base text-gray-600 text-center mt-8 italic max-w-3xl mx-auto"
          >
            {/* TASK-A08, TASK-C01: physician not doctor */}
            Not sure? Fill out intake — our physician will determine if our
            program is right for you or recommend alternatives.
          </motion.p>
          {/* TASK-C05: Emergency protocol notice */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              duration: 0.5,
              delay: 0.3,
              ease: "easeOut" as const,
            }}
            className="mt-6 max-w-3xl mx-auto bg-amber-50 border border-amber-200 rounded-xl p-6"
          >
            <p className="text-sm font-semibold text-amber-800 mb-1">Emergency Notice</p>
            <p className="text-sm text-amber-700">
              Rimal Health is not an emergency service. If you are experiencing a medical emergency, severe withdrawal, chest pain, suicidal thoughts, or signs of overdose, call 911 immediately or go to your nearest emergency room.
            </p>
          </motion.div>
        </SectionWrapper>

        {/* Pricing Reminder Card */}
        <SectionWrapper className="py-20 bg-gray-50">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut" as const }}
            className="max-w-xl mx-auto bg-white border-2 border-ocean-500 rounded-xl p-8 md:p-12 text-center"
          >
            <div className="text-4xl font-bold text-gray-900 mb-4">
              $50/month during treatment
            </div>
            {/* TASK-A10, TASK-C01: physician not doctor */}
            <p className="text-base text-gray-600 mb-4">
              Includes physician review, prescription management, unlimited messaging, refills, and adjustments.
            </p>
            {/* TASK-B02: membership exclusions */}
            <p className="text-sm text-gray-500 mb-2">
              Also includes: follow-up visits every 1–3 months, secure messaging, and care coordination.
            </p>
            <p className="text-sm text-gray-500 mb-2">
              Not included: medication costs, laboratory fees, outside specialist services, or emergency care.
            </p>
            {/* TASK-A10, TASK-B01: cash-pay model + pharmacy insurance clarification */}
            <p className="text-sm text-gray-600 mb-2">
              Medications billed separately at your pharmacy (pharmacy may bill your insurance). Costs vary by medication type.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Our service fee is cash-pay. Superbill available for out-of-network reimbursement — reimbursement not guaranteed and varies by plan. Cancel anytime. No long-term contracts.
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-navy-500 to-ocean-500 text-white font-semibold rounded-lg hover:shadow-lg transition-shadow"
            >
              Get started
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </SectionWrapper>

        {/* Final CTA */}
        <SectionWrapper className="py-20 bg-gradient-to-b from-gray-50 to-white text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut" as const }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Start reducing your drinking today
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Prescription ready in 24 hours
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-navy-500 to-ocean-500 text-white font-semibold rounded-lg hover:shadow-lg transition-shadow text-lg"
            >
              Start treatment — $50/month
              <ArrowRight className="w-6 h-6" />
            </Link>
          </motion.div>
        </SectionWrapper>

      {/* Medical Disclaimer */}
      {/* TASK-C02: verified present — required on all treatment pages */}
      <MedicalDisclaimer />
    </>
  );
}
