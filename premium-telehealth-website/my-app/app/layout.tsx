import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";

// Dynamic imports for non-critical components
import dynamic from "next/dynamic";
import AnalyticsWrapper from "@/components/AnalyticsWrapper";

// Import layout wrapper with loading state
const JsonLd = dynamic(() => import("@/components/JsonLd").then(mod => mod.JsonLd), {
  ssr: true,
  loading: () => null,
});

// Preload critical font
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap", // Use swap to prevent FOIT
  preload: true,
});

// Separate viewport export for Next.js 15+
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://rimalhealth.com"),
  title: {
    default: "Rimal Health | Medication-Assisted Addiction Treatment",
    template: "%s | Rimal Health",
  },
  description:
    "California-licensed physician-prescribed treatment for alcohol addiction. No appointments. Prescription in 24 hours. $50/month.",
  keywords: [
    "addiction treatment",
    "alcohol addiction",
    "alcohol use disorder",
    "telehealth",
    "California",
    "medication-assisted treatment",
    "online doctor",
    "prescription",
    "naltrexone",
  ],
  authors: [{ name: "Rimal Health" }],
  creator: "Rimal Health",
  publisher: "Rimal Health",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://rimalhealth.com",
    siteName: "Rimal Health",
    title: "Rimal Health | Medication-Assisted Addiction Treatment",
    description:
      "Get medication to quit or reduce drinking. No appointments. Just results.",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Rimal Health - Online addiction treatment in California",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rimal Health | Medication-Assisted Addiction Treatment",
    description:
      "Get medication to quit or reduce drinking. No appointments. Just results.",
    images: ["/images/og-image.jpg"],
    creator: "@rimalhealth",
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    other: [
      {
        rel: "mask-icon",
        url: "/safari-pinned-tab.svg",
        color: "#0f172a",
      },
    ],
  },
  manifest: "/site.webmanifest",
  category: "healthcare",
};



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={instrumentSans.variable}
      suppressHydrationWarning // Suppress hydration warnings from browser extensions
    >
      <head>
        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* DNS prefetch for external resources */}
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://js.stripe.com" />

        {/* Preload critical assets */}
        {/* Note: Logo is text-based, no image preload needed */}
      </head>
      <body className={`${instrumentSans.className} antialiased`}>
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-ocean-500 focus:text-white focus:rounded-lg focus:font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ocean-500"
        >
          Skip to main content
        </a>

        {/* JSON-LD structured data - loaded dynamically but server-rendered */}
        <Suspense fallback={null}>
          <JsonLd />
        </Suspense>

        {/* Analytics - client-side only */}
        <AnalyticsWrapper />

        {/* Main content */}
        <main id="main-content" className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
