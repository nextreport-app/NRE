import { isAdminEmail } from "./subscription";
import { queueEmail, deliverQueuedEmail } from "./email-delivery";
/**
 * Daily digest email for the team — one summary at end of day (IST) with
 * how many reports were generated, broken down by user and platform.
 */

import { inboundNotifyRecipients } from "@/lib/inbound-notifications";
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

export interface DigestStats {
  dayLabel: string;
  total: number;
  activeUsers: number;
  byUser: DigestUserRow[];
  byPlatform: Record<string, number>;
  byReportType: Record<string, number>;
  clients?: number;
  failed?: number;
  processingNow?: number;
  ownerReports?: number;
  byPlan?: Record<string, number>;
  legacyCount?: number;
  preparedAt?: string;
}

const PLATFORM_LABELS: Record<string, string> = { META: "Meta Ads", GOOGLE: "Google Ads", TIKTOK: "TikTok Ads", GA4: "GA4" };
const REPORT_LABELS: Record<string, string> = { WEEKLY: "Weekly", MONTHLY: "Monthly", DAILY: "Daily", COMPARISON: "Comparison", WEBSITE: "Website", HISTORICAL: "Historical", DAY_BREAKDOWN: "Day breakdown", QUARTER: "Quarterly", YTD: "Year to date", CREATIVE: "Creative" };
const PLAN_LABELS: Record<string, string> = { trial: "Trial", starter: "Agency", professional: "Professional", admin: "Owner / admin testing", cancelled: "Cancelled" };

export async function buildDailyReportDigestStats(bounds: IstDayBounds): Promise<DigestStats> {
  const events = await prisma.reportGenerationEvent.findMany({ where: { occurredAt: { gte: bounds.start, lt: bounds.end } }, orderBy: { occurredAt: "asc" } });
  const completed = events.filter(event => event.outcome === "COMPLETE");
  const [users, clients, processingNow] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: [...new Set(completed.map(event => event.userId))] } }, select: { id: true, email: true, name: true } }),
    prisma.client.findMany({ where: { id: { in: [...new Set(completed.map(event => event.clientId))] } }, select: { id: true, accountName: true } }),
    prisma.report.count({ where: { status: "GENERATING" } }),
  ]);
  const userById = new Map(users.map(user => [user.id, user]));
  const clientById = new Map(clients.map(client => [client.id, client.accountName]));
  const userMap = new Map<string, DigestUserRow>();
  const byPlatform: Record<string, number> = {}, byReportType: Record<string, number> = {}, byPlan: Record<string, number> = {};
  let ownerReports = 0;
  for (const event of completed) {
    const user = userById.get(event.userId);
    const row = userMap.get(event.userId) ?? { email: user?.email ?? "Deleted account", name: user?.name ?? null, count: 0, clients: [] };
    row.count++;
    const clientName = clientById.get(event.clientId) ?? "Deleted client";
    if (!row.clients.includes(clientName)) row.clients.push(clientName);
    userMap.set(event.userId, row);
    const platform = PLATFORM_LABELS[event.platform] ?? event.platform;
    const type = REPORT_LABELS[event.reportType] ?? event.reportType;
    const owner = event.planId === "admin" || (event.legacy && isAdminEmail(user?.email));
    if (owner) ownerReports++;
    const plan = owner ? PLAN_LABELS.admin : PLAN_LABELS[event.planId] ?? "Other";
    byPlatform[platform] = (byPlatform[platform] ?? 0) + 1;
    byReportType[type] = (byReportType[type] ?? 0) + 1;
    byPlan[plan] = (byPlan[plan] ?? 0) + 1;
  }
  return { dayLabel: bounds.label, total: completed.length, activeUsers: userMap.size,
    byUser: [...userMap.values()].sort((a,b) => b.count - a.count), byPlatform, byReportType, byPlan,
    clients: new Set(completed.map(event => event.clientId)).size,
    failed: events.filter(event => event.outcome === "FAILED").length, processingNow,
    ownerReports,
    legacyCount: events.filter(event => event.legacy).length, preparedAt: new Date().toISOString(),
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

  const owner = stats.ownerReports ?? 0;
  const failed = stats.failed ?? 0;
  const planLine = formatCountMap(stats.byPlan ?? {});
  const typeLine = formatCountMap(Object.fromEntries(Object.entries(stats.byReportType).map(([key,value]) => [REPORT_LABELS[key] ?? key, value])));
  const userLines = stats.byUser.slice(0, 25).map(row => `${row.email}${row.name ? ` (${row.name})` : ""}: ${row.count} reports — ${row.clients.slice(0,3).join(", ")}${row.clients.length > 3 ? ` +${row.clients.length-3} more` : ""}`);
  const legacyNote = stats.legacyCount ? "Some records predate completion tracking; their day and plan use legacy metadata. Reports deleted before tracking was installed cannot be recovered." : "";
  const prepared = stats.preparedAt ? new Date(stats.preparedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST" : "";
  const text = [
    `NextReport daily digest — ${stats.dayLabel} (IST)`, "Reporting window: 00:00–23:59 IST", "",
    `Reports completed: ${stats.total}`, `Reporting accounts: ${stats.activeUsers}`, `Client workspaces covered: ${stats.clients ?? 0}`,
    `Owner / admin reports: ${owner} · Other account reports: ${stats.total-owner}`, `Failed generations: ${failed}`,
    `Processing now (at preparation): ${stats.processingNow ?? 0}`, "", "By account:",
    ...(userLines.length ? userLines : ["No reports generated."]),
    ...(stats.byUser.length > 25 ? [`${stats.byUser.length-25} more reporting accounts; all are included in the total.`] : []), "",
    `By plan: ${planLine}`, `By platform: ${formatCountMap(stats.byPlatform)}`, `By report type: ${typeLine}`, "",
    "Totals include all plans and platforms. Re-publishing an existing report is not a new generation.", legacyNote,
    prepared ? `Prepared ${prepared}. Inbox delivery time can differ from the scheduled midnight run.` : "",
  ].filter(Boolean).join("\n");
  const rows = stats.byUser.slice(0,25).map(row => `<tr><td style="padding:12px 0;border-bottom:1px solid #e2e8f0"><strong>${escapeHtml(row.name || row.email)}</strong>${row.name ? `<br/><span style="color:#64748b">${escapeHtml(row.email)}</span>` : ""}<br/><span style="color:#64748b;font-size:12px">${escapeHtml(row.clients.slice(0,3).join(", "))}${row.clients.length > 3 ? ` +${row.clients.length-3} more` : ""}</span></td><td align="right" style="padding:12px 0;border-bottom:1px solid #e2e8f0;font-weight:bold">${row.count}</td></tr>`).join("");
  const metric = (label: string, value: number) => `<td width="33%" style="padding:18px 6px;text-align:center"><div style="font-size:28px;font-weight:700;color:#0d1b2e">${value}</div><div style="font-size:12px;color:#64748b">${label}</div></td>`;
  const html = `<div style="background:#f1f5f9;padding:24px 12px;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
<div style="background:#0d1b2e;color:#fff;padding:24px;border-top:4px solid #f6ad55"><p style="margin:0 0 8px;color:#f6ad55;font-size:12px;letter-spacing:2px">NEXTREPORT · DAILY DIGEST</p><h1 style="margin:0;font-size:24px">${escapeHtml(stats.dayLabel)}</h1><p style="margin:8px 0 0;color:#b9c6d8;font-size:13px">00:00–23:59 IST · all clients, plans and platforms</p></div>
<div style="padding:0 24px 24px"><table width="100%" role="presentation"><tr>${metric("Reports completed", stats.total)}${metric("Reporting accounts",stats.activeUsers)}${metric("Client workspaces",stats.clients ?? 0)}</tr></table>
<p style="padding:12px;background:#f8fafc;border-radius:8px;font-size:13px">Owner/admin testing: <strong>${owner}</strong> · Other accounts: <strong>${stats.total-owner}</strong><br/>Failed generations: <strong>${failed}</strong> · Processing now: <strong>${stats.processingNow ?? 0}</strong></p>
<h2 style="font-size:15px;margin-top:24px">Reporting accounts</h2>${rows ? `<table width="100%" style="font-size:13px;border-collapse:collapse">${rows}</table>` : "<p>No reports generated.</p>"}
${stats.byUser.length > 25 ? `<p style="font-size:12px">${stats.byUser.length-25} more accounts; all are included in the total.</p>` : ""}
<p style="font-size:13px;line-height:1.8"><strong>Plans:</strong> ${escapeHtml(planLine)}<br/><strong>Platforms:</strong> ${escapeHtml(formatCountMap(stats.byPlatform))}<br/><strong>Report types:</strong> ${escapeHtml(typeLine)}</p>
<p style="font-size:11px;color:#64748b;line-height:1.6">Completed reports are counted once by completion time. Re-publishing does not add a report.${legacyNote ? ` ${escapeHtml(legacyNote)}` : ""}<br/>${escapeHtml(prepared ? `Prepared ${prepared}. Actual inbox delivery may be later.` : "")}</p></div></div></div>`;
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
  pending?: boolean;
  alreadySent?: boolean;
  stats: DigestStats;
};

/** Sends the digest for the IST day that just ended. Awaits Resend — required on Vercel cron (no fire-and-forget). */
export async function sendAdminDailyReportDigest(now = new Date()): Promise<DailyReportDigestSendResult> {
  const bounds = istDayBoundsForDigest(now);
  const stats = await buildDailyReportDigestStats(bounds);
  const { subject, text, html } = formatDailyReportDigestEmail(stats);
  const recipients = inboundNotifyRecipients("reports");

  const key = `admin-digest:${bounds.start.toISOString().slice(0,10)}:${bounds.end.toISOString().slice(0,10)}`;
  await queueEmail({ key, kind: "ADMIN_DIGEST", payload: { to: recipients, subject, text, html } });
  const result = await deliverQueuedEmail(key, now);

  return {
    sent: result.accepted,
    skipped: false,
    pending: result.busy,
    alreadySent: result.alreadyAccepted,
    error: result.error,
    recipients,
    stats,
  };
}
