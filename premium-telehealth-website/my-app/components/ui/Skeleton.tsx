import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

/**
 * Shimmer skeleton placeholder for loading states.
 * Renders a gray-200 block with a left-to-right shimmer animation.
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-gray-200",
        "before:absolute before:inset-0",
        "before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent",
        "before:animate-[shimmer_1.5s_infinite]",
        "before:translate-x-[-100%]",
        className
      )}
    />
  );
}
