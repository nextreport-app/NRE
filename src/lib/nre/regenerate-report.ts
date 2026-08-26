/**
 * Re-renders a stored PPTX from the generation-time archive + the agency's
 * published share edits (visibility toggles and copy changes).
 */

import type { ReportData } from "./report-data";
import type { ShareReportData, ShareVisibility } from "./share-report";
import { adSetVisibilityKey, defaultShareVisibility } from "./share-report";
import { applyShareEditsToReportData } from "./apply-share-edits";
import type { AiCopy } from "../pptx/fill-tags";
import { renderPptx, slideAiKey } from "../pptx/render";
import type { ImageAsset } from "../pptx/embed-image";

export interface RenderArchive {
  reportData: ReportData;
  aiCopy: Record<string, AiCopy>;
  currencySymbol: string;
  isLightTemplate: boolean;
  reportTitle?: string | null;
  agencyName?: string | null;
}

export type ShareReportWithArchive = ShareReportData & { _renderArchive?: RenderArchive };

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
  const archive = share._renderArchive;
  if (!archive) {
    throw new Error("This report cannot be regenerated — generate a new report to enable PPT sync.");
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
  });
}

/** Slide counts the client will see after visibility is applied — for the pre-share editor summary line. */
export function countVisibleSlides(share: ShareReportData): number {
  const vis = share.visibility ?? defaultShareVisibility(share);
  let n = 1; // cover
  if (share.isPaused) return n + 1;
  n += share.campaigns.filter((c) => vis.campaigns[c.campaignName] !== false).length;
  n += share.adSets.filter((a) => vis.adSets[adSetVisibilityKey(a.campaignName, a.adSetName)] !== false).length;
  if (vis.overview !== false && share.chart?.donutSegments?.length) n += 1;
  if (vis.combinedTotal !== false) n += 1;
  if (vis.metricGuide !== false && (share.metricGuide?.length ?? 0) > 0) n += 1;
  return n;
}
