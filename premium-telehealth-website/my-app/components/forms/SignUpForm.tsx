"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, Check, AlertCircle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ============================================
// Password Strength Indicator
// ============================================

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

function calculatePasswordStrength(password: string): PasswordStrength {
  let score = 0;
  const checks = {
    length: password.length >= 12,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;
  score = passedChecks;

  if (score <= 1) return { score, label: "Weak", color: "bg-destructive" };
  if (score <= 3) return { score, label: "Fair", color: "bg-warning" };
  if (score === 4) return { score, label: "Good", color: "bg-ocean-500" };
  return { score, label: "Strong", color: "bg-success" };
}

// ============================================
// Validation Schema
// ============================================

const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[A-Z]/, "Must contain uppercase letter")
    .regex(/[a-z]/, "Must contain lowercase letter")
    .regex(/[0-9]/, "Must contain number")
    .regex(/[^A-Za-z0-9]/, "Must contain special character"),
  confirmPassword: z.string(),
  termsAccepted: z.boolean().refine((v) => v === true, "You must accept the Terms of Service and Privacy Policy"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignUpInput = z.infer<typeof signUpSchema>;

// ============================================
// Sign Up Form Component
// ============================================

export function SignUpForm() {
  const [error, setError] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [passwordStrength, setPasswordStrength] = React.useState<PasswordStrength>({
    score: 0,
    label: "",
    color: "",
  });
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    setValue,
    trigger,
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    mode: "onBlur",
    defaultValues: {
      termsAccepted: false,
    },
  });

  // Watch password for strength indicator
  const password = watch("password");
  React.useEffect(() => {
    if (password) {
      setPasswordStrength(calculatePasswordStrength(password));
    } else {
      setPasswordStrength({ score: 0, label: "", color: "" });
    }
  }, [password]);

  const onSubmit = async (data: SignUpInput) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          confirmPassword: data.confirmPassword,
          termsAccepted: data.termsAccepted,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific error codes from API
        if (result.code === "VALIDATION_ERROR") {
          setError("Please check your input and try again.");
        } else if (result.code === "WEAK_PASSWORD") {
          setError("Password does not meet strength requirements.");
        } else if (result.code === "REGISTRATION_ERROR") {
          setError("Registration failed. This email may already be registered.");
        } else {
          setError(result.error || "Registration failed. Please try again.");
        }
        return;
      }

      // Redirect to checkout payment page
      router.push("/checkout/payment");
    } catch (err) {
      console.error("Registration error:", err);
      setError("An unexpected error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
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
            <Label htmlFor="password" className="text-foreground">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password"
                autoComplete="new-password"
                disabled={isLoading}
                aria-invalid={errors.password ? "true" : "false"}
                aria-describedby={
                  errors.password ? "password-error" : "password-requirements"
                }
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

            {/* Password Strength Indicator */}
            {password && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1"
              >
                <div className="flex gap-1 h-1.5">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={cn(
                        "flex-1 rounded-full transition-all duration-300",
                        level <= passwordStrength.score
                          ? passwordStrength.color
                          : "bg-muted"
                      )}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Password strength: {" "}
                  <span
                    className={cn(
                      "font-medium",
                      passwordStrength.score <= 2 && "text-destructive",
                      passwordStrength.score === 3 && "text-warning",
                      passwordStrength.score >= 4 && "text-success"
                    )}
                  >
                    {passwordStrength.label}
                  </span>
                </p>
              </motion.div>
            )}

            {/* Password Requirements Hint */}
            <p id="password-requirements" className="text-xs text-muted-foreground">
              Must be at least 12 characters with uppercase, lowercase, number, and special character.
            </p>

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

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-foreground">
              Confirm Password
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                autoComplete="new-password"
                disabled={isLoading}
                aria-invalid={errors.confirmPassword ? "true" : "false"}
                aria-describedby={errors.confirmPassword ? "confirm-error" : undefined}
                className={cn(
                  "h-11 pr-10",
                  errors.confirmPassword && "border-destructive focus-visible:ring-destructive"
                )}
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <AnimatePresence>
              {errors.confirmPassword && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  id="confirm-error"
                  className="text-sm text-destructive"
                >
                  {errors.confirmPassword.message}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Terms Checkbox */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="termsAccepted"
                disabled={isLoading}
                checked={watch("termsAccepted")}
                onCheckedChange={(checked) => {
                  setValue("termsAccepted", checked === true);
                  trigger("termsAccepted");
                }}
                aria-invalid={errors.termsAccepted ? "true" : "false"}
                aria-describedby={errors.termsAccepted ? "terms-error" : undefined}
                className={cn(
                  "mt-0.5",
                  errors.termsAccepted && "border-destructive data-[state=checked]:bg-destructive"
                )}
              />
              <Label
                htmlFor="termsAccepted"
                className="text-sm text-muted-foreground font-normal cursor-pointer leading-relaxed"
              >
                I agree to the{" "}
                <Link
                  href="/terms"
                  className="text-ocean-600 hover:text-ocean-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  target="_blank"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="text-ocean-600 hover:text-ocean-700 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  target="_blank"
                >
                  Privacy Policy
                </Link>
                . I understand this is a telehealth service and consent to receive care electronically.
              </Label>
            </div>
            <AnimatePresence>
              {errors.termsAccepted && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  id="terms-error"
                  className="text-sm text-destructive ml-7"
                >
                  {errors.termsAccepted.message}
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
                Creating account...
              </>
            ) : (
              "Create Account"
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
              Already have an account?
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full h-11"
          asChild
          disabled={isLoading}
        >
          <Link href="/login">Sign In</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default SignUpForm;
