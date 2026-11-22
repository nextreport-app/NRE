import { z } from "zod";
import type { NreRow } from "../nre/columns";
import { getRowDate } from "../nre/columns";
import { parseDate } from "../nre/dates";
import { buildComparisonReportData } from "../nre/report-data";
import { comparisonPresetPeriods } from "../nre/comparison-period-selection";
import { parseCellNum } from "../nre/format";
export interface PerformanceConfig {
  metaAdAccountId: string | null;
  currency: string;
  timezone: string;
}
export interface PeriodMetrics {
  spend: number;
  impressions: number;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  results: number | null;
  cpr: number | null;
}
export interface PerformanceSignal {
  key: string;
  tone: "warning" | "positive";
  metric: string;
  change: number;
  message: string;
}
export interface CampaignPerformance {
  name: string;
  objective: string;
  costLabel: string;
  current: PeriodMetrics;
  previous: PeriodMetrics;
  comparableResults: boolean;
  signals: PerformanceSignal[];
}
export interface PerformanceFacts {
  periodA: { startIso: string; endIso: string };
  periodB: { startIso: string; endIso: string };
  current: PeriodMetrics;
  previous: PeriodMetrics;
  campaigns: CampaignPerformance[];
  empty: boolean;
}
export interface PerformanceSnapshot {
  version: 1;
  config: PerformanceConfig;
  checkedAt: string;
  facts?: PerformanceFacts;
  error?: string;
  emailError?: string;
}
export function performanceWindow(timezone: string, now = new Date()) {
  return comparisonPresetPeriods("thisWeek", now, timezone);
}
export function samePerformanceConfig(
  a: PerformanceConfig,
  b: PerformanceConfig,
) {
  return (
    a.metaAdAccountId?.replace(/^act_/, "") ===
      b.metaAdAccountId?.replace(/^act_/, "") &&
    a.currency === b.currency &&
    a.timezone === b.timezone
  );
}
const metricSchema = z.object({
  spend: z.number().finite().nonnegative(),
  impressions: z.number().finite().nonnegative(),
  clicks: z.number().finite().nonnegative().nullable(),
  ctr: z.number().finite().nonnegative().nullable(),
  cpc: z.number().finite().nonnegative().nullable(),
  results: z.number().finite().nonnegative().nullable(),
  cpr: z.number().finite().nonnegative().nullable(),
});
const periodSchema = z.object({
  startIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const snapshotSchema = z.object({
  version: z.literal(1),
  config: z.object({
    metaAdAccountId: z.string().nullable(),
    currency: z.string(),
    timezone: z.string(),
  }),
  checkedAt: z.string().datetime(),
  error: z.string().optional(),
  emailError: z.string().optional(),
  facts: z
    .object({
      periodA: periodSchema,
      periodB: periodSchema,
      current: metricSchema,
      previous: metricSchema,
      empty: z.boolean(),
      campaigns: z.array(
        z.object({
          name: z.string(),
          objective: z.string(),
          costLabel: z.string(),
          current: metricSchema,
          previous: metricSchema,
          comparableResults: z.boolean(),
          signals: z.array(
            z.object({
              key: z.string(),
              tone: z.enum(["warning", "positive"]),
              metric: z.string(),
              change: z.number().finite(),
              message: z.string(),
            }),
          ),
        }),
      ),
    })
    .optional(),
});
export function readPerformanceSnapshot(
  raw: string | null,
  config: PerformanceConfig,
  now = new Date(),
): PerformanceSnapshot | null {
  try {
    if (!raw) return null;
    const parsed = snapshotSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const s = parsed.data;
    return samePerformanceConfig(s.config, config) &&
      Date.parse(s.checkedAt) <= now.getTime() + 300000
      ? s
      : null;
  } catch {
    return null;
  }
}
export function isPerformanceFresh(
  snapshot: PerformanceSnapshot | null,
  now = new Date(),
) {
  if (!snapshot?.facts || snapshot.error) return false;
  const age = now.getTime() - Date.parse(snapshot.checkedAt);
  return (
    age >= 0 &&
    age < 26 * 3600000 &&
    snapshot.facts.periodA.endIso ===
      performanceWindow(snapshot.config.timezone, now).periodA.endIso
  );
}
function rowIso(row: NreRow) {
  const d = parseDate(getRowDate(row));
  return d
    ? `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`
    : "";
}
const observed = (value: unknown) =>
  String(value ?? "").trim() !== "" &&
  Number.isFinite(Number(String(value).replaceAll(",", ""))) &&
  Number(String(value).replaceAll(",", "")) >= 0;
function metrics(rows: NreRow[], results: number | null): PeriodMetrics {
  const spend = rows.reduce((sum, r) => sum + parseCellNum(r.spend), 0),
    impressions = rows.reduce((sum, r) => sum + parseCellNum(r.impressions), 0);
  // Explicit all-click counts only. Missing evidence is not zero or a rounded-rate estimate.
  let clicks: number | null = 0;
  for (const row of rows) {
    const raw = Object.entries(row._raw ?? {}).find(
      ([key]) => key.trim().toLowerCase() === "clicks (all)",
    )?.[1];
    if (!observed(raw)) {
      clicks = null;
      break;
    }
    clicks += parseCellNum(raw);
  }
  return {
    spend,
    impressions,
    clicks,
    ctr:
      clicks !== null && impressions > 0 ? (clicks / impressions) * 100 : null,
    cpc: clicks !== null && clicks > 0 ? spend / clicks : null,
    results,
    cpr: results !== null && results > 0 ? spend / results : null,
  };
}
export function campaignSignals(
  current: PeriodMetrics,
  previous: PeriodMetrics,
  comparableResults: boolean,
): PerformanceSignal[] {
  const result: PerformanceSignal[] = [];
  const add = (
    key: string,
    metric: string,
    a: number | null,
    b: number | null,
    threshold: number,
    tone: "warning" | "positive",
    down: boolean,
    message: string,
  ) => {
    if (
      a === null ||
      b === null ||
      b <= 0 ||
      !Number.isFinite(a) ||
      !Number.isFinite(b)
    )
      return;
    const change = (a / b - 1) * 100;
    if ((down ? -change : change) + 1e-8 >= threshold)
      result.push({ key, metric, change, tone, message });
  };
  const delivery = current.impressions >= 1000 && previous.impressions >= 1000;
  if (delivery && (current.clicks ?? 0) >= 10 && (previous.clicks ?? 0) >= 30)
    add(
      "ctr-down",
      "CTR (all)",
      current.ctr,
      previous.ctr,
      20,
      "warning",
      true,
      "CTR fell. Review creative and audience delivery; this signal does not identify the cause.",
    );
  if (delivery && (current.clicks ?? 0) >= 30 && (previous.clicks ?? 0) >= 30)
    add(
      "cpc-up",
      "CPC (all)",
      current.cpc,
      previous.cpc,
      25,
      "warning",
      false,
      "CPC rose. Review auction costs and click quality before changing budgets.",
    );
  if (comparableResults && delivery && (previous.results ?? 0) >= 10) {
    if ((current.results ?? 0) >= 5) {
      add(
        "cpr-up",
        "Cost per result",
        current.cpr,
        previous.cpr,
        25,
        "warning",
        false,
        "Cost per result rose. Review conversion quality and tracking before making changes.",
      );
      add(
        "cpr-down",
        "Cost per result",
        current.cpr,
        previous.cpr,
        20,
        "positive",
        true,
        "Cost per result improved with sufficient reported results. Check lead or purchase quality before scaling.",
      );
    }
    if (current.spend >= previous.spend * 0.8 && previous.spend > 0)
      add(
        "results-down",
        "Results",
        current.results,
        previous.results,
        30,
        "warning",
        true,
        "Reported results fell despite broadly maintained spend. Review delivery and conversion tracking; recent conversions can be delayed.",
      );
  }
  return result;
}
export function buildPerformanceFacts(
  rows: NreRow[],
  headers: string[],
  config: PerformanceConfig,
  now = new Date(),
): PerformanceFacts {
  const { periodA, periodB } = performanceWindow(config.timezone, now);
  if (
    rows.some((row) => {
      const date = rowIso(row);
      return !date || date < periodB.startIso || date > periodA.endIso;
    })
  )
    throw Error("Meta returned rows outside the requested period.");
  const scoped = rows.filter((row) => {
    const date = rowIso(row);
    return date >= periodB.startIso && date <= periodA.endIso;
  });
  if (scoped.some((row) => !observed(row.spend) || !observed(row.impressions)))
    throw Error("Meta returned incomplete delivery metrics.");
  const report = buildComparisonReportData({
    accountName: "Performance monitor",
    currencySymbol: config.currency,
    timezone: config.timezone,
    mtdDailyRows: scoped,
    csvHeaders: headers,
    periodA,
    periodB,
    now,
    platform: "META",
  });
  const inPeriod = (group: NreRow[], period: typeof periodA) =>
    group.filter((r) => {
      const day = rowIso(r);
      return day >= period.startIso && day <= period.endIso;
    });
  const campaigns = report.campaigns.map((c) => {
    const group = scoped.filter((row) => row.campaign_name === c.campaignName),
      a = inPeriod(group, periodA),
      b = inPeriod(group, periodB);
    const types = new Set(
      group
        .filter((row) => parseCellNum(row.spend) > 0)
        .map((row) =>
          String(row.result_type ?? "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    );
    const hasResults = (r: NreRow[]) =>
      r.length > 0 &&
      r.every(
        (row) =>
          observed(row.results) && !!String(row.result_type ?? "").trim(),
      );
    // A goal change or mixed ad-set goals must not trigger a like-for-like result alert.
    const comparableResults =
      types.size === 1 &&
      hasResults(a) &&
      hasResults(b) &&
      c.objective !== "RESULTS";
    const current = metrics(
        a,
        types.size === 1 && hasResults(a) ? c.metricsA.results.value : null,
      ),
      previous = metrics(
        b,
        types.size === 1 && hasResults(b) ? c.metricsB.results.value : null,
      );
    return {
      name: c.campaignName,
      objective: c.objective,
      costLabel: c.costLabel,
      current,
      previous,
      comparableResults,
      signals: campaignSignals(current, previous, comparableResults),
    };
  });
  return {
    periodA,
    periodB,
    current: metrics(inPeriod(scoped, periodA), null),
    previous: metrics(inPeriod(scoped, periodB), null),
    campaigns,
    empty: scoped.length === 0,
  };
}
