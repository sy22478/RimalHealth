import type { Metadata } from "next";
import Link from "next/link";
import {
  ClipboardCheck,
  Pill,
  MessageSquareLock,
  Users,
  ArrowRight,
  ShieldCheck,
  LogIn,
  KeyRound,
  Phone,
} from "lucide-react";

export const metadata: Metadata = {
  title: "For Physicians | Rimal Health",
  description:
    "Rimal Health's secure, HIPAA-compliant physician portal for reviewing patient intakes, prescribing Naltrexone, and managing alcohol use disorder treatment.",
  openGraph: {
    title: "For Physicians — Rimal Health",
    description:
      "Rimal Health's secure, HIPAA-compliant physician portal for reviewing patient intakes, prescribing Naltrexone, and managing alcohol use disorder treatment.",
    url: "/for-physicians",
  },
};

const capabilities = [
  {
    icon: ClipboardCheck,
    title: "Review Intakes",
    description:
      "Access a prioritized queue of patient intake submissions. Review medical histories, AUDIT-C scores, and treatment goals — all in one place.",
  },
  {
    icon: Pill,
    title: "Prescribe Naltrexone",
    description:
      "Use built-in prescription management tools to document treatment decisions and coordinate medication with the patient's pharmacy.",
  },
  {
    icon: MessageSquareLock,
    title: "Secure Messaging",
    description:
      "Communicate with patients through HIPAA-compliant asynchronous messaging. Respond on your schedule within our 24-hour commitment.",
  },
  {
    icon: Users,
    title: "Patient Management",
    description:
      "Track active patients, view prescription histories, manage refill requests, and monitor treatment progress from your dashboard.",
  },
];

const steps = [
  {
    number: "1",
    icon: Phone,
    title: "Contact our admin team",
    description:
      "Reach out to learn about practicing on the Rimal Health platform. We'll verify your California medical license and credentials.",
  },
  {
    number: "2",
    icon: KeyRound,
    title: "Receive your credentials",
    description:
      "Once approved, you'll receive a secure access key and login credentials to the physician portal.",
  },
  {
    number: "3",
    icon: LogIn,
    title: "Log in and start treating",
    description:
      "Access the physician dashboard, review your first patient intakes, and begin prescribing — all from one streamlined interface.",
  },
];

export default function ForPhysiciansPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ocean-500/10 border border-ocean-500/20 text-sm font-semibold text-ocean-600 mb-6">
            <ShieldCheck className="w-4 h-4" />
            HIPAA-Compliant Platform
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
            Physician Portal
          </h1>
          <p className="text-xl text-gray-600 mt-6 leading-relaxed max-w-2xl mx-auto">
            A secure clinical platform built for California-licensed physicians
            to review patient intakes, prescribe FDA-approved medications, and
            manage alcohol use disorder treatment — all asynchronously.
          </p>
        </div>
      </section>

      {/* What You Can Do Section */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              What you can do
            </h2>
            <p className="text-lg text-gray-600 mt-4 max-w-2xl mx-auto">
              Everything you need to deliver evidence-based addiction treatment,
              without the overhead of a traditional practice.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {capabilities.map((capability) => {
              const Icon = capability.icon;
              return (
                <div
                  key={capability.title}
                  className="bg-white border border-gray-200 rounded-xl p-6"
                >
                  <div className="w-10 h-10 rounded-full bg-ocean-500/10 flex items-center justify-center mb-4">
                    <Icon className="text-ocean-500" size={20} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {capability.title}
                  </h3>
                  <p className="text-base text-gray-600 leading-relaxed">
                    {capability.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How to Get Started Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              How to get started
            </h2>
            <p className="text-lg text-gray-600 mt-4 max-w-2xl mx-auto">
              Join our network in three simple steps.
            </p>
          </div>

          <div className="space-y-8">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className="bg-white rounded-2xl p-6 md:p-8 border border-gray-200"
                >
                  <div className="flex flex-col md:flex-row md:items-start gap-6">
                    <div className="flex items-center gap-4 md:w-48 flex-shrink-0">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-ocean-500 to-blue-500 text-white flex items-center justify-center font-bold text-xl">
                        {step.number}
                      </div>
                      <div className="md:hidden">
                        <Icon className="w-8 h-8 text-ocean-500" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Icon className="hidden md:block w-6 h-6 text-ocean-500" />
                        <h3 className="text-2xl font-bold text-gray-900">
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-gray-600">{step.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            Ready to make a difference?
          </h2>
          <p className="text-xl text-gray-600 mt-4 max-w-2xl mx-auto">
            Help Californians access evidence-based treatment for alcohol use
            disorder. Join the Rimal Health physician network.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
            <Link
              href="/physician/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-navy-500 to-ocean-500 text-white font-semibold rounded-lg hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              Access Physician Portal
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
            >
              Contact Us
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-6">
            Already have credentials? Log in directly to the physician portal.
          </p>
        </div>
      </section>
    </div>
  );
}
