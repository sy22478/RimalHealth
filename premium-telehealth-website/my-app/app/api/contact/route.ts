import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/integrations/sendgrid";
import { EmailTemplate } from "@/lib/notifications/templates";
import { rateLimit } from "@/lib/middleware/rate-limit";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  subject: z.enum(["general", "billing", "technical", "medical"] as const),
  message: z.string().min(10).max(1000),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimitResult = await rateLimit(clientIp, {
    requests: 5,
    windowMs: 60 * 60 * 1000,
    keyPrefix: "ratelimit:contact",
  });
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfter ?? 3600) } }
    );
  }

  try {
    const body = await request.json();
    const data = contactSchema.parse(body);

    const toEmail =
      process.env.CONTACT_FORM_TO_EMAIL ?? "support@rimalhealth.com";

    const messageHtml = [
      `<strong>Name:</strong> ${escapeHtml(data.name)}`,
      `<strong>Email:</strong> ${escapeHtml(data.email)}`,
      `<strong>Category:</strong> ${escapeHtml(data.subject)}`,
      "",
      escapeHtml(data.message),
    ].join("<br>");

    await sendEmail({
      to: toEmail,
      template: EmailTemplate.GENERIC_NOTIFICATION,
      data: {
        subject: `Contact: [${data.subject}] from ${escapeHtml(data.name)}`,
        message: messageHtml,
      },
      replyTo: data.email,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }
    console.error("Contact route error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Failed to send message. Please try again." },
      { status: 500 }
    );
  }
}
