"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  max?: number
}

function Progress({ 
  className, 
  value = 0, 
  max = 100,
  ...props 
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
      {...props}
    >
      <div
        className="h-full w-full flex-1 bg-ocean-500 transition-all duration-300 ease-in-out"
        style={{ transform: `translateX(-${100 - percentage}%)` }}
      />
    </div>
  )
}

export { Progress }
