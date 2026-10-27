import { createHash } from "node:crypto";
import { appBaseUrl } from "./app-base-url";
import { getPlanDisplayName } from "./plan-labels";
import { queueEmail, deliverQueuedEmail, type EmailDeliveryResult } from "./email-delivery";
export interface LifecycleRecipient { to: string; name?: string | null; userId?: string }
const escape = (value: string) => value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
export function trialEndLabel(date: Date) { return date.toLocaleString("en-GB", { timeZone: "UTC", dateStyle: "long", timeStyle: "short" }) + " UTC"; }
function identity(input: LifecycleRecipient) { return input.userId ?? createHash("sha256").update(input.to.trim().toLowerCase()).digest("hex"); }
export function formatLifecycleEmail(input: LifecycleRecipient & { title: string; lines: string[]; action: string; path: string }) {
  const greeting = input.name?.trim() ? `Hi ${input.name.trim()},` : "Hi,";
  const url = new URL(input.path, appBaseUrl()).toString();
  const text = [greeting,"",input.title,"",...input.lines,"",`${input.action}: ${url}`,"","Questions? Reply to hello@nextreport.in."].join("\n");
  const html = `<div style="background:#f1f5f9;padding:24px 12px;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden"><div style="padding:22px;background:#0d1b2e;border-top:4px solid #f6ad55;color:#fff;font-weight:bold">NextReport</div><div style="padding:24px"><p>${escape(greeting)}</p><h1 style="font-size:22px">${escape(input.title)}</h1>${input.lines.map(line=>`<p style="font-size:14px;line-height:1.7">${escape(line)}</p>`).join("")}<p style="margin:26px 0"><a href="${escape(url)}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#f6ad55;color:#0d1b2e;font-weight:bold;text-decoration:none">${escape(input.action)} →</a></p><p style="font-size:12px;color:#64748b">Questions? Reply to this email. We’re here to help.</p></div></div></div>`;
  return { subject: input.title, text, html };
}
async function send(input: LifecycleRecipient, key: string, kind: string, content: ReturnType<typeof formatLifecycleEmail>): Promise<EmailDeliveryResult> {
  await queueEmail({ key, kind, userId: input.userId, payload: { to: [input.to], ...content } });
  return deliverQueuedEmail(key);
}
export async function sendWelcomeTrialEmail(input: LifecycleRecipient & { trialEndsAt: Date }) {
  return send(input, `welcome:${identity(input)}:${input.trialEndsAt.toISOString()}`, "WELCOME", formatLifecycleEmail({ ...input,
    title: "Welcome to NextReport — your first client report starts here",
    lines: ["Your 7-day trial includes up to 3 active clients and 10 reports. No card is required.", `Trial ends: ${trialEndLabel(input.trialEndsAt)}.`,
      "First, verify your email using the verification link in your inbox. Then add a client, upload a day-wise Meta Ads CSV, and generate your report.",
      "Account setup, ad-account connections and Google Drive are optional for your first CSV report. Review the slides before sharing with your client."],
    action: "Open your workspace", path: "/clients",
  }));
}
export async function sendSubscriptionConfirmedEmail(input: LifecycleRecipient & { planId: string; paymentId?: string }) {
  return send(input, `subscription:${input.paymentId ?? `${identity(input)}:${input.planId}`}`, "SUBSCRIPTION_CONFIRMED", formatLifecycleEmail({ ...input,
    title: `Your NextReport ${getPlanDisplayName(input.planId)} payment is confirmed`, lines: ["Your payment has been confirmed. Your plan and paid-through date are available in Billing.", "You can return to your client workspace to generate reports. Review payment and renewal details in Billing."], action: "View billing", path: "/billing",
  }));
}
export async function sendTrialEndingReminderEmail(input: LifecycleRecipient & { trialEndsAt: Date }) {
  return send(input, `trial-ending:${identity(input)}:${input.trialEndsAt.toISOString()}`, "TRIAL_ENDING", formatLifecycleEmail({ ...input,
    title: "Your NextReport trial ends soon", lines: [`Your free trial ends ${trialEndLabel(input.trialEndsAt)}.`, "Choose a plan to keep adding clients and generating reports after your trial ends.", "Already chosen a plan? Your Billing page shows current access. No card was saved during trial and there is no automatic trial charge. Existing reports follow your selected retention window; download anything you need to keep."], action: "Review plans", path: "/billing",
  }));
}
export async function sendTrialExpiredEmail(input: LifecycleRecipient & { trialEndsAt: Date }) {
  return send(input, `trial-expired:${identity(input)}:${input.trialEndsAt.toISOString()}`, "TRIAL_EXPIRED", formatLifecycleEmail({ ...input,
    title: "Your NextReport trial has ended", lines: [`Your trial ended ${trialEndLabel(input.trialEndsAt)}. No automatic payment was taken.`, "New client creation and new report generation are paused until you subscribe. You can still sign in and view your existing clients and available reports.", "Report retention still applies. Download any reports you need to keep; subscribing does not restore files already removed by retention."], action: "Choose a plan", path: "/billing",
  }));
}
