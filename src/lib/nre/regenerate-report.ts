import { adSetVisibilityKey } from "./share-report";
/**
 * Re-renders a stored PPTX from the generation-time archive + the agency's
 * published share edits (visibility toggles and copy changes).
 */

import type { ReportData } from "./report-data";
import type { ShareReportData, ShareVisibility } from "./share-report";
import { defaultShareVisibility, restoreHistoricalShareCharts } from "./share-report";
import { applyShareEditsToReportData, patchMetricSlots } from "./apply-share-edits";
import type { AiCopy } from "../pptx/fill-tags";
import type { DayBreakdownReportData } from "./day-breakdown-report-data";
import type { HistoricalReportData } from "./historical-report-data";
import { historicalSlideShareKey } from "./share-report";
import { renderDayBreakdownPptx, renderHistoricalPptx, renderPptx } from "../pptx/render";
import type { ImageAsset } from "../pptx/embed-image";

export interface RenderArchive {
  reportData: ReportData;
  aiCopy: Record<string, AiCopy>;
  currencySymbol: string;
  isLightTemplate: boolean;
  reportTitle?: string | null;
  agencyName?: string | null;
}

export interface HistoricalRenderArchive {
  historicalData: HistoricalReportData;
  aiCopy?: Record<string, AiCopy>;
  reportTitle?: string | null;
  agencyName?: string | null;
  isLightTemplate: boolean;
}

export interface DailyRenderArchive {
  dayBreakdownData: DayBreakdownReportData;
  reportTitle?: string | null;
  agencyName?: string | null;
  isLightTemplate: boolean;
}

export type ShareReportWithArchive = ShareReportData & {
  _renderArchive?: RenderArchive | HistoricalRenderArchive | DailyRenderArchive;
};

function isHistoricalArchive(archive: RenderArchive | HistoricalRenderArchive | DailyRenderArchive): archive is HistoricalRenderArchive {
  return "historicalData" in archive;
}

export function mergeShareCopyIntoAiMap(share: ShareReportData, base: Record<string, AiCopy>): Map<string, AiCopy> {
  const map = new Map<string, AiCopy>(Object.entries(base));
  for (const c of share.campaigns) {
    map.set(`campaign:${c.campaignName}`, { summary: c.aiSummary, insights: c.aiInsights });
  }
  for (const a of share.adSets) {
    map.set(`adset:${a.campaignName}/${a.adSetName}`, { summary: a.aiSummary, insights: a.aiInsights });
  }
  return map;
}

export async function regeneratePptxFromShare(
  share: ShareReportWithArchive,
  templateBuffer: Buffer,
  clientLogo?: ImageAsset | null,
): Promise<Buffer> {
  share = restoreHistoricalShareCharts(share);
  const archive = share._renderArchive;
  if (!archive) {
    throw new Error("This report cannot be regenerated — generate a new report to enable PPT sync.");
  }

  if ("dayBreakdownData" in archive) {
    return renderDayBreakdownPptx({
      templateBuffer, data: { ...archive.dayBreakdownData, accountName: share.accountName, rangeLabel: share.cover.dateRange },
      reportTitle: archive.reportTitle, agencyName: archive.agencyName,
      isLightTemplate: archive.isLightTemplate, clientLogo,
      coverOverride: { healthBadge: share.cover.healthBadge },
      shareVisibility: share.visibility ?? defaultShareVisibility(share),
    });
  }

  if (isHistoricalArchive(archive)) {
    const visibility: ShareVisibility = share.visibility ?? defaultShareVisibility(share);
    const sharedMetrics = new Map(share.campaigns.map(campaign => [campaign.campaignName, campaign.metrics]));
    const slides = archive.historicalData.slides.filter(
      (slide) => visibility.campaigns[historicalSlideShareKey(slide)] !== false,
    ).map(slide => {
      const metrics = sharedMetrics.get(historicalSlideShareKey(slide));
      return metrics ? {
        ...slide,
        dynamicMetrics: patchMetricSlots(slide.dynamicMetrics, metrics) ?? slide.dynamicMetrics,
        additionalMetricsSlide: patchMetricSlots(slide.additionalMetricsSlide, metrics),
      } : slide;
    });

    const adSetSlides = (archive.historicalData.adSetSlides ?? []).filter(slide => {
      const campaignName = `${slide.ai.dateRange || "Month"} — ${slide.campaignName}`;
      return visibility.adSets[adSetVisibilityKey(campaignName, slide.adSetName)] !== false;
    }).map(slide => {
      const campaignName = `${slide.ai.dateRange || "Month"} — ${slide.campaignName}`;
      const metrics = share.adSets.find(item => item.campaignName === campaignName && item.adSetName === slide.adSetName)?.metrics;
      return metrics ? { ...slide, dynamicMetrics: patchMetricSlots(slide.dynamicMetrics, metrics) ?? slide.dynamicMetrics, additionalMetricsSlide: patchMetricSlots(slide.additionalMetricsSlide, metrics) } : slide;
    });
    return renderHistoricalPptx({
      templateBuffer,
      data: { ...archive.historicalData, slides, adSetSlides },
      reportTitle: archive.reportTitle,
      agencyName: archive.agencyName,
      clientLogo,
      isLightTemplate: archive.isLightTemplate,
      aiCopyBySlideKey: mergeShareCopyIntoAiMap(share, archive.aiCopy ?? {}),
      shareVisibility: visibility,
      coverOverride: { ...share.cover, accountName: share.accountName },
    });
  }

  const visibility: ShareVisibility = share.visibility ?? defaultShareVisibility(share);
  const aiCopyBySlideKey = mergeShareCopyIntoAiMap(share, archive.aiCopy);
  const data = applyShareEditsToReportData(archive.reportData, share);
  return renderPptx({
    templateBuffer,
    data,
    currencySymbol: archive.currencySymbol,
    aiCopyBySlideKey,
    reportTitle: archive.reportTitle,
    agencyName: archive.agencyName,
    clientLogo,
    isLightTemplate: archive.isLightTemplate,
    shareVisibility: visibility,
    shareChart: share.chart ?? null,
  });
}

/** Slide counts the client will see after visibility is applied — for the pre-share editor summary line. */
export { countVisibleSlides } from "./share-visibility";
