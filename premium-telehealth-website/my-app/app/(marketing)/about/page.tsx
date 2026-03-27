"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, FlaskConical, User, Lock } from "lucide-react";
import { ProgressiveImage } from "@/components/ui/ProgressiveImage";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6, ease: "easeOut" as const },
};

const staggerContainer = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.1 } },
  viewport: { once: true },
};

export default function AboutPage() {
  const values = [
    {
      icon: Heart,
      title: "No judgment",
      description:
        "Addiction is a medical condition, not a moral failing. We treat every patient with dignity and respect.",
    },
    {
      icon: FlaskConical,
      title: "Evidence-based",
      description:
        "Every treatment we offer is backed by rigorous scientific research. No gimmicks.",
    },
    {
      icon: User,
      title: "Patient-centered",
      description:
        "Your goals drive your treatment. We support you, not dictate to you.",
    },
    {
      icon: Lock,
      title: "Privacy first",
      description:
        "What you share with us stays with us. HIPAA-compliant, secure, confidential.",
    },
  ];

  const stats = [
    { value: "1,200+", label: "patients helped" },
    { value: "24 hours", label: "avg. review time" },
    { value: "$50", label: "per month" },
    { value: "100%", label: "HIPAA compliant" },
  ];

  return (
    <main>
        {/* Hero Section */}
        <section className="pt-28 pb-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <motion.h1
              className="text-4xl md:text-5xl font-bold text-gray-900"
              {...fadeInUp}
            >
              We make addiction treatment accessible to everyone
            </motion.h1>
            <motion.p
              className="text-xl text-gray-600 mt-6 leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" as const }}
            >
              2.9 million Californians struggle with substance use disorder.
              Only 10% get treatment. We&apos;re changing that.
            </motion.p>
          </div>
        </section>

        {/* The Problem Section */}
        <section className="bg-gray-50 py-20 px-4">
          <motion.div
            className="max-w-3xl mx-auto"
            {...fadeInUp}
          >
            <p className="text-xl md:text-2xl text-gray-900 leading-relaxed mb-6">
              Traditional addiction treatment is broken. It requires taking time
              off work. Traveling to clinics. Sitting in waiting rooms.
              Navigating insurance billing nightmares. Paying thousands of
              dollars.
            </p>
            <p className="text-xl md:text-2xl text-gray-900 leading-relaxed mb-6">
              For many people, these barriers make treatment impossible.
              Meanwhile, proven medications exist. FDA-approved drugs that
              reduce cravings and triple success rates. But most people
              can&apos;t access them.
            </p>
            <p className="text-xl md:text-2xl text-gray-900 leading-relaxed font-semibold">
              We built Rimal Health to solve this.
            </p>
          </motion.div>
        </section>

        {/* Our Solution Section */}
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <motion.h2
              className="text-3xl md:text-4xl font-bold text-center mb-14 text-gray-900"
              {...fadeInUp}
            >
              How we&apos;re different
            </motion.h2>
            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-10"
              variants={staggerContainer}
              initial="initial"
              whileInView="whileInView"
              viewport={{ once: true }}
            >
              <motion.div variants={fadeInUp}>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  No appointments
                </h3>
                <p className="text-base text-gray-600 leading-relaxed">
                  Traditional telehealth charges $100–300 per video call. We
                  don&apos;t need expensive video appointments. Our asynchronous
                  model — comprehensive intake forms reviewed by a physician —
                  provides the same medical quality at 70% lower cost.
                </p>
              </motion.div>
              <motion.div variants={fadeInUp}>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  No insurance billing
                </h3>
                <p className="text-base text-gray-600 leading-relaxed">
                  Insurance billing requires expensive staff, complex coding,
                  and months of delays. We skip it entirely. You pay $50/month
                  directly. Use your own insurance only for medications at the
                  pharmacy. Simple. Transparent.
                </p>
              </motion.div>
              <motion.div variants={fadeInUp}>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Physician-prescribed
                </h3>
                <p className="text-base text-gray-600 leading-relaxed">
                  We&apos;re not coaches or counselors. Our California-licensed
                  physician reviews every patient, prescribes FDA-approved
                  medications, and provides ongoing medical management. Real
                  prescriptions. Real results.
                </p>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Team Section */}
        <section className="py-20 px-4 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <motion.h2
              className="text-3xl md:text-4xl font-bold text-center mb-14 text-gray-900"
              {...fadeInUp}
            >
              Meet our founder
            </motion.h2>
            <motion.div
              className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-xl overflow-hidden"
              {...fadeInUp}
            >
              <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-0">
                {/* Dr. Rabah headshot */}
                <ProgressiveImage
                  src="/images/dr-rabah.png"
                  alt="Dr. Rabah, MD — Medical Director & Founder of Rimal Health"
                  fill
                  containerClassName="h-72 md:h-auto"
                  objectPosition="top"
                  priority
                />
                {/* Content */}
                <div className="p-8 md:p-12">
                  <h3 className="text-2xl md:text-3xl font-semibold text-gray-900">
                    Dr. Rabah, MD
                  </h3>
                  <p className="text-lg text-ocean-500 mt-1">
                    Medical Director & Founder
                  </p>
                  <p className="text-base text-gray-600 leading-relaxed mt-4">
                    Healthcare should feel human, not rushed. Dr. Rabah built Rimal Health with
                    one simple belief: patients deserve more than quick visits, half-answers, and
                    fragmented care. His entire approach centers on forming real, meaningful
                    connections and providing thoughtful, comprehensive medical treatment that
                    considers the whole person — not just a list of symptoms.
                  </p>
                  <p className="text-base text-gray-600 leading-relaxed mt-4">
                    After years of working in traditional healthcare systems, Dr. Rabah saw how
                    people — especially those dealing with addiction — were falling through the
                    cracks. He created Rimal Health for patients who want more time, more
                    attention, more clarity, and more support.
                  </p>
                  <div className="mt-6 bg-gray-50 rounded-lg p-4">
                    <p className="text-sm font-semibold text-gray-900 mb-1">Training & Experience</p>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      University of Connecticut School of Medicine · Emergency Medicine residency ·
                      Addiction Medicine fellowship. Dual board-certified in Emergency Medicine and
                      Addiction Medicine.
                    </p>
                  </div>
                  <blockquote className="italic text-lg text-gray-900 mt-6 border-l-4 border-ocean-500 pl-4">
                    &ldquo;Everyone deserves access to medication that can change their life.
                    That&apos;s why we built this.&rdquo;
                  </blockquote>
                  <p className="text-sm text-gray-500 mt-4">
                    California Medical License
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Mission Section */}
        <section className="bg-ocean-500/5 py-20 px-4">
          <motion.div
            className="max-w-3xl mx-auto text-center"
            {...fadeInUp}
          >
            <p className="text-sm uppercase text-ocean-500 font-semibold tracking-wider mb-4">
              Our mission
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 leading-snug">
              Make evidence-based addiction treatment accessible, affordable,
              and judgment-free for every Californian who needs it.
            </h2>
            <p className="text-lg text-gray-600 mt-8">
              10% of people with substance use disorder currently receive
              treatment. Our goal: help 10,000 Californians overcome addiction.
            </p>
          </motion.div>
        </section>

        {/* Values Section */}
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <motion.h2
              className="text-3xl md:text-4xl font-bold text-center mb-14 text-gray-900"
              {...fadeInUp}
            >
              What we believe
            </motion.h2>
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
              variants={staggerContainer}
              initial="initial"
              whileInView="whileInView"
              viewport={{ once: true }}
            >
              {values.map((value, index) => {
                const Icon = value.icon;
                return (
                  <motion.div
                    key={index}
                    className="bg-white border border-gray-200 rounded-xl p-6"
                    variants={fadeInUp}
                  >
                    <div className="w-10 h-10 rounded-full bg-ocean-500/10 flex items-center justify-center mb-4">
                      <Icon className="text-ocean-500" size={20} />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">
                      {value.title}
                    </h3>
                    <p className="text-base text-gray-600 leading-relaxed">
                      {value.description}
                    </p>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* By The Numbers Section */}
        <section className="bg-gray-900 py-20 px-4">
          <motion.div
            className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 text-center"
            variants={staggerContainer}
            initial="initial"
            whileInView="whileInView"
            viewport={{ once: true }}
          >
            {stats.map((stat, index) => (
              <motion.div key={index} variants={fadeInUp}>
                <p className="text-4xl md:text-5xl font-bold text-white">
                  {stat.value}
                </p>
                <p className="text-base text-gray-400 mt-2">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Final CTA Section */}
        <section className="bg-gradient-to-b from-gray-50 to-white py-20 px-4">
          <motion.div
            className="max-w-3xl mx-auto text-center"
            {...fadeInUp}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Join us in making addiction treatment accessible
            </h2>
            <Link
              href="/how-it-works"
              className="inline-block mt-8 px-8 py-4 bg-gradient-to-r from-navy-500 to-ocean-500 text-white font-semibold rounded-lg hover:shadow-lg transition-shadow"
            >
              Get Started — $50/month
            </Link>
          </motion.div>
        </section>
    </main>
  );
}
