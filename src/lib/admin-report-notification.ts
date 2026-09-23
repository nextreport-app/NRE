/**
 * Notifies the team when a user completes report generation — PPTX, live
 * share link, or GA4 website report. Includes a running daily count so you
 * can see platform activity at a glance.
 */

import { notifyInboundFireAndForget } from "@/lib/inbound-notifications";
import { buildShareUrl } from "@/lib/report-notifications";
import { prisma } from "@/lib/prisma";

export interface AdminReportNotificationInput {
  userId: string;
  reportId: string;
  clientName: string;
  platform: "META" | "GOOGLE" | "GA4" | "TIKTOK";
  reportType: string;
  displayName: string | null;
  shareToken: string | null;
}

function platformLabel(platform: AdminReportNotificationInput["platform"]): string {
  switch (platform) {
    case "GOOGLE":
      return "Google Ads";
    case "TIKTOK":
      return "TikTok Ads";
    case "GA4":
      return "Google Analytics";
    default:
      return "Meta Ads";
  }
}

function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Fire-and-forget — never blocks report generation if email fails. */
export function notifyAdminReportGenerated(input: AdminReportNotificationInput): void {
  void notifyAdminReportGeneratedAsync(input).catch((err) => {
    console.error("[admin-report-notification] failed:", err);
  });
}

async function notifyAdminReportGeneratedAsync(input: AdminReportNotificationInput): Promise<void> {
  const [user, reportsToday, reportsTodayByUser] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, name: true },
    }),
    prisma.report.count({
      where: { status: "COMPLETE", createdAt: { gte: startOfUtcDay() } },
    }),
    prisma.report.count({
      where: {
        status: "COMPLETE",
        createdAt: { gte: startOfUtcDay() },
        client: { userId: input.userId },
      },
    }),
  ]);

  if (!user) return;

  const name = user.name?.trim() || "—";
  const reportLabel = input.displayName ?? input.reportType;
  const shareUrl = buildShareUrl(input.shareToken);
  const subject = `Report generated — ${input.clientName} (${reportLabel})`;
  const textLines = [
    "A report was generated on NextReport.",
    "",
    `User: ${user.email}`,
    `Name: ${name}`,
    `Client: ${input.clientName}`,
    `Platform: ${platformLabel(input.platform)}`,
    `Report: ${reportLabel}`,
    `Report ID: ${input.reportId}`,
    shareUrl ? `Share link: ${shareUrl}` : "Share link: —",
    "",
    `Reports completed today (all users): ${reportsToday}`,
    `Reports completed today by this user: ${reportsTodayByUser}`,
  ];

  const html = `<p>A report was generated on <strong>NextReport</strong>.</p>
<ul>
<li><strong>User:</strong> ${user.email}</li>
<li><strong>Name:</strong> ${name}</li>
<li><strong>Client:</strong> ${input.clientName}</li>
<li><strong>Platform:</strong> ${platformLabel(input.platform)}</li>
<li><strong>Report:</strong> ${reportLabel}</li>
<li><strong>Report ID:</strong> ${input.reportId}</li>
${shareUrl ? `<li><strong>Share link:</strong> <a href="${shareUrl}">${shareUrl}</a></li>` : ""}
</ul>
<p><strong>Reports completed today (all users):</strong> ${reportsToday}<br/>
<strong>Reports completed today by this user:</strong> ${reportsTodayByUser}</p>`;

  notifyInboundFireAndForget({
    channel: "reports",
    subject,
    text: textLines.join("\n"),
    html,
    replyTo: user.email,
  });
}
