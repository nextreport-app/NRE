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
import { buildCampaignOrAdSetSlideXml, buildCoverSlideXml, buildPausedSlideXml, buildTableSlideXml, presentedToTopY, type AiCopy } from "./fill-tags";
import { embedImageInSlide, ensureContentTypeDefault, SLIDE_HEIGHT_EMU, type ImageAsset } from "./embed-image";
import { assemblePptx, loadTemplate, type LoadedTemplate, type SlideToInsert } from "./package";

const CHART_SLIDE_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/></Relationships>';

// Client logo: cover slide only, LEFT-aligned directly above the
// "PRESENTED TO" label/client-name column (not bottom-right) — max
// 180x90px, aspect-preserved. A square/portrait logo naturally caps at
// 90x90 through the same "contain" fit math, no special-casing needed:
// scaling to fit within a 180-wide x 90-tall box always lands on the
// 90-tall edge once width <= height. X aligns with PRESENTED_TO/
// ACCOUNT_NAME's own left edge (506630 EMU) for a clean vertical column.
//
// PRESENTED_TO's own y is NOT static — buildCoverSlideXml (fill-tags.ts)
// shifts it up when an agency name is set (to make room for the "Prepared
// by ..." line), so every box below anchors off fill-tags.ts's exported
// presentedToTopY() rather than a locally-duplicated constant — anchoring
// to a stale/wrong y here previously caused a real overlap with the
// PRESENTED_TO badge whenever agencyName was also set.
const CLIENT_LOGO_MAX_CX_EMU = 180 * 9525;
const CLIENT_LOGO_MAX_CY_EMU = 90 * 9525;
const CLIENT_LOGO_X_EMU = 506630;
const CLIENT_LOGO_GAP_EMU = 150000; // >= the requested 0.15in (137160 EMU) minimum gap to PRESENTED_TO

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

// Agency logo: every slide's footer, bottom-left corner, max 120x50px.
const AGENCY_LOGO_BOX = { corner: "bottom-left" as const, marginXEmu: 200000, marginYEmu: 200000, maxCxEmu: 120 * 9525, maxCyEmu: 50 * 9525 };

// Cover slide's bottom-left is already fully occupied edge-to-edge —
// PRESENTED_TO through BUDGET_SUMMARY are stacked with almost no slack (see
// the cover-slide spacing fix) — so flush-to-corner placement collides with
// that text. Anchor the footer logo's BOTTOM edge above PRESENTED_TO's top
// instead, same as the client logo above — and when a client logo is ALSO
// present, stack above the client logo's own reserved band (worst-case
// height, regardless of that logo's real aspect ratio) rather than
// overlapping it. Both logos share the same otherwise-empty ~3,000,000 EMU
// gap between the title block and PRESENTED_TO (confirmed empirically), so
// neither placement needs to shift any existing text.
const COVER_AGENCY_LOGO_GAP_EMU = 150000;

function coverAgencyLogoBox(hasClientLogo: boolean, hasAgencyName: boolean) {
  const presentedToY = presentedToTopY(hasAgencyName);
  const bottomY = hasClientLogo
    ? presentedToY - CLIENT_LOGO_GAP_EMU - CLIENT_LOGO_MAX_CY_EMU - COVER_AGENCY_LOGO_GAP_EMU
    : presentedToY - COVER_AGENCY_LOGO_GAP_EMU;
  return { ...AGENCY_LOGO_BOX, marginYEmu: SLIDE_HEIGHT_EMU - bottomY };
}

export interface RenderPptxInput {
  templateBuffer: Buffer;
  data: ReportData;
  currencySymbol: string;
  /** AI-written copy per slide, keyed the same way as slideAiKey() below. Missing entries fall back to a placeholder string, matching callAI_'s own fallback. */
  aiCopyBySlideKey?: Map<string, AiCopy>;
  /** Optional custom cover-slide title — see fill-tags.ts's DEFAULT_REPORT_TITLE for the fallback. */
  reportTitle?: string | null;
  /** Agency name from account settings — drives the cover slide's "Prepared by ..." line when set. */
  agencyName?: string | null;
  /** Client's uploaded logo, stored in its original format (see logo-processing.ts). Rendered on the cover slide only, left-aligned directly above the "Presented to" / client-name column. Absent: no change to the cover slide. */
  clientLogo?: ImageAsset | null;
  /** Agency's uploaded logo, same handling. Rendered bottom-left in the footer of every slide. Absent: no change anywhere. */
  agencyLogo?: ImageAsset | null;
}

const TEMPLATE_PARTS = ["cover", "campaign", "table", "legend"] as const;

/**
 * Bakes the agency footer logo into each of the 4 distinct template slide
 * parts ONCE, before any per-report slide content is generated. Campaign
 * and ad-set slides all clone `template.campaign` (see the loop below in
 * renderPptx), so embedding it here means every generated clone inherits
 * the logo automatically — this is not 1 embed per generated slide, it's 1
 * embed per distinct template part.
 */
function embedAgencyFooterLogo(template: LoadedTemplate, agencyLogo: ImageAsset, hasClientLogo: boolean, hasAgencyName: boolean): void {
  for (const part of TEMPLATE_PARTS) {
    const box = part === "cover" ? coverAgencyLogoBox(hasClientLogo, hasAgencyName) : AGENCY_LOGO_BOX;
    const embedded = embedImageInSlide(template[part], agencyLogo, box, {
      baseName: "agency-footer-logo",
      shapeName: "Agency Logo",
    });
    template[part] = embedded.slide;
    template.staticFiles.set(embedded.mediaPath, embedded.mediaBytes);
  }
}

export function slideAiKey(slide: { kind: "campaign" | "adset"; campaignName: string; adSetName?: string }): string {
  return slide.kind === "campaign" ? `campaign:${slide.campaignName}` : `adset:${slide.campaignName}/${slide.adSetName}`;
}

export async function renderPptx(input: RenderPptxInput): Promise<Buffer> {
  const { templateBuffer, data, currencySymbol, aiCopyBySlideKey, reportTitle, agencyName, clientLogo, agencyLogo } = input;
  const template = await loadTemplate(templateBuffer);

  // Logos are stored in whatever format they were uploaded in (see
  // logo-processing.ts) — templates/dark.pptx only declares a package-level
  // Default content type for "png", so a non-PNG logo needs its own Default
  // added here or the embedded media part has no declared MIME type.
  for (const image of [clientLogo, agencyLogo]) {
    if (image) template.contentTypesXml = ensureContentTypeDefault(template.contentTypesXml, image.extension, image.contentType);
  }

  const hasAgencyName = !!agencyName?.trim();

  if (clientLogo) {
    const embedded = embedImageInSlide(template.cover, clientLogo, clientLogoBox(hasAgencyName), {
      baseName: "client-logo",
      shapeName: "Client Logo",
    });
    template.cover = embedded.slide;
    template.staticFiles.set(embedded.mediaPath, embedded.mediaBytes);
  }
  if (agencyLogo) embedAgencyFooterLogo(template, agencyLogo, !!clientLogo, hasAgencyName);

  const slides: SlideToInsert[] = [];

  slides.push({
    xml: buildCoverSlideXml(template.cover, data.cover, { reportTitle, agencyName }),
    rels: template.cover.rels,
  });

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
      let chartXml = buildChartSlideXml(data.chart, currencySymbol);
      let chartRels = CHART_SLIDE_RELS;
      // Not one of the 4 template parts embedAgencyFooterLogo() covers —
      // built from scratch per-report (see chart-slide.ts), so it needs its
      // own single embed call here instead.
      if (agencyLogo) {
        const embedded = embedImageInSlide({ xml: chartXml, rels: chartRels }, agencyLogo, AGENCY_LOGO_BOX, {
          baseName: "agency-footer-logo",
          shapeName: "Agency Logo",
        });
        chartXml = embedded.slide.xml;
        chartRels = embedded.slide.rels;
        template.staticFiles.set(embedded.mediaPath, embedded.mediaBytes);
      }
      slides.push({ xml: chartXml, rels: chartRels });
    }
  }

  slides.push({
    xml: buildTableSlideXml(template.table, data.periodRow, data.mtdRow, data.tableHeaderLabels),
    rels: template.table.rels,
  });
  slides.push({ xml: template.legend.xml, rels: template.legend.rels });

  return assemblePptx(template, slides);
}
