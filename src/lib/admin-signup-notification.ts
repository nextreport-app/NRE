/**
 * Notifies the team when a new trial account is created — credentials signup
 * or first-time Google login (Auth.js createUser event).
 */

import { notifyInboundFireAndForget } from "@/lib/inbound-notifications";

export interface NewSignupNotificationInput {
  email: string;
  name?: string | null;
  provider: "credentials" | "google";
}

/** Fire-and-forget — never blocks signup if email fails. */
export function notifyAdminNewSignup(input: NewSignupNotificationInput): void {
  const name = input.name?.trim() || "—";
  const providerLabel = input.provider === "google" ? "Google sign-in" : "Email sign-up";
  const subject = `New trial sign-up — ${input.email}`;
  const text = [
    "A new user started a free trial on NextReport.",
    "",
    `Email: ${input.email}`,
    `Name: ${name}`,
    `How they signed up: ${providerLabel}`,
    "",
    "They get 7 days of full access automatically — no payment required yet.",
  ].join("\n");
  const html = `<p>A new user started a <strong>free trial</strong> on NextReport.</p>
<ul>
<li><strong>Email:</strong> ${input.email}</li>
<li><strong>Name:</strong> ${name}</li>
<li><strong>Sign-up method:</strong> ${providerLabel}</li>
</ul>
<p>They receive 7 days of full access automatically — no payment required yet.</p>`;

  notifyInboundFireAndForget({
    channel: "billing",
    subject,
    text,
    html,
    replyTo: input.email,
  });
}
