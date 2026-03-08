"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingButtonProps {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary";
  className?: string;
}

/**
 * Button with an animated loading state.
 * Swaps label for a spinner + "Processing…" when loading=true.
 */
export function LoadingButton({
  children,
  loading = false,
  disabled = false,
  onClick,
  type = "button",
  variant = "primary",
  className,
}: LoadingButtonProps) {
  const isDisabled = loading || disabled;

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      whileHover={!isDisabled ? { y: -2 } : {}}
      whileTap={!isDisabled ? { scale: 0.98 } : {}}
      transition={{ duration: 0.2 }}
      className={cn(
        "relative overflow-hidden inline-flex items-center justify-center",
        "px-8 py-3.5 rounded-lg font-semibold text-base transition-all duration-200",
        variant === "primary" && [
          "bg-gradient-to-r from-blue-500 to-ocean-500 text-white",
          "shadow-[0_4px_12px_rgba(59,130,246,0.2)]",
          !isDisabled && "hover:shadow-[0_6px_20px_rgba(59,130,246,0.3)]",
        ],
        variant === "secondary" && [
          "bg-white text-navy border border-gray-200",
          !isDisabled && "hover:bg-gray-50",
        ],
        isDisabled && "opacity-70 cursor-not-allowed",
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.span
            key="loading"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing…
          </motion.span>
        ) : (
          <motion.span
            key="content"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
