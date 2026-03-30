"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, AlertCircle, Stethoscope } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ============================================
// Types
// ============================================

interface LoginResponse {
  user: {
    id: string;
    email: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  redirectUrl: string;
}

// ============================================
// Validation Schema
// ============================================

const physicianLoginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type PhysicianLoginInput = z.infer<typeof physicianLoginSchema>;

// ============================================
// Physician Login Form Component
// ============================================

export function PhysicianLoginForm() {
  const [error, setError] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PhysicianLoginInput>({
    resolver: zodResolver(physicianLoginSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data: PhysicianLoginInput) => {
    setIsLoading(true);
    setError("");

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

      const result: LoginResponse = await response.json();

      if (!response.ok) {
        // Generic error message to prevent email enumeration attacks
        setError("Invalid email or password. Please try again.");
        return;
      }

      // Validate that user has PHYSICIAN or ADMIN role
      if (result.user?.role !== "PHYSICIAN" && result.user?.role !== "ADMIN") {
        setError("This login is for physicians only. Please use the patient login page.");
        return;
      }

      // Redirect to physician queue (ADMIN also uses physician portal)
      const redirectUrl = "/physician/queue";
      router.push(redirectUrl);
    } catch (err) {
      // HIPAA-compliant: Don't log PHI or sensitive details
      setError("An unexpected error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto border-navy-100">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="doctor@rimalhealth.com"
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
                aria-describedby={errors.password ? "password-error" : undefined}
                className={cn(
                  "h-11 pr-10",
                  errors.password && "border-destructive focus-visible:ring-destructive"
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
              <>
                <Stethoscope className="mr-2 size-4" />
                Physician Sign In
              </>
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
              Patient Access
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full h-11"
          asChild
          disabled={isLoading}
        >
          <Link href="/login">Patient Login</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default PhysicianLoginForm;
