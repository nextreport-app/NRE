import { type WebsiteRange, customWebsiteRangeSchema } from "./range";
import { z } from "zod";
import { reportCalendarYesterday } from "../nre/report-period-selection";
export const WEBSITE_METRICS = [
  "sessions",
  "totalUsers",
  "newUsers",
  "engagedSessions",
  "engagementRate",
  "bounceRate",
  "screenPageViews",
  "keyEvents",
  "sessionKeyEventRate",
  "averageSessionDuration",
] as const;
export const WEBSITE_EXTRA_SUMMARY_METRICS = ["activeUsers", "eventCount"] as const;
export type WebsiteMetric = (typeof WEBSITE_METRICS)[number] | (typeof WEBSITE_EXTRA_SUMMARY_METRICS)[number];
const number = z.number().finite().nonnegative().nullable();
const metrics = z.object({
  activeUsers: number.optional(),
  eventCount: number.optional(),
  sessions: number,
  totalUsers: number,
  newUsers: number,
  engagedSessions: number,
  engagementRate: number,
  bounceRate: number,
  screenPageViews: number,
  keyEvents: number,
  sessionKeyEventRate: number,
  averageSessionDuration: number,
});
export type WebsiteMetrics = z.infer<typeof metrics>;
const period = z.object({ startIso: z.string(), endIso: z.string() });
const channel = metrics.partial().extend({
  name: z.string(),
  sessions: number,
  engagedSessions: number,
  engagementRate: number,
  keyEvents: number,
  sessionKeyEventRate: number,
});
export const websiteSnapshotSchema = z.object({
  version: z.literal(1),
  days: z.number().int().min(1).max(90),
  rangeMode: z.literal("custom").optional(),
  property: z.object({
    propertyId: z.string(),
    displayName: z.string(),
    timezone: z.string(),
    currency: z.string(),
  }),
  checkedAt: z.string().datetime(),
  currentPeriod: period,
  previousPeriod: period,
  current: metrics,
  previous: metrics,
  channels: z.array(channel),
  previousChannels: z.array(channel).optional(),
  pages: z.array(
    metrics.partial().extend({
      name: z.string(),
      sessions: number,
      engagementRate: number,
      keyEvents: number,
    }),
  ),
  trend: z.array(
    metrics.partial().extend({ date: z.string(), sessions: number, keyEvents: number }),
  ),
  devices: z.array(z.object({ name: z.string(), sessions: number, engagedSessions: number, keyEvents: number })).optional(),
  countries: z.array(z.object({ name: z.string(), activeUsers: number })).optional(),
  pageTitles: z.array(z.object({ name: z.string(), screenPageViews: number })).optional(),
  warnings: z.array(z.string()),
  empty: z.boolean(),
});
export type WebsiteSnapshot = z.infer<typeof websiteSnapshotSchema>;
export function websitePeriods(
  days: number,
  timezone: string,
  now = new Date(),
) {
  const end = reportCalendarYesterday(now, timezone),
    shift = (n: number) =>
      new Date(Date.parse(end + "T12:00:00Z") + n * 86400000)
        .toISOString()
        .slice(0, 10);
  return {
    currentPeriod: { startIso: shift(1 - days), endIso: end },
    previousPeriod: { startIso: shift(1 - days * 2), endIso: shift(-days) },
  };
}
export function parseWebsiteSnapshot(
  raw: string | null,
  propertyId: string,
  days: WebsiteRange | 0,
): WebsiteSnapshot | null {
  try {
    if (!raw) return null;
    const result = websiteSnapshotSchema.safeParse(JSON.parse(raw));
    return result.success &&
      result.data.property.propertyId === propertyId &&
      (typeof days === "object"
        ? customWebsiteRangeSchema.safeParse(days).success && result.data.rangeMode === "custom" && result.data.currentPeriod.startIso === days.startIso && result.data.currentPeriod.endIso === days.endIso
        : days === 0 ? result.data.rangeMode === "custom" : result.data.days === days && !result.data.rangeMode)
      ? result.data
      : null;
  } catch {
    return null;
  }
}
export function websiteSnapshotFresh(
  snapshot: WebsiteSnapshot | null,
  now = new Date(),
) {
  if (!snapshot) return false;
  const age = now.getTime() - Date.parse(snapshot.checkedAt);
  return (
    age >= 0 &&
    age < 26 * 3600000 &&
    (snapshot.rangeMode === "custom" ? snapshot.currentPeriod.endIso <= reportCalendarYesterday(now, snapshot.property.timezone) : websitePeriods(snapshot.days, snapshot.property.timezone, now).currentPeriod
      .endIso === snapshot.currentPeriod.endIso)
  );
}
export function websiteInsights(snapshot: WebsiteSnapshot): string[] {
  const { current: a, previous: b } = snapshot;
  const lines: string[] = [];
  if (snapshot.warnings.length)
    return [
      "GA4 reports data-quality limits for this snapshot. Review the notices before interpreting changes.",
    ];
  const amount = (n: number) =>
    Math.abs(n) > 0 && Math.abs(n) < 0.1
      ? "less than 0.1"
      : Math.abs(n).toFixed(1);
  const rateChange = (label: string, a: number, b: number) =>
    a === b
      ? `${label} was unchanged.`
      : `${label} ${a > b ? "increased" : "decreased"} by ${amount((a - b) * 100)} percentage points.`;
  if (a.sessions !== null && b.sessions !== null) {
    if (b.sessions > 0)
      lines.push(
        a.sessions === b.sessions
          ? `Sessions were unchanged versus the previous ${snapshot.days} days.`
          : `Sessions ${a.sessions > b.sessions ? "increased" : "decreased"} by ${amount((a.sessions / b.sessions - 1) * 100)}% versus the previous ${snapshot.days} days.`,
      );
    else
      lines.push(
        a.sessions > 0
          ? "Sessions were reported after a prior period with none; a percentage change is not meaningful."
          : "GA4 reported no sessions in either period.",
      );
  }
  if (a.engagementRate !== null && b.engagementRate !== null)
    lines.push(
      rateChange("Engagement rate", a.engagementRate, b.engagementRate),
    );
  if (
    a.sessionKeyEventRate !== null &&
    b.sessionKeyEventRate !== null &&
    a.sessions !== null &&
    b.sessions !== null &&
    a.sessions >= 100 &&
    b.sessions >= 100
  )
    lines.push(
      rateChange(
        "The share of sessions with a key event",
        a.sessionKeyEventRate,
        b.sessionKeyEventRate,
      ) +
        " Check key-event configuration and quality before drawing conclusions.",
    );
  const top = [...snapshot.channels]
    .filter((c) => c.sessions !== null)
    .sort((x, y) => y.sessions! - x.sessions!)[0];
  if (top && a.sessions && top.sessions)
    lines.push(
      `${top.name} had the most reported sessions (${top.sessions.toLocaleString("en-US")}). Channel sessions and users should not be treated as interchangeable.`,
    );
  return lines;
}
