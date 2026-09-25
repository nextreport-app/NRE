/**
 * Daily digest email for the team — one summary at end of day (IST) with
 * how many reports were generated, broken down by user and platform.
 */

import { inboundNotifyRecipients, sendInboundEmail } from "@/lib/inbound-notifications";
import { prisma } from "@/lib/prisma";

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export interface IstDayBounds {
  /** Inclusive start of the IST calendar day (UTC instant). */
  start: Date;
  /** Exclusive end — start of the next IST day. */
  end: Date;
  /** Human label, e.g. "Sep 22, 2026". */
  label: string;
}

/** Bounds for the IST calendar day that just ended when `now` is ~midnight IST. */
export function istDayBoundsForDigest(now = new Date()): IstDayBounds {
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth();
  const d = istNow.getUTCDate();

  const end = new Date(Date.UTC(y, m, d) - IST_OFFSET_MS);
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const labelDate = new Date(start.getTime() + IST_OFFSET_MS);
  const label = labelDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return { start, end, label };
}

interface DigestUserRow {
  email: string;
  name: string | null;
  count: number;
  clients: string[];
}

interface DigestStats {
  dayLabel: string;
  total: number;
  activeUsers: number;
  byUser: DigestUserRow[];
  byPlatform: Record<string, number>;
  byReportType: Record<string, number>;
}

function platformLabel(platform: string): string {
  switch (platform) {
    case "GOOGLE":
      return "Google Ads";
    case "TIKTOK":
      return "TikTok Ads";
    case "GA4":
      return "GA4";
    default:
      return "Meta Ads";
  }
}

export async function buildDailyReportDigestStats(bounds: IstDayBounds): Promise<DigestStats> {
  const reports = await prisma.report.findMany({
    where: {
      status: "COMPLETE",
      createdAt: { gte: bounds.start, lt: bounds.end },
    },
    select: {
      platform: true,
      reportType: true,
      client: {
        select: {
          accountName: true,
          user: { select: { email: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const userMap = new Map<string, DigestUserRow>();
  const byPlatform: Record<string, number> = {};
  const byReportType: Record<string, number> = {};

  for (const report of reports) {
    const email = report.client.user.email;
    const existing = userMap.get(email) ?? {
      email,
      name: report.client.user.name,
      count: 0,
      clients: [],
    };
    existing.count += 1;
    const clientName = report.client.accountName;
    if (!existing.clients.includes(clientName)) existing.clients.push(clientName);
    userMap.set(email, existing);

    const plat = platformLabel(report.platform);
    byPlatform[plat] = (byPlatform[plat] ?? 0) + 1;
    byReportType[report.reportType] = (byReportType[report.reportType] ?? 0) + 1;
  }

  const byUser = [...userMap.values()].sort((a, b) => b.count - a.count);

  return {
    dayLabel: bounds.label,
    total: reports.length,
    activeUsers: byUser.length,
    byUser,
    byPlatform,
    byReportType,
  };
}

function formatCountMap(map: Record<string, number>): string {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "—";
  return entries.map(([key, count]) => `${key}: ${count}`).join(", ");
}

export function formatDailyReportDigestEmail(stats: DigestStats): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `NextReport daily digest — ${stats.dayLabel} (${stats.total} report${stats.total === 1 ? "" : "s"})`;

  const userLines =
    stats.byUser.length === 0
      ? ["No reports generated."]
      : stats.byUser.flatMap((row) => {
          const name = row.name?.trim() || "—";
          const clients = row.clients.join(", ");
          return [`${row.email} (${name}): ${row.count} report${row.count === 1 ? "" : "s"} — ${clients}`];
        });

  const text = [
    `NextReport daily digest — ${stats.dayLabel} (IST)`,
    "",
    `Total reports: ${stats.total}`,
    `Active users: ${stats.activeUsers}`,
    "",
    "By user:",
    ...userLines.map((line) => `  ${line}`),
    "",
    `By platform: ${formatCountMap(stats.byPlatform)}`,
    `By report type: ${formatCountMap(stats.byReportType)}`,
  ].join("\n");

  const userHtml =
    stats.byUser.length === 0
      ? "<p>No reports generated.</p>"
      : `<ul>${stats.byUser
          .map((row) => {
            const name = row.name?.trim() || "—";
            const clients = row.clients.map((c) => escapeHtml(c)).join(", ");
            return `<li><strong>${escapeHtml(row.email)}</strong> (${escapeHtml(name)}): ${row.count} report${row.count === 1 ? "" : "s"} — ${clients}</li>`;
          })
          .join("")}</ul>`;

  const html = `<p><strong>NextReport daily digest</strong> — ${escapeHtml(stats.dayLabel)} (IST)</p>
<ul>
<li><strong>Total reports:</strong> ${stats.total}</li>
<li><strong>Active users:</strong> ${stats.activeUsers}</li>
</ul>
<p><strong>By user</strong></p>
${userHtml}
<p><strong>By platform:</strong> ${escapeHtml(formatCountMap(stats.byPlatform))}<br/>
<strong>By report type:</strong> ${escapeHtml(formatCountMap(stats.byReportType))}</p>`;

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type DailyReportDigestSendResult = {
  sent: boolean;
  skipped?: boolean;
  error?: string;
  recipients: string[];
  stats: DigestStats;
};

/** Sends the digest for the IST day that just ended. Awaits Resend — required on Vercel cron (no fire-and-forget). */
export async function sendAdminDailyReportDigest(now = new Date()): Promise<DailyReportDigestSendResult> {
  const bounds = istDayBoundsForDigest(now);
  const stats = await buildDailyReportDigestStats(bounds);
  const { subject, text, html } = formatDailyReportDigestEmail(stats);
  const recipients = inboundNotifyRecipients("reports");

  const result = await sendInboundEmail({
    channel: "reports",
    subject,
    text,
    html,
  });

  return {
    sent: result.success,
    skipped: result.skipped,
    error: result.error,
    recipients,
    stats,
  };
}
