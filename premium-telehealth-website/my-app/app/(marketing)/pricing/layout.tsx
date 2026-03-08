import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "$50/month during active treatment. Includes doctor review, prescription management, unlimited messaging, refills, and adjustments. No hidden fees. Cancel anytime.",
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
