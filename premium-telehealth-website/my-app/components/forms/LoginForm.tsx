"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";

// ============================================
// Countdown Timer Component
// ============================================

interface CountdownTimerProps {
  initialSeconds: number;
  onComplete: () => void;
}

function CountdownTimer({ initialSeconds, onComplete }: CountdownTimerProps) {
  const [seconds, setSeconds] = React.useState(initialSeconds);
  const onCompleteRef = React.useRef(onComplete);

  // Keep ref up to date with latest callback
  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  React.useEffect(() => {
    if (seconds <= 0) {
      onCompleteRef.current();
      return;
    }

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onCompleteRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return (
    <p className="text-xs text-destructive/80 mt-1">
      Try again in: {minutes}:{remainingSeconds.toString().padStart(2, "0")}
    </p>
  );
}

// ============================================
// Validation Schema
// ============================================

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginInput = z.infer<typeof loginSchema>;

// ============================================
// Login Form Component
// ============================================

export function LoginForm() {
  const [error, setError] = React.useState<string>("");
  const [warning, setWarning] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLocked, setIsLocked] = React.useState(false);
  const [remainingSeconds, setRemainingSeconds] = React.useState(0);
  const [needsVerification, setNeedsVerification] = React.useState(false);
  const [resendingVerification, setResendingVerification] = React.useState(false);
  const [resendSuccess, setResendSuccess] = React.useState(false);
  // MFA state
  const [requiresMFA, setRequiresMFA] = React.useState(false);
  const [mfaToken, setMfaToken] = React.useState("");
  const [mfaCode, setMfaCode] = React.useState("");
  const [isMFALoading, setIsMFALoading] = React.useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setError("");
    setWarning("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle account lockout
        if (result.code === "ACCOUNT_LOCKED") {
          setIsLocked(true);
          setRemainingSeconds(result.remainingSeconds || 0);
          setError(
            result.error || "Account is locked. Please try again later."
          );
          return;
        }

        // Handle email not verified — server auto-sends a verification email
        if (result.code === "EMAIL_NOT_VERIFIED") {
          setNeedsVerification(true);
          setError(
            result.error || "A verification email has been sent. Please check your inbox and spam folder, then click the link to verify your account."
          );
          return;
        }

        // Handle warning for approaching lockout
        if (result.warning) {
          setWarning(result.warning);
        }

        // Generic error for invalid credentials (don't reveal if email exists)
        setError(
          result.error || "Invalid email or password. Please try again."
        );
        return;
      }

      // Handle MFA requirement — show 6-digit code input instead of redirecting
      if (result.requiresMFA && result.mfaToken) {
        setRequiresMFA(true);
        setMfaToken(result.mfaToken);
        return;
      }

      // Validate `from` against open redirect attacks:
      // - Must start with "/"
      // - Must NOT start with "//" (protocol-relative URL)
      // - Must NOT contain "javascript:" (XSS vector, case-insensitive)
      const isValidRedirect =
        from &&
        from.startsWith("/") &&
        !from.startsWith("//") &&
        !from.toLowerCase().includes("javascript:");

      if (isValidRedirect) {
        router.push(from);
      } else if (result.user?.role === "ADMIN") {
        router.push("/admin/dashboard");
      } else if (result.user?.role === "PHYSICIAN") {
        router.push("/physician/queue");
      } else {
        // Default: PATIENT
        router.push("/patient/dashboard");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // MFA verification handler
  const handleMFAVerify = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setIsMFALoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mfaToken,
          code: mfaCode,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.code === "MFA_TOKEN_EXPIRED") {
          // Token expired — reset to login form
          setRequiresMFA(false);
          setMfaToken("");
          setMfaCode("");
          setError("MFA session expired. Please sign in again.");
          return;
        }
        if (result.code === "MFA_RATE_LIMITED") {
          setError(
            result.error || "Too many failed MFA attempts. Please try again later."
          );
          return;
        }
        setError(result.error || "Invalid verification code. Please try again.");
        return;
      }

      // MFA verified — redirect to dashboard
      const isValidRedirect =
        from &&
        from.startsWith("/") &&
        !from.startsWith("//") &&
        !from.toLowerCase().includes("javascript:");

      if (isValidRedirect) {
        router.push(from);
      } else if (result.user?.role === "ADMIN") {
        router.push("/admin/dashboard");
      } else if (result.user?.role === "PHYSICIAN") {
        router.push("/physician/queue");
      } else {
        router.push("/patient/dashboard");
      }
    } catch (err) {
      console.error("MFA verify error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsMFALoading(false);
    }
  };

  const handleResendVerification = async (): Promise<void> => {
    const email = (document.getElementById("email") as HTMLInputElement)?.value;
    if (!email) return;

    setResendingVerification(true);
    setResendSuccess(false);
    try {
      const response = await fetch("/api/auth/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setResendSuccess(true);
        setError("");
      } else if (response.status === 429) {
        setError("Too many attempts. Please wait a few minutes before trying again.");
      } else {
        setError("Failed to send verification email. Please try again.");
      }
    } catch {
      setError("Failed to send verification email. Please try again.");
    } finally {
      setResendingVerification(false);
    }
  };

  // MFA verification form
  if (requiresMFA) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <form onSubmit={handleMFAVerify} className="space-y-5">
            {/* MFA Header */}
            <div className="flex flex-col items-center gap-3 pb-2">
              <div className="p-3 bg-ocean-50 rounded-full">
                <ShieldCheck className="h-8 w-8 text-ocean-600" />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter the 6-digit code from your authenticator app to continue.
                </p>
              </div>
            </div>

            {/* Error Alert */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2"
                  role="alert"
                  aria-live="assertive"
                >
                  <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* MFA Code Input */}
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Verification Code</Label>
              <Input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={8}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                disabled={isMFALoading}
                className="h-11 text-center text-lg tracking-widest font-mono"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                You can also enter an 8-character backup code.
              </p>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isMFALoading || mfaCode.length < 6}
              className="w-full h-11 bg-gradient-to-r from-navy-600 to-ocean-600 hover:from-navy-700 hover:to-ocean-700 text-white font-semibold"
            >
              {isMFALoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Sign In"
              )}
            </Button>

            {/* Back to login */}
            <Button
              type="button"
              variant="ghost"
              className="w-full text-sm text-muted-foreground"
              onClick={() => {
                setRequiresMFA(false);
                setMfaToken("");
                setMfaCode("");
                setError("");
              }}
            >
              Back to sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" autoComplete="on">
          {/* Hidden username field for browser autofill accessibility (Chrome DOM warning fix) */}
          <input type="text" name="username" autoComplete="username" className="sr-only" tabIndex={-1} aria-hidden="true" />
          {/* Error Alert */}
          {/* Verification Success */}
          <AnimatePresence mode="wait">
            {resendSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 rounded-lg bg-green-50 border border-green-200 flex items-start gap-2"
                role="status"
                aria-live="polite"
              >
                <svg className="size-4 text-green-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-green-700">
                  Verification email sent! Check your inbox and click the link to verify your account.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error Alert */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2"
                role="alert"
                aria-live="assertive"
              >
                <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-destructive">{error}</p>
                  {isLocked && remainingSeconds > 0 && (
                    <CountdownTimer
                      initialSeconds={remainingSeconds}
                      onComplete={() => {
                        setIsLocked(false);
                        setError("");
                      }}
                    />
                  )}
                  {needsVerification && !resendSuccess && (
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendingVerification}
                      className="mt-2 text-sm font-medium text-ocean-600 hover:text-ocean-700 underline underline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resendingVerification ? "Sending..." : "Resend verification email"}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Warning Alert */}
          <AnimatePresence mode="wait">
            {warning && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-2"
                role="alert"
                aria-live="polite"
              >
                <AlertCircle className="size-4 text-warning mt-0.5 shrink-0" />
                <p className="text-sm text-warning-foreground">{warning}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              disabled={isLoading}
              aria-invalid={errors.email ? "true" : "false"}
              aria-describedby={errors.email ? "email-error" : undefined}
              className={cn(
                "h-11",
                errors.email && "border-destructive focus-visible:ring-destructive"
              )}
              {...register("email")}
            />
            <AnimatePresence>
              {errors.email && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  id="email-error"
                  className="text-sm text-destructive"
                >
                  {errors.email.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-foreground">
                Password
              </Label>
              <Link
                href="/forgot-password"
                className="text-sm text-ocean-600 hover:text-ocean-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isLoading}
                aria-invalid={errors.password ? "true" : "false"}
                aria-describedby={
                  errors.password ? "password-error" : undefined
                }
                className={cn(
                  "h-11 pr-10",
                  errors.password &&
                    "border-destructive focus-visible:ring-destructive"
                )}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <AnimatePresence>
              {errors.password && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  id="password-error"
                  className="text-sm text-destructive"
                >
                  {errors.password.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 bg-gradient-to-r from-navy-600 to-ocean-600 hover:from-navy-700 hover:to-ocean-700 text-white font-semibold"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col gap-4 pt-0">
        <div className="relative w-full">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Don&apos;t have an account?
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full h-11"
          asChild
          disabled={isLoading}
        >
          <Link href="/signup">Create Account</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default LoginForm;
