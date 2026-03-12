import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/integrations/sendgrid";
import { EmailTemplate } from "@/lib/notifications/templates";

// Mirror the client-side schema (server-side re-validation)
const intakeSchema = z.object({
  firstName: z.string().min(1),
  lastInitial: z.string().length(1),
  email: z.string().email(),
  phone: z.string().optional(),
  ageRange: z.string(),
  state: z.literal("California"),
  treatmentType: z.literal("Alcohol"),
  drinksPerWeek: z.string().optional(),
  alcoholGoal: z.string().optional(),
  triedQuitting: z.string().optional(),
  currentMedications: z.string().optional(),
  medicalConditions: z.string().optional(),
  hipaaConsent: z.literal(true),
  termsConsent: z.literal(true),
  telehealthConsent: z.literal(true),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = intakeSchema.parse(body);

    const toEmail =
      process.env.CONTACT_FORM_TO_EMAIL ?? "support@rimalhealth.com";

    const treatmentDetails = [
      `Drinks per week: ${data.drinksPerWeek ?? "Not specified"}`,
      `Goal: ${data.alcoholGoal ?? "Not specified"}`,
    ];

    const intakeHtml = [
      "<p><strong>New patient intake — please review within 24 hours.</strong></p>",
      "<p><strong>PATIENT</strong><br>",
      `Name: ${data.firstName} ${data.lastInitial}.<br>`,
      `Email: ${data.email}<br>`,
      `Phone: ${data.phone ?? "Not provided"}<br>`,
      `Age range: ${data.ageRange}<br>`,
      `State: ${data.state}</p>`,
      "<p><strong>TREATMENT</strong><br>",
      `Type: ${data.treatmentType}<br>`,
      treatmentDetails.join("<br>"),
      "</p>",
      "<p><strong>HISTORY</strong><br>",
      `Current medications: ${data.currentMedications || "None listed"}<br>`,
      `Medical conditions: ${data.medicalConditions || "None listed"}</p>`,
      "<p><strong>CONSENTS</strong><br>",
      "HIPAA: yes | Terms of Service: yes | Telehealth: yes</p>",
    ].join("\n");

    // Notify clinical team
    await sendEmail({
      to: toEmail,
      template: EmailTemplate.GENERIC_NOTIFICATION,
      data: {
        subject: `New intake: ${data.treatmentType} — ${data.firstName} ${data.lastInitial}.`,
        message: intakeHtml,
      },
    });

    // Send confirmation to patient (non-critical — don't throw if it fails)
    const confirmMessage = [
      `Hi ${data.firstName},`,
      "<br><br>",
      "We received your intake form. A California-licensed physician will review your information within 24 hours.",
      "<br><br>",
      "If you have urgent concerns, please call 911 or go to your nearest emergency room.",
      "<br><br>",
      "Questions? Email us at support@rimalhealth.com.",
      "<br><br>",
      "— Rimal Health",
    ].join("");

    await sendEmail({
      to: data.email,
      template: EmailTemplate.GENERIC_NOTIFICATION,
      data: {
        subject: "We received your intake form — Rimal Health",
        message: confirmMessage,
      },
    }).catch(() => {
      // Confirmation email failure is non-critical; clinical notification already sent
      console.error("Patient confirmation email failed (non-critical)");
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }
    // Do not log PHI in error output
    console.error("Intake route error");
    return NextResponse.json(
      { error: "Failed to submit intake. Please try again." },
      { status: 500 }
    );
  }
}
