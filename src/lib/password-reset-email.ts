import { FROM_ADDRESS, getResendClient } from "@/lib/email";

export async function sendPasswordResetEmail(input: {
  to: string;
  name?: string | null;
  resetUrl: string;
  expiresMinutes: number;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.info("[password-reset-email] skipped — RESEND_API_KEY not configured");
    return;
  }

  const greeting = input.name?.trim() ? `Hi ${input.name.trim()},` : "Hi,";
  const subject = "Reset your NextReport password";
  const text = [
    greeting,
    "",
    "We received a request to reset the password for your NextReport account.",
    "",
    `Reset your password (link expires in ${input.expiresMinutes} minutes):`,
    input.resetUrl,
    "",
    "If you did not request this, you can ignore this email. Your password will not change.",
    "",
    "— NextReport",
  ].join("\n");

  const html = `<p>${greeting}</p>
<p>We received a request to reset the password for your <strong>NextReport</strong> account.</p>
<p><a href="${input.resetUrl}">Reset your password</a> <span style="color:#64748b;">(expires in ${input.expiresMinutes} minutes)</span></p>
<p style="color:#64748b;font-size:13px;">If you did not request this, ignore this email — your password will not change.</p>`;

  const { error } = await getResendClient().emails.send({
    from: FROM_ADDRESS,
    to: input.to,
    replyTo: FROM_ADDRESS,
    subject,
    text,
    html,
  });
  if (error) throw new Error(error.message || "Could not send reset email.");
}
