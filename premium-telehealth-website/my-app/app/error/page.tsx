import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, Home, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Something Went Wrong",
  description: "We ran into a problem. Please try again or contact support.",
  robots: {
    index: false,
    follow: false,
  },
};

const REASON_MESSAGES: Record<string, { title: string; body: string }> = {
  'subscription-check-failed': {
    title: "We couldn't verify your subscription",
    body: "We had trouble checking your subscription status. Please try again in a moment, or contact support if the problem continues.",
  },
  'intake-check-failed': {
    title: "We couldn't load your intake",
    body: "We had trouble loading your intake form. Please try again in a moment, or contact support if the problem continues.",
  },
};

interface ErrorPageProps {
  searchParams: Promise<{ reason?: string }>;
}

export default async function ErrorPage({ searchParams }: ErrorPageProps) {
  const params = await searchParams;
  const reason = params.reason ?? '';
  const message = REASON_MESSAGES[reason] ?? {
    title: 'Something went wrong',
    body: "We hit an unexpected problem. Please try again, and contact support if this keeps happening.",
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-navy-50 via-white to-ocean-50">
      <div className="mb-8 flex items-center gap-2">
        <div className="w-10 h-10 bg-gradient-to-br from-navy-600 to-ocean-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold">R</span>
        </div>
        <span className="font-semibold text-navy-800 text-lg">Rimal Health</span>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-amber-600" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-navy-800">{message.title}</h1>
        </CardHeader>

        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground">{message.body}</p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild className="gap-2">
              <Link href="/patient/dashboard" className="gap-2">
                <Home className="w-4 h-4" />
                Try Again
              </Link>
            </Button>

            <Button asChild variant="outline" className="gap-2">
              <Link href="/contact" className="gap-2">
                <LifeBuoy className="w-4 h-4" />
                Contact Support
              </Link>
            </Button>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Need more help? Email{" "}
              <a
                href="mailto:support@rimalhealth.com"
                className="text-ocean-600 hover:text-ocean-700 underline underline-offset-2"
              >
                support@rimalhealth.com
              </a>
            </p>
          </div>
        </CardContent>
      </Card>

      <footer className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Rimal Health. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
