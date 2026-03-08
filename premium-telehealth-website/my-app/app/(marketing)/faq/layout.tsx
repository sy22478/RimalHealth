import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Answers to common questions about our process, medications, pricing, privacy, and eligibility for medication-assisted addiction treatment.",
};

export default function FAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
