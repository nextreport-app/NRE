import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bookDemoSchema } from "@/lib/validators/book-demo";
import { apiErrorResponse } from "@/lib/api-error";
import { autoReplyFireAndForget, sendInboundEmail } from "@/lib/inbound-notifications";

const DEMO_SUBJECT = "Book a Demo";

/**
 * /book-demo form submissions — routed to DEMO_NOTIFY_EMAILS (see
 * lib/inbound-notifications.ts) so demo requests can land in a separate inbox
 * from general contact form traffic.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = bookDemoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { name, email, company, teamSize, message } = parsed.data;
  const storedMessage = [`Company: ${company}`, `Team size: ${teamSize}`, "", message].join("\n");

  let dbSaved = false;
  try {
    await prisma.contactMessage.create({
      data: { name, email, subject: DEMO_SUBJECT, message: storedMessage },
    });
    dbSaved = true;
  } catch (err) {
    console.error("[api:book-demo:submit] DB save failed:", err);
  }

  const teamSubject = `[Demo request] ${company} — ${name}`;
  const teamText = [
    "New demo request from the NextReport website.",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Company: ${company}`,
    `Team size: ${teamSize}`,
    "",
    message,
  ].join("\n");
  const teamHtml = `<p>New demo request from the NextReport website.</p>
<ul>
<li><strong>Name:</strong> ${name}</li>
<li><strong>Email:</strong> ${email}</li>
<li><strong>Company:</strong> ${company}</li>
<li><strong>Team size:</strong> ${teamSize}</li>
</ul>
<p style="white-space:pre-wrap">${message.replace(/</g, "&lt;")}</p>`;

  const emailResult = await sendInboundEmail({
    channel: "demo",
    subject: teamSubject,
    text: teamText,
    html: teamHtml,
    replyTo: email,
  });

  autoReplyFireAndForget({
    to: email,
    subject: "We received your demo request — NextReport",
    text: [
      `Hi ${name},`,
      "",
      "Thanks for requesting a NextReport demo. We'll reply within one business day to schedule a walkthrough.",
      "",
      "What you asked about:",
      message,
      "",
      "— NextReport team",
      "hello@nextreport.in",
    ].join("\n"),
    html: `<p>Hi ${name},</p>
<p>Thanks for requesting a NextReport demo. We&apos;ll reply within one business day to schedule a walkthrough.</p>
<p><strong>What you asked about:</strong></p>
<p style="white-space:pre-wrap">${message.replace(/</g, "&lt;")}</p>
<p>— NextReport team<br/>hello@nextreport.in</p>`,
  });

  if (!dbSaved && !emailResult.success) {
    return apiErrorResponse(
      new Error(emailResult.error ?? "Could not save or deliver your request."),
      "book-demo:submit",
    );
  }

  return NextResponse.json({ ok: true });
}
