import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { contactSchema } from "@/lib/validators/contact";
import { apiErrorResponse } from "@/lib/api-error";
import { autoReplyFireAndForget, sendInboundEmail } from "@/lib/inbound-notifications";

/**
 * /contact form submissions. Deliberately public, same reasoning as
 * api/waitlist/route.ts: most visitors filling this out are anonymous
 * marketing-page traffic, not logged-in accounts, so there's no auth()
 * check here.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { name, email, subject, message } = parsed.data;

  let dbSaved = false;
  try {
    await prisma.contactMessage.create({ data: { name, email, subject, message } });
    dbSaved = true;
  } catch (err) {
    console.error("[api:contact:submit] DB save failed:", err);
  }

  const teamSubject = `[Contact] ${subject} — ${name}`;
  const teamText = [
    "New message from the NextReport website.",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Subject: ${subject}`,
    "",
    message,
  ].join("\n");
  const teamHtml = `<p>New message from the NextReport website.</p>
<ul>
<li><strong>Name:</strong> ${name}</li>
<li><strong>Email:</strong> ${email}</li>
<li><strong>Subject:</strong> ${subject}</li>
</ul>
<p style="white-space:pre-wrap">${message.replace(/</g, "&lt;")}</p>`;

  const emailResult = await sendInboundEmail({
    channel: "contact",
    subject: teamSubject,
    text: teamText,
    html: teamHtml,
    replyTo: email,
  });

  autoReplyFireAndForget({
    to: email,
    subject: "We received your message — NextReport",
    text: [
      `Hi ${name},`,
      "",
      "Thanks for contacting NextReport. We received your message and will reply within one business day.",
      "",
      `Your message (${subject}):`,
      message,
      "",
      "— NextReport team",
      "hello@nextreport.in",
    ].join("\n"),
    html: `<p>Hi ${name},</p>
<p>Thanks for contacting NextReport. We received your message and will reply within one business day.</p>
<p><strong>Your message (${subject}):</strong></p>
<p style="white-space:pre-wrap">${message.replace(/</g, "&lt;")}</p>
<p>— NextReport team<br/>hello@nextreport.in</p>`,
  });

  if (!dbSaved && !emailResult.success) {
    return apiErrorResponse(
      new Error(emailResult.error ?? "Could not save or deliver your message."),
      "contact:submit",
    );
  }

  return NextResponse.json({ ok: true });
}
