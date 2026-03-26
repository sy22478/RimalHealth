"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { TrustBadges } from "@/components/TrustBadges";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
};

export function Hero() {
  return (
    <section className="relative w-full min-h-[90vh] flex items-center justify-center bg-gradient-to-b from-white to-gray-50 px-4 py-20 overflow-hidden">

      {/* Ambient gradient orbs — slow, subtle, brand-colored */}
      <motion.div
        className="absolute -top-48 -right-48 w-[700px] h-[700px] rounded-full bg-ocean-500/[0.06] blur-3xl pointer-events-none"
        animate={{ x: [0, 24, 0], y: [0, -16, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-32 -left-48 w-[600px] h-[600px] rounded-full bg-navy/[0.05] blur-3xl pointer-events-none"
        animate={{ x: [0, -16, 0], y: [0, 24, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px] rounded-full bg-blue-500/[0.03] blur-3xl pointer-events-none"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="relative max-w-7xl mx-auto text-center z-10"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        {/* Eyebrow pill */}
        <motion.div variants={itemVariants} className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-ocean-500/10 border border-ocean-500/20 text-sm font-semibold text-ocean-600 tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-ocean-500 inline-block" />
            California-licensed · Physician-prescribed · HIPAA secure
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-gray-900 max-w-4xl mx-auto leading-[1.05]"
          variants={itemVariants}
        >
          Get medication to quit
          <br />
          <span className="bg-gradient-to-r from-ocean-500 to-blue-500 bg-clip-text text-transparent">
            drinking.
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mt-6 leading-relaxed"
          variants={itemVariants}
        >
          A California-licensed physician reviews your intake in 24 hours.
          Prescription sent directly to your pharmacy.{" "}
          <span className="font-semibold text-gray-900">$50/month.</span>
        </motion.p>

        {/* CTA */}
        <motion.div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4" variants={itemVariants}>
          <Link
            href="/checkout/consent"
            className="inline-flex items-center justify-center px-12 py-4.5 bg-gradient-to-r from-blue-500 to-ocean-500 text-white font-semibold rounded-full shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 text-lg"
          >
            Get Started — $50/month
          </Link>
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-1.5 text-gray-600 hover:text-ocean-600 font-medium transition-colors text-base"
          >
            See how it works
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </motion.div>

        <motion.p className="text-sm text-gray-500 mt-3" variants={itemVariants}>
          Choose plan → Checkout → Start treatment
        </motion.p>

        {/* Trust Badges */}
        <motion.div className="mt-12" variants={itemVariants}>
          <TrustBadges />
        </motion.div>
      </motion.div>
    </section>
  );
}
