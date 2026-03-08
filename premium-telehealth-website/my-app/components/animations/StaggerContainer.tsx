"use client";

import { motion } from "framer-motion";

interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  /** Delay between each child animation (seconds) */
  staggerDelay?: number;
  /** Initial delay before the first child animates */
  delayChildren?: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: (custom: { stagger: number; delay: number }) => ({
    opacity: 1,
    transition: {
      staggerChildren: custom.stagger,
      delayChildren: custom.delay,
    },
  }),
};

export const itemVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.6,
      ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
    },
  },
};

/**
 * Wraps children in a staggered fade-in animation triggered on mount.
 * Pair with <StaggerItem> for each animated child.
 */
export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.1,
  delayChildren = 0.05,
}: StaggerContainerProps) {
  return (
    <motion.div
      variants={containerVariants}
      custom={{ stagger: staggerDelay, delay: delayChildren }}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Individual animated item inside a <StaggerContainer>.
 */
export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}
