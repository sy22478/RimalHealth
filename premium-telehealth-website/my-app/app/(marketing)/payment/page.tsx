import { Suspense } from "react";
import type { Metadata } from "next";
import PaymentClient from "./PaymentClient";

export const metadata: Metadata = {
  title: "Complete Payment | Rimal Health",
  description: "Secure payment processing for your addiction treatment plan. Start your recovery journey today.",
};

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 pt-20 pb-20 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-ocean-500/30 border-t-ocean-500 rounded-full animate-spin" />
      </div>
    }>
      <PaymentClient />
    </Suspense>
  );
}
