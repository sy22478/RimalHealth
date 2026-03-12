import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/integrations/sendgrid";
import { EmailTemplate } from "@/lib/notifications/templates";

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

    const toEmail =
      process.env.CONTACT_FORM_TO_EMAIL ?? "support@rimalhealth.com";

    const messageHtml = [
      `<strong>Name:</strong> ${data.name}`,
      `<strong>Email:</strong> ${data.email}`,
      `<strong>Category:</strong> ${data.subject}`,
      "",
      data.message,
    ].join("<br>");

    await sendEmail({
      to: toEmail,
      template: EmailTemplate.GENERIC_NOTIFICATION,
      data: {
        subject: `Contact: [${data.subject}] from ${data.name}`,
        message: messageHtml,
      },
      replyTo: data.email,
    });

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
