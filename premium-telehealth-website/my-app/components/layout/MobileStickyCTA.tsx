"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

export function MobileStickyCTA() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 lg:hidden z-50 shadow-[0_-4px_20px_rgba(15,23,42,0.08)]"
        >
          <Link
            href="/checkout/consent"
            className="flex items-center justify-center w-full py-4 rounded-full font-semibold text-white bg-gradient-to-r from-navy-600 to-ocean-500 shadow-lg shadow-navy-600/20 active:scale-[0.98] transition-transform"
          >
            Get Started — $50/month
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
