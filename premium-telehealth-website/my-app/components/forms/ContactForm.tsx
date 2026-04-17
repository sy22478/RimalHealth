"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  subject: z.enum(["general", "billing", "technical", "medical"] as const, {
    message: "Please select a subject",
  }),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(1000, "Message must be under 1,000 characters"),
});

type ContactFormValues = z.infer<typeof contactSchema>;

const subjectOptions = [
  { value: "general", label: "General inquiry" },
  { value: "billing", label: "Billing & payments" },
  { value: "technical", label: "Technical support" },
  { value: "medical", label: "Medical question" },
];

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
  });

  async function onSubmit(data: ContactFormValues) {
    setSubmitError(null);
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setSubmitError(
        (body as { error?: string }).error ??
          "Something went wrong. Please try again."
      );
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="text-center py-16"
      >
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-2xl font-semibold text-gray-900 mb-3">
          Message sent
        </h3>
        <p className="text-base text-gray-600">
          We&apos;ll get back to you within 24 hours at the email you provided.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {/* Name */}
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-semibold text-gray-900 mb-1.5"
        >
          Full name <span className="text-ocean-500">*</span>
        </label>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          placeholder="Jane Smith"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
          {...register("name")}
        />
        <AnimatePresence>
          {errors.name && (
            <motion.p
              id="name-error"
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-red-500 mt-1.5"
            >
              {errors.name.message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Email */}
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-semibold text-gray-900 mb-1.5"
        >
          Email address <span className="text-ocean-500">*</span>
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="jane@example.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
        <AnimatePresence>
          {errors.email && (
            <motion.p
              id="email-error"
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-red-500 mt-1.5"
            >
              {errors.email.message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Subject */}
      <div>
        <label
          htmlFor="subject"
          className="block text-sm font-semibold text-gray-900 mb-1.5"
        >
          Subject <span className="text-ocean-500">*</span>
        </label>
        <Controller
          control={control}
          name="subject"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id="subject"
                aria-invalid={!!errors.subject}
                aria-describedby={errors.subject ? "subject-error" : undefined}
              >
                <SelectValue placeholder="Select a subject…" />
              </SelectTrigger>
              <SelectContent>
                {subjectOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <AnimatePresence>
          {errors.subject && (
            <motion.p
              id="subject-error"
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-red-500 mt-1.5"
            >
              {errors.subject.message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Message */}
      <div>
        <label
          htmlFor="message"
          className="block text-sm font-semibold text-gray-900 mb-1.5"
        >
          Message <span className="text-ocean-500">*</span>
        </label>
        <Textarea
          id="message"
          rows={5}
          placeholder="How can we help you?"
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "message-error" : undefined}
          className="resize-none"
          {...register("message")}
        />
        <AnimatePresence>
          {errors.message && (
            <motion.p
              id="message-error"
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-red-500 mt-1.5"
            >
              {errors.message.message}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Privacy note */}
      <p className="text-xs text-gray-500 leading-relaxed">
        By submitting this form you agree to our{" "}
        <a href="/privacy" className="underline hover:text-gray-700">
          Privacy Policy
        </a>
        . We will never share your information with third parties. For urgent
        medical questions, please contact a healthcare provider directly.
      </p>

      {/* Submission error */}
      {submitError && (
        <p role="alert" className="text-sm text-red-500">
          {submitError}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        {isSubmitting ? (
          <>
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Send message
          </>
        )}
      </button>
    </form>
  );
}
