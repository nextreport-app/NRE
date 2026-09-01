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
import { getDateRangeShortLabel, formatDateUS, getMonthName, parseDate } from "./dates";
import { compactSameMonthRangeLabel, fmtCpm } from "./report-data";
import { buildChartSnapshotKpis } from "./chart-snapshot-kpis";
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
import { detectGoogleObjectiveKey } from "./detect-objective";
import { buildGoogleSlots, buildSlotsFromSelection } from "./slot-assignment";
import { listAvailableMetrics, splitMetricsForSlides, type SelectedMetric } from "./available-metrics";

export const GOOGLE_TABLE_STATIC_HEADERS = ["Month", "Cost", "Clicks", "Impressions", "CTR", "Avg. CPC"] as const;

const RESULT_LABEL = "CONVERSIONS";
const COST_LABEL = "COST PER CONVERSION";

export interface BuildGoogleReportDataInput {
  accountName: string;
  currencySymbol: string;
  monthlyBudget: number | null;
  /** Column-mapped rows from the Google Ads MTD Daily CSV upload. */
  mtdDailyRows: GoogleRow[];
  now?: Date;
  /** See report-data.ts's BuildReportDataInput.selectedMetrics — same Part 3 wizard override, Google's own dictionary/objective vocabulary. */
  selectedMetrics?: SelectedMetric[];
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
    cpm: fmtCpm(group.cost, group.impressions, currencySymbol),
    resultLabel: RESULT_LABEL,
    costLabel: COST_LABEL,
    freq: 0, // Google Ads has no "ad frequency" concept — freqLine-equivalent rendering is simply skipped (see fill-tags.ts's DATE_RANGE handling).
    resultsNum: group.conversions,
    hasResults: group.conversions > 0,
    spendNum: group.cost,
    isInactive: false, // Google Ads has no delivery-status detection (see AiContext.isInactive's own doc comment)
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
  const { accountName, currencySymbol, monthlyBudget, mtdDailyRows, now = new Date(), selectedMetrics } = input;

  // Account-wide campaign-type classification (see slot-assignment.ts's
  // buildGoogleSlots doc comment for why this is account-wide, not
  // per-campaign, unlike Meta's own objective.ts-driven detection).
  const objectiveKey = detectGoogleObjectiveKey(Object.keys(mtdDailyRows[0]?._raw ?? {}));

  // Part 3/4 — see report-data.ts's own metricSlideKeyGroups for the full
  // rationale; identical mechanism, Google's own dictionary.
  const metricSlideKeyGroups: SelectedMetric[][] | null =
    selectedMetrics && selectedMetrics.length > 0
      ? splitMetricsForSlides(selectedMetrics, listAvailableMetrics(Object.keys(mtdDailyRows[0]?._raw ?? {}), "GOOGLE"))
      : null;

  function computeGoogleSlideMetrics(metrics: SlideMetrics, rawRows: GoogleRow[]) {
    if (!metricSlideKeyGroups) {
      return {
        dynamicMetrics: buildGoogleSlots(
          objectiveKey,
          { spend: metrics.spend, reach: metrics.reach, impressions: metrics.impressions, ctr: metrics.ctr, cpc: metrics.cpc, results: metrics.results, cpr: metrics.cpr },
          rawRows,
          currencySymbol,
        ),
      };
    }
    const baselineValues: Partial<Record<string, string>> = {
      spend: metrics.spend,
      reach: metrics.reach,
      impressions: metrics.impressions,
      ctr: metrics.ctr,
      avg_cpc: metrics.cpc,
      conversions: metrics.results,
      cost_per_conv: metrics.cpr,
    };
    const [slide1Keys, slide2Keys] = metricSlideKeyGroups;
    return {
      dynamicMetrics: buildSlotsFromSelection(slide1Keys, baselineValues, rawRows, "google", currencySymbol),
      additionalMetricsSlide: slide2Keys ? buildSlotsFromSelection(slide2Keys, baselineValues, rawRows, "google", currencySymbol) : undefined,
    };
  }

  const campaignGroups = new Map<string, GoogleGroupTotals>();
  const adGroupGroups = new Map<string, GoogleGroupTotals>();
  const campaignRawGroups = new Map<string, GoogleRow[]>();
  const adGroupRawGroups = new Map<string, GoogleRow[]>();

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

    if (!campaignRawGroups.has(campaignName)) campaignRawGroups.set(campaignName, []);
    campaignRawGroups.get(campaignName)!.push(row);
    if (adGroupName) {
      const rawKey = `${campaignName} ${adGroupName}`;
      if (!adGroupRawGroups.has(rawKey)) adGroupRawGroups.set(rawKey, []);
      adGroupRawGroups.get(rawKey)!.push(row);
    }
  });

  const campaigns = [...campaignGroups.values()];
  const adGroups = [...adGroupGroups.values()];

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
      budgetSummary: "",
    };
  }

  const campaignSlides: CampaignSlideData[] = campaigns.map((g) => {
    const metrics = buildMetrics(g, currencySymbol);
    return {
      kind: "campaign" as const,
      campaignName: g.name,
      resultLabel: RESULT_LABEL,
      costLabel: COST_LABEL,
      metrics,
      dateRangeLine: dateRangeLabel,
      avgFreq: 0,
      // Fix 3 — no internal grouping detail ("(combined N ad groups)") sent
      // to the AI; see report-data.ts's own campaign ai.ctx for the Meta
      // equivalent of this same fix.
      ai: buildAiContext(g, g.name, dateRangeLabel, currencySymbol),
      statusIndicator: null,
      ...computeGoogleSlideMetrics(metrics, campaignRawGroups.get(g.name) ?? []),
    };
  });

  const adSetSlides: AdSetSlideData[] = adGroups.map((g) => {
    const adSetName = g.adGroupName ?? "";
    const metrics = buildMetrics(g, currencySymbol);
    return {
      kind: "adset" as const,
      campaignName: g.name,
      adSetName,
      resultLabel: RESULT_LABEL,
      costLabel: COST_LABEL,
      metrics,
      dateRangeLine: dateRangeLabel,
      rowFreq: 0,
      ai: buildAiContext(g, `${g.name} / ${adSetName}`, dateRangeLabel, currencySymbol),
      statusIndicator: null,
      ...computeGoogleSlideMetrics(metrics, adGroupRawGroups.get(`${g.name} ${adSetName}`) ?? []),
    };
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
        snapshot: buildChartSnapshotKpis({
          mtdResultColumns: [
            {
              label: RESULT_LABEL,
              costLabel: COST_LABEL,
              value: fmtNumber(totalConversions),
              cprValue:
                totalConversions > 0 ? fmtCurrency2dp(totalCost / totalConversions, currencySymbol) : "—",
            },
          ],
          mtdGroups: [
            {
              label: RESULT_LABEL,
              costLabel: COST_LABEL,
              count: totalConversions,
              avgCpr: totalConversions > 0 ? totalCost / totalConversions : 0,
              totalSpend: totalCost,
            },
          ],
          totalAllSpendFormatted: fmtCurrency(totalCost, currencySymbol),
          budgetPctUsed: "",
          activeCampaignCount: chartCampaigns.filter((c) => c.isActive).length,
          currencySymbol,
        }),
      };

  const emptyPeriodRow: TableRowData = {
    hasData: false,
    monthLabel: "—",
    fullMonthLabel: "—",
    monthName: null,
    sameMonthAsCurrentMTD: false,
    spend: "—",
    reach: "—",
    impressions: "—",
    ctr: "—",
    cpc: "—",
    resultColumns: [{ label: RESULT_LABEL, costLabel: COST_LABEL, value: "0", cprValue: "—" }],
  };

  // Fix 3 (round 4) — just the plain date range, no "MTD" suffix (matches
  // Meta's own Combined Total table row). Fix 2 (round 5) — that date range
  // is now the same short, same-month-compacted form Meta's table uses
  // ("August 1 - 5" / "July 30 - August 5"), not always the full
  // "Month D - Month D" form dateRangeLabel itself stays as (still used
  // unchanged for the chart's own periodSubLabel above).
  const mtdMonthName = globalStart ? getMonthName(globalStart) : null;
  const mtdMonthLabel = globalEnd ? compactSameMonthRangeLabel(globalStart, globalEnd, mtdMonthName) : "MTD";
  const overallAvgCtr = average(campaigns.flatMap((g) => g.ctrs));
  const overallAvgCpc = average(campaigns.flatMap((g) => g.avgCpcs));
  const overallCostPerConv = totalConversions > 0 ? totalCost / totalConversions : 0;
  const mtdRow: TableRowData = {
    hasData: campaigns.length > 0,
    monthLabel: mtdMonthLabel,
    fullMonthLabel: dateRangeLabel || "—",
    monthName: mtdMonthName,
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
