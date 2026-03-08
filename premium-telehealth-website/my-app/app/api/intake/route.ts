import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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

    const apiKey = process.env.RESEND_API_KEY;
    const toEmail =
      process.env.CONTACT_FORM_TO_EMAIL ?? "support@rimalhealth.com";

    if (!apiKey) {
      // No email service configured — log non-PHI fields only
      console.log("Intake form submitted (RESEND_API_KEY not set):", {
        treatmentType: data.treatmentType,
        ageRange: data.ageRange,
      });
      return NextResponse.json({ success: true });
    }

    const treatmentDetails = [
      `Drinks per week: ${data.drinksPerWeek ?? "Not specified"}`,
      `Goal: ${data.alcoholGoal ?? "Not specified"}`,
    ];

    const intakeText = [
      "New patient intake — please review within 24 hours.",
      "",
      "PATIENT",
      `Name: ${data.firstName} ${data.lastInitial}.`,
      `Email: ${data.email}`,
      `Phone: ${data.phone ?? "Not provided"}`,
      `Age range: ${data.ageRange}`,
      `State: ${data.state}`,
      "",
      "TREATMENT",
      `Type: ${data.treatmentType}`,
      ...treatmentDetails,
      "",
      "HISTORY",
      `Current medications: ${data.currentMedications || "None listed"}`,
      `Medical conditions: ${data.medicalConditions || "None listed"}`,
      "",
      "CONSENTS",
      "HIPAA: yes | Terms of Service: yes | Telehealth: yes",
    ].join("\n");

    // Notify clinical team
    const clinicalRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Rimal Health Intake <no-reply@rimalhealth.com>",
        to: [toEmail],
        subject: `New intake: ${data.treatmentType} — ${data.firstName} ${data.lastInitial}.`,
        text: intakeText,
      }),
    });

    if (!clinicalRes.ok) {
      throw new Error(`Resend error ${clinicalRes.status}`);
    }

    // Send confirmation to patient (non-critical — don't throw if it fails)
    const confirmText = [
      `Hi ${data.firstName},`,
      "",
      "We received your intake form. A California-licensed physician will review your information within 24 hours.",
      "",
      "If you have urgent concerns, please call 911 or go to your nearest emergency room.",
      "",
      "Questions? Email us at support@rimalhealth.com.",
      "",
      "— Rimal Health",
    ].join("\n");

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Rimal Health <no-reply@rimalhealth.com>",
        to: [data.email],
        subject: "We received your intake form — Rimal Health",
        text: confirmText,
      }),
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
