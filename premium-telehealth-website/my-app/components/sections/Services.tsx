"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionWrapper } from "@/components/sections/SectionWrapper";

const services = [
  {
    title: "Alcohol addiction",
    description:
      "Reduce or quit drinking with Naltrexone, a medication that blocks cravings. Physician-prescribed and tailored to your goals.",
    link: "/alcohol-treatment",
    linkText: "See alcohol treatment",
    accentFrom: "from-amber-400/20",
    accentTo: "to-orange-400/10",
    accentBorder: "border-amber-400/30",
    pill: "Alcohol Use Disorder",
    pillColor: "bg-amber-400/10 text-amber-700 border-amber-400/20",
  },
  {
    title: "Weight management",
    description:
      "Physician-managed GLP-1 (Wegovy) weight management for adults who meet clinical eligibility, with ongoing monitoring and dose guidance.",
    link: "/weight-management",
    linkText: "See weight management",
    accentFrom: "from-ocean-400/20",
    accentTo: "to-ocean-500/10",
    accentBorder: "border-ocean-400/30",
    pill: "Weight Management",
    pillColor: "bg-ocean-400/10 text-ocean-700 border-ocean-400/20",
  },
];

export function Services() {
  return (
    <SectionWrapper>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-14"
      >
        What we treat
      </motion.h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10 max-w-5xl mx-auto">
        {services.map((service, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: index * 0.15 }}
            whileHover={{ y: -4, boxShadow: "0 16px 48px rgba(15,23,42,0.10)" }}
            className={`relative overflow-hidden bg-gradient-to-br ${service.accentFrom} ${service.accentTo} border ${service.accentBorder} rounded-2xl p-8 md:p-10 cursor-default`}
          >
            {/* White inner card */}
            <div className="absolute inset-[1px] rounded-2xl bg-white/90" />

            <div className="relative">
              {/* Pill */}
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${service.pillColor} mb-5`}>
                {service.pill}
              </span>

              <h3 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-4">
                {service.title}
              </h3>
              <p className="text-base md:text-lg text-gray-600 leading-relaxed mb-8">
                {service.description}
              </p>
              <Link
                href={service.link}
                className="group inline-flex items-center gap-2 text-ocean-600 font-semibold hover:text-ocean-700 transition-colors"
              >
                {service.linkText}
                <ArrowRight
                  size={16}
                  className="group-hover:translate-x-1 transition-transform duration-200"
                />
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
    </SectionWrapper>
  );
}
