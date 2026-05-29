import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Medical Weight Management with Wegovy | Rimal Health",
  description:
    "Physician-prescribed Wegovy (semaglutide) for weight management. California-licensed physician evaluation, personalized treatment plans. $50/month.",
  openGraph: {
    title: "Medical Weight Management with Wegovy | Rimal Health",
    description:
      "Physician-prescribed Wegovy (semaglutide) for weight management. California-licensed physician evaluation, personalized treatment plans. $50/month.",
    url: "/weight-management",
  },
};

export default function WeightManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
