"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

const reassurances = [
  "No long-term commitment",
  /* TASK-C01: physician not doctor */
  "Physician review in 24 hours",
  "HIPAA secure",
];

export function CTA() {
  return (
    <section className="relative overflow-hidden bg-navy py-24 md:py-32 lg:py-40 px-4">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-ocean-500/15 blur-3xl" />
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-ocean-600/10 blur-3xl" />
      </div>

      {/* Decorative grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <motion.div
        className="relative max-w-3xl mx-auto text-center"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.65 }}
      >
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
          Start today.
          <br />
          <span className="bg-gradient-to-r from-ocean-400 to-blue-400 bg-clip-text text-transparent">
            Prescription tomorrow.
          </span>
        </h2>

        <p className="text-lg md:text-xl text-white/70 mb-10 leading-relaxed">
          California residents can complete their intake now and receive a
          physician review within 24 hours.
        </p>

        <Link
          href="/checkout/consent"
          className="inline-flex items-center justify-center px-12 py-4.5 bg-gradient-to-r from-navy-500 to-ocean-500 text-white font-semibold rounded-full shadow-lg shadow-navy-500/30 hover:shadow-xl hover:shadow-navy-500/40 hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 text-lg"
        >
          Get Started — $50/month
        </Link>

        <div className="mt-8 flex flex-wrap justify-center gap-6 md:gap-8">
          {reassurances.map((item) => (
            <div key={item} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Check className="text-emerald-400" size={12} />
              </div>
              <span className="text-sm text-white/70">{item}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
