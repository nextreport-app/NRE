/**
 * MTD Visual Chart slide — shared data model for browser, OOXML, and SVG.
 * Left: one grouped spend donut (multi-color segments by campaign or objective).
 * Right: result bars sorted by spend — name, results + cost, then bar underneath.
 */

import { fmtCurrency, fmtCurrency2dp } from "./format";
import type { ChartCampaignData, ChartSlideData } from "./report-data";
import { toTitleCaseChartLabel } from "./chart-kpi-layout";
import { buildDonutSegments } from "../pptx/chart-slide";

export const VISUAL_CHART_PALETTE = ["f6ad55", "63b3ed", "68d391", "fc8181", "b794f4"] as const;
const INACTIVE_COLOR = "4a5568";
const MAX_LEFT_ITEMS = 5;

export interface VisualChartSegment {
  name: string;
  color: string;
  percentage: number;
  spendLabel: string;
}

export interface VisualMiniDonut {
  name: string;
  spendLabel: string;
  pctLabel: string;
  color: string;
}

export interface VisualResultBar {
  name: string;
  color: string;
  resultCount: number;
  resultLine: string;
  costLine: string;
  /** Single-line stats under the bar — e.g. "6,626 link clicks $0.29 CPC". */
  statLine: string;
  /** 0–100 relative to the largest spend in the set. */
  barPct: number;
}

export interface VisualChartSlideModel {
  title: string;
  isMultiObjective: boolean;
  leftHeading: string;
  rightHeading: string;
  /** @deprecated Always empty — use groupedDonut. Kept for backward-compatible API. */
  miniDonuts: VisualMiniDonut[];
  /** One spend donut with proportional segments (campaigns or objectives). */
  groupedDonut: VisualChartSegment[] | null;
  groupedDonutCenterLabel: string;
  resultBars: VisualResultBar[];
  summaryLine: string;
}

function truncateName(name: string, max = 18): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function shortCostAbbrev(cprLabel: string): string {
  const u = cprLabel.toUpperCase();
  if (u.includes("1K") || u.includes("1000")) return "CPM";
  if (u.includes("LEAD")) return "CPL";
  if (u.includes("PURCHASE")) return "CPP";
  if (u.includes("CLICK")) return "CPC";
  if (u.includes("THRUPLAY")) return "CPT";
  if (u.includes("LANDING PAGE")) return "CPLPV";
  if (u.includes("REACH")) return "CPR";
  return u.replace(/^COST PER /, "CP ").slice(0, 8);
}

function resultUnitLabel(resLabel: string, count: number): string {
  const base = resLabel.toLowerCase().replace(/_/g, " ");
  if (count === 1) return base.replace(/s$/, "");
  return base;
}

function formatResultLine(count: number, resLabel: string): string {
  return `${count.toLocaleString("en-US")} ${resultUnitLabel(resLabel, count)}`;
}

function formatCostLine(cpr: number, cprLabel: string, currencySymbol: string, hasResults: boolean): string {
  if (!hasResults) return "N/A cost";
  if (cpr <= 0) return `N/A ${shortCostAbbrev(cprLabel)}`;
  return `${fmtCurrency2dp(cpr, currencySymbol)} ${shortCostAbbrev(cprLabel)}`;
}

function formatStatLine(resultLine: string, costLine: string): string {
  if (costLine.startsWith("N/A")) return resultLine;
  return `${resultLine} ${costLine}`;
}

/** Parse CPR from snapshot fields — falls back to spend ÷ results when stored CPR rounded to $0. */
export function resolveObjectiveCpr(params: {
  resultsValue: string;
  cprValue: string;
  spendFormatted: string;
}): number {
  const parsed = parseFloat(params.cprValue.replace(/[^0-9.-]/g, ""));
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  const spend = parseFloat(params.spendFormatted.replace(/[^0-9.-]/g, ""));
  const count = parseInt(params.resultsValue.replace(/,/g, ""), 10) || 0;
  if (count > 0 && spend > 0) return spend / count;
  return 0;
}

function assignCampaignColors(campaigns: ChartCampaignData[]): Map<string, string> {
  const sorted = [...campaigns].sort((a, b) => b.spend - a.spend);
  const map = new Map<string, string>();
  sorted.forEach((c, i) => {
    const color = c.spend > 0 ? VISUAL_CHART_PALETTE[i % VISUAL_CHART_PALETTE.length]! : INACTIVE_COLOR;
    map.set(c.name, color);
  });
  return map;
}

function buildResultBars(
  rows: { name: string; color: string; spend: number; results: number; resLabel: string; cpr: number; cprLabel: string }[],
  currencySymbol: string,
): VisualResultBar[] {
  const maxSpend = Math.max(1, ...rows.map((r) => r.spend));
  return rows
    .slice()
    .sort((a, b) => b.spend - a.spend)
    .map((row) => {
      const resultLine = formatResultLine(row.results, row.resLabel);
      const costLine = formatCostLine(row.cpr, row.cprLabel, currencySymbol, row.results > 0);
      return {
        name: row.name,
        color: row.color,
        resultCount: row.results,
        resultLine,
        costLine,
        statLine: formatStatLine(resultLine, costLine),
        barPct: row.spend > 0 ? Math.round((row.spend / maxSpend) * 100) : 0,
      };
    });
}

function buildSummarySingle(
  chart: ChartSlideData,
  currencySymbol: string,
  primaryLabel: string,
  primaryResults: number,
  primaryCpr: number,
  primaryCprLabel: string,
): string {
  const parts = [
    `Total Spend: ${fmtCurrency(chart.totalAllSpend, currencySymbol)}`,
    `Total ${toTitleCaseChartLabel(primaryLabel)}: ${primaryResults.toLocaleString("en-US")}`,
  ];
  if (primaryResults > 0) {
    const cpr =
      primaryCpr > 0 ? primaryCpr : chart.totalAllSpend > 0 ? chart.totalAllSpend / primaryResults : 0;
    if (cpr > 0) {
      parts.push(
        `Average Cost Per ${toTitleCaseChartLabel(primaryLabel)}: ${fmtCurrency2dp(cpr, currencySymbol)}`,
      );
    }
  }
  return parts.join(" · ");
}

function buildSummaryMulti(
  chart: ChartSlideData,
  currencySymbol: string,
): string {
  const objectives = chart.snapshot.objectives.slice(0, MAX_LEFT_ITEMS);
  const chunks = objectives.map((obj) => {
    const count = parseInt(obj.resultsValue.replace(/,/g, ""), 10) || 0;
    const label = toTitleCaseChartLabel(obj.label);
    const cost = obj.cprValue === "N/A" || obj.cprValue === "—" ? "N/A" : obj.cprValue;
    const abbrev = shortCostAbbrev(obj.cprLabel);
    return `${label}: ${count.toLocaleString("en-US")} · ${cost} ${abbrev}`;
  });
  const prefix = [`Total Spend: ${fmtCurrency(chart.totalAllSpend, currencySymbol)}`];
  return [...prefix, ...chunks].join("  |  ");
}

export function buildVisualChartTitle(chart: ChartSlideData): string {
  const range = chart.periodSubLabel.trim();
  return range.length > 0 ? `Last 30 Days Campaign Performance: ${range}` : "Last 30 Days Campaign Performance";
}

export function buildVisualChartSlideModel(chart: ChartSlideData, currencySymbol: string): VisualChartSlideModel {
  const isMultiObjective = chart.snapshot.mode === "multi" && chart.snapshot.objectives.length >= 2;
  const title = buildVisualChartTitle(chart);
  const colorByCampaign = assignCampaignColors(chart.campaigns);

  if (isMultiObjective) {
    const objectives = chart.snapshot.objectives.slice(0, MAX_LEFT_ITEMS);
    const totalObjSpend = objectives.reduce((sum, obj) => {
      const n = parseFloat(obj.spendFormatted.replace(/[^0-9.-]/g, "")) || 0;
      return sum + n;
    }, 0);
    const spendTotal = chart.totalAllSpend > 0 ? chart.totalAllSpend : totalObjSpend;

    const groupedDonut: VisualChartSegment[] = objectives.map((obj, i) => {
      const spend = parseFloat(obj.spendFormatted.replace(/[^0-9.-]/g, "")) || 0;
      return {
        name: toTitleCaseChartLabel(obj.label),
        color: VISUAL_CHART_PALETTE[i % VISUAL_CHART_PALETTE.length]!,
        percentage: spendTotal > 0 ? Math.round((spend / spendTotal) * 1000) / 10 : 0,
        spendLabel: obj.spendFormatted,
      };
    });

    const resultBars = buildResultBars(
      objectives.map((obj, i) => ({
        name: toTitleCaseChartLabel(obj.label),
        color: VISUAL_CHART_PALETTE[i % VISUAL_CHART_PALETTE.length]!,
        spend: parseFloat(obj.spendFormatted.replace(/[^0-9.-]/g, "")) || 0,
        results: parseInt(obj.resultsValue.replace(/,/g, ""), 10) || 0,
        resLabel: obj.label,
        cpr: resolveObjectiveCpr(obj),
        cprLabel: obj.cprLabel,
      })),
      currencySymbol,
    );

    return {
      title,
      isMultiObjective: true,
      leftHeading: "BUDGET DISTRIBUTION",
      rightHeading: "RESULTS BY OBJECTIVE",
      miniDonuts: [],
      groupedDonut,
      groupedDonutCenterLabel: fmtCurrency(chart.totalAllSpend, currencySymbol),
      resultBars,
      summaryLine: buildSummaryMulti(chart, currencySymbol),
    };
  }

  const segments = buildDonutSegments(chart.campaigns, chart.totalAllSpend);
  const groupedDonut: VisualChartSegment[] = segments.map((s) => ({
    name: truncateName(s.name),
    color: s.color,
    percentage: s.percentage,
    spendLabel: fmtCurrency(s.spend, currencySymbol),
  }));

  const primaryResLabel = chart.campaigns[0]?.resLabel ?? chart.snapshot.primaryResultsLabel;
  const resultBars = buildResultBars(
    chart.campaigns.map((c) => ({
      name: truncateName(c.name, 22),
      color: colorByCampaign.get(c.name) ?? INACTIVE_COLOR,
      spend: c.spend,
      results: c.results,
      resLabel: c.resLabel,
      cpr: c.cpr,
      cprLabel: c.cprLabel,
    })),
    currencySymbol,
  ).slice(0, MAX_LEFT_ITEMS);

  const primaryResults = chart.campaigns.reduce((s, c) => s + c.results, 0);
  const primaryCpr =
    primaryResults > 0 && chart.totalAllSpend > 0 ? chart.totalAllSpend / primaryResults : 0;

  return {
    title,
    isMultiObjective: false,
    leftHeading: "BUDGET DISTRIBUTION",
    rightHeading: `${toTitleCaseChartLabel(primaryResLabel)} by Campaign`,
    miniDonuts: [],
    groupedDonut,
    groupedDonutCenterLabel: fmtCurrency(chart.totalAllSpend, currencySymbol),
    resultBars,
    summaryLine: buildSummarySingle(
      chart,
      currencySymbol,
      primaryResLabel,
      primaryResults,
      primaryCpr,
      chart.campaigns[0]?.cprLabel ?? chart.snapshot.primaryCprLabel,
    ),
  };
}
