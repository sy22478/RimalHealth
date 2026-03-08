"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  /** Direction to animate from — "up" (default), "down", "left", "right" */
  from?: "up" | "down" | "left" | "right";
  /** Distance in px to travel from the initial hidden position */
  distance?: number;
}

const fromMap = {
  up:    { y:  30, x:  0 },
  down:  { y: -30, x:  0 },
  left:  { y:  0,  x:  30 },
  right: { y:  0,  x: -30 },
};

export function ScrollReveal({
  children,
  className,
  delay = 0,
  from = "up",
  distance,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  const initial = distance
    ? from === "up" || from === "down"
      ? { opacity: 0, y: from === "up" ? distance : -distance, x: 0 }
      : { opacity: 0, x: from === "left" ? distance : -distance, y: 0 }
    : { opacity: 0, ...fromMap[from] };

  return (
    <motion.div
      ref={ref}
      initial={initial}
      animate={isInView ? { opacity: 1, y: 0, x: 0 } : initial}
      transition={{
        duration: 0.6,
        ease: [0.25, 0.1, 0.25, 1],
        delay,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
