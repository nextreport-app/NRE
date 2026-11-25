import { z } from "zod";
import {
  customWebsiteRangeSchema,
  type WebsiteRange,
} from "../website-dashboard/range";
import { ServiceError } from "../service-error";
export const GSC_TIMEZONE = "America/Los_Angeles";
export function gscDateBounds(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: GSC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const floor = new Date(today + "T12:00:00Z");
  const day = floor.getUTCDate();
  floor.setUTCDate(1);
  floor.setUTCMonth(floor.getUTCMonth() - 16);
  const lastDay = new Date(
    Date.UTC(floor.getUTCFullYear(), floor.getUTCMonth() + 1, 0),
  ).getUTCDate();
  floor.setUTCDate(Math.min(day, lastDay));
  return {
    maxDate: shift(today, -3),
    minDate: floor.toISOString().slice(0, 10),
  };
}
export function shift(date: string, days: number) {
  return new Date(Date.parse(date + "T12:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
export function gscPeriods(selection: WebsiteRange, now = new Date()) {
  const bounds = gscDateBounds(now),
    current =
      typeof selection === "number"
        ? {
            startIso: shift(bounds.maxDate, 1 - selection),
            endIso: bounds.maxDate,
          }
        : customWebsiteRangeSchema.parse(selection);
  const days =
    (Date.parse(current.endIso) - Date.parse(current.startIso)) / 86400000 + 1;
  const previous = {
    startIso: shift(current.startIso, -days),
    endIso: shift(current.startIso, -1),
  };
  if (current.endIso > bounds.maxDate || previous.startIso < bounds.minDate)
    throw new ServiceError(
      "Choose dates within Search Console’s last 16 months, ending at least three days ago, with room for the previous comparison period.",
      400,
    );
  return {
    days,
    current,
    previous,
    rangeKey:
      typeof selection === "number"
        ? String(selection)
        : `${current.startIso}:${current.endIso}`,
  };
}
const metric = z.object({
  clicks: z.number().finite().nonnegative(),
  impressions: z.number().finite().nonnegative(),
  ctr: z.number().finite().min(0).max(1).nullable(),
  position: z.number().finite().nonnegative().nullable(),
});
const row = metric.extend({ name: z.string() });
export const gscSnapshotSchema = z.object({
  version: z.literal(1),
  siteUrl: z.string(),
  checkedAt: z.string().datetime(),
  days: z.number().int().min(1).max(90),
  rangeKey: z.string(),
  currentPeriod: z.object({ startIso: z.string(), endIso: z.string() }),
  previousPeriod: z.object({ startIso: z.string(), endIso: z.string() }),
  current: metric,
  previous: metric,
  trend: z.array(row),
  queries: z.array(row),
  pages: z.array(row),
  countries: z.array(row),
  devices: z.array(row),
  empty: z.boolean(),
});
export type GscSnapshot = z.infer<typeof gscSnapshotSchema>;
export type GscMetric = "clicks" | "impressions" | "ctr" | "position";
export const GSC_LABELS: Record<GscMetric, string> = {
  clicks: "Total clicks",
  impressions: "Total impressions",
  ctr: "Average CTR",
  position: "Average position",
};
export function parseGscSnapshot(raw: string | null, site: string) {
  try {
    const result = gscSnapshotSchema.safeParse(JSON.parse(raw ?? "null"));
    return result.success && result.data.siteUrl === site ? result.data : null;
  } catch {
    return null;
  }
}
export function formatGscMetric(key: GscMetric, value: number | null) {
  return value === null
    ? "—"
    : new Intl.NumberFormat("en", {
        maximumFractionDigits: key === "ctr" || key === "position" ? 2 : 0,
      }).format(key === "ctr" ? value * 100 : value) +
        (key === "ctr" ? "%" : "");
}
