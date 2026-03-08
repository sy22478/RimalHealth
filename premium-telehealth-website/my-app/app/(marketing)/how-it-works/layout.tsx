import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "Three simple steps: complete intake, doctor reviews in 24 hours, pick up prescription at your pharmacy. No appointments or video calls needed.",
};

export default function HowItWorksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
