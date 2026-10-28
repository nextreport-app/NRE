/**
 * Last-30-days visual chart slide — shared data model for browser, OOXML, and SVG.
 * Shared campaign identity/order/colors across spend mix and performance panels.
 * Homogeneous result types use a shared count scale; mixed goals use spend.
 */

import { objectiveRate } from "./objective-rate";
import { fmtCurrency, fmtCurrency2dp, fmtCurrencyAdaptive, parseCellNum } from "./format";
import type { ChartCampaignData, ChartSlideData } from "./report-data";
import { toTitleCaseChartLabel } from "./chart-kpi-layout";
import {
  buildCampaignShortLabels,
  CHART_CAMPAIGN_DISPLAY_MAX,
  fitCampaignNameForSingleBarLine,
  formatCampaignDisplayName,
} from "./chart-campaign-labels";
import { resultBarColumns } from "../pptx/chart-campaign-bars-render";
import { resultBarLayout } from "../pptx/chart-slide-layout";

const RESULT_BAR_RIGHT_LABEL_W_PT = 96;

function splitPanelCampaignNameLayout(barCount: number, hasSubheading = false) {
  const cols = resultBarColumns(true);
  const layout = resultBarLayout(barCount, hasSubheading);
  const labelWidthPt = cols.trackW - RESULT_BAR_RIGHT_LABEL_W_PT;
  return { labelWidthPt, nameSizePt: layout.nameSizePt };
}

/** Chart segment colors — vivid enough to read on navy slides, softer than legacy neon accents. */
export const VISUAL_CHART_PALETTE = ["5eb0ef", "f2ab50", "5fd98d", "f48484", "b090ef"] as const;
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
  /** Original identifier, retained for browser tooltips and cross-panel matching. */
  fullName?: string;
  valueLabel?: string;
  /** Supporting spend and per-unit cost, distinct from the bar value/scale. */
  statLine: string;
  resultsSharePct: number;
  barPct: number;
}

/** Actual result count (or spend for mixed goals), not a completion percentage. */
export function visualResultBarRightLabel(bar: Pick<VisualResultBar, "barPct" | "resultsSharePct" | "valueLabel">): string {
  return bar.valueLabel ?? "";
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
  const count = parseCellNum(params.resultsValue);
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

/** Render the engine's resolved event; campaign names cannot relabel its count. */
function chartCampaignDisplayFields(c: ChartCampaignData): { resLabel: string; cprLabel: string } {
  return { resLabel: c.resLabel, cprLabel: c.cprLabel };
}

/** Short donut-legend labels — campaign names live on the results bars panel. */
export function formatDonutObjectiveLabel(resLabel: string): string {
  const u = resLabel.toUpperCase();
  if (u === "META FORM LEADS") return "Meta Instant Form";
  if (u === "LEADS") return "Leads";
  if (u === "LINK CLICKS") return "Traffic";
  if (u === "REACH" || u === "UNIQUE REACH") return "Reach";
  if (u === "WEBSITE LEADS") return "Website Leads";
  if (u === "LANDING PAGE VIEWS") return "Landing Page Views";
  if (u.includes("MESSAGING") || u.includes("WHATSAPP")) return "Messaging";
  if (u === "PURCHASES") return "Purchases";
  if (u === "VIDEO VIEWS" || u.includes("THRUPLAY")) return "Video Views";
  return toTitleCaseChartLabel(resLabel);
}

function preciseChartMoney(value: number, currency: string): string {
  return `${currency}${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function clientCost(cpr: number, label: string, currency: string, hasResults: boolean): string {
  if (!hasResults || cpr <= 0) return "cost unavailable";
  const units: Record<string, string> = {
    "COST PER LANDING PAGE VIEW": "view", "COST PER LPV": "view",
    "COST PER PURCHASE": "purchase", "COST PER LEAD": "lead",
    "COST PER WEBSITE LEAD": "website lead", "COST PER FORM LEAD": "form lead",
    "COST PER CLICK": "click", "COST PER LINK CLICK": "link click",
  };
  const unit = units[label.toUpperCase()] ?? label.replace(/^COST PER /i, "").toLowerCase();
  return `${fmtCurrency2dp(cpr, currency)} / ${unit}`;
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
    /** Bar length is relative to the largest spend/count, not share of total or goal completion. */
    barScale?: "spend" | "results";
    campaignNameMax?: number;
    /** When set, truncates each bar name to fit one line with its ranked prefix ("1. …"). */
    campaignLabelWidthPt?: number;
    campaignNameFontSizePt?: number;
    displayLabels?: Map<string, string>;
    showValues?: boolean;
    compactStats?: boolean;
  },
): VisualResultBar[] {
  const defaultNameMax = options.campaignNameMax ?? CHART_CAMPAIGN_DISPLAY_MAX;
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
      const barPct =
        barScale === "spend" ? computeBarPct(row.spend, maxSpend) : computeBarPct(row.results, maxResults);
      const rank = index + 1;
      const label = options.displayLabels?.get(row.name) ?? row.name;
      const displayName =
        options.campaignLabelWidthPt != null && options.campaignNameFontSizePt != null
          ? fitCampaignNameForSingleBarLine(
              label,
              rank,
              options.campaignLabelWidthPt,
              options.campaignNameFontSizePt,
            )
          : formatCampaignDisplayName(label, defaultNameMax);
      return {
        rank,
        name: displayName,
        fullName: row.name,
        ...(options.showValues ? { valueLabel: barScale === "spend" ? fmtCurrencyAdaptive(row.spend, currencySymbol) : row.results.toLocaleString("en-US") } : {}),
        color: row.color,
        spendLabel,
        resultCount: row.results,
        resultLine,
        costLine,
        statLine: options.compactStats
          ? `${preciseChartMoney(row.spend, currencySymbol)} spend · ${clientCost(row.cpr, row.cprLabel, currencySymbol, row.results > 0)}`
          : formatStatLine({
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
    `Total Spend: ${preciseChartMoney(chart.totalAllSpend, currencySymbol)}`,
    `Total ${toTitleCaseChartLabel(primaryLabel)}: ${primaryResults.toLocaleString("en-US")}`,
  ];
  if (primaryResults > 0) {
    const cpr =
      primaryCpr > 0 ? primaryCpr : objectiveRate(chart.totalAllSpend, primaryResults, primaryLabel) ?? 0;
    if (cpr > 0) {
      parts.push(
        `${toTitleCaseChartLabel(primaryCprLabel)}: ${fmtCurrency2dp(cpr, currencySymbol)}`,
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
    const count = parseCellNum(obj.resultsValue);
    const label = toTitleCaseChartLabel(obj.label);
    const cost = formatSummaryCost(count, obj.cprValue, obj.cprLabel);
    return `${label}: ${count.toLocaleString("en-US")} · ${cost}`;
  });
  const prefix = [`Total Spend: ${fmtCurrency(chart.totalAllSpend, currencySymbol)}`];
  return [...prefix, ...chunks].join("  |  ");
}

/** Preserve precise spend; percentage text is rounded only for presentation. */
export function formatGroupedDonutLegendValue(segment: Pick<VisualChartSegment, "percentage" | "spendLabel">): string {
  return `${segment.percentage.toFixed(1)}% of spend · ${segment.spendLabel}`;
}

export function formatGroupedDonutLegendEntry(segment: Pick<VisualChartSegment, "name" | "percentage" | "spendLabel">): string {
  return `${segment.name} · ${formatGroupedDonutLegendValue(segment)}`;
}

export function buildVisualChartTitle(chart: ChartSlideData): string {
  const range = chart.periodSubLabel.trim();
  // Duration alone cannot distinguish a calendar month from a rolling window.
  const rollingWindow = chart.reportType === "WEEKLY" && (chart.actualPeriodDays == null || chart.actualPeriodDays === 30);
  const heading = rollingWindow ? "Last 30 Days" : chart.reportType === "MONTHLY" ? "Monthly Campaign Performance" : chart.reportType === "DAILY" ? "Single-Day Campaign Performance" : "Campaign Performance";
  return range ? `${heading} · ${range}` : `${heading}${rollingWindow ? " Campaign Performance" : ""}`;
}

/** Aggregate every campaign before limiting legend rows; never split one goal into campaign slices. */
function buildObjectiveSpendDonut(
  campaigns: ChartCampaignData[], totalSpend: number, currencySymbol: string,
): VisualChartSegment[] {
  const totals = new Map<string, number>();
  for (const campaign of campaigns) {
    if (campaign.spend <= 0) continue;
    const objective = campaign.resLabel.trim().toUpperCase() || "UNSPECIFIED OBJECTIVE";
    totals.set(objective, (totals.get(objective) ?? 0) + campaign.spend);
  }
  const ordered = [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const unassigned = totalSpend - ordered.reduce((sum, [, spend]) => sum + spend, 0);
  const legendLimit = unassigned > 0.005 ? MAX_ROWS - 1 : MAX_ROWS;
  const segments: VisualChartSegment[] = ordered.slice(0, legendLimit).map(([objective, spend], index) => ({
    name: toTitleCaseChartLabel(objective),
    color: VISUAL_CHART_PALETTE[index % VISUAL_CHART_PALETTE.length]!,
    percentage: totalSpend > 0 ? spend / totalSpend * 100 : 0,
    spendLabel: preciseChartMoney(spend, currencySymbol),
  }));
  const omittedSpend = ordered.slice(legendLimit).reduce((sum, [, spend]) => sum + spend, 0);
  if (omittedSpend > 0) segments.push({
    name: `Other objectives (${ordered.length - legendLimit})`, color: "64748b",
    percentage: omittedSpend / totalSpend * 100, spendLabel: preciseChartMoney(omittedSpend, currencySymbol),
  });
  if (unassigned > 0.005) segments.push({
    name: "Unassigned spend", color: "64748b", percentage: unassigned / totalSpend * 100,
    spendLabel: preciseChartMoney(unassigned, currencySymbol),
  });
  return segments;
}

export function buildVisualChartSlideModel(chart: ChartSlideData, currencySymbol: string): VisualChartSlideModel {
  const isMultiObjective = chart.snapshot.mode === "multi" && chart.snapshot.objectives.length >= 2;
  const title = buildVisualChartTitle(chart);
  const colorByCampaign = assignCampaignColors(chart.campaigns);
  const campaignSpendByObjective = sumCampaignSpendByObjective(chart.campaigns);
  const reportingCampaigns = chart.campaigns.filter((c) => c.spend > 0 || c.results > 0);
  const useSplitPanel = reportingCampaigns.length >= 1 && chart.totalAllSpend > 0;
  const useCampaignBars = reportingCampaigns.length >= 2;
  const uniqueObjectives = new Set(reportingCampaigns.map((c) => chartCampaignDisplayFields(c).resLabel));
  const mixedCampaignObjectives = uniqueObjectives.size > 1;

  // The donut aggregates objectives independently; campaign bars retain their existing order and colors.
  if (useCampaignBars && useSplitPanel) {
    const barSort: "spend" | "results" = mixedCampaignObjectives ? "spend" : "results";
    const ordered = [...reportingCampaigns].sort((a, b) =>
      (mixedCampaignObjectives ? b.spend - a.spend || b.results - a.results : b.results - a.results || b.spend - a.spend)
      || a.name.localeCompare(b.name),
    );
    const groupedDonut = buildObjectiveSpendDonut(reportingCampaigns, chart.totalAllSpend, currencySymbol);
    const colors = new Map(ordered.map(c => [c.name,
      groupedDonut.find(segment => segment.name === toTitleCaseChartLabel(c.resLabel.trim().toUpperCase()))?.color ?? "64748b",
    ]));
    const labels = buildCampaignShortLabels(ordered.map(c => c.name), 28);
    const shown = ordered.slice(0, MAX_ROWS);
    const primaryResLabel = ordered[0]!.resLabel;
    const resultLabel = toTitleCaseChartLabel(primaryResLabel);
    const rightHeading = mixedCampaignObjectives ? "Campaign performance" : `${resultLabel} by Campaign`;
    const panelSubheading = `${ordered.length > MAX_ROWS ? `Top ${MAX_ROWS} of ${ordered.length} · ` : ""}${mixedCampaignObjectives ? "Bars show spend (different goals)" : ""}`.replace(/ · $/, "");
    const nameLayout = splitPanelCampaignNameLayout(shown.length, true);
    const resultBars = buildResultBars(ordered.map(c => ({
      name: c.name, color: colors.get(c.name)!, spend: c.spend, results: c.results,
      resLabel: c.resLabel, cpr: c.cpr, cprLabel: c.cprLabel,
    })), currencySymbol, {
      includeSpend: false, includeResultsShare: false, barScale: barSort,
      displayLabels: labels, showValues: true, compactStats: !mixedCampaignObjectives,
      campaignLabelWidthPt: nameLayout.labelWidthPt, campaignNameFontSizePt: nameLayout.nameSizePt,
    });
    const primaryResults = ordered.reduce((sum, c) => sum + c.results, 0);
    return {
      title, isMultiObjective: mixedCampaignObjectives, useSplitPanel: true,
      panelHeading: rightHeading, panelSubheading, leftHeading: "Spend by Objective", rightHeading,
      miniDonuts: [], groupedDonut, groupedDonutCenterLabel: preciseChartMoney(chart.totalAllSpend, currencySymbol),
      resultBars,
      summaryLine: mixedCampaignObjectives
        ? `Total Spend: ${preciseChartMoney(chart.totalAllSpend, currencySymbol)} · Results use each campaign's own goal`
        : buildSummarySingle(chart, currencySymbol, primaryResLabel, primaryResults,
          objectiveRate(chart.totalAllSpend, primaryResults, primaryResLabel) ?? 0, ordered[0]!.cprLabel),
    };
  }

  if (isMultiObjective) {
    const objectives = chart.snapshot.objectives.slice(0, MAX_ROWS);
    const objectiveBarCount = Math.min(MAX_ROWS, objectives.length);
    const fullPanelCols = resultBarColumns(false);
    const resultBars = buildResultBars(
      objectives.map((obj, i) => ({
        name: toTitleCaseChartLabel(obj.label),
        color: VISUAL_CHART_PALETTE[i % VISUAL_CHART_PALETTE.length]!,
        spend:
          campaignSpendByObjective.get(obj.label) ??
          parseFloat(obj.spendFormatted.replace(/[^0-9.-]/g, "")) ??
          0,
        results: parseCellNum(obj.resultsValue),
        resLabel: obj.label,
        cpr: resolveObjectiveCpr(obj),
        cprLabel: obj.cprLabel,
      })),
      currencySymbol,
      {
        includeSpend: true,
        includeResultsShare: false,
        barScale: "spend",
        campaignLabelWidthPt: fullPanelCols.trackW - RESULT_BAR_RIGHT_LABEL_W_PT,
        campaignNameFontSizePt: resultBarLayout(objectiveBarCount, false).nameSizePt,
      },
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
    ? buildObjectiveSpendDonut(reportingCampaigns, chart.totalAllSpend, currencySymbol)
    : null;

  const barCount = Math.min(MAX_ROWS, reportingCampaigns.length || chart.campaigns.length);
  const splitNameLayout = useSplitPanel ? splitPanelCampaignNameLayout(barCount, false) : null;
  const barSource = reportingCampaigns.length > 0 ? reportingCampaigns : chart.campaigns;
  const resultBars = buildResultBars(
    barSource.map((c) => {
      const display = chartCampaignDisplayFields(c);
      return {
        name: c.name,
        color: colorByCampaign.get(c.name) ?? INACTIVE_COLOR,
        spend: c.spend,
        results: c.results,
        resLabel: display.resLabel,
        cpr: c.cpr,
        cprLabel: display.cprLabel,
      };
    }),
    currencySymbol,
    {
      includeSpend: false,
      includeResultsShare: false,
      showValues: true,
      barScale: "results",
      ...(splitNameLayout
        ? {
            campaignLabelWidthPt: splitNameLayout.labelWidthPt,
            campaignNameFontSizePt: splitNameLayout.nameSizePt,
          }
        : { campaignNameMax: CHART_CAMPAIGN_DISPLAY_MAX }),
    },
  );

  const primaryResults = chart.campaigns.reduce((s, c) => s + c.results, 0);
  const primaryCpr = objectiveRate(chart.totalAllSpend, primaryResults, primaryResLabel) ?? 0;

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
