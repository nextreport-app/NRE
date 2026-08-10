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
 */

import type { AiCopy } from "../pptx/fill-tags";
import { slideAiKey } from "../pptx/render";
import type { CampaignSlideData, Platform, ReportData, ReportType, TableHeaderLabels, TableRowData } from "./report-data";
import type { DynamicMetricValue } from "./dynamic-metrics";
import type { DeliveryStatusIndicator } from "./delivery-status";

export interface ShareCampaignData {
  campaignName: string;
  resultLabel: string;
  dateRange: string;
  statusIndicator: DeliveryStatusIndicator;
  metrics: DynamicMetricValue[];
  aiSummary: string;
  aiInsights: string;
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
  tableHeaderLabels: TableHeaderLabels;
  periodRow: TableRowData;
  mtdRow: TableRowData;
  generatedAt: string;
}

const FALLBACK_AI_COPY: AiCopy = {
  summary: "",
  insights: "",
};

/** Only ever called for the WEEKLY/MONTHLY pipeline (ReportData) — see this file's header. Campaign slides only, not ad sets: the share page's Section 3 spec is explicitly "one per campaign." */
export function buildShareReportData(data: ReportData, aiCopyBySlideKey: Map<string, AiCopy>, now: Date = new Date()): ShareReportData {
  const campaigns: ShareCampaignData[] = data.campaignSlides.map((slide: CampaignSlideData) => {
    const ai = aiCopyBySlideKey.get(slideAiKey(slide)) ?? FALLBACK_AI_COPY;
    return {
      campaignName: slide.campaignName,
      resultLabel: slide.resultLabel,
      dateRange: slide.ai.dateRange,
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
    tableHeaderLabels: data.tableHeaderLabels,
    periodRow: data.periodRow,
    mtdRow: data.mtdRow,
    generatedAt: now.toISOString(),
  };
}
