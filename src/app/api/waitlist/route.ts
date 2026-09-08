import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { waitlistSchema } from "@/lib/validators/waitlist";
import { apiErrorResponse } from "@/lib/api-error";
import { autoReplyFireAndForget, sendInboundEmail } from "@/lib/inbound-notifications";

/**
 * Marketing email capture — newsletter footer, legacy pricing waitlist, etc.
 * Deliberately public (anonymous visitors).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { email, planId, country } = parsed.data;
  const isNewsletter = !planId;

  let dbSaved = false;
  try {
    await prisma.waitlistEntry.upsert({
      where: { email },
      create: { email, planId, country },
      update: { planId, country },
    });
    dbSaved = true;
  } catch (err) {
    console.error("[api:waitlist] DB save failed:", err);
  }

  const teamSubject = isNewsletter
    ? `Newsletter signup — ${email}`
    : `Pricing waitlist — ${planId} — ${email}`;
  const teamText = [
    isNewsletter ? "New newsletter subscriber on nextreport.in." : "New pricing waitlist signup.",
    "",
    `Email: ${email}`,
    planId ? `Plan interest: ${planId}` : "Source: footer / stay updated",
    country ? `Country: ${country}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const emailResult = await sendInboundEmail({
    channel: "newsletter",
    subject: teamSubject,
    text: teamText,
    html: `<p>${isNewsletter ? "New newsletter subscriber." : "New pricing waitlist signup."}</p>
<ul>
<li><strong>Email:</strong> ${email}</li>
${planId ? `<li><strong>Plan:</strong> ${planId}</li>` : ""}
${country ? `<li><strong>Country:</strong> ${country}</li>` : ""}
</ul>`,
    replyTo: email,
  });

  if (isNewsletter) {
    autoReplyFireAndForget({
      to: email,
      subject: "You're subscribed — NextReport",
      text: [
        "Thanks for subscribing to NextReport updates.",
        "",
        "You'll hear from us about new features, reporting tips, and product news — no spam.",
        "",
        "— NextReport team",
        "hello@nextreport.in",
      ].join("\n"),
      html: `<p>Thanks for subscribing to NextReport updates.</p>
<p>You'll hear from us about new features, reporting tips, and product news — no spam.</p>
<p>— NextReport team<br/>hello@nextreport.in</p>`,
    });
  }

  if (!dbSaved && !emailResult.success) {
    return apiErrorResponse(
      new Error(emailResult.error ?? "Could not save or deliver your subscription."),
      "waitlist:join",
    );
  }

  return NextResponse.json({ ok: true });
}
