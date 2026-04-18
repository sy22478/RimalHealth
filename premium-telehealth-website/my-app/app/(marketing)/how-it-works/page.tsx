"use client";

import Link from "next/link";
import { useState } from "react";
import { SectionWrapper } from "@/components/sections/SectionWrapper";
import { motion, useReducedMotion } from "framer-motion";
import {
  Sparkles,
  CreditCard,
  FileText,
  UserCheck,
  Pill,
  ChevronDown,
  ArrowRight,
  Check,
  Lock,
} from "lucide-react";

export default function HowItWorksPage() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <SectionWrapper className="pt-28 pb-16 px-4">
        <div className="container max-w-7xl mx-auto">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
          >
            <p className="text-sm text-gray-500 mb-6">Home / How It Works</p>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 max-w-3xl">
              Start treatment in 5 simple steps
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mt-6">
              From choosing your plan to picking up your prescription — we&apos;ve streamlined the entire process.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-navy-500 to-ocean-500 text-white font-semibold rounded-lg shadow-lg shadow-navy-500/20 hover:shadow-xl hover:shadow-navy-500/30 hover:-translate-y-0.5 transition-all duration-200"
              >
                View Plans & Pricing
                <ArrowRight className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2 text-gray-600">
                <Lock className="w-4 h-4" />
                <span className="text-sm">Secure checkout • Cancel anytime</span>
              </div>
            </div>
          </motion.div>
        </div>
      </SectionWrapper>

      {/* Process Steps Section */}
      <SectionWrapper className="py-20 px-4 bg-gray-50">
        <div className="container max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ocean-500/10 border border-ocean-500/20 text-sm font-semibold text-ocean-600 mb-6">
              How it works
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Five simple steps, from checkout to prescription
            </h2>
            <p className="text-lg text-gray-600 mt-4 max-w-2xl mx-auto">
              Pay first so your physician review starts the moment you finish your intake.
            </p>
          </motion.div>

          <div className="space-y-8">
            {/* Step 1 */}
            <StepCard
              number="1"
              title="Start your treatment plan"
              description="Our Active Treatment Plan is $50/month — one flat fee that covers physician intake review, prescription management, and unlimited messaging with your physician."
              icon={Sparkles}
              details={[
                "Active Treatment: $50/month, everything included",
                "Cancel anytime — no long-term contracts",
                "HSA/FSA cards accepted",
                "30-day money-back guarantee",
              ]}
              delay={0}
            />

            {/* Step 2 */}
            <StepCard
              number="2"
              title="Complete secure checkout"
              description="Enter your payment information through our secure, HIPAA-compliant checkout process. Your subscription begins immediately."
              icon={CreditCard}
              details={[
                "End-to-end encrypted payment processing",
                "Major credit cards, HSA/FSA accepted",
                "30-day money-back guarantee",
                "Instant subscription activation",
              ]}
              delay={0.1}
            />

            {/* Step 3 */}
            <StepCard
              number="3"
              title="Fill out your medical intake"
              description="With your subscription active, complete your medical questionnaire in about 10 minutes. No appointment needed — do it on your schedule."
              icon={FileText}
              details={[
                "Medical history and current medications",
                "Treatment goals and preferences",
                "Takes approximately 10 minutes",
                "Save progress and return later if needed",
              ]}
              delay={0.2}
            />

            {/* Step 4 */}
            <StepCard
              number="4"
              title="Physician reviews within 24 hours"
              description="A California-licensed physician reviews your intake, evaluates your medical history, and determines the appropriate treatment plan."
              icon={UserCheck}
              details={[
                "Complete medical history evaluation",
                "Drug interaction screening",
                "Personalized medication selection",
                "24-hour review guarantee (often same day)",
              ]}
              delay={0.3}
            />

            {/* Step 5 */}
            <StepCard
              number="5"
              title="Prescription sent to your pharmacy"
              description="Once approved, your prescription is sent electronically to your preferred pharmacy. Pick it up the same day and start treatment."
              icon={Pill}
              details={[
                "E-prescription to any pharmacy in California",
                "Same-day pickup at most pharmacies",
                "Automatic refills when needed",
                "Message your physician anytime with questions",
              ]}
              delay={0.4}
            />
          </div>
        </div>
      </SectionWrapper>

      {/* What's Included Section */}
      <SectionWrapper className="py-20 px-4">
        <div className="container max-w-7xl mx-auto">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 text-center mb-6">
              Everything included in your subscription
            </h2>
            <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto">
              One flat monthly fee covers all your care. No hidden charges, no surprise fees.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {includedFeatures.map((feature, index) => (
              <motion.div
                key={index}
                className="flex items-start gap-4 bg-gray-50 rounded-xl p-5"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={shouldReduceMotion ? { duration: 0 } : {
                  duration: 0.5,
                  delay: index * 0.1,
                  ease: "easeOut",
                }}
              >
                <div className="w-10 h-10 rounded-full bg-ocean-500/10 flex items-center justify-center flex-shrink-0">
                  <Check className="w-5 h-5 text-ocean-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                  <p className="text-sm text-gray-600">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Not included section */}
          <motion.div
            className="mt-12 p-6 bg-amber-50 border border-amber-200 rounded-xl max-w-4xl mx-auto"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, delay: 0.5, ease: "easeOut" }}
          >
            <h3 className="font-semibold text-amber-800 mb-2">Not included in subscription:</h3>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• Medication costs at pharmacy (typically $10–50/month with insurance)</li>
              <li>• Laboratory tests or outside specialist services</li>
              <li>• Emergency medical care</li>
            </ul>
          </motion.div>
        </div>
      </SectionWrapper>

      {/* Medications Section */}
      <SectionWrapper className="py-20 px-4 bg-gray-50">
        <div className="container max-w-7xl mx-auto">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 text-center mb-6">
              Medications we prescribe
            </h2>
            <p className="text-center text-gray-600 mb-16 max-w-2xl mx-auto">
              FDA-approved medications for alcohol use disorder. Your physician will recommend the best option for you.
            </p>
          </motion.div>

          {/* Alcohol Medications Table */}
          <motion.div
            className="mb-12"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
          >
            <h3 className="text-2xl font-bold text-gray-900 mb-6">
              Alcohol Medications
            </h3>
            <div className="overflow-x-auto bg-white rounded-xl border border-gray-200">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="text-sm uppercase font-semibold text-gray-700 text-left py-4 px-4">
                      Medication
                    </th>
                    <th className="text-sm uppercase font-semibold text-gray-700 text-left py-4 px-4">
                      How it works
                    </th>
                    <th className="text-sm uppercase font-semibold text-gray-700 text-left py-4 px-4">
                      Typical cost
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {alcoholMedications.map((med, index) => (
                    <tr key={index} className="border-b border-gray-200 last:border-0">
                      <td className="py-4 px-4 font-semibold text-gray-900">
                        {med.name}
                      </td>
                      <td className="py-4 px-4 text-gray-600">{med.howItWorks}</td>
                      <td className="py-4 px-4 text-gray-900 font-medium">{med.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          <p className="text-sm text-gray-600 italic mt-6">
            Medication costs shown are typical pharmacy prices with insurance. Without insurance, use GoodRx
            for discounts ($30–100/mo).
          </p>
        </div>
      </SectionWrapper>

      {/* FAQ Preview Section */}
      <SectionWrapper className="py-20 px-4">
        <div className="container max-w-4xl mx-auto">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
          >
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 text-center mb-12">
              Common questions
            </h2>
          </motion.div>

          <div className="space-y-0">
            {faqs.map((faq, index) => (
              <FAQItem key={index} question={faq.question} answer={faq.answer} />
            ))}
          </div>

          <div className="text-center mt-8">
            <a
              href="/faq"
              className="text-ocean-600 font-semibold hover:text-ocean-700 transition-colors inline-flex items-center gap-2"
            >
              See all FAQs →
            </a>
          </div>
        </div>
      </SectionWrapper>

      {/* Final CTA Section */}
      <SectionWrapper className="py-20 px-4 bg-gradient-to-b from-gray-50 to-white">
        <div className="container max-w-4xl mx-auto text-center">
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Ready to start your journey?
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Choose your plan, complete checkout, and begin your treatment today.
            </p>
            <Link href="/pricing" className="inline-flex items-center gap-2 bg-gradient-to-r from-navy-500 to-ocean-500 text-white font-semibold px-8 py-4 rounded-lg hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 text-lg">
              View Plans & Pricing
              <ArrowRight className="w-5 h-5" />
            </Link>
            <p className="text-gray-500 mt-4 text-sm">
              Cancel anytime • 30-day money-back guarantee
            </p>
          </motion.div>
        </div>
      </SectionWrapper>
    </div>
  );
}

// Step Card Component
function StepCard({
  number,
  title,
  description,
  icon: Icon,
  details,
  delay = 0,
}: {
  number: string;
  title: string;
  description: string;
  icon: React.ElementType;
  details: string[];
  delay?: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      className="bg-white rounded-2xl p-6 md:p-8 border border-gray-200"
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, delay, ease: "easeOut" }}
    >
      <div className="flex flex-col md:flex-row md:items-start gap-6">
        {/* Number and Icon */}
        <div className="flex items-center gap-4 md:w-48 flex-shrink-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-ocean-500 to-blue-500 text-white flex items-center justify-center font-bold text-xl">
            {number}
          </div>
          <div className="md:hidden">
            <Icon className="w-8 h-8 text-ocean-500" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Icon className="hidden md:block w-6 h-6 text-ocean-500" />
            <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
          </div>
          <p className="text-gray-600 mb-4">{description}</p>
          <ul className="space-y-2">
            {details.map((detail, index) => (
              <li key={index} className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">{detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

// FAQ Accordion Component
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="border-b border-gray-200 py-5">
      <button
        className="w-full text-left flex items-start justify-between gap-4 cursor-pointer group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-lg font-semibold text-gray-900 group-hover:text-ocean-600 transition-colors">
          {question}
        </span>
        <ChevronDown
          className={`text-gray-600 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          size={20}
        />
      </button>
      {isOpen && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={prefersReducedMotion ? undefined : { opacity: 0, height: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
        >
          <p className="text-base text-gray-600 mt-3">{answer}</p>
        </motion.div>
      )}
    </div>
  );
}

// Included features data
const includedFeatures = [
  { title: "Physician intake review", desc: "Licensed physician evaluates your complete medical history" },
  { title: "Personalized prescription", desc: "FDA-approved medication chosen for your specific needs" },
  { title: "E-prescription to pharmacy", desc: "Sent directly to your local CVS, Walgreens, etc." },
  { title: "Unlimited messaging", desc: "Ask questions, report progress, get support" },
  { title: "Automatic refills", desc: "Prescription refills handled seamlessly" },
  { title: "Treatment adjustments", desc: "Change medications or dosage at no extra cost" },
];

// Medications data
const alcoholMedications = [
  {
    name: "Naltrexone",
    howItWorks: "Blocks alcohol's rewarding effects, reducing cravings",
    cost: "$10–40/mo",
  },
];

// FAQs data
const faqs = [
  {
    question: "Do I have to schedule a video call?",
    answer:
      "No. Our model is completely asynchronous. After completing checkout and your intake, a physician reviews it within 24 hours. If approved, your prescription is sent directly to your pharmacy. You can message your physician anytime with questions.",
  },
  {
    question: "How quickly do I get my prescription?",
    answer:
      "Most patients receive their prescription within 24 hours of completing their intake. Once approved, the prescription is sent electronically to your preferred pharmacy, and you can pick it up the same day.",
  },
  {
    question: "What if the medication doesn't work?",
    answer:
      "Message your physician. We'll try a different medication or adjust your dose at no extra charge. Treatment adjustments are included in your monthly subscription.",
  },
  {
    question: "Can I use my insurance?",
    answer:
      "Yes, for medications at the pharmacy. Our service fee is separate and not billed to insurance. Most patients pay $10–50/month for medications with insurance.",
  },
];
