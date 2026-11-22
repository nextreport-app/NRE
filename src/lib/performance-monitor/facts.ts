import { decisionSignals } from "./decision";
import {
  decisionPeriods,
  settingsEqual,
  readCampaignTargets,
  type DecisionSettings,
} from "./settings";
import { PURCHASE_ACTIONS, type PurchaseEvidence } from "./purchase-values";
import { z } from "zod";
import type { NreRow } from "../nre/columns";
import { getRowDate } from "../nre/columns";
import { parseDate } from "../nre/dates";
import { buildComparisonReportData } from "../nre/report-data";
import { parseCellNum } from "../nre/format";
export interface PerformanceConfig extends DecisionSettings {
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
  roas?: number | null;
  purchaseValue?: number | null;
  roasSpend?: number | null;
}
export interface PerformanceSignal {
  key: string;
  tone: "critical" | "warning" | "positive";
  role?: "primary" | "supporting";
  state?: "new" | "continuing" | "recovered";
  firstSeenAt?: string;
  metric: string;
  change: number | null;
  message: string;
}
export interface CampaignPerformance {
  id?: string | null;
  target?: import("./settings").CampaignTarget;
  targetMismatch?: boolean;
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
  valueWarning?: boolean;
}
export interface PerformanceSnapshot {
  version: 2;
  config: PerformanceConfig;
  checkedAt: string;
  facts?: PerformanceFacts;
  error?: string;
  emailError?: string;
}
export function performanceWindow(timezone: string, now = new Date()) {
  return decisionPeriods(timezone, {}, now);
}
export function samePerformanceConfig(
  a: PerformanceConfig,
  b: PerformanceConfig,
) {
  return (
    a.metaAdAccountId?.replace(/^act_/, "") ===
      b.metaAdAccountId?.replace(/^act_/, "") &&
    settingsEqual(a, b) &&
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
  roas: z.number().finite().nonnegative().nullable().optional(),
  purchaseValue: z.number().finite().nonnegative().nullable().optional(),
  roasSpend: z.number().finite().nonnegative().nullable().optional(),
});
const periodSchema = z.object({
  startIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const snapshotSchema = z.object({
  version: z.literal(2),
  config: z.object({
    performanceWindowDays: z.number().optional(),
    performanceCustomStart: z.string().nullable().optional(),
    performanceCustomEnd: z.string().nullable().optional(),
    performanceTargetRules: z.string().nullable().optional(),
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
      valueWarning: z.boolean().optional(),
      campaigns: z.array(
        z.object({
          id: z.string().nullable().optional(),
          target: z
            .object({
              objective: z.string(),
              maxCpr: z.number().positive().optional(),
              minRoas: z.number().positive().optional(),
            })
            .optional(),
          targetMismatch: z.boolean().optional(),
          name: z.string(),
          objective: z.string(),
          costLabel: z.string(),
          current: metricSchema,
          previous: metricSchema,
          comparableResults: z.boolean(),
          signals: z.array(
            z.object({
              key: z.string(),
              tone: z.enum(["critical", "warning", "positive"]),
              metric: z.string(),
              change: z.number().finite().nullable(),
              role: z.enum(["primary", "supporting"]).optional(),
              state: z.enum(["new", "continuing", "recovered"]).optional(),
              firstSeenAt: z.string().optional(),
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
      decisionPeriods(snapshot.config.timezone, snapshot.config, now).periodA
        .endIso
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
  return decisionSignals(current, previous, comparableResults);
}

export function buildPerformanceFacts(
  rows: NreRow[],
  headers: string[],
  config: PerformanceConfig,
  now = new Date(),
  purchaseEvidence?: PurchaseEvidence,
): PerformanceFacts {
  const { periodA, periodB } = decisionPeriods(config.timezone, config, now);
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
    const ids = new Set(
      group.map((row) => row._raw?.["Campaign ID"]?.trim()).filter(Boolean),
    );
    const id = ids.size === 1 ? [...ids][0]! : null;
    const actions = new Set(
      group
        .map((row) => row._raw?.["NRE API result action"]?.trim())
        .filter(Boolean),
    );
    const purchase = /purchase/i.test(c.objective);
    const action = actions.size === 1 ? [...actions][0]! : null;
    if (purchase && id && action && PURCHASE_ACTIONS.has(action)) {
      for (const [metrics, evidence] of [
        [current, purchaseEvidence?.[id]?.current],
        [previous, purchaseEvidence?.[id]?.previous],
      ] as const) {
        const value = evidence?.values[action];
        metrics.purchaseValue = value ?? null;
        metrics.roasSpend = evidence?.spend ?? null;
        metrics.roas =
          value !== null &&
          value !== undefined &&
          evidence &&
          evidence.spend > 0
            ? value / evidence.spend
            : null;
      }
    }
    const rule = id
      ? readCampaignTargets(
          config.performanceTargetRules,
          config.metaAdAccountId,
          config.currency,
        )[id]
      : undefined;
    const target = rule?.objective === c.objective ? rule : undefined,
      targetMismatch = !!rule && !target;
    return {
      id,
      target,
      targetMismatch,
      name: c.campaignName,
      objective: c.objective,
      costLabel: c.costLabel,
      current,
      previous,
      comparableResults,
      signals: decisionSignals(current, previous, comparableResults, {
        objective: c.objective,
        purchase,
        target,
        targetMismatch,
      }),
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
