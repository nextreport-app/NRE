/**
 * Last-30-days visual chart slide — shared data model for browser, OOXML, and SVG.
 * Two-panel layout (2+ campaigns): spend donut left, results + cost-per-result bars right.
 * Single campaign: results bar only — no redundant "100% of total" or spend-by-week donut.
 */

import { fmtCurrency, fmtCurrency2dp, fmtCurrencyAdaptive } from "./format";
import type { ChartCampaignData, ChartSlideData } from "./report-data";
import { toTitleCaseChartLabel } from "./chart-kpi-layout";
import { formatCampaignDisplayName } from "./chart-campaign-labels";

export const VISUAL_CHART_PALETTE = ["f6ad55", "63b3ed", "68d391", "fc8181", "b794f4"] as const;
const INACTIVE_COLOR = "4a5568";
const MAX_ROWS = 5;
const SINGLE_CAMPAIGN_BAR_CAP = 75;

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
  /** Metrics under the campaign name — spend omitted on split/single-campaign layouts. */
  statLine: string;
  resultsSharePct: number;
  barPct: number;
}

export interface VisualChartSlideModel {
  title: string;
  isMultiObjective: boolean;
  /** Spend donut (left) + results bars (right) when 2+ campaigns. */
  useSplitPanel: boolean;
  panelHeading: string;
  panelSubheading: string;
  leftHeading: string;
  rightHeading: string;
  miniDonuts: VisualMiniDonut[];
  groupedDonut: VisualChartSegment[] | null;
  groupedDonutCenterLabel: string;
  resultBars: VisualResultBar[];
  summaryLine: string;
}

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

function formatStatLine(params: {
  spendLabel: string;
  resultLine: string;
  costLine: string;
  resultsShareLabel: string;
  includeSpend: boolean;
}): string {
  const shareSuffix = params.resultsShareLabel ? ` · ${params.resultsShareLabel}` : "";
  const metrics = params.includeSpend
    ? params.costLine.startsWith("N/A")
      ? `${params.spendLabel} spend · ${params.resultLine}${shareSuffix}`
      : `${params.spendLabel} spend · ${params.resultLine} · ${params.costLine}${shareSuffix}`
    : params.costLine.startsWith("N/A")
      ? `${params.resultLine}${shareSuffix}`
      : `${params.resultLine} · ${params.costLine}${shareSuffix}`;
  return metrics;
}

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
  const sorted = [...campaigns].sort((a, b) => b.spend - a.spend || b.results - a.results);
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

function computeBarPct(value: number, maxValue: number): number {
  if (value <= 0 || maxValue <= 0) return 0;
  return Math.floor((value / maxValue) * 100);
}

/** Short donut-legend labels — campaign names live on the results bars panel. */
export function formatDonutObjectiveLabel(resLabel: string): string {
  const u = resLabel.toUpperCase();
  if (u === "META FORM LEADS" || u === "LEADS") return "Meta Instant Form";
  if (u === "LINK CLICKS") return "Traffic";
  if (u === "REACH" || u === "UNIQUE REACH") return "Reach";
  if (u === "WEBSITE LEADS") return "Website Leads";
  if (u === "LANDING PAGE VIEWS") return "Landing Page Views";
  if (u.includes("MESSAGING") || u.includes("WHATSAPP")) return "Messaging";
  if (u === "PURCHASES") return "Purchases";
  if (u === "VIDEO VIEWS" || u.includes("THRUPLAY")) return "Video Views";
  return toTitleCaseChartLabel(resLabel);
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
  options: {
    includeSpend: boolean;
    includeResultsShare: boolean;
    singleCampaignBarCap?: boolean;
    /** Bar fill width reflects spend share (default) or results share. */
    barScale?: "spend" | "results";
  },
): VisualResultBar[] {
  const barScale = options.barScale ?? "spend";
  const totalResults = rows.reduce((sum, row) => sum + row.results, 0);
  const maxSpend = Math.max(1, ...rows.map((r) => r.spend));
  const maxResults = Math.max(1, ...rows.map((r) => r.results));
  return rows
    .slice()
    .sort((a, b) =>
      barScale === "spend" ? b.spend - a.spend || b.results - a.results : b.results - a.results || b.spend - a.spend,
    )
    .slice(0, MAX_ROWS)
    .map((row, index) => {
      const resultLine = formatResultLine(row.results, row.resLabel);
      const costLine = formatCostLine(row.cpr, row.cprLabel, currencySymbol, row.results > 0);
      const spendLabel = fmtCurrencyAdaptive(row.spend, currencySymbol);
      const resultsShareLabel = options.includeResultsShare
        ? formatResultsShareLabel(row.results, totalResults)
        : "";
      let barPct =
        barScale === "spend" ? computeBarPct(row.spend, maxSpend) : computeBarPct(row.results, maxResults);
      if (options.singleCampaignBarCap && rows.length === 1) {
        barPct = Math.min(barPct, SINGLE_CAMPAIGN_BAR_CAP);
      }
      return {
        rank: index + 1,
        name: row.name,
        color: row.color,
        spendLabel,
        resultCount: row.results,
        resultLine,
        costLine,
        statLine: formatStatLine({
          spendLabel,
          resultLine,
          costLine,
          resultsShareLabel,
          includeSpend: options.includeSpend,
        }),
        resultsSharePct: formatResultsSharePct(row.results, totalResults),
        barPct,
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

function buildSummaryMulti(chart: ChartSlideData, currencySymbol: string): string {
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

/** Mixed-objective campaign chart — one footer line per campaign objective, not folded table columns. */
function buildSummaryFromCampaigns(campaigns: ChartCampaignData[], totalSpend: number, currencySymbol: string): string {
  const rows = campaigns
    .filter((c) => c.spend > 0 || c.results > 0)
    .slice()
    .sort((a, b) => b.spend - a.spend || b.results - a.results);
  const chunks = rows.map((c) => {
    const label = formatDonutObjectiveLabel(c.resLabel);
    const countLabel = formatResultLine(c.results, c.resLabel);
    const cost =
      c.results > 0 && c.cpr > 0
        ? `${fmtCurrency2dp(c.cpr, currencySymbol)} ${shortCostAbbrev(c.cprLabel)}`
        : "N/A";
    return `${label}: ${countLabel} · ${cost}`;
  });
  return [`Total Spend: ${fmtCurrency(totalSpend, currencySymbol)}`, ...chunks].join("  |  ");
}

export function formatGroupedDonutLegendEntry(
  segment: Pick<VisualChartSegment, "name" | "percentage" | "spendLabel">,
): string {
  return `${segment.name} · ${segment.percentage}% · ${segment.spendLabel}`;
}

export function buildVisualChartTitle(chart: ChartSlideData): string {
  const range = chart.periodSubLabel.trim();
  const shortWindow = chart.actualPeriodDays != null && chart.actualPeriodDays < 30;
  if (!range) return shortWindow ? "Campaign Performance" : "Last 30 Days Campaign Performance";
  if (shortWindow) return `Campaign Performance: ${range}`;
  return `Last 30 Days Campaign Performance: ${range}`;
}

function buildGroupedDonutFromCampaigns(
  campaigns: ChartCampaignData[],
  colorByCampaign: Map<string, string>,
  totalSpend: number,
  currencySymbol: string,
): VisualChartSegment[] {
  const withSpend = campaigns
    .filter((c) => c.spend > 0)
    .sort((a, b) => b.spend - a.spend || b.results - a.results);
  const top = withSpend.slice(0, MAX_ROWS);
  const topSpend = top.reduce((sum, c) => sum + c.spend, 0);
  const otherSpend = Math.max(0, totalSpend - topSpend);
  const slices: VisualChartSegment[] = top.map((c) => ({
    name: formatDonutObjectiveLabel(c.resLabel),
    color: colorByCampaign.get(c.name) ?? INACTIVE_COLOR,
    percentage: totalSpend > 0 ? Math.round((c.spend / totalSpend) * 1000) / 10 : 0,
    spendLabel: fmtCurrencyAdaptive(c.spend, currencySymbol),
  }));
  if (otherSpend > 0.005) {
    slices.push({
      name: "Other",
      color: "64748b",
      percentage: totalSpend > 0 ? Math.round((otherSpend / totalSpend) * 1000) / 10 : 0,
      spendLabel: fmtCurrencyAdaptive(otherSpend, currencySymbol),
    });
  }
  return slices;
}

export function buildVisualChartSlideModel(chart: ChartSlideData, currencySymbol: string): VisualChartSlideModel {
  const isMultiObjective = chart.snapshot.mode === "multi" && chart.snapshot.objectives.length >= 2;
  const title = buildVisualChartTitle(chart);
  const colorByCampaign = assignCampaignColors(chart.campaigns);
  const campaignSpendByObjective = sumCampaignSpendByObjective(chart.campaigns);
  const reportingCampaigns = chart.campaigns.filter((c) => c.spend > 0 || c.results > 0);
  const useSplitPanel = reportingCampaigns.length >= 1 && chart.totalAllSpend > 0;
  const useCampaignBars = reportingCampaigns.length >= 2;
  const uniqueObjectives = new Set(reportingCampaigns.map((c) => c.resLabel));
  const mixedCampaignObjectives = uniqueObjectives.size > 1;

  // Two or more campaigns: spend donut (objective labels) + per-campaign result bars.
  if (useCampaignBars && useSplitPanel) {
    const groupedDonut = buildGroupedDonutFromCampaigns(
      reportingCampaigns,
      colorByCampaign,
      chart.totalAllSpend,
      currencySymbol,
    );
    const primaryResLabel = chart.campaigns[0]?.resLabel ?? chart.snapshot.primaryResultsLabel;
    const resultLabel = toTitleCaseChartLabel(primaryResLabel);
    const rightHeading = mixedCampaignObjectives ? "Performance by Campaign" : `${resultLabel} by Campaign`;

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
      {
        includeSpend: false,
        includeResultsShare: !mixedCampaignObjectives && reportingCampaigns.length > 1,
        barScale: "spend",
      },
    );

    return {
      title,
      isMultiObjective,
      useSplitPanel: true,
      panelHeading: rightHeading,
      panelSubheading: "",
      leftHeading: "Spend by Objective",
      rightHeading,
      miniDonuts: [],
      groupedDonut,
      groupedDonutCenterLabel: fmtCurrency(chart.totalAllSpend, currencySymbol),
      resultBars,
      summaryLine: mixedCampaignObjectives
        ? buildSummaryFromCampaigns(reportingCampaigns, chart.totalAllSpend, currencySymbol)
        : isMultiObjective
          ? buildSummaryMulti(chart, currencySymbol)
          : buildSummarySingle(
            chart,
            currencySymbol,
            primaryResLabel,
            chart.campaigns.reduce((s, c) => s + c.results, 0),
            chart.campaigns.reduce((s, c) => s + c.results, 0) > 0 && chart.totalAllSpend > 0
              ? chart.totalAllSpend / chart.campaigns.reduce((s, c) => s + c.results, 0)
              : 0,
            chart.campaigns[0]?.cprLabel ?? chart.snapshot.primaryCprLabel,
          ),
    };
  }

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
      { includeSpend: true, includeResultsShare: objectives.length > 1, barScale: "spend" },
    );

    const panelHeading = "Results by Objective";
    return {
      title,
      isMultiObjective: true,
      useSplitPanel: false,
      panelHeading,
      panelSubheading: "",
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
  const resultLabel = toTitleCaseChartLabel(primaryResLabel);
  const groupedDonut = useSplitPanel
    ? buildGroupedDonutFromCampaigns(reportingCampaigns, colorByCampaign, chart.totalAllSpend, currencySymbol)
    : null;

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
    {
      includeSpend: false,
      includeResultsShare: reportingCampaigns.length > 1,
      singleCampaignBarCap: false,
      barScale: "spend",
    },
  );

  const primaryResults = chart.campaigns.reduce((s, c) => s + c.results, 0);
  const primaryCpr =
    primaryResults > 0 && chart.totalAllSpend > 0 ? chart.totalAllSpend / primaryResults : 0;

  return {
    title,
    isMultiObjective: false,
    useSplitPanel,
    panelHeading: `${resultLabel} by Campaign`,
    panelSubheading: "",
    leftHeading: "Spend by Objective",
    rightHeading: `${resultLabel} by Campaign`,
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
