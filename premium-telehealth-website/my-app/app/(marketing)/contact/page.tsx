import type { Metadata } from "next";
import { ContactForm } from "@/components/forms/ContactForm";
import { Mail, Clock, Shield } from "lucide-react";

export const experimental_ppr = true;

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the Rimal Health team. We respond within 24 hours. For urgent medical questions, please contact a healthcare provider directly.",
};

const contactDetails = [
  {
    icon: Mail,
    title: "Email us",
    body: "support@rimalhealth.com",
    href: "mailto:support@rimalhealth.com",
  },
  {
    icon: Clock,
    title: "Response time",
    body: "Within 24 hours on business days",
    href: null,
  },
  {
    icon: Shield,
    title: "HIPAA secure",
    body: "All communications are encrypted and HIPAA-compliant",
    href: null,
  },
];

export default function ContactPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Get in touch
          </h1>
          <p className="text-lg text-gray-600">
            Have a question or need help? We&apos;ll get back to you within 24
            hours.
          </p>
        </div>
      </section>

      {/* Contact details strip */}
      <section className="py-8 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {contactDetails.map(({ icon: Icon, title, body, href }) => (
            <div
              key={title}
              className="flex items-start gap-4 bg-white border border-gray-200 rounded-xl p-5"
            >
              <div className="w-10 h-10 rounded-full bg-ocean-500/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-ocean-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{title}</p>
                {href ? (
                  <a
                    href={href}
                    className="text-sm text-ocean-500 hover:text-ocean-600 transition-colors"
                  >
                    {body}
                  </a>
                ) : (
                  <p className="text-sm text-gray-600">{body}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Form */}
      <section className="py-16 px-4">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Send us a message
          </h2>
          <ContactForm />
        </div>
      </section>

      {/* Medical disclaimer */}
      <section className="py-8 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs text-gray-500 leading-relaxed text-center">
            <strong>Important:</strong> This contact form is for general
            inquiries only. Do not submit protected health information (PHI)
            here. For medical emergencies, call 911. For urgent mental health
            support, call or text 988 (Suicide &amp; Crisis Lifeline).
          </p>
        </div>
      </section>
    </>
  );
}
