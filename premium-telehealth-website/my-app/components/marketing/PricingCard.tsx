"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";

interface PricingCardProps {
  title: string;
  price: number;
  period?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  ctaText: string;
  ctaHref: string;
  ctaVariant?: "primary" | "secondary";
  footer?: string;
  delay?: number;
}

export function PricingCard({
  title,
  price,
  period = "/month",
  description,
  features,
  highlighted = false,
  badge,
  ctaText,
  ctaHref,
  ctaVariant = "primary",
  footer,
  delay = 0,
}: PricingCardProps) {
  return (
    <motion.div
      className={`relative rounded-2xl p-8 ${
        highlighted
          ? "bg-white border-2 border-ocean-500 shadow-xl shadow-ocean-500/10"
          : "bg-white border border-gray-200"
      }`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {/* Badge */}
      {badge && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-ocean-500 to-blue-500 text-white text-sm font-semibold px-4 py-1.5 rounded-full shadow-lg">
            <Sparkles className="w-3.5 h-3.5" />
            {badge}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-5xl font-bold text-gray-900">${price}</span>
          <span className="text-gray-500">{period}</span>
        </div>
        <p className="text-sm text-gray-600 mt-2">{description}</p>
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-ocean-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3 h-3 text-ocean-500" />
            </div>
            <span className="text-gray-700 text-sm">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <Link
        href={ctaHref}
        className={`block w-full text-center font-semibold py-3 px-6 rounded-lg transition-all duration-200 ${
          ctaVariant === "primary"
            ? "bg-gradient-to-r from-blue-500 to-ocean-500 text-white shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5"
            : "bg-white text-gray-900 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
        }`}
      >
        {ctaText}
      </Link>

      {/* Footer note */}
      {footer && (
        <p className="text-xs text-gray-500 text-center mt-4 italic">{footer}</p>
      )}
    </motion.div>
  );
}
