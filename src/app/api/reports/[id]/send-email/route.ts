import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/api-error";
import { sendReportEmail } from "@/lib/email";

const bodySchema = z.object({
  to: z.string().trim().toLowerCase().email("Enter a valid email address"),
  message: z.string().trim().max(2000).optional(),
});

// Prevents a single report's share link from being used to blast an
// arbitrary list of addresses through this account's Resend quota.
const MAX_EMAILS_PER_REPORT = 10;

const REPORT_TYPE_LABELS: Record<string, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  COMPARISON: "Comparison",
};

/**
 * The download screen's "Send Email" modal (see report-upload-wizard.tsx's
 * EmailModal / handleSendEmail): sends the report's public share link (see
 * lib/share-token.ts / app/r/[token]/page.tsx) to an address the user
 * types in, via Resend (lib/email.ts). Distinct from "Share Report" (which
 * just copies the link) and from the Drive-panel's mailto Email button
 * (which opens the user's own email client) — this one sends server-side,
 * so it's the only one that needs a report-scoped rate limit.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const report = await prisma.report.findUnique({ where: { id }, include: { client: true } });
    if (!report || report.client.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (report.status !== "COMPLETE") {
      return NextResponse.json({ error: "Report is not ready yet." }, { status: 409 });
    }
    if (!report.shareToken) {
      return NextResponse.json({ error: "This report cannot be emailed yet." }, { status: 409 });
    }
    if (report.emailsSent >= MAX_EMAILS_PER_REPORT) {
      return NextResponse.json(
        { error: `This report has already been emailed ${MAX_EMAILS_PER_REPORT} times, the limit per report.` },
        { status: 429 },
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, agencyName: true },
    });
    const senderName = user?.name || user?.email || "NextReport user";

    const dateRange = report.weekStart && report.weekEnd ? `${report.weekStart} - ${report.weekEnd}` : "—";

    const result = await sendReportEmail({
      to: parsed.data.to,
      clientName: report.client.accountName,
      reportType: REPORT_TYPE_LABELS[report.reportType] ?? report.reportType,
      dateRange,
      shareLink: `https://nextreport.in/r/${report.shareToken}`,
      driveLink: report.slidesUrl ?? undefined,
      senderName,
      agencyName: user?.agencyName ?? undefined,
      message: parsed.data.message,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error ?? "Could not send the email. Please try again." }, { status: 502 });
    }

    await prisma.report.update({ where: { id: report.id }, data: { emailsSent: { increment: 1 } } });

    return NextResponse.json({ success: true });
  } catch (err) {
    return apiErrorResponse(err, "reports:send-email");
  }
}
