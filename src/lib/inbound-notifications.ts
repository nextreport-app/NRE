/**
 * Inbound notifications for website forms, support tickets, and billing events.
 * Uses Resend (same as report emails) — requires RESEND_API_KEY and a verified
 * nextreport.in domain. Set Cloudflare Email Routing on hello@, billing@, and
 * support@ to forward into your Gmail inbox (see .env.example).
 */

import { getResendClient, FROM_ADDRESS } from "@/lib/email";
import { getPlanDisplayName } from "@/lib/plan-labels";

export type InboundChannel = "contact" | "newsletter" | "support" | "billing";

const CHANNEL_ENV: Record<InboundChannel, string> = {
  contact: "CONTACT_NOTIFY_EMAILS",
  newsletter: "NEWSLETTER_NOTIFY_EMAILS",
  support: "SUPPORT_NOTIFY_EMAILS",
  billing: "BILLING_NOTIFY_EMAILS",
};

/** Default routing — override with env vars on Vercel. */
const CHANNEL_DEFAULT: Record<InboundChannel, string> = {
  contact: "hello@nextreport.in",
  newsletter: "hello@nextreport.in",
  support: "support@nextreport.in",
  billing: "billing@nextreport.in",
};

function parseRecipients(raw: string | undefined, fallback: string): string[] {
  const list = (raw ?? fallback)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(list)];
}

export function inboundNotifyRecipients(channel: InboundChannel): string[] {
  const envKey = CHANNEL_ENV[channel];
  const fallback = CHANNEL_DEFAULT[channel];
  const explicit = parseRecipients(process.env[envKey], fallback);
  if (explicit.length > 0) return explicit;

  // Billing falls back to legacy SIGNUP_NOTIFY_EMAILS then ADMIN_EMAILS.
  if (channel === "billing") {
    const signup = parseRecipients(process.env.SIGNUP_NOTIFY_EMAILS, "");
    if (signup.length > 0) return signup;
    const admin = parseRecipients(process.env.ADMIN_EMAILS, "");
    if (admin.length > 0) return admin;
  }

  return [fallback];
}

export interface SendInboundEmailInput {
  channel: InboundChannel;
  subject: string;
  text: string;
  html: string;
  /** When set, team replies in Gmail go straight to the visitor. */
  replyTo?: string;
}

export interface SendInboundEmailResult {
  success: boolean;
  error?: string;
  skipped?: boolean;
}

export async function sendInboundEmail(input: SendInboundEmailInput): Promise<SendInboundEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    console.info(`[inbound:${input.channel}] skipped — RESEND_API_KEY not configured`);
    return { success: false, skipped: true, error: "Email sending is not configured." };
  }

  const to = inboundNotifyRecipients(input.channel);
  if (to.length === 0) {
    console.info(`[inbound:${input.channel}] skipped — no recipients configured`);
    return { success: false, skipped: true, error: "No notification recipients configured." };
  }

  try {
    const { error } = await getResendClient().emails.send({
      from: FROM_ADDRESS,
      to,
      replyTo: input.replyTo ?? FROM_ADDRESS,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    if (error) {
      console.error(`[inbound:${input.channel}] Resend failed:`, error);
      return { success: false, error: error.message || "Could not send notification email." };
    }
    return { success: true };
  } catch (err) {
    console.error(`[inbound:${input.channel}] threw:`, err);
    return { success: false, error: "Could not send notification email." };
  }
}

export async function sendVisitorAutoReply(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<SendInboundEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, skipped: true, error: "Email sending is not configured." };
  }

  try {
    const { error } = await getResendClient().emails.send({
      from: FROM_ADDRESS,
      to: input.to,
      replyTo: FROM_ADDRESS,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    if (error) {
      console.error("[inbound:auto-reply] Resend failed:", error);
      return { success: false, error: error.message || "Could not send auto-reply." };
    }
    return { success: true };
  } catch (err) {
    console.error("[inbound:auto-reply] threw:", err);
    return { success: false, error: "Could not send auto-reply." };
  }
}

/** Fire-and-forget wrapper for route handlers. */
export function notifyInboundFireAndForget(input: SendInboundEmailInput): void {
  void sendInboundEmail(input).then((result) => {
    if (!result.success && !result.skipped) {
      console.error(`[inbound:${input.channel}] delivery failed:`, result.error);
    }
  });
}

export function autoReplyFireAndForget(input: Parameters<typeof sendVisitorAutoReply>[0]): void {
  void sendVisitorAutoReply(input).then((result) => {
    if (!result.success && !result.skipped) {
      console.error("[inbound:auto-reply] delivery failed:", result.error);
    }
  });
}

export function notifyBillingNewSubscription(input: {
  email: string;
  name?: string | null;
  planId: string;
  paymentId: string;
}): void {
  const planLabel = getPlanDisplayName(input.planId);
  const name = input.name?.trim() || "—";
  const subject = `New subscription — ${planLabel} — ${input.email}`;
  const text = [
    "A user subscribed to NextReport.",
    "",
    `Email: ${input.email}`,
    `Name: ${name}`,
    `Plan: ${planLabel} (${input.planId})`,
    `Payment ID: ${input.paymentId}`,
  ].join("\n");
  const html = `<p>A user subscribed to NextReport.</p>
<ul>
<li><strong>Email:</strong> ${input.email}</li>
<li><strong>Name:</strong> ${name}</li>
<li><strong>Plan:</strong> ${planLabel}</li>
<li><strong>Payment ID:</strong> ${input.paymentId}</li>
</ul>`;

  notifyInboundFireAndForget({ channel: "billing", subject, text, html, replyTo: input.email });
}
