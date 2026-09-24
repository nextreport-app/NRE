/**
 * Last-30-days visual chart slide — shared data model for browser, OOXML, and SVG.
 * Single full-width performance leaderboard: one bar per campaign (or objective),
 * bar length proportional to results, spend + cost shown inline.
 */

import { fmtCurrency, fmtCurrency2dp, fmtCurrencyAdaptive } from "./format";
import type { ChartCampaignData, ChartSlideData } from "./report-data";
import { toTitleCaseChartLabel } from "./chart-kpi-layout";
import { formatCampaignDisplayName } from "./chart-campaign-labels";

export const VISUAL_CHART_PALETTE = ["f6ad55", "63b3ed", "68d391", "fc8181", "b794f4"] as const;
const INACTIVE_COLOR = "4a5568";
const MAX_ROWS = 5;

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
  rank: number;
  name: string;
  color: string;
  spendLabel: string;
  resultCount: number;
  resultLine: string;
  costLine: string;
  /** Single-line stats — e.g. "$599 spend · 2,112 landing page views · $0.28 CPLPV · 36.6% of total". */
  statLine: string;
  /** Share of total results across all campaigns/objectives on the chart. */
  resultsSharePct: number;
  /** 0–100 relative to the largest results count in the set. */
  barPct: number;
}

export interface VisualChartSlideModel {
  title: string;
  isMultiObjective: boolean;
  /** Single panel heading for the unified leaderboard. */
  panelHeading: string;
  /** Optional helper line under the panel heading — left empty (bars are self-explanatory). */
  panelSubheading: string;
  /** @deprecated Left panel removed — use panelHeading. */
  leftHeading: string;
  /** @deprecated Right panel removed — use panelHeading. */
  rightHeading: string;
  /** @deprecated Always empty — donut removed from chart slide. */
  miniDonuts: VisualMiniDonut[];
  /** @deprecated Donut removed — always null for new slides. */
  groupedDonut: VisualChartSegment[] | null;
  /** Total spend — kept for share editor backward compatibility. */
  groupedDonutCenterLabel: string;
  resultBars: VisualResultBar[];
  summaryLine: string;
}

/** Short cost suffix for stat lines — readable on the chart slide, not cryptic abbreviations. */
function shortCostAbbrev(cprLabel: string): string {
  const u = cprLabel.toUpperCase();
  if (u.includes("CONVERSATION")) return "cost per result";
  if (u.includes("1K") || u.includes("1000")) return "CPM";
  if (u.includes("LEAD")) return "CPL";
  if (u.includes("PURCHASE")) return "CPP";
  if (u.includes("CLICK")) return "CPC";
  if (u.includes("THRUPLAY")) return "CPT";
  if (u.includes("LANDING PAGE")) return "CPLPV";
  if (u.includes("REACH")) return "CPR";
  return u.replace(/^COST PER /i, "cost per ").toLowerCase();
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

function formatResultsSharePct(results: number, totalResults: number): number {
  if (results <= 0 || totalResults <= 0) return 0;
  return Math.round((results / totalResults) * 1000) / 10;
}

function formatResultsShareLabel(results: number, totalResults: number): string {
  const pct = formatResultsSharePct(results, totalResults);
  if (pct <= 0) return "";
  const label = Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
  return `${label}% of total`;
}

function formatPerformanceStatLine(
  spendLabel: string,
  resultLine: string,
  costLine: string,
  resultsShareLabel: string,
): string {
  const shareSuffix = resultsShareLabel ? ` · ${resultsShareLabel}` : "";
  if (costLine.startsWith("N/A")) return `${spendLabel} spend · ${resultLine}${shareSuffix}`;
  return `${spendLabel} spend · ${resultLine} · ${costLine}${shareSuffix}`;
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
  const sorted = [...campaigns].sort((a, b) => b.results - a.results || b.spend - a.spend);
  const map = new Map<string, string>();
  sorted.forEach((c, i) => {
    const color = c.spend > 0 || c.results > 0 ? VISUAL_CHART_PALETTE[i % VISUAL_CHART_PALETTE.length]! : INACTIVE_COLOR;
    map.set(c.name, color);
  });
  return map;
}

function sumCampaignSpendByObjective(campaigns: ChartCampaignData[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const c of campaigns) {
    map.set(c.resLabel, (map.get(c.resLabel) ?? 0) + c.spend);
  }
  return map;
}

function computeBarPct(results: number, maxResults: number): number {
  if (results <= 0 || maxResults <= 0) return 0;
  return Math.floor((results / maxResults) * 100);
}

function buildResultBars(
  rows: {
    name: string;
    color: string;
    spend: number;
    results: number;
    resLabel: string;
    cpr: number;
    cprLabel: string;
  }[],
  currencySymbol: string,
): VisualResultBar[] {
  const totalResults = rows.reduce((sum, row) => sum + row.results, 0);
  const maxResults = Math.max(1, ...rows.map((r) => r.results));
  return rows
    .slice()
    .sort((a, b) => b.results - a.results || b.spend - a.spend)
    .slice(0, MAX_ROWS)
    .map((row, index) => {
      const resultLine = formatResultLine(row.results, row.resLabel);
      const costLine = formatCostLine(row.cpr, row.cprLabel, currencySymbol, row.results > 0);
      const spendLabel = fmtCurrencyAdaptive(row.spend, currencySymbol);
      const resultsSharePct = formatResultsSharePct(row.results, totalResults);
      const resultsShareLabel = formatResultsShareLabel(row.results, totalResults);
      return {
        rank: index + 1,
        name: row.name,
        color: row.color,
        spendLabel,
        resultCount: row.results,
        resultLine,
        costLine,
        statLine: formatPerformanceStatLine(spendLabel, resultLine, costLine, resultsShareLabel),
        resultsSharePct,
        barPct: computeBarPct(row.results, maxResults),
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

function formatSummaryCost(count: number, cprValue: string, cprLabel: string): string {
  if (count <= 0) return "N/A";
  if (cprValue === "N/A" || cprValue === "—") return "N/A";
  const suffix = shortCostAbbrev(cprLabel);
  return `${cprValue} ${suffix}`;
}

function buildSummaryMulti(
  chart: ChartSlideData,
  currencySymbol: string,
): string {
  const objectives = chart.snapshot.objectives.slice(0, MAX_ROWS);
  const chunks = objectives.map((obj) => {
    const count = parseInt(obj.resultsValue.replace(/,/g, ""), 10) || 0;
    const label = toTitleCaseChartLabel(obj.label);
    const cost = formatSummaryCost(count, obj.cprValue, obj.cprLabel);
    return `${label}: ${count.toLocaleString("en-US")} · ${cost}`;
  });
  const prefix = [`Total Spend: ${fmtCurrency(chart.totalAllSpend, currencySymbol)}`];
  return [...prefix, ...chunks].join("  |  ");
}

/** @deprecated Donut removed — kept for tests referencing legend format. */
export function formatGroupedDonutLegendEntry(
  segment: Pick<VisualChartSegment, "name" | "percentage" | "spendLabel">,
): string {
  return `${segment.name} · ${segment.percentage}% · ${segment.spendLabel}`;
}

export function buildVisualChartTitle(chart: ChartSlideData): string {
  const range = chart.periodSubLabel.trim();
  return range.length > 0 ? `Last 30 Days Campaign Performance: ${range}` : "Last 30 Days Campaign Performance";
}

export function buildVisualChartSlideModel(chart: ChartSlideData, currencySymbol: string): VisualChartSlideModel {
  const isMultiObjective = chart.snapshot.mode === "multi" && chart.snapshot.objectives.length >= 2;
  const title = buildVisualChartTitle(chart);
  const colorByCampaign = assignCampaignColors(chart.campaigns);
  const campaignSpendByObjective = sumCampaignSpendByObjective(chart.campaigns);

  if (isMultiObjective) {
    const objectives = chart.snapshot.objectives.slice(0, MAX_ROWS);

    const resultBars = buildResultBars(
      objectives.map((obj, i) => ({
        name: toTitleCaseChartLabel(obj.label),
        color: VISUAL_CHART_PALETTE[i % VISUAL_CHART_PALETTE.length]!,
        spend:
          campaignSpendByObjective.get(obj.label) ??
          parseFloat(obj.spendFormatted.replace(/[^0-9.-]/g, "")) ??
          0,
        results: parseInt(obj.resultsValue.replace(/,/g, ""), 10) || 0,
        resLabel: obj.label,
        cpr: resolveObjectiveCpr(obj),
        cprLabel: obj.cprLabel,
      })),
      currencySymbol,
    );

    const panelHeading = "Results by Objective";
    const panelSubheading = "";

    return {
      title,
      isMultiObjective: true,
      panelHeading,
      panelSubheading,
      leftHeading: panelHeading,
      rightHeading: panelHeading,
      miniDonuts: [],
      groupedDonut: null,
      groupedDonutCenterLabel: fmtCurrency(chart.totalAllSpend, currencySymbol),
      resultBars,
      summaryLine: buildSummaryMulti(chart, currencySymbol),
    };
  }

  const primaryResLabel = chart.campaigns[0]?.resLabel ?? chart.snapshot.primaryResultsLabel;
  const panelHeading = `${toTitleCaseChartLabel(primaryResLabel)} by Campaign`;
  const panelSubheading = "";
  const resultBars = buildResultBars(
    chart.campaigns.map((c) => ({
      name: formatCampaignDisplayName(c.name),
      color: colorByCampaign.get(c.name) ?? INACTIVE_COLOR,
      spend: c.spend,
      results: c.results,
      resLabel: c.resLabel,
      cpr: c.cpr,
      cprLabel: c.cprLabel,
    })),
    currencySymbol,
  );

  const primaryResults = chart.campaigns.reduce((s, c) => s + c.results, 0);
  const primaryCpr =
    primaryResults > 0 && chart.totalAllSpend > 0 ? chart.totalAllSpend / primaryResults : 0;

  return {
    title,
    isMultiObjective: false,
    panelHeading,
    panelSubheading,
    leftHeading: panelHeading,
    rightHeading: panelHeading,
    miniDonuts: [],
    groupedDonut: null,
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
