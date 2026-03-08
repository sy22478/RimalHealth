import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Rimal Health makes evidence-based addiction treatment accessible, affordable, and judgment-free for every Californian who needs it.",
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
