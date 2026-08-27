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

import type { ReportData, ComparisonReportData } from "../nre/report-data";
import type { ShareVisibility } from "../nre/share-report";
import { adSetVisibilityKey } from "../nre/share-report";
import { CHART_OVERVIEW_MEDIA_FILE, CHART_OVERVIEW_REL_ID } from "./chart-slide-constants";
import { buildCampaignOrAdSetSlideXml, buildCoverSlideXml, buildPausedSlideXml, buildTableSlideXml, presentedToTopY, type AiCopy } from "./fill-tags";
import { embedImageInSlide, ensureContentTypeDefault, SLIDE_HEIGHT_EMU, type ImageAsset, type ImageFrameStyle } from "./embed-image";
import { assemblePptx, loadTemplate, type SlideToInsert } from "./package";
import { buildLegendSlideXml } from "./legend-slide";
import { buildComparisonCampaignSlideXml, buildComparisonCoverSlideXml, buildComparisonSummarySlideXml, COMPARISON_BG_REL_ID } from "./comparison-slides";
import { collectLegendEntries } from "./legend-collect";
import { slideAiKey } from "./slide-keys";

export { collectLegendEntries } from "./legend-collect";
export { slideAiKey } from "./slide-keys";

// Chart slide is one full-slide PNG (browser replica) — no template background layer.
function buildChartSlideRels(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/>' +
    `<Relationship Id="${CHART_OVERVIEW_REL_ID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${CHART_OVERVIEW_MEDIA_FILE}"/>` +
    "</Relationships>"
  );
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
  /** Pre-share editor visibility — omitted means include every slide (initial generation). */
  shareVisibility?: ShareVisibility;
}

export async function renderPptx(input: RenderPptxInput): Promise<Buffer> {
  const {
    templateBuffer,
    data,
    currencySymbol,
    aiCopyBySlideKey,
    reportTitle,
    agencyName,
    clientLogo,
    isLightTemplate = false,
    shareVisibility,
  } = input;
  const vis = shareVisibility;
  const showOverview = vis?.overview !== false;
  const showCombinedTotal = vis?.combinedTotal !== false;
  const showMetricGuide = vis?.metricGuide !== false;
  const campaignVisible = (name: string) => vis?.campaigns[name] !== false;
  const adSetVisible = (campaignName: string, adSetName: string) =>
    vis?.adSets[adSetVisibilityKey(campaignName, adSetName)] !== false;

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
      if (!campaignVisible(slide.campaignName)) continue;
      const ai = aiCopyBySlideKey?.get(slideAiKey(slide));
      slides.push({
        xml: buildCampaignOrAdSetSlideXml(template.campaign, slide, ai, data.reportType, data.platform),
        rels: template.campaign.rels,
      });
      // Part 4 — a second "[Name] — Additional Metrics" slide, present only
      // when the wizard's selectedMetrics exceeded 8 for this campaign.
      if (slide.additionalMetricsSlide) {
        slides.push({
          xml: buildCampaignOrAdSetSlideXml(template.campaign, slide, ai, data.reportType, data.platform, true),
          rels: template.campaign.rels,
        });
      }
    }
    for (const slide of data.adSetSlides) {
      if (!adSetVisible(slide.campaignName, slide.adSetName)) continue;
      const ai = aiCopyBySlideKey?.get(slideAiKey(slide));
      slides.push({
        xml: buildCampaignOrAdSetSlideXml(template.campaign, slide, ai, data.reportType, data.platform),
        rels: template.campaign.rels,
      });
      if (slide.additionalMetricsSlide) {
        slides.push({
          xml: buildCampaignOrAdSetSlideXml(template.campaign, slide, ai, data.reportType, data.platform, true),
          rels: template.campaign.rels,
        });
      }
    }
    if (data.chart && showOverview) {
      const { buildChartSlideBundle } = await import("./chart-slide-render");
      const chartBundle = await buildChartSlideBundle(
        data.chart,
        currencySymbol,
        template.background,
        isLightTemplate,
        data.platform,
      );
      template.staticFiles.set(chartBundle.mediaPath, chartBundle.mediaBytes);
      slides.push({
        xml: chartBundle.xml,
        rels: buildChartSlideRels(),
      });
    }
  }

  if (showCombinedTotal) {
  slides.push({
    xml: buildTableSlideXml(
      template.table,
      data.periodRow,
      data.mtdRow,
      data.tableHeaderLabels,
      data.reportType,
      isLightTemplate,
      data.platform,
      data.combinedTotalStory ?? "",
    ),
    rels: template.table.rels,
  });
  }
  if (showMetricGuide) {
  slides.push({
    xml: buildLegendSlideXml(template.legend.xml, collectLegendEntries(data)),
    rels: template.legend.rels,
  });
  }

  return assemblePptx(template, slides);
}

// ─────────────────────────── Comparison reports ────────────────────────────
//
// A separate top-level entry point from renderPptx above — comparison
// reports have their own slide order (Cover → one comparison campaign slide
// per campaign → summary table; no MTD chart, no ad-set slides, no metric
// guide slide) and their own from-scratch slide builders (see
// comparison-slides.ts), so this doesn't branch inside renderPptx/ReportData
// at all, matching the same "separate, parallel pipeline" split
// report-data.ts's buildComparisonReportData already establishes on the
// data side.

/** Same shape as buildChartSlideRels/buildLegendSlideRels above — the comparison campaign/summary slides are also built from scratch, so each needs its own generated rels rather than reusing a template slide's. */
function buildComparisonSlideRels(backgroundMediaTarget: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/>' +
    `<Relationship Id="${COMPARISON_BG_REL_ID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${backgroundMediaTarget}"/>` +
    "</Relationships>"
  );
}

export interface RenderComparisonPptxInput {
  templateBuffer: Buffer;
  data: ComparisonReportData;
  /** Optional custom cover-slide title — see fill-tags.ts's DEFAULT_COMPARISON_REPORT_TITLE for the fallback. */
  reportTitle?: string | null;
  /** Agency name from account settings — drives the cover slide's "Prepared by ..." line, same as renderPptx. */
  agencyName?: string | null;
}

export async function renderComparisonPptx(input: RenderComparisonPptxInput): Promise<Buffer> {
  const { templateBuffer, data, reportTitle, agencyName } = input;
  const template = await loadTemplate(templateBuffer);

  const slides: SlideToInsert[] = [];

  slides.push({
    xml: buildComparisonCoverSlideXml(template.cover, data, { agencyName, reportTitle }),
    rels: template.cover.rels,
  });

  for (const campaign of data.campaigns) {
    slides.push({
      xml: buildComparisonCampaignSlideXml(campaign, data.periodALabel, data.periodBLabel, template.background),
      rels: buildComparisonSlideRels(template.background.mediaTarget),
    });
  }

  slides.push({
    xml: buildComparisonSummarySlideXml(data, template.background),
    rels: buildComparisonSlideRels(template.background.mediaTarget),
  });

  return assemblePptx(template, slides);
}
