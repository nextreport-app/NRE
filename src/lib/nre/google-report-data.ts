/**
 * Google Ads report-data pipeline — the Google Ads counterpart to
 * report-data.ts's buildReportData. Produces the SAME `ReportData` shape
 * (CampaignSlideData/AdSetSlideData/ChartSlideData/TableRowData/CoverData
 * etc., all imported unchanged from report-data.ts) computed from Google
 * Ads CSV fields instead of Meta's, so the entire render layer
 * (render.ts/fill-tags.ts/chart-slide.ts/table-slide.ts) needs only small,
 * additive `platform`-conditional label changes rather than a parallel set
 * of slide builders — see fill-tags.ts and chart-slide.ts's own `platform`
 * parameter for the label-retexting half of that.
 *
 * Deliberately narrower in scope than the Meta pipeline for this first
 * pass: no Previous Month Data upload / 2-row Combined Total comparison
 * (the Combined Total table's Period row is always empty — Google Ads
 * validation and the wizard don't offer that upload yet), no
 * Weekly/Monthly report-type toggle (always the single MTD window, cover
 * always reads "WEEKLY PERFORMANCE REPORT" per spec), no objective/health-
 * score system (Google Ads campaigns don't have Meta's "objective"
 * concept) — a simple spend-based health heuristic is used instead. Each
 * of these is a real, flagged gap, not a silent one.
 */

import { fmtCurrency, fmtCurrency2dp, fmtNumber, fmtPercent, parseCellNum } from "./format";
import { getDateRangeShortLabel, formatDateUS, parseDate } from "./dates";
import { budgetSummaryLine } from "./health";
import type { GoogleRow } from "./google-columns";
import type {
  AdSetSlideData,
  AiContext,
  CampaignSlideData,
  ChartCampaignData,
  ChartSlideData,
  CoverData,
  ReportData,
  SlideMetrics,
  TableHeaderLabels,
  TableRowData,
} from "./report-data";
import type { SelectedMetric } from "./metric-selector";
import { getAvailableMetrics } from "./metric-selector";
import { buildDynamicMetricSlides, type DynamicMetricValue } from "./dynamic-metrics";

export const GOOGLE_TABLE_STATIC_HEADERS = ["Month", "Cost", "Clicks", "Impressions", "CTR", "Avg. CPC"] as const;

const RESULT_LABEL = "CONVERSIONS";
const COST_LABEL = "COST PER CONVERSION";

export interface BuildGoogleReportDataInput {
  accountName: string;
  currencySymbol: string;
  monthlyBudget: number | null;
  /** Column-mapped rows from the Google Ads MTD Daily CSV upload. */
  mtdDailyRows: GoogleRow[];
  /** See report-data.ts's BuildReportDataInput.selectedMetrics — same additive, opt-in dynamic-card behavior. */
  selectedMetrics?: SelectedMetric[];
  now?: Date;
}

/** Builds one or more slides' worth of dynamicMetrics for one campaign/ad-group's raw rows — see dynamic-metrics.ts's buildDynamicMetricSlides for the >8-metric splitting/padding rule. Empty array when no selection was made (fixed-card path, unchanged). */
function buildDynamicMetrics(
  rawRows: GoogleRow[],
  selectedMetrics: SelectedMetric[] | undefined,
  paddingPool: SelectedMetric[],
  currencySymbol: string,
): DynamicMetricValue[][] {
  if (!selectedMetrics || selectedMetrics.length === 0) return [];
  return buildDynamicMetricSlides(rawRows, selectedMetrics, paddingPool, "google", currencySymbol);
}

interface GoogleGroupTotals {
  name: string;
  adGroupName: string | null;
  cost: number;
  clicks: number;
  impressions: number;
  conversions: number;
  ctrs: number[];
  avgCpcs: number[];
  earliestDate: string;
  latestDate: string;
}

function newGroup(name: string, adGroupName: string | null): GoogleGroupTotals {
  return {
    name,
    adGroupName,
    cost: 0,
    clicks: 0,
    impressions: 0,
    conversions: 0,
    ctrs: [],
    avgCpcs: [],
    earliestDate: "",
    latestDate: "",
  };
}

function accumulate(group: GoogleGroupTotals, row: GoogleRow): void {
  group.cost += parseCellNum(row.cost);
  group.clicks += parseCellNum(row.clicks);
  group.impressions += parseCellNum(row.impressions);
  group.conversions += parseCellNum(row.conversions);
  const ctr = parseCellNum(row.ctr);
  if (ctr > 0) group.ctrs.push(ctr);
  const avgCpc = parseCellNum(row.avg_cpc);
  if (avgCpc > 0) group.avgCpcs.push(avgCpc);
  const day = row.day || "";
  if (day && (!group.earliestDate || day < group.earliestDate)) group.earliestDate = day;
  if (day && (!group.latestDate || day > group.latestDate)) group.latestDate = day;
}

function average(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/** cost/conversion, derived rather than read from an (optional, often-absent) CSV column — safe against division by zero. */
function costPerConv(group: GoogleGroupTotals): number {
  return group.conversions > 0 ? group.cost / group.conversions : 0;
}

function buildAiContext(group: GoogleGroupTotals, ctxLabel: string, dateRangeLabel: string, currencySymbol: string): AiContext {
  const avgCtr = average(group.ctrs);
  const avgCpc = average(group.avgCpcs);
  const cpr = costPerConv(group);
  return {
    ctx: ctxLabel,
    dateRange: dateRangeLabel,
    spend: fmtCurrency(group.cost, currencySymbol),
    reach: fmtNumber(group.clicks),
    impressions: fmtNumber(group.impressions),
    results: fmtNumber(group.conversions),
    cpr: cpr > 0 ? fmtCurrency2dp(cpr, currencySymbol) : "—",
    ctr: avgCtr > 0 ? fmtPercent(avgCtr) : "0%",
    cpc: avgCpc > 0 ? fmtCurrency2dp(avgCpc, currencySymbol) : fmtCurrency2dp(0, currencySymbol),
    resultLabel: RESULT_LABEL,
    costLabel: COST_LABEL,
    freq: 0, // Google Ads has no "ad frequency" concept — freqLine-equivalent rendering is simply skipped (see fill-tags.ts's DATE_RANGE handling).
    resultsNum: group.conversions,
    hasResults: group.conversions > 0,
    spendNum: group.cost,
  };
}

function buildMetrics(group: GoogleGroupTotals, currencySymbol: string): SlideMetrics {
  const avgCtr = average(group.ctrs);
  const avgCpc = average(group.avgCpcs);
  const cpr = costPerConv(group);
  return {
    spend: fmtCurrency(group.cost, currencySymbol),
    reach: fmtNumber(group.clicks),
    impressions: fmtNumber(group.impressions),
    results: fmtNumber(group.conversions),
    ctr: avgCtr > 0 ? fmtPercent(avgCtr) : "0%",
    cpr: cpr > 0 ? fmtCurrency2dp(cpr, currencySymbol) : "—",
    cpc: avgCpc > 0 ? fmtCurrency2dp(avgCpc, currencySymbol) : fmtCurrency2dp(0, currencySymbol),
  };
}

/** Google Ads counterpart of report-data.ts's buildCombinedTotalTableGrid — Google's own static header words (Cost/Clicks/Avg. CPC) instead of Meta's (Ad Spend/Reach/CPC (All)), single [Conversions, Cost per Conversion] result-column pair always. */
export function buildGoogleCombinedTotalTableGrid(mtdRow: TableRowData, headers: TableHeaderLabels): string[][] {
  const headerRow = [...GOOGLE_TABLE_STATIC_HEADERS, ...headers.resultColumns.flatMap((c) => [c.label, c.costLabel])];
  const emptyPeriodRow = ["—", "—", "—", "—", "—", "—", ...headers.resultColumns.flatMap(() => ["—", "—"])];
  const dataRow = [
    mtdRow.monthLabel,
    mtdRow.spend,
    mtdRow.reach,
    mtdRow.impressions,
    mtdRow.ctr,
    mtdRow.cpc,
    ...mtdRow.resultColumns.flatMap((c) => [c.value, c.cprValue]),
  ];
  return [headerRow, emptyPeriodRow, dataRow];
}

export function buildGoogleReportData(input: BuildGoogleReportDataInput): ReportData {
  const { accountName, currencySymbol, monthlyBudget, mtdDailyRows, selectedMetrics, now = new Date() } = input;

  const campaignGroups = new Map<string, GoogleGroupTotals>();
  const adGroupGroups = new Map<string, GoogleGroupTotals>();
  const campaignRawGroups = new Map<string, GoogleRow[]>();
  const adGroupRawGroups = new Map<string, GoogleRow[]>();
  const wantsDynamicMetrics = !!selectedMetrics && selectedMetrics.length > 0;

  mtdDailyRows.forEach((row) => {
    const campaignName = (row.campaign_name || "").trim();
    if (!campaignName) return;
    const adGroupName = (row.ad_group_name || "").trim();

    if (!campaignGroups.has(campaignName)) campaignGroups.set(campaignName, newGroup(campaignName, null));
    accumulate(campaignGroups.get(campaignName)!, row);

    if (adGroupName) {
      const key = `${campaignName} ${adGroupName}`;
      if (!adGroupGroups.has(key)) adGroupGroups.set(key, newGroup(campaignName, adGroupName));
      accumulate(adGroupGroups.get(key)!, row);
    }

    if (wantsDynamicMetrics) {
      if (!campaignRawGroups.has(campaignName)) campaignRawGroups.set(campaignName, []);
      campaignRawGroups.get(campaignName)!.push(row);
      if (adGroupName) {
        const rawKey = `${campaignName} ${adGroupName}`;
        if (!adGroupRawGroups.has(rawKey)) adGroupRawGroups.set(rawKey, []);
        adGroupRawGroups.get(rawKey)!.push(row);
      }
    }
  });

  const campaigns = [...campaignGroups.values()];
  const adGroups = [...adGroupGroups.values()];

  // See report-data.ts's dynamicMetricsPaddingPool — the account's full
  // detected-metric candidate pool (no objective filter), used only to pad
  // a campaign/ad-group's final dynamic-card slide up to the 4-card
  // minimum when selectedMetrics splits across multiple slides.
  const dynamicMetricsPaddingPool: SelectedMetric[] = wantsDynamicMetrics
    ? getAvailableMetrics(Object.keys(mtdDailyRows[0]?._raw ?? {}), "google")
    : [];

  let globalStart = "";
  let globalEnd = "";
  campaigns.forEach((g) => {
    if (g.earliestDate && (!globalStart || g.earliestDate < globalStart)) globalStart = g.earliestDate;
    if (g.latestDate && (!globalEnd || g.latestDate > globalEnd)) globalEnd = g.latestDate;
  });
  const dateRangeLabel = globalStart && globalEnd ? getDateRangeShortLabel(globalStart, globalEnd) : "";
  const fileStartDate = globalStart ? formatDateUS(globalStart) : "unknown";
  const fileEndDate = globalEnd ? formatDateUS(globalEnd) : "unknown";
  const fileDateRange =
    fileStartDate !== "unknown" && fileEndDate !== "unknown" ? fileStartDate + " to " + fileEndDate : "Date range unavailable";

  const totalCost = campaigns.reduce((sum, g) => sum + g.cost, 0);
  const totalConversions = campaigns.reduce((sum, g) => sum + g.conversions, 0);
  const isPaused = campaigns.length === 0 || totalCost === 0;

  const reportDate = new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
    .formatToParts(now)
    .reduce(
      (acc, part) => {
        if (part.type === "month") acc.month = part.value;
        if (part.type === "day") acc.day = part.value;
        if (part.type === "year") acc.year = part.value;
        return acc;
      },
      { month: "", day: "", year: "" },
    );
  const reportDateStr = `${reportDate.month}-${reportDate.day}-${reportDate.year}`;

  // Simple spend-based health heuristic — Google Ads campaigns have no
  // Meta-style "objective" to weigh CPA/CTR trends against, so this is
  // deliberately simpler than calculateAccountHealth (health.ts), not a
  // like-for-like port of it.
  let cover: CoverData;
  if (isPaused) {
    cover = {
      accountName,
      reportDate: reportDateStr,
      dateRange: dateRangeLabel || fileDateRange,
      healthBadge: "⚙️ Campaigns Paused",
      healthScore: 0,
      budgetSummary: "",
    };
  } else {
    const avgCpaOk = totalConversions === 0 || totalCost / totalConversions < 10000;
    cover = {
      accountName,
      reportDate: reportDateStr,
      dateRange: dateRangeLabel,
      healthBadge: avgCpaOk ? "✅ Campaigns On Track" : "⚠️ Needs Attention",
      healthScore: avgCpaOk ? 90 : 60,
      budgetSummary: budgetSummaryLine(totalCost, monthlyBudget, currencySymbol, now),
    };
  }

  const campaignSlides: CampaignSlideData[] = campaigns.flatMap((g) => {
    const baseSlide = {
      kind: "campaign" as const,
      resultLabel: RESULT_LABEL,
      costLabel: COST_LABEL,
      metrics: buildMetrics(g, currencySymbol),
      dateRangeLine: dateRangeLabel,
      avgFreq: 0,
      ai: buildAiContext(g, `${g.name} (combined ${adGroups.filter((a) => a.name === g.name).length || 1} ad groups)`, dateRangeLabel, currencySymbol),
      statusIndicator: null,
    };
    const dynamicMetricsSlides = buildDynamicMetrics(campaignRawGroups.get(g.name) ?? [], selectedMetrics, dynamicMetricsPaddingPool, currencySymbol);
    if (dynamicMetricsSlides.length <= 1) {
      return [{ ...baseSlide, campaignName: g.name, dynamicMetrics: dynamicMetricsSlides[0] }];
    }
    return dynamicMetricsSlides.map((dynamicMetrics, i) => ({
      ...baseSlide,
      campaignName: i === 0 ? g.name : `${g.name} (continued)`,
      dynamicMetrics,
    }));
  });

  const adSetSlides: AdSetSlideData[] = adGroups.flatMap((g) => {
    const adSetName = g.adGroupName ?? "";
    const baseSlide = {
      kind: "adset" as const,
      campaignName: g.name,
      resultLabel: RESULT_LABEL,
      costLabel: COST_LABEL,
      metrics: buildMetrics(g, currencySymbol),
      dateRangeLine: dateRangeLabel,
      rowFreq: 0,
      ai: buildAiContext(g, `${g.name} / ${adSetName}`, dateRangeLabel, currencySymbol),
      statusIndicator: null,
    };
    const dynamicMetricsSlides = buildDynamicMetrics(adGroupRawGroups.get(`${g.name} ${adSetName}`) ?? [], selectedMetrics, dynamicMetricsPaddingPool, currencySymbol);
    if (dynamicMetricsSlides.length <= 1) {
      return [{ ...baseSlide, adSetName, dynamicMetrics: dynamicMetricsSlides[0] }];
    }
    return dynamicMetricsSlides.map((dynamicMetrics, i) => ({
      ...baseSlide,
      adSetName: i === 0 ? adSetName : `${adSetName} (continued)`,
      dynamicMetrics,
    }));
  });

  const chartCampaigns: ChartCampaignData[] = campaigns.map((g) => ({
    name: g.name,
    spend: g.cost,
    results: g.conversions,
    cpr: costPerConv(g),
    avgCtr: average(g.ctrs),
    resLabel: RESULT_LABEL,
    cprLabel: COST_LABEL,
    isActive: g.cost > 0,
    statusIndicator: null,
  }));

  const periodYear = parseDate(globalEnd || globalStart)?.year;
  const periodSubLabel = dateRangeLabel && periodYear ? `${dateRangeLabel}, ${periodYear}` : "";

  const chart: ChartSlideData | null = isPaused
    ? null
    : {
        periodLabel: "MTD",
        campaigns: chartCampaigns,
        totalAllSpend: totalCost,
        activeCampaignCount: chartCampaigns.filter((c) => c.isActive).length,
        reportType: "WEEKLY",
        mtdMonthName: null,
        periodSubLabel,
      };

  const emptyPeriodRow: TableRowData = {
    hasData: false,
    monthLabel: "—",
    monthName: null,
    sameMonthAsCurrentMTD: false,
    spend: "—",
    reach: "—",
    impressions: "—",
    ctr: "—",
    cpc: "—",
    resultColumns: [{ label: RESULT_LABEL, costLabel: COST_LABEL, value: "0", cprValue: "—" }],
  };

  const mtdMonthLabel = globalEnd ? `${dateRangeLabel} MTD` : "MTD";
  const overallAvgCtr = average(campaigns.flatMap((g) => g.ctrs));
  const overallAvgCpc = average(campaigns.flatMap((g) => g.avgCpcs));
  const overallCostPerConv = totalConversions > 0 ? totalCost / totalConversions : 0;
  const mtdRow: TableRowData = {
    hasData: campaigns.length > 0,
    monthLabel: mtdMonthLabel,
    monthName: null,
    sameMonthAsCurrentMTD: false,
    spend: fmtCurrency(totalCost, currencySymbol),
    reach: fmtNumber(campaigns.reduce((sum, g) => sum + g.clicks, 0)),
    impressions: fmtNumber(campaigns.reduce((sum, g) => sum + g.impressions, 0)),
    ctr: overallAvgCtr > 0 ? fmtPercent(overallAvgCtr) : "—",
    cpc: overallAvgCpc > 0 ? fmtCurrency2dp(overallAvgCpc, currencySymbol) : "—",
    resultColumns: [
      {
        label: RESULT_LABEL,
        costLabel: COST_LABEL,
        value: fmtNumber(totalConversions),
        cprValue: overallCostPerConv > 0 ? fmtCurrency2dp(overallCostPerConv, currencySymbol) : "—",
      },
    ],
  };

  const tableHeaderLabels: TableHeaderLabels = { resultColumns: [{ label: RESULT_LABEL, costLabel: COST_LABEL }] };

  return {
    isPaused,
    platform: "GOOGLE",
    reportType: "WEEKLY",
    cover,
    campaignSlides,
    adSetSlides,
    pausedMessage: isPaused ? "Campaigns paused — no spend recorded for this period. Awaiting instructions to resume." : null,
    chart,
    periodRow: emptyPeriodRow,
    mtdRow,
    tableHeaderLabels,
    fileDateRange,
    objectiveWarnings: [],
  };
}
