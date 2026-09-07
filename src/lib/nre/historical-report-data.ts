/**
 * Multi-Month Historical reports — one campaign slide per calendar month.
 * Reuses buildReportData's MONTHLY pipeline per month (filtered CSV rows +
 * `now` anchored to that month's last day) so objective detection, metric
 * cards, and slide math stay identical to regular monthly reports.
 */

import type { NreRow } from "./columns";
import { filterRowsByCampaigns } from "./campaigns";
import {
  computeHistoricalMonthRanges,
  filterNreRowsByDateRange,
  type HistoricalMonthRange,
  validateHistoricalCsvCoverage,
  computeCsvDateBounds,
} from "./date-range";
import { buildReportData, type CampaignSlideData, type Platform } from "./report-data";

export interface HistoricalReportData {
  isPaused: boolean;
  accountName: string;
  reportDate: string;
  /** e.g. "May - August 2025" */
  monthsLabel: string;
  monthCount: number;
  monthRanges: HistoricalMonthRange[];
  /** Ordered month-by-month (each month's campaigns), each slide tagged with performanceHeader. */
  slides: CampaignSlideData[];
  platform: Platform;
}

export interface BuildHistoricalReportDataInput {
  accountName: string;
  currencySymbol: string;
  timezone: string;
  monthlyBudget: number | null;
  mtdDailyRows: NreRow[];
  selectedCampaigns?: string[] | null;
  selectedMetrics?: import("./available-metrics").SelectedMetric[];
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

  for (const monthRange of monthRanges) {
    const monthRows = filterNreRowsByDateRange(campaignFilteredRows, monthRange);
    if (monthRows.length === 0) continue;

    const nowForMonth = new Date(monthRange.endIso + "T23:59:59Z");
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

    for (const slide of monthData.campaignSlides) {
      slides.push({
        ...slide,
        performanceHeader: monthRange.performanceHeader,
        ai: {
          ...slide.ai,
          dateRange: monthRange.fullMonthLabel,
        },
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
    platform,
  };
}
