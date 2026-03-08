"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  title: string;
  description: string;
  isOptional?: boolean;
}

interface ProgressTrackerProps {
  sections: Section[];
  currentSection: number;
  completedSections: string[];
  percentComplete: number;
  onSectionClick?: (index: number) => void;
  className?: string;
}

export function ProgressTracker({
  sections,
  currentSection,
  completedSections,
  percentComplete,
  onSectionClick,
  className,
}: ProgressTrackerProps) {
  const [showDropdown, setShowDropdown] = React.useState(false);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-gray-700">
            Progress: {percentComplete}%
          </span>
          <span className="text-gray-500">
            {completedSections.length} of {sections.length} sections complete
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full transition-colors",
              percentComplete === 100
                ? "bg-green-500"
                : percentComplete >= 50
                ? "bg-ocean-500"
                : "bg-blue-500"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${percentComplete}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Section Navigation - Desktop */}
      <div className="hidden md:block">
        <div className="relative flex items-start justify-between">
          {/* Connecting track */}
          <div
            className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 mx-4"
            aria-hidden
          />
          {/* Active track */}
          <div
            className="absolute top-4 left-0 h-0.5 bg-ocean-500 transition-all duration-500 mx-4"
            style={{
              width: `${(Math.max(0, currentSection - 1) / (sections.length - 1)) * 100}%`,
            }}
            aria-hidden
          />

          {sections.map((section, index) => {
            const isCompleted = completedSections.includes(section.id);
            const isActive = index === currentSection;
            const isClickable = onSectionClick && (isCompleted || index <= currentSection + 1);

            return (
              <div
                key={section.id}
                className="relative flex flex-col items-center gap-2 z-10"
              >
                <button
                  type="button"
                  onClick={() => isClickable && onSectionClick(index)}
                  disabled={!isClickable}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    "border-2 transition-all duration-300",
                    "focus:outline-none focus:ring-2 focus:ring-ocean-500 focus:ring-offset-2",
                    isCompleted
                      ? "bg-ocean-500 border-ocean-500 text-white"
                      : isActive
                      ? "bg-white border-ocean-500 text-ocean-600 ring-2 ring-ocean-500/20"
                      : "bg-white border-gray-300 text-gray-400",
                    isClickable && !isActive && "hover:border-ocean-400 hover:text-ocean-500 cursor-pointer",
                    !isClickable && "cursor-not-allowed"
                  )}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`${section.title}${section.isOptional ? " (optional)" : ""}`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="text-xs font-semibold">{index + 1}</span>
                  )}
                </button>
                <span
                  className={cn(
                    "text-xs font-medium text-center max-w-[80px] leading-tight",
                    isCompleted || isActive ? "text-ocean-600" : "text-gray-400"
                  )}
                >
                  {section.title}
                </span>
                {section.isOptional && (
                  <span className="text-[10px] text-gray-400">(optional)</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section Navigation - Mobile Dropdown */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
        >
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 bg-ocean-500 text-white rounded-full text-xs font-medium">
              {currentSection + 1}
            </span>
            <span className="font-medium text-gray-900">
              {sections[currentSection]?.title}
            </span>
            {sections[currentSection]?.isOptional && (
              <span className="text-xs text-gray-500">(optional)</span>
            )}
          </div>
          <ChevronDown
            className={cn(
              "w-5 h-5 text-gray-400 transition-transform",
              showDropdown && "rotate-180"
            )}
          />
        </button>

        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden"
          >
            {sections.map((section, index) => {
              const isCompleted = completedSections.includes(section.id);
              const isActive = index === currentSection;
              const isClickable = onSectionClick && (isCompleted || index <= currentSection + 1);

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    if (isClickable) {
                      onSectionClick(index);
                      setShowDropdown(false);
                    }
                  }}
                  disabled={!isClickable}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 text-left transition-colors",
                    isActive && "bg-ocean-50",
                    !isActive && isClickable && "hover:bg-gray-50",
                    !isClickable && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium",
                      isCompleted
                        ? "bg-ocean-500 text-white"
                        : isActive
                        ? "bg-ocean-100 text-ocean-600"
                        : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {isCompleted ? <Check className="w-3 h-3" /> : index + 1}
                  </span>
                  <div className="flex-1">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isActive ? "text-ocean-700" : "text-gray-700"
                      )}
                    >
                      {section.title}
                    </span>
                    {section.isOptional && (
                      <span className="ml-2 text-xs text-gray-400">(optional)</span>
                    )}
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </div>
    </div>
  );
}
