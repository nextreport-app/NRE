/**
 * Multi-Month Historical reports — one campaign slide per calendar month,
 * a month-total slide after each month's campaigns, and a final comparison
 * table across all months.
 */

import type { NreRow } from "./columns";
import { filterRowsByCampaigns, LOW_SPEND_CAMPAIGN_THRESHOLD } from "./campaigns";
import {
  computeHistoricalMonthRanges,
  filterNreRowsByDateRange,
  historicalMonthNowAnchor,
  type HistoricalMonthRange,
  validateHistoricalCsvCoverage,
  computeCsvDateBounds,
} from "./date-range";
import { aggregateRows } from "./aggregate";
import { getGroupedResultDisplayForObjective } from "./objective";
import { buildMetaSlots, buildSlotsFromSelection } from "./slot-assignment";
import { parseCellNum, fmtCurrency2dp } from "./format";
import {
  buildReportData,
  type CampaignSlideData,
  type Platform,
  type ReportData,
  type SlideMetrics,
  type TableHeaderLabels,
  type TableRowData,
  freqLine,
} from "./report-data";
import type { SelectedMetric } from "./available-metrics";
import { buildHistoricalSlideCopy } from "./historical-slide-copy";
import type { AiCopy } from "../pptx/fill-tags";

function historicalSlideShareKey(slide: CampaignSlideData): string {
  const month = slide.ai.dateRange || "Month";
  return `${month} — ${slide.campaignName}`;
}

export interface HistoricalReportData {
  isPaused: boolean;
  accountName: string;
  reportDate: string;
  /** e.g. "May - August 2025" */
  monthsLabel: string;
  monthCount: number;
  monthRanges: HistoricalMonthRange[];
  /** Ordered: each month's campaigns, then that month's total, then next month… */
  slides: CampaignSlideData[];
  /** Final comparison table — one row per month (oldest first). */
  comparisonRows: TableRowData[];
  tableHeaderLabels: TableHeaderLabels;
  platform: Platform;
}

export interface BuildHistoricalReportDataInput {
  accountName: string;
  currencySymbol: string;
  timezone: string;
  monthlyBudget: number | null;
  mtdDailyRows: NreRow[];
  selectedCampaigns?: string[] | null;
  selectedMetrics?: SelectedMetric[];
  campaignObjectives?: Record<string, { resultLabel: string; costLabel: string }>;
  campaignMetricOverrides?: Record<string, string[]>;
  objectiveCache?: Record<string, { resultLabel: string; costLabel: string; key: string }>;
  monthCount: number;
  now?: Date;
  platform?: Platform;
}

export interface HistoricalValidationResult {
  valid: boolean;
  error?: string;
  monthRanges?: HistoricalMonthRange[];
}

/** Validates CSV coverage before preview/generate. */
export function validateHistoricalReportInput(
  mtdDailyRows: NreRow[],
  monthCount: number,
  now: Date = new Date(),
  timezone = "UTC",
): HistoricalValidationResult {
  const bounds = computeCsvDateBounds(mtdDailyRows);
  if (!bounds) {
    return { valid: false, error: "Could not read any dates from the uploaded CSV." };
  }
  const monthRanges = computeHistoricalMonthRanges(monthCount, now, timezone);
  const coverage = validateHistoricalCsvCoverage(bounds, monthRanges);
  if (!coverage.valid) {
    return { valid: false, error: coverage.error, monthRanges };
  }
  return { valid: true, monthRanges };
}

function formatMonthsLabel(ranges: HistoricalMonthRange[]): string {
  if (ranges.length === 0) return "";
  if (ranges.length === 1) return ranges[0].fullMonthLabel;
  const first = ranges[0];
  const last = ranges[ranges.length - 1];
  if (first.year === last.year) {
    return `${first.monthName} - ${last.monthName} ${last.year}`;
  }
  return `${first.fullMonthLabel} - ${last.fullMonthLabel}`;
}

function filterLowSpendCampaignSlides(slides: CampaignSlideData[]): CampaignSlideData[] {
  return slides.filter((slide) => (slide.ai.spendNum ?? 0) >= LOW_SPEND_CAMPAIGN_THRESHOLD);
}

function buildMonthTotalSlide(
  monthRange: HistoricalMonthRange,
  monthReport: ReportData,
  monthRows: NreRow[],
  currencySymbol: string,
  selectedMetrics?: SelectedMetric[],
): CampaignSlideData | null {
  if (!monthReport.mtdRow.hasData) return null;

  const mtd = monthReport.mtdRow;
  const allAgg = aggregateRows(monthRows);
  if (allAgg.length === 0) return null;

  const primaryCol = mtd.resultColumns[0] ?? {
    label: "RESULTS",
    costLabel: "COST PER RESULT",
    value: "0",
    cprValue: "—",
  };
  const campaignObjective = { resultLabel: primaryCol.label, costLabel: primaryCol.costLabel };
  const { resultValue, cprValue } = getGroupedResultDisplayForObjective(allAgg, campaignObjective, currencySymbol);

  let totalSpend = 0;
  let totalReach = 0;
  let totalImpr = 0;
  const ctrs: number[] = [];
  const cpcs: number[] = [];
  allAgg.forEach((row) => {
    totalSpend += parseCellNum(row.spend);
    totalReach += parseCellNum(row.reach);
    totalImpr += parseCellNum(row.impressions);
    const ctr = parseCellNum(row.ctr);
    const cpc = parseCellNum(row.cpc);
    if (ctr > 0) ctrs.push(ctr);
    if (cpc > 0) cpcs.push(cpc);
  });

  const metrics: SlideMetrics = {
    spend: mtd.spend,
    reach: mtd.reach,
    impressions: mtd.impressions,
    results: primaryCol.value,
    ctr: mtd.ctr,
    cpr: primaryCol.cprValue,
    cpc: mtd.cpc,
  };

  const baseline = {
    resultLabel: primaryCol.label,
    costLabel: primaryCol.costLabel,
    spend: metrics.spend,
    reach: metrics.reach,
    impressions: metrics.impressions,
    ctr: metrics.ctr,
    resultValue,
    cprValue,
  };

  const dynamicMetrics =
    selectedMetrics && selectedMetrics.length > 0
      ? buildSlotsFromSelection(selectedMetrics.slice(0, 8), baseline, monthRows, "meta", currencySymbol)
      : buildMetaSlots(baseline, monthRows, currencySymbol);

  const spendNum = parseCellNum(mtd.spend.replace(/[^0-9.-]/g, "") || String(totalSpend));
  const resultsNum = parseCellNum(primaryCol.value);

  return {
    kind: "campaign",
    isMonthTotal: true,
    campaignName: `${monthRange.monthName.toUpperCase()} — ALL CAMPAIGNS TOTAL`,
    resultLabel: primaryCol.label,
    costLabel: primaryCol.costLabel,
    metrics,
    dateRangeLine: monthRange.fullMonthLabel + freqLine(0),
    avgFreq: 0,
    statusIndicator: null,
    dynamicMetrics,
    performanceHeader: monthRange.performanceHeader.replace("PERFORMANCE REPORT", "MONTH TOTAL"),
    ai: {
      ctx: `${monthRange.fullMonthLabel} — All Campaigns`,
      dateRange: monthRange.fullMonthLabel,
      spend: metrics.spend,
      reach: metrics.reach,
      impressions: metrics.impressions,
      results: resultValue,
      cpr: cprValue,
      ctr: metrics.ctr,
      cpc: metrics.cpc,
      cpm: totalImpr > 0 ? fmtCurrency2dp((totalSpend / totalImpr) * 1000, currencySymbol) : "—",
      resultLabel: primaryCol.label,
      costLabel: primaryCol.costLabel,
      freq: 0,
      resultsNum,
      hasResults: resultsNum > 0,
      spendNum,
      isInactive: false,
    },
  };
}

/** Builds AI copy map keyed the same way as historicalSlideShareKey. */
export function buildHistoricalAiCopyMap(slides: CampaignSlideData[]): Map<string, AiCopy> {
  const map = new Map<string, AiCopy>();
  for (const slide of slides) {
    map.set(`campaign:${historicalSlideShareKey(slide)}`, buildHistoricalSlideCopy(slide));
  }
  return map;
}

export function buildHistoricalReportData(input: BuildHistoricalReportDataInput): HistoricalReportData {
  const {
    accountName,
    currencySymbol,
    timezone,
    monthlyBudget,
    mtdDailyRows,
    selectedCampaigns,
    selectedMetrics,
    campaignObjectives,
    campaignMetricOverrides,
    objectiveCache,
    monthCount,
    now = new Date(),
    platform = "META",
  } = input;

  const validation = validateHistoricalReportInput(mtdDailyRows, monthCount, now, timezone);
  const monthRanges = validation.monthRanges ?? computeHistoricalMonthRanges(monthCount, now, timezone);
  const campaignFilteredRows = filterRowsByCampaigns(mtdDailyRows, selectedCampaigns ?? null);

  const slides: CampaignSlideData[] = [];
  const comparisonRows: TableRowData[] = [];
  let tableHeaderLabels: TableHeaderLabels = { resultColumns: [] };

  for (const monthRange of monthRanges) {
    const monthRows = filterNreRowsByDateRange(campaignFilteredRows, monthRange);
    if (monthRows.length === 0) continue;

    const nowForMonth = historicalMonthNowAnchor(monthRange.endIso);
    const monthData = buildReportData({
      accountName,
      currencySymbol,
      timezone,
      monthlyBudget,
      mtdDailyRows: monthRows,
      periodRows: [],
      selectedCampaigns: null,
      selectedAdSets: null,
      reportType: "MONTHLY",
      selectedMetrics,
      campaignObjectives,
      campaignMetricOverrides,
      objectiveCache,
      now: nowForMonth,
      platform,
    });

    tableHeaderLabels = monthData.tableHeaderLabels;

    const monthCampaignSlides = filterLowSpendCampaignSlides(
      monthData.campaignSlides.map((slide) => ({
        ...slide,
        performanceHeader: monthRange.performanceHeader,
        ai: {
          ...slide.ai,
          dateRange: monthRange.fullMonthLabel,
        },
      })),
    );

    slides.push(...monthCampaignSlides);

    const monthTotal = buildMonthTotalSlide(monthRange, monthData, monthRows, currencySymbol, selectedMetrics);
    if (monthTotal) {
      slides.push(monthTotal);
    }

    if (monthData.mtdRow.hasData) {
      comparisonRows.push({
        ...monthData.mtdRow,
        monthLabel: monthRange.fullMonthLabel,
      });
    }
  }

  const reportDateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  })
    .formatToParts(now)
    .reduce(
      (acc, part) => {
        if (part.type === "month") acc.month = part.value;
        if (part.type === "day") acc.day = part.value;
        if (part.type === "year") acc.year = part.value;
        return acc;
      },
      { month: "", day: "", year: "" } as { month: string; day: string; year: string },
    );

  return {
    isPaused: slides.length === 0,
    accountName,
    reportDate: `${reportDateParts.month}-${reportDateParts.day}-${reportDateParts.year}`,
    monthsLabel: formatMonthsLabel(monthRanges),
    monthCount,
    monthRanges,
    slides,
    comparisonRows,
    tableHeaderLabels,
    platform,
  };
}
