"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Check,
  ArrowRight,
  Syringe,
  MessageSquare,
  Stethoscope,
  Activity,
} from "lucide-react";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { SectionWrapper } from "@/components/sections/SectionWrapper";
import { TrustBadges } from "@/components/TrustBadges";

// NOTE: Every efficacy claim, statistic, and safety statement on this page is
// PLACEHOLDER copy that REQUIRES medical + legal/marketing sign-off before
// go-live (FDA promotional rules for prescription drugs + FTC truth-in-
// advertising). No statistics are fabricated — numeric values are TODO markers.
export default function WeightManagementPage() {
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
            {/* TODO(legal/medical): headline + all claims require sign-off */}
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
              Physician-prescribed weight management with Wegovy
            </h1>
            <p className="text-lg text-gray-600 mt-4">
              Wegovy (semaglutide), a once-weekly GLP-1 injection. California-licensed
              physician review. $50/month.
            </p>
            {/* Geographic restriction near primary CTA */}
            <p className="text-sm text-gray-600 mt-2">
              Currently serving California residents only. Patient must be physically
              located in California during each visit.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link
                href="/checkout/consent?plan=weight-management&product=weight-management"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-navy-600 to-ocean-500 text-white font-semibold rounded-lg hover:shadow-lg transition-shadow"
              >
                Get Started — $50/month
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
                  icon: Stethoscope,
                  title: "Physician evaluation",
                  detail:
                    "Eligibility and medical review by a California-licensed physician.",
                },
                {
                  icon: Syringe,
                  title: "Personalized dosing",
                  detail:
                    "Your physician guides your dose as part of your treatment plan.",
                },
                {
                  icon: Activity,
                  title: "Ongoing monitoring",
                  detail:
                    "Follow-up and check-ins throughout your weight-management journey.",
                },
                {
                  icon: MessageSquare,
                  title: "Medication management",
                  detail:
                    "Unlimited physician messaging for questions and adjustments.",
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

      {/* Statistics Section — HIDDEN until real, sourced figures are signed off.
          Previously rendered literal "TODO%" placeholder stat cards publicly.
          Restore this section (with cited, legal/medical-approved statistics)
          post legal/medical sign-off. Do NOT publish fabricated numbers. */}

      {/* How It Works Section */}
      <SectionWrapper className="py-20">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" as const }}
          className="text-3xl md:text-4xl font-bold text-center mb-12"
        >
          How weight management works
        </motion.h2>
        <div className="max-w-3xl mx-auto space-y-8">
          {[
            {
              number: 1,
              title: "Complete intake",
              description:
                "Answer questions about your weight history, medical history, and goals.",
            },
            {
              number: 2,
              title: "Physician evaluation",
              description:
                "A California-licensed physician reviews your eligibility, including BMI and medical history.",
            },
            {
              number: 3,
              /* TODO(legal/medical): prescription/dispensing claim requires sign-off */
              title: "Physician prescribes Wegovy",
              description:
                "If appropriate, Wegovy is prescribed and sent to your pharmacy. Pharmacy may bill your insurance separately.",
            },
            {
              number: 4,
              title: "Ongoing care",
              description:
                "Message your physician anytime. Your physician guides dose adjustments and monitors your progress.",
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

      {/* About Wegovy Section — single medication */}
      <SectionWrapper className="py-20 bg-gray-50">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" as const }}
          className="text-3xl md:text-4xl font-bold text-center mb-12"
        >
          About Wegovy
        </motion.h2>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" as const }}
          className="bg-white border border-gray-200 rounded-xl p-6 md:p-8 max-w-xl mx-auto"
        >
          <h3 className="text-2xl font-semibold text-gray-900 mb-4">
            Wegovy (Semaglutide)
          </h3>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-gray-900 mb-1">
                How it works:
              </div>
              {/* TODO(legal/medical): mechanism claim requires sign-off */}
              <p className="text-sm text-gray-600">
                Semaglutide is a GLP-1 receptor agonist that mimics a hormone
                involved in regulating appetite and food intake.
              </p>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900 mb-1">
                Best for:
              </div>
              {/* TODO(legal/medical): eligibility framing requires sign-off */}
              <p className="text-sm text-gray-600">
                Adults who meet FDA BMI criteria for chronic weight management,
                as determined by a physician.
              </p>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900 mb-1">
                Dosage:
              </div>
              <p className="text-sm text-gray-600">
                Once-weekly subcutaneous injection.
              </p>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900 mb-1">
                Typical cost:
              </div>
              <p className="text-sm text-gray-600">
                $50/month physician management. Medication billed separately at
                your pharmacy (pharmacy may bill your insurance).
              </p>
            </div>
          </div>
        </motion.div>
      </SectionWrapper>

      {/* What to Expect / Timeline Section */}
      <SectionWrapper className="py-20">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" as const }}
          className="text-3xl md:text-4xl font-bold text-center mb-12"
        >
          What to expect
        </motion.h2>
        <div className="max-w-5xl mx-auto">
          {/* TODO(legal/medical): timeline framing requires sign-off. Exact
              titration schedule intentionally omitted — your physician guides
              your dosing (automated titration is a later phase). */}
          <div className="hidden md:flex justify-between items-start relative">
            <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-200 z-0" />
            {[
              {
                phase: "Initial consult",
                title: "Physician evaluation",
                detail: "Eligibility and medical review",
              },
              {
                phase: "Dose titration",
                title: "Gradual dose increases",
                detail:
                  "Your physician increases your dose over several weeks toward your maintenance dose",
              },
              {
                phase: "Maintenance",
                title: "Ongoing management",
                detail: "Continued monitoring and support",
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
                  {milestone.phase}
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
                phase: "Initial consult",
                title: "Physician evaluation",
                detail: "Eligibility and medical review",
              },
              {
                phase: "Dose titration",
                title: "Gradual dose increases",
                detail:
                  "Your physician increases your dose over several weeks toward your maintenance dose",
              },
              {
                phase: "Maintenance",
                title: "Ongoing management",
                detail: "Continued monitoring and support",
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
                    {milestone.phase}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {milestone.title}
                  </div>
                  <div className="text-sm text-gray-600">{milestone.detail}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </SectionWrapper>

      {/* Who It's For Section */}
      <SectionWrapper className="py-20 bg-gray-50">
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
              May be a good fit
            </h3>
            <ul className="space-y-4">
              {[
                /* FDA-approved indication (not a clinical invention) — confirm framing. */
                "BMI of 30 or higher",
                "BMI of 27 or higher with a weight-related condition (e.g. high blood pressure)",
                "Committed to reduced-calorie diet and increased physical activity",
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
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" as const }}
            className="bg-white border border-gray-200 rounded-xl p-6 md:p-8"
          >
            <h3 className="text-2xl font-semibold text-gray-900 mb-6">
              Not a good fit
            </h3>
            <ul className="space-y-4">
              {[
                /* TODO(medical): confirm exclusion list against clinical-config contraindications */
                "Personal or family history of medullary thyroid carcinoma (MTC)",
                "Multiple endocrine neoplasia syndrome type 2 (MEN2)",
                "History of pancreatitis",
                "Pregnant or trying to conceive",
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="w-5 h-5 flex-shrink-0 mt-0.5 text-gray-400">
                    &times;
                  </span>
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
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" as const }}
          className="text-base text-gray-600 text-center mt-8 italic max-w-3xl mx-auto"
        >
          Not sure? Complete the intake — our physician will determine whether
          this program is right for you or recommend alternatives.
        </motion.p>
        {/* Emergency Notice — tailored to GLP-1 risks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" as const }}
          className="mt-6 max-w-3xl mx-auto bg-amber-50 border border-amber-200 rounded-xl p-6"
        >
          <p className="text-sm font-semibold text-amber-800 mb-1">
            Emergency Notice
          </p>
          {/* TODO(medical): confirm exact symptom language */}
          <p className="text-sm text-amber-700">
            Rimal Health is not an emergency service. If you experience severe or
            persistent abdominal pain (possible pancreatitis), signs of an
            allergic reaction, or thoughts of self-harm, seek help immediately —
            call 911 or go to your nearest emergency room. For mental-health
            crises, call or text 988 (Suicide &amp; Crisis Lifeline).
          </p>
        </motion.div>
      </SectionWrapper>

      {/* Pricing Reminder Card */}
      <SectionWrapper className="py-20">
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
          <p className="text-base text-gray-600 mb-4">
            Includes physician evaluation, prescription management, unlimited
            messaging, and ongoing monitoring.
          </p>
          <p className="text-sm text-gray-600 mb-2">
            Not included: medication costs, laboratory fees, outside specialist
            services, or emergency care.
          </p>
          <p className="text-sm text-gray-600 mb-2">
            Medications billed separately at your pharmacy (pharmacy may bill your
            insurance). Costs vary by medication and pharmacy.
          </p>
          <p className="text-sm text-gray-600 mb-6">
            Our service fee is cash-pay. Superbill available for out-of-network
            reimbursement — reimbursement not guaranteed and varies by plan.
            Cancel anytime. No long-term contracts.
          </p>
          <Link
            href="/checkout/consent?plan=weight-management&product=weight-management"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-navy-600 to-ocean-500 text-white font-semibold rounded-lg hover:shadow-lg transition-shadow"
          >
            Get Started — $50/month
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
            Start your weight management journey
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            California-licensed physician review
          </p>
          <Link
            href="/checkout/consent?plan=weight-management&product=weight-management"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-navy-600 to-ocean-500 text-white font-semibold rounded-lg hover:shadow-lg transition-shadow text-lg"
          >
            Get Started — $50/month
            <ArrowRight className="w-6 h-6" />
          </Link>
          <div className="mt-8 flex justify-center">
            <TrustBadges />
          </div>
        </motion.div>
      </SectionWrapper>

      {/* Medical Disclaimer — required on all treatment pages */}
      <MedicalDisclaimer />
    </>
  );
}
