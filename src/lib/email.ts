import { Resend } from "resend";
import { buildReportEmailHtml, buildReportEmailSubject, buildReportEmailText, type ReportEmailProps } from "./email-template";

// hello@nextreport.in is verified on the nextreport.in domain in Resend —
// see RESEND_API_KEY in .env.example. Reply-to is the same address rather
// than the sending user's own email: replies should reach the agency's
// shared inbox, not get lost if a report is re-sent by a teammate later.
const FROM_ADDRESS = "hello@nextreport.in";

let client: Resend | null = null;

/** Lazily constructed so a missing RESEND_API_KEY only breaks the send path, not module import (e.g. at build time / in tests that never call this). */
function getResendClient(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

export interface SendReportEmailInput extends ReportEmailProps {
  to: string;
}

export interface SendReportEmailResult {
  success: boolean;
  error?: string;
}

/** Sends the report email built by email-template.ts via Resend. Never throws — network/API failures come back as `{ success: false, error }` for the caller (api/reports/[id]/send-email/route.ts) to relay to the client. */
export async function sendReportEmail(input: SendReportEmailInput): Promise<SendReportEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "Email sending is not configured." };
  }

  try {
    const { error } = await getResendClient().emails.send({
      from: FROM_ADDRESS,
      to: input.to,
      replyTo: FROM_ADDRESS,
      subject: buildReportEmailSubject(input),
      html: buildReportEmailHtml(input),
      text: buildReportEmailText(input),
    });

    if (error) {
      console.error("[lib:email] Resend send failed:", error);
      return { success: false, error: error.message || "Could not send the email. Please try again." };
    }
    return { success: true };
  } catch (err) {
    console.error("[lib:email] Resend send threw:", err);
    return { success: false, error: "Could not send the email. Please try again." };
  }
}
