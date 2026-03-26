import type { Metadata } from "next";
import { Hero } from "@/components/sections/Hero";

export const experimental_ppr = true;

export const metadata: Metadata = {
  title: "Medication-Assisted Treatment for Alcohol Addiction",
  description:
    "California-licensed physician reviews your intake in 24 hours. Naltrexone prescription sent to your pharmacy. $50/month. No appointments needed.",
};
import { HowItWorks } from "@/components/sections/HowItWorks";
import { ValueProps } from "@/components/sections/ValueProps";
import { Services } from "@/components/sections/Services";
import { Proof } from "@/components/sections/Proof";
import { Pricing } from "@/components/sections/Pricing";
import { CTA } from "@/components/sections/CTA";

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <ValueProps />
      <Services />
      <Proof />
      <Pricing />
      <CTA />
    </>
  );
}
