"use client";

import { motion } from "framer-motion";
import { CalendarX2, BadgeDollarSign, Stethoscope } from "lucide-react";

const values = [
  {
    icon: CalendarX2,
    title: "No appointments",
    /* TASK-C01: physician not doctor */
    body: "Skip the video calls. Complete your intake on your schedule. Physician reviews within 24 hours.",
  },
  {
    icon: BadgeDollarSign,
    title: "$50/month",
    body: "One flat fee. No surprise charges. Cancel anytime.",
  },
  {
    icon: Stethoscope,
    title: "Physician-prescribed",
    body: "California-licensed physician. FDA-approved medications proven to work.",
  },
];

export function ValueProps() {
  return (
    <section className="relative overflow-hidden bg-navy py-20 md:py-28 lg:py-32 px-4">
      {/* Subtle mesh background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-ocean-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl md:text-4xl font-semibold text-white text-center mb-16"
        >
          Built for busy people who want real solutions
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {values.map((value, index) => {
            const Icon = value.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: index * 0.12, ease: "easeOut" }}
                className="group relative bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/8 hover:border-white/20 transition-all duration-300 backdrop-blur-sm"
              >
                {/* Icon */}
                <div className="w-11 h-11 rounded-lg bg-ocean-500/20 flex items-center justify-center mb-5">
                  <Icon className="text-ocean-400" size={22} />
                </div>

                <h3 className="text-xl font-bold text-white mb-3">
                  {value.title}
                </h3>
                <p className="text-base text-white/70 leading-relaxed">
                  {value.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
