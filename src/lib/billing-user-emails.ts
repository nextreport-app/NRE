/**
 * User-facing billing lifecycle emails (welcome, subscription confirmed, trial ending).
 * Admin alerts use lib/inbound-notifications.ts instead.
 */

import { FROM_ADDRESS, getResendClient } from "@/lib/email";
import { getPlanDisplayName } from "@/lib/plan-labels";

function fireAndForget(promise: Promise<void>, label: string): void {
  void promise.catch((err) => console.error(`[billing-email:${label}]`, err));
}

async function sendUserEmail(input: { to: string; subject: string; text: string; html: string }): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.info("[billing-email] skipped — RESEND_API_KEY not configured");
    return;
  }
  const { error } = await getResendClient().emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    replyTo: FROM_ADDRESS,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
  if (error) throw new Error(error.message || "Resend send failed");
}

export function sendWelcomeTrialEmail(input: { to: string; name?: string | null; trialEndsAt: Date }): void {
  const greeting = input.name?.trim() ? `Hi ${input.name.trim()},` : "Hi,";
  const endDate = input.trialEndsAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const subject = "Welcome to NextReport — your 7-day trial has started";
  const text = [
    greeting,
    "",
    "Your NextReport account is ready. You have 7 days of full access — no credit card required.",
    "",
    `Trial ends: ${endDate}`,
    "",
    "Add a client, connect Meta or Google Ads, and generate your first report in minutes.",
    "",
    "https://nextreport.in/clients",
    "",
    "Questions? Reply to this email or use Support in the dashboard.",
  ].join("\n");
  const html = `<p>${greeting}</p>
<p>Your <strong>NextReport</strong> account is ready. You have <strong>7 days of full access</strong> — no credit card required.</p>
<p><strong>Trial ends:</strong> ${endDate}</p>
<p><a href="https://nextreport.in/clients">Open your dashboard →</a></p>
<p>Add a client, connect Meta or Google Ads, and generate your first report in minutes.</p>
<p style="color:#64748b;font-size:13px;">Questions? Reply to this email or use Support in the dashboard.</p>`;

  fireAndForget(sendUserEmail({ to: input.to, subject, text, html }), "welcome");
}

export function sendSubscriptionConfirmedEmail(input: {
  to: string;
  name?: string | null;
  planId: string;
}): void {
  const planLabel = getPlanDisplayName(input.planId);
  const greeting = input.name?.trim() ? `Hi ${input.name.trim()},` : "Hi,";
  const subject = `You're subscribed to NextReport ${planLabel}`;
  const text = [
    greeting,
    "",
    `Thanks for subscribing to the ${planLabel} plan on NextReport.`,
    "",
    "Your account is active. You can generate reports from your dashboard anytime.",
    "",
    "https://nextreport.in/clients",
    "",
    "Manage billing: https://nextreport.in/billing",
  ].join("\n");
  const html = `<p>${greeting}</p>
<p>Thanks for subscribing to the <strong>${planLabel}</strong> plan on NextReport.</p>
<p>Your account is active — generate reports from your <a href="https://nextreport.in/clients">dashboard</a>.</p>
<p><a href="https://nextreport.in/billing">Manage billing →</a></p>`;

  fireAndForget(sendUserEmail({ to: input.to, subject, text, html }), "subscription-confirmed");
}

export function sendTrialEndingReminderEmail(input: {
  to: string;
  name?: string | null;
  trialEndsAt: Date;
}): void {
  const greeting = input.name?.trim() ? `Hi ${input.name.trim()},` : "Hi,";
  const endDate = input.trialEndsAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const subject = "Your NextReport trial ends tomorrow";
  const text = [
    greeting,
    "",
    `Your free trial ends on ${endDate}.`,
    "",
    "Subscribe to keep generating reports for your clients:",
    "https://nextreport.in/billing",
    "",
    "No card was saved during trial — you choose when to subscribe.",
  ].join("\n");
  const html = `<p>${greeting}</p>
<p>Your free trial on <strong>NextReport</strong> ends on <strong>${endDate}</strong>.</p>
<p><a href="https://nextreport.in/billing">Subscribe to keep generating reports →</a></p>
<p style="color:#64748b;font-size:13px;">No card was saved during trial — you choose when to subscribe.</p>`;

  fireAndForget(sendUserEmail({ to: input.to, subject, text, html }), "trial-ending");
}
