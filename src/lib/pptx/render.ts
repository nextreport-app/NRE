/**
 * Top-level PPTX render orchestrator — builds the final ordered slide list
 * (cover, campaign summaries, ad-set slides, MTD chart, period/MTD table,
 * legend) and assembles it into a downloadable .pptx Buffer.
 *
 * Slide order matches generateWeeklyReport()'s actual output order exactly:
 * Cover → ALL campaign summary slides → ALL ad-set slides (not interleaved
 * per campaign — see report-data.ts) → MTD chart → Period/MTD table →
 * Legend. The paused case replaces everything after Cover with a single
 * message slide, and skips the chart (both match the source).
 */

import type { ReportData } from "../nre/report-data";
import { buildChartSlideXml } from "./chart-slide";
import { buildCampaignOrAdSetSlideXml, buildCoverSlideXml, buildPausedSlideXml, buildTableSlideXml, type AiCopy } from "./fill-tags";
import { assemblePptx, loadTemplate, type SlideToInsert } from "./package";

const CHART_SLIDE_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/></Relationships>';

export interface RenderPptxInput {
  templateBuffer: Buffer;
  data: ReportData;
  currencySymbol: string;
  /** AI-written copy per slide, keyed the same way as slideAiKey() below. Missing entries fall back to a placeholder string, matching callAI_'s own fallback. */
  aiCopyBySlideKey?: Map<string, AiCopy>;
}

export function slideAiKey(slide: { kind: "campaign" | "adset"; campaignName: string; adSetName?: string }): string {
  return slide.kind === "campaign" ? `campaign:${slide.campaignName}` : `adset:${slide.campaignName}/${slide.adSetName}`;
}

export async function renderPptx(input: RenderPptxInput): Promise<Buffer> {
  const { templateBuffer, data, currencySymbol, aiCopyBySlideKey } = input;
  const template = await loadTemplate(templateBuffer);
  const slides: SlideToInsert[] = [];

  slides.push({ xml: buildCoverSlideXml(template.cover, data.cover), rels: template.cover.rels });

  if (data.isPaused) {
    slides.push({
      xml: buildPausedSlideXml(template.campaign, data.cover.accountName, data.pausedMessage ?? "", data.cover.dateRange),
      rels: template.campaign.rels,
    });
  } else {
    for (const slide of data.campaignSlides) {
      const ai = aiCopyBySlideKey?.get(slideAiKey(slide));
      slides.push({ xml: buildCampaignOrAdSetSlideXml(template.campaign, slide, ai), rels: template.campaign.rels });
    }
    for (const slide of data.adSetSlides) {
      const ai = aiCopyBySlideKey?.get(slideAiKey(slide));
      slides.push({ xml: buildCampaignOrAdSetSlideXml(template.campaign, slide, ai), rels: template.campaign.rels });
    }
    if (data.chart) {
      slides.push({ xml: buildChartSlideXml(data.chart, currencySymbol), rels: CHART_SLIDE_RELS });
    }
  }

  slides.push({
    xml: buildTableSlideXml(template.table, data.periodRow, data.mtdRow, data.tableHeaderLabels),
    rels: template.table.rels,
  });
  slides.push({ xml: template.legend.xml, rels: template.legend.rels });

  return assemblePptx(template, slides);
}
