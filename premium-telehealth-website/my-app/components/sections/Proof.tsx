"use client";

import { motion } from "framer-motion";
import { CountUp } from "@/components/animations/CountUp";

/*
 * TASK-V03: Proof.tsx homepage statistics compliance review
 *
 * DO NOT publish unverified social proof:
 * - "1,200+ people helped" — removed until actual patient count is confirmed
 * - "4.9/5 rating" — removed until sourced from a verified review platform (e.g. Google, Healthgrades)
 * - "$60 typical monthly cost" — corrected to $50/month (matches stated service pricing)
 * - "75% reduction" — hedged per TASK-C03
 * - Patient testimonial removed until a real story with written consent is on file.
 *
 * When real numbers are available, document the source in a code comment and restore the claims.
 */

const stats = [
  /* TASK-C03: hedge — "up to" and "results vary" required on outcome claims */
  /* Source: COMBINE study, Anton et al., JAMA 2006; doi:10.1001/jama.295.17.2003 */
  { prefix: "Up to ", end: 75, suffix: "%", label: "reduction in drinking in clinical studies (results vary)" },
  { end: 24, suffix: " hours", label: "avg. prescription review time" },
  { prefix: "$", end: 50, suffix: "/month", label: "all-inclusive service fee" },
  { end: 12, suffix: " weeks", label: "standard treatment program" },
];

export function Proof() {
  return (
    <section className="bg-gray-900 py-20 md:py-24 lg:py-32 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-5xl font-bold text-white text-center mb-16"
        >
          {/* TASK-V03: "1,200+ people helped" removed — unverified; restore with real count when available */}
          Helping Californians reclaim their health
        </motion.h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 text-center mb-16">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <div className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
                <CountUp
                  end={stat.end}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  duration={2}
                />
              </div>
              <div className="text-sm md:text-base text-gray-400 mt-2">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Clinical evidence card — replaces illustrative testimonial until a real patient story with written consent is on file */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="max-w-2xl mx-auto"
        >
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 md:p-10 text-center">
            <div className="text-sm font-semibold uppercase tracking-wide text-ocean-300 mb-3">
              Clinical evidence
            </div>
            <p className="text-xl md:text-2xl text-white leading-relaxed">
              In controlled clinical studies, medication-assisted treatment has shown
              up to a 75% reduction in heavy drinking days and sustained reductions in
              alcohol cravings.
            </p>
            <p className="text-sm text-gray-400 mt-4">
              Source: COMBINE study (Anton et al., JAMA 2006). Individual results vary.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
