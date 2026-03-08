import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Access Denied",
  description: "You do not have permission to access this page.",
  robots: {
    index: false,
    follow: false,
  },
};

interface UnauthorizedPageProps {
  searchParams: Promise<{ required?: string }>;
}

export default async function UnauthorizedPage({
  searchParams,
}: UnauthorizedPageProps) {
  const params = await searchParams;
  const requiredPath = params.required;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-navy-50 via-white to-ocean-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-destructive" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-navy-800">Access Denied</h1>
        </CardHeader>
        
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground">
            You don&apos;t have permission to access this page. This area is restricted 
            to authorized users only.
          </p>

          {requiredPath && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Attempted to access: <code className="text-foreground">{requiredPath}</code>
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild variant="outline">
              <Link href="/" className="gap-2">
                <Home className="w-4 h-4" />
                Go Home
              </Link>
            </Button>
            
            <Button asChild className="gap-2">
              <Link href="/login" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </Button>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              If you believe this is an error, please{" "}
              <Link 
                href="/contact" 
                className="text-ocean-600 hover:text-ocean-700 underline underline-offset-2"
              >
                contact support
              </Link>
              .
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <footer className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Rimal Health. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
