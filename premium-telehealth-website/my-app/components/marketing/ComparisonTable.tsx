"use client";

import { motion } from "framer-motion";
import { Check, X, Minus } from "lucide-react";

interface ComparisonFeature {
  name: string;
  rimal: string | boolean;
  traditional: string | boolean;
  inPerson?: string | boolean;
}

interface ComparisonTableProps {
  features: ComparisonFeature[];
  showInPerson?: boolean;
}

export function ComparisonTable({
  features,
  showInPerson = false,
}: ComparisonTableProps) {
  const renderCell = (value: string | boolean) => {
    if (typeof value === "boolean") {
      return value ? (
        <Check className="w-5 h-5 text-emerald-500 mx-auto" />
      ) : (
        <X className="w-5 h-5 text-gray-300 mx-auto" />
      );
    }
    return <span className="text-gray-700">{value}</span>;
  };

  return (
    <motion.div
      className="overflow-x-auto"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <table className="w-full bg-white border border-gray-200 rounded-xl overflow-hidden">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left py-4 px-6 font-semibold text-gray-900">
              Feature
            </th>
            <th className="text-center py-4 px-6 font-semibold text-ocean-600 bg-ocean-500/5 min-w-[140px]">
              Rimal Health
            </th>
            <th className="text-center py-4 px-6 font-semibold text-gray-900 min-w-[140px]">
              Traditional Telehealth
            </th>
            {showInPerson && (
              <th className="text-center py-4 px-6 font-semibold text-gray-900 min-w-[140px]">
                In-Person Treatment
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {features.map((feature, index) => (
            <tr
              key={index}
              className="border-t border-gray-200 hover:bg-gray-50/50 transition-colors"
            >
              <td className="py-4 px-6 font-medium text-gray-900">
                {feature.name}
              </td>
              <td className="py-4 px-6 text-center bg-ocean-500/5">
                {renderCell(feature.rimal)}
              </td>
              <td className="py-4 px-6 text-center">
                {renderCell(feature.traditional)}
              </td>
              {showInPerson && feature.inPerson !== undefined && (
                <td className="py-4 px-6 text-center">
                  {renderCell(feature.inPerson)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
}

// Predefined comparison data for Rimal Health
export const rimalComparisonFeatures: ComparisonFeature[] = [
  {
    name: "Monthly cost",
    rimal: "$50/month",
    traditional: "$200–400/month",
    inPerson: "$1,500–3,000/month",
  },
  {
    name: "Wait time for prescription",
    rimal: "24 hours",
    traditional: "3–7 days",
    inPerson: "Same day (with appointment)",
  },
  {
    name: "Appointments required",
    rimal: "None (async messaging)",
    traditional: "2–4 per month",
    inPerson: "10–15 hrs/week",
  },
  {
    name: "Messaging access",
    rimal: "24/7 unlimited",
    traditional: "Office hours only",
    inPerson: false,
  },
  {
    name: "Insurance billing",
    rimal: "Medication only",
    traditional: "Full billing",
    inPerson: "Full billing",
  },
  {
    name: "Setup fees",
    rimal: false,
    traditional: "$50–100",
    inPerson: "$500–1,000",
  },
  {
    name: "Cancellation fees",
    rimal: false,
    traditional: true,
    inPerson: true,
  },
  {
    name: "California licensed physicians",
    rimal: true,
    traditional: "Varies",
    inPerson: true,
  },
];
