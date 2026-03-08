import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Account",
  description: "Sign in or create an account to access Rimal Health services.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-navy-50 via-white to-ocean-50">
      {/* Header */}
      <header className="w-full py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 rounded-lg"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-navy-600 to-ocean-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <span className="font-semibold text-lg text-navy-700">Rimal Health</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="w-full max-w-md">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-muted-foreground">
            By using Rimal Health, you agree to our{" "}
            <Link 
              href="/terms" 
              className="text-ocean-600 hover:text-ocean-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link 
              href="/privacy" 
              className="text-ocean-600 hover:text-ocean-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Privacy Policy
            </Link>
            .
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            © {new Date().getFullYear()} Rimal Health. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
