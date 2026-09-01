/**
 * Builds the JSON payload stored in Report.summaryJson for a WEEKLY/MONTHLY
 * report (never called for COMPARISON reports — see reports/route.ts, whose
 * comparison branch keeps writing its own small summary object; the public
 * share page and ComparisonReportData's very different shape are out of
 * scope for this feature).
 *
 * This is a pure, synchronous projection of ReportData + the AI copy map
 * that already exist by the time the report finishes rendering — no new
 * computation, just picking out and reshaping the fields the public share
 * page (app/r/[token]/page.tsx) needs, so that page never has to re-run any
 * NRE aggregation itself.
 *
 * Round J (full-slide share page replica) extends this additively —
 * ad-set slides, the MTD chart, the Metric Guide, and agency/client name —
 * while leaving every existing field's meaning unchanged, so `version`
 * stays 1: an old summaryJson blob is still valid, just missing the new
 * (optional) fields, which the view layer treats as "that section doesn't
 * render" rather than an error.
 */

import type { AiCopy } from "../pptx/fill-tags";
import type { VisualChartSlideModel } from "./visual-chart-slide";
import { collectLegendEntries } from "../pptx/legend-collect";
import { slideAiKey } from "../pptx/slide-keys";
import type { LegendEntry } from "../pptx/legend-slide";
import { projectChartSlideToShareChart } from "./share-chart-projection";
import type {
  AdSetSlideData,
  CampaignSlideData,
  ChartSlideData,
  Platform,
  ReportData,
  ReportType,
  TableHeaderLabels,
  TableRowData,
} from "./report-data";
import { freqLine } from "./report-data";
import type { DynamicMetricValue } from "./dynamic-metrics";
import type { DeliveryStatusIndicator } from "./delivery-status";

export interface ShareCampaignData {
  campaignName: string;
  resultLabel: string;
  dateRange: string;
  /** "Ad Frequency: 2.3x avg" (with a trailing " ⚠️ High" past the same 3.5x threshold the PPT card uses) — "" when there's no frequency data at all (see report-data.ts's freqLine). */
  adFrequency: string;
  statusIndicator: DeliveryStatusIndicator;
  metrics: DynamicMetricValue[];
  aiSummary: string;
  aiInsights: string;
}

export interface ShareAdSetData {
  campaignName: string;
  adSetName: string;
  resultLabel: string;
  dateRange: string;
  adFrequency: string;
  statusIndicator: DeliveryStatusIndicator;
  metrics: DynamicMetricValue[];
  aiSummary: string;
  aiInsights: string;
}

export interface ShareChartCampaignData {
  name: string;
  spend: number;
  spendLabel: string;
  /** Percentage of totalSpend, 0-100, rounded to 1 decimal place. */
  percentage: number;
  /** 6-hex-digit color, no leading "#" — the same per-campaign color (or the shared grey for a genuine $0 month) the PPT donut ring uses; see chart-slide.ts's ringColorForCampaign. */
  color: string;
  statusIndicator: DeliveryStatusIndicator;
  /**
   * This campaign's own results/cost-per-result, matching the PPT donut's
   * own below-circle text exactly (chart-slide.ts's buildChartSlideXml —
   * same ChartCampaignData.results/resLabel/cpr/cprLabel fields). All four
   * are "" together when this campaign had zero results this month — the
   * share page then shows just the campaign name with no metric lines
   * below it, rather than a hollow "0".
   */
  resultsValueLabel: string;
  resultsLabel: string;
  cprValueLabel: string;
  cprLabel: string;
}

export interface ShareChartSnapshotObjective {
  label: string;
  resultsValue: string;
  cprValue: string;
  cprLabel: string;
  spendFormatted: string;
}

export interface ShareChartSnapshot {
  mode?: "single" | "multi";
  mtdSpendLabel: string;
  primaryResultsValue: string;
  primaryResultsLabel: string;
  primaryCprValue: string;
  primaryCprLabel: string;
  primarySpendFormatted?: string;
  budgetPctUsed: string;
  activeCampaignCount: number;
  objectives?: ShareChartSnapshotObjective[];
  objectivesOmittedCount?: number;
}

export interface ShareDonutSegment {
  name: string;
  spendLabel: string;
  percentage: number;
  color: string;
}

export interface ShareChartData {
  /** "[Month] MTD Overview[: MTD date range]" — matches chart-slide.ts title. */
  title: string;
  /** MTD-only subtitle for the combined overview slide. */
  subtitle: string;
  /** Option A — four account-level KPI tiles (MTD only). */
  snapshot: ShareChartSnapshot;
  /** Option B — spend-mix donut segments (top campaigns + Other). */
  donutSegments: ShareDonutSegment[];
  /** Total MTD spend label for donut center. */
  totalSpendLabel: string;
  /** Optional override for the footer insight line under the donut. */
  footerInsight?: string;
  /** Two-panel visual chart layout — budget donuts + result bars. */
  visualSlide?: VisualChartSlideModel;
  /** @deprecated Legacy bar-chart rows — kept for old share JSON; new reports use donutSegments. */
  summaryLine?: string;
  /** @deprecated Legacy bar-chart rows. */
  campaigns?: ShareChartCampaignData[];
}

export interface ShareReportData {
  /** Bumped only if this shape ever needs a breaking change — lets the share page detect and reject an old/foreign JSON blob instead of rendering garbage. */
  version: 1;
  accountName: string;
  platform: Platform;
  reportType: ReportType;
  isPaused: boolean;
  pausedMessage: string | null;
  fileDateRange: string;
  cover: {
    reportDate: string;
    dateRange: string;
    healthBadge: string;
    healthScore: number;
    budgetSummary: string;
  };
  campaigns: ShareCampaignData[];
  adSets: ShareAdSetData[];
  chart: ShareChartData | null;
  tableHeaderLabels: TableHeaderLabels;
  periodRow: TableRowData;
  mtdRow: TableRowData;
  /** Optional one-line Combined Total story (older share JSON omits this). */
  combinedTotalStory?: string;
  metricGuide: LegendEntry[];
  /** Account/agency name from User.agencyName — null when the generating user never set one (see reports/route.ts). Drives the share page footer's "generated by [Agency Name]" line. */
  agencyName: string | null;
  generatedAt: string;
  /** Which sections appear on the live link / regenerated PPT — all true when omitted (legacy reports). */
  visibility?: ShareVisibility;
  /** ISO timestamp when the agency last published edits from the pre-share editor. */
  publishedAt?: string | null;
}

export interface ShareVisibility {
  cover: boolean;
  overview: boolean;
  combinedTotal: boolean;
  metricGuide: boolean;
  campaigns: Record<string, boolean>;
  adSets: Record<string, boolean>;
}

export function defaultShareVisibility(data: Pick<ShareReportData, "campaigns" | "adSets">): ShareVisibility {
  return {
    cover: true,
    overview: true,
    combinedTotal: true,
    metricGuide: true,
    campaigns: Object.fromEntries(data.campaigns.map((c) => [c.campaignName, true])),
    adSets: Object.fromEntries(data.adSets.map((a) => [adSetVisibilityKey(a.campaignName, a.adSetName), true])),
  };
}

export function adSetVisibilityKey(campaignName: string, adSetName: string): string {
  return `${campaignName}\0${adSetName}`;
}

/** Applies visibility flags for the public share page and regenerated PPT. */
export function applyShareVisibility(data: ShareReportData): ShareReportData {
  const vis = data.visibility ?? defaultShareVisibility(data);
  return {
    ...data,
    campaigns: data.campaigns.filter((c) => vis.campaigns[c.campaignName] !== false),
    adSets: data.adSets.filter((a) => vis.adSets[adSetVisibilityKey(a.campaignName, a.adSetName)] !== false),
    chart: vis.overview ? data.chart : null,
    visibility: vis,
  };
}

/** Extra fields the caller (reports/route.ts) already has in scope but that don't live on ReportData itself. */
export interface ShareReportExtras {
  currencySymbol?: string;
  agencyName?: string | null;
}

const FALLBACK_AI_COPY: AiCopy = {
  summary: "",
  insights: "",
};

/** Strips freqLine's leading "\n" (it's designed to be appended straight onto a date-range line in the PPT) so the share page can lay the two out as independent lines/elements instead. "" stays "" (no frequency data). */
function adFrequencyLabel(freq: number): string {
  const line = freqLine(freq);
  return line ? line.slice(1) : "";
}

function buildShareChart(chart: ChartSlideData | null, _mtdRow: TableRowData, currencySymbol: string): ShareChartData | null {
  if (!chart) return null;
  return projectChartSlideToShareChart(chart, currencySymbol);
}

/** Only ever called for the WEEKLY/MONTHLY pipeline (ReportData) — see this file's header. */
export function buildShareReportData(
  data: ReportData,
  aiCopyBySlideKey: Map<string, AiCopy>,
  now: Date = new Date(),
  extras: ShareReportExtras = {},
): ShareReportData {
  const currencySymbol = extras.currencySymbol ?? "$";

  const campaigns: ShareCampaignData[] = data.campaignSlides.map((slide: CampaignSlideData) => {
    const ai = aiCopyBySlideKey.get(slideAiKey(slide)) ?? FALLBACK_AI_COPY;
    return {
      campaignName: slide.campaignName,
      resultLabel: slide.resultLabel,
      dateRange: slide.ai.dateRange,
      adFrequency: adFrequencyLabel(slide.avgFreq),
      statusIndicator: slide.statusIndicator,
      // Round I — dynamicMetrics may now contain null entries (a slot the
      // uploaded CSV genuinely has no data for); the share page's metric
      // grid only ever renders real, CSV-backed metrics, so nulls are
      // dropped here rather than threaded through as empty cards.
      metrics: slide.dynamicMetrics.filter((m): m is DynamicMetricValue => m !== null),
      aiSummary: ai.summary,
      aiInsights: ai.insights,
    };
  });

  const adSets: ShareAdSetData[] = data.adSetSlides.map((slide: AdSetSlideData) => {
    const ai = aiCopyBySlideKey.get(slideAiKey(slide)) ?? FALLBACK_AI_COPY;
    return {
      campaignName: slide.campaignName,
      adSetName: slide.adSetName,
      resultLabel: slide.resultLabel,
      dateRange: slide.ai.dateRange,
      adFrequency: adFrequencyLabel(slide.rowFreq),
      statusIndicator: slide.statusIndicator,
      metrics: slide.dynamicMetrics.filter((m): m is DynamicMetricValue => m !== null),
      aiSummary: ai.summary,
      aiInsights: ai.insights,
    };
  });

  return {
    version: 1,
    accountName: data.cover.accountName,
    platform: data.platform,
    reportType: data.reportType,
    isPaused: data.isPaused,
    pausedMessage: data.pausedMessage,
    fileDateRange: data.fileDateRange,
    cover: {
      reportDate: data.cover.reportDate,
      dateRange: data.cover.dateRange,
      healthBadge: data.cover.healthBadge,
      healthScore: data.cover.healthScore,
      budgetSummary: data.cover.budgetSummary,
    },
    campaigns,
    adSets,
    chart: buildShareChart(data.chart, data.mtdRow, currencySymbol),
    tableHeaderLabels: data.tableHeaderLabels,
    periodRow: data.periodRow,
    mtdRow: data.mtdRow,
    combinedTotalStory: data.combinedTotalStory,
    metricGuide: collectLegendEntries(data),
    agencyName: extras.agencyName ?? null,
    generatedAt: now.toISOString(),
    visibility: defaultShareVisibility({ campaigns, adSets }),
    publishedAt: null,
  };
}
