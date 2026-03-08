"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, LogOut, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * Logout Page
 * 
 * Handles client-side logout by clearing tokens and calling the logout API.
 * Automatically redirects to home page after logout.
 */
export default function LogoutPage() {
  const [isLoggingOut, setIsLoggingOut] = React.useState(true);
  const [isComplete, setIsComplete] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const performLogout = async () => {
      try {
        // Call logout API (cookies are cleared server-side)
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        setIsComplete(true);
        
        // Redirect to home page after a short delay
        setTimeout(() => {
          router.push("/");
          router.refresh();
        }, 1500);
      } catch (error) {
        console.error("Logout error:", error);
        // Still redirect even if API call fails
        router.push("/");
      } finally {
        setIsLoggingOut(false);
      }
    };

    performLogout();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-navy-50 via-white to-ocean-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-ocean-100 rounded-full flex items-center justify-center mb-4">
            {isComplete ? (
              <CheckCircle className="w-8 h-8 text-success" aria-hidden="true" />
            ) : (
              <LogOut className="w-8 h-8 text-ocean-600" aria-hidden="true" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-navy-800">
            {isComplete ? "Signed Out" : "Signing Out..."}
          </h1>
        </CardHeader>
        
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground">
            {isComplete
              ? "You have been successfully signed out. Redirecting you to the home page..."
              : "Please wait while we sign you out securely..."}
          </p>

          {isLoggingOut && !isComplete && (
            <div className="flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-ocean-600" />
            </div>
          )}

          {isComplete && (
            <Button asChild variant="outline">
              <Link href="/">Go to Home Page</Link>
            </Button>
          )}
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
