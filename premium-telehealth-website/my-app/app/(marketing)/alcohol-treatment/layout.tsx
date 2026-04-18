import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alcohol Addiction Treatment",
  description:
    "Physician-prescribed Naltrexone for alcohol use disorder. No appointments. California-licensed physician review in 24 hours. $50/month.",
  openGraph: {
    title: "Alcohol Treatment",
    description:
      "Physician-prescribed Naltrexone for alcohol use disorder. No appointments. California-licensed physician review in 24 hours. $50/month.",
    url: "/alcohol-treatment",
  },
};

export default function AlcoholTreatmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
