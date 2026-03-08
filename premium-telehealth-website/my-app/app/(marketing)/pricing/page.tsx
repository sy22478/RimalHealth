"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Shield, ChevronDown, ArrowRight, CreditCard, FileText, UserCheck, Pill, Sparkles } from "lucide-react";
import { PricingCard } from "@/components/marketing/PricingCard";
import { ComparisonTable, rimalComparisonFeatures } from "@/components/marketing/ComparisonTable";
import { TrustBadges } from "@/components/TrustBadges";

export default function PricingPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      question: "What does the $50/month include?",
      answer:
        "Your monthly subscription includes a comprehensive doctor intake review, personalized prescription plan, e-prescriptions sent directly to your pharmacy, unlimited messaging with your doctor, automatic prescription refills, medication adjustments as needed, and treatment plan modifications throughout your journey.",
    },
    {
      question: "Do you accept insurance?",
      answer:
        "We don't bill insurance directly for our service fee, but your medication costs at the pharmacy are covered by most insurance plans. This keeps our pricing simple and transparent. You can also use HSA/FSA funds to pay for our service.",
    },
    {
      question: "How much do medications cost?",
      answer:
        "With insurance, FDA-approved medications typically cost $10–50 per month at your local pharmacy. Without insurance, costs range from $30–100 per month. We recommend using GoodRx coupons if you're paying out of pocket to get the best price.",
    },
    {
      question: "Can I cancel anytime?",
      answer:
        "Yes, absolutely. There are no long-term contracts or cancellation fees. You can cancel your subscription at any time from your account settings, and you'll retain access until the end of your billing period.",
    },
    {
      question: "Are there any other fees?",
      answer:
        "No. The $50/month is the only fee you pay us. There are no setup fees, appointment fees, video call charges, consultation fees, or surprise charges. The only additional cost is your medication at the pharmacy.",
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "We accept all major credit cards (Visa, Mastercard, American Express, Discover), HSA/FSA debit cards, and most debit cards. Your payment information is securely stored and encrypted.",
    },
  ];

  const workflowSteps = [
    {
      icon: Sparkles,
      number: "1",
      title: "Choose your plan",
      description: "Select the Active Treatment Plan that fits your needs",
    },
    {
      icon: CreditCard,
      number: "2",
      title: "Complete checkout",
      description: "$50/month subscription. Secure payment processing.",
    },
    {
      icon: FileText,
      number: "3",
      title: "Fill out intake",
      description: "Complete your medical questionnaire in about 10 minutes",
    },
    {
      icon: UserCheck,
      number: "4",
      title: "Doctor reviews",
      description: "Physician reviews within 24 hours and approves treatment",
    },
    {
      icon: Pill,
      number: "5",
      title: "Pick up medication",
      description: "Prescription sent to your pharmacy. Start treatment.",
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="pt-28 pb-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ocean-500/10 border border-ocean-500/20 text-sm font-semibold text-ocean-600 mb-6">
              <Sparkles className="w-4 h-4" />
              Start treatment today
            </span>
          </motion.div>
          
          <motion.h1
            className="text-5xl md:text-6xl font-bold text-gray-900"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            Simple pricing. No hidden fees.
          </motion.h1>
          <motion.p
            className="text-xl text-gray-600 mt-6 mb-8 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          >
            Choose your plan, complete checkout, and start your treatment journey. 
            Cancel anytime.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          >
            <TrustBadges />
          </motion.div>
        </div>
      </section>

      {/* Workflow Steps */}
      <section className="pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          >
            {workflowSteps.map((step, index) => (
              <motion.div
                key={index}
                className="relative bg-gray-50 rounded-xl p-5 text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 + index * 0.1, ease: "easeOut" }}
              >
                {/* Connector line (hidden on mobile) */}
                {index < workflowSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-2 w-4 h-0.5 bg-gray-300" />
                )}
                
                <div className="w-10 h-10 rounded-full bg-ocean-500 text-white flex items-center justify-center font-bold text-sm mx-auto mb-3">
                  <step.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">
                  {step.title}
                </h3>
                <p className="text-xs text-gray-600">{step.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            Choose your plan
          </motion.h2>
          
          <div className="grid grid-cols-1 max-w-lg mx-auto gap-8 w-full">
            <PricingCard
              title="Active Treatment"
              price={50}
              description="For patients currently in treatment"
              features={[
                "Physician consultation & intake review",
                "Prescription management & e-prescribing",
                "24/7 secure messaging with your doctor",
                "Treatment progress tracking",
                "Monthly check-ins & adjustments",
                "Automatic prescription refills",
                "Cancel anytime",
              ]}
              highlighted={true}
              badge="Most Popular"
              ctaText="Select Active Plan"
              ctaHref="/checkout/payment?plan=active-treatment"
              ctaVariant="primary"
              delay={0.1}
            />
          </div>
        </div>
      </section>

      {/* Cost Breakdown Table */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            Total monthly cost
          </motion.h2>
          <motion.div
            className="bg-white border border-gray-200 rounded-xl overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          >
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">
                    Item
                  </th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">
                    With Insurance
                  </th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">
                    Without Insurance
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-200">
                  <td className="py-4 px-6 text-gray-700">Our service</td>
                  <td className="py-4 px-6 text-gray-900">$50/month</td>
                  <td className="py-4 px-6 text-gray-900">$50/month</td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td className="py-4 px-6 text-gray-700">
                    Medication at pharmacy
                  </td>
                  <td className="py-4 px-6 text-gray-900">$10–50/month</td>
                  <td className="py-4 px-6 text-gray-900">$30–100/month</td>
                </tr>
                <tr className="border-t-2 border-gray-200 bg-ocean-500/5">
                  <td className="py-4 px-6 font-bold text-gray-900">Total</td>
                  <td className="py-4 px-6 font-bold text-ocean-600">
                    $60–100/month
                  </td>
                  <td className="py-4 px-6 font-bold text-gray-900">
                    $80–150/month
                  </td>
                </tr>
              </tbody>
            </table>
          </motion.div>
          <p className="text-center text-sm text-gray-600 mt-6">
            Medication costs are estimates. Use GoodRx without insurance.
          </p>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            How we compare
          </motion.h2>
          <motion.p
            className="text-center text-gray-600 mb-12 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          >
            See how Rimal Health compares to traditional telehealth and in-person treatment options
          </motion.p>
          <ComparisonTable features={rimalComparisonFeatures} showInPerson={true} />
        </div>
      </section>

      {/* No Extra Fees */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            No extra fees, ever
          </motion.h2>
          <motion.div
            className="bg-gray-50 rounded-xl p-8 md:p-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                "No setup fees",
                "No appointment fees",
                "No video call charges",
                "No consultation fees",
                "No cancellation fees",
                "No long-term contracts",
                "No insurance billing fees",
                "No surprise charges",
              ].map((item, index) => (
                <div key={index} className="flex items-center">
                  <Check className="w-5 h-5 text-emerald-500 mr-3 flex-shrink-0" />
                  <span className="text-gray-900">{item}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Money-Back Guarantee */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="max-w-xl mx-auto border-2 border-dashed border-emerald-500 rounded-2xl p-10 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <Shield className="w-12 h-12 text-ocean-500 mx-auto mb-6" />
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              100% Risk-Free Guarantee
            </h3>
            <p className="text-lg text-gray-700">
              If our service isn&apos;t the right fit for you within the first 30
              days, we&apos;ll give you a full refund—no questions asked. We&apos;re
              confident you&apos;ll see real progress, but your satisfaction is what
              matters most.
            </p>
          </motion.div>
        </div>
      </section>

      {/* HSA/FSA Section */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            className="bg-gradient-to-br from-amber-50 to-emerald-50 rounded-xl p-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">
              Pay with pre-tax dollars
            </h3>
            <p className="text-lg text-gray-700 mb-6">
              Our service qualifies for HSA and FSA reimbursement. You can use
              your pre-tax health savings to cover your subscription, saving you
              20–40% depending on your tax bracket.
            </p>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="bg-ocean-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0 mr-4">
                  1
                </div>
                <p className="text-gray-700 mt-1">
                  Pay directly with your HSA/FSA debit card at checkout
                </p>
              </div>
              <div className="flex items-start">
                <div className="bg-ocean-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0 mr-4">
                  2
                </div>
                <p className="text-gray-700 mt-1">
                  Or pay with a regular card and submit your receipt for
                  reimbursement
                </p>
              </div>
            </div>
            <p className="text-sm font-semibold text-gray-900 mt-6">
              Tax savings: 20–40% depending on your tax bracket
            </p>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            Common questions
          </motion.h2>
          <motion.div
            className="max-w-3xl mx-auto space-y-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          >
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden"
              >
                <button
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
                  onClick={() =>
                    setOpenIndex(openIndex === index ? null : index)
                  }
                >
                  <span className="font-semibold text-lg text-gray-900 pr-8">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-600 flex-shrink-0 transition-transform ${
                      openIndex === index ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openIndex === index && (
                  <div className="px-6 pb-6">
                    <p className="text-gray-700 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="pb-32 px-6">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Ready to start your treatment?
          </h2>
          <Link
            href="/checkout/payment?plan=active-treatment"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-ocean-500 text-white text-lg font-semibold py-4 px-8 rounded-lg shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all duration-200"
          >
            Start for $50/month
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-gray-600 mt-4">
            Cancel anytime. No commitment.
          </p>
        </motion.div>
      </section>
    </div>
  );
}
