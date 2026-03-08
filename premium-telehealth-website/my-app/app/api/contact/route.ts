import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  subject: z.enum(["general", "billing", "technical", "medical"] as const),
  message: z.string().min(10).max(1000),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = contactSchema.parse(body);

    const apiKey = process.env.RESEND_API_KEY;
    const toEmail =
      process.env.CONTACT_FORM_TO_EMAIL ?? "support@rimalhealth.com";

    if (!apiKey) {
      // No email service configured — log non-PHI fields only and acknowledge
      console.log("Contact form submitted (RESEND_API_KEY not set):", {
        subject: data.subject,
      });
      return NextResponse.json({ success: true });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Rimal Health Contact <no-reply@rimalhealth.com>",
        to: [toEmail],
        reply_to: data.email,
        subject: `Contact: [${data.subject}] from ${data.name}`,
        text: [
          `Name: ${data.name}`,
          `Email: ${data.email}`,
          `Subject: ${data.subject}`,
          "",
          data.message,
        ].join("\n"),
      }),
    });

    if (!res.ok) {
      throw new Error(`Resend error ${res.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }
    console.error("Contact route error");
    return NextResponse.json(
      { error: "Failed to send message. Please try again." },
      { status: 500 }
    );
  }
}
