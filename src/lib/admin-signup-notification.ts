/**
 * Notifies the team when a new trial account is created — credentials signup
 * or first-time Google login (Auth.js createUser event).
 */

import { getResendClient, FROM_ADDRESS } from "@/lib/email";

export interface NewSignupNotificationInput {
  email: string;
  name?: string | null;
  provider: "credentials" | "google";
}

function signupNotifyRecipients(): string[] {
  const explicit = (process.env.SIGNUP_NOTIFY_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (explicit.length > 0) return explicit;

  const admin = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admin;
}

/** Fire-and-forget — never blocks signup if email fails. */
export function notifyAdminNewSignup(input: NewSignupNotificationInput): void {
  if (!process.env.RESEND_API_KEY) {
    console.info("[signup-notify] skipped — RESEND_API_KEY not configured", input.email);
    return;
  }

  const recipients = signupNotifyRecipients();
  if (recipients.length === 0) {
    console.info("[signup-notify] skipped — set SIGNUP_NOTIFY_EMAILS or ADMIN_EMAILS", input.email);
    return;
  }

  const name = input.name?.trim() || "—";
  const providerLabel = input.provider === "google" ? "Google sign-in" : "Email sign-up";
  const subject = `New NextReport trial — ${input.email}`;
  const text = [
    "A new user started a free trial on NextReport.",
    "",
    `Email: ${input.email}`,
    `Name: ${name}`,
    `How they signed up: ${providerLabel}`,
    "",
    "They get 7 days of full access automatically — no payment required yet.",
  ].join("\n");

  void getResendClient()
    .emails.send({
      from: FROM_ADDRESS,
      to: recipients,
      replyTo: FROM_ADDRESS,
      subject,
      text,
      html: `<p>A new user started a <strong>free trial</strong> on NextReport.</p>
<ul>
<li><strong>Email:</strong> ${input.email}</li>
<li><strong>Name:</strong> ${name}</li>
<li><strong>Sign-up method:</strong> ${providerLabel}</li>
</ul>
<p>They receive 7 days of full access automatically — no payment required yet.</p>`,
    })
    .then(({ error }) => {
      if (error) console.error("[signup-notify] Resend failed:", error);
    })
    .catch((err) => {
      console.error("[signup-notify] threw:", err);
    });
}
