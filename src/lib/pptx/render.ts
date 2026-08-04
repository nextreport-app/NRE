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
import { findMetaMetricByKey } from "../nre/meta-dictionary";
import { findGoogleMetricByKey } from "../nre/google-dictionary";
import { buildChartSlideXml, CHART_BG_REL_ID } from "./chart-slide";
import { buildCampaignOrAdSetSlideXml, buildCoverSlideXml, buildPausedSlideXml, buildTableSlideXml, presentedToTopY, type AiCopy } from "./fill-tags";
import { embedImageInSlide, ensureContentTypeDefault, SLIDE_HEIGHT_EMU, type ImageAsset, type ImageFrameStyle } from "./embed-image";
import { assemblePptx, loadTemplate, type SlideToInsert } from "./package";
import { buildLegendSlideXml, LEGEND_BG_REL_ID, type LegendEntry } from "./legend-slide";

// The chart slide is built from scratch (no template slide part behind it),
// so unlike the cover/campaign/table slides it needs its own explicit rels:
// a slideLayout (for valid placeholder inheritance) plus the copied
// background picture's image relationship, registered under the same rId
// chart-slide.ts's own <p:pic> embeds via (CHART_BG_REL_ID).
function buildChartSlideRels(backgroundMediaTarget: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/>' +
    `<Relationship Id="${CHART_BG_REL_ID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${backgroundMediaTarget}"/>` +
    "</Relationships>"
  );
}

/** Same shape as buildChartSlideRels above — the dynamic legend slide is also built from scratch, so it needs its own generated rels rather than reusing template.legend.rels. */
function buildLegendSlideRels(backgroundMediaTarget: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/>' +
    `<Relationship Id="${LEGEND_BG_REL_ID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${backgroundMediaTarget}"/>` +
    "</Relationships>"
  );
}

/** Collects every distinct metric key used across a report's dynamicMetrics (the Metric Preview wizard step's selection), in first-seen order, and resolves each to a term + one-line explanation from the platform's own dictionary. Empty when no slide used dynamicMetrics at all — the fixed-card path, where the caller falls back to the original static template.legend.xml. */
function collectLegendEntries(data: ReportData): LegendEntry[] {
  const seen = new Set<string>();
  const entries: LegendEntry[] = [];
  const findByKey = data.platform === "GOOGLE" ? findGoogleMetricByKey : findMetaMetricByKey;

  for (const slide of [...data.campaignSlides, ...data.adSetSlides]) {
    for (const metric of slide.dynamicMetrics ?? []) {
      if (seen.has(metric.key)) continue;
      seen.add(metric.key);
      const dictEntry = findByKey(metric.key);
      entries.push({ term: metric.label, explanation: dictEntry?.explanation ?? metric.label });
    }
  }
  return entries;
}

// Client logo: cover slide only, LEFT-aligned directly above the
// "PRESENTED TO" label/client-name column — max 180x90px, aspect-preserved.
// A square/portrait logo naturally caps at 90x90 through the same
// "contain" fit math, no special-casing needed: scaling to fit within a
// 180-wide x 90-tall box always lands on the 90-tall edge once width <=
// height. X aligns with PRESENTED_TO/ACCOUNT_NAME's own left edge (506630
// EMU) for a clean vertical column.
//
// PRESENTED_TO's own y is NOT static — buildCoverSlideXml (fill-tags.ts)
// shifts it up when an agency name is set (to make room for the "Prepared
// by ..." line), so this anchors off fill-tags.ts's exported
// presentedToTopY() rather than a locally-duplicated constant — anchoring
// to a stale/wrong y here previously caused a real overlap with the
// PRESENTED_TO badge whenever agencyName was also set.
const CLIENT_LOGO_MAX_CX_EMU = 180 * 9525;
const CLIENT_LOGO_MAX_CY_EMU = 90 * 9525;
const CLIENT_LOGO_X_EMU = 506630;
const CLIENT_LOGO_GAP_EMU = 150000; // >= the requested 0.15in (137160 EMU) minimum gap to PRESENTED_TO

// Subtle rounded corners + a faint white outline so the logo reads as
// intentionally framed rather than a flat image pasted onto the dark
// background. ~9% corner radius is within the requested 8-10% range; a
// 1pt 80%-opaque ("20% transparent") white border is deliberately faint —
// just enough to lift the edge, not a highlighted box.
const CLIENT_LOGO_STYLE: ImageFrameStyle = {
  cornerRadiusFraction: 0.09,
  border: { widthPt: 1, colorHex: "FFFFFF", opacityPercent: 80 },
};

function clientLogoBox(hasAgencyName: boolean) {
  const bottomY = presentedToTopY(hasAgencyName) - CLIENT_LOGO_GAP_EMU;
  return {
    corner: "bottom-left" as const,
    marginXEmu: CLIENT_LOGO_X_EMU,
    marginYEmu: SLIDE_HEIGHT_EMU - bottomY,
    maxCxEmu: CLIENT_LOGO_MAX_CX_EMU,
    maxCyEmu: CLIENT_LOGO_MAX_CY_EMU,
  };
}

export interface RenderPptxInput {
  templateBuffer: Buffer;
  data: ReportData;
  currencySymbol: string;
  /** AI-written copy per slide, keyed the same way as slideAiKey() below. Missing entries fall back to a placeholder string, matching callAI_'s own fallback. */
  aiCopyBySlideKey?: Map<string, AiCopy>;
  /** Optional custom cover-slide title — see fill-tags.ts's DEFAULT_REPORT_TITLE for the fallback. */
  reportTitle?: string | null;
  /** Agency name from account settings — drives the cover slide's "Prepared by ..." line (plain text, no logo) when set. */
  agencyName?: string | null;
  /** Client's uploaded logo, stored in its original format (see logo-processing.ts). Rendered on the cover slide only, left-aligned directly above the "Presented to" / client-name column. Absent: no change to the cover slide. */
  clientLogo?: ImageAsset | null;
  /**
   * True when `templateBuffer` is templates/meta-ads-light.pptx. The static
   * template slides (cover/campaign/table/legend) get their light colors
   * for free from that file's own swapped theme.xml — this flag only drives
   * the two slide builders that draw colors themselves rather than filling
   * a template shape: the from-scratch chart slide (buildChartSlideXml) and
   * the Combined Total table's Previous Month row highlight
   * (buildTableSlideXml), both of which hardcode a dark-template shade that
   * would otherwise render illegibly (e.g. white-on-white) against the
   * light template's own light surfaces.
   */
  isLightTemplate?: boolean;
}

export function slideAiKey(slide: { kind: "campaign" | "adset"; campaignName: string; adSetName?: string }): string {
  return slide.kind === "campaign" ? `campaign:${slide.campaignName}` : `adset:${slide.campaignName}/${slide.adSetName}`;
}

export async function renderPptx(input: RenderPptxInput): Promise<Buffer> {
  const { templateBuffer, data, currencySymbol, aiCopyBySlideKey, reportTitle, agencyName, clientLogo, isLightTemplate = false } = input;
  const template = await loadTemplate(templateBuffer);

  const hasAgencyName = !!agencyName?.trim();

  if (clientLogo) {
    // Logos are stored in whatever format they were uploaded in (see
    // logo-processing.ts) — templates/dark.pptx only declares a
    // package-level Default content type for "png", so a non-PNG logo
    // needs its own Default added here or the embedded media part has no
    // declared MIME type.
    template.contentTypesXml = ensureContentTypeDefault(template.contentTypesXml, clientLogo.extension, clientLogo.contentType);

    const embedded = embedImageInSlide(template.cover, clientLogo, clientLogoBox(hasAgencyName), {
      baseName: "client-logo",
      shapeName: "Client Logo",
      style: CLIENT_LOGO_STYLE,
    });
    template.cover = embedded.slide;
    template.staticFiles.set(embedded.mediaPath, embedded.mediaBytes);
  }

  const slides: SlideToInsert[] = [];

  slides.push({
    xml: buildCoverSlideXml(template.cover, data.cover, { reportTitle, agencyName, reportType: data.reportType }),
    rels: template.cover.rels,
  });

  if (data.isPaused) {
    slides.push({
      xml: buildPausedSlideXml(
        template.campaign,
        data.cover.accountName,
        data.pausedMessage ?? "",
        data.cover.dateRange,
        data.reportType,
        data.platform,
      ),
      rels: template.campaign.rels,
    });
  } else {
    for (const slide of data.campaignSlides) {
      const ai = aiCopyBySlideKey?.get(slideAiKey(slide));
      slides.push({
        xml: buildCampaignOrAdSetSlideXml(template.campaign, slide, ai, data.reportType, data.platform),
        rels: template.campaign.rels,
      });
    }
    for (const slide of data.adSetSlides) {
      const ai = aiCopyBySlideKey?.get(slideAiKey(slide));
      slides.push({
        xml: buildCampaignOrAdSetSlideXml(template.campaign, slide, ai, data.reportType, data.platform),
        rels: template.campaign.rels,
      });
    }
    if (data.chart) {
      slides.push({
        xml: buildChartSlideXml(data.chart, currencySymbol, template.background, isLightTemplate, data.platform),
        rels: buildChartSlideRels(template.background.mediaTarget),
      });
    }
  }

  slides.push({
    xml: buildTableSlideXml(
      template.table,
      data.periodRow,
      data.mtdRow,
      data.tableHeaderLabels,
      data.reportType,
      isLightTemplate,
      data.platform,
    ),
    rels: template.table.rels,
  });
  const legendEntries = collectLegendEntries(data);
  if (legendEntries.length > 0) {
    slides.push({
      xml: buildLegendSlideXml(legendEntries, template.background, isLightTemplate),
      rels: buildLegendSlideRels(template.background.mediaTarget),
    });
  } else {
    slides.push({ xml: template.legend.xml, rels: template.legend.rels });
  }

  return assemblePptx(template, slides);
}
