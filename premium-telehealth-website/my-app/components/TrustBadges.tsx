"use client";

import { useState } from "react";
import { ShieldCheck, Lock, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TrustBadgesProps {
  className?: string;
}

const badges = [
  {
    icon: ShieldCheck,
    text: "California Medical Board Licensed",
    tooltip: "Dr. Rabah holds an active California medical license and is dual board-certified in Emergency Medicine and Addiction Medicine.",
  },
  {
    icon: Lock,
    text: "HIPAA Secure",
    tooltip: "Your health information is encrypted end-to-end and handled in full compliance with HIPAA regulations.",
  },
  {
    icon: Clock,
    text: "24hr Review",
    tooltip: "Your intake is reviewed by our physician within 24 hours — typically sooner on business days.",
  },
];

function TrustBadge({
  icon: Icon,
  text,
  tooltip,
}: {
  icon: React.ElementType;
  text: string;
  tooltip: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="relative inline-flex items-center gap-2 cursor-default"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
      role="img"
      aria-label={`${text}: ${tooltip}`}
    >
      <Icon className="w-5 h-5 text-ocean-500 flex-shrink-0" />
      <span className="text-sm font-medium text-gray-600">{text}</span>

      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-20 pointer-events-none"
          >
            <div className="bg-navy text-white text-xs leading-relaxed rounded-lg px-3 py-2 shadow-lg max-w-[220px] text-center">
              {tooltip}
            </div>
            {/* Arrow */}
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-navy rotate-45 -mt-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TrustBadges({ className = "" }: TrustBadgesProps) {
  return (
    <div className={`flex flex-wrap gap-4 justify-center ${className}`}>
      {badges.map((badge) => (
        <TrustBadge key={badge.text} {...badge} />
      ))}
    </div>
  );
}
